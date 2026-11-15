/**
 * Outcome labelling — turns "we recommended X" into "X actually worked this well".
 *
 * `recommendation_events` records every decision (input + chosen plan). This module closes
 * the loop: once enough days have passed, it measures what the athlete really did
 * (sessions completed, RPE, meals logged) and writes one row per snapshot into
 * `recommendation_outcomes`. `scripts/export-dataset.mjs` then turns those rows into
 * training data.
 *
 * Design notes:
 *   * idempotent — the (snapshot_id) unique key means a snapshot is labelled once;
 *   * conservative — a label needs at least a few days of behaviour, otherwise it would
 *     encode "no data" as "low adherence";
 *   * best-effort — never blocks a request.
 */
import crypto from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { dbExecute, dbQuery, tableExists } from "@/lib/db.server";
import type { AuthenticatedUser } from "@/lib/auth.server";
import { getLatestRecommendationSnapshot } from "./snapshots.server";

/** Below this many days a plan has not had a fair chance, so no label is written. */
export const MIN_WINDOW_DAYS = 3;

export interface OutcomeLabel {
  snapshotId: string;
  windowDays: number;
  adherence: number;
  nutritionAdherence: number | null;
  sessionsCompleted: number;
  sessionsExpected: number;
  avgRpe: number | null;
  completedCycle: boolean;
  progressScore: number;
}

export type OutcomeResult =
  | { status: "labelled"; label: OutcomeLabel }
  | {
      status: "skipped";
      reason: "no-snapshot" | "already-labelled" | "window-too-short" | "no-tables";
    };

const close = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));

async function resolveEventId(
  userId: string,
  athleteId: string,
  modelVersion: string,
  snapshot: { id: string; requestJson: string; resultJson: string },
): Promise<string | null> {
  const rows = await dbQuery<RowDataPacket[]>(
    `SELECT id FROM recommendation_events
     WHERE (athlete_id = ? OR athlete_id = ?) AND model_version = ?
     ORDER BY created_at DESC LIMIT 1`,
    [userId, athleteId, modelVersion],
  );
  const existing = rows[0]?.["id"];
  if (existing) return String(existing);

  // Older databases may hold snapshots whose generation predates the event log. Create the
  // matching event row from the stored snapshot so the outcome has something to point at.
  const id = crypto.randomUUID();
  const parsedRequest = JSON.parse(snapshot.requestJson) as Record<string, unknown>;
  const parsedResult = JSON.parse(snapshot.resultJson) as {
    sport?: string;
    program?: { archetypeId?: string };
    nutrition?: { strategyId?: string };
    duration?: { months?: number };
    coaching?: { mode?: string };
    safety?: { level?: string };
    expectations?: { confidence?: string; adherenceCycle?: number };
    model?: { source?: string };
  };
  await dbExecute(
    `INSERT INTO recommendation_events
      (id, athlete_id, sport, model_version, model_source, program_archetype,
       nutrition_strategy, duration_months, coaching_mode, safety_level,
       confidence, adherence_cycle, input_json, output_json, latency_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      id,
      athleteId,
      parsedResult.sport ?? String(parsedRequest["sport"] ?? "crossfit"),
      modelVersion,
      parsedResult.model?.source ?? "model",
      parsedResult.program?.archetypeId ?? "unknown",
      parsedResult.nutrition?.strategyId ?? "maintenance",
      parsedResult.duration?.months ?? 1,
      parsedResult.coaching?.mode ?? "ai",
      parsedResult.safety?.level ?? "none",
      parsedResult.expectations?.confidence ?? "low",
      parsedResult.expectations?.adherenceCycle ?? 0,
      snapshot.requestJson,
      snapshot.resultJson,
    ],
  );
  return id;
}

/**
 * Labels the athlete's newest plan with the behaviour observed since it was generated.
 * Safe to call after every write and on every page load: it exits fast when there is
 * nothing new to label.
 */
export async function labelOutcomesForUser(
  user: AuthenticatedUser,
  options: { minWindowDays?: number } = {},
): Promise<OutcomeResult> {
  try {
    if (!(await tableExists("recommendation_outcomes")))
      return { status: "skipped", reason: "no-tables" };
    if (!(await tableExists("recommendation_events")))
      return { status: "skipped", reason: "no-tables" };

    const snapshot = await getLatestRecommendationSnapshot(user.id);
    if (!snapshot) return { status: "skipped", reason: "no-snapshot" };

    const existing = await dbQuery<RowDataPacket[]>(
      `SELECT id FROM recommendation_outcomes WHERE snapshot_id = ? LIMIT 1`,
      [snapshot.id],
    );
    if (existing.length > 0) return { status: "skipped", reason: "already-labelled" };

    const createdAt = new Date(snapshot.createdAt);
    const windowDays = Math.floor((Date.now() - createdAt.getTime()) / 86_400_000);
    const minWindowDays = options.minWindowDays ?? MIN_WINDOW_DAYS;
    if (!Number.isFinite(windowDays) || windowDays < minWindowDays) {
      return { status: "skipped", reason: "window-too-short" };
    }

    const since = createdAt.toISOString().slice(0, 19).replace("T", " ");
    const sessionRows = await dbQuery<RowDataPacket[]>(
      `SELECT
         COUNT(*) AS planned,
         SUM(CASE WHEN status = 'completed' OR completed_at IS NOT NULL THEN 1 ELSE 0 END) AS done,
         AVG(perceived_exertion) AS rpe
       FROM training_sessions
       WHERE athlete_user_id = ? AND scheduled_at >= ?`,
      [user.id, since],
    );
    const planned = Number(sessionRows[0]?.["planned"] ?? 0);
    const completed = Number(sessionRows[0]?.["done"] ?? 0);
    const rpeRaw = sessionRows[0]?.["rpe"];
    const avgRpe = rpeRaw === null || rpeRaw === undefined ? null : close(Number(rpeRaw), 0, 10);

    const expectedPerWeek = snapshot.recommendation.program.sessionsPerWeek || 3;
    const sessionsExpected = Math.max(1, Math.round((expectedPerWeek * windowDays) / 7));
    const adherence = close(completed / sessionsExpected, 0, 1);

    const nutritionRows = await dbQuery<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT DATE(logged_at)) AS days
       FROM nutrition_logs WHERE athlete_user_id = ? AND logged_at >= ?`,
      [user.id, since],
    );
    const mealDays = Number(nutritionRows[0]?.["days"] ?? 0);
    const nutritionAdherence = mealDays > 0 ? close(mealDays / windowDays, 0, 1) : null;

    const durationMonths = Number(snapshot.recommendation.duration.months ?? 1);
    const completedCycle = windowDays >= Math.round(durationMonths * 30 * 0.9);

    // Composite used only for reporting: adherence dominates, nutrition supports it, and an
    // RPE that never left the comfort zone or is stuck at "max effort" is penalised slightly.
    const rpeQuality = avgRpe === null ? 0.6 : close(1 - Math.abs(avgRpe - 7) / 6, 0, 1);
    const progressScore = Math.round(
      (adherence * 0.6 + (nutritionAdherence ?? 0.5) * 0.2 + rpeQuality * 0.2) * 100,
    );

    const eventId = await resolveEventId(user.id, user.athleteId, snapshot.modelVersion, {
      id: snapshot.id,
      requestJson: JSON.stringify(snapshot.request ?? {}),
      resultJson: JSON.stringify(snapshot.recommendation ?? {}),
    });
    if (!eventId) return { status: "skipped", reason: "no-tables" };

    await dbExecute(
      `INSERT INTO recommendation_outcomes
        (id, event_id, athlete_id, completed_cycle, adherence, sessions_completed,
         progress_score, note, snapshot_id, window_days, nutrition_adherence, avg_rpe, label_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'auto')
       ON DUPLICATE KEY UPDATE
         adherence = VALUES(adherence),
         sessions_completed = VALUES(sessions_completed),
         progress_score = VALUES(progress_score),
         window_days = VALUES(window_days),
         nutrition_adherence = VALUES(nutrition_adherence),
         avg_rpe = VALUES(avg_rpe)`,
      [
        crypto.randomUUID(),
        eventId,
        user.id,
        completedCycle ? 1 : 0,
        adherence,
        completed,
        progressScore,
        `window=${windowDays}d planned=${planned} completed=${completed} meals=${mealDays}d`,
        snapshot.id,
        windowDays,
        nutritionAdherence,
        avgRpe,
      ],
    );

    return {
      status: "labelled",
      label: {
        snapshotId: snapshot.id,
        windowDays,
        adherence,
        nutritionAdherence,
        sessionsCompleted: completed,
        sessionsExpected,
        avgRpe,
        completedCycle,
        progressScore,
      },
    };
  } catch (error) {
    console.warn(
      "[outcomes] label failed:",
      error instanceof Error ? error.message : String(error),
    );
    return { status: "skipped", reason: "no-tables" };
  }
}

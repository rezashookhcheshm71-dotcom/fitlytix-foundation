/**
 * Persistence for plan snapshots (`recommendation_snapshots`, migration 004).
 *
 * The athlete must always see *the plan that was actually generated*, with the exact
 * inputs behind it — not a freshly recomputed plan that silently changes after a model
 * update. Snapshots are therefore keyed by (user, input hash, model version), so the
 * same inputs against the same model never produce duplicate rows.
 *
 * Everything here is best-effort: a missing table or an unconfigured database must
 * degrade to "recompute on demand", never break a page or an API call.
 */
import crypto from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { dbExecute, dbQuery, isDatabaseConfigured, tableExists } from "@/lib/db.server";
import type {
  PlanDurationMonths,
  PlanRecommendation,
  RecommendationRequest,
} from "@/domain/recommendation";

export interface RecommendationSnapshot {
  id: string;
  userId: string;
  sport: string;
  source: string;
  createdAt: string;
  inputHash: string;
  modelVersion: string;
  request: RecommendationRequest;
  recommendation: PlanRecommendation;
}

export interface SaveSnapshotArgs {
  userId: string;
  request: RecommendationRequest;
  recommendation: PlanRecommendation;
  source?: "assessment" | "manual" | "backfill" | "recompute";
}

const SNAPSHOT_TABLE = "recommendation_snapshots";
let warnedUnavailable = false;

function warnOnce(message: string): void {
  if (warnedUnavailable) return;
  warnedUnavailable = true;
  console.warn(`[recommendation/snapshots] ${message}`);
}

/** Stable hash so equivalent requests reuse one snapshot. */
export function hashRecommendationRequest(request: RecommendationRequest): string {
  const canonical = {
    sport: request.sport,
    profile: request.profile ?? null,
    answers: request.assessmentAnswers ?? null,
    body: request.bodyAnalysis ?? null,
    behavior: request.behavior ?? null,
    nutrition: request.nutrition ?? null,
    constraints: request.constraints ?? null,
  };

  const sortValue = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sortValue);
    if (value && typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b));
      return Object.fromEntries(entries.map(([k, v]) => [k, sortValue(v)]));
    }
    return value;
  };

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(sortValue(canonical)))
    .digest("hex");
}

export async function snapshotsAvailable(): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  try {
    return await tableExists(SNAPSHOT_TABLE);
  } catch {
    return false;
  }
}

function toIso(value: unknown): string {
  if (!value) return new Date(0).toISOString();
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : new Date(0).toISOString();
}

function safeParse<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "object") return value as T;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
}

function mapRow(row: RowDataPacket): RecommendationSnapshot {
  return {
    id: String(row["id"]),
    userId: String(row["user_id"]),
    sport: String(row["sport"]),
    source: String(row["source"] ?? "assessment"),
    createdAt: toIso(row["created_at"]),
    inputHash: String(row["input_hash"]),
    modelVersion: String(row["model_version"]),
    request: safeParse<RecommendationRequest>(row["request_json"], { sport: "crossfit" }),
    recommendation: safeParse<PlanRecommendation>(row["result_json"], null as never),
  };
}

/** Stores the plan; returns null when persistence is unavailable (never throws). */
export async function saveRecommendationSnapshot(args: SaveSnapshotArgs): Promise<string | null> {
  try {
    if (!(await snapshotsAvailable())) {
      warnOnce("table recommendation_snapshots is missing — plans will not be persisted");
      return null;
    }

    const { request, recommendation } = args;
    const id = crypto.randomUUID();
    const inputHash = hashRecommendationRequest(request);

    const result = await dbExecute(
      `INSERT INTO recommendation_snapshots
        (id, user_id, sport, source, model_version, model_schema_version, model_training_data,
         archetype_id, nutrition_strategy_id, duration_months, coaching_mode, package_id,
         safety_level, confidence, adherence_30d, adherence_cycle, data_completeness,
         input_hash, request_json, result_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE id = id`,
      [
        id,
        args.userId,
        recommendation.sport,
        args.source ?? "assessment",
        recommendation.model.version,
        recommendation.model.schemaVersion,
        recommendation.model.trainingData,
        recommendation.program.archetypeId,
        recommendation.nutrition.strategyId,
        recommendation.duration.months,
        recommendation.coaching.mode,
        recommendation.package.id,
        recommendation.safety.level,
        recommendation.expectations.confidence,
        recommendation.expectations.adherence30d,
        recommendation.expectations.adherenceCycle,
        recommendation.expectations.dataCompleteness,
        inputHash,
        JSON.stringify(request),
        JSON.stringify(recommendation),
      ],
    );

    // A duplicate (same athlete + inputs + model version) keeps the original row.
    if (result.affectedRows === 0) {
      const existing = await dbQuery<RowDataPacket[]>(
        `SELECT id FROM recommendation_snapshots
         WHERE user_id = ? AND input_hash = ? AND model_version = ?
         LIMIT 1`,
        [args.userId, inputHash, recommendation.model.version],
      );
      return existing[0] ? String(existing[0]["id"]) : null;
    }

    return id;
  } catch (error) {
    warnOnce(`save failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

export async function getLatestRecommendationSnapshot(
  userId: string,
): Promise<RecommendationSnapshot | null> {
  try {
    if (!(await snapshotsAvailable())) return null;
    const rows = await dbQuery<RowDataPacket[]>(
      `SELECT * FROM ${SNAPSHOT_TABLE} WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    const row = rows[0];
    return row ? mapRow(row) : null;
  } catch (error) {
    warnOnce(`read failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

export async function countRecommendationSnapshots(userId: string): Promise<number> {
  try {
    if (!(await snapshotsAvailable())) return 0;
    const rows = await dbQuery<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM ${SNAPSHOT_TABLE} WHERE user_id = ?`,
      [userId],
    );
    return Number(rows[0]?.["total"] ?? 0);
  } catch {
    return 0;
  }
}

/** How old a snapshot is, in hours — used to decide whether a plan needs recomputing. */
export function snapshotAgeHours(snapshot: RecommendationSnapshot, now = Date.now()): number {
  const created = new Date(snapshot.createdAt).getTime();
  if (!Number.isFinite(created)) return Number.POSITIVE_INFINITY;
  return (now - created) / 3_600_000;
}

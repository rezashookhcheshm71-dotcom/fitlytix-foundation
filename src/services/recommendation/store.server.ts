/**
 * Append-only logging of recommendation decisions and their outcomes.
 *
 * This is what turns the self-hosted model into a system that can learn from real
 * traffic: every request stores its exact inputs, the chosen action and the model
 * version. Once cycles finish, outcome rows let you retrain against reality
 * (`ml/README.md` → "Using real data").
 *
 * Best-effort by design: a logging failure must never break an athlete's request.
 */
import crypto from "node:crypto";
import { dbExecute, isDatabaseConfigured, tableExists } from "@/lib/db.server";
import type { PlanRecommendation, RecommendationRequest } from "@/domain/recommendation";
import type { RecommendationDiagnostics } from "./engine";

export interface RecordEventArgs {
  athleteId?: string | undefined;
  request: RecommendationRequest;
  recommendation: PlanRecommendation;
  diagnostics: RecommendationDiagnostics;
}

export async function recordRecommendationEvent(args: RecordEventArgs): Promise<void> {
  try {
    if (!isDatabaseConfigured()) return;
    if (!(await tableExists("recommendation_events"))) return;

    const { recommendation } = args;
    await dbExecute(
      `INSERT INTO recommendation_events
        (id, athlete_id, sport, model_version, model_source, program_archetype,
         nutrition_strategy, duration_months, coaching_mode, safety_level,
         confidence, adherence_cycle, input_json, output_json, latency_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        args.athleteId ?? args.request.athleteId ?? null,
        recommendation.sport,
        recommendation.model.version,
        recommendation.model.source,
        recommendation.program.archetypeId,
        recommendation.nutrition.strategyId,
        recommendation.duration.months,
        recommendation.coaching.mode,
        recommendation.safety.level,
        recommendation.expectations.confidence,
        recommendation.expectations.adherenceCycle,
        JSON.stringify({
          profile: args.request.profile ?? null,
          answers: args.request.assessmentAnswers ?? null,
          bodyAnalysis: args.request.bodyAnalysis ?? null,
          behavior: args.request.behavior ?? null,
          constraints: args.request.constraints ?? null,
        }),
        JSON.stringify(recommendation),
        args.diagnostics.latencyMs,
      ],
    );
  } catch (error) {
    console.warn(
      "[recommendation] could not persist decision (non-blocking):",
      error instanceof Error ? error.message : error,
    );
  }
}

export interface RecordOutcomeArgs {
  athleteId: string;
  eventId: string;
  completedCycle: boolean;
  adherence?: number | undefined;
  sessionsCompleted?: number | undefined;
  progressScore?: number | undefined;
  note?: string | undefined;
}

/** Called by a nightly job / coach after a cycle ends — the reward signal for retraining. */
export async function recordRecommendationOutcome(args: RecordOutcomeArgs): Promise<boolean> {
  try {
    if (!isDatabaseConfigured()) return false;
    if (!(await tableExists("recommendation_outcomes"))) return false;
    await dbExecute(
      `INSERT INTO recommendation_outcomes
        (id, event_id, athlete_id, completed_cycle, adherence, sessions_completed, progress_score, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        args.eventId,
        args.athleteId,
        args.completedCycle ? 1 : 0,
        args.adherence ?? null,
        args.sessionsCompleted ?? null,
        args.progressScore ?? null,
        args.note ?? null,
      ],
    );
    return true;
  } catch (error) {
    console.warn(
      "[recommendation] could not persist outcome:",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

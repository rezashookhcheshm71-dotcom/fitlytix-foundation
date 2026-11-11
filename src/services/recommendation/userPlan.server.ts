/**
 * Server-side plan orchestration for a signed-in athlete.
 *
 * One entry point (`resolvePlanForUser`) decides between three states:
 *   1. a stored snapshot that still matches the athlete's current inputs → return it,
 *   2. inputs changed (new assessment / behaviour) or the snapshot is old → recompute,
 *   3. explicit regeneration (coach or athlete asked) → recompute and persist.
 *
 * The UI therefore never needs to know how the model works; it just asks for "my plan"
 * and gets back the plan that was actually generated, its provenance and freshness.
 */
import { getModel } from "./model.server";
import { recommendPlan, type RecommendationDiagnostics } from "./engine";
import { assembleRecommendationRequest } from "./assembly.server";
import {
  getLatestRecommendationSnapshot,
  hashRecommendationRequest,
  saveRecommendationSnapshot,
  snapshotAgeHours,
} from "./snapshots.server";
import { recordRecommendationEvent } from "./store.server";
import type { AuthenticatedUser } from "@/lib/auth.server";
import type {
  CoachingType,
  PlanDurationMonths,
  PlanRecommendation,
  RecommendationConstraints,
  RecommendationRequest,
} from "@/domain/recommendation";

/** A weekly plan stays fresh this long unless the athlete's own inputs change. */
const DEFAULT_MAX_AGE_HOURS = 24 * 7;

export interface ResolvePlanOptions {
  /** Ignore the stored snapshot and recompute. */
  force?: boolean;
  /** Constraints coming from the request (subscription, athlete choice). */
  constraints?: {
    durationMonths?: PlanDurationMonths | "auto" | undefined;
    packageId?: "training" | "nutrition" | "combined" | undefined;
    coachingPreference?: CoachingType | "auto" | undefined;
    maxSessionsPerWeek?: number | undefined;
  };
  maxAgeHours?: number;
  persist?: boolean;
  source?: "assessment" | "manual" | "backfill" | "recompute";
}

export interface ResolvedPlan {
  request: RecommendationRequest;
  recommendation: PlanRecommendation;
  diagnostics: RecommendationDiagnostics | null;
  inputHash: string;
  generatedAt: string;
  fromSnapshot: boolean;
  persisted: boolean;
  snapshotId: string | null;
  /** Signals used to build the request (Persian, for the "why" panel). */
  sourcesFa: string[];
  /** Signals that would improve the plan but are still missing. */
  missingFa: string[];
}

function mergeConstraints(
  base: RecommendationConstraints | undefined,
  overrides: ResolvePlanOptions["constraints"],
): RecommendationConstraints | undefined {
  if (!overrides) return base;
  const merged: RecommendationConstraints = {
    ...(base ?? {}),
    ...(overrides.durationMonths !== undefined ? { durationMonths: overrides.durationMonths } : {}),
    ...(overrides.packageId !== undefined ? { packageId: overrides.packageId } : {}),
    ...(overrides.coachingPreference !== undefined
      ? { coachingPreference: overrides.coachingPreference }
      : {}),
    ...(overrides.maxSessionsPerWeek !== undefined
      ? { maxSessionsPerWeek: overrides.maxSessionsPerWeek }
      : {}),
  };
  return Object.keys(merged).length > 0 ? merged : undefined;
}

export async function resolvePlanForUser(
  user: AuthenticatedUser,
  options: ResolvePlanOptions = {},
): Promise<ResolvedPlan> {
  const assembled = await assembleRecommendationRequest(user);
  const constraints = mergeConstraints(assembled.request.constraints, options.constraints);

  const request: RecommendationRequest = {
    ...assembled.request,
    ...(constraints ? { constraints } : {}),
  };

  const inputHash = hashRecommendationRequest(request);
  const persist = options.persist !== false;
  const maxAgeHours = options.maxAgeHours ?? DEFAULT_MAX_AGE_HOURS;

  if (!options.force) {
    const latest = await getLatestRecommendationSnapshot(user.id);
    if (latest && latest.inputHash === inputHash && snapshotAgeHours(latest) <= maxAgeHours) {
      return {
        request,
        recommendation: latest.recommendation,
        diagnostics: null,
        inputHash,
        generatedAt: latest.createdAt,
        fromSnapshot: true,
        persisted: true,
        snapshotId: latest.id,
        sourcesFa: assembled.sourcesFa,
        missingFa: assembled.missingFa,
      };
    }
  }

  const result = recommendPlan(request, getModel());

  let snapshotId: string | null = null;
  if (persist) {
    snapshotId = await saveRecommendationSnapshot({
      userId: user.id,
      request,
      recommendation: result.recommendation,
      source: options.source ?? (options.force ? "recompute" : "assessment"),
    });
  }

  // Append-only decision log (migration 003) — best-effort, never blocking.
  void recordRecommendationEvent({
    athleteId: user.athleteId,
    request,
    recommendation: result.recommendation,
    diagnostics: result.diagnostics,
  });

  return {
    request,
    recommendation: result.recommendation,
    diagnostics: result.diagnostics,
    inputHash,
    generatedAt: result.recommendation.generatedAt,
    fromSnapshot: false,
    persisted: snapshotId !== null,
    snapshotId,
    sourcesFa: assembled.sourcesFa,
    missingFa: assembled.missingFa,
  };
}

/** Recomputes and stores a plan — call after an assessment is saved. */
export async function refreshPlanForUser(user: AuthenticatedUser): Promise<ResolvedPlan | null> {
  try {
    return await resolvePlanForUser(user, { force: true, source: "assessment", maxAgeHours: 0 });
  } catch (error) {
    console.warn(
      "[recommendation/userPlan] refresh failed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/**
 * Builds a recommendation request from what the platform already knows about an athlete.
 *
 * This is the bridge between the product database and the model:
 *   profile row  → age / sex / height / weight / experience
 *   assessments  → the 56 assessment-derived features (common + sport templates, same field ids)
 *   body records → latest measured body-fat percentage
 *   training_sessions / workout_logs / nutrition_logs → real 28-day behaviour
 *   subscriptions → the commercial cycle length the athlete actually bought
 *
 * Every lookup is defensive: a missing table, column or value simply drops that signal,
 * and the engine imputes from training medians instead of inventing an answer.
 */
import type { RowDataPacket } from "mysql2/promise";
import { dbQuery, getTableColumns, isDatabaseConfigured, tableExists } from "@/lib/db.server";
import type { AuthenticatedUser } from "@/lib/auth.server";
import type {
  GoalId,
  PlanDurationMonths,
  RecommendationBehaviorInput,
  RecommendationConstraints,
  RecommendationRequest,
} from "@/domain/recommendation";
import type { BodyAnalysisRecord } from "@/domain/body-analysis";
import type { AssessmentAnswers, ExperienceLevel, SportId } from "@/domain/types";
import {
  athleteRepository,
  isValidExperienceLevel,
  isValidSportSlug,
} from "@/server/athlete.repository";

export interface AssembledRecommendationRequest {
  request: RecommendationRequest;
  /** Human-readable list of the signals that were actually available. */
  sourcesFa: string[];
  /** Signals the model would use but that are still missing. */
  missingFa: string[];
}

const WINDOW_DAYS = 28;
const GOALS: GoalId[] = ["strength", "muscle", "fat_loss", "endurance", "competition", "health"];
const DURATIONS: PlanDurationMonths[] = [1, 3, 6, 12];

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const n = typeof value === "number" ? value : Number(String(value));
  return Number.isFinite(n) ? n : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function readProfileRow(userId: string): Promise<Record<string, unknown> | null> {
  try {
    if (!(await tableExists("athlete_profiles"))) return null;
    const cols = await getTableColumns("athlete_profiles");
    const wanted = [
      "age",
      "gender",
      "height_cm",
      "weight_kg",
      "experience_level",
      "coaching_type",
    ].filter((c) => cols.has(c));
    if (wanted.length === 0) return null;
    const rows = await dbQuery<RowDataPacket[]>(
      `SELECT ${wanted.join(", ")} FROM athlete_profiles WHERE user_id = ? LIMIT 1`,
      [userId],
    );
    return rows[0] ? (rows[0] as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function readDaysSinceSignup(userId: string): Promise<number | undefined> {
  try {
    if (!(await tableExists("users"))) return undefined;
    const rows = await dbQuery<RowDataPacket[]>(
      `SELECT created_at FROM users WHERE id = ? LIMIT 1`,
      [userId],
    );
    const createdAt = rows[0]?.["created_at"];
    if (!createdAt) return undefined;
    const created = new Date(String(createdAt)).getTime();
    if (!Number.isFinite(created)) return undefined;
    return Math.max(0, Math.round((Date.now() - created) / 86_400_000));
  } catch {
    return undefined;
  }
}

interface SessionBehaviour {
  planned: number;
  completed: number;
  avgRpe?: number;
  previousAvgRpe?: number;
}

async function readSessionBehaviour(userId: string): Promise<SessionBehaviour | null> {
  try {
    if (!(await tableExists("training_sessions"))) return null;
    const cols = await getTableColumns("training_sessions");
    const scheduled = cols.has("scheduled_at")
      ? "scheduled_at"
      : cols.has("created_at")
        ? "created_at"
        : null;
    if (!scheduled) return null;

    const rows = await dbQuery<RowDataPacket[]>(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'completed' OR completed_at IS NOT NULL THEN 1 ELSE 0 END) AS done,
         AVG(CASE WHEN ${scheduled} >= (NOW() - INTERVAL 28 DAY) THEN perceived_exertion END) AS rpe_now,
         AVG(CASE WHEN ${scheduled} < (NOW() - INTERVAL 28 DAY)
                   AND ${scheduled} >= (NOW() - INTERVAL 56 DAY) THEN perceived_exertion END) AS rpe_prev
       FROM training_sessions
       WHERE athlete_user_id = ?
         AND ${scheduled} >= (NOW() - INTERVAL 56 DAY)`,
      [userId],
    );

    const row = rows[0];
    if (!row) return null;
    const planned = Number(row["total"] ?? 0);
    const completed = Number(row["done"] ?? 0);
    if (planned === 0 && completed === 0) return null;

    const avgRpe = toNumber(row["rpe_now"]);
    const previousAvgRpe = toNumber(row["rpe_prev"]);
    return {
      planned,
      completed,
      ...(avgRpe !== undefined ? { avgRpe: clamp(avgRpe, 0, 10) } : {}),
      ...(previousAvgRpe !== undefined ? { previousAvgRpe: clamp(previousAvgRpe, 0, 10) } : {}),
    };
  } catch {
    return null;
  }
}

async function readNutritionAdherence(userId: string): Promise<number | undefined> {
  try {
    if (!(await tableExists("nutrition_logs"))) return undefined;
    const rows = await dbQuery<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT DATE(logged_at)) AS days
       FROM nutrition_logs
       WHERE athlete_user_id = ? AND logged_at >= (NOW() - INTERVAL ${WINDOW_DAYS} DAY)`,
      [userId],
    );
    const days = Number(rows[0]?.["days"] ?? 0);
    if (!Number.isFinite(days) || days <= 0) return undefined;
    return clamp(days / WINDOW_DAYS, 0, 1);
  } catch {
    return undefined;
  }
}

interface SubscriptionContext {
  durationMonths?: PlanDurationMonths;
  packageId?: "training" | "nutrition" | "combined";
  labelFa?: string;
}

async function readActiveSubscription(userId: string): Promise<SubscriptionContext | null> {
  try {
    if (!(await tableExists("subscriptions"))) return null;
    const planTable = (await tableExists("subscription_plans")) ? "subscription_plans" : null;
    const cols = await getTableColumns("subscriptions");
    const statusFilter = cols.has("status") ? "AND s.status IN ('active', 'trialing', 'paid')" : "";
    const planJoin = planTable ? `LEFT JOIN ${planTable} p ON p.id = s.plan_id` : "";
    const planCols = planTable ? ["p.plan_code", "p.features", "p.name"] : [];
    const select = ["s.current_period_start", "s.current_period_end", ...planCols].join(", ");

    const rows = await dbQuery<RowDataPacket[]>(
      `SELECT ${select}
       FROM subscriptions s ${planJoin}
       WHERE s.user_id = ? ${statusFilter}
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [userId],
    );
    const row = rows[0];
    if (!row) return null;

    const start = row["current_period_start"]
      ? new Date(String(row["current_period_start"]))
      : null;
    const end = row["current_period_end"] ? new Date(String(row["current_period_end"])) : null;

    let durationMonths: PlanDurationMonths | undefined;
    if (start && end && Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())) {
      const months = (end.getTime() - start.getTime()) / (30.44 * 86_400_000);
      durationMonths = DURATIONS.find((option) => Math.abs(option - months) <= 0.6);
    }

    let packageId: SubscriptionContext["packageId"];
    const features = row["features"];
    const parsedFeatures = typeof features === "string" ? safeJson(features) : features;
    if (isRecord(parsedFeatures) && typeof parsedFeatures["package"] === "string") {
      const raw = String(parsedFeatures["package"]);
      if (raw === "training" || raw === "nutrition" || raw === "combined") packageId = raw;
    }
    if (!packageId && typeof row["plan_code"] === "string") {
      const code = String(row["plan_code"]).toLowerCase();
      if (code.includes("nutrition") && code.includes("train")) packageId = "combined";
      else if (code.includes("nutrition")) packageId = "nutrition";
      else if (code.includes("train")) packageId = "training";
    }

    const label = typeof row["name"] === "string" ? row["name"] : undefined;
    return {
      ...(durationMonths ? { durationMonths } : {}),
      ...(packageId ? { packageId } : {}),
      ...(label ? { labelFa: label } : {}),
    };
  } catch {
    return null;
  }
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function latestBodyRecord(records: BodyAnalysisRecord[]): BodyAnalysisRecord | undefined {
  return [...records].sort((a, b) =>
    String(b.measuredAt ?? "").localeCompare(String(a.measuredAt ?? "")),
  )[0];
}

export async function assembleRecommendationRequest(
  user: AuthenticatedUser,
): Promise<AssembledRecommendationRequest> {
  const sourcesFa: string[] = [];
  const missingFa: string[] = [];

  let sport: SportId = isValidSportSlug(user.primarySport) ? user.primarySport : "crossfit";
  let experience: ExperienceLevel | undefined;
  let answers: AssessmentAnswers = {};
  let bodyRecords: BodyAnalysisRecord[] = [];
  let wearableConnected = false;

  try {
    const state = await athleteRepository.getAthleteAssessmentState(user);
    if (isValidSportSlug(state.primarySport)) sport = state.primarySport;
    if (isValidExperienceLevel(state.experienceLevel)) experience = state.experienceLevel;

    const commonAnswers = state.commonAssessment?.answers ?? {};
    const sportAnswers = state.sportAssessments[sport]?.answers ?? {};
    answers = { ...commonAnswers, ...sportAnswers };

    if (Object.keys(commonAnswers).length > 0) sourcesFa.push("ارزیابی عمومی");
    if (Object.keys(sportAnswers).length > 0) sourcesFa.push("ارزیابی رشته");
    if (state.wearable.intent === "yes") {
      wearableConnected = true;
      sourcesFa.push("اتصال داده سلامت");
    }

    bodyRecords = state.bodyRecords;
  } catch (error) {
    console.warn(
      "[recommendation/assembly] assessment state unavailable:",
      error instanceof Error ? error.message : error,
    );
  }

  const profileRow = await readProfileRow(user.id);
  const age = toNumber(profileRow?.["age"]);
  const heightCm = toNumber(profileRow?.["height_cm"]);
  const weightKg = toNumber(profileRow?.["weight_kg"]);
  const genderRaw = profileRow?.["gender"];
  const gender =
    genderRaw === "male" || genderRaw === "female" || genderRaw === "other" ? genderRaw : undefined;
  if (!experience && isValidExperienceLevel(profileRow?.["experience_level"])) {
    experience = profileRow["experience_level"] as ExperienceLevel;
  }

  const body = latestBodyRecord(bodyRecords);
  const bodyAnalysis = body
    ? {
        ...(toNumber(body.weightKg) !== undefined ? { weightKg: toNumber(body.weightKg) } : {}),
        ...(toNumber(body.heightCm) !== undefined ? { heightCm: toNumber(body.heightCm) } : {}),
        ...(toNumber(body.bodyFatPct) !== undefined
          ? { bodyFatPct: toNumber(body.bodyFatPct) }
          : {}),
        ...(body.measuredAt ? { measuredAt: String(body.measuredAt) } : {}),
      }
    : undefined;
  if (bodyAnalysis) sourcesFa.push("ترکیب بدن");

  const sessions = await readSessionBehaviour(user.id);
  const nutritionAdherence = await readNutritionAdherence(user.id);
  const daysSinceSignup = await readDaysSinceSignup(user.id);

  const behavior: RecommendationBehaviorInput = {
    windowDays: WINDOW_DAYS,
    ...(sessions
      ? {
          plannedSessions: sessions.planned,
          completedSessions: sessions.completed,
          missedSessions: Math.max(0, sessions.planned - sessions.completed),
        }
      : {}),
    ...(sessions?.avgRpe !== undefined ? { avgRpe: sessions.avgRpe } : {}),
    ...(sessions?.previousAvgRpe !== undefined ? { previousAvgRpe: sessions.previousAvgRpe } : {}),
    ...(nutritionAdherence !== undefined ? { nutritionAdherence } : {}),
    ...(daysSinceSignup !== undefined ? { daysSinceSignup } : {}),
    wearableConnected,
  };

  if (sessions) sourcesFa.push("سابقه جلسات ۲۸ روز");
  else missingFa.push("سابقه جلسات تمرین");
  if (nutritionAdherence !== undefined) sourcesFa.push("پایبندی تغذیه");
  else missingFa.push("لاگ تغذیه");
  if (!body?.bodyFatPct) missingFa.push("درصد چربی بدن");

  const subscription = await readActiveSubscription(user.id);
  if (subscription?.labelFa) sourcesFa.push(`اشتراک فعال: ${subscription.labelFa}`);

  const constraints: RecommendationConstraints | undefined = subscription
    ? {
        ...(subscription.durationMonths ? { durationMonths: subscription.durationMonths } : {}),
        ...(subscription.packageId ? { packageId: subscription.packageId } : {}),
      }
    : undefined;

  const goalRaw = answers["common.goals.primary"];
  let primaryGoal: GoalId | undefined;
  if (typeof goalRaw === "string") {
    const match = /^option_(\d+)$/.exec(goalRaw);
    const index = match ? Number(match[1]) : Number.NaN;
    if (Number.isFinite(index)) primaryGoal = GOALS[index - 1] ?? undefined;
  }

  const request: RecommendationRequest = {
    athleteId: user.athleteId,
    sport,
    ...(age !== undefined ||
    gender ||
    heightCm !== undefined ||
    weightKg !== undefined ||
    experience ||
    primaryGoal
      ? {
          profile: {
            ...(age !== undefined ? { age: clamp(age, 12, 85) } : {}),
            ...(gender ? { gender } : {}),
            ...(heightCm !== undefined ? { heightCm: clamp(heightCm, 120, 230) } : {}),
            ...(weightKg !== undefined ? { weightKg: clamp(weightKg, 30, 250) } : {}),
            ...(experience ? { experience } : {}),
            ...(primaryGoal ? { primaryGoal } : {}),
          },
        }
      : {}),
    assessmentAnswers: answers,
    ...(bodyAnalysis ? { bodyAnalysis } : {}),
    behavior,
    ...(constraints ? { constraints } : {}),
  };

  if (Object.keys(answers).length === 0) missingFa.push("ارزیابی اولیه");

  return { request, sourcesFa, missingFa };
}

/** True when the athlete has enough stored data for a real (non-cold-start) plan. */
export async function hasStoredAssessment(userId: string): Promise<boolean> {
  try {
    if (!isDatabaseConfigured()) return false;
    if (!(await tableExists("assessments"))) return false;
    const rows = await dbQuery<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM assessments WHERE athlete_user_id = ?`,
      [userId],
    );
    return Number(rows[0]?.["total"] ?? 0) > 0;
  } catch {
    return false;
  }
}

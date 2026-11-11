/**
 * Recommendation engine — orchestrator.
 *
 * Pipeline:
 *   assessment + behaviour + body composition
 *     → feature extraction (median imputation from the artefact)
 *     → 4 gradient-boosted models (program / nutrition / duration / coaching)
 *     → session & adherence regressors
 *     → safety guardrails (overrides + flags)
 *     → sport-specific weekly structure + nutrition structure
 *     → ablation-based explanation
 *
 * Pure and synchronous: no I/O, no clock except for the timestamp, so it is safe to
 * call from a server route, a queue worker or a test.
 */
import type {
  CoachingType,
  NutritionStrategyId,
  PlanDurationMonths,
  PlanRecommendation,
  RecommendationRequest,
} from "@/domain/recommendation";
import {
  COACHING_LABEL,
  GOAL_LABEL,
  PACKAGE_NAME_FA,
  PLAN_DURATION_LABEL,
} from "@/domain/recommendation";
import type { FitlytixModelFile } from "./modelTypes";
import { classify, regress } from "./ensemble";
import { explainDecision } from "./explain";
import { faNumber } from "@/lib/locale";
import { extractFeatures, toVector } from "./features";
import { applyGuardrails } from "./guardrails";
import { getArchetypeTemplate } from "./archetypes";
import { buildNutritionRecommendation } from "./nutrition";
import { fallbackArchetype, fallbackDuration, fallbackNutritionStrategy } from "./rules";

const DURATION_VALUES: PlanDurationMonths[] = [1, 3, 6, 12];
const NUTRITION_VALUES: NutritionStrategyId[] = [
  "fat_loss_deficit",
  "lean_gain",
  "performance_fuel",
  "maintenance",
  "recomp",
];
const COACHING_VALUES: CoachingType[] = ["ai", "hybrid", "human"];

export interface RecommendationDiagnostics {
  latencyMs: number;
  featureCount: number;
  modelVersion: string;
  fallbackReasons: string[];
}

export interface RecommendationResult {
  recommendation: PlanRecommendation;
  diagnostics: RecommendationDiagnostics;
}

function parseDuration(className: string | undefined): PlanDurationMonths | undefined {
  const numeric = Number(className);
  return DURATION_VALUES.includes(numeric as PlanDurationMonths)
    ? (numeric as PlanDurationMonths)
    : undefined;
}

function fitDays<T>(days: T[], count: number): T[] {
  if (count >= days.length) return days;
  if (count <= 1) return days.slice(0, 1);
  const picked: T[] = [];
  for (let i = 0; i < count; i += 1) {
    const index = Math.round((i * (days.length - 1)) / (count - 1));
    const item = days[index];
    if (item !== undefined && !picked.includes(item)) picked.push(item);
  }
  return picked;
}

export function recommendPlan(
  request: RecommendationRequest,
  model: FitlytixModelFile,
): RecommendationResult {
  const startedAt = Date.now();
  const fallbackReasons: string[] = [];

  const extraction = extractFeatures(
    {
      sport: request.sport,
      profile: request.profile,
      answers: request.assessmentAnswers,
      bodyAnalysis: request.bodyAnalysis,
      behavior: request.behavior,
    },
    model.fillValues,
  );
  const vector = toVector(extraction.named, model.features);
  const behavior = request.behavior ?? {};

  // ---- model inference ---------------------------------------------------
  let source: "model" | "fallback" = "model";
  let programConfidence = 0;
  let archetypeId: string | undefined;
  let nutritionId: NutritionStrategyId | undefined;
  let durationMonths: PlanDurationMonths | undefined;
  let coachingMode: CoachingType | undefined;
  let sessions = 3;
  let adherence = 0.6;

  const programModel = model.models.program[request.sport];
  if (programModel && programModel.trees.length > 0) {
    const prediction = classify(programModel, vector);
    programConfidence = prediction.confidence;
    const known = model.archetypes[request.sport]?.some((a) => a.id === prediction.best) ?? false;
    if (known) archetypeId = prediction.best;
    else
      fallbackReasons.push(`archetype ${prediction.best} is not registered for ${request.sport}`);
  } else {
    fallbackReasons.push(`no program model for sport ${request.sport}`);
  }

  try {
    const nutritionPrediction = classify(model.models.nutrition, vector);
    if (NUTRITION_VALUES.includes(nutritionPrediction.best as NutritionStrategyId)) {
      nutritionId = nutritionPrediction.best as NutritionStrategyId;
    }
    const durationPrediction = classify(model.models.duration, vector);
    durationMonths = parseDuration(durationPrediction.best);
    const coachingPrediction = classify(model.models.coaching, vector);
    if (COACHING_VALUES.includes(coachingPrediction.best as CoachingType)) {
      coachingMode = coachingPrediction.best as CoachingType;
    }
    sessions = Math.max(2, Math.min(6, Math.round(regress(model.models.sessions, vector))));
    adherence = Math.max(0.05, Math.min(0.97, regress(model.models.adherence, vector)));
  } catch (error) {
    fallbackReasons.push(`inference error: ${error instanceof Error ? error.message : "unknown"}`);
  }

  // ---- deterministic fallbacks ------------------------------------------
  if (!archetypeId) {
    source = "fallback";
    archetypeId = fallbackArchetype({
      sport: request.sport,
      goal: extraction.goal,
      experienceRank: extraction.experienceRankOf,
      painSeverity: extraction.flags.painSeverity,
    });
  }
  if (!nutritionId) {
    source = "fallback";
    nutritionId = fallbackNutritionStrategy({
      goal: extraction.goal,
      bmi: extraction.flags.bmi,
      bodyFatPct: extraction.flags.bodyFatPct,
    });
  }
  if (!durationMonths) {
    durationMonths = fallbackDuration({
      adherence: extraction.flags.adherence28d,
      goal: extraction.goal,
      isNewAthlete: (behavior.priorPlanCount ?? 0) === 0 && (behavior.daysSinceSignup ?? 0) < 30,
    });
  }
  if (!coachingMode) coachingMode = extraction.flags.painSeverity >= 1.6 ? "hybrid" : "ai";

  // ---- guardrails --------------------------------------------------------
  const guardrails = applyGuardrails({
    sport: request.sport,
    prediction: {
      archetypeId,
      sessions,
      sessionMinutes: extraction.sessionMinutes,
      durationMonths,
      coaching: coachingMode,
      nutrition: nutritionId,
      adherence,
    },
    facts: {
      goal: extraction.goal,
      painSeverity: extraction.flags.painSeverity,
      painAreas: extraction.flags.painAreas,
      sleepHours: extraction.flags.sleepHours,
      stress: extraction.flags.stress,
      readinessAvg: extraction.flags.readinessAvg,
      adherence28d: extraction.flags.adherence28d,
      age: extraction.flags.age,
      bmi: extraction.flags.bmi,
      bodyFatPct: extraction.flags.bodyFatPct,
    },
    ...(request.constraints ? { constraints: request.constraints } : {}),
    sessionsAvailable: extraction.sessionsAvailable,
  });

  // ---- programme structure ----------------------------------------------
  const sportArchetypes = model.archetypes[request.sport] ?? [];
  const archetypeMeta =
    sportArchetypes.find((a) => a.id === guardrails.archetypeId) ?? sportArchetypes[0];
  const template = getArchetypeTemplate(
    guardrails.archetypeId,
    sportArchetypes.map((a) => a.id),
  );
  const sessionsPerWeek = Math.max(1, Math.min(guardrails.sessions, template.days.length));
  // Session length follows the archetype design, never exceeds what the athlete has,
  // and is trimmed further when safety demands a conservative load.
  const conservativeSession = guardrails.flags.some(
    (f) => f.code === "pain_clinician_limited" || f.code === "minor_athlete",
  );
  const templateMinutes = archetypeMeta?.minutes ?? extraction.sessionMinutes;
  const sessionMinutes = Math.round(
    Math.min(
      extraction.sessionMinutes,
      templateMinutes,
      conservativeSession ? 60 : extraction.sessionMinutes,
    ),
  );
  const days = fitDays(template.days, sessionsPerWeek);
  const weeks = Math.max(4, Math.round(guardrails.durationMonths * 4.33));
  const deloadWeekIndexes: number[] = [];
  for (let week = template.deloadEveryWeeks; week <= weeks; week += template.deloadEveryWeeks) {
    // Never deload in the final week: it is the test/peak week.
    if (week < weeks) deloadWeekIndexes.push(week);
  }

  const weightKg = extraction.named["weight_kg"] ?? 76;
  const mealsPerDay = request.nutrition?.mealsPerDay ?? 4;
  const nutrition = buildNutritionRecommendation(guardrails.nutrition, {
    sport: request.sport,
    weightKg,
    mealsPerDay,
    goalLabelFa: GOAL_LABEL[extraction.goal],
    restrictions: request.nutrition?.restrictions,
    strategyOverrideNote: guardrails.nutritionReason,
  });

  // ---- expectations ------------------------------------------------------
  const durationFactor = 1 - 0.035 * (guardrails.durationMonths / 3 - 1);
  const cycleAdherence = Math.max(0.05, Math.min(0.97, adherence * durationFactor));
  const adherence30d = Math.max(0.05, Math.min(0.98, adherence * 1.12));
  const dataCompleteness = Math.max(0, Math.min(1, 1 - extraction.missing.length / 6));
  const confidence: "low" | "medium" | "high" =
    source === "model" && dataCompleteness >= 0.66 && programConfidence >= 0.5
      ? "high"
      : source === "model" && dataCompleteness >= 0.4
        ? "medium"
        : "low";

  // ---- explanation -------------------------------------------------------
  const explanations = programModel
    ? explainDecision({
        model: programModel,
        features: model.features,
        vector,
        named: extraction.named,
        fillValues: model.fillValues,
        targetClass: guardrails.archetypeId,
        topK: 6,
      })
    : [];

  const packageId = request.constraints?.packageId ?? "combined";
  const safetyLevel = guardrails.flags.some((f) => f.severity === "review_required")
    ? "review_required"
    : guardrails.flags.some((f) => f.severity === "caution")
      ? "caution"
      : "none";

  const durationRationale = guardrails.durationReason
    ? guardrails.durationReason
    : `با هدف «${GOAL_LABEL[extraction.goal]}»، سابقه ${faNumber(Math.round(extraction.experienceRankOf))} از ۳ و پیش‌بینی پایبندی حدود ${faNumber(Math.round(cycleAdherence * 100))}٪، این دوره بهترین تعادل بین فرصت پیشرفت و ریسک رها کردن برنامه است.`;

  const coachingRationale = guardrails.coachingReason
    ? guardrails.coachingReason
    : guardrails.coaching === "human"
      ? "شرایط فعلی (درد، سابقه یا هدف مسابقه) بازبینی انسانی را ضروری می‌کند."
      : guardrails.coaching === "hybrid"
        ? "موتور هوشمند برنامه را می‌سازد و مربی انسانی نقاط حساس را بازبینی می‌کند."
        : "برنامه با موتور هوشمند کافی است؛ ورودی‌ها روشن و ریسک پایین است.";

  const recommendation: PlanRecommendation = {
    ...(request.athleteId ? { athleteId: request.athleteId } : {}),
    sport: request.sport,
    generatedAt: new Date().toISOString(),
    model: {
      version: model.modelVersion,
      trainedAt: model.trainedAt,
      source,
      schemaVersion: model.schemaVersion,
      trainingData: model.trainingData,
    },
    program: {
      archetypeId: guardrails.archetypeId,
      labelFa: archetypeMeta?.labelFa ?? template.id,
      summaryFa: archetypeMeta?.summaryFa ?? "ساختار برنامه بر اساس ارزیابی اولیه.",
      sessionsPerWeek,
      sessionMinutes,
      weeks,
      deloadWeekIndexes,
      progressionNotes: [...template.progressionNotes, ...guardrails.notes],
      days,
      focusTags: archetypeMeta?.tags ?? [],
    },
    nutrition,
    duration: {
      months: guardrails.durationMonths,
      labelFa: PLAN_DURATION_LABEL[guardrails.durationMonths],
      rationaleFa: durationRationale,
      overrideApplied: guardrails.durationChanged,
    },
    coaching: {
      mode: guardrails.coaching,
      labelFa: COACHING_LABEL[guardrails.coaching],
      rationaleFa: coachingRationale,
    },
    package: {
      id: packageId,
      nameFa: PACKAGE_NAME_FA[packageId],
      rationaleFa:
        packageId === "combined"
          ? "برنامه تمرین و ساختار تغذیه با هم تنظیم شده‌اند؛ شدت جلسه و روزهای کربوهیدرات بالا هماهنگ است."
          : packageId === "training"
            ? "این پیشنهاد روی تمرین متمرکز است؛ ساختار تغذیه به‌عنوان مرجع در دسترس است."
            : "این پیشنهاد روی تغذیه متمرکز است؛ ساختار تمرین به‌عنوان مرجع در دسترس است.",
    },
    expectations: {
      adherence30d: Math.round(adherence30d * 100) / 100,
      adherenceCycle: Math.round(cycleAdherence * 100) / 100,
      dataCompleteness: Math.round(dataCompleteness * 100) / 100,
      confidence,
    },
    safety: {
      level: safetyLevel,
      flags: guardrails.flags,
    },
    explanations,
    inputs: {
      used: extraction.used,
      missing: extraction.missing,
    },
  };

  return {
    recommendation,
    diagnostics: {
      latencyMs: Date.now() - startedAt,
      featureCount: model.features.length,
      modelVersion: model.modelVersion,
      fallbackReasons,
    },
  };
}

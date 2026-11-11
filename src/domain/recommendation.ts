/**
 * Recommendation domain — contracts between the self-hosted ML model, the API and the UI.
 *
 * The model itself is trained offline (`ml/train.py`) and exported as JSON trees.
 * Everything here is deterministic and testable; nothing in this file calls a network.
 */
import type {
  AssessmentAnswers,
  CoachingType,
  ExperienceLevel,
  PackageId,
  SportId,
  WorkoutBlockType,
} from "./types";

export type { CoachingType } from "./types";

export type GoalId = "strength" | "muscle" | "fat_loss" | "endurance" | "competition" | "health";
export type PlanDurationMonths = 1 | 3 | 6 | 12;

export type NutritionStrategyId =
  "fat_loss_deficit" | "lean_gain" | "performance_fuel" | "maintenance" | "recomp";

export interface RecommendationProfileInput {
  age?: number | undefined;
  gender?: "male" | "female" | "other" | undefined;
  heightCm?: number | undefined;
  weightKg?: number | undefined;
  experience?: ExperienceLevel | undefined;
  primaryGoal?: GoalId | undefined;
  sessionsPerWeek?: number | undefined;
  minutesPerSession?: number | undefined;
}

export interface BodyCompositionInput {
  weightKg?: number | undefined;
  heightCm?: number | undefined;
  bodyFatPct?: number | undefined;
  measuredAt?: string | undefined;
}

/**
 * Behaviour summary over a trailing window (default 28 days).
 * The platform feeds this from workout logs / feedback; passing nothing means a cold start.
 */
export interface RecommendationBehaviorInput {
  windowDays?: number | undefined;
  plannedSessions?: number | undefined;
  completedSessions?: number | undefined;
  missedSessions?: number | undefined;
  avgRpe?: number | undefined;
  previousAvgRpe?: number | undefined;
  feedbackCount?: number | undefined;
  readinessAvg?: number | undefined;
  nutritionAdherence?: number | undefined;
  daysSinceSignup?: number | undefined;
  priorPlanMonths?: number | undefined;
  priorPlanCount?: number | undefined;
  wearableConnected?: boolean | undefined;
}

export interface RecommendationConstraints {
  /** "auto" (default) lets the model pick the commercial cycle length. */
  durationMonths?: PlanDurationMonths | "auto" | undefined;
  packageId?: PackageId | undefined;
  coachingPreference?: CoachingType | "auto" | undefined;
  maxSessionsPerWeek?: number | undefined;
}

export interface RecommendationRequest {
  athleteId?: string | undefined;
  sport: SportId;
  profile?: RecommendationProfileInput | undefined;
  assessmentAnswers?: AssessmentAnswers | undefined;
  bodyAnalysis?: BodyCompositionInput | undefined;
  behavior?: RecommendationBehaviorInput | undefined;
  /** Optional nutrition preferences captured elsewhere in onboarding. */
  nutrition?: { mealsPerDay?: number | undefined; restrictions?: string[] | undefined } | undefined;
  constraints?: RecommendationConstraints | undefined;
}

export interface ProgramDayTemplate {
  index: number;
  titleFa: string;
  focusFa: string;
  blocks: WorkoutBlockType[];
  mainMovements: string[];
}

export interface ProgramRecommendation {
  archetypeId: string;
  labelFa: string;
  summaryFa: string;
  sessionsPerWeek: number;
  sessionMinutes: number;
  weeks: number;
  deloadWeekIndexes: number[];
  progressionNotes: string[];
  days: ProgramDayTemplate[];
  focusTags: string[];
}

export interface MacroRange {
  id: "protein" | "carb" | "fat";
  labelFa: string;
  gPerKg: [number, number];
  roleFa: string;
}

export interface MealSlotTemplate {
  titleFa: string;
  timingFa: string;
  templateFa: string;
  focus: "protein" | "carb" | "balanced" | "light";
}

export interface DayTypeNutrition {
  dayType: "hard" | "training" | "rest";
  labelFa: string;
  carbMultiplier: number;
  noteFa: string;
}

export interface NutritionRecommendation {
  strategyId: NutritionStrategyId;
  labelFa: string;
  summaryFa: string;
  energyIntentFa: string;
  macros: MacroRange[];
  hydrationL: number;
  mealsPerDay: number;
  meals: MealSlotTemplate[];
  dayTypes: DayTypeNutrition[];
  weeklyAdjustments: string[];
  notes: string[];
}

export interface SafetyFlag {
  code:
    | "pain_clinician_limited"
    | "pain_reported"
    | "low_sleep"
    | "high_stress"
    | "low_readiness"
    | "low_adherence"
    | "underweight"
    | "minor_athlete"
    | "high_volume_cap"
    | "nutrition_risk";
  labelFa: string;
  actionFa: string;
  severity: "info" | "caution" | "review_required";
}

export interface RecommendationExplanation {
  feature: string;
  labelFa: string;
  valueFa: string;
  direction: "supports" | "against";
  weight: number;
  textFa: string;
}

export interface RecommendationExpectations {
  /** Predicted probability of finishing the first 4 weeks as planned (0..1). */
  adherence30d: number;
  /** Predicted probability of finishing the whole cycle (0..1). */
  adherenceCycle: number;
  /** How much of the decision is backed by measured inputs vs. sensible defaults. */
  dataCompleteness: number;
  confidence: "low" | "medium" | "high";
}

export interface PlanRecommendation {
  athleteId?: string | undefined;
  sport: SportId;
  generatedAt: string;
  model: {
    version: string;
    trainedAt: string;
    source: "model" | "fallback";
    schemaVersion: number;
    /** Provenance: "simulated" means the model learned from the documented simulator, not real outcomes. */
    trainingData: string;
  };
  program: ProgramRecommendation;
  nutrition: NutritionRecommendation;
  duration: {
    months: PlanDurationMonths;
    labelFa: string;
    rationaleFa: string;
    overrideApplied: boolean;
  };
  coaching: {
    mode: CoachingType;
    labelFa: string;
    rationaleFa: string;
  };
  package: {
    id: PackageId;
    nameFa: string;
    rationaleFa: string;
  };
  expectations: RecommendationExpectations;
  safety: {
    level: "none" | "caution" | "review_required";
    flags: SafetyFlag[];
  };
  explanations: RecommendationExplanation[];
  inputs: {
    used: string[];
    missing: string[];
  };
}

export interface RecommendationResponse {
  ok: true;
  recommendation: PlanRecommendation;
  diagnostics: {
    latencyMs: number;
    featureCount: number;
    modelVersion: string;
    fallbackReasons: string[];
  };
}

export const PLAN_DURATION_LABEL: Record<PlanDurationMonths, string> = {
  1: "۱ ماه · شروع کوتاه و کم‌تعهد",
  3: "۳ ماه · یک چرخه کامل تمرین",
  6: "۶ ماه · ساخت و تثبیت",
  12: "۱۲ ماه · مسیر بلندمدت",
};

export const GOAL_LABEL: Record<GoalId, string> = {
  strength: "قدرت",
  muscle: "عضله‌سازی",
  fat_loss: "کاهش چربی",
  endurance: "استقامت",
  competition: "آمادگی مسابقه",
  health: "سلامت و روند پایدار",
};

export const COACHING_LABEL: Record<CoachingType, string> = {
  ai: "مربی هوشمند",
  hybrid: "هوشمند + بازبینی مربی",
  human: "مربی انسانی",
};

export const PACKAGE_NAME_FA: Record<PackageId, string> = {
  training: "تمرین",
  nutrition: "تغذیه",
  combined: "تمرین + تغذیه",
};

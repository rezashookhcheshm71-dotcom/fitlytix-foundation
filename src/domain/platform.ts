/**
 * FitLytix platform domain — additive types for Athlete 360, health, readiness, nutrition,
 * goals, decisions, coach workflows, notifications, passport and packages.
 * Pure types/constants only: no UI, no mock data, no provider SDKs.
 * TODO(backend): each interface maps 1:1 to a table/DTO described in docs/architecture.md.
 */
import { z } from "zod";
import type { ExperienceLevel, SportId } from "./types";

/* Health / wearables ------------------------------------------------------ */

export const HEALTH_PROVIDERS = ["garmin", "apple_health", "health_connect", "whoop", "oura", "polar", "fitbit", "samsung_health", "other"] as const;
export type HealthProvider = (typeof HEALTH_PROVIDERS)[number];
export type HealthSource = HealthProvider | "manual";
/** Standard lifecycle for every provider connection. `connected`/`syncing` require a real server-side token. */
export const CONNECTION_STATUSES = ["not_connected", "pending", "connected", "syncing", "error", "revoked"] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];
/** yes = owns a device; manual = will enter data by hand; no = not using one; later = undecided. */
export type WearableIntent = "yes" | "no" | "later" | "manual";

/** How a provider reaches FitLytix in the future (drives Phase 2 connector work, not UI logic). */
export type ProviderTransport = "mobile_bridge" | "cloud_oauth" | "none";
export const PROVIDER_TRANSPORT: Record<HealthProvider, ProviderTransport> = {
  apple_health: "mobile_bridge",
  health_connect: "mobile_bridge",
  samsung_health: "mobile_bridge",
  garmin: "cloud_oauth",
  whoop: "cloud_oauth",
  oura: "cloud_oauth",
  polar: "cloud_oauth",
  fitbit: "cloud_oauth",
  other: "none",
};
export const TRANSPORT_NOTE: Record<ProviderTransport, string> = {
  mobile_bridge: "نیازمند اپ موبایل FitLytix",
  cloud_oauth: "نیازمند اتصال API سرویس",
  none: "فعلاً فقط ورود دستی",
};

export type HealthScope = "workouts" | "heart_rate" | "hrv" | "sleep" | "activity" | "body" | "recovery";
export const HEALTH_SCOPE_LABEL: Record<HealthScope, string> = {
  workouts: "جلسه‌های تمرین",
  heart_rate: "ضربان قلب",
  hrv: "HRV",
  sleep: "خواب",
  activity: "قدم و فعالیت روزانه",
  body: "وزن و ترکیب بدن",
  recovery: "ریکاوری / آمادگی",
};
/** Scopes we plan to request per provider once a real connector exists. */
export const PROVIDER_SCOPES: Record<HealthProvider, HealthScope[]> = {
  garmin: ["workouts", "heart_rate", "hrv", "sleep", "activity", "body"],
  apple_health: ["workouts", "heart_rate", "hrv", "sleep", "activity", "body"],
  health_connect: ["workouts", "heart_rate", "hrv", "sleep", "activity", "body"],
  whoop: ["workouts", "heart_rate", "hrv", "sleep", "recovery"],
  oura: ["heart_rate", "hrv", "sleep", "activity", "recovery"],
  polar: ["workouts", "heart_rate", "hrv", "sleep", "activity"],
  samsung_health: ["workouts", "heart_rate", "sleep", "activity", "body"],
  fitbit: ["workouts", "heart_rate", "hrv", "sleep", "activity", "body"],
  other: [],
};

export const PROVIDER_LABEL: Record<HealthSource, string> = {
  garmin: "Garmin",
  apple_health: "Apple Watch / Apple Health",
  health_connect: "Google Health Connect",
  whoop: "WHOOP",
  oura: "Oura",
  polar: "Polar",
  samsung_health: "Samsung Health",
  fitbit: "Fitbit",
  other: "سایر",
  manual: "ورود دستی",
};

export const CONNECTION_STATUS_LABEL: Record<ConnectionStatus, string> = {
  not_connected: "وصل نیست",
  pending: "انتخاب شده · اتصال به‌زودی",
  connected: "وصل",
  syncing: "در حال همگام‌سازی",
  error: "خطا در اتصال",
  revoked: "دسترسی قطع شد",
};

export interface HealthProviderConnection {
  id: string;
  athleteId: string;
  provider: HealthProvider;
  status: ConnectionStatus;
  /** Granted scopes — empty until a real connector grants them. */
  scopes?: HealthScope[];
  externalAccountId?: string;
  connectedAt?: string;
  lastSyncAt?: string;
  lastError?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** Canonical metric types every provider normalizes into (see services/health-data/normalize.ts). */
export type HealthMetricType =
  | "heart_rate" | "resting_hr" | "hrv" | "sleep_duration" | "sleep_score" | "steps" | "active_calories"
  | "workout" | "training_load" | "vo2max" | "weight" | "body_fat" | "respiratory_rate" | "recovery" | "readiness" | "stress";

export interface HealthMetric {
  id: string;
  athleteId: string;
  source: HealthSource;
  connectionId?: string;
  metricType: HealthMetricType;
  value: number;
  unit: string;
  startTime: string;
  endTime?: string;
  externalId?: string;
  deviceId?: string;
  metadata?: Record<string, unknown>;
  rawPayload?: unknown;
  createdAt: string;
}

export const METRIC_DEFS: Record<HealthMetricType, { label: string; unit: string; min: number; max: number; step?: number; manual?: boolean }> = {
  resting_hr: { label: "ضربان استراحت", unit: "bpm", min: 25, max: 130, manual: true },
  hrv: { label: "HRV", unit: "ms", min: 5, max: 300, manual: true },
  sleep_duration: { label: "خواب", unit: "ساعت", min: 0, max: 16, step: 0.1, manual: true },
  vo2max: { label: "VO2max", unit: "ml/kg/min", min: 15, max: 95, manual: true },
  weight: { label: "وزن", unit: "kg", min: 30, max: 300, step: 0.1, manual: true },
  body_fat: { label: "درصد چربی", unit: "%", min: 2, max: 65, step: 0.1, manual: true },
  steps: { label: "قدم", unit: "قدم", min: 0, max: 100000, manual: true },
  training_load: { label: "بار تمرین", unit: "AU", min: 0, max: 3000, manual: true },
  heart_rate: { label: "ضربان قلب", unit: "bpm", min: 25, max: 230 },
  sleep_score: { label: "امتیاز خواب", unit: "/100", min: 0, max: 100 },
  active_calories: { label: "کالری فعال", unit: "kcal", min: 0, max: 10000 },
  workout: { label: "خلاصه تمرین (مدت)", unit: "min", min: 0, max: 600, manual: true },
  respiratory_rate: { label: "تنفس", unit: "br/min", min: 4, max: 60 },
  recovery: { label: "ریکاوری", unit: "/100", min: 0, max: 100 },
  readiness: { label: "آمادگی", unit: "/100", min: 0, max: 100 },
  stress: { label: "استرس", unit: "/100", min: 0, max: 100 },
};
export const MANUAL_METRICS = (Object.keys(METRIC_DEFS) as HealthMetricType[]).filter((k) => METRIC_DEFS[k].manual);

export const manualHealthInputSchema = z
  .object({
    measuredAt: z.string().min(8, "تاریخ را وارد کن"),
    values: z.record(z.string(), z.number()),
    notes: z.string().trim().max(500, "حداکثر ۵۰۰ کاراکتر").optional(),
  })
  .superRefine((v, ctx) => {
    const entries = Object.entries(v.values) as [HealthMetricType, number][];
    if (entries.length === 0) ctx.addIssue({ code: "custom", path: ["values"], message: "حداقل یک عدد وارد کن" });
    for (const [k, n] of entries) {
      const d = METRIC_DEFS[k];
      if (!d) { ctx.addIssue({ code: "custom", path: ["values", k], message: "نوع داده ناشناخته" }); continue; }
      if (Number.isNaN(n) || n < d.min || n > d.max) ctx.addIssue({ code: "custom", path: ["values", k], message: `بین ${d.min} تا ${d.max} ${d.unit}` });
    }
  });
export type ManualHealthInput = z.infer<typeof manualHealthInputSchema>;

/** What the athlete typed (audit trail). Each entry also yields canonical HealthMetric rows with source "manual". */
export interface ManualHealthEntry {
  id: string;
  athleteId: string;
  metricType: HealthMetricType;
  value: number;
  unit: string;
  measuredAt: string;
  notes?: string;
  createdAt: string;
}

/* Readiness / recovery ---------------------------------------------------- */

export type ReadinessLevel = "ready" | "moderate" | "recovery_needed";
export const READINESS_LABEL: Record<ReadinessLevel, string> = { ready: "آماده", moderate: "متوسط", recovery_needed: "نیاز به ریکاوری" };

export interface ReadinessFactor {
  key: "sleep" | "hrv" | "resting_hr" | "training_load" | "soreness" | "fatigue" | "performance";
  label: string;
  value: string;
  effect: "positive" | "neutral" | "negative";
  source: HealthSource | "assessment" | "snapshot";
}

export interface ReadinessAssessment {
  athleteId: string;
  date: string;
  score: number; // 0..100
  level: ReadinessLevel;
  factors: ReadinessFactor[];
  why: string;
  source: "mock";
}

/* Nutrition --------------------------------------------------------------- */

export type DayType = "hard" | "training" | "rest";

export interface NutritionProfile {
  athleteId: string;
  goal: "fat_loss" | "muscle_gain" | "performance" | "health";
  mealsPerDay: number;
  restrictions: string[];
  allergies: string[];
  likes: string[];
  dislikes: string[];
  hydrationTargetL: number;
}

export interface Meal {
  id: string;
  title: string;
  timing: string;
  idea: string;
  focus: "protein" | "carb" | "balanced" | "light";
}

export interface NutritionPlan {
  id: string;
  athleteId: string;
  dayType: DayType;
  meals: Meal[];
  hydrationL: number;
  notes: string[];
  ownedBy: "coach" | "draft";
  source: "mock";
}

export interface NutritionFeedback {
  athleteId: string;
  date: string;
  adherence: number; // 0..1
  hunger: 1 | 2 | 3 | 4 | 5;
  energy: 1 | 2 | 3 | 4 | 5;
  note?: string;
}

/* Goals / journey --------------------------------------------------------- */

export type JourneyStage = "assessment" | "foundation" | "build" | "benchmark" | "performance" | "goal";
export const JOURNEY_STAGES: { id: JourneyStage; label: string }[] = [
  { id: "assessment", label: "ارزیابی" },
  { id: "foundation", label: "پایه" },
  { id: "build", label: "ساخت" },
  { id: "benchmark", label: "سنجش" },
  { id: "performance", label: "عملکرد" },
  { id: "goal", label: "هدف" },
];

export interface Milestone {
  id: string;
  title: string;
  done: boolean;
  date?: string;
}

export interface GoalPlan {
  id: string;
  athleteId: string;
  type: "performance" | "body" | "health" | "skill" | "race";
  title: string;
  target: string;
  current: string;
  deadline?: string;
  progress: number; // 0..1
  milestones: Milestone[];
  weeklyFocus: string;
  status: "on_track" | "at_risk" | "done";
}

/* Decision engine / why --------------------------------------------------- */

export type DecisionInputKey = "athlete" | "dna" | "goal" | "training" | "nutrition" | "recovery" | "health" | "feedback";

export interface DecisionRecommendation {
  id: string;
  kind: "today_focus" | "training_adjustment" | "nutrition_context" | "recovery_focus" | "attention" | "next_week";
  title: string;
  text: string;
  why: string;
  inputs: DecisionInputKey[];
  confidence: "low" | "medium";
}

export interface DecisionContext {
  athleteId: string;
  sport: SportId;
  packageId: PackageId;
  readiness: ReadinessAssessment;
  goal?: GoalPlan | undefined;
  availableInputs: DecisionInputKey[];
}

/* Coach ------------------------------------------------------------------- */

export interface CoachAssessment {
  displayName: string;
  title: string;
  sports: SportId[];
  level: "assistant" | "coach" | "head_coach";
  certifications: string[];
  yearsCoaching: number;
  style: string;
  languages: string[];
  delivery: ("online" | "in_person")[];
  capacity: number;
  goals: string;
  bio: string;
  expertise: string[];
  photoUrl?: string;
}

export interface CoachAttentionItem {
  id: string;
  athleteId: string;
  athleteName: string;
  reason: "low_readiness" | "adherence_drop" | "missed_feedback" | "nutrition_flag" | "performance_drop";
  detail: string;
  severity: "watch" | "act";
  suggestedAction: string;
}

export interface WeeklyCoachBrief {
  weekLabel: string;
  activeAthletes: number;
  avgAdherence: number;
  attention: CoachAttentionItem[];
  improvements: { athleteName: string; text: string }[];
  recoveryConcerns: string[];
  nutritionFlags: string[];
  followUps: string[];
  source: "mock";
}

/* AI proposals (coach-controlled) ---------------------------------------- */

export type AIProposalStatus = "draft" | "needs_review" | "approved" | "rejected";
export const PROPOSAL_STATUS_LABEL: Record<AIProposalStatus, string> = {
  draft: "پیشنهاد اولیه",
  needs_review: "نیازمند بررسی مربی",
  approved: "تأییدشده توسط مربی",
  rejected: "رد شد",
};

export interface ProposalSection {
  id: string;
  title: string;
  lines: string[];
}

export interface AIProposal {
  id: string;
  kind: "training" | "nutrition";
  athleteId: string;
  coachId: string;
  goal: string;
  status: AIProposalStatus;
  sections: ProposalSection[];
  rationale: string[];
  sourceContext: DecisionInputKey[];
  createdAt: string;
  approvedAt?: string;
  provider: "mock";
}

/* Notifications ----------------------------------------------------------- */

export interface AppNotification {
  id: string;
  athleteId: string;
  kind: "pre_workout" | "post_workout_feedback" | "nutrition" | "recovery" | "milestone" | "streak" | "coach_message";
  title: string;
  body: string;
  scheduledFor: string;
  channel: "in_app";
  delivered: false;
}

/* Packages ---------------------------------------------------------------- */

export type PackageId = "training" | "nutrition" | "combined";
export interface ProductPackage {
  id: PackageId;
  name: string;
  includes: { training: boolean; nutrition: boolean };
  coachingModes: ("ai" | "human" | "hybrid")[];
}

/* Passport ---------------------------------------------------------------- */

export interface AthletePassport {
  athleteId: string;
  name: string;
  sport: SportId;
  level: ExperienceLevel;
  archetype: string;
  topDimensions: { label: string; score: number }[];
  prs: { name: string; value: string }[];
  benchmarks: { name: string; result: string }[];
  skills: string[];
  goals: string[];
  consistency: number;
  progressNote: string;
  shareable: false;
}

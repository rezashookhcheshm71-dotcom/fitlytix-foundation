/**
 * FitLytix platform domain — additive types for Athlete 360, health, readiness, nutrition,
 * goals, decisions, coach workflows, notifications, passport and packages.
 * Pure types/constants only: no UI, no mock data, no provider SDKs.
 * TODO(backend): each interface maps 1:1 to a table/DTO described in docs/architecture.md.
 */
import { z } from "zod";
import type { ExperienceLevel, SportId } from "./types";

/* Health / wearables ------------------------------------------------------ */

export const HEALTH_PROVIDERS = ["garmin", "apple_health", "google_health_connect", "whoop", "oura", "polar", "samsung", "fitbit", "other"] as const;
export type HealthProvider = (typeof HEALTH_PROVIDERS)[number];
export type HealthSource = HealthProvider | "manual";
export type ConnectionStatus = "not_connected" | "ready_to_connect" | "connected" | "sync_error" | "manual";
export type WearableIntent = "yes" | "no" | "later";

export const PROVIDER_LABEL: Record<HealthSource, string> = {
  garmin: "Garmin",
  apple_health: "Apple Watch / Apple Health",
  google_health_connect: "Google Health Connect",
  whoop: "WHOOP",
  oura: "Oura",
  polar: "Polar",
  samsung: "Samsung Galaxy Watch",
  fitbit: "Fitbit",
  other: "سایر",
  manual: "ورود دستی",
};

export const CONNECTION_STATUS_LABEL: Record<ConnectionStatus, string> = {
  not_connected: "وصل نیست",
  ready_to_connect: "آماده اتصال",
  connected: "وصل",
  sync_error: "خطا در همگام‌سازی",
  manual: "ورود دستی",
};

export interface HealthProviderConnection {
  id: string;
  athleteId: string;
  provider: HealthProvider;
  status: ConnectionStatus;
  externalAccountId?: string;
  lastSyncAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export type HealthMetricType = "resting_hr" | "hrv" | "sleep_duration" | "vo2max" | "weight" | "body_fat" | "steps" | "training_load";

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

export const METRIC_DEFS: Record<HealthMetricType, { label: string; unit: string; min: number; max: number; step?: number }> = {
  resting_hr: { label: "ضربان استراحت", unit: "bpm", min: 25, max: 130 },
  hrv: { label: "HRV", unit: "ms", min: 5, max: 300 },
  sleep_duration: { label: "خواب", unit: "ساعت", min: 0, max: 16, step: 0.1 },
  vo2max: { label: "VO2max", unit: "ml/kg/min", min: 15, max: 95 },
  weight: { label: "وزن", unit: "kg", min: 30, max: 300, step: 0.1 },
  body_fat: { label: "درصد چربی", unit: "%", min: 2, max: 65, step: 0.1 },
  steps: { label: "قدم", unit: "قدم", min: 0, max: 100000 },
  training_load: { label: "بار تمرین", unit: "AU", min: 0, max: 3000 },
};

export const manualHealthInputSchema = z
  .object({
    measuredAt: z.string().min(8, "تاریخ را وارد کن"),
    values: z.record(z.string(), z.number()),
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

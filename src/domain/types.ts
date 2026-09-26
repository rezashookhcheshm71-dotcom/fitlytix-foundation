/**
 * FitLytix core domain model.
 * Independent identity layer — NOT coupled to any CMS user table.
 * TODO(backend): map these to Postgres tables when Lovable Cloud / Supabase is connected.
 */

export type SportId = "crossfit" | "hyrox" | "functional" | "bodybuilding" | "running";
export type ExperienceLevel = "beginner" | "intermediate" | "advanced" | "elite";
export type CoachingType = "ai" | "human" | "hybrid";
export type Gender = "male" | "female" | "other";

export interface Identity {
  id: string;
  firstName: string;
  lastName: string;
  mobile: string;
  mobileVerified: boolean;
  email: string;
  createdAt: string;
}

export interface AthleteProfile {
  id: string;
  identity: Identity;
  avatarUrl?: string;
  gender: Gender;
  birthYear: number;
  heightCm: number;
  weightKg: number;
  primarySport: SportId;
  experience: ExperienceLevel;
  trainingAgeYears: number;
  goals: Goal[];
  coachId?: string;
  coachingType: CoachingType;
}

export interface Goal {
  id: string;
  title: string;
  metric?: string;
  target?: string;
  deadline?: string;
  progress: number; // 0..1
}

export interface Sport {
  id: SportId;
  name: string; // English
  nameFa: string;
  tagline: string;
  colorToken: string; // css var name e.g. --sport-crossfit
  cssClass: string; // tailwind color class root e.g. sport-crossfit
  icon: string;
  assessmentSections: string[];
}

/* Assessment ---------------------------------------------------------- */

export type AssessmentFieldType =
  | "number"
  | "text"
  | "select"
  | "multiselect"
  | "scale"
  | "time"
  | "load"
  | "textarea";

export type AssessmentPurpose = "programming" | "level" | "scaling" | "load" | "goal" | "safety" | "recovery";
export type AssessmentDepth = "all" | "intermediatePlus" | "advancedPlus";

export interface AssessmentOption {
  value: string;
  label: string;
}

export interface AssessmentField {
  id: string;
  label: string;
  type: AssessmentFieldType;
  unit?: string;
  options?: AssessmentOption[];
  min?: number;
  max?: number;
  step?: number;
  depth?: AssessmentDepth;
  required?: boolean;
  allowUnknown?: boolean;
  purpose: AssessmentPurpose;
  hint?: string;
  help?: string;
  wide?: boolean;
}

export interface AssessmentSection {
  id: string;
  title: string;
  titleEn?: string;
  description: string;
  icon: string;
  blockToken?: WorkoutBlockType;
  fields: AssessmentField[];
}

export interface AssessmentTemplate {
  id: string;
  version: number;
  scope: "common" | SportId;
  sections: AssessmentSection[];
}

export type AssessmentAnswers = Record<string, string | number | string[] | undefined>;

export interface Assessment {
  id: string;
  athleteId: string;
  templateId: string;
  answers: AssessmentAnswers;
  completedAt?: string;
  status: "draft" | "submitted" | "analyzed";
}

/* Fitness DNA ---------------------------------------------------------- */

export type DnaDimensionId = string;

export interface DnaDimension {
  id: DnaDimensionId;
  label: string;
  labelEn: string;
  score: number; // 0..100
  percentile?: number;
  trend: number; // delta vs last cycle
  insight: string;
}

export interface FitnessDNA {
  athleteId: string;
  generatedAt: string;
  archetype: string;
  archetypeEn: string;
  summary: string;
  dimensions: DnaDimension[];
  limiters: string[];
  strengths: string[];
  source: "mock" | "engine";
}

/* Exercises / Skills / PRs / Benchmarks --------------------------------- */

export type MovementPattern =
  | "squat"
  | "hinge"
  | "push"
  | "pull"
  | "olympic"
  | "gymnastics"
  | "monostructural"
  | "core"
  | "carry";

export interface Exercise {
  id: string;
  name: string;
  nameFa?: string;
  shortDescription?: string;
  howToSteps?: string[];
  coachingCues?: string[];
  commonMistakes?: string[];
  breathingCue?: string;
  easierOption?: string;
  harderOption?: string;
  primaryMuscles?: string[];
  safetyNote?: string;
  media?: { imageUrl?: string; videoUrl?: string };
  pattern: MovementPattern;
  equipment: string[];
  sports: SportId[];
  scalingOptions: string[];
  difficulty: 1 | 2 | 3 | 4 | 5;
}

export type SkillStatus = "locked" | "learning" | "consistent" | "mastered";

export interface Skill {
  id: string;
  name: string;
  nameFa?: string;
  category: "gymnastics" | "weightlifting" | "engine" | "mobility";
  status: SkillStatus;
  progress: number; // 0..1
  nextMilestone?: string;
}

export interface PersonalRecord {
  id: string;
  exerciseId: string;
  exerciseName: string;
  value: number;
  unit: "kg" | "reps" | "sec" | "m";
  date: string;
  previous?: number;
}

export interface Benchmark {
  id: string;
  name: string;
  type: "for_time" | "amrap" | "max_load";
  result: string;
  date: string;
  rxOrScaled: "rx" | "scaled";
  delta?: string;
}

/* Programs & Workouts --------------------------------------------------- */

export type WorkoutBlockType =
  | "warmup"
  | "strength"
  | "engine"
  | "wod"
  | "skill"
  | "weightlifting"
  | "cooldown";

export interface WorkoutMovement {
  exerciseId?: string;
  exerciseName: string;
  scheme: string; // e.g. "5x5 @ 80%", "21-15-9"
  load?: string;
  scaling?: string;
  notes?: string;
}

export interface WorkoutBlock {
  id: string;
  type: WorkoutBlockType;
  title: string;
  titleEn: string;
  durationMin: number;
  format?: string;
  intent: string;
  movements: WorkoutMovement[];
  targetRpe?: number;
}

export interface Workout {
  id: string;
  programId: string;
  dayIndex: number;
  date: string;
  title: string;
  focus: string;
  blocks: WorkoutBlock[];
  estimatedMin: number;
  status: "planned" | "completed" | "skipped" | "today";
}

export interface Program {
  id: string;
  athleteId: string;
  name: string;
  sport: SportId;
  phase: string;
  weekIndex: number;
  totalWeeks: number;
  generatedBy: "ai" | "coach" | "hybrid";
  goal: string;
  workouts: Workout[];
  adherence: number; // 0..1
}

/* Results, Feedback, Recovery, Performance ----------------------------- */

export interface WorkoutResult {
  id: string;
  workoutId: string;
  date: string;
  title: string;
  score: string;
  rpe: number;
  durationMin: number;
  blocksCompleted: number;
  totalBlocks: number;
  prAchieved?: boolean;
}

export interface AthleteFeedback {
  workoutId: string;
  rpe: number;
  mood: 1 | 2 | 3 | 4 | 5;
  soreness: 1 | 2 | 3 | 4 | 5;
  notes?: string;
}

export interface RecoverySnapshot {
  date: string;
  readiness: number; // 0..100
  sleepHours: number;
  sleepQuality: number; // 0..100
  hrv: number;
  restingHr: number;
  soreness: number; // 0..100
  strain: number; // 0..21
  recommendation: string;
}

export interface PerformancePoint {
  week: string;
  performanceIndex: number;
  strength: number;
  engine: number;
  volume: number;
}

/* Commerce -------------------------------------------------------------- */

export interface Plan {
  id: string;
  name: string;
  coachingType: CoachingType;
  priceMonthly: number;
  currency: "IRR" | "USD";
  features: string[];
  highlight?: boolean;
  badge?: string;
}

export interface Subscription {
  id: string;
  athleteId: string;
  planId: string;
  status: "trial" | "active" | "past_due" | "cancelled";
  startedAt: string;
  renewsAt: string;
}

export interface Payment {
  id: string;
  subscriptionId: string;
  amount: number;
  currency: "IRR" | "USD";
  status: "pending" | "paid" | "failed" | "mock";
  createdAt: string;
}

/* Coach ------------------------------------------------------------------ */

export interface CoachProfile {
  id: string;
  identity: Identity;
  specialties: SportId[];
  bio: string;
  athleteIds: string[];
}

export interface CoachAthleteSummary {
  athlete: AthleteProfile;
  readiness: number;
  adherence: number;
  performanceIndex: number;
  trend: number;
  flag?: "attention" | "peak" | "recovering";
  lastSession: string;
  nextWorkout: string;
}

/**
 * Feature extraction: assessment answers → the exact numeric vector the model expects.
 *
 * Rules that keep this honest:
 *  - Unknown inputs fall back to the *training medians* shipped inside model.json,
 *    never to invented "ideal" values.
 *  - Every derived index is clamped to 0..1 so a typo can never explode a feature.
 *  - Availability flags (`*_available`) tell the model whether a value is measured
 *    or imputed, which is why missing data degrades gracefully instead of lying.
 *  - Persian labels of every consumed answer are returned for the "why" panel.
 */
import type { AssessmentAnswers, SportId } from "@/domain/types";
import type { GoalId } from "@/domain/recommendation";
import type {
  BodyCompositionInput,
  RecommendationBehaviorInput,
  RecommendationProfileInput,
} from "@/domain/recommendation";

export interface FeatureExtractionInput {
  sport: SportId;
  profile?: RecommendationProfileInput | undefined;
  answers?: AssessmentAnswers | undefined;
  bodyAnalysis?: BodyCompositionInput | undefined;
  behavior?: RecommendationBehaviorInput | undefined;
}

export interface FeatureExtractionResult {
  named: Record<string, number>;
  used: string[];
  missing: string[];
  goal: GoalId;
  experienceRankOf: number;
  sessionsAvailable: number;
  sessionMinutes: number;
  bodyFatAvailable: boolean;
  behaviorAvailable: boolean;
  strengthAvailable: boolean;
  engineAvailable: boolean;
  measurements: {
    strengthIndex: number;
    engineIndex: number;
    skillIndex: number;
    mobilityIndex: number;
  };
  flags: {
    painSeverity: number;
    painAreas: number;
    sleepHours: number;
    stress: number;
    readinessAvg: number | undefined;
    adherence28d: number | undefined;
    age: number;
    bmi: number;
    bodyFatPct: number | undefined;
  };
}

export const GOAL_BY_OPTION: GoalId[] = [
  "strength",
  "muscle",
  "fat_loss",
  "endurance",
  "competition",
  "health",
];

const EXPERIENCE_RANK_BY_OPTION = [0, 0.6, 1.3, 2.1, 3];
const SESSION_MINUTES_BY_OPTION = [37.5, 52.5, 67.5, 85];
const MILEAGE_BY_OPTION = [0, 7, 18, 35, 55];

function clamp01(v: number): number {
  return Math.min(0.99, Math.max(0.01, v));
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") {
    const normalized = value
      .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
      .replace(/[^\d.-]/g, "");
    if (!normalized) return undefined;
    const n = Number(normalized);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function asOptionIndex(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const match = /^option_(\d+)$/.exec(value);
  if (!match) return undefined;
  const index = Number(match[1]);
  return Number.isFinite(index) ? index : undefined;
}

function asOptionIndexes(value: unknown): number[] {
  if (!Array.isArray(value)) {
    const single = asOptionIndex(value);
    return single ? [single] : [];
  }
  return value.map(asOptionIndex).filter((v): v is number => typeof v === "number");
}

/** Accepts "4:32", "1:12:00" or a plain number of minutes. Returns seconds. */
function asTimeSeconds(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value * 60 : undefined;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parts = trimmed.split(":").map((p) => Number(p.replace(/[^\d.]/g, "")));
  if (parts.some((p) => !Number.isFinite(p))) return undefined;
  if (parts.length === 1) return (parts[0] ?? 0) * 60;
  if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
  if (parts.length === 3) return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
  return undefined;
}

/** Map a measured value onto 0..1 using an explicit "hopeless → elite" range. */
function scaleInto(value: number | undefined, worst: number, best: number): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  if (best === worst) return undefined;
  return clamp01((value - worst) / (best - worst));
}

function mean(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function ratioIndex(
  weight: number | undefined,
  bodyWeight: number,
  low: number,
  high: number,
): number | undefined {
  if (weight === undefined || weight <= 0 || bodyWeight <= 0) return undefined;
  return scaleInto(weight / bodyWeight, low, high);
}

const ANSWER_LABELS: Record<string, string> = {
  "common.profile.age": "سن",
  "common.profile.height_cm": "قد",
  "common.profile.weight_kg": "وزن",
  "common.profile.training_history": "سابقه تمرین منظم",
  "common.goals.primary": "هدف اصلی",
  "common.goals.secondary": "اهداف دوم",
  "common.schedule.sessions_per_week": "جلسات در هفته",
  "common.schedule.minutes_per_session": "مدت هر جلسه",
  "common.lifestyle.work_style": "سبک کار روزانه",
  "common.lifestyle.daily_activity": "فعالیت روزمره",
  "common.access.environment": "محیط تمرین",
  "common.access.equipment": "تجهیزات",
  "common.recovery.sleep_hours": "خواب شبانه",
  "common.recovery.quality": "کیفیت بیدار شدن",
  "common.recovery.stress": "سطح استرس",
  "common.safety.pain": "وضعیت درد/آسیب",
  "common.safety.areas": "ناحیه درد",
  "common.body.condition": "حس بدن",
};

function experienceFromAnswers(answers: AssessmentAnswers, sport: SportId): number | undefined {
  const common = asOptionIndex(answers["common.profile.training_history"]);
  if (common) return EXPERIENCE_RANK_BY_OPTION[common - 1];
  const sportKey: Partial<Record<SportId, string>> = {
    crossfit: "crossfit.history.duration",
    running: "running.base.history",
    bodybuilding: "bodybuilding.history.years",
    hyrox: "hyrox.race.experience",
  };
  const key = sportKey[sport];
  if (!key) return undefined;
  const index = asOptionIndex(answers[key]);
  if (!index) return undefined;
  return EXPERIENCE_RANK_BY_OPTION[Math.min(4, Math.max(0, index - 1))];
}

function goalFromAnswers(answers: AssessmentAnswers): GoalId | undefined {
  const common = asOptionIndex(answers["common.goals.primary"]);
  if (common) return GOAL_BY_OPTION[common - 1];
  return undefined;
}

function sportGoal(answers: AssessmentAnswers, sport: SportId): GoalId | undefined {
  const key: Partial<Record<SportId, string>> = {
    crossfit: "crossfit.level.goal",
    hyrox: "hyrox.race.goal",
    bodybuilding: "bodybuilding.goal.primary",
    functional: "functional.goal.primary",
    running: "running.goal.race",
  };
  const answerKey = key[sport];
  if (!answerKey) return undefined;
  const index = asOptionIndex(answers[answerKey]);
  if (!index) return undefined;

  if (sport === "crossfit") {
    return (["health", "strength", "endurance", "health", "strength", "competition"] as GoalId[])[
      index - 1
    ];
  }
  if (sport === "hyrox") {
    if (index === 3) return "strength";
    if (index === 4 || index === 2) return "endurance";
    if (index === 5) return "competition";
    return "health";
  }
  if (sport === "bodybuilding") {
    return (["muscle", "fat_loss", "muscle", "strength", "competition"] as GoalId[])[index - 1];
  }
  if (sport === "functional") {
    return (["health", "strength", "health", "endurance", "health"] as GoalId[])[index - 1];
  }
  if (index === 1) return "health";
  if (index === 6) return "endurance";
  return "endurance";
}

function equipmentScore(answers: AssessmentAnswers, sport: SportId): number | undefined {
  const common = asOptionIndexes(answers["common.access.equipment"]);
  const commonMap: Record<number, number> = { 1: 0.15, 2: 0.45, 3: 0.75, 4: 0.8, 5: 0.55, 6: 1 };
  if (common.length > 0) {
    return Math.max(...common.map((i) => commonMap[i] ?? 0.3));
  }
  if (sport === "bodybuilding") {
    const values = asOptionIndexes(answers["bodybuilding.equipment.access"]);
    const map: Record<number, number> = { 1: 0.35, 2: 0.75, 3: 0.7, 4: 0.8, 5: 0.65, 6: 1 };
    if (values.length > 0) return Math.max(...values.map((i) => map[i] ?? 0.3));
  }
  if (sport === "functional") {
    const values = asOptionIndexes(answers["functional.environment.access"]);
    const map: Record<number, number> = { 1: 0.1, 2: 0.3, 3: 0.5, 4: 0.55, 5: 0.8, 6: 1 };
    if (values.length > 0) return Math.max(...values.map((i) => map[i] ?? 0.3));
  }
  return undefined;
}

function strengthIndex(
  answers: AssessmentAnswers,
  sport: SportId,
  bodyWeight: number,
): number | undefined {
  const parts: (number | undefined)[] = [];

  if (sport === "crossfit") {
    parts.push(
      ratioIndex(asNumber(answers["crossfit.strength.back_squat_1rm"]), bodyWeight, 0.6, 2.0),
    );
    parts.push(
      ratioIndex(asNumber(answers["crossfit.strength.deadlift_1rm"]), bodyWeight, 0.8, 2.6),
    );
    parts.push(
      ratioIndex(asNumber(answers["crossfit.strength.strict_press_1rm"]), bodyWeight, 0.3, 1.1),
    );
    parts.push(
      ratioIndex(asNumber(answers["crossfit.weightlifting.clean_jerk_1rm"]), bodyWeight, 0.4, 1.7),
    );
    parts.push(
      ratioIndex(asNumber(answers["crossfit.weightlifting.snatch_1rm"]), bodyWeight, 0.3, 1.4),
    );
  } else if (sport === "bodybuilding") {
    parts.push(
      ratioIndex(asNumber(answers["bodybuilding.lifts.bench_press"]), bodyWeight, 0.4, 1.6),
    );
    parts.push(ratioIndex(asNumber(answers["bodybuilding.lifts.squat"]), bodyWeight, 0.6, 2.2));
    parts.push(ratioIndex(asNumber(answers["bodybuilding.lifts.rdl"]), bodyWeight, 0.6, 2.0));
  }

  return mean(parts.filter((v): v is number => typeof v === "number"));
}

function engineIndex(answers: AssessmentAnswers, sport: SportId): number | undefined {
  const parts: (number | undefined)[] = [];

  const row2k = asTimeSeconds(answers["crossfit.engine.row_2k"]);
  parts.push(scaleInto(row2k, 540, 390));
  const run5k = asTimeSeconds(answers["crossfit.engine.run_5k"]);
  parts.push(scaleInto(run5k, 1800, 1050));
  const bike = asNumber(answers["crossfit.engine.bike_10min"]);
  parts.push(scaleInto(bike, 80, 220));
  const fran = asTimeSeconds(answers["crossfit.benchmark.fran"]);
  parts.push(scaleInto(fran, 600, 150));

  if (sport === "running" || sport === "hyrox") {
    const easyPace = asTimeSeconds(
      answers[`${sport}.running.easy_pace`] ?? answers["running.pace.easy"],
    );
    parts.push(scaleInto(easyPace, 420, 235));
    const fiveK = asTimeSeconds(answers["running.records.5k"] ?? answers["hyrox.running.5k_time"]);
    parts.push(scaleInto(fiveK, 2100, 900));
    const tenK = asTimeSeconds(answers["running.records.10k"] ?? answers["hyrox.running.10k_time"]);
    parts.push(scaleInto(tenK, 4500, 1900));
    const half = asTimeSeconds(answers["running.records.half"]);
    parts.push(scaleInto(half, 10800, 4200));
    const oneK = asTimeSeconds(answers["hyrox.running.1k_time"]);
    parts.push(scaleInto(oneK, 420, 200));
  }
  if (sport === "hyrox") {
    const ski = asTimeSeconds(answers["hyrox.stations.ski_1k"]);
    parts.push(scaleInto(ski, 330, 195));
    const row = asTimeSeconds(answers["hyrox.stations.row_1k"]);
    parts.push(scaleInto(row, 300, 185));
    const wallBalls = asNumber(answers["hyrox.stations.wall_balls"]);
    parts.push(scaleInto(wallBalls, 5, 60));
  }
  if (sport === "bodybuilding") {
    const cardio = asOptionIndex(answers["bodybuilding.cardio.frequency"]);
    if (cardio) parts.push([0.15, 0.4, 0.6, 0.3][cardio - 1]);
  }
  if (sport === "functional") {
    const conditioning = asOptionIndex(answers["functional.conditioning.preference"]);
    if (conditioning === 2) parts.push(0.6);
    if (conditioning === 3) parts.push(0.45);
  }

  return mean(parts.filter((v): v is number => typeof v === "number"));
}

function skillIndex(answers: AssessmentAnswers, sport: SportId): number | undefined {
  const parts: (number | undefined)[] = [];

  if (sport === "crossfit") {
    const gymnastics = asOptionIndexes(answers["crossfit.skill.gymnastics"]);
    if (gymnastics.length > 0) parts.push(clamp01(gymnastics.length / 6));
    const advanced = asOptionIndexes(answers["crossfit.skill.advanced"]).filter((i) => i !== 5);
    if (advanced.length > 0) parts.push(clamp01(0.5 + advanced.length / 8));
    const pullups = asNumber(answers["crossfit.strength.strict_pullups"]);
    parts.push(scaleInto(pullups, 0, 20));
    const level = asOptionIndex(answers["crossfit.level.skill"]);
    if (level) parts.push([0.1, 0.3, 0.5, 0.75, 0.92][level - 1]);
  } else if (sport === "functional") {
    const coordination = asOptionIndex(answers["functional.coordination.experience"]);
    if (coordination) parts.push([0.15, 0.4, 0.68, 0.88][coordination - 1]);
    const core = asOptionIndex(answers["functional.strength.core"]);
    if (core) parts.push([0.15, 0.4, 0.65, 0.9][core - 1]);
  } else if (sport === "bodybuilding") {
    const confidence = asOptionIndex(answers["bodybuilding.training.exercise_confidence"]);
    if (confidence) parts.push([0.15, 0.4, 0.7, 0.9][confidence - 1]);
  } else if (sport === "hyrox") {
    const experience = asOptionIndex(answers["hyrox.race.experience"]);
    if (experience) parts.push([0.12, 0.35, 0.6, 0.85][experience - 1]);
  } else if (sport === "running") {
    const zones = asOptionIndex(answers["running.training.zones"]);
    if (zones) parts.push([0.2, 0.4, 0.7, 0.9][zones - 1]);
  }

  return mean(parts.filter((v): v is number => typeof v === "number"));
}

function mobilityIndex(answers: AssessmentAnswers, sport: SportId, experienceRank: number): number {
  const parts: (number | undefined)[] = [];
  const commonCondition = asOptionIndex(answers["common.body.condition"]);
  if (commonCondition === 1) parts.push(0.85);
  if (commonCondition === 2) parts.push(0.6);
  if (commonCondition === 3) parts.push(0.35);
  if (commonCondition === 4) parts.push(0.25);

  if (sport === "functional") {
    const overhead = asOptionIndex(answers["functional.movement.overhead"]);
    if (overhead) parts.push([0.85, 0.55, 0.45, 0.2, 0.5][overhead - 1]);
    const squat = asOptionIndex(answers["functional.movement.squat"]);
    if (squat) parts.push([0.85, 0.5, 0.45, 0.25, 0.5][squat - 1]);
    const areas = asOptionIndexes(answers["functional.mobility.areas"]).filter((i) => i !== 6);
    parts.push(clamp01(0.85 - areas.length * 0.12));
    const balance = asOptionIndex(answers["functional.balance.single_leg"]);
    if (balance) parts.push([0.85, 0.55, 0.35, 0.5][balance - 1]);
  }

  const measured = mean(parts.filter((v): v is number => typeof v === "number"));
  if (measured !== undefined) return measured;
  return clamp01(0.72 - experienceRank * 0.06);
}

function weeklyMileage(answers: AssessmentAnswers, sport: SportId): number | undefined {
  if (sport === "running") {
    const index = asOptionIndex(answers["running.base.weekly_mileage"]);
    if (index) return MILEAGE_BY_OPTION[index - 1];
  }
  if (sport === "hyrox") {
    const index = asOptionIndex(answers["hyrox.running.weekly_distance"]);
    if (index) return MILEAGE_BY_OPTION[index - 1];
    return asNumber(answers["hyrox.running.longest_recent"]);
  }
  return undefined;
}

function painAreas(answers: AssessmentAnswers): number {
  const areas = asOptionIndexes(answers["common.safety.areas"]).filter((i) => i <= 6);
  return areas.length;
}

/**
 * Build the model feature vector.
 * `fillValues` comes from the artefact so imputation can never drift from training.
 */
export function extractFeatures(
  input: FeatureExtractionInput,
  fillValues: Record<string, number>,
): FeatureExtractionResult {
  const answers = input.answers ?? {};
  const profile = input.profile ?? {};
  const behavior = input.behavior ?? {};
  const body = input.bodyAnalysis ?? {};
  const named: Record<string, number> = { ...fillValues };
  const used: string[] = [];
  const missing: string[] = [];
  const mark = (label: string) => {
    if (!used.includes(label)) used.push(label);
  };

  // ---- identity & anthropometrics ---------------------------------------
  const age =
    asNumber(profile.age) ?? asNumber(answers["common.profile.age"]) ?? fillValues["age"] ?? 32;
  if (asNumber(profile.age) !== undefined || asNumber(answers["common.profile.age"]) !== undefined)
    mark("سن");
  else missing.push("سن");

  const heightCm =
    asNumber(profile.heightCm) ??
    asNumber(body.heightCm) ??
    asNumber(answers["common.profile.height_cm"]) ??
    fillValues["height_cm"] ??
    175;
  const weightKg =
    asNumber(body.weightKg) ??
    asNumber(profile.weightKg) ??
    asNumber(answers["common.profile.weight_kg"]) ??
    fillValues["weight_kg"] ??
    76;
  const bmi = heightCm > 0 ? weightKg / (heightCm / 100) ** 2 : (fillValues["bmi"] ?? 24.8);

  const gender = profile.gender;
  const sexMale =
    gender === "male"
      ? 1
      : gender === "female" || gender === "other"
        ? 0
        : (fillValues["sex_male"] ?? 0.5);

  const experienceAnswer = experienceFromAnswers(answers, input.sport);
  const explicitExperience =
    profile.experience === "beginner"
      ? 0
      : profile.experience === "intermediate"
        ? 1
        : profile.experience === "advanced"
          ? 2
          : profile.experience === "elite"
            ? 3
            : undefined;
  const experienceRank =
    explicitExperience ?? experienceAnswer ?? fillValues["experience_rank"] ?? 1;
  if (explicitExperience !== undefined) mark("سطح تجربه");
  else if (experienceAnswer !== undefined) mark("سابقه تمرین");

  const sessionsAvailable =
    asNumber(profile.sessionsPerWeek) ??
    asNumber(answers["common.schedule.sessions_per_week"]) ??
    asNumber(answers[`${input.sport}.schedule.sessions`]) ??
    asNumber(answers["bodybuilding.schedule.sessions"]) ??
    fillValues["sessions_available"] ??
    3;

  const minutesOption = asOptionIndex(answers["common.schedule.minutes_per_session"]);
  const sessionMinutes =
    asNumber(profile.minutesPerSession) ??
    (minutesOption ? SESSION_MINUTES_BY_OPTION[minutesOption - 1] : undefined) ??
    fillValues["session_minutes"] ??
    60;

  // ---- goal --------------------------------------------------------------
  const goal =
    profile.primaryGoal ?? goalFromAnswers(answers) ?? sportGoal(answers, input.sport) ?? "health";
  mark("هدف");

  // ---- training context --------------------------------------------------
  const workStyle = asOptionIndex(answers["common.lifestyle.work_style"]);
  const activity = asOptionIndex(answers["common.lifestyle.daily_activity"]);
  const environment = asOptionIndex(answers["common.access.environment"]);
  const equipment = equipmentScore(answers, input.sport);
  const sleepHours =
    asNumber(answers["common.recovery.sleep_hours"]) ?? fillValues["sleep_hours"] ?? 7;
  const sleepQuality =
    asNumber(answers["common.recovery.quality"]) ?? fillValues["sleep_quality"] ?? 3;
  const stress = asNumber(answers["common.recovery.stress"]) ?? fillValues["stress"] ?? 3;
  const painOption = asOptionIndex(answers["common.safety.pain"]);
  const painFromAreas = painAreas(answers) > 0 ? 1 : 0;
  const painSeverity = painOption
    ? ([0, 1, 1.6, 3][painOption - 1] ?? 0)
    : painFromAreas > 0
      ? Math.min(3, painFromAreas)
      : (fillValues["pain_severity"] ?? 0);

  const secondary = asOptionIndexes(answers["common.goals.secondary"]);
  const wantsMobility = secondary.includes(1) ? 1 : 0;
  const wantsRecovery = secondary.includes(2) ? 1 : 0;
  const wantsConsistency = secondary.includes(3) ? 1 : 0;
  const wantsSkill = secondary.includes(4) ? 1 : 0;

  // ---- measured capacities ----------------------------------------------
  const strengthIdx = strengthIndex(answers, input.sport, weightKg);
  const engineIdx = engineIndex(answers, input.sport);
  const skillIdx = skillIndex(answers, input.sport);
  const mobilityIdx = mobilityIndex(answers, input.sport, experienceRank);
  const mileage = weeklyMileage(answers, input.sport);

  const bodyFatPct = asNumber(body.bodyFatPct);
  const bodyFatAvailable = bodyFatPct !== undefined;

  // ---- behaviour ---------------------------------------------------------
  const planned = asNumber(behavior.plannedSessions);
  const completed = asNumber(behavior.completedSessions);
  const derivedAdherence =
    planned !== undefined && planned > 0 && completed !== undefined
      ? Math.min(1, Math.max(0, completed / planned))
      : undefined;
  // Training adherence is always derived from the training log; nutrition adherence
  // stays a separate signal and is never reused as a proxy for it.
  const adherenceValue = derivedAdherence;
  const behaviorAvailable = adherenceValue !== undefined || completed !== undefined;

  const avgRpe = asNumber(behavior.avgRpe) ?? 0;
  const previousRpe = asNumber(behavior.previousAvgRpe);
  const rpeTrend =
    avgRpe > 0 && previousRpe !== undefined ? Math.max(-2, Math.min(2, avgRpe - previousRpe)) : 0;
  const feedbackCompleteness =
    completed !== undefined && completed > 0 && asNumber(behavior.feedbackCount) !== undefined
      ? Math.min(1, (asNumber(behavior.feedbackCount) ?? 0) / completed)
      : 0;
  const readinessAvg = asNumber(behavior.readinessAvg);
  const nutritionAdherence = asNumber(behavior.nutritionAdherence);

  // ---- write features ----------------------------------------------------
  Object.assign(named, {
    experience_rank: experienceRank,
    training_age_years: Math.max(0, experienceRank * 2.1),
    age,
    sex_male: sexMale,
    height_cm: heightCm,
    weight_kg: weightKg,
    bmi,
    sessions_available: Math.min(7, Math.max(1, sessionsAvailable)),
    session_minutes: sessionMinutes,
    wants_mobility: wantsMobility,
    wants_recovery: wantsRecovery,
    wants_consistency: wantsConsistency,
    wants_skill: wantsSkill,
    equipment_score: equipment ?? fillValues["equipment_score"] ?? 0.5,
    environment_rank: environment ? environment - 1 : (fillValues["environment_rank"] ?? 2),
    activity_level: activity ? activity - 1 : (fillValues["activity_level"] ?? 1.5),
    work_style_rank: workStyle ? workStyle - 1 : (fillValues["work_style_rank"] ?? 1),
    sleep_hours: sleepHours,
    sleep_quality: sleepQuality,
    stress,
    pain_severity: painSeverity,
    pain_area_count: painAreas(answers),
    body_fat_pct: bodyFatPct ?? fillValues["body_fat_pct"] ?? 22,
    body_fat_available: bodyFatAvailable ? 1 : 0,
    strength_index: strengthIdx ?? fillValues["strength_index"] ?? 0.45,
    strength_available: strengthIdx !== undefined ? 1 : 0,
    engine_index: engineIdx ?? fillValues["engine_index"] ?? 0.45,
    engine_available: engineIdx !== undefined ? 1 : 0,
    skill_index: skillIdx ?? Math.min(0.95, 0.12 + experienceRank * 0.23),
    mobility_index: mobilityIdx,
    weekly_mileage: mileage ?? 0,
    adherence_28d: adherenceValue ?? fillValues["adherence_28d"] ?? 0.7,
    adherence_available: adherenceValue !== undefined ? 1 : 0,
    avg_rpe: avgRpe,
    rpe_trend: rpeTrend,
    missed_sessions_28d:
      asNumber(behavior.missedSessions) ??
      (planned !== undefined && completed !== undefined ? Math.max(0, planned - completed) : 0),
    sessions_completed_28d: completed ?? 0,
    feedback_completeness: feedbackCompleteness,
    readiness_avg: readinessAvg ?? 0,
    nutrition_adherence: nutritionAdherence ?? fillValues["nutrition_adherence"] ?? 0.65,
    nutrition_adherence_available: nutritionAdherence !== undefined ? 1 : 0,
    days_since_signup: asNumber(behavior.daysSinceSignup) ?? 0,
    prior_plan_months: asNumber(behavior.priorPlanMonths) ?? 0,
    prior_plan_count: asNumber(behavior.priorPlanCount) ?? 0,
    wearable_connected: behavior.wearableConnected ? 1 : 0,
  });

  for (const sport of ["crossfit", "hyrox", "functional", "bodybuilding", "running"] as const) {
    named[`sport_${sport}`] = input.sport === sport ? 1 : 0;
  }
  for (const goalId of [
    "strength",
    "muscle",
    "fat_loss",
    "endurance",
    "competition",
    "health",
  ] as const) {
    named[`goal_${goalId}`] = goal === goalId ? 1 : 0;
  }

  for (const [key, label] of Object.entries(ANSWER_LABELS)) {
    const belongsToSport =
      !key.includes(".") || key.startsWith(`common.`) || key.startsWith(`${input.sport}.`);
    const answered = answers[key] !== undefined && answers[key] !== "";
    if (belongsToSport && answered && !used.includes(label)) used.push(label);
  }

  const inputChecks: { present: boolean; label: string }[] = [
    {
      present: experienceAnswer !== undefined || explicitExperience !== undefined,
      label: "سطح تجربه",
    },
    { present: planned !== undefined || completed !== undefined, label: "رفتار تمرینی ۲۸ روز" },
    { present: bodyFatAvailable, label: "ترکیب بدن" },
    { present: strengthIdx !== undefined, label: "رکورد قدرت" },
    { present: engineIdx !== undefined, label: "رکورد هوازی" },
    { present: sleepHours !== (fillValues["sleep_hours"] ?? 7), label: "خواب" },
  ];
  for (const check of inputChecks) {
    if (!check.present && !missing.includes(check.label)) missing.push(check.label);
  }

  return {
    named,
    used,
    missing,
    goal,
    experienceRankOf: experienceRank,
    sessionsAvailable: Math.min(7, Math.max(1, sessionsAvailable)),
    sessionMinutes,
    bodyFatAvailable,
    behaviorAvailable,
    strengthAvailable: strengthIdx !== undefined,
    engineAvailable: engineIdx !== undefined,
    measurements: {
      strengthIndex: strengthIdx ?? fillValues["strength_index"] ?? 0.45,
      engineIndex: engineIdx ?? fillValues["engine_index"] ?? 0.45,
      skillIndex: skillIdx ?? Math.min(0.95, 0.12 + experienceRank * 0.23),
      mobilityIndex: mobilityIdx,
    },
    flags: {
      painSeverity,
      painAreas: painAreas(answers),
      sleepHours,
      stress,
      readinessAvg,
      adherence28d: adherenceValue,
      age,
      bmi,
      bodyFatPct,
    },
  };
}

/** Assemble the ordered vector from a named map, defaulting anything unexpected. */
export function toVector(named: Record<string, number>, features: string[]): number[] {
  return features.map((name) => {
    const value = named[name];
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  });
}

/**
 * Pure presentation mapping: model output → the objects the athlete UI already renders.
 *
 * Keeping this separate from both the engine and the routes means:
 *  - the program page consumes `Program` / `Workout` exactly like the demo data does,
 *  - the dashboard consumes a small, stable `PlanSummary`,
 *  - nothing here touches the database, the clock or the network, so it is safe in SSR
 *    and cannot drift between server and client renders.
 */
import type {
  CoachingType,
  NutritionStrategyId,
  PlanDurationMonths,
  PlanRecommendation,
  ProgramDayTemplate,
} from "@/domain/recommendation";
import { COACHING_LABEL, PACKAGE_NAME_FA, PLAN_DURATION_LABEL } from "@/domain/recommendation";
import type {
  PackageId,
  Program,
  SportId,
  Workout,
  WorkoutBlock,
  WorkoutBlockType,
  WorkoutMovement,
} from "@/domain/types";

const BLOCK_TITLES: Record<WorkoutBlockType, { title: string; titleEn: string; scheme: string }> = {
  warmup: { title: "گرم کردن", titleEn: "Warm-up", scheme: "۸–۱۰ دقیقه + حرکت‌های تحرک" },
  strength: { title: "قدرت", titleEn: "Strength", scheme: "۴×۵ @ RPE ۷" },
  weightlifting: { title: "وزنه‌برداری", titleEn: "Weightlifting", scheme: "۵×۲ @ ۷۵٪" },
  skill: { title: "مهارت", titleEn: "Skill", scheme: "۵×۳ با تمرکز روی کیفیت" },
  engine: { title: "موتور هوازی", titleEn: "Engine", scheme: "۳×۶ دقیقه @ Zone 2" },
  wod: { title: "WOD", titleEn: "WOD", scheme: "AMRAP ۱۲ دقیقه" },
  cooldown: { title: "سرد کردن", titleEn: "Cooldown", scheme: "۵ دقیقه تنفس و کشش" },
};

export interface PlanSummarySafety {
  code: string;
  labelFa: string;
  actionFa: string;
  severity: "info" | "caution" | "review_required";
}

export interface PlanSummary {
  sport: SportId;
  archetypeId: string;
  archetypeLabelFa: string;
  archetypeSummaryFa: string;
  sessionsPerWeek: number;
  sessionMinutes: number;
  weeks: number;
  durationMonths: PlanDurationMonths;
  durationLabelFa: string;
  durationRationaleFa: string;
  nutritionStrategyId: NutritionStrategyId;
  nutritionLabelFa: string;
  nutritionSummaryFa: string;
  energyIntentFa: string;
  coachingMode: CoachingType;
  coachingLabelFa: string;
  packageId: PackageId;
  packageNameFa: string;
  safetyLevel: "none" | "caution" | "review_required";
  safetyFlags: PlanSummarySafety[];
  adherence30d: number;
  adherenceCycle: number;
  dataCompleteness: number;
  confidence: "low" | "medium" | "high";
  deloadWeekIndexes: number[];
  progressionNotes: string[];
  focusTags: string[];
  model: PlanRecommendation["model"];
  generatedAt: string;
  inputs: PlanRecommendation["inputs"];
  explanations: PlanRecommendation["explanations"];
}

export function buildPlanSummary(recommendation: PlanRecommendation): PlanSummary {
  return {
    sport: recommendation.sport,
    archetypeId: recommendation.program.archetypeId,
    archetypeLabelFa: recommendation.program.labelFa,
    archetypeSummaryFa: recommendation.program.summaryFa,
    sessionsPerWeek: recommendation.program.sessionsPerWeek,
    sessionMinutes: recommendation.program.sessionMinutes,
    weeks: recommendation.program.weeks,
    durationMonths: recommendation.duration.months,
    durationLabelFa:
      PLAN_DURATION_LABEL[recommendation.duration.months] ?? recommendation.duration.labelFa,
    durationRationaleFa: recommendation.duration.rationaleFa,
    nutritionStrategyId: recommendation.nutrition.strategyId,
    nutritionLabelFa: recommendation.nutrition.labelFa,
    nutritionSummaryFa: recommendation.nutrition.summaryFa,
    energyIntentFa: recommendation.nutrition.energyIntentFa,
    coachingMode: recommendation.coaching.mode,
    coachingLabelFa:
      COACHING_LABEL[recommendation.coaching.mode] ?? recommendation.coaching.labelFa,
    packageId: recommendation.package.id,
    packageNameFa: PACKAGE_NAME_FA[recommendation.package.id] ?? recommendation.package.nameFa,
    safetyLevel: recommendation.safety.level,
    safetyFlags: recommendation.safety.flags.map((flag) => ({
      code: flag.code,
      labelFa: flag.labelFa,
      actionFa: flag.actionFa,
      severity: flag.severity,
    })),
    adherence30d: recommendation.expectations.adherence30d,
    adherenceCycle: recommendation.expectations.adherenceCycle,
    dataCompleteness: recommendation.expectations.dataCompleteness,
    confidence: recommendation.expectations.confidence,
    deloadWeekIndexes: recommendation.program.deloadWeekIndexes,
    progressionNotes: recommendation.program.progressionNotes,
    focusTags: recommendation.program.focusTags,
    model: recommendation.model,
    generatedAt: recommendation.generatedAt,
    inputs: recommendation.inputs,
    explanations: recommendation.explanations,
  };
}

const GENERIC_WARMUP: WorkoutMovement[] = [
  { exerciseName: "دویدن سبک یا روئینگ", scheme: "۵ دقیقه @ Zone 1" },
  { exerciseName: "تحرک مفاصل و فعال‌سازی", scheme: "۳–۴ دقیقه" },
];

const GENERIC_COOLDOWN: WorkoutMovement[] = [
  { exerciseName: "کشش ایستا و تنفس دیافراگمی", scheme: "۵–۸ دقیقه" },
];

function mainMovementsFor(day: ProgramDayTemplate): WorkoutMovement[] {
  const scheme = "۴×۵ @ RPE ۷";
  return day.mainMovements.slice(0, 3).map((name) => ({ exerciseName: name, scheme }));
}

function movementsFor(
  day: ProgramDayTemplate,
  block: WorkoutBlockType,
  index: number,
): WorkoutMovement[] {
  if (block === "warmup") return GENERIC_WARMUP;
  if (block === "cooldown") return GENERIC_COOLDOWN;

  const main = mainMovementsFor(day);
  if (main.length === 0) {
    return [{ exerciseName: day.titleFa, scheme: BLOCK_TITLES[block].scheme }];
  }
  // Spread the day's main lifts across the working blocks so they don't repeat.
  const perBlock = Math.max(1, Math.ceil(main.length / Math.max(1, day.blocks.length - 2)));
  const start = Math.max(0, (index - 1) * perBlock) % main.length;
  return Array.from({ length: perBlock }, (_, offset) => main[(start + offset) % main.length]!).map(
    (movement) => ({
      exerciseName: movement.exerciseName,
      scheme: BLOCK_TITLES[block].scheme,
    }),
  );
}

function blocksForDay(
  day: ProgramDayTemplate,
  sessionMinutes: number,
  archetypeId: string,
): WorkoutBlock[] {
  const types =
    day.blocks.length > 0 ? day.blocks : (["warmup", "strength", "cooldown"] as WorkoutBlockType[]);
  const warmupMinutes = Math.min(12, Math.max(6, Math.round(sessionMinutes * 0.15)));
  const cooldownMinutes = 8;
  const workingTypes = types.filter((type) => type !== "warmup" && type !== "cooldown");
  const workingBudget = Math.max(
    workingTypes.length * 8,
    sessionMinutes - warmupMinutes - cooldownMinutes,
  );

  return types.map((type, index) => {
    const meta = BLOCK_TITLES[type];
    const duration =
      type === "warmup"
        ? warmupMinutes
        : type === "cooldown"
          ? cooldownMinutes
          : Math.round(workingBudget / Math.max(1, workingTypes.length));
    return {
      id: `${archetypeId}_d${day.index}_b${index}`,
      type,
      title: meta.title,
      titleEn: meta.titleEn,
      durationMin: duration,
      intent: day.focusFa,
      movements: movementsFor(day, type, index),
    } satisfies WorkoutBlock;
  });
}

export interface BuiltProgram {
  program: Program;
  workout: Workout;
}

/**
 * Turns a stored recommendation into the `Program`/`Workout` objects the athlete pages
 * render, so the UI shows the *model's* plan instead of demo content.
 */
export function buildProgramFromRecommendation(args: {
  recommendation: PlanRecommendation;
  athleteId: string;
}): BuiltProgram {
  const { recommendation, athleteId } = args;
  const programId = `rec_${recommendation.program.archetypeId}`;
  const generatedBy: Program["generatedBy"] =
    recommendation.coaching.mode === "ai"
      ? "ai"
      : recommendation.coaching.mode === "human"
        ? "coach"
        : "hybrid";

  const workouts: Workout[] = recommendation.program.days.map((day, index) => ({
    id: `${programId}_w${day.index}`,
    programId,
    dayIndex: day.index,
    date: index === 0 ? "امروز" : `+${index} روز`,
    title: day.titleFa,
    focus: day.focusFa,
    blocks: blocksForDay(
      day,
      recommendation.program.sessionMinutes,
      recommendation.program.archetypeId,
    ),
    estimatedMin: recommendation.program.sessionMinutes,
    status: index === 0 ? "today" : "planned",
  }));

  const program: Program = {
    id: programId,
    athleteId,
    name: recommendation.program.labelFa,
    sport: recommendation.sport,
    phase: recommendation.program.focusTags[0] ?? "پایه",
    weekIndex: 1,
    totalWeeks: recommendation.program.weeks,
    generatedBy,
    goal: recommendation.package.nameFa,
    workouts,
    adherence: recommendation.expectations.adherence30d,
  };

  const workout: Workout = workouts[0] ?? {
    id: `${programId}_w1`,
    programId,
    dayIndex: 1,
    date: "امروز",
    title: recommendation.program.labelFa,
    focus: recommendation.program.summaryFa,
    blocks: [],
    estimatedMin: recommendation.program.sessionMinutes,
    status: "today",
  };

  return { program, workout };
}

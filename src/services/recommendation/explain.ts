/**
 * Explanation layer: "why did the model pick this plan?"
 *
 * Two honest signals, no fake SHAP:
 *  1. Dependency-free ablation: replace one feature with its training median and
 *     measure how much the chosen class probability moves. That is a real,
 *     reproducible local sensitivity for this model.
 *  2. Named inputs harvested during extraction, so the panel lists what was
 *     actually measured rather than what the model imputed.
 */
import type { JsonEnsembleModel } from "./ensemble";
import { classify } from "./ensemble";
import type { RecommendationExplanation } from "@/domain/recommendation";

interface FeatureDescription {
  labelFa: string;
  valueFa: (value: number) => string;
}

const BOOL = (v: number) => (v >= 0.5 ? "دارد" : "ندارد");
const EXPERIENCE = ["مبتدی", "در حال یادگیری", "متوسط", "پیشرفته"];

function experienceLabel(rank: number): string {
  if (rank < 0.5) return EXPERIENCE[0] ?? "مبتدی";
  if (rank < 1.5) return EXPERIENCE[1] ?? "در حال یادگیری";
  if (rank < 2.5) return EXPERIENCE[2] ?? "متوسط";
  return EXPERIENCE[3] ?? "پیشرفته";
}

const DESCRIPTIONS: Record<string, FeatureDescription> = {
  experience_rank: { labelFa: "سابقه تمرین", valueFa: (v) => experienceLabel(v) },
  training_age_years: { labelFa: "سال‌های تمرین", valueFa: (v) => `${v.toFixed(1)} سال` },
  age: { labelFa: "سن", valueFa: (v) => `${Math.round(v)} سال` },
  sessions_available: {
    labelFa: "جلسات در دسترس",
    valueFa: (v) => `${Math.round(v)} جلسه در هفته`,
  },
  session_minutes: { labelFa: "زمان هر جلسه", valueFa: (v) => `${Math.round(v)} دقیقه` },
  sleep_hours: { labelFa: "خواب شبانه", valueFa: (v) => `${v.toFixed(1)} ساعت` },
  sleep_quality: { labelFa: "کیفیت خواب", valueFa: (v) => `${Math.round(v)} از ۵` },
  stress: { labelFa: "استرس روزانه", valueFa: (v) => `${Math.round(v)} از ۵` },
  pain_severity: {
    labelFa: "درد / محدودیت",
    valueFa: (v) => (v >= 2 ? "نیاز به توجه" : v > 0 ? "خفیف" : "بدون درد فعال"),
  },
  body_fat_pct: { labelFa: "درصد چربی", valueFa: (v) => `${v.toFixed(1)}٪` },
  bmi: { labelFa: "شاخص توده بدنی", valueFa: (v) => v.toFixed(1) },
  adherence_28d: { labelFa: "پایبندی ۲۸ روز", valueFa: (v) => `${Math.round(v * 100)}٪` },
  missed_sessions_28d: { labelFa: "جلسات از دست‌رفته", valueFa: (v) => `${Math.round(v)} جلسه` },
  avg_rpe: { labelFa: "RPE میانگین", valueFa: (v) => v.toFixed(1) },
  readiness_avg: { labelFa: "آمادگی میانگین", valueFa: (v) => `${Math.round(v)} از ۱۰۰` },
  nutrition_adherence: { labelFa: "پایبندی تغذیه", valueFa: (v) => `${Math.round(v * 100)}٪` },
  strength_index: { labelFa: "قدرت نسبی", valueFa: (v) => `${Math.round(v * 100)} از ۱۰۰` },
  engine_index: { labelFa: "موتور هوازی", valueFa: (v) => `${Math.round(v * 100)} از ۱۰۰` },
  skill_index: { labelFa: "سطح مهارت", valueFa: (v) => `${Math.round(v * 100)} از ۱۰۰` },
  mobility_index: { labelFa: "موبیلیتی", valueFa: (v) => `${Math.round(v * 100)} از ۱۰۰` },
  weekly_mileage: { labelFa: "مسافت هفتگی", valueFa: (v) => `${Math.round(v)} کیلومتر` },
  equipment_score: { labelFa: "دسترسی به تجهیزات", valueFa: (v) => `${Math.round(v * 100)}٪` },
  prior_plan_count: { labelFa: "دوره‌های قبلی", valueFa: (v) => `${Math.round(v)} دوره` },
  days_since_signup: { labelFa: "مدت عضویت", valueFa: (v) => `${Math.round(v)} روز` },
  wearable_connected: { labelFa: "ساعت هوشمند متصل", valueFa: BOOL },
  adherence_available: { labelFa: "سابقه رفتاری", valueFa: BOOL },
  goal_strength: { labelFa: "هدف قدرت", valueFa: BOOL },
  goal_muscle: { labelFa: "هدف عضله‌سازی", valueFa: BOOL },
  goal_fat_loss: { labelFa: "هدف کاهش چربی", valueFa: BOOL },
  goal_endurance: { labelFa: "هدف استقامت", valueFa: BOOL },
  goal_competition: { labelFa: "هدف مسابقه", valueFa: BOOL },
  goal_health: { labelFa: "هدف سلامت", valueFa: BOOL },
  wants_consistency: { labelFa: "هدف ثبات در تمرین", valueFa: BOOL },
  wants_skill: { labelFa: "هدف یادگیری مهارت", valueFa: BOOL },
  wants_mobility: { labelFa: "هدف حرکت بهتر", valueFa: BOOL },
  wants_recovery: { labelFa: "هدف ریکاوری بهتر", valueFa: BOOL },
};

export interface ExplanationArgs {
  model: JsonEnsembleModel;
  /** Ordered feature names from the artefact. */
  features: string[];
  vector: number[];
  named: Record<string, number>;
  fillValues: Record<string, number>;
  targetClass: string;
  topK?: number;
}

/** Ablation-based local attribution for the chosen class of a classifier. */
export function explainDecision(args: ExplanationArgs): RecommendationExplanation[] {
  const { model, features, vector, named, fillValues, targetClass } = args;
  const targetIndex = model.classes.indexOf(targetClass);
  if (targetIndex < 0) return [];
  const baseline = classify(model, vector).probabilities[targetIndex] ?? 0;

  const importances = model.featureImportance ?? [];
  const candidates = importances
    .map((importance, index) => ({ index, importance }))
    .filter(({ index }) => {
      const name = features[index];
      if (!name) return false;
      const actual = named[name];
      const fill = fillValues[name];
      if (actual === undefined) return false;
      // Only explain inputs that differ from the imputed median: those are real signals.
      return Math.abs(actual - (fill ?? 0)) > 1e-9;
    })
    .sort((a, b) => b.importance - a.importance)
    .slice(0, Math.max(1, args.topK ?? 12));

  const explanations: RecommendationExplanation[] = [];
  for (const { index } of candidates) {
    const name = features[index];
    if (!name) continue;
    const fill = fillValues[name] ?? 0;
    const probe = vector.slice();
    probe[index] = fill;
    const without = classify(model, probe).probabilities[targetIndex] ?? 0;
    const delta = baseline - without;
    if (Math.abs(delta) < 0.002) continue;

    const description = DESCRIPTIONS[name];
    const value = named[name] ?? 0;
    explanations.push({
      feature: name,
      labelFa: description?.labelFa ?? name,
      valueFa: description ? description.valueFa(value) : String(Math.round(value * 100) / 100),
      direction: delta > 0 ? "supports" : "against",
      weight: Math.round(Math.abs(delta) * 1000) / 1000,
      textFa:
        delta > 0
          ? "این ورودی انتخاب فعلی را تقویت می‌کند."
          : "این ورودی علیه انتخاب فعلی است و بقیه شواهد آن را جبران کرده‌اند.",
    });
  }

  return explanations.sort((a, b) => b.weight - a.weight).slice(0, args.topK ?? 6);
}

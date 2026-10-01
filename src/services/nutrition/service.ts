/**
 * Nutrition service — independent from training, combinable via package + day type.
 * Produces meal *structure and ideas* only; no calorie prescriptions or medical advice.
 * TODO(backend): persist nutrition_profiles / nutrition_plans / nutrition_feedback.
 */
import type { DayType, Meal, NutritionFeedback, NutritionPlan, NutritionProfile } from "@/domain/types";

const profiles = new Map<string, NutritionProfile>([
  ["ath_001", { athleteId: "ath_001", goal: "performance", mealsPerDay: 4, restrictions: [], allergies: ["بادام‌زمینی"], likes: ["مرغ", "برنج", "ماست"], dislikes: ["قارچ"], hydrationTargetL: 3 }],
]);
const feedback: NutritionFeedback[] = [
  { athleteId: "ath_001", date: "2026-09-26", adherence: 0.8, hunger: 3, energy: 4 },
  { athleteId: "ath_001", date: "2026-09-27", adherence: 0.7, hunger: 4, energy: 3 },
  { athleteId: "ath_001", date: "2026-09-28", adherence: 0.9, hunger: 3, energy: 4 },
];

const MEALS: Record<DayType, Meal[]> = {
  hard: [
    { id: "m1", title: "صبحانه", timing: "۲–۳ ساعت قبل تمرین", idea: "نان یا جو دوسر + تخم‌مرغ + میوه", focus: "carb" },
    { id: "m2", title: "قبل تمرین", timing: "۴۵–۶۰ دقیقه قبل", idea: "موز یا خرما با کمی ماست", focus: "light" },
    { id: "m3", title: "بعد تمرین", timing: "تا ۲ ساعت بعد", idea: "برنج یا سیب‌زمینی + مرغ یا ماهی + سبزی", focus: "protein" },
    { id: "m4", title: "شام", timing: "عصر", idea: "پروتئین + سالاد + منبع کربوهیدرات متوسط", focus: "balanced" },
  ],
  training: [
    { id: "m1", title: "صبحانه", timing: "صبح", idea: "تخم‌مرغ + نان سبوس‌دار + پنیر", focus: "balanced" },
    { id: "m2", title: "ناهار", timing: "ظهر", idea: "پروتئین + برنج + سبزی", focus: "balanced" },
    { id: "m3", title: "بعد تمرین", timing: "تا ۲ ساعت بعد", idea: "ماست یونانی + میوه یا ساندویچ مرغ", focus: "protein" },
    { id: "m4", title: "شام", timing: "عصر", idea: "ماهی یا عدس + سبزیجات", focus: "balanced" },
  ],
  rest: [
    { id: "m1", title: "صبحانه", timing: "صبح", idea: "املت سبزیجات + نان", focus: "protein" },
    { id: "m2", title: "ناهار", timing: "ظهر", idea: "خوراک حبوبات یا مرغ + سالاد بزرگ", focus: "balanced" },
    { id: "m3", title: "شام", timing: "عصر", idea: "پروتئین سبک + سبزیجات", focus: "light" },
  ],
};

export const nutritionService = {
  getProfile(athleteId: string) {
    return profiles.get(athleteId);
  },
  /** dayType comes from the training calendar in combined mode; nutrition-only defaults to "training". */
  getDailyPlan(athleteId: string, dayType: DayType): NutritionPlan {
    const p = profiles.get(athleteId);
    const meals = MEALS[dayType].filter((m) => !(p?.dislikes ?? []).some((d) => m.idea.includes(d)));
    return {
      id: `np_${athleteId}_${dayType}`,
      athleteId,
      dayType,
      meals: meals.slice(0, Math.max(3, p?.mealsPerDay ?? 4)),
      hydrationL: (p?.hydrationTargetL ?? 2.5) + (dayType === "hard" ? 0.5 : 0),
      notes: [
        dayType === "hard" ? "روز سنگین است؛ کربوهیدرات اطراف تمرین کمک می‌کند انرژی جلسه حفظ شود." : dayType === "rest" ? "روز استراحت؛ پروتئین را حفظ کن و حجم کربوهیدرات را کمی پایین‌تر بیاور." : "روز تمرین معمولی؛ وعده بعد تمرین را جا نینداز.",
        ...(p?.allergies.length ? [`حساسیت ثبت‌شده: ${p.allergies.join("، ")}`] : []),
      ],
      ownedBy: "coach",
      source: "mock",
    };
  },
  feedback(athleteId: string) {
    return feedback.filter((f) => f.athleteId === athleteId);
  },
  addFeedback(f: NutritionFeedback) {
    feedback.push(f);
  },
  adherence(athleteId: string) {
    const list = this.feedback(athleteId);
    return list.length ? list.reduce((a, f) => a + f.adherence, 0) / list.length : undefined;
  },
};

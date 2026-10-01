/**
 * Goals + athlete journey service. Demo goals per sport; journey stage derived from milestones.
 * TODO(backend): persist goals / milestones tables.
 */
import { JOURNEY_STAGES, type GoalPlan, type JourneyStage, type SportId } from "@/domain/types";

const GOALS: Record<SportId, GoalPlan[]> = {
  crossfit: [
    { id: "g_cf_1", athleteId: "ath_001", type: "performance", title: "Snatch ۹۰ کیلو", target: "90 kg", current: "82 kg", deadline: "1405/03", progress: 0.72, weeklyFocus: "دو جلسه تکنیک Snatch با ۷۰–۷۸٪", status: "on_track", milestones: [{ id: "m1", title: "ارزیابی اولیه", done: true, date: "1404/07" }, { id: "m2", title: "Snatch 85", done: true, date: "1404/09" }, { id: "m3", title: "Snatch 88", done: false }, { id: "m4", title: "Snatch 90", done: false }] },
    { id: "g_cf_2", athleteId: "ath_001", type: "race", title: "Fran زیر ۴ دقیقه", target: "3:59", current: "4:12", progress: 0.55, weeklyFocus: "Thruster سبک با تکرارهای پیوسته", status: "at_risk", milestones: [{ id: "m1", title: "Fran پایه 4:40", done: true }, { id: "m2", title: "Fran 4:12", done: true }, { id: "m3", title: "Fran 3:59", done: false }] },
  ],
  bodybuilding: [{ id: "g_bb_1", athleteId: "ath_001", type: "body", title: "۴ کیلو عضله در ۶ ماه", target: "+4 kg SMM", current: "+1.6 kg", progress: 0.4, weeklyFocus: "حجم سینه و پشت را ۲ ست اضافه کن", status: "on_track", milestones: [{ id: "m1", title: "آنالیز بدن پایه", done: true }, { id: "m2", title: "+1.5 kg", done: true }, { id: "m3", title: "+3 kg", done: false }, { id: "m4", title: "+4 kg", done: false }] }],
  hyrox: [{ id: "g_hy_1", athleteId: "ath_001", type: "race", title: "HYROX زیر ۸۰ دقیقه", target: "79:59", current: "86:30", progress: 0.5, weeklyFocus: "Compromised running بعد از Sled", status: "on_track", milestones: [{ id: "m1", title: "شبیه‌سازی نیمه", done: true }, { id: "m2", title: "شبیه‌سازی کامل", done: false }, { id: "m3", title: "مسابقه", done: false }] }],
  functional: [{ id: "g_fn_1", athleteId: "ath_001", type: "health", title: "اسکوات عمیق بدون درد", target: "Deep squat 3×10", current: "Box squat", progress: 0.6, weeklyFocus: "تحرک مچ پا و لگن هر روز ۱۰ دقیقه", status: "on_track", milestones: [{ id: "m1", title: "ارزیابی حرکت", done: true }, { id: "m2", title: "Goblet squat 12 kg", done: true }, { id: "m3", title: "Deep squat", done: false }] }],
  running: [{ id: "g_run_1", athleteId: "ath_001", type: "race", title: "۱۰K زیر ۵۰ دقیقه", target: "49:59", current: "53:20", progress: 0.45, weeklyFocus: "یک جلسه tempo و یک long run آرام", status: "on_track", milestones: [{ id: "m1", title: "5K پایه", done: true }, { id: "m2", title: "10K 53:20", done: true }, { id: "m3", title: "10K 51:00", done: false }, { id: "m4", title: "10K 49:59", done: false }] }],
};

export const goalsService = {
  list(athleteId: string, sport: SportId): GoalPlan[] {
    return GOALS[sport].map((g) => ({ ...g, athleteId }));
  },
  primary(athleteId: string, sport: SportId) {
    return this.list(athleteId, sport)[0];
  },
  journeyStage(goal?: GoalPlan): JourneyStage {
    if (!goal) return "assessment";
    const idx = Math.min(JOURNEY_STAGES.length - 1, 1 + Math.floor(goal.progress * (JOURNEY_STAGES.length - 2)));
    return JOURNEY_STAGES[idx]!.id;
  },
};

/**
 * Goals + athlete journey service. Demo goals per sport; journey stage derived from milestones.
 * TODO(backend): persist goals / milestones tables.
 */
import { JOURNEY_STAGES, type GoalPlan, type JourneyStage, type SportId } from "@/domain/types";

/**
 * Sample goals. Every one is marked athleteId: "demo" rather than carrying a fake
 * athlete's id, following database/migrations/README.md: mark demo data as demo
 * instead of inventing a person to own it. Reachable only via goalsService.demoList.
 */
const DEMO_GOALS: Record<SportId, GoalPlan[]> = {
  crossfit: [
    {
      id: "g_cf_1",
      athleteId: "demo",
      type: "performance",
      title: "Snatch ۹۰ کیلو",
      target: "90 kg",
      current: "82 kg",
      deadline: "1405/03",
      progress: 0.72,
      weeklyFocus: "دو جلسه تکنیک Snatch با ۷۰–۷۸٪",
      status: "on_track",
      milestones: [
        { id: "m1", title: "ارزیابی اولیه", done: true, date: "1404/07" },
        { id: "m2", title: "Snatch 85", done: true, date: "1404/09" },
        { id: "m3", title: "Snatch 88", done: false },
        { id: "m4", title: "Snatch 90", done: false },
      ],
    },
    {
      id: "g_cf_2",
      athleteId: "demo",
      type: "race",
      title: "Fran زیر ۴ دقیقه",
      target: "3:59",
      current: "4:12",
      progress: 0.55,
      weeklyFocus: "Thruster سبک با تکرارهای پیوسته",
      status: "at_risk",
      milestones: [
        { id: "m1", title: "Fran پایه 4:40", done: true },
        { id: "m2", title: "Fran 4:12", done: true },
        { id: "m3", title: "Fran 3:59", done: false },
      ],
    },
  ],
  bodybuilding: [
    {
      id: "g_bb_1",
      athleteId: "demo",
      type: "body",
      title: "۴ کیلو عضله در ۶ ماه",
      target: "+4 kg SMM",
      current: "+1.6 kg",
      progress: 0.4,
      weeklyFocus: "حجم سینه و پشت را ۲ ست اضافه کن",
      status: "on_track",
      milestones: [
        { id: "m1", title: "آنالیز بدن پایه", done: true },
        { id: "m2", title: "+1.5 kg", done: true },
        { id: "m3", title: "+3 kg", done: false },
        { id: "m4", title: "+4 kg", done: false },
      ],
    },
  ],
  hyrox: [
    {
      id: "g_hy_1",
      athleteId: "demo",
      type: "race",
      title: "HYROX زیر ۸۰ دقیقه",
      target: "79:59",
      current: "86:30",
      progress: 0.5,
      weeklyFocus: "Compromised running بعد از Sled",
      status: "on_track",
      milestones: [
        { id: "m1", title: "شبیه‌سازی نیمه", done: true },
        { id: "m2", title: "شبیه‌سازی کامل", done: false },
        { id: "m3", title: "مسابقه", done: false },
      ],
    },
  ],
  functional: [
    {
      id: "g_fn_1",
      athleteId: "demo",
      type: "health",
      title: "اسکوات عمیق بدون درد",
      target: "Deep squat 3×10",
      current: "Box squat",
      progress: 0.6,
      weeklyFocus: "تحرک مچ پا و لگن هر روز ۱۰ دقیقه",
      status: "on_track",
      milestones: [
        { id: "m1", title: "ارزیابی حرکت", done: true },
        { id: "m2", title: "Goblet squat 12 kg", done: true },
        { id: "m3", title: "Deep squat", done: false },
      ],
    },
  ],
  running: [
    {
      id: "g_run_1",
      athleteId: "demo",
      type: "race",
      title: "۱۰K زیر ۵۰ دقیقه",
      target: "49:59",
      current: "53:20",
      progress: 0.45,
      weeklyFocus: "یک جلسه tempo و یک long run آرام",
      status: "on_track",
      milestones: [
        { id: "m1", title: "5K پایه", done: true },
        { id: "m2", title: "10K 53:20", done: true },
        { id: "m3", title: "10K 51:00", done: false },
        { id: "m4", title: "10K 49:59", done: false },
      ],
    },
  ],
};

export const goalsService = {
  /**
   * Goals belonging to an athlete. There is no goals table yet (see the TODO at the
   * top), so nobody has any, and everybody gets an empty list.
   *
   * This used to return the demo goals with the CALLER'S id stamped over
   * "ath_001", which attributed one sample person's targets - Snatch at 90 kg, Fran
   * under four minutes, 72 percent progress, a deadline of 1405/03 - to whoever
   * asked. Handing someone a fabricated goal is worse than telling them they have
   * none: an empty list is visibly empty, whereas a plausible goal reads as
   * theirs. Both decision-engine consumers already guard on a missing goal, so
   * nothing downstream breaks.
   */
  list(athleteId: string, sport: SportId): GoalPlan[] {
    void athleteId;
    void sport;
    return [];
  },
  /** Undefined when the athlete has no goal. Callers must handle it. */
  primary(athleteId: string, sport: SportId): GoalPlan | undefined {
    return this.list(athleteId, sport)[0];
  },
  /**
   * Sample goals, available only to code that asks for them by this name. Kept so
   * the copy and the milestone shapes remain reviewable, but no longer reachable
   * through list(), which is what let them pass as real.
   */
  demoList(sport: SportId): GoalPlan[] {
    return DEMO_GOALS[sport];
  },
  journeyStage(goal?: GoalPlan): JourneyStage {
    if (!goal) return "assessment";
    const idx = Math.min(
      JOURNEY_STAGES.length - 1,
      1 + Math.floor(goal.progress * (JOURNEY_STAGES.length - 2)),
    );
    return JOURNEY_STAGES[idx]!.id;
  },
};

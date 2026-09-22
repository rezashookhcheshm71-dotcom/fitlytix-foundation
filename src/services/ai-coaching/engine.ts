/**
 * AI Coaching Engine — domain/service boundary.
 *
 * Pipeline: Assessment -> Profile -> Fitness DNA -> Goal -> Sport -> Experience
 *           -> Performance History -> AI Coaching Engine -> Personalized Program
 *
 * This module is intentionally NOT a chat surface. It exposes typed operations
 * that the UI consumes. The current implementation returns mock data.
 *
 * TODO(backend): replace with a server function (createServerFn) that calls the
 * real inference service and persists programs to Postgres.
 */
import type { AthleteProfile, FitnessDNA, PerformancePoint, Program, RecoverySnapshot } from "@/domain/types";
import { demoProgram } from "@/mock/program";
import { demoDNA } from "@/mock/athlete";

export interface CoachingContext {
  profile: AthleteProfile;
  dna: FitnessDNA;
  history: PerformancePoint[];
  recovery: RecoverySnapshot;
}

export interface ProgramAdjustment {
  reason: string;
  change: string;
  impact: "volume" | "intensity" | "skill" | "recovery";
  source: "mock";
}

export const AI_ENGINE_LABEL = "AI Coaching Engine · نسخه نمایشی";

export const aiCoachingEngine = {
  async generateProgram(_ctx: CoachingContext): Promise<Program> {
    return demoProgram;
  },
  async deriveFitnessDNA(_profile: AthleteProfile): Promise<FitnessDNA> {
    return { ...demoDNA, source: "mock" };
  },
  async suggestAdjustments(ctx: CoachingContext): Promise<ProgramAdjustment[]> {
    const items: ProgramAdjustment[] = [];
    if (ctx.recovery.readiness < 60) {
      items.push({ reason: "آمادگی پایین", change: "کاهش ۲۰٪ حجم وزنه‌برداری", impact: "volume", source: "mock" });
    } else {
      items.push({ reason: "آمادگی ۷۸٪ و روند مثبت موتور", change: "حفظ شدت اسکوات، +۱ راند در بلوک موتور", impact: "intensity", source: "mock" });
    }
    const gym = ctx.dna.dimensions.find((d) => d.id === "gymnastics");
    if (gym && gym.score < 60) {
      items.push({ reason: "ژیمناستیک محدودکننده اصلی", change: "افزودن EMOM مهارت حلقه ۲×هفته", impact: "skill", source: "mock" });
    }
    return items;
  },
  /** Today's focus sentence for the dashboard. */
  todaysFocus(ctx: CoachingContext): string {
    return `آمادگی ${ctx.recovery.readiness}٪ — امروز روی کیفیت اسکوات و پیس یکنواخت در بلوک موتور تمرکز کن.`;
  },
};

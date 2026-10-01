/**
 * Decision engine — the central, deterministic (demo) recommendation boundary.
 * Every recommendation carries a human-readable `why` and the inputs it used. No medical claims.
 * TODO(engine): move to a server function; replace rules with real models behind the same contract.
 */
import type { DecisionContext, DecisionInputKey, DecisionRecommendation, PackageId, SportId } from "@/domain/types";
import { athleteDashboardService } from "@/services/athlete/dashboard";
import { goalsService } from "@/services/goals/service";
import { healthDataService } from "@/services/health-data/service";
import { nutritionService } from "@/services/nutrition/service";
import { recoveryService } from "@/services/recovery/service";
import { subscriptionService } from "@/services/subscriptions/service";

export const decisionEngine = {
  context(athleteId: string, sport: SportId, pkg?: PackageId): DecisionContext {
    const p = subscriptionService.getPackage(athleteId, pkg);
    const available: DecisionInputKey[] = ["athlete", "dna", "goal", "recovery"];
    if (p.includes.training) available.push("training");
    if (p.includes.nutrition && nutritionService.getProfile(athleteId)) available.push("nutrition");
    if (healthDataService.listMetrics(athleteId).length) available.push("health");
    if (nutritionService.feedback(athleteId).length) available.push("feedback");
    return { athleteId, sport, packageId: p.id, readiness: recoveryService.assess(athleteId, sport), goal: goalsService.primary(athleteId, sport), availableInputs: available };
  },

  recommend(ctx: DecisionContext): DecisionRecommendation[] {
    const snap = athleteDashboardService.getSnapshot(ctx.athleteId, ctx.sport);
    const pkg = subscriptionService.getPackage(ctx.athleteId, ctx.packageId);
    const r = ctx.readiness;
    const out: DecisionRecommendation[] = [];
    const controlled = r.level !== "ready";

    if (pkg.includes.training) {
      out.push({ id: "today", kind: "today_focus", title: "امروز", text: controlled ? `${snap.workout.title} — با شدت کنترل‌شده (حدود RPE 6–7).` : snap.focus, why: r.why, inputs: ["training", "recovery", ...(ctx.availableInputs.includes("health") ? (["health"] as const) : [])], confidence: "medium" });
      out.push({ id: "adjust", kind: "training_adjustment", title: "چه چیزی تغییر کرده؟", text: controlled ? "حجم بخش اصلی حدود ۲۰٪ کمتر شده و ست‌های سنگین آخر حذف شده‌اند." : "برنامه طبق روال است؛ تغییری لازم نبوده.", why: controlled ? "حجم تمرین‌های اخیرت بالا بوده و نشانه‌های ریکاوری کمی پایین‌تر از معمول است." : "نشانه‌های ریکاوری در محدوده معمول خودت است.", inputs: ["training", "recovery"], confidence: "medium" });
    }
    if (pkg.includes.nutrition) {
      const dayType = controlled ? "training" : "hard";
      out.push({ id: "nutrition", kind: "nutrition_context", title: "تغذیه امروز", text: dayType === "hard" ? "روز سنگین است؛ کربوهیدرات اطراف تمرین را جدی بگیر." : "روز تمرین معمولی؛ وعده بعد تمرین را جا نینداز.", why: pkg.includes.training ? "بر اساس نوع جلسه امروز در برنامه تمرینی‌ات." : "بر اساس هدف و ترجیحات تغذیه‌ای ثبت‌شده.", inputs: pkg.includes.training ? ["nutrition", "training"] : ["nutrition", "goal"], confidence: "low" });
    }
    out.push({ id: "recovery", kind: "recovery_focus", title: "ریکاوری", text: r.level === "recovery_needed" ? "امشب خواب را در اولویت بگذار و فردا فقط تحرک سبک." : "۱۰ دقیقه کول‌داون و خواب کافی کافی است.", why: r.why, inputs: ["recovery"], confidence: "medium" });
    if (ctx.goal) out.push({ id: "next", kind: "next_week", title: "قدم بعدی", text: ctx.goal.weeklyFocus, why: `هدف «${ctx.goal.title}» — الان ${ctx.goal.current} از ${ctx.goal.target}.`, inputs: ["goal", "dna"], confidence: "medium" });
    if (ctx.goal?.status === "at_risk") out.push({ id: "attn", kind: "attention", title: "نیاز به توجه", text: `روند «${ctx.goal.title}» کندتر از برنامه است؛ با مربی بررسی کن.`, why: "پیشرفت فعلی نسبت به زمان باقی‌مانده عقب‌تر است.", inputs: ["goal"], confidence: "low" });
    return out;
  },
};

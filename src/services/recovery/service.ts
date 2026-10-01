/**
 * Recovery / readiness service — deterministic demo rules, not a clinical model.
 * Combines the sport snapshot with any health metrics and exposes every factor behind the result.
 * TODO(engine): replace rules with a validated server-side model; keep the ReadinessAssessment contract.
 */
import type { ReadinessAssessment, ReadinessFactor, ReadinessLevel, SportId } from "@/domain/types";
import { athleteDashboardService } from "@/services/athlete/dashboard";
import { healthDataService } from "@/services/health-data/service";

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);

export const recoveryService = {
  assess(athleteId: string, sport: SportId, baseScore?: number): ReadinessAssessment {
    const snapshot = athleteDashboardService.getSnapshot(athleteId, sport);
    let score = baseScore ?? snapshot.recovery.readiness;
    const factors: ReadinessFactor[] = [];

    const hrv = healthDataService.listMetrics(athleteId, "hrv").map((m) => m.value);
    const sleep = healthDataService.listMetrics(athleteId, "sleep_duration").map((m) => m.value);
    const load = healthDataService.listMetrics(athleteId, "training_load").map((m) => m.value);

    if (hrv.length >= 3) {
      const last = hrv.at(-1)!;
      const base = avg(hrv.slice(0, -1))!;
      const effect = last >= base ? "positive" : last < base * 0.9 ? "negative" : "neutral";
      if (effect === "negative") score -= 6;
      factors.push({ key: "hrv", label: "HRV نسبت به میانگین هفته", value: `${last} / ${Math.round(base)} ms`, effect, source: "manual" });
    }
    if (sleep.length) {
      const last = sleep.at(-1)!;
      const effect = last >= 7 ? "positive" : last < 6.5 ? "negative" : "neutral";
      if (effect === "negative") score -= 5;
      factors.push({ key: "sleep", label: "خواب دیشب", value: `${last} ساعت`, effect, source: "manual" });
    } else {
      factors.push({ key: "sleep", label: "خواب", value: snapshot.recovery.sleep, effect: "neutral", source: "snapshot" });
    }
    if (load.length >= 3) {
      const recent = load.slice(-3).reduce((a, b) => a + b, 0);
      const effect = recent > 1500 ? "negative" : "neutral";
      if (effect === "negative") score -= 5;
      factors.push({ key: "training_load", label: "بار تمرین ۳ روز اخیر", value: `${recent} AU`, effect, source: "manual" });
    }
    factors.push({ key: "performance", label: "وضعیت ثبت‌شده", value: snapshot.recovery.label, effect: "neutral", source: "snapshot" });

    score = Math.max(0, Math.min(100, Math.round(score)));
    const level: ReadinessLevel = score >= 72 ? "ready" : score >= 55 ? "moderate" : "recovery_needed";
    const negatives = factors.filter((f) => f.effect === "negative").map((f) => f.label);
    const why = negatives.length
      ? `بر اساس ${negatives.join("، ")}، امروز شدت کنترل‌شده پیشنهاد شده.`
      : "خواب و نشانه‌های ریکاوری ثبت‌شده در محدوده معمول خودت است؛ برای جلسه برنامه‌ریزی‌شده آماده‌ای.";
    return { athleteId, date: new Date().toISOString().slice(0, 10), score, level, factors, why, source: "mock" };
  },
};

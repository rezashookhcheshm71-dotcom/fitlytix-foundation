/**
 * Athlete Coaching Context — the single input contract for future Workout Programming
 * and Nutrition Planning engines. It only gathers and reports data availability;
 * it does NOT generate training/nutrition plans and makes no medical claims.
 * TODO(backend): assemble server-side from persisted assessment, body analysis, recovery and performance rows.
 */
import type { AssessmentAnswers, SportId } from "@/domain/types";
import type { BodyAnalysisRecord } from "@/domain/body-analysis";
import { bodyAnalysisService, type MetricDelta } from "@/services/body-analysis/service";
import { athleteDashboardService } from "@/services/athlete/dashboard";

export type CoachingInputKey = "goal" | "sport" | "availability" | "assessment" | "latestBody" | "bodyTrend" | "recovery" | "performance";

export interface CoachingInputStatus {
  key: CoachingInputKey;
  label: string;
  available: boolean;
  usedBy: Array<"programming" | "nutrition">;
}

export interface AthleteCoachingContext {
  athleteId: string;
  sport: SportId;
  goal?: string;
  availability?: { sessionsPerWeek?: string | number; sessionMinutes?: string | number };
  assessmentAnswers: AssessmentAnswers;
  latestBodyAnalysis?: BodyAnalysisRecord;
  bodyTrend: MetricDelta[];
  recovery: { readiness: number; label: string };
  performanceMetrics: Array<{ label: string; value: string }>;
  inputs: CoachingInputStatus[];
  missing: CoachingInputKey[];
  source: "mock";
}

export const coachingContextService = {
  build(athleteId: string, sport: SportId, answers: AssessmentAnswers = {}): AthleteCoachingContext {
    const snapshot = athleteDashboardService.getSnapshot(athleteId, sport);
    const records = bodyAnalysisService.list(athleteId);
    const latest = records.at(-1);
    const goal = typeof answers.primary_goal === "string" ? answers.primary_goal : snapshot.program.name;
    const availability = { sessionsPerWeek: answers.sessions_per_week as string | undefined, sessionMinutes: answers.session_length as string | undefined };
    const inputs: CoachingInputStatus[] = [
      { key: "goal", label: "هدف", available: Boolean(goal), usedBy: ["programming", "nutrition"] },
      { key: "sport", label: "رشته", available: true, usedBy: ["programming", "nutrition"] },
      { key: "availability", label: "زمان تمرین", available: Boolean(availability.sessionsPerWeek), usedBy: ["programming"] },
      { key: "assessment", label: "پاسخ‌های ارزیابی", available: Object.keys(answers).length > 0, usedBy: ["programming"] },
      { key: "latestBody", label: "آخرین آنالیز بدن", available: Boolean(latest), usedBy: ["programming", "nutrition"] },
      { key: "bodyTrend", label: "روند تغییرات بدن", available: records.length > 1, usedBy: ["nutrition"] },
      { key: "recovery", label: "ریکاوری", available: true, usedBy: ["programming", "nutrition"] },
      { key: "performance", label: "شاخص‌های عملکرد", available: snapshot.metrics.length > 0, usedBy: ["programming"] },
    ];
    return {
      athleteId,
      sport,
      goal,
      availability,
      assessmentAnswers: answers,
      latestBodyAnalysis: latest,
      bodyTrend: bodyAnalysisService.deltas(records),
      recovery: { readiness: snapshot.recovery.readiness, label: snapshot.recovery.label },
      performanceMetrics: snapshot.metrics.map((m) => ({ label: m.label, value: m.value })),
      inputs,
      missing: inputs.filter((i) => !i.available).map((i) => i.key),
      source: "mock",
    };
  },
};

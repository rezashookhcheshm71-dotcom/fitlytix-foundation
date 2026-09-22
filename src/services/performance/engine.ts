/**
 * Performance Engine — service boundary.
 * Loop: Workout -> Athlete Feedback -> Performance Data -> Recovery -> Analysis -> Program Adjustment
 * TODO(backend): read workout_results / recovery tables; compute indices server-side.
 */
import type { AthleteFeedback, PerformancePoint, RecoverySnapshot, WorkoutResult } from "@/domain/types";
import { demoPerformance, demoRecovery, demoSessions } from "@/mock/athlete";

export const performanceEngine = {
  async getTrend(_athleteId: string): Promise<PerformancePoint[]> {
    return demoPerformance;
  },
  async getRecovery(_athleteId: string): Promise<RecoverySnapshot> {
    return demoRecovery;
  },
  async getRecentSessions(_athleteId: string): Promise<WorkoutResult[]> {
    return demoSessions;
  },
  async logFeedback(_feedback: AthleteFeedback) {
    // TODO(backend): insert feedback; enqueue analysis job
    return { ok: true, mock: true };
  },
  performanceDelta(points: PerformancePoint[]) {
    if (points.length < 2) return 0;
    return points[points.length - 1]!.performanceIndex - points[0]!.performanceIndex;
  },
  readinessLabel(readiness: number) {
    if (readiness >= 75) return { label: "آماده", tone: "success" as const };
    if (readiness >= 55) return { label: "متوسط", tone: "warning" as const };
    return { label: "نیاز به ریکاوری", tone: "destructive" as const };
  },
};

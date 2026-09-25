/**
 * Fitness DNA engine boundary. Body composition is carried as a traceable, separate input —
 * it is NOT converted into radar scores yet. Dimensions still come from the sport snapshot (mock).
 * TODO(engine): derive dimensions from body composition + performance + recovery server-side.
 */
import type { SportId } from "@/domain/types";
import type { BodyAnalysisRecord } from "@/domain/body-analysis";
import { athleteDashboardService } from "@/services/athlete/dashboard";
import { bodyAnalysisService } from "@/services/body-analysis/service";

export interface DnaEngineInputs {
  bodyComposition: { recordIds: string[]; latest?: BodyAnalysisRecord | undefined };
  performanceMetrics: Array<{ label: string; value: string }>;
  recoveryReadiness: number;
}

export const fitnessDnaService = {
  inputs(athleteId: string, sport: SportId): DnaEngineInputs {
    const snapshot = athleteDashboardService.getSnapshot(athleteId, sport);
    const records = bodyAnalysisService.list(athleteId);
    return {
      bodyComposition: { recordIds: records.map((r) => r.id), latest: records.at(-1) },
      performanceMetrics: snapshot.metrics.map((m) => ({ label: m.label, value: m.value })),
      recoveryReadiness: snapshot.recovery.readiness,
    };
  },
  /** Current source of truth for the radar: the mock sport snapshot, unchanged. */
  dimensions(athleteId: string, sport: SportId) {
    return { dimensions: athleteDashboardService.getSnapshot(athleteId, sport).dna.dimensions, source: "mock" as const, inputs: this.inputs(athleteId, sport) };
  },
};

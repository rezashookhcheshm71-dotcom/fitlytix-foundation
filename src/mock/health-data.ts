/** MOCK DATA — demo manual health metrics (نسخه نمایشی). No provider data is real. */
import type { HealthMetric, HealthMetricType, HealthProviderConnection } from "@/domain/types";
import { METRIC_DEFS } from "@/domain/platform";

export const DEMO_CONNECTIONS: HealthProviderConnection[] = [
  { id: "hc_demo_garmin", athleteId: "ath_001", provider: "garmin", status: "ready_to_connect", scopes: [], createdAt: "2026-09-01T08:00:00Z", updatedAt: "2026-09-01T08:00:00Z" },
];

const days = ["2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28"];
const series: Partial<Record<HealthMetricType, number[]>> = {
  resting_hr: [54, 55, 53, 56, 58, 55, 54],
  hrv: [68, 64, 70, 61, 57, 63, 66],
  sleep_duration: [7.2, 6.8, 7.6, 6.4, 6.1, 7.0, 7.4],
  steps: [9200, 11800, 7600, 10400, 6900, 12500, 8800],
  training_load: [420, 610, 0, 540, 680, 300, 0],
};

export const DEMO_HEALTH_METRICS: HealthMetric[] = (Object.entries(series) as [HealthMetricType, number[]][]).flatMap(([metricType, vals]) =>
  vals.map((value, i) => ({
    id: `hm_demo_${metricType}_${i}`,
    athleteId: "ath_001",
    source: "manual" as const,
    metricType,
    value,
    unit: METRIC_DEFS[metricType].unit,
    metadata: { demo: true },
    startTime: `${days[i]}T07:00:00Z`,
    createdAt: `${days[i]}T07:05:00Z`,
  })),
);

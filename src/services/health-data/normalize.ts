/**
 * Normalization layer: maps provider-specific metric names/units into canonical HealthMetric rows.
 * Phase 2 connectors (mobile bridge or cloud OAuth, server-side) call `normalizeSample` before writing health_metrics.
 * No provider SDKs or network calls live here.
 */
import { METRIC_DEFS, type HealthMetric, type HealthMetricType, type HealthSource } from "@/domain/types";

/** Known provider field names → canonical type. Extend per connector; unknown names are dropped, never guessed. */
const ALIASES: Record<string, HealthMetricType> = {
  heart_rate: "heart_rate", heartrate: "heart_rate", hr: "heart_rate",
  resting_heart_rate: "resting_hr", restingheartrate: "resting_hr", resting_hr: "resting_hr", rhr: "resting_hr",
  hrv: "hrv", hrv_rmssd: "hrv", heartratevariabilitysdnn: "hrv", hrv_sdnn: "hrv",
  sleep_duration: "sleep_duration", sleepanalysis: "sleep_duration", total_sleep: "sleep_duration",
  sleep_score: "sleep_score", steps: "steps", stepcount: "steps",
  active_calories: "active_calories", activeenergyburned: "active_calories",
  workout: "workout", training_load: "training_load", strain: "training_load",
  vo2_max: "vo2max", vo2max: "vo2max", weight: "weight", bodymass: "weight",
  body_fat: "body_fat", bodyfatpercentage: "body_fat", respiratory_rate: "respiratory_rate",
  recovery: "recovery", recovery_score: "recovery", readiness: "readiness", readiness_score: "readiness", stress: "stress",
};

/** Unit conversions into the canonical unit of each metric. */
const CONVERT: Record<string, (v: number) => number> = {
  "sleep_duration:s": (v) => v / 3600,
  "sleep_duration:min": (v) => v / 60,
  "weight:lb": (v) => v * 0.45359237,
  "workout:s": (v) => v / 60,
  "body_fat:fraction": (v) => v * 100,
};

export interface RawHealthSample {
  name: string;
  value: number;
  unit?: string;
  startTime: string;
  endTime?: string;
  externalId?: string;
  deviceId?: string;
  raw?: unknown;
}

export function resolveMetricType(name: string): HealthMetricType | undefined {
  return ALIASES[name.toLowerCase().replace(/^hkquantitytypeidentifier/, "").replace(/[\s-]/g, "_")] ?? ALIASES[name.toLowerCase().replace(/[^a-z0-9]/g, "")];
}

/** Returns a canonical row, or null when the type is unknown or the value is out of plausible range. */
export function normalizeSample(athleteId: string, source: HealthSource, s: RawHealthSample, connectionId?: string): Omit<HealthMetric, "id" | "createdAt"> | null {
  const metricType = resolveMetricType(s.name);
  if (!metricType) return null;
  const def = METRIC_DEFS[metricType];
  const conv = s.unit ? CONVERT[`${metricType}:${s.unit}`] : undefined;
  const value = conv ? conv(s.value) : s.value;
  if (!Number.isFinite(value) || value < def.min || value > def.max) return null;
  return {
    athleteId, source, metricType, value, unit: def.unit, startTime: s.startTime,
    ...(connectionId ? { connectionId } : {}),
    ...(s.endTime ? { endTime: s.endTime } : {}),
    ...(s.externalId ? { externalId: s.externalId } : {}),
    ...(s.deviceId ? { deviceId: s.deviceId } : {}),
    ...(s.raw !== undefined ? { rawPayload: s.raw } : {}),
  };
}

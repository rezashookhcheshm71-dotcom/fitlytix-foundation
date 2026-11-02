/**
 * Trend rules (P35).
 *
 * FitLytix sells a trend view, and the demo data shows a tidy 7-day series. The
 * live database holds one row per metric at a single timestamp, so no series
 * exists yet. This module is the honest half of that gap: it computes a trend
 * only from the points that actually exist, and says so when they are too few.
 *
 * Three rules are load-bearing and deliberate:
 *
 * 1. ONE POINT IS NOT A TREND. Fewer than two usable points yields
 *    INSUFFICIENT_POINTS with a null direction and a null change. Inferring
 *    "stable" from a single measurement would be inventing a second point that
 *    nobody recorded.
 *
 * 2. NO INTERPOLATION, EVER. Gaps between measurements stay gaps. A missing day
 *    is not filled with a carried-forward value, a zero, or an average of its
 *    neighbours - each of those would manufacture data. `spanDays` reports the
 *    real distance between the first and last point so a sparse series cannot be
 *    mistaken for a dense one.
 *
 * 3. EXCLUSIONS ARE REPORTED, NOT SILENT. Points marked unusable (implausible per
 *    src/domain/plausibility.ts, P40) are removed from the trend AND listed in
 *    `excluded`, because a trend computed over a corrupt value would launder it
 *    into something that looks like evidence.
 *
 * These are pure functions over plain data so they can be tested without a
 * database, mirroring src/domain/roles.ts and src/domain/evidence.ts.
 */

/** One recorded measurement. `at` is an ISO-8601 timestamp. */
// Relative, matching the existing intra-domain convention (src/domain/types.ts
// re-exports "./platform"). A "@/domain/..." value import would not resolve in a
// plain Node test, and `judge` is a value, not a type.
import { judge, type PlausibilityMetric } from "./plausibility.ts";
import type { HealthMetricType } from "./platform";

export interface TrendPoint {
  value: number;
  at: string;
  /**
   * When false the point is excluded from the trend and reported in `excluded`.
   * Absent means usable - the common case for a plain reading from the database.
   */
  usable?: boolean;
  /** Why an unusable point was excluded, surfaced verbatim to the caller. */
  excludeReason?: string;
}

export type TrendDirection = "rising" | "falling" | "flat";

/**
 * A trend is ESTABLISHED only when at least two usable points exist.
 * INSUFFICIENT_POINTS is not an error - it is the truthful state of a metric that
 * has been measured once, which today describes every metric in the live database.
 */
export type TrendStatus = "ESTABLISHED" | "INSUFFICIENT_POINTS";

export interface ExcludedPoint {
  value: number;
  at: string;
  reason: string;
}

export interface Trend {
  status: TrendStatus;
  /** Usable points in chronological order - the basis of everything below. */
  points: TrendPoint[];
  first: TrendPoint | null;
  last: TrendPoint | null;
  /** last - first. Null when no trend is established. Never 0 as a stand-in. */
  change: number | null;
  /** Percentage change. Null when the first value is 0, which has no valid base. */
  changePct: number | null;
  direction: TrendDirection | null;
  /** Real distance between first and last point, so sparseness stays visible. */
  spanDays: number | null;
  /** Points removed before computing, with their reasons. */
  excluded: ExcludedPoint[];
}

const MS_PER_DAY = 86_400_000;

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Builds a trend from recorded points.
 *
 * Input order is not trusted: points are sorted by timestamp because direction
 * depends entirely on which measurement came first. A caller passing rows in
 * reverse would otherwise get an inverted trend.
 */
export function buildTrend(points: readonly TrendPoint[]): Trend {
  const usable = points
    .filter((point) => point.usable !== false)
    .slice()
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  const excluded: ExcludedPoint[] = points
    .filter((point) => point.usable === false)
    .map((point) => ({
      value: point.value,
      at: point.at,
      reason: point.excludeReason ?? "excluded",
    }));

  const empty: Trend = {
    status: "INSUFFICIENT_POINTS",
    points: usable,
    first: null,
    last: null,
    change: null,
    changePct: null,
    direction: null,
    spanDays: null,
    excluded,
  };

  const first = usable[0];
  const last = usable[usable.length - 1];
  if (first === undefined || last === undefined || usable.length < 2) {
    // Zero or one usable point. Report the single point if there is one, but make
    // no claim about direction - there is nothing to compare it against.
    return first === undefined || last === undefined
      ? empty
      : { ...empty, first, last, spanDays: 0 };
  }

  const change = last.value - first.value;
  const elapsedMs = Date.parse(last.at) - Date.parse(first.at);

  return {
    status: "ESTABLISHED",
    points: usable,
    first,
    last,
    change: round(change, 3),
    // A zero baseline has no meaningful percentage. Null, not Infinity and not 0.
    changePct: first.value === 0 ? null : round((change / first.value) * 100, 1),
    // Exact zero only. No "negligible change" band is invented here: choosing an
    // epsilon would be a threshold nobody established, and it would quietly turn a
    // real small movement into "flat".
    direction: change === 0 ? "flat" : change > 0 ? "rising" : "falling",
    spanDays: round(Math.abs(elapsedMs) / MS_PER_DAY, 2),
    excluded,
  };
}

/**
 * True when a trend has enough real evidence to be shown as a trend.
 *
 * Callers should render an honest empty state otherwise - stating that the metric
 * has been measured once and that a second measurement is what is missing - rather
 * than drawing a flat line, which reads as "no change" to the user.
 */
export function isTrendEstablished(trend: Trend): trend is Trend & {
  status: "ESTABLISHED";
  change: number;
  direction: TrendDirection;
} {
  return trend.status === "ESTABLISHED";
}

// ---------------------------------------------------------------------------
// From a health_metrics row to a trend point (P35 + P40)
// ---------------------------------------------------------------------------

/**
 * Maps the canonical metric types onto P40's plausibility vocabulary.
 *
 * The two vocabularies do not align by name: health_metrics stores snake_case
 * (`resting_hr`) while src/domain/plausibility.ts publishes camelCase
 * (`restingHeartRate`). An explicit bridge is safer than a string transform,
 * because a transform would silently invent a metric name that P40 has never
 * published an observation for.
 *
 * Metric types absent here have no plausibility rule at all, which is a truthful
 * NOT_ESTABLISHED rather than a pass - they are simply not judged.
 */
export const PLAUSIBILITY_METRIC_OF: Partial<Record<HealthMetricType, PlausibilityMetric>> = {
  steps: "steps",
  workout: "trainingTimeMinutes",
  vo2max: "vo2max",
  resting_hr: "restingHeartRate",
  sleep_duration: "sleepHours",
  body_fat: "bodyFatPct",
  hrv: "hrv",
  training_load: "trainingLoad",
};

/**
 * A row as it arrives from MySQL.
 *
 * `value` is typed loosely on purpose: the column is DECIMAL(12,3) and mysql2
 * returns DECIMAL as a STRING by default. Treating that as a number would
 * concatenate instead of subtract, producing a trend out of arithmetic that never
 * happened - so coercion is explicit and a non-finite result is marked unusable
 * rather than defaulted to 0.
 */
export interface HealthMetricRow {
  metric_type: string;
  value: number | string | null | undefined;
  start_time: string | Date | null;
  unit?: string | null;
}

/** Trend points grouped by metric type, each carrying its plausibility verdict. */
export function trendPointsFrom(rows: readonly HealthMetricRow[]): Record<string, TrendPoint[]> {
  const grouped: Record<string, TrendPoint[]> = {};

  for (const row of rows) {
    const metricType = row.metric_type;
    const bucket = grouped[metricType] ?? (grouped[metricType] = []);

    const numeric = toFiniteNumber(row.value);
    if (numeric === null) {
      bucket.push({
        value: Number.NaN,
        at: toIso(row.start_time),
        usable: false,
        excludeReason: `stored value is not a finite number (got ${JSON.stringify(row.value)})`,
      });
      continue;
    }

    const at = toIso(row.start_time);
    const plausibilityMetric = PLAUSIBILITY_METRIC_OF[metricType as HealthMetricType];
    if (plausibilityMetric === undefined) {
      // No published rule for this metric type. That is absence of a judgement,
      // not evidence of a good one - the point stays usable and unjudged.
      bucket.push({ value: numeric, at });
      continue;
    }

    const verdict = judge(plausibilityMetric, numeric);
    if (verdict.status === "implausible") {
      bucket.push({
        value: numeric,
        at,
        usable: false,
        excludeReason: verdict.code,
      });
    } else if (verdict.status === "unusable") {
      bucket.push({ value: numeric, at, usable: false, excludeReason: verdict.reason });
    } else {
      bucket.push({ value: numeric, at });
    }
  }

  return grouped;
}

/**
 * Coerces a stored value to a finite number, or returns null when it is absent.
 *
 * `Number(null)` and `Number("")` are both 0, which is finite - so a plain
 * coercion would turn a missing measurement into a real reading of zero and the
 * trend would compute against a value nobody recorded. Absence is not zero, in the
 * same way an unchosen sport is not "crossfit" (F2). Empty and whitespace-only
 * strings are treated as absent for the same reason.
 */
function toFiniteNumber(value: number | string | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Normalises a MySQL DATETIME (Date or string) to ISO-8601 for ordering. */
function toIso(value: string | Date | null): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.length > 0) {
    const parsed = Date.parse(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
    return Number.isNaN(parsed) ? value : new Date(parsed).toISOString();
  }
  return "";
}

/**
 * How many more measurements a metric needs before it can show a trend.
 *
 * Returned as a number so the empty state can say something specific ("one more
 * entry") instead of a vague "not enough data".
 */
export function pointsNeededForTrend(pointCount: number): number {
  return Math.max(0, 2 - pointCount);
}

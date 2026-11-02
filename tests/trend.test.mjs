/**
 * P35 trend tests.
 *
 * The demo shows a 7-day series; the live database holds one row per metric. These
 * tests pin the behaviour that makes the difference safe: a single measurement must
 * never be reported as a trend, gaps must never be filled, and excluded points must
 * be named rather than quietly dropped.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  PLAUSIBILITY_METRIC_OF,
  buildTrend,
  isTrendEstablished,
  pointsNeededForTrend,
  trendPointsFrom,
} from "../src/domain/trend.ts";
import { METRIC_DEFS } from "../src/domain/platform.ts";

const day = (n, value, extra = {}) => ({
  value,
  at: new Date(Date.UTC(2026, 10, n, 8, 0, 0)).toISOString(),
  ...extra,
});

// ---------------------------------------------------------------- rule 1

test("1. ONE point is not a trend: direction and change stay null", () => {
  const trend = buildTrend([day(1, 72.4)]);
  assert.equal(trend.status, "INSUFFICIENT_POINTS");
  assert.equal(trend.direction, null, "must not imply stable");
  assert.equal(trend.change, null, "must not report 0 as if measured");
  assert.equal(trend.changePct, null);
  // The single real point is still surfaced - it exists, it just proves nothing
  // about direction.
  assert.equal(trend.first?.value, 72.4);
  assert.equal(trend.last?.value, 72.4);
  assert.equal(trend.points.length, 1);
});

test("2. ZERO points: everything null, no invented placeholder", () => {
  const trend = buildTrend([]);
  assert.equal(trend.status, "INSUFFICIENT_POINTS");
  assert.equal(trend.first, null);
  assert.equal(trend.last, null);
  assert.equal(trend.change, null);
  assert.equal(trend.direction, null);
  assert.equal(trend.spanDays, null);
  assert.deepEqual(trend.excluded, []);
});

test("3. two unusable points are still not a trend", () => {
  const trend = buildTrend([
    day(1, 4, { usable: false, excludeReason: "SPEC_PUBLISHED_OBSERVATION" }),
    day(2, 4, { usable: false, excludeReason: "SPEC_PUBLISHED_OBSERVATION" }),
  ]);
  assert.equal(trend.status, "INSUFFICIENT_POINTS");
  assert.equal(trend.points.length, 0);
  assert.equal(trend.excluded.length, 2);
});

// ---------------------------------------------------------------- direction

test("4. two points rising", () => {
  const trend = buildTrend([day(1, 60), day(2, 64)]);
  assert.equal(trend.status, "ESTABLISHED");
  assert.equal(trend.direction, "rising");
  assert.equal(trend.change, 4);
  assert.equal(trend.changePct, 6.7); // (64-60)/60*100 = 6.666... -> 6.7
});

test("5. two points falling", () => {
  const trend = buildTrend([day(1, 78), day(2, 74)]);
  assert.equal(trend.direction, "falling");
  assert.equal(trend.change, -4);
  assert.equal(trend.changePct, -5.1); // -4/78*100 = -5.128... -> -5.1
});

test("6. flat means EXACTLY equal - no invented negligible-change band", () => {
  assert.equal(buildTrend([day(1, 70), day(2, 70)]).direction, "flat");
  assert.equal(buildTrend([day(1, 70), day(2, 70)]).change, 0);
  // A tiny real movement is NOT flattened away. No epsilon exists, so this is
  // rising - a deliberate consequence of refusing to invent a threshold.
  assert.equal(buildTrend([day(1, 70), day(2, 70.05)]).direction, "rising");
});

test("7. a zero baseline yields null changePct, not Infinity and not 0", () => {
  const trend = buildTrend([day(1, 0), day(2, 5000)]);
  assert.equal(trend.change, 5000);
  assert.equal(trend.direction, "rising");
  assert.equal(trend.changePct, null);
});

// ---------------------------------------------------------------- ordering

test("8. input order is not trusted: reversed rows still give the true direction", () => {
  // Direction depends entirely on which measurement came first. A caller passing
  // rows in reverse (or an unordered query result) must not invert the trend.
  const chronological = buildTrend([day(1, 60), day(5, 64)]);
  const reversed = buildTrend([day(5, 64), day(1, 60)]);
  assert.equal(chronological.direction, "rising");
  assert.equal(reversed.direction, "rising", "sorting must not depend on input order");
  assert.equal(reversed.first?.value, 60);
  assert.equal(reversed.last?.value, 64);
});

// ---------------------------------------------------------------- rule 2

test("9. no interpolation: a 6-day gap adds no points", () => {
  const trend = buildTrend([day(1, 70), day(7, 71)]);
  assert.equal(trend.points.length, 2, "gaps must not be filled with synthetic days");
  assert.equal(trend.spanDays, 6);
});

test("10. spanDays reports the real distance so sparseness stays visible", () => {
  // Two points 90 days apart are a trend, but a thin one. spanDays is what stops
  // it being drawn as if it were a dense weekly series.
  assert.equal(buildTrend([day(1, 70), day(10, 71)]).spanDays, 9);
  assert.equal(buildTrend([day(1, 70), day(2, 71)]).spanDays, 1);
});

// ---------------------------------------------------------------- rule 3

test("11. excluded points are removed AND reported with their reason", () => {
  const trend = buildTrend([
    day(1, 70),
    day(2, 4, { usable: false, excludeReason: "SPEC_PUBLISHED_OBSERVATION" }),
    day(3, 72),
  ]);
  assert.equal(trend.points.length, 2, "the corrupt point must not be in the series");
  assert.deepEqual(
    trend.points.map((p) => p.value),
    [70, 72],
  );
  assert.equal(trend.change, 2);
  assert.equal(trend.excluded.length, 1);
  assert.equal(trend.excluded[0]?.reason, "SPEC_PUBLISHED_OBSERVATION");
  assert.equal(trend.excluded[0]?.value, 4);
});

test("12. the laundering risk is the plotted series, not the direction", () => {
  // Found while writing this test: buildTrend compares FIRST to LAST, so an
  // implausible point in the middle does not flip the direction at all. The real
  // exposure is that the corrupt value stays in trend.points - which is exactly
  // what a chart draws. Exclusion has to happen, or a resting-HR of 4 gets
  // rendered as a genuine collapse between two normal readings.
  const withCorrupt = [day(1, 70), day(2, 4), day(3, 72)];
  const naive = buildTrend(withCorrupt);
  const guarded = buildTrend(
    withCorrupt.map((p) =>
      p.value === 4 ? { ...p, usable: false, excludeReason: "implausible" } : p,
    ),
  );

  // Direction is endpoint-based, so it reads the same either way.
  assert.equal(naive.direction, "rising");
  assert.equal(guarded.direction, "rising");
  assert.equal(naive.change, 2);

  // The difference is the series a chart would render: three points including the
  // corrupt one, versus two clean points.
  assert.deepEqual(
    naive.points.map((p) => p.value),
    [70, 4, 72],
  );
  assert.deepEqual(
    guarded.points.map((p) => p.value),
    [70, 72],
  );
  assert.equal(guarded.excluded.length, 1);
});

test("13. an exclusion with no reason still gets one", () => {
  const trend = buildTrend([day(1, 70), day(2, 99, { usable: false }), day(3, 72)]);
  assert.equal(trend.excluded[0]?.reason, "excluded");
});

// ---------------------------------------------------------------- helpers

test("14. isTrendEstablished narrows to a usable trend", () => {
  const one = buildTrend([day(1, 70)]);
  const two = buildTrend([day(1, 70), day(2, 71)]);
  assert.equal(isTrendEstablished(one), false);
  assert.equal(isTrendEstablished(two), true);
  if (isTrendEstablished(two)) {
    assert.equal(typeof two.change, "number");
    assert.equal(typeof two.direction, "string");
  }
});

test("15. pointsNeededForTrend makes the empty state specific", () => {
  assert.equal(pointsNeededForTrend(0), 2);
  assert.equal(pointsNeededForTrend(1), 1);
  assert.equal(pointsNeededForTrend(2), 0);
  assert.equal(pointsNeededForTrend(50), 0, "never negative");
});
// ------------------------------------------------- rows -> trend points (P35+P40)

const row = (metric_type, value, start_time) => ({ metric_type, value, start_time });

test("16. DECIMAL arrives as a STRING from mysql2 and must be coerced, not concatenated", () => {
  // health_metrics.value is DECIMAL(12,3). mysql2 returns DECIMAL as a string, so
  // without explicit coercion the arithmetic in a trend would be string arithmetic.
  const grouped = trendPointsFrom([row("weight", "70.000", "2026-11-01 08:00:00")]);
  const point = grouped["weight"]?.[0];
  assert.equal(typeof point?.value, "number", "must be a real number, not a string");
  assert.equal(point?.value, 70);

  const points =
    trendPointsFrom([
      row("weight", "70.000", "2026-11-01 08:00:00"),
      row("weight", "68.500", "2026-11-08 08:00:00"),
    ])["weight"] ?? [];
  const trend = buildTrend(points);
  assert.equal(trend.change, -1.5);
  assert.equal(trend.direction, "falling");
});

test("17. a non-finite stored value is marked unusable, never defaulted to 0", () => {
  for (const bad of [null, "abc", ""]) {
    const grouped = trendPointsFrom([row("weight", bad, "2026-11-01 08:00:00")]);
    const point = grouped["weight"]?.[0];
    assert.equal(point?.usable, false, `value ${JSON.stringify(bad)} must be excluded`);
    assert.match(point?.excludeReason ?? "", /not a finite number/);
  }
});

test("18. P40's published implausible observation is excluded on the way in", () => {
  const grouped = trendPointsFrom([
    row("steps", 4, "2026-11-01 08:00:00"),
    row("steps", 8200, "2026-11-02 08:00:00"),
  ]);
  const points = grouped["steps"] ?? [];
  assert.equal(points.length, 2, "both rows are represented");
  assert.equal(points[0]?.usable, false);
  assert.equal(points[0]?.excludeReason, "SPEC_PUBLISHED_OBSERVATION");
  assert.equal(points[1]?.usable, undefined, "an ordinary reading is not judged");

  const trend = buildTrend(points);
  assert.equal(trend.status, "INSUFFICIENT_POINTS", "one usable point is not a trend");
  assert.equal(trend.excluded.length, 1);
});

test("19. sleep_duration = 4 is NOT flagged, only steps = 4 is", () => {
  // P40 matches on metric AND exact value, so a four-hour night is a real (poor)
  // sleep record, not corruption. Guards against over-flagging.
  const grouped = trendPointsFrom([row("sleep_duration", 4, "2026-11-01 08:00:00")]);
  assert.notEqual(grouped["sleep_duration"]?.[0]?.usable, false);
});

test("20. a metric type with no plausibility rule stays usable and unjudged", () => {
  // readiness, stress, recovery and friends have no published rule. Absence of a
  // rule is not evidence of a good value, but it is not grounds for exclusion.
  for (const type of ["readiness", "stress", "recovery", "sleep_score"]) {
    const grouped = trendPointsFrom([row(type, 55, "2026-11-01 08:00:00")]);
    const point = grouped[type]?.[0];
    assert.notEqual(point?.usable, false, `${type} must not be excluded`);
    assert.equal(point?.excludeReason, undefined);
  }
});

test("21. rows are grouped by metric type, so metrics cannot contaminate each other", () => {
  const grouped = trendPointsFrom([
    row("weight", 70, "2026-11-01 08:00:00"),
    row("resting_hr", 55, "2026-11-01 08:00:00"),
    row("weight", 69, "2026-11-02 08:00:00"),
  ]);
  assert.deepEqual(Object.keys(grouped).sort(), ["resting_hr", "weight"]);
  assert.equal(grouped["weight"]?.length, 2);
  assert.equal(grouped["resting_hr"]?.length, 1);
});

test("22. the bridge cannot silently drift from the real metric registry", () => {
  for (const key of Object.keys(PLAUSIBILITY_METRIC_OF)) {
    assert.ok(key in METRIC_DEFS, `${key} is not a known metric type`);
  }
  // Every mapped metric must be one the manual-capture form accepts, since those
  // are the only ones a trend can actually accumulate.
  for (const key of [
    "weight",
    "resting_hr",
    "sleep_duration",
    "body_fat",
    "hrv",
    "steps",
    "training_load",
    "workout",
  ]) {
    assert.equal(METRIC_DEFS[key]?.manual, true, `${key} should be a manual metric`);
  }
});

test("23. a MySQL DATETIME string is normalised to ISO so ordering works", () => {
  // start_time comes back as "YYYY-MM-DD HH:MM:SS" from mysql2, not ISO. Without
  // normalisation Date.parse is unreliable and the sort in buildTrend is wrong.
  const grouped = trendPointsFrom([row("weight", 70, "2026-11-01 08:00:00")]);
  const at = grouped["weight"]?.[0]?.at ?? "";
  assert.equal(at, "2026-11-01T08:00:00.000Z");
  assert.ok(Number.isFinite(Date.parse(at)));
});

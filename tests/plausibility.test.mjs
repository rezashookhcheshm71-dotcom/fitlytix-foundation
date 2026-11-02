// Locks src/domain/plausibility.ts against P25.
//
// The central thing these tests protect is the asymmetry between "published as
// implausible" and "not published as implausible". Collapsing the second into
// "fine" would be an invented threshold, and collapsing it into "implausible"
// would flag real data. Both errors are asserted against below.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  IMPLAUSIBLE_LABEL,
  isImplausible,
  judge,
  partition,
  safeAverage,
  safeAverageOf,
} from "../src/domain/plausibility.ts";

// --- the two published observations ------------------------------------------

test("steps = 4 is flagged implausible with the label P25 requires", () => {
  const v = judge("steps", 4);
  assert.equal(v.status, "implausible");
  assert.equal(v.label, IMPLAUSIBLE_LABEL);
  assert.equal(v.label, "غیرِمعقول");
  assert.equal(v.code, "SPEC_PUBLISHED_OBSERVATION");
  assert.equal(v.provenance.status, "published");
  assert.match(v.provenance.source, /P25/);
});

test("training time = 4 minutes is flagged implausible", () => {
  const v = judge("trainingTimeMinutes", 4);
  assert.equal(v.status, "implausible");
  assert.equal(v.label, IMPLAUSIBLE_LABEL);
});

test("the flag is per metric: steps=4 does not make trainingTimeMinutes=4 legal or vice versa", () => {
  assert.equal(isImplausible("steps", 4), true);
  assert.equal(isImplausible("trainingTimeMinutes", 4), true);
  // Same numeric value, a metric the spec never published a rule for.
  assert.equal(isImplausible("sleepHours", 4), false);
  assert.equal(isImplausible("vo2max", 4), false);
});

// --- never repair ------------------------------------------------------------

test("the original value is preserved bit for bit, never clamped or corrected", () => {
  const v = judge("steps", 4);
  assert.equal(v.value, 4);
  // P25 says find out later why these were recorded, which is impossible if the
  // evidence is rewritten. Assert no "corrected" field sneaks in.
  assert.equal("corrected" in v, false);
  assert.equal("repaired" in v, false);
});

// --- no invented threshold ---------------------------------------------------

test("a step count the spec never published is NOT_ESTABLISHED, not implausible", () => {
  // The temptation is to write "steps < 1000 is implausible". The spec states no
  // such rule, and inventing one would flag a genuine rest day as corrupt data.
  for (const steps of [0, 1, 3, 5, 100, 999, 4000, 12000]) {
    const v = judge("steps", steps);
    assert.equal(v.status, "NOT_ESTABLISHED", `steps=${steps} was judged without evidence`);
    assert.equal(v.reason.includes("no rule"), true);
  }
});

test("NOT_ESTABLISHED is not an approval - it states the absence of evidence", () => {
  const v = judge("steps", 4000);
  assert.equal(v.status, "NOT_ESTABLISHED");
  assert.notEqual(v.status, "plausible");
});

test("a non-finite value is unusable, and is not confused with implausible", () => {
  assert.equal(judge("steps", NaN).status, "unusable");
  assert.equal(judge("steps", Infinity).status, "unusable");
  assert.equal(judge("steps", null).status, "unusable");
  assert.equal(judge("steps", undefined).status, "unusable");
  assert.equal(judge("steps", "4").status, "unusable");
});

// --- exclusion from averages and scores --------------------------------------

test("implausible values never enter an average", () => {
  // 4 is excluded; 4000 and 8000 average to 6000. A naive mean would be 4001.33.
  const r = safeAverageOf("steps", [4, 4000, 8000]);
  assert.equal(r.average, 6000);
  assert.equal(r.usedCount, 2);
  assert.equal(r.excluded.length, 1);
  assert.equal(r.excluded[0].value, 4);
});

test("the exclusion is reported, never swallowed", () => {
  const r = safeAverageOf("steps", [4, 4000, 8000]);
  assert.equal(r.excluded.length, 1);
  assert.equal(r.excluded[0].verdict.status, "implausible");
  assert.equal(r.excluded[0].verdict.label, IMPLAUSIBLE_LABEL);
});

test("average is null, never 0, when nothing is usable", () => {
  // 0 is a legitimate reading for some metrics, so returning it for "no data"
  // would be indistinguishable from a real zero - the confusion Law 1 prevents.
  const r = safeAverageOf("steps", [4]);
  assert.equal(r.average, null);
  assert.equal(r.usedCount, 0);
  assert.equal(r.excluded.length, 1);

  const empty = safeAverage([]);
  assert.equal(empty.average, null);
  assert.equal(empty.usedCount, 0);
});

test("the spec's own snapshot: both implausible values drop out together", () => {
  const observations = [
    { metric: "steps", value: 4 },
    { metric: "trainingTimeMinutes", value: 4 },
    { metric: "sleepHours", value: 7 },
    { metric: "restingHeartRate", value: 75 },
  ];
  const r = safeAverage(observations);
  assert.equal(r.excluded.length, 2, "both published observations must be excluded");
  assert.deepEqual(r.excluded.map((e) => e.metric).sort(), ["steps", "trainingTimeMinutes"]);
  assert.equal(r.usedCount, 2);
  assert.equal(r.average, (7 + 75) / 2);
});

test("unusable values are tracked separately from excluded ones", () => {
  const r = safeAverage([
    { metric: "steps", value: 4 },
    { metric: "steps", value: NaN },
    { metric: "steps", value: 4000 },
  ]);
  assert.equal(r.excluded.length, 1);
  assert.equal(r.unusable.length, 1);
  assert.equal(r.usedCount, 1);
  assert.equal(r.average, 4000);
});

// --- partition ---------------------------------------------------------------

test("partition separates usable, excluded and unusable", () => {
  const p = partition([
    { metric: "steps", value: 4 },
    { metric: "steps", value: 4000 },
    { metric: "vo2max", value: NaN },
  ]);
  assert.equal(p.excluded.length, 1);
  assert.equal(p.usable.length, 1);
  assert.equal(p.usable[0].value, 4000);
  assert.equal(p.unusable.length, 1);
});

test("partition keeps NOT_ESTABLISHED values usable rather than emptying every average", () => {
  // Refusing everything without published evidence would make aggregation
  // impossible; the distinction stays available on the verdict for callers that
  // need certainty.
  const p = partition([{ metric: "sleepHours", value: 7 }]);
  assert.equal(p.usable.length, 1);
  assert.equal(judge("sleepHours", 7).status, "NOT_ESTABLISHED");
});

// Locks src/domain/evidence.ts (P37).
//
// The behaviour worth protecting is the asymmetry between the four statuses:
// "missing" and "implausible" must block use, "no_reference" must NOT, because a
// real measurement with no published scoring basis is still a real measurement.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hasValue,
  implausibleSlot,
  isUsable,
  missingSlot,
  noReferenceSlot,
  okSlot,
  slotFromVerdict,
  withPosition,
} from "../src/domain/evidence.ts";
import { judge } from "../src/domain/plausibility.ts";
import { positionOf } from "../src/lib/reference-ranges.ts";

const MALE_34 = { sex: "male", age: 34 };

test("constructors produce the four distinct statuses", () => {
  assert.equal(okSlot(7).status, "ok");
  assert.equal(missingSlot("not captured").status, "missing");
  assert.equal(
    implausibleSlot(4, "too low", "SPEC_PUBLISHED_OBSERVATION", "غیرِمعقول").status,
    "implausible",
  );
  assert.equal(noReferenceSlot(75, "no published basis").status, "no_reference");
});

test("optional fields stay absent rather than being set to undefined", () => {
  // exactOptionalPropertyTypes in this repo means `source: undefined` and no
  // source are different things; the constructors must not blur them.
  assert.equal("source" in okSlot(7), false);
  assert.equal("source" in okSlot(7, "inbody"), true);
  assert.equal("hint" in missingSlot("x"), false);
  assert.equal("hint" in missingSlot("x", "do y"), true);
});

test("hasValue is true for everything except missing", () => {
  assert.equal(hasValue(okSlot(1)), true);
  assert.equal(hasValue(noReferenceSlot(1, "r")), true);
  assert.equal(hasValue(implausibleSlot(1, "r", "c", "l")), true);
  assert.equal(hasValue(missingSlot("r")), false);
});

test("isUsable excludes missing and implausible but keeps no_reference", () => {
  assert.equal(isUsable(okSlot(1)), true);
  // A real value with no scoring basis may still be displayed.
  assert.equal(isUsable(noReferenceSlot(75, "hrv has no reference")), true);
  // An implausible value must never feed an average or a score (P25).
  assert.equal(isUsable(implausibleSlot(4, "r", "c", "l")), false);
  assert.equal(isUsable(missingSlot("r")), false);
});

test("slotFromVerdict maps a published implausible observation correctly", () => {
  const slot = slotFromVerdict(4, judge("steps", 4));
  assert.equal(slot.status, "implausible");
  assert.equal(slot.value, 4, "the value is kept, never repaired");
  assert.equal(slot.label, "غیرِمعقول");
  assert.equal(isUsable(slot), false);
});

test("slotFromVerdict maps an unusable value to missing, not to implausible", () => {
  const slot = slotFromVerdict(NaN, judge("steps", NaN));
  assert.equal(slot.status, "missing");
});

test("slotFromVerdict treats NOT_ESTABLISHED as ok - absence of a rule is not absence of data", () => {
  // steps = 4000 has no published rule against it. Calling it missing would hide
  // real data; calling it verified would overclaim. It is ok with an honest source.
  const slot = slotFromVerdict(4000, judge("steps", 4000));
  assert.equal(slot.status, "ok");
  assert.equal(slot.value, 4000);
  assert.match(slot.source, /no published rule/);
});

test("withPosition downgrades an unscorable value to no_reference", () => {
  // VO2 45 is inside the published range but no zone boundary covers it, which
  // P36 reports as zoneStatus NOT_ESTABLISHED.
  const pos = positionOf("vo2max", 45, MALE_34);
  assert.equal(pos.zoneStatus, "NOT_ESTABLISHED");
  const slot = withPosition(okSlot(45), pos);
  assert.equal(slot.status, "no_reference");
  assert.equal(slot.value, 45, "the number stays; only the judgement is withheld");
  assert.equal(isUsable(slot), true);
});

test("withPosition leaves an established position alone", () => {
  const pos = positionOf("vo2max", 54, MALE_34);
  assert.equal(pos.zoneStatus, "established");
  assert.equal(withPosition(okSlot(54), pos).status, "ok");
});

test("withPosition maps a null position to no_reference", () => {
  // positionOf returns null when sex is unknown - it never guesses.
  assert.equal(positionOf("vo2max", 54, { sex: null, age: 34 }), null);
  const slot = withPosition(okSlot(54), positionOf("vo2max", 54, { sex: null, age: 34 }));
  assert.equal(slot.status, "no_reference");
  assert.match(slot.reason, /context or reference is absent/);
});

test("a missing or implausible slot outranks any position claim", () => {
  const pos = positionOf("vo2max", 54, MALE_34);
  assert.equal(withPosition(missingSlot("never captured"), pos).status, "missing");
  assert.equal(
    withPosition(implausibleSlot(4, "r", "c", "l"), pos).status,
    "implausible",
    "an implausible value must not be laundered into a scored one",
  );
});

test("end to end: HRV is no_reference, steps=4 is implausible, a real VO2 is ok", () => {
  assert.equal(positionOf("hrv", 75, MALE_34), null, "HRV has NO_REFERENCE by design");
  assert.equal(slotFromVerdict(4, judge("steps", 4)).status, "implausible");
  assert.equal(withPosition(okSlot(54), positionOf("vo2max", 54, MALE_34)).status, "ok");
});

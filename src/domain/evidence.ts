// Evidence slots (P37).
//
// A Slot is the single vocabulary for "what do we actually know about this
// value". It exists because the codebase had two failure modes that look
// identical in the UI: a value that was never captured, and a value that was
// captured but is not trustworthy. Both rendered as a number, and both were
// indistinguishable from a real measurement.
//
// LAW 1: a section with no data gets an honest empty state that says what is
// missing. A Slot makes that structural rather than a per-component habit, so
// the empty state cannot be forgotten at a call site.
//
// This module deliberately integrates with the two it depends on instead of
// restating their rules:
//   src/domain/plausibility.ts       -> "implausible"
//   src/lib/reference-ranges.ts      -> "no_reference"
// Neither rule is duplicated here; both are consumed.

import type { Verdict } from "@/domain/plausibility";
import type { Position } from "@/lib/reference-ranges";

export type SlotStatus = "ok" | "missing" | "implausible" | "no_reference";

export type Slot<T> =
  | { status: "ok"; value: T; /** Where the value came from, when known. */ source?: string }
  | {
      status: "missing";
      /** What would have to exist for this slot to be filled. */
      reason: string;
      /** Optional call to action, e.g. the measurement that would fill it. */
      hint?: string;
    }
  | {
      status: "implausible";
      /** Kept, never repaired: P25 says flag these and find out why later. */
      value: T;
      reason: string;
      code: string;
      label: string;
    }
  | {
      status: "no_reference";
      /** The value exists; what is absent is a published basis to judge it. */
      value: T;
      reason: string;
    };

export function okSlot<T>(value: T, source?: string): Slot<T> {
  return source === undefined ? { status: "ok", value } : { status: "ok", value, source };
}

export function missingSlot<T>(reason: string, hint?: string): Slot<T> {
  return hint === undefined ? { status: "missing", reason } : { status: "missing", reason, hint };
}

export function implausibleSlot<T>(value: T, reason: string, code: string, label: string): Slot<T> {
  return { status: "implausible", value, reason, code, label };
}

export function noReferenceSlot<T>(value: T, reason: string): Slot<T> {
  return { status: "no_reference", value, reason };
}

/** True when the slot carries a value that may be displayed as a measurement. */
export function hasValue<T>(slot: Slot<T>): slot is Extract<Slot<T>, { value: T }> {
  return slot.status !== "missing";
}

/**
 * True only for a value that is both present and not published as implausible.
 *
 * `no_reference` counts as usable on purpose: the measurement is real, only the
 * basis for scoring it is absent, so it may be shown while its score stays empty.
 */
export function isUsable<T>(slot: Slot<T>): boolean {
  return slot.status === "ok" || slot.status === "no_reference";
}

/**
 * Turn a plausibility verdict into a Slot.
 *
 * NOT_ESTABLISHED becomes "ok", not "missing": the value exists and the spec
 * published no rule against it. Calling it missing would hide real data, and
 * calling it verified would overclaim. The distinction survives in `source`.
 */
export function slotFromVerdict<T extends number>(value: T, verdict: Verdict): Slot<T> {
  if (verdict.status === "implausible") {
    return implausibleSlot(value, verdict.reason, verdict.code, verdict.label);
  }
  if (verdict.status === "unusable") {
    return missingSlot(verdict.reason);
  }
  return okSlot(value, "no published rule applies");
}

/**
 * Attach a position to an existing Slot, downgrading it to no_reference when the
 * value is real but cannot be scored.
 *
 * This is where P36's NOT_ESTABLISHED surfaces in the UI vocabulary: the number
 * stays, the judgement does not.
 */
export function withPosition<T extends number>(slot: Slot<T>, position: Position | null): Slot<T> {
  // A missing or implausible value outranks any position claim.
  if (slot.status === "missing" || slot.status === "implausible") return slot;
  if (position === null) {
    return noReferenceSlot(
      slot.value,
      "no position could be computed: the required context or reference is absent",
    );
  }
  if (position.zoneStatus === "NOT_ESTABLISHED") {
    return noReferenceSlot(
      slot.value,
      "the value is inside its published range but no zone boundary is established for it",
    );
  }
  return slot;
}

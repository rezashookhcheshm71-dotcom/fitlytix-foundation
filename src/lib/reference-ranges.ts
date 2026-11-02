// Reference ranges and position scoring (P12 / P36).
//
// LAW 1 GOVERNS THIS FILE: no number here is invented. Every range and every
// zone label is either published in docs/project-prompts.md or it is marked
// NOT_ESTABLISHED and yields no zone at all. An absent reference is better than
// a fabricated one, so `hrv` and `trainingLoad` are deliberately absent.
//
// WHAT THE SPEC PUBLISHES (docs/project-prompts.md, P12):
//   ranges     VO2 25-60 · resting HR 40-100 · sleep 4-11 · body fat M 3-30 / F 8-38
//   formula    verified by reverse-engineering the four published vectors:
//              pct = (value - min) / (max - min) * 100, one decimal, NOT inverted
//              (resting HR is scored plain, which the published 58.3% confirms)
//   hard rule  positionOf returns null when sex or age is missing. Never guess,
//              never default to "male".
//   anchors    male 34: VO2 54 -> 82.9% «عالی» · HR 75 -> 58.3% «میانگین»
//                       sleep 7 -> 42.9% «مطلوب» · body fat 7 -> 14.8% «ورزشکار»
//              female 34: body fat 7 -> «زیرِ حدِ ضروری»
//   scoring    «عالی» starts at the 80th percentile (standing block).
//
// WHAT THE SPEC DOES *NOT* PUBLISH, and therefore is NOT_ESTABLISHED here:
//   - zone boundaries between the anchors. One anchor per metric is a point,
//     not a scale. Asserting «خوب» at 70% would be invention.
//   - the cross-metric inconsistency rule. The male-34 snapshot has every value
//     inside its published range, so a range-only check yields zero findings,
//     yet the spec publishes ONE inconsistency. Some rule links the metrics and
//     the spec never states it. It is not guessed; tests record the gap.
//   - any age dependence. `age` is required by the published signature and is
//     validated, but no published formula varies by age, so none is applied.
//
// Recovery path: the server holds a working `reference-ranges.ts` (md5
// 338f1f26d6f1695d58cb1cf0832ccbb2 per the spec manifest). When scripts/recon/
// recovers it, the anchors below become full bands and this file's gaps close.

/** Metrics with a published range. */
export type MetricKey = "vo2max" | "restingHeartRate" | "sleepHours" | "bodyFatPct";

/** Metrics deliberately without a reference. */
export type NoReferenceKey = "hrv" | "trainingLoad";

/** Any key a caller may ask about, referenced or not. */
export type AnyMetricKey = MetricKey | NoReferenceKey;

/** Sex is read at runtime, never asked of the user, and never defaulted. */
export type Sex = "male" | "female";

export type Range = { min: number; max: number };

/** Why a reference exists, or why it deliberately does not. */
export type Provenance =
  | { status: "published"; source: string }
  | { status: "NOT_ESTABLISHED"; reason: string }
  | { status: "NO_REFERENCE"; reason: string };

export type RangeEntry = {
  key: MetricKey;
  label: string;
  unit: string;
  /** Set when the published range does not depend on sex. */
  range: Range | null;
  /** Set when it does. Exactly one of `range` / `bySex` is non-null. */
  bySex: Record<Sex, Range> | null;
  provenance: Provenance;
  /**
   * Zone evidence, in resolution order. Empty means no zone can be asserted for
   * this metric at all, which is an honest gap rather than a missing feature.
   */
  zones: ZoneEvidence[];
};

/**
 * A zone the spec actually establishes. Three shapes, because the spec gives
 * three kinds of evidence: a percentile band («عالی» from the 80th), an exact
 * published anchor point, and a below-range condition.
 */
export type ZoneEvidence =
  | {
      kind: "band";
      /** Inclusive lower bound of the position percentage. */
      pctFrom: number;
      /** Inclusive upper bound, or null for unbounded above. */
      pctTo: number | null;
      label: string;
      provenance: Provenance;
    }
  | {
      kind: "point";
      value: number;
      sex: Sex;
      label: string;
      provenance: Provenance;
    }
  | {
      kind: "belowRange";
      sex: Sex | null;
      label: string;
      provenance: Provenance;
    };

export type PositionContext = {
  /** Null when unknown. Never defaulted to "male". */
  sex: Sex | null;
  /** Null when unknown. Required by the published signature. */
  age: number | null;
};

export type Position = {
  value: number;
  /** Position within the published range, 0-100, one decimal. */
  pct: number;
  /** Null when no published evidence covers this value. */
  zone: string | null;
  /**
   * Addition to the published shape: distinguishes "no zone because none applies"
   * from "no zone because the spec never established one". Safe to add because
   * nothing in the repository imports this module yet.
   */
  zoneStatus: "established" | "NOT_ESTABLISHED";
  below: boolean;
  above: boolean;
};

export type Finding = {
  key: MetricKey;
  code: "BELOW_RANGE" | "ABOVE_RANGE";
  label: string;
  detail: string;
  value: number;
  range: Range;
  provenance: Provenance;
};

/** Snapshot accepted by `inconsistencies`. Missing metrics are simply absent. */
export type MetricSnapshot = Partial<Record<MetricKey, number>>;

const SPEC = "docs/project-prompts.md P12 (published ranges)";
const SPEC_ANCHOR = "docs/project-prompts.md P12 (published verification vector)";
const SPEC_STANDING = "docs/project-prompts.md standing block («عالی» from the 80th percentile)";

/**
 * The published ranges. Body fat is sex-dependent; the rest are not.
 *
 * `vo2max` also carries the one general scoring rule the spec states outright,
 * which is why it has a band while the others have only point anchors.
 */
export const REFERENCE_RANGES: Record<MetricKey, RangeEntry> = {
  vo2max: {
    key: "vo2max",
    label: "VO2max",
    unit: "ml/kg/min",
    range: { min: 25, max: 60 },
    bySex: null,
    provenance: { status: "published", source: SPEC },
    zones: [
      {
        kind: "band",
        pctFrom: 80,
        pctTo: null,
        label: "عالی",
        // Two published statements combine here: the anchor VO2 54 -> 82.9%
        // «عالی», and the standing rule that «عالی» starts at the 80th
        // percentile. The deduction uses only what the spec asserts.
        provenance: { status: "published", source: `${SPEC_ANCHOR} + ${SPEC_STANDING}` },
      },
      {
        kind: "point",
        value: 54,
        sex: "male",
        label: "عالی",
        provenance: { status: "published", source: SPEC_ANCHOR },
      },
    ],
  },
  restingHeartRate: {
    key: "restingHeartRate",
    label: "ضربانِ استراحت",
    unit: "bpm",
    range: { min: 40, max: 100 },
    bySex: null,
    provenance: { status: "published", source: SPEC },
    // Only a single point is published (75 -> 58.3% «میانگین»). A band cannot
    // be derived from one point, and the metric is not inverted here: the
    // published 58.3% matches the plain formula, not the inverted one (41.7%).
    zones: [
      {
        kind: "point",
        value: 75,
        sex: "male",
        label: "میانگین",
        provenance: { status: "published", source: SPEC_ANCHOR },
      },
    ],
  },
  sleepHours: {
    key: "sleepHours",
    label: "خواب",
    unit: "hours",
    range: { min: 4, max: 11 },
    bySex: null,
    provenance: { status: "published", source: SPEC },
    zones: [
      {
        kind: "point",
        value: 7,
        sex: "male",
        label: "مطلوب",
        provenance: { status: "published", source: SPEC_ANCHOR },
      },
    ],
  },
  bodyFatPct: {
    key: "bodyFatPct",
    label: "چربیِ بدن",
    unit: "%",
    range: null,
    bySex: { male: { min: 3, max: 30 }, female: { min: 8, max: 38 } },
    provenance: { status: "published", source: SPEC },
    zones: [
      {
        kind: "point",
        value: 7,
        sex: "male",
        label: "ورزشکار",
        provenance: { status: "published", source: SPEC_ANCHOR },
      },
      {
        // Published for a 34-year-old female at 7%, which is below the female
        // minimum of 8. The spec does not tie the label to age, so age is not
        // part of the condition; the sex and the below-range state are.
        kind: "belowRange",
        sex: "female",
        label: "زیرِ حدِ ضروری",
        provenance: { status: "published", source: SPEC_ANCHOR },
      },
    ],
  },
};

/** The absence variant of Provenance, narrowed so `.reason` is directly readable. */
export type NoReferenceProvenance = Extract<Provenance, { status: "NO_REFERENCE" }>;

/**
 * Deliberate absence. The spec states there is no valid reference for these and
 * that having none is better than inventing one, so they are never scored.
 */
export const NO_REFERENCE: Record<NoReferenceKey, NoReferenceProvenance> = {
  hrv: {
    status: "NO_REFERENCE",
    reason: "no valid published reference; the spec excludes HRV deliberately",
  },
  trainingLoad: {
    status: "NO_REFERENCE",
    reason: "no valid published reference; the spec excludes training load deliberately",
  },
};

/**
 * Every key this module knows, referenced or not.
 *
 * The assertions are sound rather than optimistic: both records are keyed by a
 * closed literal union, so Object.keys cannot yield a foreign key here.
 */
export const ALL_KEYS: AnyMetricKey[] = [
  ...(Object.keys(REFERENCE_RANGES) as MetricKey[]),
  ...(Object.keys(NO_REFERENCE) as NoReferenceKey[]),
];

const isNoReference = (key: AnyMetricKey): key is NoReferenceKey => key in NO_REFERENCE;

export type RefResult =
  | { status: "published"; key: MetricKey; entry: RangeEntry }
  | { status: "NO_REFERENCE"; key: NoReferenceKey; reason: string }
  | { status: "unknown"; key: string };

/** The reference behind a key, or an explicit statement that there is none. */
export function refOf(key: AnyMetricKey): RefResult {
  if (isNoReference(key)) {
    return { status: "NO_REFERENCE", key, reason: NO_REFERENCE[key].reason };
  }
  const entry = REFERENCE_RANGES[key];
  if (!entry) return { status: "unknown", key: String(key) };
  return { status: "published", key, entry };
}

/** Resolve the sex-dependent range, or null when it cannot be resolved. */
export function rangeFor(key: MetricKey, sex: Sex | null): Range | null {
  const entry = REFERENCE_RANGES[key];
  if (!entry) return null;
  if (entry.range) return entry.range;
  if (sex && entry.bySex) return entry.bySex[sex];
  // Body fat needs a sex. Returning null here is what makes positionOf null.
  return null;
}

/** Round to one decimal, the precision the spec publishes. */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Values must be finite to be scored; NaN never becomes a silent zero. */
function isUsableNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Position of a value within its published range.
 *
 * Returns null - never a guess - when:
 *   the key has no reference, the key is unknown, sex is missing (required for
 *   body fat), age is missing (required by the published signature), or the
 *   value is not a finite number.
 */
export function positionOf(
  key: AnyMetricKey,
  value: number,
  ctx: PositionContext,
): Position | null {
  // The published hard rule: no sex, no age, no position. Never default.
  if (ctx.sex === null || ctx.age === null) return null;
  if (!isUsableNumber(ctx.age) || ctx.age <= 0) return null;
  if (isNoReference(key)) return null;
  if (!isUsableNumber(value)) return null;

  const entry = REFERENCE_RANGES[key];
  if (!entry) return null;

  const range = rangeFor(key, ctx.sex);
  if (!range) return null;

  const span = range.max - range.min;
  if (span <= 0) return null;

  // Verified against all four published vectors, including resting HR, which
  // the spec scores plain rather than inverted.
  const pct = round1(((value - range.min) / span) * 100);
  const below = value < range.min;
  const above = value > range.max;

  const zone = resolveZone(entry, value, pct, below, ctx);
  return {
    value,
    pct,
    zone: zone?.label ?? null,
    zoneStatus: zone ? "established" : "NOT_ESTABLISHED",
    below,
    above,
  };
}

/** First matching published evidence wins; no match means no zone asserted. */
function resolveZone(
  entry: RangeEntry,
  value: number,
  pct: number,
  below: boolean,
  ctx: PositionContext,
): { label: string } | null {
  for (const z of entry.zones) {
    if (z.kind === "belowRange") {
      if (below && (z.sex === null || z.sex === ctx.sex)) return { label: z.label };
      continue;
    }
    if (z.kind === "point") {
      // Exact published anchor. Integer tolerance avoids float noise without
      // widening the claim to values the spec never published.
      if (z.sex === ctx.sex && Math.abs(z.value - value) < 1e-9) return { label: z.label };
      continue;
    }
    if (z.kind === "band") {
      const upper = z.pctTo === null ? Number.POSITIVE_INFINITY : z.pctTo;
      if (pct >= z.pctFrom && pct <= upper) return { label: z.label };
    }
  }
  return null;
}

/**
 * Findings for a snapshot. Only the rule the published ranges support is
 * implemented: a value outside its range.
 *
 * KNOWN GAP, deliberately not closed by invention: the spec publishes ONE
 * inconsistency for the male-34 snapshot and TWO for the female-34 snapshot,
 * but every male value sits inside its published range, so this function
 * returns zero for that snapshot. A cross-metric rule exists in the server's
 * implementation and the spec never states it. tests/reference-ranges.test.mjs
 * records both published counts as unmet expectations.
 */
export function inconsistencies(snapshot: MetricSnapshot, ctx: PositionContext): Finding[] {
  const findings: Finding[] = [];
  if (ctx.sex === null || ctx.age === null) return findings;

  for (const key of Object.keys(REFERENCE_RANGES) as MetricKey[]) {
    const value = snapshot[key];
    if (!isUsableNumber(value)) continue; // absent metrics are not findings
    const range = rangeFor(key, ctx.sex);
    if (!range) continue;

    const entry = REFERENCE_RANGES[key];
    if (value < range.min) {
      findings.push({
        key,
        code: "BELOW_RANGE",
        label: entry?.label ?? key,
        detail: `${value} ${entry?.unit ?? ""} below the published minimum ${range.min}`,
        value,
        range,
        provenance: entry?.provenance ?? { status: "NOT_ESTABLISHED", reason: "no entry" },
      });
    } else if (value > range.max) {
      findings.push({
        key,
        code: "ABOVE_RANGE",
        label: entry?.label ?? key,
        detail: `${value} ${entry?.unit ?? ""} above the published maximum ${range.max}`,
        value,
        range,
        provenance: entry?.provenance ?? { status: "NOT_ESTABLISHED", reason: "no entry" },
      });
    }
  }
  return findings;
}

/**
 * Whether a zone can be asserted for a value at all. Lets the UI render an
 * honest empty state instead of a blank or invented label.
 */
export function zoneEstablished(key: AnyMetricKey, value: number, ctx: PositionContext): boolean {
  return positionOf(key, value, ctx)?.zoneStatus === "established";
}

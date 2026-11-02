// Plausibility judgement (P25 / P40).
//
// LAW 1 GOVERNS THIS FILE: an implausible value is flagged, never silently
// consumed and never repaired.
//
// WHAT THE SPEC PUBLISHES (docs/project-prompts.md P25, lines 635-641):
//   "در پایگاهِ داده دو مقدار غیرِمعقول داریم: گام‌ها = ۴ و زمانِ تمرین = ۴ دقیقه.
//    آن‌ها را درست نکن — آن‌ها را نشانه‌گذاری کن. هر جا این دو خوانده می‌شوند،
//    برچسبِ «غیرِمعقول» بگیرند و در هیچ میانگین یا امتیازی وارد نشوند."
//
// Four obligations follow directly from that sentence, and each is enforced here
// and locked by tests/plausibility.test.mjs:
//   1. flag, with a reason code and provenance
//   2. never repair - the original value is preserved bit for bit
//   3. excluded from every average and every score
//   4. the exclusion is reported, never swallowed
//
// WHAT THE SPEC DOES *NOT* PUBLISH, and therefore is NOT_ESTABLISHED here:
//   - any general threshold. The spec names two exact observations (steps = 4,
//     training time = 4 minutes) and never states a rule such as "steps below N
//     are implausible". Inventing one would flag real rest days as corrupt.
//   - so a value that is merely *unremarkable* is NOT called plausible. Absence
//     from the published list is absence of evidence, reported as
//     NOT_ESTABLISHED, which keeps downstream code from treating silence as
//     approval.
//
// Range-based concerns (a value outside a published reference range) live in
// src/lib/reference-ranges.ts and are deliberately not duplicated here.

import type { Provenance } from "@/lib/reference-ranges";

/**
 * Metrics this module can judge. Only the two the spec publishes carry rules;
 * the rest exist so callers can pass a whole snapshot without special-casing.
 */
export type PlausibilityMetric =
  | "steps"
  | "trainingTimeMinutes"
  | "vo2max"
  | "restingHeartRate"
  | "sleepHours"
  | "bodyFatPct"
  | "hrv"
  | "trainingLoad";

/** Reason codes. Named for the published observation, not for a guessed rule. */
export type ImplausibleCode = "SPEC_PUBLISHED_OBSERVATION";

export type Verdict =
  | {
      status: "implausible";
      metric: PlausibilityMetric;
      value: number;
      code: ImplausibleCode;
      label: string;
      reason: string;
      provenance: Provenance;
    }
  | {
      /**
       * No published evidence either way. This is NOT an approval: callers must
       * decide whether to use such a value, and must not treat it as verified.
       */
      status: "NOT_ESTABLISHED";
      metric: PlausibilityMetric;
      value: number;
      reason: string;
    }
  | {
      status: "unusable";
      metric: PlausibilityMetric;
      reason: string;
    };

/** The Persian label P25 requires wherever these values are read. */
export const IMPLAUSIBLE_LABEL = "غیرِمعقول";

const SPEC_P25 = "docs/project-prompts.md P25 (two published implausible observations)";

/**
 * The published observations, matched by metric AND exact value.
 *
 * Keyed as `metric:value` so a different step count is not swept up by a rule
 * the spec never stated. Four steps is published as implausible; four thousand
 * is not, and this module will not pretend otherwise.
 */
const PUBLISHED_IMPLAUSIBLE: Record<string, { reason: string }> = {
  "steps:4": { reason: "the spec publishes steps = 4 as an implausible observation" },
  "trainingTimeMinutes:4": {
    reason: "the spec publishes training time = 4 minutes as an implausible observation",
  },
};

const keyOf = (metric: PlausibilityMetric, value: number): string => `${metric}:${value}`;

function isUsableNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Judge one value.
 *
 * Never repairs. The `value` on an implausible verdict is the original number,
 * unrounded and unclamped, because P25 says to flag these and find out later
 * why they were recorded - which is impossible if the evidence is rewritten.
 */
export function judge(metric: PlausibilityMetric, value: unknown): Verdict {
  if (!isUsableNumber(value)) {
    return {
      status: "unusable",
      metric,
      reason: `value is not a finite number (got ${typeof value})`,
    };
  }
  const published = PUBLISHED_IMPLAUSIBLE[keyOf(metric, value)];
  if (published) {
    return {
      status: "implausible",
      metric,
      value,
      code: "SPEC_PUBLISHED_OBSERVATION",
      label: IMPLAUSIBLE_LABEL,
      reason: published.reason,
      provenance: { status: "published", source: SPEC_P25 },
    };
  }
  return {
    status: "NOT_ESTABLISHED",
    metric,
    value,
    reason: "the spec publishes no rule covering this metric and value",
  };
}

/** True only for a positively published implausible value. */
export function isImplausible(metric: PlausibilityMetric, value: unknown): boolean {
  return judge(metric, value).status === "implausible";
}

export type Observation = { metric: PlausibilityMetric; value: number };

export type Partition = {
  /** Values safe to aggregate: not published as implausible, and finite. */
  usable: Observation[];
  /** Published implausible. Must never enter an average or a score. */
  excluded: (Observation & { verdict: Verdict })[];
  /** Not a finite number at all - unusable for a different reason than excluded. */
  unusable: { metric: PlausibilityMetric; reason: string }[];
};

/**
 * Split a set of observations for aggregation.
 *
 * `usable` intentionally includes NOT_ESTABLISHED values: they are not published
 * as implausible, so refusing them would empty every average. The distinction is
 * preserved on the returned verdicts so a caller that needs certainty can ask.
 */
export function partition(observations: Observation[]): Partition {
  const out: Partition = { usable: [], excluded: [], unusable: [] };
  for (const o of observations) {
    const verdict = judge(o.metric, o.value);
    if (verdict.status === "implausible") {
      out.excluded.push({ ...o, verdict });
    } else if (verdict.status === "unusable") {
      out.unusable.push({ metric: o.metric, reason: verdict.reason });
    } else {
      out.usable.push(o);
    }
  }
  return out;
}

export type AverageResult = {
  /** Null when nothing is usable. Never 0, which would read as a real average. */
  average: number | null;
  usedCount: number;
  /** Reported so no exclusion is ever silent. */
  excluded: (Observation & { verdict: Verdict })[];
  unusable: { metric: PlausibilityMetric; reason: string }[];
};

/**
 * Average that cannot be contaminated by a published implausible value.
 *
 * Returns `average: null` rather than 0 when nothing is usable, because 0 is a
 * legitimate reading for some metrics and would be indistinguishable from
 * "no data" - the exact confusion Law 1 exists to prevent.
 */
export function safeAverage(observations: Observation[]): AverageResult {
  const p = partition(observations);
  if (p.usable.length === 0) {
    return { average: null, usedCount: 0, excluded: p.excluded, unusable: p.unusable };
  }
  const sum = p.usable.reduce((n, o) => n + o.value, 0);
  return {
    average: sum / p.usable.length,
    usedCount: p.usable.length,
    excluded: p.excluded,
    unusable: p.unusable,
  };
}

/**
 * Average over one metric only, the common case when building a weekly figure.
 * Same guarantees as safeAverage.
 */
export function safeAverageOf(metric: PlausibilityMetric, values: number[]): AverageResult {
  return safeAverage(values.map((value) => ({ metric, value })));
}

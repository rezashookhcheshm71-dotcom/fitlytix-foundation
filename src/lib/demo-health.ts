import type { MetricRow } from "@/lib/athlete-health";

/**
 * Sample health rows for the dev-only design preview.
 *
 * These exist because the real payload needs a session and the session needs the
 * host database, which no preview environment has. Without them the entire health
 * UI - trends, value slots, the four dashboard slides - renders nothing at all and
 * cannot be reviewed by the person whose sign-off the design needs.
 *
 * They are ordinary MetricRow values, chosen so every branch the real UI can take
 * appears at once: two rising (one of them a metric the spec excludes from scoring,
 * so the "no reference" marker renders), one falling, one flat, one measured but too
 * sparse to trend, one carrying an excluded reading with its reason, and two never
 * measured. The numbers are invented. Anything rendering them is required to say
 * so on screen, and useAthleteHealth refuses to serve them outside a dev build.
 */
export const DEMO_METRICS: MetricRow[] = [
  {
    metricType: "steps",
    label: "گام‌ها",
    unit: "گام",
    status: "ESTABLISHED",
    pointCount: 4,
    pointsNeeded: 2,
    trend: {
      direction: "rising",
      change: 1240,
      changePct: 15.2,
      spanDays: 21,
      last: { value: 9420, at: "2026-10-28T06:00:00Z" },
      excluded: [],
    },
  },
  {
    metricType: "resting_hr",
    label: "ضربانِ استراحت",
    unit: "bpm",
    status: "ESTABLISHED",
    pointCount: 3,
    pointsNeeded: 2,
    trend: {
      direction: "falling",
      change: -4,
      changePct: -6.9,
      spanDays: 14,
      last: { value: 54, at: "2026-10-27T05:30:00Z" },
      excluded: [],
    },
  },
  {
    metricType: "sleep_duration",
    label: "خواب",
    unit: "ساعت",
    status: "ESTABLISHED",
    pointCount: 3,
    pointsNeeded: 2,
    trend: {
      direction: "flat",
      change: 0,
      changePct: 0,
      spanDays: 10,
      last: { value: 7.2, at: "2026-10-29T06:10:00Z" },
      excluded: [{ value: 21, at: "2026-10-25T06:00:00Z", reason: "خارج از بازه‌یِ باورپذیر" }],
    },
  },
  {
    metricType: "vo2max",
    label: "بیشینه‌یِ اکسیژن",
    unit: "ml/kg/min",
    status: "INSUFFICIENT_POINTS",
    pointCount: 1,
    pointsNeeded: 2,
    trend: {
      direction: null,
      change: null,
      changePct: null,
      spanDays: null,
      last: { value: 47.5, at: "2026-10-20T08:00:00Z" },
      excluded: [],
    },
  },
  {
    // Exercises the "no reference" marker on the performance tab's measured slide.
    // training_load is one of only two metric types the spec deliberately excludes
    // from scoring, and without a recorded value here that whole branch would never
    // render - an unexercised path is an assertion, not a measurement. It also proves
    // the snake_case metricType reaches the camelCase NO_REFERENCE key.
    metricType: "training_load",
    label: "بارِ تمرین",
    unit: "AU",
    status: "ESTABLISHED",
    pointCount: 3,
    pointsNeeded: 2,
    trend: {
      direction: "rising",
      change: 210,
      changePct: 18.4,
      spanDays: 12,
      last: { value: 1360, at: "2026-10-29T18:00:00Z" },
      excluded: [],
    },
  },
  {
    metricType: "hrv",
    label: "تغییرپذیریِ ضربانِ قلب",
    unit: "ms",
    status: "NO_DATA",
    pointCount: 0,
    pointsNeeded: 2,
    trend: null,
  },
  {
    metricType: "body_fat",
    label: "درصدِ چربیِ بدن",
    unit: "٪",
    status: "NO_DATA",
    pointCount: 0,
    pointsNeeded: 2,
    trend: null,
  },
];

export const DEMO_SUMMARY = { totalMetricTypes: 7, withTrend: 4, withoutTrend: 3 };

#!/usr/bin/env node
/**
 * Verifies the TypeScript interpreter reproduces sklearn's predictions exactly.
 *
 *   node --experimental-strip-types scripts/check-model-parity.mjs
 *
 * Reads parity fixtures exported during training (200 held-out athletes with
 * sklearn's own probabilities) and asserts the JS implementation matches within
 * 1e-5. Also runs a few feature-extraction invariants so a broken answer mapping
 * fails here instead of silently producing a wrong plan in production.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { classify, regress } from "../src/services/recommendation/ensemble.ts";
import { extractFeatures, toVector } from "../src/services/recommendation/features.ts";

const here = dirname(fileURLToPath(import.meta.url));
const modelDir = join(here, "..", "src", "services", "recommendation", "model");
const model = JSON.parse(readFileSync(join(modelDir, "model.json"), "utf8"));
const parity = JSON.parse(readFileSync(join(modelDir, "parity_cases.json"), "utf8"));

const failures = [];
const maxError = { program: 0, nutrition: 0, duration: 0, coaching: 0, sessions: 0, adherence: 0 };

function compare(label, actual, expected, bucket) {
  const error = Math.abs(actual - expected);
  if (error > maxError[bucket]) maxError[bucket] = error;
  if (error > 1e-5) {
    failures.push(`${label}: expected ${expected}, got ${actual} (Δ${error.toExponential(2)})`);
  }
}

for (const [caseIndex, testCase] of parity.cases.entries()) {
  const features = testCase.features;
  const programModel = model.models.program[testCase.sport];
  const program = classify(programModel, features);
  testCase.expected.program.probabilities.forEach((expected, i) => {
    compare(`case#${caseIndex} program`, program.probabilities[i] ?? 0, expected, "program");
  });

  const nutrition = classify(model.models.nutrition, features);
  testCase.expected.nutrition.probabilities.forEach((expected, i) => {
    compare(`case#${caseIndex} nutrition`, nutrition.probabilities[i] ?? 0, expected, "nutrition");
  });

  const duration = classify(model.models.duration, features);
  testCase.expected.duration.probabilities.forEach((expected, i) => {
    compare(`case#${caseIndex} duration`, duration.probabilities[i] ?? 0, expected, "duration");
  });

  const coaching = classify(model.models.coaching, features);
  testCase.expected.coaching.probabilities.forEach((expected, i) => {
    compare(`case#${caseIndex} coaching`, coaching.probabilities[i] ?? 0, expected, "coaching");
  });

  compare(
    `case#${caseIndex} sessions`,
    regress(model.models.sessions, features),
    testCase.expected.sessions,
    "sessions",
  );
  compare(
    `case#${caseIndex} adherence`,
    regress(model.models.adherence, features),
    testCase.expected.adherence,
    "adherence",
  );
}

// ---- feature extraction invariants ----------------------------------------
function build(answers, overrides = {}) {
  return extractFeatures({ sport: "crossfit", answers, ...overrides }, model.fillValues);
}

const beginner = build({
  "common.profile.training_history": "option_1",
  "common.schedule.sessions_per_week": 3,
  "common.safety.pain": "option_1",
});
const advanced = build(
  {
    "common.profile.training_history": "option_5",
    "common.schedule.sessions_per_week": 6,
    "common.safety.pain": "option_1",
    "crossfit.strength.back_squat_1rm": 150,
    "crossfit.strength.deadlift_1rm": 190,
  },
  { profile: { weightKg: 80 } },
);

if (!(beginner.named.experience_rank < advanced.named.experience_rank)) {
  failures.push("experience_rank did not increase with training history");
}
if (!(beginner.named.strength_index < advanced.named.strength_index)) {
  failures.push("strength_index did not increase with measured 1RMs");
}
if (beginner.named.pain_severity !== 0)
  failures.push("pain-free answer should map to pain_severity 0");
if (beginner.named.strength_available !== 0)
  failures.push("strength_available should be 0 without records");
if (advanced.named.strength_available !== 1)
  failures.push("strength_available should be 1 with records");
if (advanced.named.goal_health !== 1)
  failures.push("default goal should be health when no goal is provided");

const vector = toVector(advanced.named, model.features);
if (vector.length !== model.features.length) failures.push("feature vector length mismatch");
if (vector.some((v) => !Number.isFinite(v)))
  failures.push("feature vector contains non-finite values");

const painy = build({
  "common.safety.pain": "option_4",
  "common.safety.areas": ["option_4", "option_5"],
});
if (painy.named.pain_severity < 3) failures.push("clinician-limited pain must map to severity 3");
if (painy.named.pain_area_count !== 2) failures.push("pain_area_count did not count flagged areas");

const sleeping = build({ "common.recovery.sleep_hours": 5 });
if (sleeping.named.sleep_hours !== 5) failures.push("sleep_hours was not parsed");

// ---- report ---------------------------------------------------------------
const worst = Object.entries(maxError).sort((a, b) => b[1] - a[1])[0];
console.log(
  `Parity fixtures       : ${parity.cases.length} athletes (model ${parity.modelVersion})`,
);
console.log(
  `Max absolute error    : program ${maxError.program.toExponential(1)} | nutrition ${maxError.nutrition.toExponential(1)} | ` +
    `duration ${maxError.duration.toExponential(1)} | coaching ${maxError.coaching.toExponential(1)} | ` +
    `sessions ${maxError.sessions.toExponential(1)} | adherence ${maxError.adherence.toExponential(1)}`,
);
console.log(`Worst bucket          : ${worst?.[0]} (${worst?.[1].toExponential(1)})`);
console.log(`Feature invariants    : ${failures.length === 0 ? "ok" : "FAILED"}`);

if (failures.length > 0) {
  console.error(`\n${failures.length} failure(s):`);
  for (const failure of failures.slice(0, 20)) console.error(`  - ${failure}`);
  process.exitCode = 1;
} else {
  console.log("All checks passed — TS inference matches sklearn.");
}

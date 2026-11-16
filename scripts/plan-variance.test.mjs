#!/usr/bin/env node
/**
 * «چرا برنامه عوض نمی‌شود؟» — measured, not argued.
 *
 * Boots nothing and needs no database: it posts to a locally running build of the same endpoint
 * the app uses. Proves two things the athlete cares about:
 *   1. identical inputs → identical plan (deterministic by design, so a bare "regenerate" is a no-op)
 *   2. a real constraint (cycle length, session cap) → a genuinely different plan
 *
 * Usage:
 *   PORT=3995 node .output/server/index.mjs &
 *   BASE_URL=http://127.0.0.1:3995 node scripts/plan-variance.test.mjs
 */
const base = process.env.BASE_URL ?? "http://127.0.0.1:3995";

const request = (constraints) => ({
  sport: "crossfit",
  profile: {
    age: 30,
    gender: "male",
    heightCm: 180,
    weightKg: 82,
    experience: "intermediate",
    primaryGoal: "strength",
    sessionsPerWeek: 4,
    minutesPerSession: 60,
  },
  ...(constraints ? { constraints } : {}),
});

async function plan(constraints) {
  const response = await fetch(`${base}/api/recommend`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request(constraints)),
  });
  const json = await response.json();
  if (!json.ok) throw new Error(json.error ?? "request failed");
  return json.recommendation;
}

const fingerprint = (r) =>
  `${r.program.sessionsPerWeek}/${r.program.sessionMinutes}/${r.program.weeks}/${r.duration.labelFa}/${r.program.labelFa}`;

const cases = [
  ["base", undefined],
  ["base again (same inputs)", undefined],
  ["max 2 sessions/week", { maxSessionsPerWeek: 2 }],
  ["cycle 1 month", { durationMonths: 1 }],
  ["cycle 12 months", { durationMonths: 12 }],
];

const results = [];
for (const [label, constraints] of cases) {
  results.push([label, await plan(constraints)]);
}

let failed = 0;
const check = (label, ok, detail) => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};

const first = fingerprint(results[0][1]);
const repeat = fingerprint(results[1][1]);
check("same inputs give the same plan (deterministic)", first === repeat, first);

const capped = fingerprint(results[2][1]);
check("maxSessionsPerWeek=2 changes the plan", capped !== first, `base ${first} → ${capped}`);

const shortCycle = fingerprint(results[3][1]);
check("durationMonths=1 changes the plan", shortCycle !== first, `→ ${shortCycle}`);

const longCycle = fingerprint(results[4][1]);
check("durationMonths=12 changes the plan", longCycle !== first, `→ ${longCycle}`);

console.log(
  failed === 0
    ? "\nنتیجه: برنامه با ورودی یکسان عوض نمی‌شود (طبق طراحی) و با تغییر تنظیم‌ها واقعاً عوض می‌شود."
    : `\n${failed} assertion(s) failed.`,
);
process.exit(failed === 0 ? 0 : 1);

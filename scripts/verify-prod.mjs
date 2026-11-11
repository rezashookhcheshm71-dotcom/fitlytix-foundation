// Smoke-checks a running production server: node scripts/verify-prod.mjs [baseUrl]
// Covers pages, the auth-independent APIs and a real recommendation inference,
// so a deploy that forgot to build (or whose model artefact is broken) fails loudly.
const base = process.argv[2] ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`;
const paths = [
  "/api/health",
  "/",
  "/onboarding",
  "/assessment/common",
  "/athlete/dashboard",
  "/coach",
  "/plans",
  "/recommendation",
  "/api/recommend",
];
let failed = 0;
for (const p of paths) {
  try {
    const res = await fetch(base + p);
    console.log(`${res.status} ${p}`);
    if (!res.ok) failed++;
  } catch (e) {
    console.log(`ERR ${p} ${e.message}`);
    failed++;
  }
}

// End-to-end check of the self-hosted model: assessment -> plan recommendation.
try {
  const res = await fetch(`${base}/api/recommend`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sport: "crossfit",
      profile: { age: 30, experience: "intermediate", primaryGoal: "strength", sessionsPerWeek: 4 },
      assessmentAnswers: { "common.safety.pain": "option_1", "common.recovery.sleep_hours": 7 },
    }),
  });
  const json = await res.json().catch(() => ({}));
  const recommendation = json?.recommendation;
  if (!res.ok || !json?.ok || !recommendation?.program?.archetypeId) {
    console.log(`ERR POST /api/recommend ${res.status} ${JSON.stringify(json).slice(0, 200)}`);
    failed++;
  } else {
    console.log(
      `200 POST /api/recommend -> ${recommendation.program.archetypeId} · ` +
        `${recommendation.duration.months}mo · ${recommendation.nutrition.strategyId} · ` +
        `model ${recommendation.model.version} (${recommendation.model.source}, ${recommendation.model.trainingData})`,
    );
  }
} catch (e) {
  console.log(`ERR POST /api/recommend ${e.message}`);
  failed++;
}

console.log(failed ? `\n${failed} check(s) failed` : "\nAll smoke checks passed");
process.exit(failed ? 1 : 0);

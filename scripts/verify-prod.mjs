// Smoke-checks a running production server: node scripts/verify-prod.mjs [baseUrl]
const base = process.argv[2] ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`;
const paths = ["/api/health", "/", "/onboarding", "/assessment/common", "/athlete/dashboard", "/coach", "/plans"];
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
process.exit(failed ? 1 : 0);

#!/usr/bin/env node
/**
 * Deploy-bundle builder.
 *
 * The host already runs an OLDER visual plus server-only sources that are not in
 * git (src/api/auth/me.ts, domain/metrics.tsx, a seeded domain/carousel.tsx,
 * flx-*.css, migrations 005-006) and a LIVE database with rows in it. Deploying
 * therefore must be a surgical replacement, never a blind copy: this script
 * packages exactly what changes (the compiled app) and exactly what must not
 * (the database, and a preserve-list of host-only files), with the stop /
 * replace / start / health-check order written down next to the bits.
 *
 * Usage:  node scripts/deploy/build-deploy-bundle.mjs
 * Output: deploy-bundle/   (gitignored; hand-carried to the host)
 */
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { execSync } from "node:child_process";

const ROOT = new URL("../..", import.meta.url).pathname;
const OUT = join(ROOT, ".output");
const BUNDLE = join(ROOT, "deploy-bundle");

// 1. Fresh production build so the bundle never ships a stale artifact.
execSync("npm run build", { cwd: ROOT, stdio: "inherit" });
if (!existsSync(join(OUT, "server", "index.mjs"))) {
  console.error("build produced no .output/server/index.mjs - aborting");
  process.exit(1);
}

// 2. Clean slate, then copy the compiled app.
rmSync(BUNDLE, { recursive: true, force: true });
mkdirSync(BUNDLE, { recursive: true });
cpSync(OUT, join(BUNDLE, "output"), { recursive: true });

// 3. Host-only files the old deployment owns. Nothing here is overwritten by the
//    bundle; the list exists so the person deploying backs them up first and so
//    nobody "cleans up" an endpoint the live app still calls.
const PRESERVE = [
  "src/api/auth/me.ts",
  "src/domain/metrics.tsx",
  "src/domain/carousel.tsx",
  "src/flx-system.css",
  "src/flx-master.css",
  "apply-dash.mjs",
  "database/migrations/mysql/005_*.sql",
  "database/migrations/mysql/006_*.sql",
];

const head = execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim();

const readme = `# FitLytix deploy bundle — build ${head}

Compiled app is in ./output (Nitro node-server preset; run with
\`node output/server/index.mjs\` and PORT + DB_* env).

## Order of operations on the host
1. BACK UP the live database first. Migrations are not reversible.
2. Back up every path in PRESERVE below; the bundle does not contain them.
3. Stop the running app.
4. Replace the app directory's compiled output with ./output.
5. Start it and run the health checks in docs/deployment-runbook-2026-11.md §5:
   / -> 200, /api/athlete/health without cookie -> 401, a DB-backed route
   without credentials -> 401/503 (never 500, never fake data).
6. Rollback = put the previous output back and restart.

## PRESERVE (host-only, do not overwrite, do not delete)
${PRESERVE.map((p) => `- ${p}`).join("\n")}

## Do NOT touch
- The live database. This bundle carries no migration and applies none.
- Any *.env / credential file on the host.
`;
writeFileSync(join(BUNDLE, "DEPLOY.md"), readme);
writeFileSync(
  join(BUNDLE, "PRESERVE.txt"),
  PRESERVE.join("\n") + "\n",
);

const bytes = (p) => readFileSync(p).length;
console.log(`bundle ready at ${relative(ROOT, BUNDLE)}`);
console.log(`  head            ${head}`);
console.log(`  server entry    ${bytes(join(BUNDLE, "output", "server", "index.mjs"))} bytes`);
console.log(`  preserve list   ${PRESERVE.length} host-only paths`);

#!/usr/bin/env node
// Stage verification chain (P41) — Law 3: every stage is measured before the
// next one starts, and the measurement itself lives in git so it can be argued
// with. This script only reads; the single exception is --update-baseline.
//
//   node scripts/verify.mjs                   run every step
//   node scripts/verify.mjs --only=typecheck  run one step
//   node scripts/verify.mjs --skip-build      fast loop while editing
//   node scripts/verify.mjs --update-baseline re-freeze guard baselines
//   node scripts/verify.mjs --json            machine-readable summary
//
// Exits 1 when any step fails, so it can gate a deploy directly.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  REPO_ROOT,
  STATUS,
  countMatches,
  discoverGuards,
  lastJson,
  loadBaseline,
  runNode,
  runNodeArgs,
  worst,
} from "./guards/lib.mjs";

const argv = process.argv.slice(2);
const has = (name) => argv.includes(`--${name}`);
const value = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : "";
};

const only = value("only");
const updateBaseline = has("update-baseline");
const asJson = has("json");
const verbose = has("verbose") || asJson;

const MARKS = { pass: "PASS", fail: "FAIL", warn: "WARN", skip: "SKIP" };
const mark = (status) => MARKS[status] ?? "????";

const STEPS = [
  { key: "typecheck", label: "tsc --noEmit", run: stepTypecheck },
  { key: "guards", label: "scripts/guards/check-*", run: stepGuards },
  { key: "tests", label: "node --test tests/", run: stepTests },
  { key: "build", label: "vite build", run: stepBuild },
];

// --- steps -------------------------------------------------------------------

function stepTypecheck() {
  const { code, out } = runNode("node_modules/typescript/bin/tsc", ["--noEmit"]);
  if (code === 0) return { status: STATUS.PASS, detail: "no type errors" };
  const errors = countMatches(out, /error TS\d+/g);
  const shown = tail(out, verbose ? 40 : 8);
  return { status: STATUS.FAIL, detail: `${errors} type error(s)\n${shown}` };
}

function stepGuards() {
  const guards = discoverGuards();
  if (guards.length === 0) {
    return {
      status: STATUS.SKIP,
      detail: "no check-*.mjs in scripts/guards/ — nothing is being measured yet",
    };
  }

  let status = STATUS.PASS;
  const lines = [];
  for (const guard of guards) {
    const started = Date.now();
    const { code, out } = runNode(guard, updateBaseline ? ["--update-baseline"] : []);
    const ms = Date.now() - started;
    const parsed = lastJson(out);
    const guardStatus = parsed?.status ?? (code === 0 ? STATUS.PASS : STATUS.FAIL);
    status = worst(status, guardStatus);

    const name =
      parsed?.name ?? guard.replace(/^scripts[\\/]guards[\\/]check-/, "").replace(/\.mjs$/, "");
    lines.push(`${mark(guardStatus)} ${name} (${ms}ms)`);
    if (guardStatus !== STATUS.PASS || verbose) {
      for (const line of String(parsed?.detail ?? tail(out, 12)).split("\n")) {
        if (line.trim()) lines.push(`    ${line}`);
      }
    }
  }
  return { status, detail: lines.join("\n") };
}

function stepTests() {
  const dir = join(REPO_ROOT, "tests");
  const found = existsSync(dir)
    ? readdirSync(dir)
        .filter((name) => /\.test\.(m|c)?js$/.test(name))
        .sort()
    : [];
  if (found.length === 0) {
    // Honest empty state, not a green tick: this stage simply is not measured.
    return {
      status: STATUS.SKIP,
      detail: "no tests/ directory with *.test.mjs — nothing locks this behaviour yet",
    };
  }

  // Explicit file list, never a directory argument: on this Node version
  // `node --test tests/` resolves the directory as a module and dies, while a
  // bare `node --test` scans src/ and mistakes the real API route
  // `src/routes/api/db-test.ts` for a test file. Both are avoided here, and the
  // list is built in JS so it does not depend on shell glob expansion.
  const { code, out } = runNodeArgs(["--test", ...found.map((name) => join("tests", name))]);
  const passed = Number(/# pass (\d+)/.exec(out)?.[1] ?? 0);
  const failed = Number(/# fail (\d+)/.exec(out)?.[1] ?? 0);
  if (code === 0 && failed === 0) {
    return {
      status: STATUS.PASS,
      detail: `${passed} test(s) passed across ${found.length} file(s)`,
    };
  }
  return { status: STATUS.FAIL, detail: `${failed} failing / ${passed} passing\n${tail(out, 30)}` };
}

function stepBuild() {
  if (has("skip-build")) return { status: STATUS.SKIP, detail: "--skip-build given" };
  const { code, out } = runNode("node_modules/vite/bin/vite.js", ["build"]);
  if (code === 0) {
    const took = /built in ([\d.]+m?s)/.exec(out)?.[1] ?? "?";
    return { status: STATUS.PASS, detail: `built in ${took}` };
  }
  return { status: STATUS.FAIL, detail: `build failed (exit ${code})\n${tail(out, 30)}` };
}

/** Last `n` non-empty lines of a command's output. */
function tail(out, n) {
  return String(out)
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.trim())
    .slice(-n)
    .join("\n");
}

// --- run ---------------------------------------------------------------------

const steps = STEPS.filter((step) => !only || step.key === only);
if (steps.length === 0) {
  console.error(`unknown step "${only}". available: ${STEPS.map((s) => s.key).join(", ")}`);
  process.exit(2);
}

const results = [];
for (const step of steps) {
  const started = Date.now();
  let res;
  try {
    res = step.run();
  } catch (err) {
    res = {
      status: STATUS.FAIL,
      detail: `step threw: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  results.push({ key: step.key, label: step.label, ms: Date.now() - started, ...res });
}

const failed = results.filter((r) => r.status === STATUS.FAIL);
const skipped = results.filter((r) => r.status === STATUS.SKIP);
const warned = results.filter((r) => r.status === STATUS.WARN);
const baseline = loadBaseline();

if (asJson) {
  console.log(JSON.stringify({ ok: failed.length === 0, results, baseline }, null, 2));
} else {
  console.log("");
  console.log("FitLytix verify - stage gate");
  for (const r of results) {
    const secs = `${(r.ms / 1000).toFixed(1)}s`.padStart(7);
    console.log(`  ${mark(r.status)}  ${r.key.padEnd(10)} ${r.label.padEnd(26)} ${secs}`);
    if (r.status !== STATUS.PASS || verbose) {
      for (const line of String(r.detail ?? "").split("\n")) {
        if (line.trim()) console.log(`          ${line}`);
      }
    }
  }
  console.log("");
  console.log(`  ${results.length - failed.length}/${results.length} steps clear.`);
  if (baseline?.lint) {
    console.log(
      `  frozen lint debt: ${baseline.lint.errors} errors / ${baseline.lint.warnings} warnings`,
    );
  }
  if (warned.length) console.log(`  needs a look: ${warned.map((w) => w.key).join(", ")}`);
  if (skipped.length) {
    console.log(`  NOT MEASURED: ${skipped.map((s) => s.key).join(", ")} (skipped is not passed)`);
  }
  if (failed.length) {
    console.log("");
    console.log(`  FAILED: ${failed.map((f) => f.key).join(", ")} - fix before the next stage.`);
  }
  console.log("");
}

process.exit(failed.length ? 1 : 0);

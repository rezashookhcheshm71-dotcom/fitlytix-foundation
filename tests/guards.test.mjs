// Tests for the verification harness itself (P41).
//
// A guard that is not tested is an assertion, not a measurement — so these lock
// the behaviour every later stage depends on. Run with: node --test tests/
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BASELINE_PATH,
  REPO_ROOT,
  STATUS,
  countMatches,
  discoverGuards,
  lastJson,
  lintReport,
  runNode,
  runNodeArgs,
  toRepoPath,
  worst,
} from "../scripts/guards/lib.mjs";

test("countMatches counts without the grep -c exit-code trap", () => {
  assert.equal(countMatches("aXbXc", /X/g), 2);
  assert.equal(countMatches("nothing here", /X/g), 0);
  // Zero matches must be a number, never a thrown non-zero exit.
  assert.equal(countMatches("", /X/g), 0);
});

test("worst() never lets skip read as pass", () => {
  assert.equal(worst(STATUS.PASS, STATUS.PASS), STATUS.PASS);
  assert.equal(worst(STATUS.PASS, STATUS.SKIP), STATUS.SKIP);
  assert.equal(worst(STATUS.SKIP, STATUS.WARN), STATUS.WARN);
  assert.equal(worst(STATUS.WARN, STATUS.FAIL), STATUS.FAIL);
  assert.equal(worst(STATUS.FAIL, STATUS.PASS), STATUS.FAIL);
});

test("lastJson finds the report even when a guard logs first", () => {
  const out = 'some human text\n  indented note\n{"name":"g","status":"pass"}\n';
  assert.deepEqual(lastJson(out), { name: "g", status: "pass" });
  assert.equal(lastJson("no json at all"), null);
  assert.equal(lastJson(""), null);
});

test("runNodeArgs reports failure instead of throwing", () => {
  const bad = runNodeArgs(["-e", "process.exit(3)"]);
  assert.equal(bad.code, 3);
  const good = runNodeArgs(["-e", "process.stdout.write('ok')"]);
  assert.equal(good.code, 0);
  assert.equal(good.out, "ok");
});

test("runNode reaches a dependency entry point through the current binary", () => {
  const { code, out } = runNode("node_modules/typescript/bin/tsc", ["--version"]);
  assert.equal(code, 0);
  assert.match(out, /Version \d+\.\d+/);
});

test("toRepoPath yields portable slash-separated relative paths", () => {
  assert.equal(toRepoPath(`${REPO_ROOT}/src/lib/locale.ts`), "src/lib/locale.ts");
  assert.equal(toRepoPath(`${REPO_ROOT}\\src\\lib\\locale.ts`), "src/lib/locale.ts");
  // Anything outside the repo is returned unchanged rather than mangled.
  assert.equal(toRepoPath("/elsewhere/x.ts"), "/elsewhere/x.ts");
});

test("discoverGuards finds the lint ratchet", () => {
  const guards = discoverGuards();
  assert.ok(guards.length >= 1, "expected at least one check-*.mjs guard");
  assert.ok(
    guards.some((g) => g.endsWith("check-lint-ratchet.mjs")),
    `lint ratchet missing from ${guards.join(", ")}`,
  );
  // Guards must not accidentally pick up the shared library.
  assert.ok(!guards.some((g) => g.endsWith("lib.mjs")), "lib.mjs is not a guard");
});

test("lintReport returns a real measurement of this repository", () => {
  const report = lintReport();
  assert.equal(report.ok, true, `eslint failed: ${report.raw ?? ""}`);
  assert.equal(typeof report.errors, "number");
  assert.equal(typeof report.warnings, "number");
  assert.ok(
    report.errors > 0,
    "the repo is known to carry prettier debt; 0 suggests a broken scan",
  );
  // Every counted problem must belong to a file entry, so the per-file ratchet
  // cannot silently disagree with the totals.
  const summed = Object.values(report.files).reduce((n, f) => n + f.errors, 0);
  assert.equal(summed, report.errors);
  const ruleSum = Object.values(report.byRule).reduce((n, c) => n + c, 0);
  assert.equal(ruleSum, report.errors + report.warnings);
});

test("baseline.json path points inside scripts/guards", () => {
  assert.equal(toRepoPath(BASELINE_PATH), "scripts/guards/baseline.json");
});

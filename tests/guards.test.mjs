// Tests for the verification harness itself (P41).
//
// A guard that is not tested is an assertion, not a measurement — so these lock
// the behaviour every later stage depends on. Run with: node --test tests/
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
  // This used to assert report.errors > 0 on the reasoning that the repo was
  // known to carry prettier debt, so 0 must mean a broken scan. That held until
  // the debt was cleared, and then it failed for the best possible reason: the
  // repository had become clean. The proxy was wrong, not the intent - a broken
  // scan and a clean repo both report 0, and a count cannot tell them apart.
  // So both halves of the intent are now measured directly.
  //
  // Half one: eslint examined files in this repository at all.
  assert.ok(
    report.scanned > 0,
    "eslint matched no files, so a 0 error count proves nothing - the scan is broken",
  );

  // Half two: a positive control. Deliberately misformatted source is fed to
  // eslint through stdin and must come back flagged. This is the half that a
  // count can never cover - if the prettier rule were disabled by a config
  // regression, debt would read as 0 forever and every ratchet check with it.
  // Stdin rather than a temp file so that nothing is ever written to the tree:
  // a probe file left behind by a crashing test would be picked up by the build.
  const probe = "export const badlyFormatted = {a:1,b:2,c:3,d:4,e:5,f:6,g:7,h:8}\n";
  let probeOut;
  try {
    probeOut = execFileSync(
      process.execPath,
      [
        "node_modules/eslint/bin/eslint.js",
        "--stdin",
        "--stdin-filename",
        "src/__lint_probe__.ts",
        "-f",
        "json",
      ],
      { cwd: REPO_ROOT, input: probe, encoding: "utf8" },
    );
  } catch (err) {
    // eslint exits 1 precisely because it found problems, which is the outcome
    // this control is asking for, so the report arrives on the error's stdout.
    probeOut = err.stdout;
  }
  const probeReport = JSON.parse(probeOut);
  const probeHits = (probeReport[0]?.messages ?? []).filter(
    (m) => m.ruleId === "prettier/prettier",
  );
  assert.ok(
    probeHits.length > 0,
    "eslint did not flag deliberately misformatted source, so the prettier rule is " +
      "not live and a 0 debt count would be meaningless",
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

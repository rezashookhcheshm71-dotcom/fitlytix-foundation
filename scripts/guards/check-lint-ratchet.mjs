// Guard: lint debt may only go down, never up (P41 ratchet).
//
// The repository carries a large pre-existing prettier debt. Failing on that
// debt would leave the gate permanently red and therefore useless, so the debt
// is frozen per file: today's numbers are recorded in baseline.json, and a file
// that gets worse — or a new file that arrives dirty — fails the chain.
//
// Contract: human-readable lines first, then ONE JSON object on the last line.
import { STATUS, lintReport, loadBaseline, saveBaselineSection } from "./lib.mjs";

const update = process.argv.includes("--update-baseline");
const report = lintReport();

function emit(status, detail, extra) {
  for (const line of String(detail ?? "").split("\n")) {
    if (line.trim()) console.log(`  ${line}`);
  }
  console.log(JSON.stringify({ name: "lint-ratchet", status, detail: detail ?? "", ...extra }));
  process.exit(status === STATUS.FAIL ? 1 : 0);
}

if (!report.ok) {
  emit(STATUS.FAIL, `eslint itself failed (exit ${report.code}):\n${report.raw}`);
}

const baseline = loadBaseline()?.lint ?? null;
const relBaseline = "scripts/guards/baseline.json";

// First run, or an explicit re-freeze: record reality instead of judging it.
if (update || !baseline) {
  saveBaselineSection("lint", {
    generatedBy: "scripts/guards/check-lint-ratchet.mjs",
    note: "Frozen lint debt. Counts may only go down; see the guard header for the rule.",
    errors: report.errors,
    warnings: report.warnings,
    byRule: report.byRule,
    files: report.files,
  });
  const reason = update ? "--update-baseline" : "no baseline found";
  const files = Object.keys(report.files).length;
  emit(
    baseline ? STATUS.PASS : STATUS.SKIP,
    `baseline written (${reason}): ${report.errors} errors / ${report.warnings} warnings ` +
      `across ${files} files -> ${relBaseline}`,
  );
}

// --- Ratchet -----------------------------------------------------------------
const regressions = [];
const newcomers = [];
for (const [file, now] of Object.entries(report.files)) {
  const before = baseline.files?.[file];
  if (!before) {
    // A file absent from the baseline must arrive clean; warnings are tolerated
    // because the repo itself configures react-refresh as a warning.
    if (now.errors > 0) newcomers.push(`${file}: ${now.errors} new error(s)`);
    continue;
  }
  if (now.errors > before.errors) {
    regressions.push(`${file}: ${before.errors} -> ${now.errors} errors`);
  }
}

const knownRules = baseline.byRule ?? {};
const newRules = Object.keys(report.byRule).filter((rule) => !(rule in knownRules));

const failures = [
  ...regressions.map((f) => `worse: ${f}`),
  ...newcomers.map((f) => `new dirty file: ${f}`),
  ...newRules.map((r) => `new lint rule appeared: ${r}`),
];

if (failures.length > 0) {
  const shown = failures
    .slice(0, 25)
    .map((f) => `x ${f}`)
    .join("\n");
  const more = failures.length > 25 ? `\n... and ${failures.length - 25} more` : "";
  emit(
    STATUS.FAIL,
    `lint debt increased (baseline ${baseline.errors} errors, now ${report.errors}).\n` +
      `${shown}${more}\nFix these files; do not raise the baseline.`,
    { regressions: failures.length },
  );
}

const warningsUp = report.warnings > (baseline.warnings ?? 0);
const errorsDown = report.errors < baseline.errors;

const note = [
  errorsDown
    ? `lint debt fell ${baseline.errors} -> ${report.errors}; run npm run verify:baseline to lock the gain`
    : `lint debt held at ${report.errors} errors / ${report.warnings} warnings`,
  `baseline: ${relBaseline}`,
  warningsUp ? `warning: warnings rose ${baseline.warnings} -> ${report.warnings}` : "",
]
  .filter(Boolean)
  .join("\n");

emit(errorsDown || warningsUp ? STATUS.WARN : STATUS.PASS, note, {
  errors: report.errors,
  warnings: report.warnings,
});

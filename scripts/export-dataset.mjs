#!/usr/bin/env node
/**
 * Exports the plans the app actually produced (plus their measured outcomes) as training data.
 *
 *   DATASET_EXPORT_TOKEN=… node scripts/export-dataset.mjs
 *   DATASET_BASE_URL=http://127.0.0.1:3999 DATASET_EXPORT_TOKEN=… node scripts/export-dataset.mjs
 *
 * Requires a running server with `DATASET_EXPORT_TOKEN` set, because the feature vector must be
 * built by the same TypeScript code the model uses at inference time (`features.ts`).
 *
 * Output:
 *   data/datasets/dataset-<timestamp>.jsonl          one JSON object per stored plan
 *   data/datasets/dataset-<timestamp>.report.json    coverage / quality summary
 *
 * The report is the honest gate for retraining: if `labelled` is small, the model has nothing
 * to learn from yet and `scripts/retrain.mjs` refuses to run.
 */
import fs from "node:fs";
import path from "node:path";

const BASE = (process.env.DATASET_BASE_URL ?? "http://127.0.0.1:3999").replace(/\/$/, "");
const TOKEN = process.env.DATASET_EXPORT_TOKEN ?? "";
const LIMIT = process.env.DATASET_LIMIT ?? "5000";
const OUT_DIR = process.env.DATASET_DIR ?? path.join(process.cwd(), "data", "datasets");

if (!TOKEN) {
  console.error("DATASET_EXPORT_TOKEN لازم است (همان مقداری که روی سرور تنظیم کرده‌اید).");
  process.exit(2);
}

const response = await fetch(`${BASE}/api/dataset-export?limit=${encodeURIComponent(LIMIT)}`, {
  headers: { "x-dataset-token": TOKEN },
}).catch((error) => {
  console.error(`اتصال به ${BASE} برقرار نشد: ${error.message}`);
  process.exit(2);
});

if (!response.ok) {
  const text = await response.text().catch(() => "");
  console.error(`HTTP ${response.status}: ${text.slice(0, 400)}`);
  process.exit(response.status === 403 ? 2 : 1);
}

const ndjson = await response.text();
const lines = ndjson.split("\n").filter((line) => line.trim().length > 0);
const rows = lines.map((line) => JSON.parse(line));

const labelled = rows.filter((row) => row.outcome && row.outcome.adherence != null);
const withBehaviour = rows.filter((row) => (row.usedSignals ?? []).length > 0);
const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const bySport = {};
for (const row of rows) {
  bySport[row.sport] = (bySport[row.sport] ?? 0) + 1;
}
const byArchetype = {};
for (const row of rows) {
  byArchetype[row.action?.archetypeId] = (byArchetype[row.action?.archetypeId] ?? 0) + 1;
}

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl: BASE,
  rows: rows.length,
  labelled: labelled.length,
  labelledShare: rows.length ? Number((labelled.length / rows.length).toFixed(3)) : 0,
  behaviourCoverage: rows.length ? Number((withBehaviour.length / rows.length).toFixed(3)) : 0,
  adherence: {
    mean: mean(labelled.map((row) => row.outcome.adherence)),
    median: median(labelled.map((row) => row.outcome.adherence)),
  },
  rpe: {
    mean: mean(labelled.map((row) => row.outcome.avgRpe).filter((value) => value != null)),
  },
  nutritionAdherence: {
    mean: mean(
      labelled.map((row) => row.outcome.nutritionAdherence).filter((value) => value != null),
    ),
  },
  completedCycles: labelled.filter((row) => row.outcome.completedCycle).length,
  bySport,
  byArchetype,
  modelVersions: [...new Set(rows.map((row) => row.modelVersion))].slice(0, 10),
};

fs.mkdirSync(OUT_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const datasetFile = path.join(OUT_DIR, `dataset-${stamp}.jsonl`);
const reportFile = path.join(OUT_DIR, `dataset-${stamp}.report.json`);
fs.writeFileSync(datasetFile, `${lines.join("\n")}\n`, "utf8");
fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(`\n✓ ${rows.length} ردیف نوشته شد → ${datasetFile}`);
console.log(`✓ گزارش کیفیت → ${reportFile}`);
console.log(
  `  برچسب‌خورده: ${report.labelled} (${Math.round(report.labelledShare * 100)}%) · پوشش رفتار: ${Math.round(
    report.behaviourCoverage * 100,
  )}% · adherence میانگین: ${
    report.adherence.mean === null ? "—" : report.adherence.mean.toFixed(3)
  }`,
);
console.log(`  رشته‌ها: ${JSON.stringify(bySport)}`);
if (report.labelled < 200) {
  console.log(
    "\n⚠ برچسب‌ها هنوز کم هستند. حداقل ۲۰۰ برنامهٔ برچسب‌خورده برای بازآموزی معنادار لازم است؛\n" +
      "  فعلاً داده جمع کنید (ثبت جلسه/وعده/چک‌این توسط ورزشکاران) و بعد دوباره اجرا کنید.",
  );
}

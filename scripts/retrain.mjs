#!/usr/bin/env node
/**
 * Retraining gate + driver.
 *
 *   node scripts/retrain.mjs --dataset data/datasets/dataset-….jsonl
 *   node scripts/retrain.mjs --dataset … --min-labelled 200 --rows 48000 --seed 42
 *
 * What it does:
 *   1. reads an exported dataset (see scripts/export-dataset.mjs),
 *   2. derives a calibration file from the labelled rows (where adherence really lands),
 *   3. refuses to train while there is not enough labelled data — retraining on five plans
 *      would only bake noise into the model,
 *   4. otherwise runs `python ml/train.py --calibration …` (same objective, same seed,
 *      adherence prior matched to reality) and then the TS/Python parity check.
 *
 * The model keeps learning the same coaching policy; real outcomes move the distribution the
 * policy is optimised against. That is the honest version of "train on real data" until the
 * logged volume supports supervised learning on outcomes alone.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : "true";
}

const datasetPath = arg("dataset", "");
const minLabelled = Number(arg("min-labelled", "200"));
const rows = Number(arg("rows", "48000"));
const seed = Number(arg("seed", "42"));
const python = arg("python", process.env.PYTHON ?? "python3");
const dryRun = process.argv.includes("--dry-run");
const outDir = arg("out", "");
const skipParity = process.argv.includes("--skip-parity");

if (!datasetPath || !fs.existsSync(datasetPath)) {
  console.error("--dataset <file.jsonl> لازم است (خروجی scripts/export-dataset.mjs).");
  process.exit(2);
}

const all = fs
  .readFileSync(datasetPath, "utf8")
  .split("\n")
  .filter((line) => line.trim())
  .map((line) => JSON.parse(line));

const labelled = all.filter((row) => row.outcome && typeof row.outcome.adherence === "number");
const withWindow = labelled.filter((row) => (row.outcome.windowDays ?? 0) >= 7);

const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;

console.log(`dataset: ${datasetPath}`);
console.log(
  `  rows: ${all.length} · labelled: ${labelled.length} · window ≥ 7d: ${withWindow.length}`,
);

if (withWindow.length < minLabelled) {
  console.error(
    `\n✗ داده کافی نیست: ${withWindow.length} برچسبِ معتبر داریم، حداقل ${minLabelled} لازم است.\n` +
      "  داده‌ی بیشتر از راه ثبت جلسه/وعده/چک‌این توسط ورزشکاران جمع می‌شود\n" +
      "  و با scripts/export-dataset.mjs دوباره استخراج می‌شود. (--min-labelled برای آستانه)",
  );
  process.exit(3);
}

const calibration = {
  source: path.basename(datasetPath),
  generatedAt: new Date().toISOString(),
  labelledRows: labelled.length,
  usedRows: withWindow.length,
  target_mean_adherence: Number(mean(withWindow.map((row) => row.outcome.adherence)).toFixed(4)),
  median_adherence: Number(
    [...withWindow.map((row) => row.outcome.adherence)]
      .sort((a, b) => a - b)
      [Math.floor(withWindow.length / 2)].toFixed(4),
  ),
  bySport: {},
};
for (const row of withWindow) {
  const bucket = (calibration.bySport[row.sport] ??= { rows: 0, total: 0 });
  bucket.rows += 1;
  bucket.total += row.outcome.adherence;
}
for (const [sport, bucket] of Object.entries(calibration.bySport)) {
  calibration.bySport[sport] = {
    rows: bucket.rows,
    meanAdherence: Number((bucket.total / bucket.rows).toFixed(4)),
  };
}

const calibrationPath = path.join(path.dirname(datasetPath), "calibration.json");
fs.writeFileSync(calibrationPath, `${JSON.stringify(calibration, null, 2)}\n`, "utf8");
console.log(`✓ calibration → ${calibrationPath}`);
console.log(`  target_mean_adherence = ${calibration.target_mean_adherence}`);

if (dryRun) {
  console.log("\n(dry-run) دستور بازآموزی اجرا نشد.");
  process.exit(0);
}

console.log(
  `\n> ${python} ml/train.py --rows ${rows} --seed ${seed} --calibration ${calibrationPath}`,
);
const trainArgs = [
  "ml/train.py",
  "--rows",
  String(rows),
  "--seed",
  String(seed),
  "--calibration",
  calibrationPath,
];
if (outDir) trainArgs.push("--out", outDir);
const train = spawnSync(python, trainArgs, { stdio: "inherit" });
if (train.status !== 0) {
  console.error(
    "\n✗ بازآموزی شکست خورد. اگر خطا مربوط به numpy/pandas/scikit-learn بود:\n" +
      "  python3 -m venv .venv && . .venv/bin/activate && pip install -r ml/requirements.txt",
  );
  process.exit(train.status ?? 1);
}

if (skipParity) {
  console.log("\n(--skip-parity) بررسی تطابق اجرا نشد — فقط برای آزمون مسیر بازآموزی.");
  process.exit(0);
}

console.log("\n> node scripts/check-model-parity.mjs");
const parity = spawnSync(process.execPath, ["scripts/check-model-parity.mjs"], {
  stdio: "inherit",
});
if (parity.status !== 0) {
  console.error("\n✗ parity شکست خورد؛ مدل جدید را دپلوی نکنید.");
  process.exit(parity.status ?? 1);
}

console.log(
  "\n✓ مدل جدید ساخته شد. قدم‌های بعد:\n" +
    "  1) src/services/recommendation/model/{model,metrics,parity_cases}.json را کامیت کنید\n" +
    "  2) modelVersion در model.json به‌طور خودکار از sha جدید ساخته می‌شود\n" +
    "  3) با scripts/deploy-cpanel.sh دپلوی کنید — اسنپشات‌های قدیمی دست‌نخورده می‌مانند",
);

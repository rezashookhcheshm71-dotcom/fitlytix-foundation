#!/usr/bin/env node
/**
 * How far is the data loop from being able to retrain honestly?
 *
 *   node scripts/loop-status.mjs                    # newest dataset in data/datasets
 *   node scripts/loop-status.mjs --file path.jsonl
 *   MIN_LABELLED=200 node scripts/loop-status.mjs
 *
 * Needs Node only (no Python), so it runs on the cPanel host.
 *
 * Why this exists: `scripts/retrain.mjs` refuses to train below 200 labelled rows, and the
 * export endpoint already writes a report. But the useful question is not "how many rows" —
 * it is "which athletes/archetypes are we blind on, and which input signals are we missing".
 * This prints that, plus the exact command to run once the gate opens.
 *
 * Exit code is always 0: it is a report, not a gate (retrain.mjs is the gate).
 */
import fs from "node:fs";
import path from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : "true";
};

const MIN_LABELLED = Number(process.env.MIN_LABELLED ?? arg("min-labelled", "200"));
const WINDOW = Number(arg("window", "7"));
const DATASET_DIR = process.env.DATASET_DIR ?? arg("dir", "data/datasets");

function newestDataset(dir) {
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((name) => /^dataset-.*\.jsonl$/.test(name))
    .map((name) => ({ name, mtime: fs.statSync(path.join(dir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return files.length ? path.join(dir, files[0].name) : null;
}

const explicit = arg("file", "");
const file = explicit ? explicit : newestDataset(DATASET_DIR);
if (!file || !fs.existsSync(file)) {
  console.error(
    `دیتاستی پیدا نشد. اول «bash scripts/daily-export.sh» را اجرا کنید (پوشه: ${DATASET_DIR}).`,
  );
  process.exit(0);
}

const rows = fs
  .readFileSync(file, "utf8")
  .split("\n")
  .filter((line) => line.trim())
  .map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  })
  .filter(Boolean);

const labelled = rows.filter((row) => row.outcome && typeof row.outcome.adherence === "number");
const mature = labelled.filter((row) => (row.outcome.windowDays ?? 0) >= WINDOW);
const share = (n) => (rows.length ? Math.round((n / rows.length) * 100) : 0);
const mean = (values) => {
  const clean = values.filter((value) => typeof value === "number" && !Number.isNaN(value));
  return clean.length ? clean.reduce((a, b) => a + b, 0) / clean.length : null;
};
const fmt = (value, digits = 2) => (value === null ? "—" : value.toFixed(digits));

const adherence = mean(labelled.map((row) => row.outcome.adherence));
const nutrition = mean(labelled.map((row) => row.outcome.nutritionAdherence));
const rpe = mean(labelled.map((row) => row.outcome.avgRpe));
const completedCycles = labelled.filter((row) => row.outcome.completedCycle).length;

console.log(`\nدیتاست: ${path.basename(file)}`);
console.log(
  `  ردیف: ${rows.length} · برچسب‌خورده: ${labelled.length} (${share(labelled.length)}%)`,
);
console.log(`  پنجرهٔ ≥ ${WINDOW} روز: ${mature.length}`);
console.log(
  `  پایبندی: میانگین ${fmt(adherence)} · تغذیه ${fmt(nutrition)} · RPE ${fmt(rpe)} · دورهٔ کامل ${completedCycles}`,
);

// --- per real archetype -----------------------------------------------------
const byArchetype = new Map();
for (const row of rows) {
  const id = row.action?.archetypeId ?? "—";
  const bucket = byArchetype.get(id) ?? {
    plans: 0,
    labelled: 0,
    adherence: [],
    nutrition: [],
    rpe: [],
  };
  bucket.plans += 1;
  if (row.outcome && typeof row.outcome.adherence === "number") {
    bucket.labelled += 1;
    bucket.adherence.push(row.outcome.adherence);
    if (row.outcome.nutritionAdherence != null)
      bucket.nutrition.push(row.outcome.nutritionAdherence);
    if (row.outcome.avgRpe != null) bucket.rpe.push(row.outcome.avgRpe);
  }
  byArchetype.set(id, bucket);
}

const table = [...byArchetype.entries()]
  .filter(([, b]) => b.labelled > 0)
  .map(([id, b]) => ({
    id,
    plans: b.plans,
    labelled: b.labelled,
    adherence: mean(b.adherence),
    nutrition: mean(b.nutrition),
    rpe: mean(b.rpe),
  }))
  .sort((a, b) => (b.adherence ?? 0) - (a.adherence ?? 0));

if (table.length) {
  console.log("\nآرکیتایپ (فقط آن‌هایی که دادهٔ واقعی دارند، مرتب بر پایبندی):");
  console.log("  آرکیتایپ                     برنامه  برچسب  پایبندی  تغذیه  RPE");
  for (const row of table) {
    console.log(
      `  ${row.id.padEnd(26).slice(0, 26)} ${String(row.plans).padStart(6)} ${String(row.labelled).padStart(6)} ${fmt(row.adherence).padStart(8)} ${fmt(row.nutrition).padStart(6)} ${fmt(row.rpe, 1).padStart(4)}`,
    );
  }
}

// --- which input signals are missing most ----------------------------------
const missed = new Map();
for (const row of rows) {
  for (const signal of row.missingSignals ?? []) {
    missed.set(signal, (missed.get(signal) ?? 0) + 1);
  }
}
const topMissed = [...missed.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
if (topMissed.length) {
  console.log("\nسیگنال‌هایی که بیشتر از همه کم است (همین را از ورزشکار بپرسید):");
  for (const [signal, count] of topMissed) {
    console.log(`  ${signal.padEnd(26)} ${String(count).padStart(5)} برنامه (${share(count)}%)`);
  }
}

// --- gate -------------------------------------------------------------------
const remaining = Math.max(0, MIN_LABELLED - labelled.length);
console.log("");
if (remaining === 0) {
  console.log(`وضعیت: آمادهٔ بازآموزی (${labelled.length} ≥ ${MIN_LABELLED}).`);
  console.log("  این را روی ماشینی که python3 دارد اجرا کنید (لوکال یا CI، نه هاست cPanel):");
  console.log(`  node scripts/retrain.mjs --dataset ${file} --min-labelled ${MIN_LABELLED}`);
} else {
  console.log(`وضعیت: هنوز آماده نیست — ${remaining} ردیف برچسب‌خوردهٔ دیگر لازم است.`);
  console.log("  تا آن موقع مدل عوض نمی‌شود؛ کاری که باید انجام شود ثبت داده توسط ورزشکار است.");
  console.log("  سادهٔ‌ترین مسیر: /athlete/program → کارت «جلسهٔ امروز» و «ثبت داده‌های امروز».");
}
console.log("");

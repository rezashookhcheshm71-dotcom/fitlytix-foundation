// Regenerates docs/recommendation-code-complete.md: every recommender source file
// concatenated in architecture order, so the code can be read/downloaded as one file.
// Usage: node scripts/bundle-recommender-code.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const FILES = [
  ["ml/requirements.txt", "text"],
  ["ml/fitlytix_ml/schema.py", "python"],
  ["ml/fitlytix_ml/simulator.py", "python"],
  ["ml/fitlytix_ml/export.py", "python"],
  ["ml/train.py", "python"],
  ["src/domain/recommendation.ts", "ts"],
  ["src/services/recommendation/modelTypes.ts", "ts"],
  ["src/services/recommendation/ensemble.ts", "ts"],
  ["src/services/recommendation/model.server.ts", "ts"],
  ["src/services/recommendation/schemaGuard.ts", "ts"],
  ["src/services/recommendation/features.ts", "ts"],
  ["src/services/recommendation/archetypes.ts", "ts"],
  ["src/services/recommendation/nutrition.ts", "ts"],
  ["src/services/recommendation/guardrails.ts", "ts"],
  ["src/services/recommendation/rules.ts", "ts"],
  ["src/services/recommendation/explain.ts", "ts"],
  ["src/services/recommendation/engine.ts", "ts"],
  ["src/services/recommendation/requestSchema.ts", "ts"],
  ["src/services/recommendation/store.server.ts", "ts"],
  ["src/services/recommendation/snapshots.server.ts", "ts"],
  ["src/services/recommendation/assembly.server.ts", "ts"],
  ["src/services/recommendation/userPlan.server.ts", "ts"],
  ["src/services/recommendation/presentation.ts", "ts"],
  ["src/hooks/use-plan.ts", "ts"],
  ["src/components/domain/plan-summary.tsx", "tsx"],
  ["src/routes/api/recommend.ts", "ts"],
  ["src/routes/api/plan.ts", "ts"],
  ["src/routes/recommendation.tsx", "tsx"],
  ["scripts/check-model-parity.mjs", "js"],
  ["scripts/verify-prod.mjs", "js"],
  ["database/migrations/mysql/003_fitlytix_recommendation_engine.sql", "sql"],
  ["database/migrations/mysql/004_recommendation_snapshots.sql", "sql"],
];

const head = `# کد کامل موتور پیشنهاد برنامه FitLytix

> این فایل **تولیدشده** است: \`node scripts/bundle-recommender-code.mjs\`. نسخهٔ مرجع، فایل‌های
> واقعی در \`ml/\` و \`src/services/recommendation/\` هستند.

همهٔ سورس موتور به‌ترتیب معماری کنار هم آمده تا لازم نباشد بین پوشه‌ها بگردید.
\`src/services/recommendation/model/model.json\` (حدود ۱.۳MB) خروجی آموزش است، نه کد؛
برای ساختنش \`python ml/train.py\` و گزارش ارزیابی آن در \`model/metrics.json\`.

## فهرست

`;

const parts = [head];
FILES.forEach(([path], i) => parts.push(`${i + 1}. \`${path}\`\n`));

FILES.forEach(([path, lang], i) => {
  const code = readFileSync(join(root, path), "utf8").replace(/\n+$/, "");
  parts.push(`\n---\n\n## ${i + 1}) \`${path}\`\n\n\`\`\`${lang}\n${code}\n\`\`\`\n`);
});

const target = join(root, "docs/recommendation-code-complete.md");
writeFileSync(target, parts.join(""));
console.log(
  `wrote ${target} (${FILES.length} files, ${Math.round(Buffer.byteLength(parts.join("")) / 1024)} KB)`,
);

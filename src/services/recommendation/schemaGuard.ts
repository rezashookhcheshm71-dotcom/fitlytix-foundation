/**
 * Runtime contract checks between the trained artefact and the TypeScript layer.
 *
 * A retrained model that introduces an unknown archetype (or a feature the runtime
 * cannot fill) must degrade loudly in logs instead of producing a broken plan.
 * These are cheap checks executed once per server process.
 */
import type { FitlytixModelFile } from "./modelTypes";
import { ARCHETYPE_TEMPLATES } from "./archetypes";

const VALID_DURATIONS = ["1", "3", "6", "12"];
const VALID_NUTRITION = [
  "fat_loss_deficit",
  "lean_gain",
  "performance_fuel",
  "maintenance",
  "recomp",
];

export function validateModel(model: FitlytixModelFile): string[] {
  const issues: string[] = [];
  const missingFill = model.features.filter((f) => typeof model.fillValues[f] !== "number");
  if (missingFill.length > 0)
    issues.push(`features without fill value: ${missingFill.slice(0, 5).join(", ")}`);

  for (const sport of model.sports) {
    const classifier = model.models.program[sport];
    if (!classifier) {
      issues.push(`no program model for sport ${sport}`);
      continue;
    }
    if (classifier.trees.length === 0) issues.push(`empty tree ensemble for ${sport}`);
    const archetypes = model.archetypes[sport] ?? [];
    if (archetypes.length === 0) issues.push(`no archetypes for ${sport}`);
    for (const archetype of archetypes) {
      if (!ARCHETYPE_TEMPLATES[archetype.id])
        issues.push(`archetype ${archetype.id} has no session template`);
      if (!classifier.classes.includes(archetype.id))
        issues.push(`archetype ${archetype.id} missing from ${sport} classifier`);
    }
  }

  const unknownDuration = model.models.duration.classes.filter((c) => !VALID_DURATIONS.includes(c));
  if (unknownDuration.length > 0)
    issues.push(`unknown duration classes: ${unknownDuration.join(", ")}`);

  const unknownNutrition = model.models.nutrition.classes.filter(
    (c) => !VALID_NUTRITION.includes(c),
  );
  if (unknownNutrition.length > 0)
    issues.push(`unknown nutrition classes: ${unknownNutrition.join(", ")}`);

  return issues;
}

let warned = false;

export function runSchemaGuard(model: FitlytixModelFile): void {
  const issues = validateModel(model);
  if (issues.length > 0 && !warned) {
    warned = true;
    console.warn(
      `[recommendation] model/runtime contract issues (${issues.length}). The engine will fall back to safe defaults where needed:\n` +
        issues.map((i) => `  - ${i}`).join("\n"),
    );
  }
}

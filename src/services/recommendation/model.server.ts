/**
 * Model loader — server-side singleton.
 *
 * The JSON artefact is imported statically so Nitro bundles it into the Node server
 * (nothing to copy to cPanel by hand) and parsed exactly once per process.
 * Import this module only from server code (`api/*`, `.server.ts`); it must never
 * reach the browser bundle.
 */
import rawModel from "./model/model.json";
import metricsJson from "./model/metrics.json";
import type { FitlytixModelFile, ModelMetricsFile } from "./modelTypes";
import { runSchemaGuard } from "./schemaGuard";

const model = rawModel as unknown as FitlytixModelFile;
const metrics = metricsJson as unknown as ModelMetricsFile;

let validated = false;

export function getModel(): FitlytixModelFile {
  if (!validated) {
    if (model.format !== "fitlytix-gbdt-json") {
      throw new Error(`MODEL_FORMAT_UNSUPPORTED:${model.format}`);
    }
    runSchemaGuard(model);
    validated = true;
  }
  return model;
}

export function getModelMetrics(): ModelMetricsFile {
  return metrics;
}

export function getModelInfo() {
  const m = getModel();
  return {
    version: m.modelVersion,
    trainedAt: m.trainedAt,
    trainingData: m.trainingData,
    schemaVersion: m.schemaVersion,
    rows: m.rows,
    featureCount: m.features.length,
    sports: m.sports,
  };
}

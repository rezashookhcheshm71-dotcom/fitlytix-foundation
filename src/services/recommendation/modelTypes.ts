/**
 * Generated model artefact types.
 *
 * `model/model.json` is produced by `ml/train.py` and committed so the server can
 * start with no build step, no Python and no external inference call.
 */
import type { JsonEnsembleModel } from "./ensemble";

export interface JsonArchetype {
  id: string;
  labelFa: string;
  summaryFa: string;
  focus: Record<string, number>;
  demand: Record<string, number>;
  frequency: number;
  minutes: number;
  tags: string[];
}

export interface FitlytixModelFile {
  format: string;
  schemaVersion: number;
  modelVersion: string;
  trainedAt: string;
  /** "simulated" until retrained on logged recommendation_outcomes; surfaced in every response. */
  trainingData: string;
  seed: number;
  rows: number;
  sports: string[];
  features: string[];
  featureGroups: { name: string; description: string }[];
  fillValues: Record<string, number>;
  encodings: Record<string, Record<string, number>>;
  durationMonths: number[];
  nutritionStrategies: string[];
  coachingModes: string[];
  archetypes: Record<string, JsonArchetype[]>;
  models: {
    program: Record<string, JsonEnsembleModel>;
    nutrition: JsonEnsembleModel;
    duration: JsonEnsembleModel;
    coaching: JsonEnsembleModel;
    sessions: JsonEnsembleModel;
    adherence: JsonEnsembleModel;
  };
}

export interface ModelMetricsFile {
  model: {
    version: string;
    trainedAt: string;
    bytes: number;
    sha256: string;
  };
  rows: number;
  testRows: number;
  program: Record<
    string,
    {
      accuracy: number;
      top2Accuracy: number;
      baselineMajority: number;
      macroF1: number;
      rows: number;
      topFeatures: { name: string; importance: number }[];
    }
  >;
  nutrition: { accuracy: number; top2Accuracy: number; macroF1: number };
  duration: { accuracy: number; top2Accuracy: number; macroF1: number };
  coaching: { accuracy: number; top2Accuracy: number; macroF1: number };
  sessions: { mae: number; r2: number };
  adherence: { mae: number; r2: number; calibrationMaxGap: number };
}

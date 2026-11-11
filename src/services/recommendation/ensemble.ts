/**
 * JSON tree-ensemble interpreter.
 *
 * This is the *only* place model maths lives at runtime. It mirrors sklearn's
 * GradientBoosting prediction exactly:
 *
 *   raw_class = intercept[class] + learningRate * Σ_stages tree[stage][class](x)
 *   classification → softmax(raw)  |  sigmoid(raw[0])  |  regression → raw[0]
 *
 * No dependencies, no I/O — importable from a Node script, a server route or a
 * worker. Parity with sklearn is asserted by `scripts/check-model-parity.mjs`.
 */

export interface JsonTree {
  feature: number[];
  threshold: number[];
  left: number[];
  right: number[];
  value: number[];
}

export interface JsonEnsembleModel {
  task: "classification" | "regression";
  link: "softmax" | "sigmoid" | "identity";
  classes: string[];
  learningRate: number;
  intercept: number[];
  trees: JsonTree[][];
  featureImportance?: number[];
}

export interface ClassificationResult {
  classes: string[];
  probabilities: number[];
  best: string;
  bestIndex: number;
  confidence: number;
}

const MISSING = -1;

function treeOutput(tree: JsonTree, features: readonly number[]): number {
  let node = 0;
  // Depth is bounded by the exported tree; guard against malformed artefacts.
  for (let step = 0; step < 64; step += 1) {
    const left = tree.left[node];
    if (left === undefined || left === MISSING) {
      return tree.value[node] ?? 0;
    }
    const featureIndex = tree.feature[node];
    const threshold = tree.threshold[node];
    const raw = featureIndex === undefined ? 0 : features[featureIndex];
    const value = raw === undefined || !Number.isFinite(raw) ? 0 : raw;
    node = value <= (threshold ?? 0) ? left : (tree.right[node] ?? left);
  }
  return 0;
}

/** Raw (pre-link) score per class, or a single value for regressors. */
export function rawScore(model: JsonEnsembleModel, features: readonly number[]): number[] {
  const sums = model.intercept.map((v) => v);
  for (const stage of model.trees) {
    for (let classIndex = 0; classIndex < sums.length; classIndex += 1) {
      const tree = stage[classIndex];
      if (!tree) continue;
      sums[classIndex] = (sums[classIndex] ?? 0) + model.learningRate * treeOutput(tree, features);
    }
  }
  return sums;
}

function softmax(values: number[]): number[] {
  const max = Math.max(...values);
  const exps = values.map((v) => Math.exp(v - max));
  const total = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((v) => v / total);
}

export function classify(
  model: JsonEnsembleModel,
  features: readonly number[],
): ClassificationResult {
  const raw = rawScore(model, features);
  let probabilities: number[];
  if (model.link === "softmax") {
    probabilities = softmax(raw);
  } else if (model.link === "sigmoid") {
    const positive = 1 / (1 + Math.exp(-(raw[0] ?? 0)));
    probabilities = [1 - positive, positive];
  } else {
    throw new Error(`classify() called on a ${model.link} model`);
  }

  let bestIndex = 0;
  for (let i = 1; i < probabilities.length; i += 1) {
    if ((probabilities[i] ?? 0) > (probabilities[bestIndex] ?? 0)) bestIndex = i;
  }
  return {
    classes: model.classes,
    probabilities,
    best: model.classes[bestIndex] ?? model.classes[0] ?? "",
    bestIndex,
    confidence: probabilities[bestIndex] ?? 0,
  };
}

export function regress(model: JsonEnsembleModel, features: readonly number[]): number {
  return rawScore(model, features)[0] ?? 0;
}

/** Probability of a specific class label, or 0 when the label is unknown to the model. */
export function probabilityOf(
  model: JsonEnsembleModel,
  features: readonly number[],
  className: string,
): number {
  const result = classify(model, features);
  const index = result.classes.indexOf(className);
  return index >= 0 ? (result.probabilities[index] ?? 0) : 0;
}

/** Ranked class/probability pairs, most likely first. */
export function ranked(
  model: JsonEnsembleModel,
  features: readonly number[],
): { className: string; probability: number }[] {
  const result = classify(model, features);
  return result.classes
    .map((className, index) => ({ className, probability: result.probabilities[index] ?? 0 }))
    .sort((a, b) => b.probability - a.probability);
}

"""
Serialise scikit-learn gradient-boosted trees to a portable JSON format.

The runtime interpreter lives in `src/services/recommendation/ensemble.ts` and has
no Python dependency. Exporting exact tree structure (rather than pickles or ONNX)
keeps the deployed Node server dependency-free and makes the model auditable.

Parity is verified numerically by `scripts/check-model-parity.mjs` against
`parity_cases.json` produced during training (max abs error < 1e-6).
"""

from __future__ import annotations

from typing import Any, Dict, List

import numpy as np


def _tree_to_dict(estimator) -> Dict[str, List[float]]:
    tree = estimator.tree_
    return {
        "feature": [int(v) for v in tree.feature],
        "threshold": [round(float(v), 7) for v in tree.threshold],
        "left": [int(v) for v in tree.children_left],
        "right": [int(v) for v in tree.children_right],
        "value": [round(float(v), 7) for v in tree.value[:, 0, 0]],
    }


def _raw_init(model, n_features: int) -> np.ndarray:
    """Exact sklearn initial raw prediction (log priors / mean)."""
    zeros = np.zeros((1, n_features), dtype=float)
    init = model._raw_predict_init(zeros)  # noqa: SLF001 - stable numeric contract
    return np.asarray(init, dtype=float).ravel()


def _class_label(value: Any) -> str:
    """Keep numeric classes human-readable: 3 instead of 3.0."""
    if isinstance(value, (int, np.integer)):
        return str(int(value))
    if isinstance(value, (float, np.floating)) and float(value).is_integer():
        return str(int(value))
    return str(value)


def _importances(model) -> List[float]:
    """Normalised split importances so the runtime can rank features for explanations."""
    values = getattr(model, "feature_importances_", None)
    if values is None:
        return []
    return [round(float(v), 6) for v in values]


def export_classifier(model, n_features: int) -> Dict[str, Any]:
    classes = [_class_label(c) for c in model.classes_]
    learning_rate = float(model.learning_rate)
    intercept = [round(float(v), 7) for v in _raw_init(model, n_features)]
    estimators = model.estimators_

    if len(classes) == 2:
        # sklearn fits ONE tree per stage for the positive class.
        trees = [[_tree_to_dict(stage[0])] for stage in estimators]
        return {
            "task": "classification",
            "link": "sigmoid",
            "classes": classes,
            "learningRate": learning_rate,
            "featureImportance": _importances(model),
            "intercept": intercept[:1],
            "trees": trees,
        }

    trees = [
        [_tree_to_dict(stage[class_index]) for class_index in range(len(classes))]
        for stage in estimators
    ]
    return {
        "task": "classification",
        "link": "softmax",
        "classes": classes,
        "learningRate": learning_rate,
        "featureImportance": _importances(model),
        "intercept": intercept,
        "trees": trees,
    }


def export_regressor(model, n_features: int) -> Dict[str, Any]:
    return {
        "task": "regression",
        "link": "identity",
        "classes": [],
        "learningRate": float(model.learning_rate),
        "featureImportance": _importances(model),
        "intercept": [round(float(v), 7) for v in _raw_init(model, n_features)],
        "trees": [[_tree_to_dict(stage[0])] for stage in model.estimators_],
    }


def export_model_bundle(
    *,
    program_models: Dict[str, Any],
    nutrition_model,
    duration_model,
    coaching_model,
    sessions_model,
    adherence_model,
    n_features: int,
) -> Dict[str, Any]:
    return {
        "program": {sport: export_classifier(m, n_features) for sport, m in program_models.items()},
        "nutrition": export_classifier(nutrition_model, n_features),
        "duration": export_classifier(duration_model, n_features),
        "coaching": export_classifier(coaching_model, n_features),
        "sessions": export_regressor(sessions_model, n_features),
        "adherence": export_regressor(adherence_model, n_features),
    }

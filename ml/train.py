#!/usr/bin/env python3
"""
FitLytix recommendation engine — training CLI.

Usage
-----
    python -m venv .venv && . .venv/bin/activate
    pip install -r ml/requirements.txt
    python ml/train.py --rows 48000 --seed 42

Outputs (committed, consumed by the Node runtime):
    src/services/recommendation/model/model.json         tree ensemble, JSON
    src/services/recommendation/model/metrics.json       evaluation report
    src/services/recommendation/model/parity_cases.json  200 rows + expected outputs

The report is deliberately honest: metrics measure how well the distilled policy
reproduces the simulated coaching objective on held-out athletes. They are a
pipeline sanity check, **not** evidence of real-world effectiveness. Replace the
simulator with logged outcomes (`recommendation_events`) to make them meaningful.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import subprocess
import sys
from typing import Any, Dict, List

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fitlytix_ml import schema  # noqa: E402
from fitlytix_ml.export import export_classifier, export_model_bundle, export_regressor  # noqa: E402
from fitlytix_ml.simulator import simulate_cohort  # noqa: E402
from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor  # noqa: E402
from sklearn.metrics import (  # noqa: E402
    accuracy_score,
    confusion_matrix,
    f1_score,
    log_loss,
    mean_absolute_error,
    mean_squared_error,
    r2_score,
    top_k_accuracy_score,
)
from sklearn.model_selection import train_test_split  # noqa: E402

MODEL_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "src",
    "services",
    "recommendation",
    "model",
)

CLASSIFIER_PARAMS = dict(
    n_estimators=90,
    max_depth=3,
    learning_rate=0.09,
    subsample=0.9,
    min_samples_leaf=25,
    random_state=0,
)
REGRESSOR_PARAMS = dict(
    n_estimators=120,
    max_depth=3,
    learning_rate=0.08,
    subsample=0.9,
    min_samples_leaf=25,
    random_state=0,
)


def _classifier() -> GradientBoostingClassifier:
    return GradientBoostingClassifier(**CLASSIFIER_PARAMS)


def _regressor() -> GradientBoostingRegressor:
    return GradientBoostingRegressor(**REGRESSOR_PARAMS)


def _git_sha() -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            stderr=subprocess.DEVNULL,
        ).decode().strip()
    except Exception:  # pragma: no cover - non-git environments
        return "nogit"


def _label_distribution(values: np.ndarray) -> Dict[str, int]:
    classes, counts = np.unique(values.astype(str), return_counts=True)
    return {c: int(n) for c, n in sorted(zip(classes, counts), key=lambda kv: -kv[1])}


def evaluate_classifier(model, X_test, y_test, labels: List[str]) -> Dict[str, Any]:
    proba = model.predict_proba(X_test)
    pred = model.classes_[proba.argmax(axis=1)]
    majority = np.full(len(y_test), np.bincount(np.unique(y_test, return_inverse=True)[1]).argmax())
    unique = list(model.classes_)
    majority_label = unique[int(np.bincount(np.unique(y_test, return_inverse=True)[1]).argmax())]
    out: Dict[str, Any] = {
        "rows": int(len(y_test)),
        "classes": [str(c) for c in unique],
        "accuracy": round(float(accuracy_score(y_test, pred)), 4),
        "baselineMajority": round(float(accuracy_score(y_test, np.full(len(y_test), majority_label))), 4),
        "macroF1": round(float(f1_score(y_test, pred, average="macro", zero_division=0)), 4),
        "logLoss": round(float(log_loss(y_test, proba, labels=unique)), 4),
        "predictedDistribution": _label_distribution(pred),
        "actualDistribution": _label_distribution(y_test),
        "confusion": confusion_matrix(y_test, pred, labels=unique).tolist(),
    }
    if len(unique) > 2:
        out["top2Accuracy"] = round(float(top_k_accuracy_score(y_test, proba, k=2, labels=unique)), 4)
    else:
        out["top2Accuracy"] = 1.0
    del majority
    return out


def evaluate_regressor(model, X_test, y_test, clip: tuple[float, float] | None = None) -> Dict[str, Any]:
    pred = model.predict(X_test)
    if clip:
        pred = np.clip(pred, *clip)
    rmse = float(np.sqrt(mean_squared_error(y_test, pred)))
    return {
        "rows": int(len(y_test)),
        "mae": round(float(mean_absolute_error(y_test, pred)), 4),
        "rmse": round(rmse, 4),
        "r2": round(float(r2_score(y_test, pred)), 4),
        "predictedMean": round(float(pred.mean()), 4),
        "actualMean": round(float(y_test.mean()), 4),
    }


def calibration_report(pred: np.ndarray, actual: np.ndarray, bins: int = 5) -> List[Dict[str, float]]:
    order = np.argsort(pred)
    chunks = np.array_split(order, bins)
    out = []
    for chunk in chunks:
        if len(chunk) == 0:
            continue
        out.append(
            {
                "predicted": round(float(pred[chunk].mean()), 3),
                "actual": round(float(actual[chunk].mean()), 3),
                "share": round(float(len(chunk) / len(pred)), 3),
            }
        )
    return out


def top_features(model, k: int = 12) -> List[Dict[str, Any]]:
    importances = np.asarray(model.feature_importances_)
    order = np.argsort(-importances)[:k]
    return [
        {"name": schema.FEATURES[i], "importance": round(float(importances[i]), 4)}
        for i in order
    ]


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the FitLytix plan recommender")
    parser.add_argument("--rows", type=int, default=48000, help="synthetic cohort size")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--test-size", type=float, default=0.2)
    parser.add_argument("--out", default=MODEL_DIR)
    parser.add_argument("--parity-cases", type=int, default=200)
    args = parser.parse_args()

    schema.validate_schema()
    print(f"[1/5] Simulating {args.rows:,} athletes (seed={args.seed})…")
    cohort = simulate_cohort(args.rows, args.seed)
    X, diag = cohort.X, cohort.diagnostics

    # Stratify on sport × program so every archetype is represented in the test set.
    strat = diag["sport"].astype(str) + "|" + cohort.y_program.astype(str)
    idx_train, idx_test = train_test_split(
        np.arange(len(X)),
        test_size=args.test_size,
        random_state=args.seed,
        stratify=strat,
    )
    X_train, X_test = X.iloc[idx_train], X.iloc[idx_test]

    def split(values: np.ndarray):
        return values[idx_train], values[idx_test]

    y_prog_train, y_prog_test = split(cohort.y_program)
    y_nut_train, y_nut_test = split(cohort.y_nutrition)
    y_dur_train, y_dur_test = split(cohort.y_duration)
    y_coach_train, y_coach_test = split(cohort.y_coaching)
    y_sess_train, y_sess_test = split(cohort.y_sessions)
    y_adh_train, y_adh_test = split(cohort.y_adherence)

    sport_train = diag["sport"].to_numpy()[idx_train]
    sport_test = diag["sport"].to_numpy()[idx_test]

    n_features = X.shape[1]
    metrics: Dict[str, Any] = {
        "schemaVersion": schema.MODEL_SCHEMA_VERSION,
        "rows": int(len(X)),
        "trainRows": int(len(X_train)),
        "testRows": int(len(X_test)),
        "seed": args.seed,
        "features": len(schema.FEATURES),
        "labels": {
            "program": _label_distribution(cohort.y_program),
            "nutrition": _label_distribution(cohort.y_nutrition),
            "duration": _label_distribution(cohort.y_duration),
            "coaching": _label_distribution(cohort.y_coaching),
        },
    }

    print("[2/5] Training per-sport program policy…")
    program_models = {}
    program_metrics = {}
    for sport in schema.SPORTS:
        train_mask = sport_train == sport
        test_mask = sport_test == sport
        model = _classifier()
        model.fit(X_train[train_mask], y_prog_train[train_mask])
        program_models[sport] = model
        program_metrics[sport] = evaluate_classifier(
            model, X_test[test_mask], y_prog_test[test_mask], schema.archetype_ids(sport)
        )
        program_metrics[sport]["topFeatures"] = top_features(model)
        print(
            f"      {sport:<13} acc={program_metrics[sport]['accuracy']:.3f} "
            f"top2={program_metrics[sport]['top2Accuracy']:.3f} "
            f"(majority {program_metrics[sport]['baselineMajority']:.3f})"
        )
    metrics["program"] = program_metrics

    print("[3/5] Training nutrition / duration / coaching classifiers…")
    nutrition_model = _classifier().fit(X_train, y_nut_train)
    duration_model = _classifier().fit(X_train, y_dur_train)
    coaching_model = _classifier().fit(X_train, y_coach_train)
    metrics["nutrition"] = evaluate_classifier(nutrition_model, X_test, y_nut_test, schema.NUTRITION_STRATEGIES)
    metrics["nutrition"]["topFeatures"] = top_features(nutrition_model)
    metrics["duration"] = evaluate_classifier(duration_model, X_test, y_dur_test, schema.DURATION_MONTHS)
    metrics["duration"]["topFeatures"] = top_features(duration_model)
    metrics["coaching"] = evaluate_classifier(coaching_model, X_test, y_coach_test, schema.COACHING_MODES)
    metrics["coaching"]["topFeatures"] = top_features(coaching_model)
    for key in ("nutrition", "duration", "coaching"):
        print(
            f"      {key:<10} acc={metrics[key]['accuracy']:.3f} "
            f"top2={metrics[key]['top2Accuracy']:.3f} macroF1={metrics[key]['macroF1']:.3f}"
        )

    print("[4/5] Training session-load and adherence regressors…")
    sessions_model = _regressor().fit(X_train, y_sess_train)
    adherence_model = _regressor().fit(X_train, y_adh_train)
    metrics["sessions"] = evaluate_regressor(sessions_model, X_test, y_sess_test, clip=(1, 7))
    metrics["adherence"] = evaluate_regressor(adherence_model, X_test, y_adh_test, clip=(0.02, 0.99))
    metrics["adherence"]["topFeatures"] = top_features(adherence_model)
    pred_adh = np.clip(adherence_model.predict(X_test), 0.02, 0.99)
    metrics["adherence"]["calibration"] = calibration_report(pred_adh, y_adh_test)
    metrics["adherence"]["calibrationMaxGap"] = round(
        max(abs(b["predicted"] - b["actual"]) for b in metrics["adherence"]["calibration"]), 3
    )
    print(
        f"      sessions  MAE={metrics['sessions']['mae']:.3f} R2={metrics['sessions']['r2']:.3f} | "
        f"adherence MAE={metrics['adherence']['mae']:.3f} R2={metrics['adherence']['r2']:.3f} "
        f"calibGap={metrics['adherence']['calibrationMaxGap']:.3f}"
    )

    print("[5/5] Exporting JSON model for the Node runtime…")
    bundle = export_model_bundle(
        program_models=program_models,
        nutrition_model=nutrition_model,
        duration_model=duration_model,
        coaching_model=coaching_model,
        sessions_model=sessions_model,
        adherence_model=adherence_model,
        n_features=n_features,
    )

    trained_at = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
    payload = {
        "format": schema.MODEL_FORMAT,
        "schemaVersion": schema.MODEL_SCHEMA_VERSION,
        "modelVersion": f"{dt.datetime.now(dt.timezone.utc):%Y.%m.%d}-{_git_sha()}",
        "trainedAt": trained_at,
        "trainingData": "simulated",  # switch to "logged" once trained on recommendation_outcomes
        "seed": args.seed,
        "rows": int(len(X)),
        "sports": schema.SPORTS,
        "features": schema.FEATURES,
        "featureGroups": [{"name": n, "description": d} for n, d in schema.FEATURE_SPECS],
        "fillValues": schema.FILL_VALUES,
        "encodings": schema.ENCODINGS,
        "durationMonths": schema.DURATION_MONTHS,
        "nutritionStrategies": schema.NUTRITION_STRATEGIES,
        "coachingModes": schema.COACHING_MODES,
        "archetypes": {
            sport: [
                {
                    "id": a.id,
                    "labelFa": a.label_fa,
                    "summaryFa": a.summary_fa,
                    "focus": a.focus,
                    "demand": a.demand,
                    "frequency": a.frequency,
                    "minutes": a.minutes,
                    "tags": a.tags,
                }
                for a in schema.ARCHETYPES[sport]
            ]
            for sport in schema.SPORTS
        },
        "models": bundle,
    }

    os.makedirs(args.out, exist_ok=True)
    model_json = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    model_bytes = model_json.encode("utf-8")
    with open(os.path.join(args.out, "model.json"), "wb") as fh:
        fh.write(model_bytes)

    metrics["model"] = {
        "version": payload["modelVersion"],
        "trainedAt": trained_at,
        "bytes": len(model_bytes),
        "sha256": hashlib.sha256(model_bytes).hexdigest(),
        "gitSha": _git_sha(),
        "estimator": {
            "family": "gradient_boosting_trees",
            "classifier": CLASSIFIER_PARAMS,
            "regressor": REGRESSOR_PARAMS,
        },
    }

    # Parity fixtures: replay raw feature rows through the TS interpreter and
    # compare against sklearn's own probabilities.
    rng = np.random.default_rng(args.seed + 7)
    position = rng.choice(len(X_test), size=min(args.parity_cases, len(X_test)), replace=False)
    parity = []
    for pos in position:
        row = X_test.iloc[[int(pos)]]
        sport = str(sport_test[int(pos)])
        program_model = program_models[sport]
        parity.append(
            {
                "features": [round(float(v), 6) for v in row.to_numpy()[0]],
                "sport": str(sport),
                "expected": {
                    "program": {
                        "classes": [str(c) for c in program_model.classes_],
                        "probabilities": [round(float(v), 6) for v in program_model.predict_proba(row)[0]],
                    },
                    "nutrition": {
                        "classes": [str(c) for c in nutrition_model.classes_],
                        "probabilities": [round(float(v), 6) for v in nutrition_model.predict_proba(row)[0]],
                    },
                    "duration": {
                        "classes": [str(c) for c in duration_model.classes_],
                        "probabilities": [round(float(v), 6) for v in duration_model.predict_proba(row)[0]],
                    },
                    "coaching": {
                        "classes": [str(c) for c in coaching_model.classes_],
                        "probabilities": [round(float(v), 6) for v in coaching_model.predict_proba(row)[0]],
                    },
                    "sessions": round(float(sessions_model.predict(row)[0]), 6),
                    "adherence": round(float(adherence_model.predict(row)[0]), 6),
                },
            }
        )
    with open(os.path.join(args.out, "parity_cases.json"), "w", encoding="utf-8") as fh:
        json.dump({"modelVersion": payload["modelVersion"], "cases": parity}, fh, ensure_ascii=False)

    with open(os.path.join(args.out, "metrics.json"), "w", encoding="utf-8") as fh:
        json.dump(metrics, fh, ensure_ascii=False, indent=2)

    print(f"\nModel written to {args.out}")
    print(f"  model.json         {len(model_bytes) / 1024:.0f} KB")
    print(f"  metrics.json       {os.path.getsize(os.path.join(args.out, 'metrics.json')) / 1024:.0f} KB")
    print(f"  parity_cases.json  {os.path.getsize(os.path.join(args.out, 'parity_cases.json')) / 1024:.0f} KB")
    print("\nNow verify the TypeScript interpreter:")
    print("  node --experimental-strip-types scripts/check-model-parity.mjs")


if __name__ == "__main__":
    main()

"""
Synthetic coaching cohort simulator for FitLytix.

Why a simulator?
----------------
A recommender needs (context -> action -> reward) triples. A brand-new platform has
none yet, so we bootstrap the policy by *simulating* a plausible athlete population
and the outcome of every candidate plan for each athlete, then let gradient-boosted
trees learn a smooth mapping from observable inputs to the best action. This is
offline policy learning / behaviour cloning against a domain model — not a claim
that the model knows real-world outcomes.

The generator encodes documented coaching priors (capacity vs. demand, recovery
budget, complexity vs. experience, adherence decay, injury risk, goal alignment)
plus explicit noise. `ml/README.md` explains how to replace it with real logged
outcomes (`recommendation_events` in MySQL) once the platform has traffic.

Every latent trait is only *partially* observable; the observable proxies carry
measurement noise, so the models must generalise rather than memorise. That is what
keeps reported metrics meaningful as a sanity check of the pipeline, not a promise.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Tuple

import numpy as np
import pandas as pd

from . import schema


def _sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-np.clip(x, -30, 30)))


def _clip01(x: np.ndarray) -> np.ndarray:
    return np.clip(x, 0.02, 0.985)


@dataclass
class Cohort:
    X: pd.DataFrame          # observable features, schema.FEATURES order
    y_program: np.ndarray    # archetype id per row
    y_nutrition: np.ndarray  # nutrition strategy id per row
    y_duration: np.ndarray   # months
    y_sessions: np.ndarray   # weekly sessions (float, model regresses)
    y_adherence: np.ndarray  # expected 90-day adherence under the chosen plan
    y_coaching: np.ndarray   # ai | hybrid | human
    diagnostics: pd.DataFrame


SPORT_PRIORS = {
    "crossfit": 0.30,
    "bodybuilding": 0.27,
    "running": 0.16,
    "functional": 0.14,
    "hyrox": 0.13,
}

GOAL_PRIORS: Dict[str, Dict[str, float]] = {
    "crossfit": {"strength": 0.30, "muscle": 0.08, "fat_loss": 0.12, "endurance": 0.18, "competition": 0.22, "health": 0.10},
    "bodybuilding": {"strength": 0.15, "muscle": 0.48, "fat_loss": 0.24, "endurance": 0.02, "competition": 0.03, "health": 0.08},
    "running": {"strength": 0.04, "muscle": 0.02, "fat_loss": 0.16, "endurance": 0.52, "competition": 0.14, "health": 0.12},
    "functional": {"strength": 0.18, "muscle": 0.10, "fat_loss": 0.28, "endurance": 0.14, "competition": 0.04, "health": 0.26},
    "hyrox": {"strength": 0.14, "muscle": 0.05, "fat_loss": 0.18, "endurance": 0.28, "competition": 0.28, "health": 0.07},
}

# Secondary-goal flags and how often they are chosen per sport.
SECONDARY_PRIORS: Dict[str, float] = {
    "wants_mobility": 0.22,
    "wants_recovery": 0.20,
    "wants_consistency": 0.26,
    "wants_skill": 0.20,
}

NUTRITION_STRATEGIES = schema.NUTRITION_STRATEGIES


def _weighted_choice(rng: np.random.Generator, n: int, weights: Dict[str, float]) -> np.ndarray:
    keys = list(weights)
    p = np.array([weights[k] for k in keys], dtype=float)
    p = p / p.sum()
    return rng.choice(np.array(keys, dtype=object), size=n, p=p)


def _simulate_sport(rng: np.random.Generator, sport: str, n: int) -> Tuple[pd.DataFrame, Dict[str, np.ndarray], pd.DataFrame]:
    """Simulate n athletes of one sport and label every candidate plan."""
    # ---- demographics ------------------------------------------------------
    male = rng.random(n) < 0.63
    age = np.clip(rng.normal(33, 9.5, n), 15, 68)
    exp_p = np.clip(
        np.array([0.30, 0.38, 0.24, 0.08])[None, :]
        + np.array([0.06, 0.02, -0.03, -0.03])[None, :] * ((age - 33) / 20)[:, None],
        0.02,
        None,
    )
    exp_p = exp_p / exp_p.sum(axis=1, keepdims=True)
    exp_rank = (rng.random(n)[:, None] > np.cumsum(exp_p, axis=1)).sum(axis=1).astype(float)
    training_years = np.clip(exp_rank * 2.1 + rng.normal(0, 1.1, n), 0, 25)

    height = np.where(male, rng.normal(177, 7, n), rng.normal(164, 6.5, n))
    height = np.clip(height, 145, 205)

    goal = _weighted_choice(rng, n, GOAL_PRIORS[sport])
    goal_fat = np.where(goal == "fat_loss", 1.0, 0.0)
    nut_goal = {g: (goal == g).astype(float) for g in schema.GOALS}
    bf_base = np.where(male, 19.5, 27.5)
    bf = np.clip(bf_base - 2.5 * (exp_rank / 3) + 2.0 * goal_fat + rng.normal(0, 6.5, n), 6, 48)

    # fat-free mass from height/experience, then body weight from body fat
    ffm = (height - 103) * np.where(male, 0.93, 0.82) * (0.9 + 0.045 * exp_rank) * rng.normal(1, 0.055, n)
    ffm = np.clip(ffm, 30, 90)
    weight = np.clip(ffm / (1 - bf / 100), 38, 170)
    bmi = weight / (height / 100) ** 2

    sessions_available = np.clip(
        rng.choice([2, 3, 4, 5, 6], size=n, p=[0.16, 0.34, 0.29, 0.15, 0.06]) + (exp_rank >= 2) * rng.integers(0, 2, n),
        1,
        7,
    ).astype(float)
    session_minutes = rng.choice([37.5, 52.5, 67.5, 85.0], size=n, p=[0.18, 0.42, 0.30, 0.10])

    equipment_score = np.clip(rng.choice([0.15, 0.45, 0.75, 0.8, 0.55, 1.0], size=n, p=[0.10, 0.16, 0.34, 0.14, 0.08, 0.18]), 0, 1)
    environment_rank = rng.choice([0, 1, 2, 1.5], size=n, p=[0.10, 0.20, 0.60, 0.10])
    activity_level = rng.choice([0, 1, 2, 3], size=n, p=[0.16, 0.40, 0.32, 0.12])
    work_style_rank = rng.choice([0, 1, 2, 3], size=n, p=[0.42, 0.34, 0.16, 0.08])

    sleep_hours = np.clip(rng.normal(6.9, 1.1, n), 3.5, 10.5)
    sleep_quality = np.clip(np.round(rng.normal(3.2, 0.9, n)), 1, 5)
    stress = np.clip(np.round(rng.normal(3.0, 0.9, n)), 1, 5)

    pain_p = np.clip(
        0.12
        + 0.012 * np.maximum(0, age - 30)
        + 0.05 * exp_rank
        + (0.05 if sport in {"crossfit", "hyrox", "running"} else 0.0)
        + 0.04 * work_style_rank,
        0,
        0.75,
    )
    pain_severity = np.zeros(n)
    has_pain = rng.random(n) < pain_p
    pain_level = rng.choice([1.0, 1.6, 3.0], size=n, p=[0.6, 0.3, 0.1])
    pain_severity[has_pain] = pain_level[has_pain]
    pain_area_count = np.where(has_pain, rng.integers(1, 3, n), 0).astype(float)

    secondary = {}
    consistency_goal = (rng.random(n) < SECONDARY_PRIORS["wants_consistency"]).astype(float)
    for key, p in SECONDARY_PRIORS.items():
        secondary[key] = (rng.random(n) < p).astype(float)
    secondary["wants_consistency"] = consistency_goal

    # ---- latent capacities (never directly observed) -----------------------
    exp_norm = exp_rank / 3.0
    t_strength = _clip01(0.20 + 0.21 * exp_rank + 0.07 * male - 0.004 * np.maximum(0, age - 38) + rng.normal(0, 0.10, n))
    t_engine = _clip01(0.14 + 0.15 * exp_rank + 0.05 * activity_level + 0.03 * male + rng.normal(0, 0.11, n))
    t_skill = _clip01(0.10 + 0.23 * exp_rank + 0.05 * secondary["wants_skill"] + rng.normal(0, 0.11, n))
    t_mobility = _clip01(0.68 - 0.06 * exp_rank - 0.03 * pain_severity + 0.04 * secondary["wants_mobility"] + rng.normal(0, 0.10, n))
    t_recovery = _clip01(
        0.30
        + 0.055 * (sleep_hours - 6.5)
        + 0.06 * (sleep_quality - 3.0)
        - 0.055 * (stress - 3.0)
        - 0.004 * np.maximum(0, age - 30)
        - 0.09 * pain_severity
        + 0.03 * activity_level
        + rng.normal(0, 0.075, n)
    )
    discipline = _clip01(
        0.44
        + 0.13 * secondary["wants_consistency"]
        + 0.10 * exp_norm
        - 0.03 * pain_severity
        + rng.normal(0, 0.13, n)
    )
    nutrition_discipline = _clip01(0.75 * discipline + 0.15 + rng.normal(0, 0.09, n))

    # ---- observable proxies ------------------------------------------------
    strength_available = (rng.random(n) < (0.22 + 0.22 * exp_rank + 0.10 * (sport in {"crossfit", "bodybuilding"}))).astype(float)
    engine_available = (rng.random(n) < (0.20 + 0.24 * exp_rank + 0.12 * (sport in {"running", "hyrox"}))).astype(float)
    strength_index = np.where(strength_available > 0, _clip01(0.92 * t_strength + 0.04 + rng.normal(0, 0.045, n)), 0.0)
    engine_index = np.where(engine_available > 0, _clip01(0.92 * t_engine + 0.04 + rng.normal(0, 0.045, n)), 0.0)
    skill_index = _clip01(t_skill + rng.normal(0, 0.05, n))
    mobility_index = _clip01(t_mobility + rng.normal(0, 0.05, n))
    weekly_mileage = np.where(sport == "running", np.clip((6 + 38 * t_engine + 6 * exp_rank) * rng.normal(1, 0.18, n), 0, 140), 0.0)

    returning = (rng.random(n) < 0.58).astype(float)
    adherence_28d = np.where(
        returning > 0,
        np.clip(0.92 * discipline - 0.06 + rng.normal(0, 0.07, n), 0.0, 1.0),
        0.0,
    )
    sessions_completed = np.where(returning > 0, np.round(adherence_28d * sessions_available * 4), 0.0)
    missed = np.where(returning > 0, np.maximum(0, sessions_available * 4 - sessions_completed), 0.0)
    avg_rpe = np.where(returning > 0, np.clip(6.2 + 1.5 * (0.6 - t_recovery) + rng.normal(0, 0.7, n), 4, 10), 0.0)
    rpe_trend = np.where(returning > 0, np.clip(rng.normal(0, 0.55, n), -2, 2), 0.0)
    feedback_completeness = np.where(returning > 0, np.clip(0.25 + 0.6 * discipline + rng.normal(0, 0.15, n), 0, 1), 0.0)
    readiness_avg = np.where(returning > 0, np.clip(45 + 45 * t_recovery + rng.normal(0, 7, n), 0, 100), 0.0)
    nutrition_adherence = np.where(returning > 0, np.clip(0.95 * nutrition_discipline + rng.normal(0, 0.07, n), 0, 1), 0.0)
    days_since_signup = np.where(returning > 0, np.clip(rng.exponential(160, n), 12, 1500), rng.integers(0, 3, n).astype(float))
    prior_plan_months = np.where(returning > 0, rng.choice([1, 3, 6, 12], size=n, p=[0.26, 0.42, 0.22, 0.10]), 0.0)
    prior_plan_count = np.where(returning > 0, rng.integers(1, 4, n), 0).astype(float)
    wearable_connected = (rng.random(n) < (0.28 + 0.18 * exp_rank)).astype(float)

    # ---- candidate plans ---------------------------------------------------
    archetypes = schema.ARCHETYPES[sport]
    k = len(archetypes)
    demand_volume = np.array([a.demand["volume"] for a in archetypes])
    demand_complexity = np.array([a.demand["complexity"] for a in archetypes])
    demand_strength = np.array([a.demand["strength"] for a in archetypes])
    demand_engine = np.array([a.demand["engine"] for a in archetypes])
    demand_skill = np.array([a.demand["skill"] for a in archetypes])
    demand_impact = np.array([a.demand["impact"] for a in archetypes])
    frequency = np.array([a.frequency for a in archetypes], dtype=float)
    focus = np.array([[a.focus[d] for d in schema.FOCUS_DIMS] for a in archetypes])  # (k, focus dims)
    goal_matrix = np.column_stack(
        [
            (goal == d).astype(float) if d in schema.GOALS else 0.55 * secondary["wants_skill"]
            for d in schema.FOCUS_DIMS
        ]
    )  # (n, focus dims)

    goal_alignment = goal_matrix @ focus.T  # (n, k)
    goal_alignment = goal_alignment / np.maximum(goal_alignment.max(axis=1, keepdims=True), 1e-6)

    fit_strength = 1 - np.abs(demand_strength[None, :] - t_strength[:, None])
    fit_engine = 1 - np.abs(demand_engine[None, :] - t_engine[:, None])
    fit_skill = 1 - np.abs(demand_skill[None, :] - t_skill[:, None])
    demand_total = demand_strength + demand_engine + demand_skill
    specific_fit = (
        demand_strength[None, :] * fit_strength
        + demand_engine[None, :] * fit_engine
        + demand_skill[None, :] * fit_skill
    ) / demand_total[None, :]

    overload = np.clip(demand_volume[None, :] - t_recovery[:, None], 0, 1)
    complexity_penalty = demand_complexity[None, :] * (1 - exp_norm[:, None])
    freq_fit = 1 - np.abs(frequency[None, :] - np.minimum(sessions_available, 5)[:, None]) / 6.0
    minutes_fit = 1 - np.clip((demand_volume[None, :] * 90 - session_minutes[:, None]) / 90.0, 0, 1) * 0.4

    adherence = _sigmoid(
        0.35
        + 3.2 * discipline[:, None]
        - 2.4 * overload
        - 1.7 * complexity_penalty
        + 1.3 * (freq_fit - 0.5)
        + 0.8 * (minutes_fit - 0.5)
        - 0.9 * pain_severity[:, None]
        + 0.4 * wearable_connected[:, None]
        - 0.6
    )

    # Training stimulus: harder plans pay off, but only as far as the athlete can absorb them.
    stimulus = 0.62 + 0.55 * demand_volume[None, :] * (0.42 + 0.58 * t_recovery[:, None])
    progress = (
        goal_alignment
        * (0.55 + 0.45 * specific_fit)
        * (0.30 + 0.70 * adherence)
        * stimulus
    )
    injury_risk = _sigmoid(
        -2.9
        + 2.1 * pain_severity[:, None]
        + 1.5 * overload
        + 1.0 * (1 - t_recovery[:, None])
        + 1.0 * demand_impact[None, :]
        - 1.5 * exp_norm[:, None]
        + 0.45 * (stress[:, None] - 3)
    )
    # Stage fit: beginners are better served by low-complexity plans, experienced
    # athletes plateau on them. This is the documented "appropriate challenge" prior.
    target_complexity = 0.15 + 0.80 * exp_norm[:, None]
    stage_fit = np.clip(1 - 1.5 * np.abs(demand_complexity[None, :] - target_complexity), 0, 1)
    utility = (
        0.58 * progress
        + 0.26 * adherence
        - 0.55 * injury_risk
        + 0.15 * stage_fit
        + 0.05 * (sleep_quality[:, None] - 3) / 4
        + rng.normal(0, 0.03, (n, k))
    )
    best = utility.argmax(axis=1)
    chosen_archetype = [archetypes[i] for i in best]
    chosen_adherence = adherence[np.arange(n), best]
    chosen_progress = progress[np.arange(n), best]
    chosen_overload = overload[np.arange(n), best]
    chosen_injury = injury_risk[np.arange(n), best]

    # ---- plan duration -----------------------------------------------------
    # Decide plan length with a discounted-value model: monthly benefit accumulates,
    # but churn hazard, commitment friction and goal horizon limit how far out we commit.
    hazard = np.clip(
        0.035 + 0.30 * (1 - discipline) + 0.06 * chosen_overload + 0.03 * (pain_severity / 3.0),
        0.02,
        0.80,
    )
    horizon_target = np.select(
        [nut_goal["competition"] > 0, nut_goal["fat_loss"] > 0, nut_goal["muscle"] > 0,
         nut_goal["strength"] > 0, nut_goal["endurance"] > 0],
        [2.0, 3.0, 4.5, 4.0, 4.0],
        default=6.0,
    )
    duration_utility = np.zeros((n, len(schema.DURATION_MONTHS)))
    for j, months in enumerate(schema.DURATION_MONTHS):
        ratio = 0.87 * (1 - hazard)
        step = np.array([ratio ** t for t in range(1, months + 1)]).sum(axis=0)
        value = chosen_progress * step
        horizon_penalty = 0.10 * np.abs(np.log(months / horizon_target))
        commit_friction = 0.05 * max(0, months - 3) + 0.025 * months
        cycle_bonus = 0.19 if months == 3 else (0.09 if months == 6 else (0.235 if months == 12 else 0.0))
        first_cycle = (np.where(prior_plan_count <= 0, 0.55, 0.0) + 0.14 * (discipline < 0.45)) if months == 1 else 0.0
        duration_utility[:, j] = (
            value
            - horizon_penalty
            - commit_friction
            + cycle_bonus
            + first_cycle
            + rng.normal(0, 0.012, n)
        )
    duration_months = np.array(schema.DURATION_MONTHS)[duration_utility.argmax(axis=1)]

    # ---- weekly session load ----------------------------------------------
    ideal_freq = np.array([a.frequency for a in archetypes], dtype=float)[best]
    sessions = np.clip(
        np.round(ideal_freq * 0.55 + np.minimum(sessions_available, 6) * 0.45 + (exp_norm - 0.5) * 0.5 + rng.normal(0, 0.3, n)),
        1,
        np.maximum(1, np.minimum(sessions_available, 6)),
    )

    # ---- nutrition strategy ------------------------------------------------
    nrg_demand = (demand_engine[best] + demand_volume[best]) / 2.0
    bf_mid_high = _sigmoid((bf - 22) / 4.0)
    bf_low = _sigmoid((15 - bf) / 3.0)
    nut_scores = {
        "fat_loss_deficit": 1.55 * nut_goal["fat_loss"] + 0.55 * bf_mid_high + 0.20 * nut_goal["health"] - 0.9 * bf_low,
        "lean_gain": 1.55 * nut_goal["muscle"] + 0.45 * (1 - bf_mid_high) + 0.20 * nut_goal["strength"] - 0.35 * bf_low,
        "performance_fuel": 0.85 * nut_goal["competition"] + 0.60 * nut_goal["endurance"] + 0.25 * nrg_demand + 0.20 * exp_norm,
        "maintenance": 1.50 * nut_goal["health"] + 0.35 * (age > 45) + 0.30 * (1 - discipline) + 0.20 * (1 - bf_mid_high),
        "recomp": 0.95 * nut_goal["strength"] + 0.70 * nut_goal["muscle"] + 0.80 * bf_mid_high + 0.35 * exp_norm - 0.8 * bf_low,
    }
    nut_matrix = np.column_stack([nut_scores[s] for s in NUTRITION_STRATEGIES])
    nut_matrix = nut_matrix + rng.normal(0, 0.12, nut_matrix.shape)
    nutrition = np.array(NUTRITION_STRATEGIES, dtype=object)[nut_matrix.argmax(axis=1)]

    # ---- coaching mode -----------------------------------------------------
    complexity_score = (
        0.34 * exp_norm
        + 0.26 * (pain_severity / 3.0)
        + 0.20 * (duration_months >= 12)
        + 0.16 * (duration_months >= 6)
        + 0.22 * nut_goal["competition"]
        + 0.18 * (1 - discipline)
        + 0.14 * (chosen_overload > 0.25)
        + rng.normal(0, 0.06, n)
    )
    coaching = np.where(complexity_score > 0.66, "human", np.where(complexity_score > 0.40, "hybrid", "ai")).astype(object)

    # ---- assemble ----------------------------------------------------------
    data: Dict[str, np.ndarray] = {
        "experience_rank": exp_rank,
        "training_age_years": training_years,
        "age": age,
        "sex_male": male.astype(float),
        "height_cm": height,
        "weight_kg": weight,
        "bmi": bmi,
        "sessions_available": sessions_available,
        "session_minutes": session_minutes,
        "equipment_score": equipment_score,
        "environment_rank": np.asarray(environment_rank, dtype=float),
        "activity_level": activity_level.astype(float),
        "work_style_rank": work_style_rank.astype(float),
        "sleep_hours": sleep_hours,
        "sleep_quality": sleep_quality,
        "stress": stress,
        "pain_severity": pain_severity,
        "pain_area_count": pain_area_count,
        "body_fat_pct": bf,
        "body_fat_available": (rng.random(n) < 0.62).astype(float),
        "strength_index": strength_index,
        "strength_available": strength_available,
        "engine_index": engine_index,
        "engine_available": engine_available,
        "skill_index": skill_index,
        "mobility_index": mobility_index,
        "weekly_mileage": weekly_mileage,
        "adherence_28d": adherence_28d,
        "adherence_available": returning,
        "avg_rpe": avg_rpe,
        "rpe_trend": rpe_trend,
        "missed_sessions_28d": missed,
        "sessions_completed_28d": sessions_completed,
        "feedback_completeness": feedback_completeness,
        "readiness_avg": readiness_avg,
        "nutrition_adherence": nutrition_adherence,
        "nutrition_adherence_available": returning,
        "days_since_signup": days_since_signup,
        "prior_plan_months": prior_plan_months,
        "prior_plan_count": prior_plan_count,
        "wearable_connected": wearable_connected,
    }
    for s in schema.SPORTS:
        data[f"sport_{s}"] = np.full(n, 1.0 if s == sport else 0.0)
    for g in schema.GOALS:
        data[f"goal_{g}"] = nut_goal[g]
    for key, values in secondary.items():
        data[key] = values

    # body fat is only observable when measured
    data["body_fat_pct"] = np.where(data["body_fat_available"] > 0, bf, schema.FILL_VALUES["body_fat_pct"])

    X = pd.DataFrame({name: np.asarray(data[name], dtype=float) for name in schema.FEATURES})

    diagnostics = pd.DataFrame(
        {
            "sport": sport,
            "goal": goal,
            "latent_strength": t_strength,
            "latent_engine": t_engine,
            "latent_recovery": t_recovery,
            "latent_discipline": discipline,
            "chosen_progress": chosen_progress,
            "chosen_adherence": chosen_adherence,
            "chosen_injury_risk": chosen_injury,
        }
    )

    labels = {
        "program": np.array([a.id for a in chosen_archetype], dtype=object),
        "nutrition": nutrition,
        "duration": duration_months.astype(float),
        "sessions": sessions.astype(float),
        "adherence": np.clip(chosen_adherence + rng.normal(0, 0.03, n), 0.02, 0.99),
        "coaching": coaching,
    }
    return X, labels, diagnostics


def simulate_cohort(n: int = 48000, seed: int = 42) -> Cohort:
    schema.validate_schema()
    rng = np.random.default_rng(seed)
    parts = {s: max(1, int(round(n * p))) for s, p in SPORT_PRIORS.items()}
    parts["crossfit"] += n - sum(parts.values())

    Xs, label_parts, diag_parts = [], {k: [] for k in ("program", "nutrition", "duration", "sessions", "adherence", "coaching")}, []
    for sport, count in parts.items():
        X, labels, diag = _simulate_sport(rng, sport, count)
        Xs.append(X)
        diag_parts.append(diag)
        for key, values in labels.items():
            label_parts[key].append(values)

    X = pd.concat(Xs, ignore_index=True)
    labels = {k: np.concatenate(v) for k, v in label_parts.items()}
    diagnostics = pd.concat(diag_parts, ignore_index=True)
    return Cohort(
        X=X,
        y_program=labels["program"],
        y_nutrition=labels["nutrition"],
        y_duration=labels["duration"],
        y_sessions=labels["sessions"],
        y_adherence=labels["adherence"],
        y_coaching=labels["coaching"],
        diagnostics=diagnostics,
    )

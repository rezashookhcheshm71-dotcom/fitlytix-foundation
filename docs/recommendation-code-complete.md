# کد کامل موتور پیشنهاد برنامه FitLytix

> این فایل **تولیدشده** است: `node scripts/bundle-recommender-code.mjs`. نسخهٔ مرجع، فایل‌های
> واقعی در `ml/` و `src/services/recommendation/` هستند.

همهٔ سورس موتور به‌ترتیب معماری کنار هم آمده تا لازم نباشد بین پوشه‌ها بگردید.
`src/services/recommendation/model/model.json` (حدود ۱.۳MB) خروجی آموزش است، نه کد؛
برای ساختنش `python ml/train.py` و گزارش ارزیابی آن در `model/metrics.json`.

## فهرست

1. `ml/requirements.txt`
2. `ml/fitlytix_ml/schema.py`
3. `ml/fitlytix_ml/simulator.py`
4. `ml/fitlytix_ml/export.py`
5. `ml/train.py`
6. `src/domain/recommendation.ts`
7. `src/services/recommendation/modelTypes.ts`
8. `src/services/recommendation/ensemble.ts`
9. `src/services/recommendation/model.server.ts`
10. `src/services/recommendation/schemaGuard.ts`
11. `src/services/recommendation/features.ts`
12. `src/services/recommendation/archetypes.ts`
13. `src/services/recommendation/nutrition.ts`
14. `src/services/recommendation/guardrails.ts`
15. `src/services/recommendation/rules.ts`
16. `src/services/recommendation/explain.ts`
17. `src/services/recommendation/engine.ts`
18. `src/services/recommendation/requestSchema.ts`
19. `src/services/recommendation/store.server.ts`
20. `src/services/recommendation/snapshots.server.ts`
21. `src/services/recommendation/assembly.server.ts`
22. `src/services/recommendation/userPlan.server.ts`
23. `src/services/recommendation/presentation.ts`
24. `src/hooks/use-plan.ts`
25. `src/components/domain/plan-summary.tsx`
26. `src/routes/api/recommend.ts`
27. `src/routes/api/plan.ts`
28. `src/routes/api/plan-diagnose.ts`
29. `src/routes/recommendation.tsx`
30. `scripts/check-model-parity.mjs`
31. `scripts/e2e-plan.mjs`
32. `scripts/verify-prod.mjs`
33. `database/migrations/mysql/003_fitlytix_recommendation_engine.sql`
34. `database/migrations/mysql/004_recommendation_snapshots.sql`

---

## 1) `ml/requirements.txt`

```text
# Training-only dependencies. The deployed runtime is pure Node — it needs none of these.
numpy>=1.26,<3
pandas>=2.1,<4
scikit-learn>=1.4,<2
```

---

## 2) `ml/fitlytix_ml/schema.py`

```python
"""
FitLytix recommendation engine — canonical feature & label schema.

This file is the single source of truth for:
  * the ordered feature vector the models consume,
  * the sport-specific program archetypes (the model's action space),
  * the nutrition strategies,
  * plan duration options,
  * coaching-mode options.

The TypeScript runtime (`src/services/recommendation/`) reads the *same* feature
order, fill values and class labels from the exported `model.json`, so a schema
change here only requires retraining (no hand-editing of the TS interpreter).
`src/services/recommendation/schemaGuard.ts` asserts the runtime ids still match.

Nothing here is medical logic: features are coaching inputs only.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List

MODEL_FORMAT = "fitlytix-gbdt-json"
MODEL_SCHEMA_VERSION = 1

SPORTS: List[str] = ["crossfit", "hyrox", "functional", "bodybuilding", "running"]
EXPERIENCE_LEVELS: List[str] = ["beginner", "intermediate", "advanced", "elite"]
GOALS: List[str] = ["strength", "muscle", "fat_loss", "endurance", "competition", "health"]
# Dimensions a plan can develop. `skill` is not a purchasable goal, but athletes can
# ask for it as a secondary goal, so it still needs a column in the focus vector.
FOCUS_DIMS: List[str] = ["strength", "muscle", "fat_loss", "endurance", "skill", "competition", "health"]
DURATION_MONTHS: List[int] = [1, 3, 6, 12]
NUTRITION_STRATEGIES: List[str] = [
    "fat_loss_deficit",
    "lean_gain",
    "performance_fuel",
    "maintenance",
    "recomp",
]
COACHING_MODES: List[str] = ["ai", "hybrid", "human"]

# ---------------------------------------------------------------------------
# Feature vector (order matters: it is stored in model.json and replayed in TS)
# ---------------------------------------------------------------------------

FEATURE_SPECS: List[tuple[str, str]] = [
    # (name, short human description used in docs/metrics)
    ("sport_crossfit", "one-hot sport"),
    ("sport_hyrox", "one-hot sport"),
    ("sport_functional", "one-hot sport"),
    ("sport_bodybuilding", "one-hot sport"),
    ("sport_running", "one-hot sport"),
    ("experience_rank", "0..3 training experience"),
    ("training_age_years", "years of consistent training"),
    ("age", "years"),
    ("sex_male", "1 = male, 0 = female/other"),
    ("height_cm", "cm"),
    ("weight_kg", "kg"),
    ("bmi", "kg/m²"),
    ("sessions_available", "realistic sessions per week (1..7)"),
    ("session_minutes", "minutes per session"),
    ("goal_strength", "one-hot primary goal"),
    ("goal_muscle", "one-hot primary goal"),
    ("goal_fat_loss", "one-hot primary goal"),
    ("goal_endurance", "one-hot primary goal"),
    ("goal_competition", "one-hot primary goal"),
    ("goal_health", "one-hot primary goal"),
    ("wants_mobility", "secondary goal"),
    ("wants_recovery", "secondary goal"),
    ("wants_consistency", "secondary goal"),
    ("wants_skill", "secondary goal"),
    ("equipment_score", "0 bodyweight .. 1 full gym"),
    ("environment_rank", "home .. outdoor facility"),
    ("activity_level", "0..3 daily activity outside training"),
    ("work_style_rank", "0 desk .. 3 heavy physical work"),
    ("sleep_hours", "typical sleep"),
    ("sleep_quality", "1..5 morning freshness"),
    ("stress", "1..5 daily stress"),
    ("pain_severity", "0 none .. 3 clinician-limited"),
    ("pain_area_count", "number of flagged joints/areas"),
    ("body_fat_pct", "percent (imputed when unknown)"),
    ("body_fat_available", "measurement present"),
    ("strength_index", "0..1 relative strength, sport-normalised"),
    ("strength_available", "strength test present"),
    ("engine_index", "0..1 aerobic engine, sport-normalised"),
    ("engine_available", "engine test present"),
    ("skill_index", "0..1 gymnastics / technical skill"),
    ("mobility_index", "0..1 mobility"),
    ("weekly_mileage", "running km per week (0 when N/A)"),
    ("adherence_28d", "completed / planned sessions, last 28 days"),
    ("adherence_available", "behaviour history present"),
    ("avg_rpe", "average session RPE 0..10"),
    ("rpe_trend", "RPE change vs previous block (-2..2)"),
    ("missed_sessions_28d", "missed sessions, last 28 days"),
    ("sessions_completed_28d", "completed sessions, last 28 days"),
    ("feedback_completeness", "0..1 share of sessions with feedback"),
    ("readiness_avg", "mean readiness 0..100"),
    ("nutrition_adherence", "0..1 nutrition plan adherence"),
    ("nutrition_adherence_available", "nutrition history present"),
    ("days_since_signup", "tenure in days"),
    ("prior_plan_months", "length of previous plan, 0 = first plan"),
    ("prior_plan_count", "number of previous plans"),
    ("wearable_connected", "has a live wearable connection"),
]

FEATURES: List[str] = [name for name, _ in FEATURE_SPECS]
FEATURE_INDEX: Dict[str, int] = {name: i for i, name in enumerate(FEATURES)}

# Median / neutral fallback per feature. Written into model.json so the runtime
# imputes exactly like training did (single source of truth, no drift).
FILL_VALUES: Dict[str, float] = {
    "sport_crossfit": 0.0,
    "sport_hyrox": 0.0,
    "sport_functional": 0.0,
    "sport_bodybuilding": 0.0,
    "sport_running": 0.0,
    "experience_rank": 1.0,
    "training_age_years": 1.0,
    "age": 32.0,
    "sex_male": 0.5,
    "height_cm": 175.0,
    "weight_kg": 76.0,
    "bmi": 24.8,
    "sessions_available": 3.0,
    "session_minutes": 60.0,
    "goal_strength": 0.0,
    "goal_muscle": 0.0,
    "goal_fat_loss": 0.0,
    "goal_endurance": 0.0,
    "goal_competition": 0.0,
    "goal_health": 1.0,
    "wants_mobility": 0.0,
    "wants_recovery": 0.0,
    "wants_consistency": 0.0,
    "wants_skill": 0.0,
    "equipment_score": 0.5,
    "environment_rank": 2.0,
    "activity_level": 1.5,
    "work_style_rank": 1.0,
    "sleep_hours": 7.0,
    "sleep_quality": 3.0,
    "stress": 3.0,
    "pain_severity": 0.0,
    "pain_area_count": 0.0,
    "body_fat_pct": 22.0,
    "body_fat_available": 0.0,
    "strength_index": 0.45,
    "strength_available": 0.0,
    "engine_index": 0.45,
    "engine_available": 0.0,
    "skill_index": 0.35,
    "mobility_index": 0.5,
    "weekly_mileage": 0.0,
    "adherence_28d": 0.7,
    "adherence_available": 0.0,
    "avg_rpe": 7.0,
    "rpe_trend": 0.0,
    "missed_sessions_28d": 1.0,
    "sessions_completed_28d": 9.0,
    "feedback_completeness": 0.5,
    "readiness_avg": 65.0,
    "nutrition_adherence": 0.65,
    "nutrition_adherence_available": 0.0,
    "days_since_signup": 0.0,
    "prior_plan_months": 0.0,
    "prior_plan_count": 0.0,
    "wearable_connected": 0.0,
}

# Explicit encodings for the TS extractor. Ranks are ordinal, never linear in
# physical units — they only order options from lowest to highest capacity.
ENCODINGS: Dict[str, Dict[str, float]] = {
    "experience_rank": {
        "beginner": 0.0,
        "intermediate": 1.0,
        "advanced": 2.0,
        "elite": 3.0,
        # common assessment training-history options
        "option_1": 0.0,
        "option_2": 0.6,
        "option_3": 1.3,
        "option_4": 2.1,
        "option_5": 3.0,
    },
    "equipment_score": {
        "option_1": 0.15,
        "option_2": 0.45,
        "option_3": 0.75,
        "option_4": 0.8,
        "option_5": 0.55,
        "option_6": 1.0,
    },
    "environment_rank": {
        "option_1": 0.0,
        "option_2": 1.0,
        "option_3": 2.0,
        "option_4": 1.5,
    },
    "activity_level": {"option_1": 0.0, "option_2": 1.0, "option_3": 2.0, "option_4": 3.0},
    "work_style_rank": {"option_1": 0.0, "option_2": 1.0, "option_3": 2.0, "option_4": 3.0},
    "pain_severity": {
        "option_1": 0.0,
        "option_2": 1.0,
        "option_3": 1.6,
        "option_4": 3.0,
    },
    "goal": {
        "option_1": 0.0,
        "option_2": 1.0,
        "option_3": 2.0,
        "option_4": 3.0,
        "option_5": 4.0,
        "option_6": 5.0,
    },
    "session_minutes": {
        "option_1": 37.5,
        "option_2": 52.5,
        "option_3": 67.5,
        "option_4": 85.0,
    },
}

# ---------------------------------------------------------------------------
# Action space — program archetypes per sport
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Archetype:
    id: str
    sport: str
    label_fa: str
    summary_fa: str
    # How much this plan develops each goal dimension (0..1, sums ~1).
    focus: Dict[str, float]
    # What the plan demands from the athlete (0..1).
    demand: Dict[str, float]
    # Typical weekly frequency and session length for the template.
    frequency: int
    minutes: int
    # Free-form tags consumed by the policy layer (sport structure).
    tags: List[str] = field(default_factory=list)


def _focus(
    strength: float,
    muscle: float,
    fat_loss: float,
    endurance: float,
    skill: float,
    health: float,
    competition: float = 0.0,
) -> Dict[str, float]:
    raw = {
        "strength": strength,
        "muscle": muscle,
        "fat_loss": fat_loss,
        "endurance": endurance,
        "skill": skill,
        "competition": competition,
        "health": health,
    }
    total = sum(raw.values()) or 1.0
    return {k: v / total for k, v in raw.items()}


def _demand(strength: float, engine: float, skill: float, volume: float, complexity: float, impact: float) -> Dict[str, float]:
    return {
        "strength": strength,
        "engine": engine,
        "skill": skill,
        "volume": volume,
        "complexity": complexity,
        "impact": impact,
    }


ARCHETYPES: Dict[str, List[Archetype]] = {
    "crossfit": [
        Archetype(
            id="cf_foundation",
            sport="crossfit",
            label_fa="پایه و اسکیلینگ",
            summary_fa="ساخت الگوی حرکتی، تحمل حجم و اجرای تمیز پیش از شدت بالا.",
            focus=_focus(0.22, 0.12, 0.14, 0.18, 0.20, 0.14),
            demand=_demand(0.35, 0.38, 0.25, 0.42, 0.22, 0.45),
            frequency=3,
            minutes=55,
            tags=["scaled", "technique", "onboarding"],
        ),
        Archetype(
            id="cf_strength_skill",
            sport="crossfit",
            label_fa="قدرت و مهارت",
            summary_fa="بلوک‌های وزنه‌برداری و ژیمناستیک با پیشرفت هفتگی قابل اندازه‌گیری.",
            focus=_focus(0.34, 0.16, 0.04, 0.10, 0.28, 0.08, competition=0.10),
            demand=_demand(0.78, 0.42, 0.65, 0.55, 0.55, 0.40),
            frequency=4,
            minutes=70,
            tags=["weightlifting", "gymnastics", "strength-bias"],
        ),
        Archetype(
            id="cf_engine_competition",
            sport="crossfit",
            label_fa="موتور و آمادگی مسابقه",
            summary_fa="پیسینگ، متکان‌های طولانی و شبیه‌سازی روز مسابقه.",
            focus=_focus(0.14, 0.06, 0.10, 0.42, 0.10, 0.18, competition=0.35),
            demand=_demand(0.45, 0.85, 0.35, 0.78, 0.6, 0.7),
            frequency=5,
            minutes=75,
            tags=["engine", "competition", "high-volume"],
        ),
        Archetype(
            id="cf_balanced_performance",
            sport="crossfit",
            label_fa="عملکرد متعادل",
            summary_fa="ترکیب متعادل قدرت، موتور و مهارت برای ورزشکار همه‌فن‌حریف.",
            focus=_focus(0.25, 0.13, 0.10, 0.24, 0.16, 0.12, competition=0.12),
            demand=_demand(0.6, 0.6, 0.45, 0.62, 0.45, 0.55),
            frequency=4,
            minutes=70,
            tags=["balanced", "rx"],
        ),
    ],
    "hyrox": [
        Archetype(
            id="hx_base_engine",
            sport="hyrox",
            label_fa="پایه هوازی",
            summary_fa="ساخت موتور هوازی و تحمل مفاصل پیش از شدت ایستگاهی.",
            focus=_focus(0.08, 0.06, 0.16, 0.46, 0.04, 0.20),
            demand=_demand(0.30, 0.62, 0.12, 0.45, 0.20, 0.35),
            frequency=3,
            minutes=55,
            tags=["aerobic-base", "low-impact"],
        ),
        Archetype(
            id="hx_station_strength",
            sport="hyrox",
            label_fa="قدرت ایستگاه‌ها",
            summary_fa="سورتمه، کرری و لانژ با تمرکز روی قدرت کاربردی و انتقال به دویدن.",
            focus=_focus(0.36, 0.12, 0.06, 0.26, 0.04, 0.16),
            demand=_demand(0.70, 0.55, 0.15, 0.62, 0.30, 0.55),
            frequency=4,
            minutes=65,
            tags=["sled", "carry", "strength-endurance"],
        ),
        Archetype(
            id="hx_race_prep",
            sport="hyrox",
            label_fa="آماده‌سازی مسابقه",
            summary_fa="شبیه‌سازی تقسیم‌بندی مسابقه، ترنزیشن و پیس ثابت.",
            focus=_focus(0.10, 0.05, 0.12, 0.48, 0.03, 0.22, competition=0.30),
            demand=_demand(0.45, 0.82, 0.18, 0.80, 0.55, 0.78),
            frequency=5,
            minutes=80,
            tags=["competition", "simulation", "high-load"],
        ),
        Archetype(
            id="hx_hybrid_maintenance",
            sport="hyrox",
            label_fa="نگهداشت ترکیبی",
            summary_fa="حداقل حجم مؤثر برای حفظ آمادگی در دوره‌های شلوغ.",
            focus=_focus(0.20, 0.08, 0.20, 0.28, 0.02, 0.22),
            demand=_demand(0.45, 0.45, 0.10, 0.35, 0.25, 0.35),
            frequency=3,
            minutes=50,
            tags=["maintenance", "time-efficient"],
        ),
    ],
    "functional": [
        Archetype(
            id="fn_movement_foundation",
            sport="functional",
            label_fa="بنیان حرکت",
            summary_fa="اصلاح الگو، موبیلیتی و کنترل مرکز بدن با پیشرفت آرام.",
            focus=_focus(0.16, 0.10, 0.18, 0.16, 0.10, 0.30),
            demand=_demand(0.28, 0.30, 0.18, 0.32, 0.20, 0.25),
            frequency=3,
            minutes=45,
            tags=["mobility", "technique", "low-impact"],
        ),
        Archetype(
            id="fn_strength_balance",
            sport="functional",
            label_fa="قدرت متعادل",
            summary_fa="قدرت یک‌طرفه، تعادل و ثبات با بارگذاری تدریجی.",
            focus=_focus(0.36, 0.16, 0.10, 0.12, 0.08, 0.18),
            demand=_demand(0.62, 0.35, 0.25, 0.48, 0.30, 0.35),
            frequency=3,
            minutes=60,
            tags=["unilateral", "stability"],
        ),
        Archetype(
            id="fn_conditioning_gpp",
            sport="functional",
            label_fa="آمادگی عمومی",
            summary_fa="دایره‌های ترکیبی، تعریق کنترل‌شده و ظرفیت کاری بالاتر.",
            focus=_focus(0.14, 0.06, 0.28, 0.34, 0.04, 0.14),
            demand=_demand(0.40, 0.65, 0.18, 0.60, 0.35, 0.45),
            frequency=4,
            minutes=55,
            tags=["conditioning", "fat-loss-friendly"],
        ),
        Archetype(
            id="fn_mobility_recovery",
            sport="functional",
            label_fa="تحرک و بازگشت",
            summary_fa="بازگرداندن دامنه حرکت و تحمل بار بعد از دوره پرفشار یا درد.",
            focus=_focus(0.10, 0.04, 0.12, 0.10, 0.06, 0.58),
            demand=_demand(0.18, 0.20, 0.12, 0.22, 0.12, 0.12),
            frequency=3,
            minutes=40,
            tags=["rehab-friendly", "low-impact", "safety"],
        ),
    ],
    "bodybuilding": [
        Archetype(
            id="bb_full_body_foundation",
            sport="bodybuilding",
            label_fa="تمام‌بدن پایه",
            summary_fa="فرکانس بالای هر گروه عضلانی با حجم قابل بازیابی.",
            focus=_focus(0.24, 0.34, 0.12, 0.06, 0.06, 0.18),
            demand=_demand(0.55, 0.25, 0.20, 0.45, 0.20, 0.25),
            frequency=3,
            minutes=55,
            tags=["full-body", "onboarding", "frequency"],
        ),
        Archetype(
            id="bb_upper_lower",
            sport="bodybuilding",
            label_fa="بالاتنه / پایین‌تنه",
            summary_fa="تفکیک دوگانه با حجم متوسط و پیشرفت هفتگی پایدار.",
            focus=_focus(0.26, 0.40, 0.10, 0.06, 0.04, 0.14),
            demand=_demand(0.65, 0.30, 0.25, 0.62, 0.30, 0.30),
            frequency=4,
            minutes=65,
            tags=["upper-lower", "hypertrophy"],
        ),
        Archetype(
            id="bb_push_pull_legs",
            sport="bodybuilding",
            label_fa="فشار / کشش / پا",
            summary_fa="حجم بالا و تمرکز روی تنش مکانیکی هر گروه عضلانی.",
            focus=_focus(0.24, 0.46, 0.06, 0.04, 0.04, 0.16),
            demand=_demand(0.72, 0.35, 0.30, 0.80, 0.40, 0.35),
            frequency=5,
            minutes=70,
            tags=["ppl", "high-volume", "advanced"],
        ),
        Archetype(
            id="bb_weak_point",
            sport="bodybuilding",
            label_fa="تمرکز روی نقاط ضعف",
            summary_fa="اولویت‌دهی به عضلات عقب‌مانده با حجم اختصاصی و کنترل خستگی.",
            focus=_focus(0.20, 0.40, 0.14, 0.04, 0.04, 0.18),
            demand=_demand(0.68, 0.30, 0.35, 0.68, 0.45, 0.30),
            frequency=4,
            minutes=65,
            tags=["specialization", "weak-points"],
        ),
    ],
    "running": [
        Archetype(
            id="rn_base_build",
            sport="running",
            label_fa="ساخت پایه",
            summary_fa="افزایش تدریجی مسافت هفتگی با اکثر دویدن‌ها آسان.",
            focus=_focus(0.06, 0.02, 0.16, 0.50, 0.02, 0.24),
            demand=_demand(0.20, 0.60, 0.10, 0.50, 0.20, 0.30),
            frequency=3,
            minutes=50,
            tags=["base", "aerobic", "injury-aware"],
        ),
        Archetype(
            id="rn_threshold_5k10k",
            sport="running",
            label_fa="آستانه ۵–۱۰ کیلومتر",
            summary_fa="تمرین آستانه، اینتروال کنترل‌شده و ریتم مسابقه.",
            focus=_focus(0.08, 0.02, 0.12, 0.52, 0.02, 0.24, competition=0.18),
            demand=_demand(0.35, 0.80, 0.15, 0.68, 0.45, 0.62),
            frequency=4,
            minutes=55,
            tags=["threshold", "5k-10k", "quality"],
        ),
        Archetype(
            id="rn_half_marathon",
            sport="running",
            label_fa="نیم‌ماراتن",
            summary_fa="حجم بالا، لانگ‌ران هفتگی و تغذیه اطراف جلسات طولانی.",
            focus=_focus(0.06, 0.02, 0.14, 0.58, 0.02, 0.18, competition=0.24),
            demand=_demand(0.30, 0.88, 0.12, 0.88, 0.55, 0.72),
            frequency=5,
            minutes=70,
            tags=["endurance", "long-run", "high-mileage"],
        ),
        Archetype(
            id="rn_speed_maintenance",
            sport="running",
            label_fa="سرعت و نگهداشت",
            summary_fa="حفظ سرعت و آمادگی با حداقل حجم در دوره‌های کم‌وقت.",
            focus=_focus(0.12, 0.02, 0.20, 0.34, 0.04, 0.28),
            demand=_demand(0.40, 0.55, 0.12, 0.38, 0.30, 0.40),
            frequency=3,
            minutes=45,
            tags=["maintenance", "speed", "time-efficient"],
        ),
    ],
}

ARCHETYPE_BY_ID: Dict[str, Archetype] = {
    a.id: a for group in ARCHETYPES.values() for a in group
}


def archetype_ids(sport: str) -> List[str]:
    return [a.id for a in ARCHETYPES[sport]]


def validate_schema() -> None:
    """Fail fast if the schema is internally inconsistent (run before training)."""
    assert list(FILL_VALUES) == FEATURES, "FILL_VALUES must cover every feature in order"
    for sport in SPORTS:
        ids = archetype_ids(sport)
        assert len(ids) == 4, f"{sport} needs exactly 4 archetypes, got {ids}"
        for a in ARCHETYPES[sport]:
            assert abs(sum(a.focus.values()) - 1.0) < 1e-9, f"{a.id} focus must sum to 1"
    assert set(NUTRITION_STRATEGIES) == {
        "fat_loss_deficit",
        "lean_gain",
        "performance_fuel",
        "maintenance",
        "recomp",
    }
```

---

## 3) `ml/fitlytix_ml/simulator.py`

```python
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
```

---

## 4) `ml/fitlytix_ml/export.py`

```python
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
```

---

## 5) `ml/train.py`

```python
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
```

---

## 6) `src/domain/recommendation.ts`

```ts
/**
 * Recommendation domain — contracts between the self-hosted ML model, the API and the UI.
 *
 * The model itself is trained offline (`ml/train.py`) and exported as JSON trees.
 * Everything here is deterministic and testable; nothing in this file calls a network.
 */
import type {
  AssessmentAnswers,
  CoachingType,
  ExperienceLevel,
  PackageId,
  SportId,
  WorkoutBlockType,
} from "./types";

export type { CoachingType } from "./types";

export type GoalId = "strength" | "muscle" | "fat_loss" | "endurance" | "competition" | "health";
export type PlanDurationMonths = 1 | 3 | 6 | 12;

export type NutritionStrategyId =
  "fat_loss_deficit" | "lean_gain" | "performance_fuel" | "maintenance" | "recomp";

export interface RecommendationProfileInput {
  age?: number | undefined;
  gender?: "male" | "female" | "other" | undefined;
  heightCm?: number | undefined;
  weightKg?: number | undefined;
  experience?: ExperienceLevel | undefined;
  primaryGoal?: GoalId | undefined;
  sessionsPerWeek?: number | undefined;
  minutesPerSession?: number | undefined;
}

export interface BodyCompositionInput {
  weightKg?: number | undefined;
  heightCm?: number | undefined;
  bodyFatPct?: number | undefined;
  measuredAt?: string | undefined;
}

/**
 * Behaviour summary over a trailing window (default 28 days).
 * The platform feeds this from workout logs / feedback; passing nothing means a cold start.
 */
export interface RecommendationBehaviorInput {
  windowDays?: number | undefined;
  plannedSessions?: number | undefined;
  completedSessions?: number | undefined;
  missedSessions?: number | undefined;
  avgRpe?: number | undefined;
  previousAvgRpe?: number | undefined;
  feedbackCount?: number | undefined;
  readinessAvg?: number | undefined;
  nutritionAdherence?: number | undefined;
  daysSinceSignup?: number | undefined;
  priorPlanMonths?: number | undefined;
  priorPlanCount?: number | undefined;
  wearableConnected?: boolean | undefined;
}

export interface RecommendationConstraints {
  /** "auto" (default) lets the model pick the commercial cycle length. */
  durationMonths?: PlanDurationMonths | "auto" | undefined;
  packageId?: PackageId | undefined;
  coachingPreference?: CoachingType | "auto" | undefined;
  maxSessionsPerWeek?: number | undefined;
}

export interface RecommendationRequest {
  athleteId?: string | undefined;
  sport: SportId;
  profile?: RecommendationProfileInput | undefined;
  assessmentAnswers?: AssessmentAnswers | undefined;
  bodyAnalysis?: BodyCompositionInput | undefined;
  behavior?: RecommendationBehaviorInput | undefined;
  /** Optional nutrition preferences captured elsewhere in onboarding. */
  nutrition?: { mealsPerDay?: number | undefined; restrictions?: string[] | undefined } | undefined;
  constraints?: RecommendationConstraints | undefined;
}

export interface ProgramDayTemplate {
  index: number;
  titleFa: string;
  focusFa: string;
  blocks: WorkoutBlockType[];
  mainMovements: string[];
}

export interface ProgramRecommendation {
  archetypeId: string;
  labelFa: string;
  summaryFa: string;
  sessionsPerWeek: number;
  sessionMinutes: number;
  weeks: number;
  deloadWeekIndexes: number[];
  progressionNotes: string[];
  days: ProgramDayTemplate[];
  focusTags: string[];
}

export interface MacroRange {
  id: "protein" | "carb" | "fat";
  labelFa: string;
  gPerKg: [number, number];
  roleFa: string;
}

export interface MealSlotTemplate {
  titleFa: string;
  timingFa: string;
  templateFa: string;
  focus: "protein" | "carb" | "balanced" | "light";
}

export interface DayTypeNutrition {
  dayType: "hard" | "training" | "rest";
  labelFa: string;
  carbMultiplier: number;
  noteFa: string;
}

export interface NutritionRecommendation {
  strategyId: NutritionStrategyId;
  labelFa: string;
  summaryFa: string;
  energyIntentFa: string;
  macros: MacroRange[];
  hydrationL: number;
  mealsPerDay: number;
  meals: MealSlotTemplate[];
  dayTypes: DayTypeNutrition[];
  weeklyAdjustments: string[];
  notes: string[];
}

export interface SafetyFlag {
  code:
    | "pain_clinician_limited"
    | "pain_reported"
    | "low_sleep"
    | "high_stress"
    | "low_readiness"
    | "low_adherence"
    | "underweight"
    | "minor_athlete"
    | "high_volume_cap"
    | "nutrition_risk";
  labelFa: string;
  actionFa: string;
  severity: "info" | "caution" | "review_required";
}

export interface RecommendationExplanation {
  feature: string;
  labelFa: string;
  valueFa: string;
  direction: "supports" | "against";
  weight: number;
  textFa: string;
}

export interface RecommendationExpectations {
  /** Predicted probability of finishing the first 4 weeks as planned (0..1). */
  adherence30d: number;
  /** Predicted probability of finishing the whole cycle (0..1). */
  adherenceCycle: number;
  /** How much of the decision is backed by measured inputs vs. sensible defaults. */
  dataCompleteness: number;
  confidence: "low" | "medium" | "high";
}

export interface PlanRecommendation {
  athleteId?: string | undefined;
  sport: SportId;
  generatedAt: string;
  model: {
    version: string;
    trainedAt: string;
    source: "model" | "fallback";
    schemaVersion: number;
    /** Provenance: "simulated" means the model learned from the documented simulator, not real outcomes. */
    trainingData: string;
  };
  program: ProgramRecommendation;
  nutrition: NutritionRecommendation;
  duration: {
    months: PlanDurationMonths;
    labelFa: string;
    rationaleFa: string;
    overrideApplied: boolean;
  };
  coaching: {
    mode: CoachingType;
    labelFa: string;
    rationaleFa: string;
  };
  package: {
    id: PackageId;
    nameFa: string;
    rationaleFa: string;
  };
  expectations: RecommendationExpectations;
  safety: {
    level: "none" | "caution" | "review_required";
    flags: SafetyFlag[];
  };
  explanations: RecommendationExplanation[];
  inputs: {
    used: string[];
    missing: string[];
  };
}

export interface RecommendationResponse {
  ok: true;
  recommendation: PlanRecommendation;
  diagnostics: {
    latencyMs: number;
    featureCount: number;
    modelVersion: string;
    fallbackReasons: string[];
  };
}

export const PLAN_DURATION_LABEL: Record<PlanDurationMonths, string> = {
  1: "۱ ماه · شروع کوتاه و کم‌تعهد",
  3: "۳ ماه · یک چرخه کامل تمرین",
  6: "۶ ماه · ساخت و تثبیت",
  12: "۱۲ ماه · مسیر بلندمدت",
};

export const GOAL_LABEL: Record<GoalId, string> = {
  strength: "قدرت",
  muscle: "عضله‌سازی",
  fat_loss: "کاهش چربی",
  endurance: "استقامت",
  competition: "آمادگی مسابقه",
  health: "سلامت و روند پایدار",
};

export const COACHING_LABEL: Record<CoachingType, string> = {
  ai: "مربی هوشمند",
  hybrid: "هوشمند + بازبینی مربی",
  human: "مربی انسانی",
};

export const PACKAGE_NAME_FA: Record<PackageId, string> = {
  training: "تمرین",
  nutrition: "تغذیه",
  combined: "تمرین + تغذیه",
};
```

---

## 7) `src/services/recommendation/modelTypes.ts`

```ts
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
```

---

## 8) `src/services/recommendation/ensemble.ts`

```ts
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
```

---

## 9) `src/services/recommendation/model.server.ts`

```ts
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
```

---

## 10) `src/services/recommendation/schemaGuard.ts`

```ts
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
```

---

## 11) `src/services/recommendation/features.ts`

```ts
/**
 * Feature extraction: assessment answers → the exact numeric vector the model expects.
 *
 * Rules that keep this honest:
 *  - Unknown inputs fall back to the *training medians* shipped inside model.json,
 *    never to invented "ideal" values.
 *  - Every derived index is clamped to 0..1 so a typo can never explode a feature.
 *  - Availability flags (`*_available`) tell the model whether a value is measured
 *    or imputed, which is why missing data degrades gracefully instead of lying.
 *  - Persian labels of every consumed answer are returned for the "why" panel.
 */
import type { AssessmentAnswers, SportId } from "@/domain/types";
import type { GoalId } from "@/domain/recommendation";
import type {
  BodyCompositionInput,
  RecommendationBehaviorInput,
  RecommendationProfileInput,
} from "@/domain/recommendation";

export interface FeatureExtractionInput {
  sport: SportId;
  profile?: RecommendationProfileInput | undefined;
  answers?: AssessmentAnswers | undefined;
  bodyAnalysis?: BodyCompositionInput | undefined;
  behavior?: RecommendationBehaviorInput | undefined;
}

export interface FeatureExtractionResult {
  named: Record<string, number>;
  used: string[];
  missing: string[];
  goal: GoalId;
  experienceRankOf: number;
  sessionsAvailable: number;
  sessionMinutes: number;
  bodyFatAvailable: boolean;
  behaviorAvailable: boolean;
  strengthAvailable: boolean;
  engineAvailable: boolean;
  measurements: {
    strengthIndex: number;
    engineIndex: number;
    skillIndex: number;
    mobilityIndex: number;
  };
  flags: {
    painSeverity: number;
    painAreas: number;
    sleepHours: number;
    stress: number;
    readinessAvg: number | undefined;
    adherence28d: number | undefined;
    age: number;
    bmi: number;
    bodyFatPct: number | undefined;
  };
}

export const GOAL_BY_OPTION: GoalId[] = [
  "strength",
  "muscle",
  "fat_loss",
  "endurance",
  "competition",
  "health",
];

const EXPERIENCE_RANK_BY_OPTION = [0, 0.6, 1.3, 2.1, 3];
const SESSION_MINUTES_BY_OPTION = [37.5, 52.5, 67.5, 85];
const MILEAGE_BY_OPTION = [0, 7, 18, 35, 55];

function clamp01(v: number): number {
  return Math.min(0.99, Math.max(0.01, v));
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") {
    const normalized = value
      .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
      .replace(/[^\d.-]/g, "");
    if (!normalized) return undefined;
    const n = Number(normalized);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function asOptionIndex(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const match = /^option_(\d+)$/.exec(value);
  if (!match) return undefined;
  const index = Number(match[1]);
  return Number.isFinite(index) ? index : undefined;
}

function asOptionIndexes(value: unknown): number[] {
  if (!Array.isArray(value)) {
    const single = asOptionIndex(value);
    return single ? [single] : [];
  }
  return value.map(asOptionIndex).filter((v): v is number => typeof v === "number");
}

/** Accepts "4:32", "1:12:00" or a plain number of minutes. Returns seconds. */
function asTimeSeconds(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value * 60 : undefined;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parts = trimmed.split(":").map((p) => Number(p.replace(/[^\d.]/g, "")));
  if (parts.some((p) => !Number.isFinite(p))) return undefined;
  if (parts.length === 1) return (parts[0] ?? 0) * 60;
  if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
  if (parts.length === 3) return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
  return undefined;
}

/** Map a measured value onto 0..1 using an explicit "hopeless → elite" range. */
function scaleInto(value: number | undefined, worst: number, best: number): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  if (best === worst) return undefined;
  return clamp01((value - worst) / (best - worst));
}

function mean(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function ratioIndex(
  weight: number | undefined,
  bodyWeight: number,
  low: number,
  high: number,
): number | undefined {
  if (weight === undefined || weight <= 0 || bodyWeight <= 0) return undefined;
  return scaleInto(weight / bodyWeight, low, high);
}

const ANSWER_LABELS: Record<string, string> = {
  "common.profile.age": "سن",
  "common.profile.height_cm": "قد",
  "common.profile.weight_kg": "وزن",
  "common.profile.training_history": "سابقه تمرین منظم",
  "common.goals.primary": "هدف اصلی",
  "common.goals.secondary": "اهداف دوم",
  "common.schedule.sessions_per_week": "جلسات در هفته",
  "common.schedule.minutes_per_session": "مدت هر جلسه",
  "common.lifestyle.work_style": "سبک کار روزانه",
  "common.lifestyle.daily_activity": "فعالیت روزمره",
  "common.access.environment": "محیط تمرین",
  "common.access.equipment": "تجهیزات",
  "common.recovery.sleep_hours": "خواب شبانه",
  "common.recovery.quality": "کیفیت بیدار شدن",
  "common.recovery.stress": "سطح استرس",
  "common.safety.pain": "وضعیت درد/آسیب",
  "common.safety.areas": "ناحیه درد",
  "common.body.condition": "حس بدن",
};

function experienceFromAnswers(answers: AssessmentAnswers, sport: SportId): number | undefined {
  const common = asOptionIndex(answers["common.profile.training_history"]);
  if (common) return EXPERIENCE_RANK_BY_OPTION[common - 1];
  const sportKey: Partial<Record<SportId, string>> = {
    crossfit: "crossfit.history.duration",
    running: "running.base.history",
    bodybuilding: "bodybuilding.history.years",
    hyrox: "hyrox.race.experience",
  };
  const key = sportKey[sport];
  if (!key) return undefined;
  const index = asOptionIndex(answers[key]);
  if (!index) return undefined;
  return EXPERIENCE_RANK_BY_OPTION[Math.min(4, Math.max(0, index - 1))];
}

function goalFromAnswers(answers: AssessmentAnswers): GoalId | undefined {
  const common = asOptionIndex(answers["common.goals.primary"]);
  if (common) return GOAL_BY_OPTION[common - 1];
  return undefined;
}

function sportGoal(answers: AssessmentAnswers, sport: SportId): GoalId | undefined {
  const key: Partial<Record<SportId, string>> = {
    crossfit: "crossfit.level.goal",
    hyrox: "hyrox.race.goal",
    bodybuilding: "bodybuilding.goal.primary",
    functional: "functional.goal.primary",
    running: "running.goal.race",
  };
  const answerKey = key[sport];
  if (!answerKey) return undefined;
  const index = asOptionIndex(answers[answerKey]);
  if (!index) return undefined;

  if (sport === "crossfit") {
    return (["health", "strength", "endurance", "health", "strength", "competition"] as GoalId[])[
      index - 1
    ];
  }
  if (sport === "hyrox") {
    if (index === 3) return "strength";
    if (index === 4 || index === 2) return "endurance";
    if (index === 5) return "competition";
    return "health";
  }
  if (sport === "bodybuilding") {
    return (["muscle", "fat_loss", "muscle", "strength", "competition"] as GoalId[])[index - 1];
  }
  if (sport === "functional") {
    return (["health", "strength", "health", "endurance", "health"] as GoalId[])[index - 1];
  }
  if (index === 1) return "health";
  if (index === 6) return "endurance";
  return "endurance";
}

function equipmentScore(answers: AssessmentAnswers, sport: SportId): number | undefined {
  const common = asOptionIndexes(answers["common.access.equipment"]);
  const commonMap: Record<number, number> = { 1: 0.15, 2: 0.45, 3: 0.75, 4: 0.8, 5: 0.55, 6: 1 };
  if (common.length > 0) {
    return Math.max(...common.map((i) => commonMap[i] ?? 0.3));
  }
  if (sport === "bodybuilding") {
    const values = asOptionIndexes(answers["bodybuilding.equipment.access"]);
    const map: Record<number, number> = { 1: 0.35, 2: 0.75, 3: 0.7, 4: 0.8, 5: 0.65, 6: 1 };
    if (values.length > 0) return Math.max(...values.map((i) => map[i] ?? 0.3));
  }
  if (sport === "functional") {
    const values = asOptionIndexes(answers["functional.environment.access"]);
    const map: Record<number, number> = { 1: 0.1, 2: 0.3, 3: 0.5, 4: 0.55, 5: 0.8, 6: 1 };
    if (values.length > 0) return Math.max(...values.map((i) => map[i] ?? 0.3));
  }
  return undefined;
}

function strengthIndex(
  answers: AssessmentAnswers,
  sport: SportId,
  bodyWeight: number,
): number | undefined {
  const parts: (number | undefined)[] = [];

  if (sport === "crossfit") {
    parts.push(
      ratioIndex(asNumber(answers["crossfit.strength.back_squat_1rm"]), bodyWeight, 0.6, 2.0),
    );
    parts.push(
      ratioIndex(asNumber(answers["crossfit.strength.deadlift_1rm"]), bodyWeight, 0.8, 2.6),
    );
    parts.push(
      ratioIndex(asNumber(answers["crossfit.strength.strict_press_1rm"]), bodyWeight, 0.3, 1.1),
    );
    parts.push(
      ratioIndex(asNumber(answers["crossfit.weightlifting.clean_jerk_1rm"]), bodyWeight, 0.4, 1.7),
    );
    parts.push(
      ratioIndex(asNumber(answers["crossfit.weightlifting.snatch_1rm"]), bodyWeight, 0.3, 1.4),
    );
  } else if (sport === "bodybuilding") {
    parts.push(
      ratioIndex(asNumber(answers["bodybuilding.lifts.bench_press"]), bodyWeight, 0.4, 1.6),
    );
    parts.push(ratioIndex(asNumber(answers["bodybuilding.lifts.squat"]), bodyWeight, 0.6, 2.2));
    parts.push(ratioIndex(asNumber(answers["bodybuilding.lifts.rdl"]), bodyWeight, 0.6, 2.0));
  }

  return mean(parts.filter((v): v is number => typeof v === "number"));
}

function engineIndex(answers: AssessmentAnswers, sport: SportId): number | undefined {
  const parts: (number | undefined)[] = [];

  const row2k = asTimeSeconds(answers["crossfit.engine.row_2k"]);
  parts.push(scaleInto(row2k, 540, 390));
  const run5k = asTimeSeconds(answers["crossfit.engine.run_5k"]);
  parts.push(scaleInto(run5k, 1800, 1050));
  const bike = asNumber(answers["crossfit.engine.bike_10min"]);
  parts.push(scaleInto(bike, 80, 220));
  const fran = asTimeSeconds(answers["crossfit.benchmark.fran"]);
  parts.push(scaleInto(fran, 600, 150));

  if (sport === "running" || sport === "hyrox") {
    const easyPace = asTimeSeconds(
      answers[`${sport}.running.easy_pace`] ?? answers["running.pace.easy"],
    );
    parts.push(scaleInto(easyPace, 420, 235));
    const fiveK = asTimeSeconds(answers["running.records.5k"] ?? answers["hyrox.running.5k_time"]);
    parts.push(scaleInto(fiveK, 2100, 900));
    const tenK = asTimeSeconds(answers["running.records.10k"] ?? answers["hyrox.running.10k_time"]);
    parts.push(scaleInto(tenK, 4500, 1900));
    const half = asTimeSeconds(answers["running.records.half"]);
    parts.push(scaleInto(half, 10800, 4200));
    const oneK = asTimeSeconds(answers["hyrox.running.1k_time"]);
    parts.push(scaleInto(oneK, 420, 200));
  }
  if (sport === "hyrox") {
    const ski = asTimeSeconds(answers["hyrox.stations.ski_1k"]);
    parts.push(scaleInto(ski, 330, 195));
    const row = asTimeSeconds(answers["hyrox.stations.row_1k"]);
    parts.push(scaleInto(row, 300, 185));
    const wallBalls = asNumber(answers["hyrox.stations.wall_balls"]);
    parts.push(scaleInto(wallBalls, 5, 60));
  }
  if (sport === "bodybuilding") {
    const cardio = asOptionIndex(answers["bodybuilding.cardio.frequency"]);
    if (cardio) parts.push([0.15, 0.4, 0.6, 0.3][cardio - 1]);
  }
  if (sport === "functional") {
    const conditioning = asOptionIndex(answers["functional.conditioning.preference"]);
    if (conditioning === 2) parts.push(0.6);
    if (conditioning === 3) parts.push(0.45);
  }

  return mean(parts.filter((v): v is number => typeof v === "number"));
}

function skillIndex(answers: AssessmentAnswers, sport: SportId): number | undefined {
  const parts: (number | undefined)[] = [];

  if (sport === "crossfit") {
    const gymnastics = asOptionIndexes(answers["crossfit.skill.gymnastics"]);
    if (gymnastics.length > 0) parts.push(clamp01(gymnastics.length / 6));
    const advanced = asOptionIndexes(answers["crossfit.skill.advanced"]).filter((i) => i !== 5);
    if (advanced.length > 0) parts.push(clamp01(0.5 + advanced.length / 8));
    const pullups = asNumber(answers["crossfit.strength.strict_pullups"]);
    parts.push(scaleInto(pullups, 0, 20));
    const level = asOptionIndex(answers["crossfit.level.skill"]);
    if (level) parts.push([0.1, 0.3, 0.5, 0.75, 0.92][level - 1]);
  } else if (sport === "functional") {
    const coordination = asOptionIndex(answers["functional.coordination.experience"]);
    if (coordination) parts.push([0.15, 0.4, 0.68, 0.88][coordination - 1]);
    const core = asOptionIndex(answers["functional.strength.core"]);
    if (core) parts.push([0.15, 0.4, 0.65, 0.9][core - 1]);
  } else if (sport === "bodybuilding") {
    const confidence = asOptionIndex(answers["bodybuilding.training.exercise_confidence"]);
    if (confidence) parts.push([0.15, 0.4, 0.7, 0.9][confidence - 1]);
  } else if (sport === "hyrox") {
    const experience = asOptionIndex(answers["hyrox.race.experience"]);
    if (experience) parts.push([0.12, 0.35, 0.6, 0.85][experience - 1]);
  } else if (sport === "running") {
    const zones = asOptionIndex(answers["running.training.zones"]);
    if (zones) parts.push([0.2, 0.4, 0.7, 0.9][zones - 1]);
  }

  return mean(parts.filter((v): v is number => typeof v === "number"));
}

function mobilityIndex(answers: AssessmentAnswers, sport: SportId, experienceRank: number): number {
  const parts: (number | undefined)[] = [];
  const commonCondition = asOptionIndex(answers["common.body.condition"]);
  if (commonCondition === 1) parts.push(0.85);
  if (commonCondition === 2) parts.push(0.6);
  if (commonCondition === 3) parts.push(0.35);
  if (commonCondition === 4) parts.push(0.25);

  if (sport === "functional") {
    const overhead = asOptionIndex(answers["functional.movement.overhead"]);
    if (overhead) parts.push([0.85, 0.55, 0.45, 0.2, 0.5][overhead - 1]);
    const squat = asOptionIndex(answers["functional.movement.squat"]);
    if (squat) parts.push([0.85, 0.5, 0.45, 0.25, 0.5][squat - 1]);
    const areas = asOptionIndexes(answers["functional.mobility.areas"]).filter((i) => i !== 6);
    parts.push(clamp01(0.85 - areas.length * 0.12));
    const balance = asOptionIndex(answers["functional.balance.single_leg"]);
    if (balance) parts.push([0.85, 0.55, 0.35, 0.5][balance - 1]);
  }

  const measured = mean(parts.filter((v): v is number => typeof v === "number"));
  if (measured !== undefined) return measured;
  return clamp01(0.72 - experienceRank * 0.06);
}

function weeklyMileage(answers: AssessmentAnswers, sport: SportId): number | undefined {
  if (sport === "running") {
    const index = asOptionIndex(answers["running.base.weekly_mileage"]);
    if (index) return MILEAGE_BY_OPTION[index - 1];
  }
  if (sport === "hyrox") {
    const index = asOptionIndex(answers["hyrox.running.weekly_distance"]);
    if (index) return MILEAGE_BY_OPTION[index - 1];
    return asNumber(answers["hyrox.running.longest_recent"]);
  }
  return undefined;
}

function painAreas(answers: AssessmentAnswers): number {
  const areas = asOptionIndexes(answers["common.safety.areas"]).filter((i) => i <= 6);
  return areas.length;
}

/**
 * Build the model feature vector.
 * `fillValues` comes from the artefact so imputation can never drift from training.
 */
export function extractFeatures(
  input: FeatureExtractionInput,
  fillValues: Record<string, number>,
): FeatureExtractionResult {
  const answers = input.answers ?? {};
  const profile = input.profile ?? {};
  const behavior = input.behavior ?? {};
  const body = input.bodyAnalysis ?? {};
  const named: Record<string, number> = { ...fillValues };
  const used: string[] = [];
  const missing: string[] = [];
  const mark = (label: string) => {
    if (!used.includes(label)) used.push(label);
  };

  // ---- identity & anthropometrics ---------------------------------------
  const age =
    asNumber(profile.age) ?? asNumber(answers["common.profile.age"]) ?? fillValues["age"] ?? 32;
  if (asNumber(profile.age) !== undefined || asNumber(answers["common.profile.age"]) !== undefined)
    mark("سن");
  else missing.push("سن");

  const heightCm =
    asNumber(profile.heightCm) ??
    asNumber(body.heightCm) ??
    asNumber(answers["common.profile.height_cm"]) ??
    fillValues["height_cm"] ??
    175;
  const weightKg =
    asNumber(body.weightKg) ??
    asNumber(profile.weightKg) ??
    asNumber(answers["common.profile.weight_kg"]) ??
    fillValues["weight_kg"] ??
    76;
  const bmi = heightCm > 0 ? weightKg / (heightCm / 100) ** 2 : (fillValues["bmi"] ?? 24.8);

  const gender = profile.gender;
  const sexMale =
    gender === "male"
      ? 1
      : gender === "female" || gender === "other"
        ? 0
        : (fillValues["sex_male"] ?? 0.5);

  const experienceAnswer = experienceFromAnswers(answers, input.sport);
  const explicitExperience =
    profile.experience === "beginner"
      ? 0
      : profile.experience === "intermediate"
        ? 1
        : profile.experience === "advanced"
          ? 2
          : profile.experience === "elite"
            ? 3
            : undefined;
  const experienceRank =
    explicitExperience ?? experienceAnswer ?? fillValues["experience_rank"] ?? 1;
  if (explicitExperience !== undefined) mark("سطح تجربه");
  else if (experienceAnswer !== undefined) mark("سابقه تمرین");

  const sessionsAvailable =
    asNumber(profile.sessionsPerWeek) ??
    asNumber(answers["common.schedule.sessions_per_week"]) ??
    asNumber(answers[`${input.sport}.schedule.sessions`]) ??
    asNumber(answers["bodybuilding.schedule.sessions"]) ??
    fillValues["sessions_available"] ??
    3;

  const minutesOption = asOptionIndex(answers["common.schedule.minutes_per_session"]);
  const sessionMinutes =
    asNumber(profile.minutesPerSession) ??
    (minutesOption ? SESSION_MINUTES_BY_OPTION[minutesOption - 1] : undefined) ??
    fillValues["session_minutes"] ??
    60;

  // ---- goal --------------------------------------------------------------
  const goal =
    profile.primaryGoal ?? goalFromAnswers(answers) ?? sportGoal(answers, input.sport) ?? "health";
  mark("هدف");

  // ---- training context --------------------------------------------------
  const workStyle = asOptionIndex(answers["common.lifestyle.work_style"]);
  const activity = asOptionIndex(answers["common.lifestyle.daily_activity"]);
  const environment = asOptionIndex(answers["common.access.environment"]);
  const equipment = equipmentScore(answers, input.sport);
  const sleepHours =
    asNumber(answers["common.recovery.sleep_hours"]) ?? fillValues["sleep_hours"] ?? 7;
  const sleepQuality =
    asNumber(answers["common.recovery.quality"]) ?? fillValues["sleep_quality"] ?? 3;
  const stress = asNumber(answers["common.recovery.stress"]) ?? fillValues["stress"] ?? 3;
  const painOption = asOptionIndex(answers["common.safety.pain"]);
  const painFromAreas = painAreas(answers) > 0 ? 1 : 0;
  const painSeverity = painOption
    ? ([0, 1, 1.6, 3][painOption - 1] ?? 0)
    : painFromAreas > 0
      ? Math.min(3, painFromAreas)
      : (fillValues["pain_severity"] ?? 0);

  const secondary = asOptionIndexes(answers["common.goals.secondary"]);
  const wantsMobility = secondary.includes(1) ? 1 : 0;
  const wantsRecovery = secondary.includes(2) ? 1 : 0;
  const wantsConsistency = secondary.includes(3) ? 1 : 0;
  const wantsSkill = secondary.includes(4) ? 1 : 0;

  // ---- measured capacities ----------------------------------------------
  const strengthIdx = strengthIndex(answers, input.sport, weightKg);
  const engineIdx = engineIndex(answers, input.sport);
  const skillIdx = skillIndex(answers, input.sport);
  const mobilityIdx = mobilityIndex(answers, input.sport, experienceRank);
  const mileage = weeklyMileage(answers, input.sport);

  const bodyFatPct = asNumber(body.bodyFatPct);
  const bodyFatAvailable = bodyFatPct !== undefined;

  // ---- behaviour ---------------------------------------------------------
  const planned = asNumber(behavior.plannedSessions);
  const completed = asNumber(behavior.completedSessions);
  const derivedAdherence =
    planned !== undefined && planned > 0 && completed !== undefined
      ? Math.min(1, Math.max(0, completed / planned))
      : undefined;
  // Training adherence is always derived from the training log; nutrition adherence
  // stays a separate signal and is never reused as a proxy for it.
  const adherenceValue = derivedAdherence;
  const behaviorAvailable = adherenceValue !== undefined || completed !== undefined;

  const avgRpe = asNumber(behavior.avgRpe) ?? 0;
  const previousRpe = asNumber(behavior.previousAvgRpe);
  const rpeTrend =
    avgRpe > 0 && previousRpe !== undefined ? Math.max(-2, Math.min(2, avgRpe - previousRpe)) : 0;
  const feedbackCompleteness =
    completed !== undefined && completed > 0 && asNumber(behavior.feedbackCount) !== undefined
      ? Math.min(1, (asNumber(behavior.feedbackCount) ?? 0) / completed)
      : 0;
  const readinessAvg = asNumber(behavior.readinessAvg);
  const nutritionAdherence = asNumber(behavior.nutritionAdherence);

  // ---- write features ----------------------------------------------------
  Object.assign(named, {
    experience_rank: experienceRank,
    training_age_years: Math.max(0, experienceRank * 2.1),
    age,
    sex_male: sexMale,
    height_cm: heightCm,
    weight_kg: weightKg,
    bmi,
    sessions_available: Math.min(7, Math.max(1, sessionsAvailable)),
    session_minutes: sessionMinutes,
    wants_mobility: wantsMobility,
    wants_recovery: wantsRecovery,
    wants_consistency: wantsConsistency,
    wants_skill: wantsSkill,
    equipment_score: equipment ?? fillValues["equipment_score"] ?? 0.5,
    environment_rank: environment ? environment - 1 : (fillValues["environment_rank"] ?? 2),
    activity_level: activity ? activity - 1 : (fillValues["activity_level"] ?? 1.5),
    work_style_rank: workStyle ? workStyle - 1 : (fillValues["work_style_rank"] ?? 1),
    sleep_hours: sleepHours,
    sleep_quality: sleepQuality,
    stress,
    pain_severity: painSeverity,
    pain_area_count: painAreas(answers),
    body_fat_pct: bodyFatPct ?? fillValues["body_fat_pct"] ?? 22,
    body_fat_available: bodyFatAvailable ? 1 : 0,
    strength_index: strengthIdx ?? fillValues["strength_index"] ?? 0.45,
    strength_available: strengthIdx !== undefined ? 1 : 0,
    engine_index: engineIdx ?? fillValues["engine_index"] ?? 0.45,
    engine_available: engineIdx !== undefined ? 1 : 0,
    skill_index: skillIdx ?? Math.min(0.95, 0.12 + experienceRank * 0.23),
    mobility_index: mobilityIdx,
    weekly_mileage: mileage ?? 0,
    adherence_28d: adherenceValue ?? fillValues["adherence_28d"] ?? 0.7,
    adherence_available: adherenceValue !== undefined ? 1 : 0,
    avg_rpe: avgRpe,
    rpe_trend: rpeTrend,
    missed_sessions_28d:
      asNumber(behavior.missedSessions) ??
      (planned !== undefined && completed !== undefined ? Math.max(0, planned - completed) : 0),
    sessions_completed_28d: completed ?? 0,
    feedback_completeness: feedbackCompleteness,
    readiness_avg: readinessAvg ?? 0,
    nutrition_adherence: nutritionAdherence ?? fillValues["nutrition_adherence"] ?? 0.65,
    nutrition_adherence_available: nutritionAdherence !== undefined ? 1 : 0,
    days_since_signup: asNumber(behavior.daysSinceSignup) ?? 0,
    prior_plan_months: asNumber(behavior.priorPlanMonths) ?? 0,
    prior_plan_count: asNumber(behavior.priorPlanCount) ?? 0,
    wearable_connected: behavior.wearableConnected ? 1 : 0,
  });

  for (const sport of ["crossfit", "hyrox", "functional", "bodybuilding", "running"] as const) {
    named[`sport_${sport}`] = input.sport === sport ? 1 : 0;
  }
  for (const goalId of [
    "strength",
    "muscle",
    "fat_loss",
    "endurance",
    "competition",
    "health",
  ] as const) {
    named[`goal_${goalId}`] = goal === goalId ? 1 : 0;
  }

  for (const [key, label] of Object.entries(ANSWER_LABELS)) {
    const belongsToSport =
      !key.includes(".") || key.startsWith(`common.`) || key.startsWith(`${input.sport}.`);
    const answered = answers[key] !== undefined && answers[key] !== "";
    if (belongsToSport && answered && !used.includes(label)) used.push(label);
  }

  const inputChecks: { present: boolean; label: string }[] = [
    {
      present: experienceAnswer !== undefined || explicitExperience !== undefined,
      label: "سطح تجربه",
    },
    { present: planned !== undefined || completed !== undefined, label: "رفتار تمرینی ۲۸ روز" },
    { present: bodyFatAvailable, label: "ترکیب بدن" },
    { present: strengthIdx !== undefined, label: "رکورد قدرت" },
    { present: engineIdx !== undefined, label: "رکورد هوازی" },
    { present: sleepHours !== (fillValues["sleep_hours"] ?? 7), label: "خواب" },
  ];
  for (const check of inputChecks) {
    if (!check.present && !missing.includes(check.label)) missing.push(check.label);
  }

  return {
    named,
    used,
    missing,
    goal,
    experienceRankOf: experienceRank,
    sessionsAvailable: Math.min(7, Math.max(1, sessionsAvailable)),
    sessionMinutes,
    bodyFatAvailable,
    behaviorAvailable,
    strengthAvailable: strengthIdx !== undefined,
    engineAvailable: engineIdx !== undefined,
    measurements: {
      strengthIndex: strengthIdx ?? fillValues["strength_index"] ?? 0.45,
      engineIndex: engineIdx ?? fillValues["engine_index"] ?? 0.45,
      skillIndex: skillIdx ?? Math.min(0.95, 0.12 + experienceRank * 0.23),
      mobilityIndex: mobilityIdx,
    },
    flags: {
      painSeverity,
      painAreas: painAreas(answers),
      sleepHours,
      stress,
      readinessAvg,
      adherence28d: adherenceValue,
      age,
      bmi,
      bodyFatPct,
    },
  };
}

/** Assemble the ordered vector from a named map, defaulting anything unexpected. */
export function toVector(named: Record<string, number>, features: string[]): number[] {
  return features.map((name) => {
    const value = named[name];
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  });
}
```

---

## 12) `src/services/recommendation/archetypes.ts`

```ts
/**
 * Sport structure for every program archetype the model can choose.
 *
 * The model decides *which* archetype fits an athlete; this file defines what that
 * archetype actually looks like as a week of training. Keeping the two separate
 * means retraining never silently changes a published programme, and coaches can
 * review templates without touching the model.
 *
 * Movement names reuse the shared exercise catalog naming where an ID exists.
 */
import type { ProgramDayTemplate } from "@/domain/recommendation";

export interface ArchetypeTemplate {
  id: string;
  days: ProgramDayTemplate[];
  progressionNotes: string[];
  deloadEveryWeeks: number;
}

const day = (
  index: number,
  titleFa: string,
  focusFa: string,
  blocks: ProgramDayTemplate["blocks"],
  mainMovements: string[],
): ProgramDayTemplate => ({ index, titleFa, focusFa, blocks, mainMovements });

export const ARCHETYPE_TEMPLATES: Record<string, ArchetypeTemplate> = {
  /* ---------------------------------------------------------------- CrossFit */
  cf_foundation: {
    id: "cf_foundation",
    days: [
      day(
        1,
        "پایه · اسکوات و پرس",
        "الگوی درست پیش از وزنه",
        ["warmup", "strength", "skill", "cooldown"],
        ["Back Squat", "Strict Press", "Ring Row"],
      ),
      day(
        2,
        "موتور سبک و تکنیک",
        "تنفس و ریتم ثابت",
        ["warmup", "engine", "skill", "cooldown"],
        ["Row intervals", "Kip Swing", "Toes-to-Bar progression"],
      ),
      day(
        3,
        "WOD مقیاس‌شده",
        "تمام کردن با فرم تمیز",
        ["warmup", "wod", "cooldown"],
        ["AMRAP 12", "Farmer Carry", "Plank"],
      ),
    ],
    progressionNotes: [
      "هفته ۱–۲: فقط کیفیت حرکت و آشنایی با اسکیلینگ.",
      "هفته ۳–۴: ۵–۱۰٪ اضافه بار روی حرکات اصلی، بدون تغییر فرمت WOD.",
      "هر ۴ هفته یک هفته سبک‌تر برای تثبیت تکنیک.",
    ],
    deloadEveryWeeks: 4,
  },
  cf_strength_skill: {
    id: "cf_strength_skill",
    days: [
      day(
        1,
        "قدرت · اسکوات",
        "درصدهای ثابت و تکرار کم",
        ["warmup", "strength", "cooldown"],
        ["Back Squat", "Tempo Squat", "Split Squat"],
      ),
      day(
        2,
        "وزنه‌برداری",
        "تکنیک Clean و Snatch",
        ["warmup", "weightlifting", "skill", "cooldown"],
        ["Clean & Jerk", "Snatch", "Front Squat"],
      ),
      day(
        3,
        "ژیمناستیک",
        "پیشرفت مهارت با تکرار کنترل‌شده",
        ["warmup", "skill", "engine", "cooldown"],
        ["Strict Pull-up", "HSPU", "Hollow Hold"],
      ),
      day(
        4,
        "WOD کوتاه سنگین",
        "انتقال قدرت به متکان",
        ["warmup", "wod", "cooldown"],
        ["Thruster", "Chest-to-Bar", "Box Jump"],
      ),
    ],
    progressionNotes: [
      "قدرت با درصد ۱RM برنامه‌ریزی می‌شود؛ اگر رکورد نداریم، RPE 7–8 معیار است.",
      "مهارت‌ها هفته‌ای یک پیشرفت مشخص دارند (مثلاً از Kip به Chest-to-Bar).",
      "هفته چهارم: حجم ۴۰٪ کمتر، شدت حفظ می‌شود.",
    ],
    deloadEveryWeeks: 4,
  },
  cf_engine_competition: {
    id: "cf_engine_competition",
    days: [
      day(
        1,
        "اینتروال موتور",
        "پیس ثابت در بازه‌های طولانی",
        ["warmup", "engine", "cooldown"],
        ["Row 4×1000m", "Bike intervals"],
      ),
      day(
        2,
        "متکان طولانی",
        "مدیریت توان و تنفس",
        ["warmup", "wod", "cooldown"],
        ["20 min AMRAP", "Wall Ball", "Double Under"],
      ),
      day(
        3,
        "قدرت زیر خستگی",
        "حفظ فرم وقتی خسته‌ای",
        ["warmup", "strength", "wod", "cooldown"],
        ["Deadlift", "Clean", "Burpee"],
      ),
      day(
        4,
        "مهارت زیر خستگی",
        "اجرای مهارت با ضربان بالا",
        ["warmup", "skill", "engine", "cooldown"],
        ["Muscle-up", "Handstand Walk", "Rope Climb"],
      ),
      day(
        5,
        "شبیه‌سازی مسابقه",
        "ترکیب کامل روز مسابقه",
        ["warmup", "wod", "cooldown"],
        ["Multi-round simulation", "Sled", "Carry"],
      ),
    ],
    progressionNotes: [
      "۷۰–۸۰٪ جلسات هوازی در Zone 2 نگه داشته می‌شود؛ بقیه شدت بالا.",
      "هر ۳ هفته بار هفته ۲۰٪ کم می‌شود تا شبیه‌سازی مسابقه معنی‌دار بماند.",
      "اگر RPE میانگین بالای ۸.۵ رفت، حجم هفته بعد کاهش می‌یابد.",
    ],
    deloadEveryWeeks: 3,
  },
  cf_balanced_performance: {
    id: "cf_balanced_performance",
    days: [
      day(
        1,
        "قدرت",
        "پایه قدرتی هفته",
        ["warmup", "strength", "cooldown"],
        ["Back Squat", "Bench Press", "Row"],
      ),
      day(
        2,
        "موتور",
        "ظرفیت هوازی",
        ["warmup", "engine", "cooldown"],
        ["Run intervals", "Row", "Bike"],
      ),
      day(
        3,
        "مهارت",
        "یک مهارت هدف",
        ["warmup", "skill", "cooldown"],
        ["Pull-up", "HSPU", "Double Under"],
      ),
      day(
        4,
        "WOD ترکیبی",
        "همه‌چیز در یک جلسه",
        ["warmup", "wod", "cooldown"],
        ["Mixed modal WOD", "Kettlebell", "Carry"],
      ),
    ],
    progressionNotes: [
      "چرخش ۴ هفته‌ای: قدرت → موتور → مهارت → تثبیت.",
      "شدت WOD بین RPE 7 تا 8.5 می‌ماند.",
      "هفته چهارم دیلود ملایم با حفظ یک جلسه شدت.",
    ],
    deloadEveryWeeks: 4,
  },

  /* ------------------------------------------------------------------- Hyrox */
  hx_base_engine: {
    id: "hx_base_engine",
    days: [
      day(
        1,
        "دویدن آسان",
        "ساخت پایه هوازی",
        ["warmup", "engine", "cooldown"],
        ["Easy Run", "Strides"],
      ),
      day(
        2,
        "قدرت پایه",
        "پا و مرکز بدن",
        ["warmup", "strength", "cooldown"],
        ["Goblet Squat", "Split Squat", "Plank"],
      ),
      day(
        3,
        "دایره سبک ایستگاهی",
        "آشنایی با ایستگاه‌ها",
        ["warmup", "wod", "cooldown"],
        ["SkiErg", "Row", "Wall Ball light"],
      ),
    ],
    progressionNotes: [
      "مسافت هفتگی حداکثر ۱۰٪ در هفته اضافه می‌شود.",
      "شدت ایستگاه‌ها سبک است؛ هدف تحمل و تکنیک است، نه زمان.",
      "هر ۴ هفته یک هفته کاهش حجم.",
    ],
    deloadEveryWeeks: 4,
  },
  hx_station_strength: {
    id: "hx_station_strength",
    days: [
      day(
        1,
        "سورتمه و کرری",
        "قدرت کاربردی",
        ["warmup", "strength", "cooldown"],
        ["Sled Push", "Sled Pull", "Farmer Carry"],
      ),
      day(
        2,
        "دویدن با کیفیت",
        "پیوند دویدن و قدرت",
        ["warmup", "engine", "cooldown"],
        ["Tempo Run", "Hill Sprint"],
      ),
      day(
        3,
        "لانژ و وال‌بال",
        "استقامت عضلانی",
        ["warmup", "strength", "wod", "cooldown"],
        ["Sandbag Lunge", "Wall Ball", "Burpee Broad Jump"],
      ),
      day(
        4,
        "ترکیب ایستگاهی",
        "حفظ فرم زیر خستگی",
        ["warmup", "wod", "cooldown"],
        ["Station circuit", "Row", "Carry"],
      ),
    ],
    progressionNotes: [
      "بار سورتمه و کرری هفتگی ۵–۱۰٪ بالا می‌رود تا فرم نشکند.",
      "دویدن با کیفیت حداکثر دو جلسه در هفته.",
      "هفته چهارم: حجم ایستگاه‌ها ۴۰٪ کمتر.",
    ],
    deloadEveryWeeks: 4,
  },
  hx_race_prep: {
    id: "hx_race_prep",
    days: [
      day(
        1,
        "دویدن با pace مسابقه",
        "پیس ثابت بین ایستگاه‌ها",
        ["warmup", "engine", "cooldown"],
        ["Race pace intervals", "1K repeats"],
      ),
      day(
        2,
        "ایستگاه‌های اصلی",
        "قدرت مسابقه‌ای",
        ["warmup", "strength", "cooldown"],
        ["Sled Push", "Sandbag Lunge", "Wall Ball"],
      ),
      day(
        3,
        "شبیه‌سازی نیمی از مسابقه",
        "ترنزیشن و مدیریت توان",
        ["warmup", "wod", "cooldown"],
        ["Half simulation", "SkiErg", "Burpee Broad Jump"],
      ),
      day(
        4,
        "موتور طولانی",
        "ظرفیت هوازی",
        ["warmup", "engine", "cooldown"],
        ["Long Run", "Row steady"],
      ),
      day(
        5,
        "شبیه‌سازی کامل",
        "تمرین روز مسابقه",
        ["warmup", "wod", "cooldown"],
        ["Full simulation", "Compromised running"],
      ),
    ],
    progressionNotes: [
      "شبیه‌سازی کامل حداکثر هر ۲ هفته یک بار.",
      "دو هفته آخر حجم ۳۰٪ کم و پیس مسابقه حفظ می‌شود.",
      "اگر خواب یا آمادگی افت کرد، جلسه شبیه‌سازی به ایستگاه سبک تبدیل می‌شود.",
    ],
    deloadEveryWeeks: 3,
  },
  hx_hybrid_maintenance: {
    id: "hx_hybrid_maintenance",
    days: [
      day(
        1,
        "موتور کوتاه",
        "حفظ آمادگی هوازی",
        ["warmup", "engine", "cooldown"],
        ["Row intervals", "Easy Run"],
      ),
      day(
        2,
        "قدرت ایستگاهی",
        "حفظ قدرت کاربردی",
        ["warmup", "strength", "cooldown"],
        ["Sled Push", "Farmer Carry", "Split Squat"],
      ),
      day(
        3,
        "دایره ترکیبی",
        "نگهداشت توان",
        ["warmup", "wod", "cooldown"],
        ["Station circuit", "Wall Ball", "Row"],
      ),
    ],
    progressionNotes: [
      "حجم کم، شدت متوسط؛ هدف نگهداشت است نه پیشرفت سریع.",
      "اگر یک هفته جا افتاد، جبران با دو جلسه پشت‌سرهم انجام نمی‌شود.",
    ],
    deloadEveryWeeks: 6,
  },

  /* ------------------------------------------------------------- Functional */
  fn_movement_foundation: {
    id: "fn_movement_foundation",
    days: [
      day(
        1,
        "حرکت پایه",
        "اسکوات و هیپ",
        ["warmup", "skill", "strength", "cooldown"],
        ["Goblet Squat", "Hip Hinge", "Dead Bug"],
      ),
      day(
        2,
        "موبیلیتی و تعادل",
        "دامنه حرکت",
        ["warmup", "skill", "cooldown"],
        ["Ankle Mobility", "Single-leg Balance", "Thoracic Rotation"],
      ),
      day(
        3,
        "دایره سبک",
        "تنفس و استقامت پایه",
        ["warmup", "engine", "cooldown"],
        ["Step-up", "Band Row", "Easy Bike"],
      ),
    ],
    progressionNotes: [
      "دو هفته اول فقط الگو و دامنه؛ بار اضافه نمی‌شود.",
      "پیشرفت با افزایش کنترل و تکرار سنجیده می‌شود، نه وزن.",
      "هر ۴ هفته بازآزمایی حرکت.",
    ],
    deloadEveryWeeks: 4,
  },
  fn_strength_balance: {
    id: "fn_strength_balance",
    days: [
      day(
        1,
        "قدرت پایین‌تنه",
        "یک‌طرفه و ثبات",
        ["warmup", "strength", "cooldown"],
        ["Bulgarian Split Squat", "Hip Thrust", "Suitcase Carry"],
      ),
      day(
        2,
        "قدرت بالاتنه",
        "کشش و فشار متعادل",
        ["warmup", "strength", "cooldown"],
        ["Floor Press", "Row", "Overhead Carry"],
      ),
      day(
        3,
        "مرکز بدن و تعادل",
        "انتقال نیرو",
        ["warmup", "skill", "engine", "cooldown"],
        ["Pallof Press", "Single-leg RDL", "Farmer Walk"],
      ),
    ],
    progressionNotes: [
      "بار هفتگی ۲.۵–۵٪ اضافه می‌شود اگر فرم ثابت ماند.",
      "سمت ضعیف‌تر اول تمرین می‌شود.",
    ],
    deloadEveryWeeks: 4,
  },
  fn_conditioning_gpp: {
    id: "fn_conditioning_gpp",
    days: [
      day(
        1,
        "دایره تمام‌بدن",
        "ظرفیت کاری",
        ["warmup", "wod", "cooldown"],
        ["Kettlebell Swing", "Step-up", "Row"],
      ),
      day(
        2,
        "قدرت سبک",
        "حفظ قدرت پایه",
        ["warmup", "strength", "cooldown"],
        ["Goblet Squat", "Push-up", "Band Pull-apart"],
      ),
      day(
        3,
        "اینتروال هوازی",
        "نفس و ریکاوری",
        ["warmup", "engine", "cooldown"],
        ["Bike intervals", "SkiErg"],
      ),
      day(
        4,
        "دایره کوتاه",
        "شدت کنترل‌شده",
        ["warmup", "wod", "cooldown"],
        ["AMRAP 10", "Carry", "Plank"],
      ),
    ],
    progressionNotes: ["هفته‌های ۱–۲ حجم، هفته‌های ۳–۴ شدت.", "حداکثر دو جلسه شدت بالا در هفته."],
    deloadEveryWeeks: 4,
  },
  fn_mobility_recovery: {
    id: "fn_mobility_recovery",
    days: [
      day(
        1,
        "موبیلیتی هدفمند",
        "بازگرداندن دامنه",
        ["warmup", "skill", "cooldown"],
        ["Hip Mobility", "Shoulder CARs", "Breathing Drill"],
      ),
      day(
        2,
        "قدرت سبک",
        "تحمل بار بدون درد",
        ["warmup", "strength", "cooldown"],
        ["Box Squat", "Band Row", "Glute Bridge"],
      ),
      day(
        3,
        "پیاده‌روی و کنترل",
        "گردش خون و تعادل",
        ["warmup", "engine", "cooldown"],
        ["Walk", "Single-leg Balance", "Stretch"],
      ),
    ],
    progressionNotes: [
      "هیچ حرکتی نباید درد بالای ۳ از ۱۰ ایجاد کند.",
      "پیشرفت هفتگی فقط با کاهش درد و افزایش دامنه سنجیده می‌شود.",
      "در صورت تداوم درد، ارجاع به متخصص لازم است.",
    ],
    deloadEveryWeeks: 4,
  },

  /* ----------------------------------------------------------- Bodybuilding */
  bb_full_body_foundation: {
    id: "bb_full_body_foundation",
    days: [
      day(
        1,
        "تمام بدن A",
        "الگوهای اصلی",
        ["warmup", "strength", "cooldown"],
        ["Goblet Squat", "Dumbbell Bench Press", "Lat Pulldown"],
      ),
      day(
        2,
        "تمام بدن B",
        "هیپ و کشش",
        ["warmup", "strength", "cooldown"],
        ["Romanian Deadlift", "Seated Row", "Shoulder Press"],
      ),
      day(
        3,
        "تمام بدن C",
        "بازو و مرکز بدن",
        ["warmup", "strength", "cooldown"],
        ["Split Squat", "Incline Press", "Curl + Triceps"],
      ),
    ],
    progressionNotes: [
      "۲–۳ ست در محدوده ۸–۱۲ تکرار با RIR ۲.",
      "افزایش بار وقتی همه ست‌ها در بالای محدوده تکرار انجام شد.",
      "هفته چهارم حجم ۳۰٪ کمتر.",
    ],
    deloadEveryWeeks: 4,
  },
  bb_upper_lower: {
    id: "bb_upper_lower",
    days: [
      day(
        1,
        "بالاتنه قدرتی",
        "فشار سنگین",
        ["warmup", "strength", "cooldown"],
        ["Bench Press", "Row", "Overhead Press"],
      ),
      day(
        2,
        "پایین‌تنه قدرتی",
        "اسکوات و هیپ",
        ["warmup", "strength", "cooldown"],
        ["Back Squat", "Romanian Deadlift", "Leg Curl"],
      ),
      day(
        3,
        "بالاتنه حجمی",
        "تنش و کنترل",
        ["warmup", "strength", "cooldown"],
        ["Incline Dumbbell Press", "Lat Pulldown", "Lateral Raise"],
      ),
      day(
        4,
        "پایین‌تنه حجمی",
        "دامنه و تقارن",
        ["warmup", "strength", "cooldown"],
        ["Leg Press", "Hip Thrust", "Calf Raise"],
      ),
    ],
    progressionNotes: [
      "جلسات قدرتی ۴–۶ تکرار، جلسات حجمی ۸–۱۵ تکرار.",
      "حجم هفتگی هر گروه عضلانی ۱۰–۲۰ ست می‌ماند.",
      "دیلود هر ۵ هفته.",
    ],
    deloadEveryWeeks: 5,
  },
  bb_push_pull_legs: {
    id: "bb_push_pull_legs",
    days: [
      day(
        1,
        "فشار",
        "سینه، سرشانه، پشت‌بازو",
        ["warmup", "strength", "cooldown"],
        ["Bench Press", "Incline Press", "Lateral Raise"],
      ),
      day(2, "کشش", "پشت و بازو", ["warmup", "strength", "cooldown"], ["Pull-up", "Row", "Curl"]),
      day(
        3,
        "پا",
        "چهارسر و همسترینگ",
        ["warmup", "strength", "cooldown"],
        ["Squat", "Romanian Deadlift", "Leg Extension"],
      ),
      day(
        4,
        "فشار حجمی",
        "تکرار بالا و کنترل",
        ["warmup", "strength", "cooldown"],
        ["Dumbbell Press", "Fly", "Triceps"],
      ),
      day(
        5,
        "کشش حجمی + پا سبک",
        "تقارن و پمپ",
        ["warmup", "strength", "cooldown"],
        ["Cable Row", "Face Pull", "Leg Curl"],
      ),
    ],
    progressionNotes: [
      "حجم بالا نیاز به خواب و تغذیه کافی دارد؛ اگر افت عملکرد دیدی، یک ست از هر حرکت کم کن.",
      "هفته چهارم حجم ۴۰٪ کمتر با حفظ شدت.",
    ],
    deloadEveryWeeks: 4,
  },
  bb_weak_point: {
    id: "bb_weak_point",
    days: [
      day(
        1,
        "اولویت اول",
        "حجم اختصاصی",
        ["warmup", "strength", "cooldown"],
        ["Weak-point lift", "Isolation", "Stretch"],
      ),
      day(
        2,
        "بالاتنه متعادل",
        "حفظ تناسب",
        ["warmup", "strength", "cooldown"],
        ["Bench Press", "Row", "Lateral Raise"],
      ),
      day(
        3,
        "اولویت دوم",
        "حجم اختصاصی",
        ["warmup", "strength", "cooldown"],
        ["Second priority lift", "Tempo work", "Core"],
      ),
      day(
        4,
        "پایین‌تنه",
        "قدرت پایه",
        ["warmup", "strength", "cooldown"],
        ["Squat", "Hip Thrust", "Calf Raise"],
      ),
    ],
    progressionNotes: [
      "عضلات عقب‌مانده ۲ بار در هفته و اول جلسه تمرین می‌شوند.",
      "حجم اضافه فقط اگر ریکاوری و خواب کافی بود.",
    ],
    deloadEveryWeeks: 4,
  },

  /* ---------------------------------------------------------------- Running */
  rn_base_build: {
    id: "rn_base_build",
    days: [
      day(
        1,
        "دوی آسان",
        "ساخت پایه هوازی",
        ["warmup", "engine", "cooldown"],
        ["Easy Run", "Strides"],
      ),
      day(
        2,
        "قدرت مکمل",
        "ثبات لگن و ساق",
        ["warmup", "strength", "cooldown"],
        ["Split Squat", "Calf Raise", "Single-leg RDL"],
      ),
      day(3, "دوی طولانی سبک", "تحمل هوازی", ["warmup", "engine", "cooldown"], ["Long Easy Run"]),
    ],
    progressionNotes: [
      "مسافت هفتگی حداکثر ۱۰٪ رشد می‌کند.",
      "۸۰٪ دویدن‌ها باید قابل گفتگو باشند.",
      "هر ۴ هفته یک هفته کاهش حجم ۲۵٪.",
    ],
    deloadEveryWeeks: 4,
  },
  rn_threshold_5k10k: {
    id: "rn_threshold_5k10k",
    days: [
      day(1, "اینتروال", "سرعت و VO2max", ["warmup", "engine", "cooldown"], ["5×800m", "Strides"]),
      day(2, "دوی آسان", "ریکاوری فعال", ["warmup", "engine", "cooldown"], ["Easy Run"]),
      day(3, "تمپو", "آستانه لاکتات", ["warmup", "engine", "cooldown"], ["Tempo 20 min"]),
      day(
        4,
        "قدرت و پیشگیری از آسیب",
        "ثبات",
        ["warmup", "strength", "cooldown"],
        ["Single-leg RDL", "Calf Raise", "Core"],
      ),
    ],
    progressionNotes: [
      "یک جلسه کیفیت اضافه در هفته ممنوع؛ بین دو جلسه شدید حداقل ۴۸ ساعت.",
      "تمپو با RPE 6–7 اجرا می‌شود.",
      "دو هفته قبل از مسابقه حجم ۲۵٪ کم می‌شود.",
    ],
    deloadEveryWeeks: 4,
  },
  rn_half_marathon: {
    id: "rn_half_marathon",
    days: [
      day(1, "لانگ‌ران", "تحمل مسافت", ["warmup", "engine", "cooldown"], ["Long Run"]),
      day(2, "دوی آسان", "ریکاوری", ["warmup", "engine", "cooldown"], ["Easy Run"]),
      day(
        3,
        "تمپو / ماراتن‌پیست",
        "پیس هدف",
        ["warmup", "engine", "cooldown"],
        ["Tempo", "Race pace blocks"],
      ),
      day(4, "اینتروال سبک", "اقتصاد دویدن", ["warmup", "engine", "cooldown"], ["6×400m"]),
      day(
        5,
        "قدرت مکمل",
        "پایداری مفاصل",
        ["warmup", "strength", "cooldown"],
        ["Hip Thrust", "Calf Raise", "Core"],
      ),
    ],
    progressionNotes: [
      "لانگ‌ران هر هفته بیشتر از ۱۰٪ رشد نمی‌کند.",
      "هفته سوم هر ۴ هفته کاهش حجم ۳۰٪.",
      "دو هفته آخر تیپر با حفظ یک جلسه پیس مسابقه.",
    ],
    deloadEveryWeeks: 4,
  },
  rn_speed_maintenance: {
    id: "rn_speed_maintenance",
    days: [
      day(1, "اینتروال کوتاه", "حفظ سرعت", ["warmup", "engine", "cooldown"], ["8×200m"]),
      day(2, "دوی آسان", "حفظ پایه", ["warmup", "engine", "cooldown"], ["Easy Run"]),
      day(
        3,
        "قدرت سبک",
        "پیشگیری از آسیب",
        ["warmup", "strength", "cooldown"],
        ["Split Squat", "Calf Raise", "Core"],
      ),
    ],
    progressionNotes: [
      "هدف نگهداشت است؛ حجم ثابت می‌ماند.",
      "اگر یک هفته از دست رفت، با شدت بالا جبران نکن.",
    ],
    deloadEveryWeeks: 6,
  },
};

/** Safe default when a retrained model introduces an id the UI does not know yet. */
export function getArchetypeTemplate(id: string, sportIds: string[]): ArchetypeTemplate {
  const direct = ARCHETYPE_TEMPLATES[id];
  if (direct) return direct;
  for (const candidate of sportIds) {
    const template = ARCHETYPE_TEMPLATES[candidate];
    if (template) return template;
  }
  return ARCHETYPE_TEMPLATES["cf_foundation"]!;
}
```

---

## 13) `src/services/recommendation/nutrition.ts`

```ts
/**
 * Nutrition structure keyed by the model's strategy output.
 *
 * Scope discipline (same rule as the rest of the platform): this produces
 * *structure and ranges*, never a calorie prescription, never a medical claim.
 * Everything is expressed per kilogram of body weight so a coach or dietitian can
 * review it, and the UI must show the disclaimer returned in `notes`.
 */
import type { SportId } from "@/domain/types";
import type {
  DayTypeNutrition,
  MealSlotTemplate,
  NutritionRecommendation,
  NutritionStrategyId,
} from "@/domain/recommendation";

interface StrategyMeta {
  id: NutritionStrategyId;
  labelFa: string;
  summaryFa: string;
  energyIntentFa: string;
  protein: [number, number];
  carb: [number, number];
  fat: [number, number];
  meals: MealSlotTemplate[];
  weeklyAdjustments: string[];
  sportNotes: Partial<Record<SportId, string[]>>;
}

const MEAL = (
  titleFa: string,
  timingFa: string,
  templateFa: string,
  focus: MealSlotTemplate["focus"],
): MealSlotTemplate => ({ titleFa, timingFa, templateFa, focus });

const BREAKFAST = (focus: MealSlotTemplate["focus"]): MealSlotTemplate =>
  MEAL("صبحانه", "۳۰–۶۰ دقیقه بعد از بیدار شدن", "پروتئین + کربوهیدرات کامل + میوه", focus);

const STRATEGIES: Record<NutritionStrategyId, StrategyMeta> = {
  fat_loss_deficit: {
    id: "fat_loss_deficit",
    labelFa: "کاهش چربی با کسری کنترل‌شده",
    summaryFa: "کسری ملایم، پروتئین بالا و حفظ عملکرد تمرین؛ بدون گرسنگی شدید.",
    energyIntentFa: "کسری انرژی حدود ۱۰ تا ۲۰ درصد نسبت به نیاز تقریبی",
    protein: [2.0, 2.4],
    carb: [2.0, 3.0],
    fat: [0.7, 0.9],
    meals: [
      BREAKFAST("protein"),
      MEAL("ناهار", "وسط روز", "پروتئین کامل + سبزیجات زیاد + کربوهیدرات متوسط", "balanced"),
      MEAL("قبل تمرین", "۶۰–۹۰ دقیقه قبل", "کربوهیدرات سبک و کم‌چرب", "carb"),
      MEAL(
        "بعد تمرین / شام",
        "تا ۲ ساعت بعد",
        "پروتئین + کربوهیدرات متناسب با شدت جلسه",
        "protein",
      ),
    ],
    weeklyAdjustments: [
      "هر دو هفته وزن و دور کمر اندازه‌گیری شود؛ تغییر بیش از ۰.۷٪ وزن در هفته معمولاً سریع است.",
      "در هفته‌های پرحجم، کربوهیدرات را حذف نکن؛ کسری را از چربی و وعده‌های اضافه بگیر.",
    ],
    sportNotes: {
      running: ["قبل از دوی طولانی کربوهیدرات سبک را حذف نکن؛ کسری شدید کیفیت جلسه را می‌شکند."],
      crossfit: [
        "در روزهای متکان طولانی، کربوهیدرات قبل تمرین را نگه دار و کسری را به روز استراحت منتقل کن.",
      ],
      bodybuilding: ["پروتئین را روی ۴ وعده تقسیم کن تا در کسری، توده عضلانی حفظ شود."],
    },
  },
  lean_gain: {
    id: "lean_gain",
    labelFa: "افزایش وزن تدریجی و عضله‌سازی",
    summaryFa: "مازاد انرژی کنترل‌شده با کربوهیدرات کافی و پروتئین پخش‌شده در روز.",
    energyIntentFa: "مازاد انرژی حدود ۸ تا ۱۵ درصد با رشد آهسته و قابل کنترل",
    protein: [1.8, 2.2],
    carb: [3.5, 5.0],
    fat: [0.9, 1.2],
    meals: [
      BREAKFAST("carb"),
      MEAL("قبل تمرین", "۹۰ دقیقه قبل", "کربوهیدرات اصلی + پروتئین سبک", "carb"),
      MEAL("بعد تمرین", "تا ۲ ساعت بعد", "پروتئین + کربوهیدرات سریع‌تر", "protein"),
      MEAL("ناهار / شام", "وعده اصلی", "پروتئین + برنج/سیب‌زمینی + چربی سالم", "balanced"),
    ],
    weeklyAdjustments: [
      "افزایش وزن هدف ۰.۲۵ تا ۰.۵ درصد وزن بدن در هفته است.",
      "اگر دو هفته وزن ثابت ماند، یک میان‌وعده کربوهیدراتی اضافه کن، نه یک وعده کامل.",
    ],
    sportNotes: {
      bodybuilding: [
        "پروتئین هر وعده حدود ۰.۴ گرم به ازای هر کیلو وزن بدن؛ حداقل ۳ وعده پروتئینی.",
      ],
      crossfit: ["کربوهیدرات اطراف جلسات شدید را نگه دار تا کیفیت WOD افت نکند."],
    },
  },
  performance_fuel: {
    id: "performance_fuel",
    labelFa: "سوخت عملکرد",
    summaryFa: "انرژی کافی برای جلسات شدید و مسابقه؛ اولویت با زمان‌بندی کربوهیدرات.",
    energyIntentFa: "انرژی در محدوده نگهداشت تا مازاد کوچک، بر اساس بار تمرین",
    protein: [1.6, 2.0],
    carb: [4.5, 7.0],
    fat: [0.9, 1.3],
    meals: [
      BREAKFAST("carb"),
      MEAL("قبل تمرین", "۲–۳ ساعت قبل", "وعده کربوهیدرات‌محور با پروتئین متوسط", "carb"),
      MEAL("حین/بعد تمرین", "بر اساس طول جلسه", "کربوهیدرات سریع در جلسات بالای ۷۵ دقیقه", "carb"),
      MEAL("بعد تمرین", "تا ۲ ساعت بعد", "پروتئین + کربوهیدرات برای بازسازی", "protein"),
      MEAL("شام", "عصر", "پروتئین + سبزیجات + چربی سالم", "balanced"),
    ],
    weeklyAdjustments: [
      "روزهای سنگین کربوهیدرات بیشتر، روزهای استراحت کمتر (کارب‌سایکلینگ ساده).",
      "دو هفته قبل مسابقه ساختار وعده‌ها را تغییر نده؛ فقط حجم را با بار تمرین تنظیم کن.",
    ],
    sportNotes: {
      running: ["جلسات بالای ۹۰ دقیقه: ۳۰ تا ۶۰ گرم کربوهیدرات در ساعت."],
      hyrox: ["بین ایستگاه‌ها و دویدن، کربوهیدرات سریع و الکترولیت برنامه‌ریزی شود."],
      crossfit: ["برای متکان‌های بالای ۲۰ دقیقه، ۲۰–۳۰ گرم کربوهیدرات قبل شروع."],
      functional: [
        "روی نظم وعده‌ها تمرکز کن؛ عملکرد در تمرین‌های کوتاه بیشتر به انرژی روزانه وابسته است.",
      ],
    },
  },
  maintenance: {
    id: "maintenance",
    labelFa: "نگهداشت و سلامت",
    summaryFa: "تعادل انرژی، پروتئین کافی و الگوی پایدار؛ بدون محدودیت سخت.",
    energyIntentFa: "انرژی در محدوده نگهداشت تقریبی",
    protein: [1.6, 2.0],
    carb: [3.0, 4.5],
    fat: [0.9, 1.2],
    meals: [
      BREAKFAST("balanced"),
      MEAL("ناهار", "وسط روز", "پروتئین + غلات کامل + سبزیجات", "balanced"),
      MEAL("میان‌وعده", "بعدازظهر", "میوه/ماست/آجیل", "light"),
      MEAL("شام", "عصر", "پروتئین + سبزیجات + کربوهیدرات متوسط", "balanced"),
    ],
    weeklyAdjustments: [
      "هفته‌ای یک بار الگوی وعده‌ها را مرور کن؛ هدف پایداری است نه تغییر سریع.",
      "در هفته‌های پرفشار، پروتئین را ثابت نگه دار و کربوهیدرات را کمی بالا ببر.",
    ],
    sportNotes: {
      functional: ["نظم وعده‌ها مهم‌تر از جزئیات ماکروها است."],
    },
  },
  recomp: {
    id: "recomp",
    labelFa: "بازترکیب بدن",
    summaryFa: "پروتئین بالا، انرژی نزدیک نگهداشت و بار تمرین باکیفیت برای تغییر ترکیب بدن.",
    energyIntentFa: "انرژی نزدیک نگهداشت با نوسان کوچک بر اساس روز تمرین",
    protein: [2.2, 2.6],
    carb: [2.5, 3.5],
    fat: [0.8, 1.0],
    meals: [
      BREAKFAST("protein"),
      MEAL("قبل تمرین", "۹۰ دقیقه قبل", "کربوهیدرات متوسط + پروتئین", "carb"),
      MEAL("بعد تمرین", "تا ۲ ساعت بعد", "پروتئین بالا + کربوهیدرات متوسط", "protein"),
      MEAL("شام", "عصر", "پروتئین + سبزیجات + چربی سالم", "balanced"),
    ],
    weeklyAdjustments: [
      "تغییر ترکیب بدن آهسته است؛ هر ۳–۴ هفته با اندازه‌گیری ارزیابی شود.",
      "روزهای استراحت کربوهیدرات کمی کمتر و پروتئین ثابت.",
    ],
    sportNotes: {
      bodybuilding: ["پروتئین را روی ۴ وعده پخش کن؛ RIR تمرین را زیر نظر بگیر."],
    },
  },
};

const DAY_TYPES: DayTypeNutrition[] = [
  {
    dayType: "hard",
    labelFa: "روز سنگین",
    carbMultiplier: 1.3,
    noteFa: "کربوهیدرات اطراف جلسه را کامل کن؛ وعده قبل تمرین حذف نشود.",
  },
  {
    dayType: "training",
    labelFa: "روز تمرین معمولی",
    carbMultiplier: 1.0,
    noteFa: "ساختار عادی روز؛ وعده بعد تمرین را جا نینداز.",
  },
  {
    dayType: "rest",
    labelFa: "روز استراحت",
    carbMultiplier: 0.75,
    noteFa: "پروتئین ثابت، کربوهیدرات کمی کمتر، سبزیجات بیشتر.",
  },
];

export interface NutritionBuildContext {
  sport: SportId;
  weightKg: number;
  mealsPerDay: number;
  goalLabelFa: string;
  restrictions?: string[] | undefined;
  strategyOverrideNote?: string | undefined;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

export function buildNutritionRecommendation(
  strategyId: NutritionStrategyId,
  ctx: NutritionBuildContext,
): NutritionRecommendation {
  const meta = STRATEGIES[strategyId] ?? STRATEGIES.maintenance;
  const sportNotes = meta.sportNotes[ctx.sport] ?? [];
  const hydrationL = round1(
    Math.min(
      4.5,
      Math.max(
        1.8,
        ctx.weightKg * 0.033 + (ctx.sport === "hyrox" || ctx.sport === "running" ? 0.4 : 0.2),
      ),
    ),
  );
  const meals = meta.meals.slice(0, Math.max(3, Math.min(5, Math.round(ctx.mealsPerDay))));

  const notes = [
    ...sportNotes,
    ...(ctx.restrictions && ctx.restrictions.length > 0
      ? [`محدودیت‌های ثبت‌شده در ساختار وعده‌ها لحاظ شود: ${ctx.restrictions.join("، ")}.`]
      : []),
    ...(ctx.strategyOverrideNote ? [ctx.strategyOverrideNote] : []),
    "این ساختار آموزشی است، نه تجویز پزشکی یا رژیم درمانی؛ در شرایط پزشکی یا بارداری با متخصص تغذیه مشورت شود.",
  ];

  return {
    strategyId: meta.id,
    labelFa: meta.labelFa,
    summaryFa: meta.summaryFa,
    energyIntentFa: meta.energyIntentFa,
    macros: [
      {
        id: "protein",
        labelFa: "پروتئین",
        gPerKg: meta.protein,
        roleFa: "حفظ و ساخت عضله و سیری",
      },
      {
        id: "carb",
        labelFa: "کربوهیدرات",
        gPerKg: [round1(meta.carb[0]), round1(meta.carb[1])],
        roleFa: "سوخت جلسات شدید و بازسازی گلیکوژن",
      },
      {
        id: "fat",
        labelFa: "چربی",
        gPerKg: meta.fat,
        roleFa: "تعادل هورمونی و انرژی پایدار",
      },
    ],
    hydrationL,
    mealsPerDay: meals.length,
    meals,
    dayTypes: DAY_TYPES,
    weeklyAdjustments: meta.weeklyAdjustments,
    notes,
  };
}

/** Strategy label lookup for the UI / explanation panel. */
export function nutritionStrategyLabel(id: NutritionStrategyId): string {
  return (STRATEGIES[id] ?? STRATEGIES.maintenance).labelFa;
}
```

---

## 14) `src/services/recommendation/guardrails.ts`

```ts
/**
 * Safety and constraint layer applied *after* the model.
 *
 * The model is a recommender, not an authority. These guardrails can override its
 * output for pain, sleep debt, readiness, adherence history, minor athletes and
 * explicit user constraints. Every override is surfaced as a flag plus a Persian
 * explanation so nothing happens silently. They never claim a diagnosis.
 */
import type {
  CoachingType,
  GoalId,
  NutritionStrategyId,
  PlanDurationMonths,
  RecommendationConstraints,
  SafetyFlag,
} from "@/domain/recommendation";
import type { SportId } from "@/domain/types";
import { faNumber } from "@/lib/locale";
import { HIGH_IMPACT_ARCHETYPES, LOW_IMPACT_ARCHETYPE } from "./rules";

const DURATION_ORDER: PlanDurationMonths[] = [1, 3, 6, 12];
const COACHING_ORDER: CoachingType[] = ["ai", "hybrid", "human"];

export interface GuardrailPrediction {
  archetypeId: string;
  sessions: number;
  sessionMinutes: number;
  durationMonths: PlanDurationMonths;
  coaching: CoachingType;
  nutrition: NutritionStrategyId;
  adherence: number;
}

export interface GuardrailFacts {
  goal: GoalId;
  painSeverity: number;
  painAreas: number;
  sleepHours: number;
  stress: number;
  readinessAvg: number | undefined;
  adherence28d: number | undefined;
  age: number;
  bmi: number;
  bodyFatPct: number | undefined;
}

export interface GuardrailResult {
  archetypeId: string;
  sessions: number;
  durationMonths: PlanDurationMonths;
  coaching: CoachingType;
  nutrition: NutritionStrategyId;
  flags: SafetyFlag[];
  notes: string[];
  archetypeChanged: boolean;
  durationChanged: boolean;
  coachingChanged: boolean;
  nutritionChanged: boolean;
  durationReason?: string;
  coachingReason?: string;
  nutritionReason?: string;
}

const FLAG_TEXT: Record<
  SafetyFlag["code"],
  { labelFa: string; actionFa: string; severity: SafetyFlag["severity"] }
> = {
  pain_clinician_limited: {
    labelFa: "تمرین توسط پزشک محدود شده است",
    actionFa: "برنامه به نسخه کم‌فشار تغییر کرد و نیاز به تأیید مربی/متخصص دارد.",
    severity: "review_required",
  },
  pain_reported: {
    labelFa: "درد یا محدودیت گزارش‌شده",
    actionFa: "شدت و دامنه حرکت کنترل می‌شود؛ اگر درد بیشتر از ۳ از ۱۰ شد، جلسه متوقف شود.",
    severity: "caution",
  },
  low_sleep: {
    labelFa: "خواب کمتر از ۶ ساعت",
    actionFa: "یک جلسه از حجم هفته کم شد؛ هدف فعلی تثبیت خواب است.",
    severity: "caution",
  },
  high_stress: {
    labelFa: "استرس روزانه بالا",
    actionFa: "حجم هفته کاهش یافت و شدت‌های بسیار بالا به تعویق افتاد.",
    severity: "caution",
  },
  low_readiness: {
    labelFa: "آمادگی پایین در ۲۸ روز گذشته",
    actionFa: "بار تمرین کم شد و روی کیفیت خواب و ریکاوری تمرکز شد.",
    severity: "caution",
  },
  low_adherence: {
    labelFa: "پایبندی پایین در دوره قبل",
    actionFa: "دوره کوتاه‌تر و پشتیبانی بیشتری پیشنهاد شد تا شروع دوباره ساده باشد.",
    severity: "caution",
  },
  underweight: {
    labelFa: "شاخص توده بدنی پایین",
    actionFa: "هدف تغذیه از کاهش وزن به ساخت تدریجی تغییر کرد.",
    severity: "caution",
  },
  minor_athlete: {
    labelFa: "ورزشکار زیر ۱۶ سال",
    actionFa: "برنامه محافظه‌کارانه با نظارت مربی انسانی پیشنهاد می‌شود.",
    severity: "review_required",
  },
  high_volume_cap: {
    labelFa: "سقف جلسات اعمال شد",
    actionFa: "تعداد جلسات با زمان واقعی در دسترس یا محدودیت انتخابی هماهنگ شد.",
    severity: "info",
  },
  nutrition_risk: {
    labelFa: "نیاز به بازبینی تغذیه",
    actionFa: "ساختار تغذیه محافظه‌کارانه‌تر انتخاب شد؛ بازبینی متخصص توصیه می‌شود.",
    severity: "caution",
  },
};

function flag(code: SafetyFlag["code"]): SafetyFlag {
  const text = FLAG_TEXT[code];
  return { code, labelFa: text.labelFa, actionFa: text.actionFa, severity: text.severity };
}

function lowerDuration(current: PlanDurationMonths, cap: PlanDurationMonths): PlanDurationMonths {
  return DURATION_ORDER.indexOf(current) <= DURATION_ORDER.indexOf(cap) ? current : cap;
}

function maxDuration(a: PlanDurationMonths, b: PlanDurationMonths): PlanDurationMonths {
  return DURATION_ORDER.indexOf(a) >= DURATION_ORDER.indexOf(b) ? a : b;
}

function escalateCoaching(current: CoachingType, minimum: CoachingType): CoachingType {
  return COACHING_ORDER.indexOf(current) >= COACHING_ORDER.indexOf(minimum) ? current : minimum;
}

export function applyGuardrails(args: {
  sport: SportId;
  prediction: GuardrailPrediction;
  facts: GuardrailFacts;
  constraints?: RecommendationConstraints | undefined;
  sessionsAvailable: number;
}): GuardrailResult {
  const { sport, facts, constraints } = args;
  const flags: SafetyFlag[] = [];
  const notes: string[] = [];
  let archetypeId = args.prediction.archetypeId;
  let sessions = args.prediction.sessions;
  let durationMonths = args.prediction.durationMonths;
  let coaching = args.prediction.coaching;
  let nutrition = args.prediction.nutrition;
  let archetypeChanged = false;
  let durationChanged = false;
  let coachingChanged = false;
  let nutritionChanged = false;
  let durationReason: string | undefined;
  let coachingReason: string | undefined;
  let nutritionReason: string | undefined;
  // Hard caps derived from safety. User preferences may shorten these, never extend them.
  let safetySessionCap = 6;
  let safetyDurationCap: PlanDurationMonths = 12;

  const capSessions = (cap: number) => {
    const bounded = Math.max(1, Math.min(sessions, Math.floor(cap)));
    if (bounded !== sessions) sessions = bounded;
  };

  // --- pain / injury ------------------------------------------------------
  if (facts.painSeverity >= 3) {
    archetypeId = LOW_IMPACT_ARCHETYPE[sport];
    archetypeChanged = archetypeId !== args.prediction.archetypeId;
    safetySessionCap = 3;
    safetyDurationCap = 3;
    capSessions(safetySessionCap);
    coaching = "human";
    durationMonths = lowerDuration(durationMonths, safetyDurationCap);
    flags.push(flag("pain_clinician_limited"));
    notes.push("تا تأیید متخصص، فقط حرکات کم‌فشار و دامنه بی‌درد اجرا شود.");
  } else if (facts.painSeverity >= 1.6) {
    if (HIGH_IMPACT_ARCHETYPES.has(archetypeId)) {
      archetypeId = LOW_IMPACT_ARCHETYPE[sport];
      archetypeChanged = true;
    }
    capSessions(Math.max(2, sessions - 1));
    coaching = escalateCoaching(coaching, "hybrid");
    flags.push(flag("pain_reported"));
  } else if (facts.painSeverity > 0 || facts.painAreas > 0) {
    flags.push(flag("pain_reported"));
    notes.push("حرکات دردناک با نسخه ساده‌تر جایگزین می‌شوند؛ درد بالای ۳ از ۱۰ معیار توقف است.");
  }

  // --- recovery budget ----------------------------------------------------
  if (facts.sleepHours < 6) {
    capSessions(Math.max(2, sessions - 1));
    flags.push(flag("low_sleep"));
  }
  if (facts.stress >= 5) {
    capSessions(Math.max(2, sessions - 1));
    flags.push(flag("high_stress"));
  }
  if (facts.readinessAvg !== undefined && facts.readinessAvg > 0 && facts.readinessAvg < 50) {
    capSessions(Math.max(2, sessions - 1));
    flags.push(flag("low_readiness"));
  }

  // --- behaviour ----------------------------------------------------------
  if (facts.adherence28d !== undefined && facts.adherence28d < 0.5) {
    safetyDurationCap = 1;
    if (durationMonths !== 1) {
      durationMonths = 1;
      durationChanged = true;
      durationReason =
        "پایبندی ۲۸ روز گذشته پایین بود؛ شروع با یک دوره یک‌ماهه شانس ادامه دادن را بالا می‌برد.";
    }
    coaching = escalateCoaching(coaching, "hybrid");
    flags.push(flag("low_adherence"));
  }

  // --- body composition / nutrition --------------------------------------
  if (facts.bmi < 18.5 && (nutrition === "fat_loss_deficit" || nutrition === "recomp")) {
    nutrition = "lean_gain";
    nutritionChanged = true;
    nutritionReason = "شاخص توده بدنی پایین است؛ هدف تغذیه به ساخت تدریجی وزن تغییر کرد.";
    flags.push(flag("underweight"));
  }
  if (facts.bodyFatPct !== undefined && facts.bodyFatPct < 8 && nutrition === "fat_loss_deficit") {
    nutrition = "recomp";
    nutritionChanged = true;
    nutritionReason = "درصد چربی پایین است؛ ادامه کسری انرژی می‌تواند عملکرد را آسیب بزند.";
    flags.push(flag("nutrition_risk"));
  }

  // --- minor athletes -----------------------------------------------------
  if (facts.age < 16) {
    safetySessionCap = Math.min(safetySessionCap, 3);
    safetyDurationCap = lowerDuration(safetyDurationCap, 3);
    capSessions(safetySessionCap);
    coaching = "human";
    durationMonths = lowerDuration(durationMonths, safetyDurationCap);
    flags.push(flag("minor_athlete"));
    notes.push("برای ورزشکار زیر ۱۶ سال، تمرین با وزنه سنگین و حجم بالا توصیه نمی‌شود.");
  }

  // --- explicit constraints ----------------------------------------------
  if (constraints?.maxSessionsPerWeek !== undefined && constraints.maxSessionsPerWeek > 0) {
    const before = sessions;
    capSessions(Math.min(constraints.maxSessionsPerWeek, safetySessionCap));
    if (sessions !== before) flags.push(flag("high_volume_cap"));
  }
  const sessionCapacity = Math.max(1, Math.min(args.sessionsAvailable, 6));
  const beforeCapacity = sessions;
  capSessions(sessionCapacity);
  if (sessions !== beforeCapacity && !flags.some((f) => f.code === "high_volume_cap")) {
    flags.push(flag("high_volume_cap"));
  }

  const requestedDuration = constraints?.durationMonths;
  if (requestedDuration && requestedDuration !== "auto") {
    if (DURATION_ORDER.indexOf(requestedDuration) > DURATION_ORDER.indexOf(safetyDurationCap)) {
      // Safety wins over a commercial preference; explain instead of silently ignoring it.
      if (durationMonths !== safetyDurationCap) durationMonths = safetyDurationCap;
      durationChanged = true;
      durationReason = `دوره ${faNumber(requestedDuration)} ماهه با شرایط فعلی (ایمنی/پایبندی) هم‌خوان نبود؛ حداکثر ${faNumber(safetyDurationCap)} ماه پیشنهاد می‌شود.`;
    } else if (requestedDuration !== durationMonths) {
      durationMonths = requestedDuration;
      durationChanged = true;
      durationReason = "طول دوره مطابق انتخاب خود ورزشکار تنظیم شد.";
    }
  }

  const requestedCoaching = constraints?.coachingPreference;
  if (requestedCoaching && requestedCoaching !== "auto") {
    // Never downgrade below what safety demanded.
    coaching = escalateCoaching(coaching, requestedCoaching);
    if (coaching !== args.prediction.coaching) {
      coachingChanged = true;
      coachingReason = "نوع مربیگری مطابق انتخاب ورزشکار اعمال شد.";
    }
  }

  // --- final sanity -------------------------------------------------------
  sessions = Math.max(1, Math.min(6, sessions));
  durationMonths = maxDuration(1, durationMonths);
  if (coaching !== args.prediction.coaching && !coachingReason) {
    coachingChanged = true;
    coachingReason =
      coaching === "human"
        ? "با توجه به درد/شرایط خاص، بازبینی مربی انسانی لازم است."
        : "برای این ترکیب ریسک، بازبینی مربی انسانی در کنار موتور هوشمند توصیه می‌شود.";
  }
  if (archetypeId !== args.prediction.archetypeId && !notes.some((n) => n.includes("کم‌فشار"))) {
    notes.push("نوع برنامه به نسخه محافظه‌کارانه‌تر تغییر کرد تا با شرایط فعلی بدن هماهنگ باشد.");
  }

  return {
    archetypeId,
    sessions,
    durationMonths,
    coaching,
    nutrition,
    flags,
    notes,
    archetypeChanged,
    durationChanged,
    coachingChanged,
    nutritionChanged,
    ...(durationReason ? { durationReason } : {}),
    ...(coachingReason ? { coachingReason } : {}),
    ...(nutritionReason ? { nutritionReason } : {}),
  };
}
```

---

## 15) `src/services/recommendation/rules.ts`

```ts
/**
 * Deterministic safety-first fallback.
 *
 * Used when: the artefact is missing a sport model, a class is unknown, or the
 * request is too malformed to vectorise. It is deliberately simple and boring —
 * a transparent rule of thumb is preferable to a confident wrong plan.
 */
import type { GoalId, PlanDurationMonths } from "@/domain/recommendation";
import type { SportId } from "@/domain/types";

export const LOW_IMPACT_ARCHETYPE: Record<SportId, string> = {
  crossfit: "cf_foundation",
  hyrox: "hx_hybrid_maintenance",
  functional: "fn_mobility_recovery",
  bodybuilding: "bb_full_body_foundation",
  running: "rn_base_build",
};

export const HIGH_IMPACT_ARCHETYPES = new Set([
  "cf_engine_competition",
  "hx_race_prep",
  "rn_half_marathon",
  "rn_threshold_5k10k",
  "bb_push_pull_legs",
]);

const GOAL_ARCHETYPE: Record<SportId, Partial<Record<GoalId, string>>> = {
  crossfit: {
    strength: "cf_strength_skill",
    competition: "cf_engine_competition",
    endurance: "cf_engine_competition",
    health: "cf_foundation",
  },
  hyrox: {
    competition: "hx_race_prep",
    endurance: "hx_base_engine",
    strength: "hx_station_strength",
    health: "hx_hybrid_maintenance",
  },
  functional: {
    strength: "fn_strength_balance",
    fat_loss: "fn_conditioning_gpp",
    endurance: "fn_conditioning_gpp",
    health: "fn_movement_foundation",
  },
  bodybuilding: {
    muscle: "bb_upper_lower",
    strength: "bb_upper_lower",
    fat_loss: "bb_full_body_foundation",
    competition: "bb_weak_point",
  },
  running: {
    endurance: "rn_base_build",
    competition: "rn_threshold_5k10k",
    fat_loss: "rn_speed_maintenance",
    health: "rn_base_build",
  },
};

export function fallbackArchetype(args: {
  sport: SportId;
  goal: GoalId;
  experienceRank: number;
  painSeverity: number;
}): string {
  if (args.painSeverity >= 1.6) return LOW_IMPACT_ARCHETYPE[args.sport];
  if (args.experienceRank < 0.8) return LOW_IMPACT_ARCHETYPE[args.sport];
  return GOAL_ARCHETYPE[args.sport][args.goal] ?? LOW_IMPACT_ARCHETYPE[args.sport];
}

export function fallbackDuration(args: {
  adherence: number | undefined;
  goal: GoalId;
  isNewAthlete: boolean;
}): PlanDurationMonths {
  if (args.isNewAthlete) return 1;
  if (args.adherence !== undefined && args.adherence < 0.55) return 1;
  if (args.goal === "competition") return 3;
  if (args.goal === "health") return 6;
  return 3;
}

export function fallbackNutritionStrategy(args: {
  goal: GoalId;
  bmi: number;
  bodyFatPct: number | undefined;
}): "fat_loss_deficit" | "lean_gain" | "performance_fuel" | "maintenance" | "recomp" {
  if (args.bmi < 18.5) return "lean_gain";
  if (args.goal === "fat_loss")
    return args.bodyFatPct !== undefined && args.bodyFatPct < 12 ? "recomp" : "fat_loss_deficit";
  if (args.goal === "muscle") return "lean_gain";
  if (args.goal === "competition" || args.goal === "endurance") return "performance_fuel";
  if (args.goal === "strength") return "recomp";
  return "maintenance";
}
```

---

## 16) `src/services/recommendation/explain.ts`

```ts
/**
 * Explanation layer: "why did the model pick this plan?"
 *
 * Two honest signals, no fake SHAP:
 *  1. Dependency-free ablation: replace one feature with its training median and
 *     measure how much the chosen class probability moves. That is a real,
 *     reproducible local sensitivity for this model.
 *  2. Named inputs harvested during extraction, so the panel lists what was
 *     actually measured rather than what the model imputed.
 */
import type { JsonEnsembleModel } from "./ensemble";
import { classify } from "./ensemble";
import type { RecommendationExplanation } from "@/domain/recommendation";

interface FeatureDescription {
  labelFa: string;
  valueFa: (value: number) => string;
}

const BOOL = (v: number) => (v >= 0.5 ? "دارد" : "ندارد");
const EXPERIENCE = ["مبتدی", "در حال یادگیری", "متوسط", "پیشرفته"];

function experienceLabel(rank: number): string {
  if (rank < 0.5) return EXPERIENCE[0] ?? "مبتدی";
  if (rank < 1.5) return EXPERIENCE[1] ?? "در حال یادگیری";
  if (rank < 2.5) return EXPERIENCE[2] ?? "متوسط";
  return EXPERIENCE[3] ?? "پیشرفته";
}

const DESCRIPTIONS: Record<string, FeatureDescription> = {
  experience_rank: { labelFa: "سابقه تمرین", valueFa: (v) => experienceLabel(v) },
  training_age_years: { labelFa: "سال‌های تمرین", valueFa: (v) => `${v.toFixed(1)} سال` },
  age: { labelFa: "سن", valueFa: (v) => `${Math.round(v)} سال` },
  sessions_available: {
    labelFa: "جلسات در دسترس",
    valueFa: (v) => `${Math.round(v)} جلسه در هفته`,
  },
  session_minutes: { labelFa: "زمان هر جلسه", valueFa: (v) => `${Math.round(v)} دقیقه` },
  sleep_hours: { labelFa: "خواب شبانه", valueFa: (v) => `${v.toFixed(1)} ساعت` },
  sleep_quality: { labelFa: "کیفیت خواب", valueFa: (v) => `${Math.round(v)} از ۵` },
  stress: { labelFa: "استرس روزانه", valueFa: (v) => `${Math.round(v)} از ۵` },
  pain_severity: {
    labelFa: "درد / محدودیت",
    valueFa: (v) => (v >= 2 ? "نیاز به توجه" : v > 0 ? "خفیف" : "بدون درد فعال"),
  },
  body_fat_pct: { labelFa: "درصد چربی", valueFa: (v) => `${v.toFixed(1)}٪` },
  bmi: { labelFa: "شاخص توده بدنی", valueFa: (v) => v.toFixed(1) },
  adherence_28d: { labelFa: "پایبندی ۲۸ روز", valueFa: (v) => `${Math.round(v * 100)}٪` },
  missed_sessions_28d: { labelFa: "جلسات از دست‌رفته", valueFa: (v) => `${Math.round(v)} جلسه` },
  avg_rpe: { labelFa: "RPE میانگین", valueFa: (v) => v.toFixed(1) },
  readiness_avg: { labelFa: "آمادگی میانگین", valueFa: (v) => `${Math.round(v)} از ۱۰۰` },
  nutrition_adherence: { labelFa: "پایبندی تغذیه", valueFa: (v) => `${Math.round(v * 100)}٪` },
  strength_index: { labelFa: "قدرت نسبی", valueFa: (v) => `${Math.round(v * 100)} از ۱۰۰` },
  engine_index: { labelFa: "موتور هوازی", valueFa: (v) => `${Math.round(v * 100)} از ۱۰۰` },
  skill_index: { labelFa: "سطح مهارت", valueFa: (v) => `${Math.round(v * 100)} از ۱۰۰` },
  mobility_index: { labelFa: "موبیلیتی", valueFa: (v) => `${Math.round(v * 100)} از ۱۰۰` },
  weekly_mileage: { labelFa: "مسافت هفتگی", valueFa: (v) => `${Math.round(v)} کیلومتر` },
  equipment_score: { labelFa: "دسترسی به تجهیزات", valueFa: (v) => `${Math.round(v * 100)}٪` },
  prior_plan_count: { labelFa: "دوره‌های قبلی", valueFa: (v) => `${Math.round(v)} دوره` },
  days_since_signup: { labelFa: "مدت عضویت", valueFa: (v) => `${Math.round(v)} روز` },
  wearable_connected: { labelFa: "ساعت هوشمند متصل", valueFa: BOOL },
  adherence_available: { labelFa: "سابقه رفتاری", valueFa: BOOL },
  goal_strength: { labelFa: "هدف قدرت", valueFa: BOOL },
  goal_muscle: { labelFa: "هدف عضله‌سازی", valueFa: BOOL },
  goal_fat_loss: { labelFa: "هدف کاهش چربی", valueFa: BOOL },
  goal_endurance: { labelFa: "هدف استقامت", valueFa: BOOL },
  goal_competition: { labelFa: "هدف مسابقه", valueFa: BOOL },
  goal_health: { labelFa: "هدف سلامت", valueFa: BOOL },
  wants_consistency: { labelFa: "هدف ثبات در تمرین", valueFa: BOOL },
  wants_skill: { labelFa: "هدف یادگیری مهارت", valueFa: BOOL },
  wants_mobility: { labelFa: "هدف حرکت بهتر", valueFa: BOOL },
  wants_recovery: { labelFa: "هدف ریکاوری بهتر", valueFa: BOOL },
};

export interface ExplanationArgs {
  model: JsonEnsembleModel;
  /** Ordered feature names from the artefact. */
  features: string[];
  vector: number[];
  named: Record<string, number>;
  fillValues: Record<string, number>;
  targetClass: string;
  topK?: number;
}

/** Ablation-based local attribution for the chosen class of a classifier. */
export function explainDecision(args: ExplanationArgs): RecommendationExplanation[] {
  const { model, features, vector, named, fillValues, targetClass } = args;
  const targetIndex = model.classes.indexOf(targetClass);
  if (targetIndex < 0) return [];
  const baseline = classify(model, vector).probabilities[targetIndex] ?? 0;

  const importances = model.featureImportance ?? [];
  const candidates = importances
    .map((importance, index) => ({ index, importance }))
    .filter(({ index }) => {
      const name = features[index];
      if (!name) return false;
      const actual = named[name];
      const fill = fillValues[name];
      if (actual === undefined) return false;
      // Only explain inputs that differ from the imputed median: those are real signals.
      return Math.abs(actual - (fill ?? 0)) > 1e-9;
    })
    .sort((a, b) => b.importance - a.importance)
    .slice(0, Math.max(1, args.topK ?? 12));

  const explanations: RecommendationExplanation[] = [];
  for (const { index } of candidates) {
    const name = features[index];
    if (!name) continue;
    const fill = fillValues[name] ?? 0;
    const probe = vector.slice();
    probe[index] = fill;
    const without = classify(model, probe).probabilities[targetIndex] ?? 0;
    const delta = baseline - without;
    if (Math.abs(delta) < 0.002) continue;

    const description = DESCRIPTIONS[name];
    const value = named[name] ?? 0;
    explanations.push({
      feature: name,
      labelFa: description?.labelFa ?? name,
      valueFa: description ? description.valueFa(value) : String(Math.round(value * 100) / 100),
      direction: delta > 0 ? "supports" : "against",
      weight: Math.round(Math.abs(delta) * 1000) / 1000,
      textFa:
        delta > 0
          ? "این ورودی انتخاب فعلی را تقویت می‌کند."
          : "این ورودی علیه انتخاب فعلی است و بقیه شواهد آن را جبران کرده‌اند.",
    });
  }

  return explanations.sort((a, b) => b.weight - a.weight).slice(0, args.topK ?? 6);
}
```

---

## 17) `src/services/recommendation/engine.ts`

```ts
/**
 * Recommendation engine — orchestrator.
 *
 * Pipeline:
 *   assessment + behaviour + body composition
 *     → feature extraction (median imputation from the artefact)
 *     → 4 gradient-boosted models (program / nutrition / duration / coaching)
 *     → session & adherence regressors
 *     → safety guardrails (overrides + flags)
 *     → sport-specific weekly structure + nutrition structure
 *     → ablation-based explanation
 *
 * Pure and synchronous: no I/O, no clock except for the timestamp, so it is safe to
 * call from a server route, a queue worker or a test.
 */
import type {
  CoachingType,
  NutritionStrategyId,
  PlanDurationMonths,
  PlanRecommendation,
  RecommendationRequest,
} from "@/domain/recommendation";
import {
  COACHING_LABEL,
  GOAL_LABEL,
  PACKAGE_NAME_FA,
  PLAN_DURATION_LABEL,
} from "@/domain/recommendation";
import type { FitlytixModelFile } from "./modelTypes";
import { classify, regress } from "./ensemble";
import { explainDecision } from "./explain";
import { faNumber } from "@/lib/locale";
import { extractFeatures, toVector } from "./features";
import { applyGuardrails } from "./guardrails";
import { getArchetypeTemplate } from "./archetypes";
import { buildNutritionRecommendation } from "./nutrition";
import { fallbackArchetype, fallbackDuration, fallbackNutritionStrategy } from "./rules";

const DURATION_VALUES: PlanDurationMonths[] = [1, 3, 6, 12];
const NUTRITION_VALUES: NutritionStrategyId[] = [
  "fat_loss_deficit",
  "lean_gain",
  "performance_fuel",
  "maintenance",
  "recomp",
];
const COACHING_VALUES: CoachingType[] = ["ai", "hybrid", "human"];

export interface RecommendationDiagnostics {
  latencyMs: number;
  featureCount: number;
  modelVersion: string;
  fallbackReasons: string[];
}

export interface RecommendationResult {
  recommendation: PlanRecommendation;
  diagnostics: RecommendationDiagnostics;
}

function parseDuration(className: string | undefined): PlanDurationMonths | undefined {
  const numeric = Number(className);
  return DURATION_VALUES.includes(numeric as PlanDurationMonths)
    ? (numeric as PlanDurationMonths)
    : undefined;
}

function fitDays<T>(days: T[], count: number): T[] {
  if (count >= days.length) return days;
  if (count <= 1) return days.slice(0, 1);
  const picked: T[] = [];
  for (let i = 0; i < count; i += 1) {
    const index = Math.round((i * (days.length - 1)) / (count - 1));
    const item = days[index];
    if (item !== undefined && !picked.includes(item)) picked.push(item);
  }
  return picked;
}

export function recommendPlan(
  request: RecommendationRequest,
  model: FitlytixModelFile,
): RecommendationResult {
  const startedAt = Date.now();
  const fallbackReasons: string[] = [];

  const extraction = extractFeatures(
    {
      sport: request.sport,
      profile: request.profile,
      answers: request.assessmentAnswers,
      bodyAnalysis: request.bodyAnalysis,
      behavior: request.behavior,
    },
    model.fillValues,
  );
  const vector = toVector(extraction.named, model.features);
  const behavior = request.behavior ?? {};

  // ---- model inference ---------------------------------------------------
  let source: "model" | "fallback" = "model";
  let programConfidence = 0;
  let archetypeId: string | undefined;
  let nutritionId: NutritionStrategyId | undefined;
  let durationMonths: PlanDurationMonths | undefined;
  let coachingMode: CoachingType | undefined;
  let sessions = 3;
  let adherence = 0.6;

  const programModel = model.models.program[request.sport];
  if (programModel && programModel.trees.length > 0) {
    const prediction = classify(programModel, vector);
    programConfidence = prediction.confidence;
    const known = model.archetypes[request.sport]?.some((a) => a.id === prediction.best) ?? false;
    if (known) archetypeId = prediction.best;
    else
      fallbackReasons.push(`archetype ${prediction.best} is not registered for ${request.sport}`);
  } else {
    fallbackReasons.push(`no program model for sport ${request.sport}`);
  }

  try {
    const nutritionPrediction = classify(model.models.nutrition, vector);
    if (NUTRITION_VALUES.includes(nutritionPrediction.best as NutritionStrategyId)) {
      nutritionId = nutritionPrediction.best as NutritionStrategyId;
    }
    const durationPrediction = classify(model.models.duration, vector);
    durationMonths = parseDuration(durationPrediction.best);
    const coachingPrediction = classify(model.models.coaching, vector);
    if (COACHING_VALUES.includes(coachingPrediction.best as CoachingType)) {
      coachingMode = coachingPrediction.best as CoachingType;
    }
    sessions = Math.max(2, Math.min(6, Math.round(regress(model.models.sessions, vector))));
    adherence = Math.max(0.05, Math.min(0.97, regress(model.models.adherence, vector)));
  } catch (error) {
    fallbackReasons.push(`inference error: ${error instanceof Error ? error.message : "unknown"}`);
  }

  // ---- deterministic fallbacks ------------------------------------------
  if (!archetypeId) {
    source = "fallback";
    archetypeId = fallbackArchetype({
      sport: request.sport,
      goal: extraction.goal,
      experienceRank: extraction.experienceRankOf,
      painSeverity: extraction.flags.painSeverity,
    });
  }
  if (!nutritionId) {
    source = "fallback";
    nutritionId = fallbackNutritionStrategy({
      goal: extraction.goal,
      bmi: extraction.flags.bmi,
      bodyFatPct: extraction.flags.bodyFatPct,
    });
  }
  if (!durationMonths) {
    durationMonths = fallbackDuration({
      adherence: extraction.flags.adherence28d,
      goal: extraction.goal,
      isNewAthlete: (behavior.priorPlanCount ?? 0) === 0 && (behavior.daysSinceSignup ?? 0) < 30,
    });
  }
  if (!coachingMode) coachingMode = extraction.flags.painSeverity >= 1.6 ? "hybrid" : "ai";

  // ---- guardrails --------------------------------------------------------
  const guardrails = applyGuardrails({
    sport: request.sport,
    prediction: {
      archetypeId,
      sessions,
      sessionMinutes: extraction.sessionMinutes,
      durationMonths,
      coaching: coachingMode,
      nutrition: nutritionId,
      adherence,
    },
    facts: {
      goal: extraction.goal,
      painSeverity: extraction.flags.painSeverity,
      painAreas: extraction.flags.painAreas,
      sleepHours: extraction.flags.sleepHours,
      stress: extraction.flags.stress,
      readinessAvg: extraction.flags.readinessAvg,
      adherence28d: extraction.flags.adherence28d,
      age: extraction.flags.age,
      bmi: extraction.flags.bmi,
      bodyFatPct: extraction.flags.bodyFatPct,
    },
    ...(request.constraints ? { constraints: request.constraints } : {}),
    sessionsAvailable: extraction.sessionsAvailable,
  });

  // ---- programme structure ----------------------------------------------
  const sportArchetypes = model.archetypes[request.sport] ?? [];
  const archetypeMeta =
    sportArchetypes.find((a) => a.id === guardrails.archetypeId) ?? sportArchetypes[0];
  const template = getArchetypeTemplate(
    guardrails.archetypeId,
    sportArchetypes.map((a) => a.id),
  );
  const sessionsPerWeek = Math.max(1, Math.min(guardrails.sessions, template.days.length));
  // Session length follows the archetype design, never exceeds what the athlete has,
  // and is trimmed further when safety demands a conservative load.
  const conservativeSession = guardrails.flags.some(
    (f) => f.code === "pain_clinician_limited" || f.code === "minor_athlete",
  );
  const templateMinutes = archetypeMeta?.minutes ?? extraction.sessionMinutes;
  const sessionMinutes = Math.round(
    Math.min(
      extraction.sessionMinutes,
      templateMinutes,
      conservativeSession ? 60 : extraction.sessionMinutes,
    ),
  );
  const days = fitDays(template.days, sessionsPerWeek);
  const weeks = Math.max(4, Math.round(guardrails.durationMonths * 4.33));
  const deloadWeekIndexes: number[] = [];
  for (let week = template.deloadEveryWeeks; week <= weeks; week += template.deloadEveryWeeks) {
    // Never deload in the final week: it is the test/peak week.
    if (week < weeks) deloadWeekIndexes.push(week);
  }

  const weightKg = extraction.named["weight_kg"] ?? 76;
  const mealsPerDay = request.nutrition?.mealsPerDay ?? 4;
  const nutrition = buildNutritionRecommendation(guardrails.nutrition, {
    sport: request.sport,
    weightKg,
    mealsPerDay,
    goalLabelFa: GOAL_LABEL[extraction.goal],
    restrictions: request.nutrition?.restrictions,
    strategyOverrideNote: guardrails.nutritionReason,
  });

  // ---- expectations ------------------------------------------------------
  const durationFactor = 1 - 0.035 * (guardrails.durationMonths / 3 - 1);
  const cycleAdherence = Math.max(0.05, Math.min(0.97, adherence * durationFactor));
  const adherence30d = Math.max(0.05, Math.min(0.98, adherence * 1.12));
  const dataCompleteness = Math.max(0, Math.min(1, 1 - extraction.missing.length / 6));
  const confidence: "low" | "medium" | "high" =
    source === "model" && dataCompleteness >= 0.66 && programConfidence >= 0.5
      ? "high"
      : source === "model" && dataCompleteness >= 0.4
        ? "medium"
        : "low";

  // ---- explanation -------------------------------------------------------
  const explanations = programModel
    ? explainDecision({
        model: programModel,
        features: model.features,
        vector,
        named: extraction.named,
        fillValues: model.fillValues,
        targetClass: guardrails.archetypeId,
        topK: 6,
      })
    : [];

  const packageId = request.constraints?.packageId ?? "combined";
  const safetyLevel = guardrails.flags.some((f) => f.severity === "review_required")
    ? "review_required"
    : guardrails.flags.some((f) => f.severity === "caution")
      ? "caution"
      : "none";

  const durationRationale = guardrails.durationReason
    ? guardrails.durationReason
    : `با هدف «${GOAL_LABEL[extraction.goal]}»، سابقه ${faNumber(Math.round(extraction.experienceRankOf))} از ۳ و پیش‌بینی پایبندی حدود ${faNumber(Math.round(cycleAdherence * 100))}٪، این دوره بهترین تعادل بین فرصت پیشرفت و ریسک رها کردن برنامه است.`;

  const coachingRationale = guardrails.coachingReason
    ? guardrails.coachingReason
    : guardrails.coaching === "human"
      ? "شرایط فعلی (درد، سابقه یا هدف مسابقه) بازبینی انسانی را ضروری می‌کند."
      : guardrails.coaching === "hybrid"
        ? "موتور هوشمند برنامه را می‌سازد و مربی انسانی نقاط حساس را بازبینی می‌کند."
        : "برنامه با موتور هوشمند کافی است؛ ورودی‌ها روشن و ریسک پایین است.";

  const recommendation: PlanRecommendation = {
    ...(request.athleteId ? { athleteId: request.athleteId } : {}),
    sport: request.sport,
    generatedAt: new Date().toISOString(),
    model: {
      version: model.modelVersion,
      trainedAt: model.trainedAt,
      source,
      schemaVersion: model.schemaVersion,
      trainingData: model.trainingData,
    },
    program: {
      archetypeId: guardrails.archetypeId,
      labelFa: archetypeMeta?.labelFa ?? template.id,
      summaryFa: archetypeMeta?.summaryFa ?? "ساختار برنامه بر اساس ارزیابی اولیه.",
      sessionsPerWeek,
      sessionMinutes,
      weeks,
      deloadWeekIndexes,
      progressionNotes: [...template.progressionNotes, ...guardrails.notes],
      days,
      focusTags: archetypeMeta?.tags ?? [],
    },
    nutrition,
    duration: {
      months: guardrails.durationMonths,
      labelFa: PLAN_DURATION_LABEL[guardrails.durationMonths],
      rationaleFa: durationRationale,
      overrideApplied: guardrails.durationChanged,
    },
    coaching: {
      mode: guardrails.coaching,
      labelFa: COACHING_LABEL[guardrails.coaching],
      rationaleFa: coachingRationale,
    },
    package: {
      id: packageId,
      nameFa: PACKAGE_NAME_FA[packageId],
      rationaleFa:
        packageId === "combined"
          ? "برنامه تمرین و ساختار تغذیه با هم تنظیم شده‌اند؛ شدت جلسه و روزهای کربوهیدرات بالا هماهنگ است."
          : packageId === "training"
            ? "این پیشنهاد روی تمرین متمرکز است؛ ساختار تغذیه به‌عنوان مرجع در دسترس است."
            : "این پیشنهاد روی تغذیه متمرکز است؛ ساختار تمرین به‌عنوان مرجع در دسترس است.",
    },
    expectations: {
      adherence30d: Math.round(adherence30d * 100) / 100,
      adherenceCycle: Math.round(cycleAdherence * 100) / 100,
      dataCompleteness: Math.round(dataCompleteness * 100) / 100,
      confidence,
    },
    safety: {
      level: safetyLevel,
      flags: guardrails.flags,
    },
    explanations,
    inputs: {
      used: extraction.used,
      missing: extraction.missing,
    },
  };

  return {
    recommendation,
    diagnostics: {
      latencyMs: Date.now() - startedAt,
      featureCount: model.features.length,
      modelVersion: model.modelVersion,
      fallbackReasons,
    },
  };
}
```

---

## 18) `src/services/recommendation/requestSchema.ts`

```ts
/**
 * Request validation for the recommendation endpoint.
 * Shared by the API route (and any future client) so the contract cannot drift.
 */
import { z } from "zod";

const goalSchema = z.enum(["strength", "muscle", "fat_loss", "endurance", "competition", "health"]);

const answerValue = z.union([
  z.string().max(400),
  z.number(),
  z.array(z.string().max(200)).max(20),
]);

const profileSchema = z
  .object({
    age: z.number().min(12).max(85).optional(),
    gender: z.enum(["male", "female", "other"]).optional(),
    heightCm: z.number().min(120).max(230).optional(),
    weightKg: z.number().min(30).max(250).optional(),
    experience: z.enum(["beginner", "intermediate", "advanced", "elite"]).optional(),
    primaryGoal: goalSchema.optional(),
    sessionsPerWeek: z.number().min(1).max(7).optional(),
    minutesPerSession: z.number().min(15).max(180).optional(),
  })
  .optional();

const behaviorSchema = z
  .object({
    windowDays: z.number().int().min(7).max(180).optional(),
    plannedSessions: z.number().min(0).max(200).optional(),
    completedSessions: z.number().min(0).max(200).optional(),
    missedSessions: z.number().min(0).max(200).optional(),
    avgRpe: z.number().min(0).max(10).optional(),
    previousAvgRpe: z.number().min(0).max(10).optional(),
    feedbackCount: z.number().min(0).max(500).optional(),
    readinessAvg: z.number().min(0).max(100).optional(),
    nutritionAdherence: z.number().min(0).max(1).optional(),
    daysSinceSignup: z.number().min(0).max(20000).optional(),
    priorPlanMonths: z.number().min(0).max(36).optional(),
    priorPlanCount: z.number().min(0).max(50).optional(),
    wearableConnected: z.boolean().optional(),
  })
  .optional();

export const recommendationRequestSchema = z.object({
  athleteId: z.string().trim().min(1).max(64).optional(),
  sport: z.enum(["crossfit", "hyrox", "functional", "bodybuilding", "running"]),
  profile: profileSchema,
  assessmentAnswers: z.record(z.string().max(120), answerValue).optional(),
  bodyAnalysis: z
    .object({
      weightKg: z.number().min(30).max(250).optional(),
      heightCm: z.number().min(120).max(230).optional(),
      bodyFatPct: z.number().min(2).max(65).optional(),
      measuredAt: z.string().max(32).optional(),
    })
    .optional(),
  behavior: behaviorSchema,
  nutrition: z
    .object({
      mealsPerDay: z.number().int().min(2).max(6).optional(),
      restrictions: z.array(z.string().max(60)).max(20).optional(),
    })
    .optional(),
  constraints: z
    .object({
      durationMonths: z
        .union([z.literal(1), z.literal(3), z.literal(6), z.literal(12), z.literal("auto")])
        .optional(),
      packageId: z.enum(["training", "nutrition", "combined"]).optional(),
      coachingPreference: z.enum(["ai", "hybrid", "human", "auto"]).optional(),
      maxSessionsPerWeek: z.number().int().min(1).max(7).optional(),
    })
    .optional(),
});

export type ValidatedRecommendationRequest = z.infer<typeof recommendationRequestSchema>;
```

---

## 19) `src/services/recommendation/store.server.ts`

```ts
/**
 * Append-only logging of recommendation decisions and their outcomes.
 *
 * This is what turns the self-hosted model into a system that can learn from real
 * traffic: every request stores its exact inputs, the chosen action and the model
 * version. Once cycles finish, outcome rows let you retrain against reality
 * (`ml/README.md` → "Using real data").
 *
 * Best-effort by design: a logging failure must never break an athlete's request.
 */
import crypto from "node:crypto";
import { dbExecute, isDatabaseConfigured, tableExists } from "@/lib/db.server";
import type { PlanRecommendation, RecommendationRequest } from "@/domain/recommendation";
import type { RecommendationDiagnostics } from "./engine";

export interface RecordEventArgs {
  athleteId?: string | undefined;
  request: RecommendationRequest;
  recommendation: PlanRecommendation;
  diagnostics: RecommendationDiagnostics;
}

export async function recordRecommendationEvent(args: RecordEventArgs): Promise<void> {
  try {
    if (!isDatabaseConfigured()) return;
    if (!(await tableExists("recommendation_events"))) return;

    const { recommendation } = args;
    await dbExecute(
      `INSERT INTO recommendation_events
        (id, athlete_id, sport, model_version, model_source, program_archetype,
         nutrition_strategy, duration_months, coaching_mode, safety_level,
         confidence, adherence_cycle, input_json, output_json, latency_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        args.athleteId ?? args.request.athleteId ?? null,
        recommendation.sport,
        recommendation.model.version,
        recommendation.model.source,
        recommendation.program.archetypeId,
        recommendation.nutrition.strategyId,
        recommendation.duration.months,
        recommendation.coaching.mode,
        recommendation.safety.level,
        recommendation.expectations.confidence,
        recommendation.expectations.adherenceCycle,
        JSON.stringify({
          profile: args.request.profile ?? null,
          answers: args.request.assessmentAnswers ?? null,
          bodyAnalysis: args.request.bodyAnalysis ?? null,
          behavior: args.request.behavior ?? null,
          constraints: args.request.constraints ?? null,
        }),
        JSON.stringify(recommendation),
        args.diagnostics.latencyMs,
      ],
    );
  } catch (error) {
    console.warn(
      "[recommendation] could not persist decision (non-blocking):",
      error instanceof Error ? error.message : error,
    );
  }
}

export interface RecordOutcomeArgs {
  athleteId: string;
  eventId: string;
  completedCycle: boolean;
  adherence?: number | undefined;
  sessionsCompleted?: number | undefined;
  progressScore?: number | undefined;
  note?: string | undefined;
}

/** Called by a nightly job / coach after a cycle ends — the reward signal for retraining. */
export async function recordRecommendationOutcome(args: RecordOutcomeArgs): Promise<boolean> {
  try {
    if (!isDatabaseConfigured()) return false;
    if (!(await tableExists("recommendation_outcomes"))) return false;
    await dbExecute(
      `INSERT INTO recommendation_outcomes
        (id, event_id, athlete_id, completed_cycle, adherence, sessions_completed, progress_score, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        args.eventId,
        args.athleteId,
        args.completedCycle ? 1 : 0,
        args.adherence ?? null,
        args.sessionsCompleted ?? null,
        args.progressScore ?? null,
        args.note ?? null,
      ],
    );
    return true;
  } catch (error) {
    console.warn(
      "[recommendation] could not persist outcome:",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}
```

---

## 20) `src/services/recommendation/snapshots.server.ts`

```ts
/**
 * Persistence for plan snapshots (`recommendation_snapshots`, migration 004).
 *
 * The athlete must always see *the plan that was actually generated*, with the exact
 * inputs behind it — not a freshly recomputed plan that silently changes after a model
 * update. Snapshots are therefore keyed by (user, input hash, model version), so the
 * same inputs against the same model never produce duplicate rows.
 *
 * Everything here is best-effort: a missing table or an unconfigured database must
 * degrade to "recompute on demand", never break a page or an API call.
 */
import crypto from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { dbExecute, dbQuery, isDatabaseConfigured, tableExists } from "@/lib/db.server";
import type {
  PlanDurationMonths,
  PlanRecommendation,
  RecommendationRequest,
} from "@/domain/recommendation";

export interface RecommendationSnapshot {
  id: string;
  userId: string;
  sport: string;
  source: string;
  createdAt: string;
  inputHash: string;
  modelVersion: string;
  request: RecommendationRequest;
  recommendation: PlanRecommendation;
}

export interface SaveSnapshotArgs {
  userId: string;
  request: RecommendationRequest;
  recommendation: PlanRecommendation;
  source?: "assessment" | "manual" | "backfill" | "recompute";
}

const SNAPSHOT_TABLE = "recommendation_snapshots";
let warnedUnavailable = false;

function warnOnce(message: string): void {
  if (warnedUnavailable) return;
  warnedUnavailable = true;
  console.warn(`[recommendation/snapshots] ${message}`);
}

/** Stable hash so equivalent requests reuse one snapshot. */
export function hashRecommendationRequest(request: RecommendationRequest): string {
  const canonical = {
    sport: request.sport,
    profile: request.profile ?? null,
    answers: request.assessmentAnswers ?? null,
    body: request.bodyAnalysis ?? null,
    behavior: request.behavior ?? null,
    nutrition: request.nutrition ?? null,
    constraints: request.constraints ?? null,
  };

  const sortValue = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sortValue);
    if (value && typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b));
      return Object.fromEntries(entries.map(([k, v]) => [k, sortValue(v)]));
    }
    return value;
  };

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(sortValue(canonical)))
    .digest("hex");
}

export async function snapshotsAvailable(): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  try {
    return await tableExists(SNAPSHOT_TABLE);
  } catch {
    return false;
  }
}

function toIso(value: unknown): string {
  if (!value) return new Date(0).toISOString();
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : new Date(0).toISOString();
}

function safeParse<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "object") return value as T;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
}

function mapRow(row: RowDataPacket): RecommendationSnapshot {
  return {
    id: String(row["id"]),
    userId: String(row["user_id"]),
    sport: String(row["sport"]),
    source: String(row["source"] ?? "assessment"),
    createdAt: toIso(row["created_at"]),
    inputHash: String(row["input_hash"]),
    modelVersion: String(row["model_version"]),
    request: safeParse<RecommendationRequest>(row["request_json"], { sport: "crossfit" }),
    recommendation: safeParse<PlanRecommendation>(row["result_json"], null as never),
  };
}

/** Stores the plan; returns null when persistence is unavailable (never throws). */
export async function saveRecommendationSnapshot(args: SaveSnapshotArgs): Promise<string | null> {
  try {
    if (!(await snapshotsAvailable())) {
      warnOnce("table recommendation_snapshots is missing — plans will not be persisted");
      return null;
    }

    const { request, recommendation } = args;
    const id = crypto.randomUUID();
    const inputHash = hashRecommendationRequest(request);

    const result = await dbExecute(
      `INSERT INTO recommendation_snapshots
        (id, user_id, sport, source, model_version, model_schema_version, model_training_data,
         archetype_id, nutrition_strategy_id, duration_months, coaching_mode, package_id,
         safety_level, confidence, adherence_30d, adherence_cycle, data_completeness,
         input_hash, request_json, result_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE id = id`,
      [
        id,
        args.userId,
        recommendation.sport,
        args.source ?? "assessment",
        recommendation.model.version,
        recommendation.model.schemaVersion,
        recommendation.model.trainingData,
        recommendation.program.archetypeId,
        recommendation.nutrition.strategyId,
        recommendation.duration.months,
        recommendation.coaching.mode,
        recommendation.package.id,
        recommendation.safety.level,
        recommendation.expectations.confidence,
        recommendation.expectations.adherence30d,
        recommendation.expectations.adherenceCycle,
        recommendation.expectations.dataCompleteness,
        inputHash,
        JSON.stringify(request),
        JSON.stringify(recommendation),
      ],
    );

    // A duplicate (same athlete + inputs + model version) keeps the original row.
    if (result.affectedRows === 0) {
      const existing = await dbQuery<RowDataPacket[]>(
        `SELECT id FROM recommendation_snapshots
         WHERE user_id = ? AND input_hash = ? AND model_version = ?
         LIMIT 1`,
        [args.userId, inputHash, recommendation.model.version],
      );
      return existing[0] ? String(existing[0]["id"]) : null;
    }

    return id;
  } catch (error) {
    warnOnce(`save failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

export async function getLatestRecommendationSnapshot(
  userId: string,
): Promise<RecommendationSnapshot | null> {
  try {
    if (!(await snapshotsAvailable())) return null;
    const rows = await dbQuery<RowDataPacket[]>(
      `SELECT * FROM ${SNAPSHOT_TABLE} WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    const row = rows[0];
    return row ? mapRow(row) : null;
  } catch (error) {
    warnOnce(`read failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

export async function countRecommendationSnapshots(userId: string): Promise<number> {
  try {
    if (!(await snapshotsAvailable())) return 0;
    const rows = await dbQuery<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM ${SNAPSHOT_TABLE} WHERE user_id = ?`,
      [userId],
    );
    return Number(rows[0]?.["total"] ?? 0);
  } catch {
    return 0;
  }
}

/** How old a snapshot is, in hours — used to decide whether a plan needs recomputing. */
export function snapshotAgeHours(snapshot: RecommendationSnapshot, now = Date.now()): number {
  const created = new Date(snapshot.createdAt).getTime();
  if (!Number.isFinite(created)) return Number.POSITIVE_INFINITY;
  return (now - created) / 3_600_000;
}
```

---

## 21) `src/services/recommendation/assembly.server.ts`

```ts
/**
 * Builds a recommendation request from what the platform already knows about an athlete.
 *
 * This is the bridge between the product database and the model:
 *   profile row  → age / sex / height / weight / experience
 *   assessments  → the 56 assessment-derived features (common + sport templates, same field ids)
 *   body records → latest measured body-fat percentage
 *   training_sessions / workout_logs / nutrition_logs → real 28-day behaviour
 *   subscriptions → the commercial cycle length the athlete actually bought
 *
 * Every lookup is defensive: a missing table, column or value simply drops that signal,
 * and the engine imputes from training medians instead of inventing an answer.
 */
import type { RowDataPacket } from "mysql2/promise";
import { dbQuery, getTableColumns, isDatabaseConfigured, tableExists } from "@/lib/db.server";
import type { AuthenticatedUser } from "@/lib/auth.server";
import type {
  GoalId,
  PlanDurationMonths,
  RecommendationBehaviorInput,
  RecommendationConstraints,
  RecommendationRequest,
} from "@/domain/recommendation";
import type { BodyAnalysisRecord } from "@/domain/body-analysis";
import type { AssessmentAnswers, ExperienceLevel, SportId } from "@/domain/types";
import {
  athleteRepository,
  isValidExperienceLevel,
  isValidSportSlug,
} from "@/server/athlete.repository";

export interface AssembledRecommendationRequest {
  request: RecommendationRequest;
  /** Human-readable list of the signals that were actually available. */
  sourcesFa: string[];
  /** Signals the model would use but that are still missing. */
  missingFa: string[];
}

const WINDOW_DAYS = 28;
const GOALS: GoalId[] = ["strength", "muscle", "fat_loss", "endurance", "competition", "health"];
const DURATIONS: PlanDurationMonths[] = [1, 3, 6, 12];

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const n = typeof value === "number" ? value : Number(String(value));
  return Number.isFinite(n) ? n : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function readProfileRow(userId: string): Promise<Record<string, unknown> | null> {
  try {
    if (!(await tableExists("athlete_profiles"))) return null;
    const cols = await getTableColumns("athlete_profiles");
    const wanted = [
      "age",
      "gender",
      "height_cm",
      "weight_kg",
      "experience_level",
      "coaching_type",
    ].filter((c) => cols.has(c));
    if (wanted.length === 0) return null;
    const rows = await dbQuery<RowDataPacket[]>(
      `SELECT ${wanted.join(", ")} FROM athlete_profiles WHERE user_id = ? LIMIT 1`,
      [userId],
    );
    return rows[0] ? (rows[0] as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function readDaysSinceSignup(userId: string): Promise<number | undefined> {
  try {
    if (!(await tableExists("users"))) return undefined;
    const rows = await dbQuery<RowDataPacket[]>(
      `SELECT created_at FROM users WHERE id = ? LIMIT 1`,
      [userId],
    );
    const createdAt = rows[0]?.["created_at"];
    if (!createdAt) return undefined;
    const created = new Date(String(createdAt)).getTime();
    if (!Number.isFinite(created)) return undefined;
    return Math.max(0, Math.round((Date.now() - created) / 86_400_000));
  } catch {
    return undefined;
  }
}

interface SessionBehaviour {
  planned: number;
  completed: number;
  avgRpe?: number;
  previousAvgRpe?: number;
}

async function readSessionBehaviour(userId: string): Promise<SessionBehaviour | null> {
  try {
    if (!(await tableExists("training_sessions"))) return null;
    const cols = await getTableColumns("training_sessions");
    const scheduled = cols.has("scheduled_at")
      ? "scheduled_at"
      : cols.has("created_at")
        ? "created_at"
        : null;
    if (!scheduled) return null;

    const rows = await dbQuery<RowDataPacket[]>(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'completed' OR completed_at IS NOT NULL THEN 1 ELSE 0 END) AS done,
         AVG(CASE WHEN ${scheduled} >= (NOW() - INTERVAL 28 DAY) THEN perceived_exertion END) AS rpe_now,
         AVG(CASE WHEN ${scheduled} < (NOW() - INTERVAL 28 DAY)
                   AND ${scheduled} >= (NOW() - INTERVAL 56 DAY) THEN perceived_exertion END) AS rpe_prev
       FROM training_sessions
       WHERE athlete_user_id = ?
         AND ${scheduled} >= (NOW() - INTERVAL 56 DAY)`,
      [userId],
    );

    const row = rows[0];
    if (!row) return null;
    const planned = Number(row["total"] ?? 0);
    const completed = Number(row["done"] ?? 0);
    if (planned === 0 && completed === 0) return null;

    const avgRpe = toNumber(row["rpe_now"]);
    const previousAvgRpe = toNumber(row["rpe_prev"]);
    return {
      planned,
      completed,
      ...(avgRpe !== undefined ? { avgRpe: clamp(avgRpe, 0, 10) } : {}),
      ...(previousAvgRpe !== undefined ? { previousAvgRpe: clamp(previousAvgRpe, 0, 10) } : {}),
    };
  } catch {
    return null;
  }
}

async function readNutritionAdherence(userId: string): Promise<number | undefined> {
  try {
    if (!(await tableExists("nutrition_logs"))) return undefined;
    const rows = await dbQuery<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT DATE(logged_at)) AS days
       FROM nutrition_logs
       WHERE athlete_user_id = ? AND logged_at >= (NOW() - INTERVAL ${WINDOW_DAYS} DAY)`,
      [userId],
    );
    const days = Number(rows[0]?.["days"] ?? 0);
    if (!Number.isFinite(days) || days <= 0) return undefined;
    return clamp(days / WINDOW_DAYS, 0, 1);
  } catch {
    return undefined;
  }
}

interface SubscriptionContext {
  durationMonths?: PlanDurationMonths;
  packageId?: "training" | "nutrition" | "combined";
  labelFa?: string;
}

async function readActiveSubscription(userId: string): Promise<SubscriptionContext | null> {
  try {
    if (!(await tableExists("subscriptions"))) return null;
    const planTable = (await tableExists("subscription_plans")) ? "subscription_plans" : null;
    const cols = await getTableColumns("subscriptions");
    const statusFilter = cols.has("status") ? "AND s.status IN ('active', 'trialing', 'paid')" : "";
    const planJoin = planTable ? `LEFT JOIN ${planTable} p ON p.id = s.plan_id` : "";
    const planCols = planTable ? ["p.plan_code", "p.features", "p.name"] : [];
    const select = ["s.current_period_start", "s.current_period_end", ...planCols].join(", ");

    const rows = await dbQuery<RowDataPacket[]>(
      `SELECT ${select}
       FROM subscriptions s ${planJoin}
       WHERE s.user_id = ? ${statusFilter}
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [userId],
    );
    const row = rows[0];
    if (!row) return null;

    const start = row["current_period_start"]
      ? new Date(String(row["current_period_start"]))
      : null;
    const end = row["current_period_end"] ? new Date(String(row["current_period_end"])) : null;

    let durationMonths: PlanDurationMonths | undefined;
    if (start && end && Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())) {
      const months = (end.getTime() - start.getTime()) / (30.44 * 86_400_000);
      durationMonths = DURATIONS.find((option) => Math.abs(option - months) <= 0.6);
    }

    let packageId: SubscriptionContext["packageId"];
    const features = row["features"];
    const parsedFeatures = typeof features === "string" ? safeJson(features) : features;
    if (isRecord(parsedFeatures) && typeof parsedFeatures["package"] === "string") {
      const raw = String(parsedFeatures["package"]);
      if (raw === "training" || raw === "nutrition" || raw === "combined") packageId = raw;
    }
    if (!packageId && typeof row["plan_code"] === "string") {
      const code = String(row["plan_code"]).toLowerCase();
      if (code.includes("nutrition") && code.includes("train")) packageId = "combined";
      else if (code.includes("nutrition")) packageId = "nutrition";
      else if (code.includes("train")) packageId = "training";
    }

    const label = typeof row["name"] === "string" ? row["name"] : undefined;
    return {
      ...(durationMonths ? { durationMonths } : {}),
      ...(packageId ? { packageId } : {}),
      ...(label ? { labelFa: label } : {}),
    };
  } catch {
    return null;
  }
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function latestBodyRecord(records: BodyAnalysisRecord[]): BodyAnalysisRecord | undefined {
  return [...records].sort((a, b) =>
    String(b.measuredAt ?? "").localeCompare(String(a.measuredAt ?? "")),
  )[0];
}

export async function assembleRecommendationRequest(
  user: AuthenticatedUser,
): Promise<AssembledRecommendationRequest> {
  const sourcesFa: string[] = [];
  const missingFa: string[] = [];

  let sport: SportId = isValidSportSlug(user.primarySport) ? user.primarySport : "crossfit";
  let experience: ExperienceLevel | undefined;
  let answers: AssessmentAnswers = {};
  let bodyRecords: BodyAnalysisRecord[] = [];
  let wearableConnected = false;

  try {
    const state = await athleteRepository.getAthleteAssessmentState(user);
    if (isValidSportSlug(state.primarySport)) sport = state.primarySport;
    if (isValidExperienceLevel(state.experienceLevel)) experience = state.experienceLevel;

    const commonAnswers = state.commonAssessment?.answers ?? {};
    const sportAnswers = state.sportAssessments[sport]?.answers ?? {};
    answers = { ...commonAnswers, ...sportAnswers };

    if (Object.keys(commonAnswers).length > 0) sourcesFa.push("ارزیابی عمومی");
    if (Object.keys(sportAnswers).length > 0) sourcesFa.push("ارزیابی رشته");
    if (state.wearable.intent === "yes") {
      wearableConnected = true;
      sourcesFa.push("اتصال داده سلامت");
    }

    bodyRecords = state.bodyRecords;
  } catch (error) {
    console.warn(
      "[recommendation/assembly] assessment state unavailable:",
      error instanceof Error ? error.message : error,
    );
  }

  const profileRow = await readProfileRow(user.id);
  const age = toNumber(profileRow?.["age"]);
  const heightCm = toNumber(profileRow?.["height_cm"]);
  const weightKg = toNumber(profileRow?.["weight_kg"]);
  const genderRaw = profileRow?.["gender"];
  const gender =
    genderRaw === "male" || genderRaw === "female" || genderRaw === "other" ? genderRaw : undefined;
  if (!experience && isValidExperienceLevel(profileRow?.["experience_level"])) {
    experience = profileRow["experience_level"] as ExperienceLevel;
  }

  const body = latestBodyRecord(bodyRecords);
  const bodyAnalysis = body
    ? {
        ...(toNumber(body.weightKg) !== undefined ? { weightKg: toNumber(body.weightKg) } : {}),
        ...(toNumber(body.heightCm) !== undefined ? { heightCm: toNumber(body.heightCm) } : {}),
        ...(toNumber(body.bodyFatPct) !== undefined
          ? { bodyFatPct: toNumber(body.bodyFatPct) }
          : {}),
        ...(body.measuredAt ? { measuredAt: String(body.measuredAt) } : {}),
      }
    : undefined;
  if (bodyAnalysis) sourcesFa.push("ترکیب بدن");

  const sessions = await readSessionBehaviour(user.id);
  const nutritionAdherence = await readNutritionAdherence(user.id);
  const daysSinceSignup = await readDaysSinceSignup(user.id);

  const behavior: RecommendationBehaviorInput = {
    windowDays: WINDOW_DAYS,
    ...(sessions
      ? {
          plannedSessions: sessions.planned,
          completedSessions: sessions.completed,
          missedSessions: Math.max(0, sessions.planned - sessions.completed),
        }
      : {}),
    ...(sessions?.avgRpe !== undefined ? { avgRpe: sessions.avgRpe } : {}),
    ...(sessions?.previousAvgRpe !== undefined ? { previousAvgRpe: sessions.previousAvgRpe } : {}),
    ...(nutritionAdherence !== undefined ? { nutritionAdherence } : {}),
    ...(daysSinceSignup !== undefined ? { daysSinceSignup } : {}),
    wearableConnected,
  };

  if (sessions) sourcesFa.push("سابقه جلسات ۲۸ روز");
  else missingFa.push("سابقه جلسات تمرین");
  if (nutritionAdherence !== undefined) sourcesFa.push("پایبندی تغذیه");
  else missingFa.push("لاگ تغذیه");
  if (!body?.bodyFatPct) missingFa.push("درصد چربی بدن");

  const subscription = await readActiveSubscription(user.id);
  if (subscription?.labelFa) sourcesFa.push(`اشتراک فعال: ${subscription.labelFa}`);

  const constraints: RecommendationConstraints | undefined = subscription
    ? {
        ...(subscription.durationMonths ? { durationMonths: subscription.durationMonths } : {}),
        ...(subscription.packageId ? { packageId: subscription.packageId } : {}),
      }
    : undefined;

  const goalRaw = answers["common.goals.primary"];
  let primaryGoal: GoalId | undefined;
  if (typeof goalRaw === "string") {
    const match = /^option_(\d+)$/.exec(goalRaw);
    const index = match ? Number(match[1]) : Number.NaN;
    if (Number.isFinite(index)) primaryGoal = GOALS[index - 1] ?? undefined;
  }

  const request: RecommendationRequest = {
    athleteId: user.athleteId,
    sport,
    ...(age !== undefined ||
    gender ||
    heightCm !== undefined ||
    weightKg !== undefined ||
    experience ||
    primaryGoal
      ? {
          profile: {
            ...(age !== undefined ? { age: clamp(age, 12, 85) } : {}),
            ...(gender ? { gender } : {}),
            ...(heightCm !== undefined ? { heightCm: clamp(heightCm, 120, 230) } : {}),
            ...(weightKg !== undefined ? { weightKg: clamp(weightKg, 30, 250) } : {}),
            ...(experience ? { experience } : {}),
            ...(primaryGoal ? { primaryGoal } : {}),
          },
        }
      : {}),
    assessmentAnswers: answers,
    ...(bodyAnalysis ? { bodyAnalysis } : {}),
    behavior,
    ...(constraints ? { constraints } : {}),
  };

  if (Object.keys(answers).length === 0) missingFa.push("ارزیابی اولیه");

  return { request, sourcesFa, missingFa };
}

/** True when the athlete has enough stored data for a real (non-cold-start) plan. */
export async function hasStoredAssessment(userId: string): Promise<boolean> {
  try {
    if (!isDatabaseConfigured()) return false;
    if (!(await tableExists("assessments"))) return false;
    const rows = await dbQuery<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM assessments WHERE athlete_user_id = ?`,
      [userId],
    );
    return Number(rows[0]?.["total"] ?? 0) > 0;
  } catch {
    return false;
  }
}
```

---

## 22) `src/services/recommendation/userPlan.server.ts`

```ts
/**
 * Server-side plan orchestration for a signed-in athlete.
 *
 * One entry point (`resolvePlanForUser`) decides between three states:
 *   1. a stored snapshot that still matches the athlete's current inputs → return it,
 *   2. inputs changed (new assessment / behaviour) or the snapshot is old → recompute,
 *   3. explicit regeneration (coach or athlete asked) → recompute and persist.
 *
 * The UI therefore never needs to know how the model works; it just asks for "my plan"
 * and gets back the plan that was actually generated, its provenance and freshness.
 */
import { getModel } from "./model.server";
import { recommendPlan, type RecommendationDiagnostics } from "./engine";
import { assembleRecommendationRequest } from "./assembly.server";
import {
  getLatestRecommendationSnapshot,
  hashRecommendationRequest,
  saveRecommendationSnapshot,
  snapshotAgeHours,
} from "./snapshots.server";
import { recordRecommendationEvent } from "./store.server";
import type { AuthenticatedUser } from "@/lib/auth.server";
import type {
  CoachingType,
  PlanDurationMonths,
  PlanRecommendation,
  RecommendationConstraints,
  RecommendationRequest,
} from "@/domain/recommendation";

/** A weekly plan stays fresh this long unless the athlete's own inputs change. */
const DEFAULT_MAX_AGE_HOURS = 24 * 7;

export interface ResolvePlanOptions {
  /** Ignore the stored snapshot and recompute. */
  force?: boolean;
  /** Constraints coming from the request (subscription, athlete choice). */
  constraints?: {
    durationMonths?: PlanDurationMonths | "auto" | undefined;
    packageId?: "training" | "nutrition" | "combined" | undefined;
    coachingPreference?: CoachingType | "auto" | undefined;
    maxSessionsPerWeek?: number | undefined;
  };
  maxAgeHours?: number;
  persist?: boolean;
  source?: "assessment" | "manual" | "backfill" | "recompute";
}

export interface ResolvedPlan {
  request: RecommendationRequest;
  recommendation: PlanRecommendation;
  diagnostics: RecommendationDiagnostics | null;
  inputHash: string;
  generatedAt: string;
  fromSnapshot: boolean;
  persisted: boolean;
  snapshotId: string | null;
  /** Signals used to build the request (Persian, for the "why" panel). */
  sourcesFa: string[];
  /** Signals that would improve the plan but are still missing. */
  missingFa: string[];
}

function mergeConstraints(
  base: RecommendationConstraints | undefined,
  overrides: ResolvePlanOptions["constraints"],
): RecommendationConstraints | undefined {
  if (!overrides) return base;
  const merged: RecommendationConstraints = {
    ...(base ?? {}),
    ...(overrides.durationMonths !== undefined ? { durationMonths: overrides.durationMonths } : {}),
    ...(overrides.packageId !== undefined ? { packageId: overrides.packageId } : {}),
    ...(overrides.coachingPreference !== undefined
      ? { coachingPreference: overrides.coachingPreference }
      : {}),
    ...(overrides.maxSessionsPerWeek !== undefined
      ? { maxSessionsPerWeek: overrides.maxSessionsPerWeek }
      : {}),
  };
  return Object.keys(merged).length > 0 ? merged : undefined;
}

export async function resolvePlanForUser(
  user: AuthenticatedUser,
  options: ResolvePlanOptions = {},
): Promise<ResolvedPlan> {
  const assembled = await assembleRecommendationRequest(user);
  const constraints = mergeConstraints(assembled.request.constraints, options.constraints);

  const request: RecommendationRequest = {
    ...assembled.request,
    ...(constraints ? { constraints } : {}),
  };

  const inputHash = hashRecommendationRequest(request);
  const persist = options.persist !== false;
  const maxAgeHours = options.maxAgeHours ?? DEFAULT_MAX_AGE_HOURS;

  if (!options.force) {
    const latest = await getLatestRecommendationSnapshot(user.id);
    if (latest && latest.inputHash === inputHash && snapshotAgeHours(latest) <= maxAgeHours) {
      return {
        request,
        recommendation: latest.recommendation,
        diagnostics: null,
        inputHash,
        generatedAt: latest.createdAt,
        fromSnapshot: true,
        persisted: true,
        snapshotId: latest.id,
        sourcesFa: assembled.sourcesFa,
        missingFa: assembled.missingFa,
      };
    }
  }

  const result = recommendPlan(request, getModel());

  let snapshotId: string | null = null;
  if (persist) {
    snapshotId = await saveRecommendationSnapshot({
      userId: user.id,
      request,
      recommendation: result.recommendation,
      source: options.source ?? (options.force ? "recompute" : "assessment"),
    });
  }

  // Append-only decision log (migration 003) — best-effort, never blocking.
  void recordRecommendationEvent({
    athleteId: user.athleteId,
    request,
    recommendation: result.recommendation,
    diagnostics: result.diagnostics,
  });

  return {
    request,
    recommendation: result.recommendation,
    diagnostics: result.diagnostics,
    inputHash,
    generatedAt: result.recommendation.generatedAt,
    fromSnapshot: false,
    persisted: snapshotId !== null,
    snapshotId,
    sourcesFa: assembled.sourcesFa,
    missingFa: assembled.missingFa,
  };
}

/** Recomputes and stores a plan — call after an assessment is saved. */
export async function refreshPlanForUser(user: AuthenticatedUser): Promise<ResolvedPlan | null> {
  try {
    return await resolvePlanForUser(user, { force: true, source: "assessment", maxAgeHours: 0 });
  } catch (error) {
    console.warn(
      "[recommendation/userPlan] refresh failed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}
```

---

## 23) `src/services/recommendation/presentation.ts`

```ts
/**
 * Pure presentation mapping: model output → the objects the athlete UI already renders.
 *
 * Keeping this separate from both the engine and the routes means:
 *  - the program page consumes `Program` / `Workout` exactly like the demo data does,
 *  - the dashboard consumes a small, stable `PlanSummary`,
 *  - nothing here touches the database, the clock or the network, so it is safe in SSR
 *    and cannot drift between server and client renders.
 */
import type {
  CoachingType,
  NutritionStrategyId,
  PlanDurationMonths,
  PlanRecommendation,
  ProgramDayTemplate,
} from "@/domain/recommendation";
import { COACHING_LABEL, PACKAGE_NAME_FA, PLAN_DURATION_LABEL } from "@/domain/recommendation";
import type {
  PackageId,
  Program,
  SportId,
  Workout,
  WorkoutBlock,
  WorkoutBlockType,
  WorkoutMovement,
} from "@/domain/types";

const BLOCK_TITLES: Record<WorkoutBlockType, { title: string; titleEn: string; scheme: string }> = {
  warmup: { title: "گرم کردن", titleEn: "Warm-up", scheme: "۸–۱۰ دقیقه + حرکت‌های تحرک" },
  strength: { title: "قدرت", titleEn: "Strength", scheme: "۴×۵ @ RPE ۷" },
  weightlifting: { title: "وزنه‌برداری", titleEn: "Weightlifting", scheme: "۵×۲ @ ۷۵٪" },
  skill: { title: "مهارت", titleEn: "Skill", scheme: "۵×۳ با تمرکز روی کیفیت" },
  engine: { title: "موتور هوازی", titleEn: "Engine", scheme: "۳×۶ دقیقه @ Zone 2" },
  wod: { title: "WOD", titleEn: "WOD", scheme: "AMRAP ۱۲ دقیقه" },
  cooldown: { title: "سرد کردن", titleEn: "Cooldown", scheme: "۵ دقیقه تنفس و کشش" },
};

export interface PlanSummarySafety {
  code: string;
  labelFa: string;
  actionFa: string;
  severity: "info" | "caution" | "review_required";
}

export interface PlanSummary {
  sport: SportId;
  archetypeId: string;
  archetypeLabelFa: string;
  archetypeSummaryFa: string;
  sessionsPerWeek: number;
  sessionMinutes: number;
  weeks: number;
  durationMonths: PlanDurationMonths;
  durationLabelFa: string;
  durationRationaleFa: string;
  nutritionStrategyId: NutritionStrategyId;
  nutritionLabelFa: string;
  nutritionSummaryFa: string;
  energyIntentFa: string;
  coachingMode: CoachingType;
  coachingLabelFa: string;
  packageId: PackageId;
  packageNameFa: string;
  safetyLevel: "none" | "caution" | "review_required";
  safetyFlags: PlanSummarySafety[];
  adherence30d: number;
  adherenceCycle: number;
  dataCompleteness: number;
  confidence: "low" | "medium" | "high";
  deloadWeekIndexes: number[];
  progressionNotes: string[];
  focusTags: string[];
  model: PlanRecommendation["model"];
  generatedAt: string;
  inputs: PlanRecommendation["inputs"];
  explanations: PlanRecommendation["explanations"];
}

export function buildPlanSummary(recommendation: PlanRecommendation): PlanSummary {
  return {
    sport: recommendation.sport,
    archetypeId: recommendation.program.archetypeId,
    archetypeLabelFa: recommendation.program.labelFa,
    archetypeSummaryFa: recommendation.program.summaryFa,
    sessionsPerWeek: recommendation.program.sessionsPerWeek,
    sessionMinutes: recommendation.program.sessionMinutes,
    weeks: recommendation.program.weeks,
    durationMonths: recommendation.duration.months,
    durationLabelFa:
      PLAN_DURATION_LABEL[recommendation.duration.months] ?? recommendation.duration.labelFa,
    durationRationaleFa: recommendation.duration.rationaleFa,
    nutritionStrategyId: recommendation.nutrition.strategyId,
    nutritionLabelFa: recommendation.nutrition.labelFa,
    nutritionSummaryFa: recommendation.nutrition.summaryFa,
    energyIntentFa: recommendation.nutrition.energyIntentFa,
    coachingMode: recommendation.coaching.mode,
    coachingLabelFa:
      COACHING_LABEL[recommendation.coaching.mode] ?? recommendation.coaching.labelFa,
    packageId: recommendation.package.id,
    packageNameFa: PACKAGE_NAME_FA[recommendation.package.id] ?? recommendation.package.nameFa,
    safetyLevel: recommendation.safety.level,
    safetyFlags: recommendation.safety.flags.map((flag) => ({
      code: flag.code,
      labelFa: flag.labelFa,
      actionFa: flag.actionFa,
      severity: flag.severity,
    })),
    adherence30d: recommendation.expectations.adherence30d,
    adherenceCycle: recommendation.expectations.adherenceCycle,
    dataCompleteness: recommendation.expectations.dataCompleteness,
    confidence: recommendation.expectations.confidence,
    deloadWeekIndexes: recommendation.program.deloadWeekIndexes,
    progressionNotes: recommendation.program.progressionNotes,
    focusTags: recommendation.program.focusTags,
    model: recommendation.model,
    generatedAt: recommendation.generatedAt,
    inputs: recommendation.inputs,
    explanations: recommendation.explanations,
  };
}

const GENERIC_WARMUP: WorkoutMovement[] = [
  { exerciseName: "دویدن سبک یا روئینگ", scheme: "۵ دقیقه @ Zone 1" },
  { exerciseName: "تحرک مفاصل و فعال‌سازی", scheme: "۳–۴ دقیقه" },
];

const GENERIC_COOLDOWN: WorkoutMovement[] = [
  { exerciseName: "کشش ایستا و تنفس دیافراگمی", scheme: "۵–۸ دقیقه" },
];

function mainMovementsFor(day: ProgramDayTemplate): WorkoutMovement[] {
  const scheme = "۴×۵ @ RPE ۷";
  return day.mainMovements.slice(0, 3).map((name) => ({ exerciseName: name, scheme }));
}

function movementsFor(
  day: ProgramDayTemplate,
  block: WorkoutBlockType,
  index: number,
): WorkoutMovement[] {
  if (block === "warmup") return GENERIC_WARMUP;
  if (block === "cooldown") return GENERIC_COOLDOWN;

  const main = mainMovementsFor(day);
  if (main.length === 0) {
    return [{ exerciseName: day.titleFa, scheme: BLOCK_TITLES[block].scheme }];
  }
  // Spread the day's main lifts across the working blocks so they don't repeat.
  const perBlock = Math.max(1, Math.ceil(main.length / Math.max(1, day.blocks.length - 2)));
  const start = Math.max(0, (index - 1) * perBlock) % main.length;
  return Array.from({ length: perBlock }, (_, offset) => main[(start + offset) % main.length]!).map(
    (movement) => ({
      exerciseName: movement.exerciseName,
      scheme: BLOCK_TITLES[block].scheme,
    }),
  );
}

function blocksForDay(
  day: ProgramDayTemplate,
  sessionMinutes: number,
  archetypeId: string,
): WorkoutBlock[] {
  const types =
    day.blocks.length > 0 ? day.blocks : (["warmup", "strength", "cooldown"] as WorkoutBlockType[]);
  const warmupMinutes = Math.min(12, Math.max(6, Math.round(sessionMinutes * 0.15)));
  const cooldownMinutes = 8;
  const workingTypes = types.filter((type) => type !== "warmup" && type !== "cooldown");
  const workingBudget = Math.max(
    workingTypes.length * 8,
    sessionMinutes - warmupMinutes - cooldownMinutes,
  );

  return types.map((type, index) => {
    const meta = BLOCK_TITLES[type];
    const duration =
      type === "warmup"
        ? warmupMinutes
        : type === "cooldown"
          ? cooldownMinutes
          : Math.round(workingBudget / Math.max(1, workingTypes.length));
    return {
      id: `${archetypeId}_d${day.index}_b${index}`,
      type,
      title: meta.title,
      titleEn: meta.titleEn,
      durationMin: duration,
      intent: day.focusFa,
      movements: movementsFor(day, type, index),
    } satisfies WorkoutBlock;
  });
}

export interface BuiltProgram {
  program: Program;
  workout: Workout;
}

/**
 * Turns a stored recommendation into the `Program`/`Workout` objects the athlete pages
 * render, so the UI shows the *model's* plan instead of demo content.
 */
export function buildProgramFromRecommendation(args: {
  recommendation: PlanRecommendation;
  athleteId: string;
}): BuiltProgram {
  const { recommendation, athleteId } = args;
  const programId = `rec_${recommendation.program.archetypeId}`;
  const generatedBy: Program["generatedBy"] =
    recommendation.coaching.mode === "ai"
      ? "ai"
      : recommendation.coaching.mode === "human"
        ? "coach"
        : "hybrid";

  const workouts: Workout[] = recommendation.program.days.map((day, index) => ({
    id: `${programId}_w${day.index}`,
    programId,
    dayIndex: day.index,
    date: index === 0 ? "امروز" : `+${index} روز`,
    title: day.titleFa,
    focus: day.focusFa,
    blocks: blocksForDay(
      day,
      recommendation.program.sessionMinutes,
      recommendation.program.archetypeId,
    ),
    estimatedMin: recommendation.program.sessionMinutes,
    status: index === 0 ? "today" : "planned",
  }));

  const program: Program = {
    id: programId,
    athleteId,
    name: recommendation.program.labelFa,
    sport: recommendation.sport,
    phase: recommendation.program.focusTags[0] ?? "پایه",
    weekIndex: 1,
    totalWeeks: recommendation.program.weeks,
    generatedBy,
    goal: recommendation.package.nameFa,
    workouts,
    adherence: recommendation.expectations.adherence30d,
  };

  const workout: Workout = workouts[0] ?? {
    id: `${programId}_w1`,
    programId,
    dayIndex: 1,
    date: "امروز",
    title: recommendation.program.labelFa,
    focus: recommendation.program.summaryFa,
    blocks: [],
    estimatedMin: recommendation.program.sessionMinutes,
    status: "today",
  };

  return { program, workout };
}
```

---

## 24) `src/hooks/use-plan.ts`

```ts
/**
 * Client hook around GET/POST /api/plan.
 *
 * States are explicit so pages can degrade honestly:
 *   loading        → skeleton / demo fallback
 *   unauthenticated→ show demo content + "complete your assessment" call-to-action
 *   ready          → the athlete's real, stored plan
 *   error          → demo fallback + retry
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { PlanDurationMonths } from "@/domain/recommendation";
import type { Program, Workout } from "@/domain/types";
import type { PlanSummary } from "@/services/recommendation/presentation";
import type { RecommendationDiagnostics } from "@/services/recommendation/engine";

export interface PlanMeta {
  fromSnapshot: boolean;
  persisted: boolean;
  snapshotId: string | null;
  generatedAt: string;
  inputHash: string;
  diagnostics: RecommendationDiagnostics | null;
  sourcesFa: string[];
  missingFa: string[];
}

export interface PlanResponse {
  ok: true;
  authenticated: true;
  plan: PlanSummary;
  program: Program;
  workout: Workout;
  meta: PlanMeta;
}

export type PlanStatus = "loading" | "unauthenticated" | "ready" | "error";

export interface UsePlanResult {
  status: PlanStatus;
  data: PlanResponse | null;
  error: string | null;
  refreshing: boolean;
  refresh: (constraints?: { durationMonths?: PlanDurationMonths | "auto" }) => Promise<void>;
}

async function readPlan(
  init?: RequestInit,
): Promise<{ status: PlanStatus; data: PlanResponse | null; error: string | null }> {
  const response = await fetch("/api/plan", {
    credentials: "same-origin",
    headers: { accept: "application/json" },
    ...init,
  });

  if (response.status === 401 || response.status === 403) {
    return { status: "unauthenticated", data: null, error: null };
  }

  const json = (await response.json().catch(() => null)) as
    (PlanResponse | { ok: false; error?: string }) | null;

  if (!response.ok || !json || !("ok" in json) || json.ok !== true) {
    return {
      status: "error",
      data: null,
      error:
        (json && "error" in json && typeof json.error === "string" && json.error) ||
        "دریافت برنامه ناموفق بود.",
    };
  }

  return { status: "ready", data: json, error: null };
}

export function usePlan(options: { enabled?: boolean } = {}): UsePlanResult {
  const enabled = options.enabled !== false;
  const [status, setStatus] = useState<PlanStatus>(enabled ? "loading" : "unauthenticated");
  const [data, setData] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await readPlan();
        if (cancelled || !mounted.current) return;
        setStatus(result.status);
        setData(result.data);
        setError(result.error);
      } catch {
        if (cancelled || !mounted.current) return;
        setStatus("error");
        setError("ارتباط با سرور برقرار نشد.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const refresh = useCallback(
    async (constraints?: { durationMonths?: PlanDurationMonths | "auto" }) => {
      if (!enabled) return;
      setRefreshing(true);
      try {
        const result = await readPlan({
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ regenerate: true, ...(constraints ? { constraints } : {}) }),
        });
        if (!mounted.current) return;
        setStatus(result.status);
        setData(result.data);
        setError(result.error);
      } catch {
        if (!mounted.current) return;
        setStatus("error");
        setError("به‌روزرسانی برنامه ناموفق بود.");
      } finally {
        if (mounted.current) setRefreshing(false);
      }
    },
    [enabled],
  );

  return { status, data, error, refreshing, refresh };
}
```

---

## 25) `src/components/domain/plan-summary.tsx`

```tsx
/**
 * Dashboard card for the model-generated plan.
 *
 * Shows the athlete's stored plan (programme archetype, cycle length, nutrition strategy,
 * coaching mode and the predicted adherence) and links to the real pages. Falls back to a
 * clear call-to-action when the athlete has not completed an assessment yet.
 */
import { Link } from "@tanstack/react-router";
import { Brain, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, Pill, ProgressRing, SectionHeading } from "@/components/domain/primitives";
import { usePlan } from "@/hooks/use-plan";
import { faNumber } from "@/lib/locale";

export function PlanSummaryCard({ className }: { className?: string }) {
  const plan = usePlan();
  const ready = plan.status === "ready" ? plan.data : null;

  if (ready) {
    const summary = ready.plan;
    return (
      <Panel className={className}>
        <SectionHeading
          title="برنامهٔ پیشنهادی مدل"
          subtitle={`${summary.archetypeLabelFa} · ${summary.durationLabelFa}`}
          action={{ label: "برنامهٔ تمرین", to: "/athlete/program" }}
        />
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="min-w-0 space-y-2 text-xs">
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <span>
                {faNumber(summary.sessionsPerWeek)} جلسه در هفته ·{" "}
                {faNumber(summary.sessionMinutes)} دقیقه
              </span>
              <span>{summary.nutritionLabelFa}</span>
              <span>{summary.coachingLabelFa}</span>
            </div>
            <p className="text-muted-foreground">{summary.nutritionSummaryFa}</p>
            <p className="text-[11px] text-muted-foreground">
              مدل {summary.model.version}
              {summary.model.trainingData === "simulated" ? " · داده آموزشی شبیه‌سازی‌شده" : ""}
              {ready.meta.fromSnapshot ? " · از برنامهٔ ذخیره‌شده" : " · همین حالا محاسبه شد"}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {summary.safetyLevel !== "none" && (
                <Pill color="var(--warning, #d97706)">
                  {summary.safetyLevel === "review_required" ? "نیازمند بازبینی مربی" : "با احتیاط"}
                </Pill>
              )}
              <Pill>
                اطمینان:{" "}
                {summary.confidence === "high"
                  ? "بالا"
                  : summary.confidence === "medium"
                    ? "متوسط"
                    : "کم"}
              </Pill>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[11px]"
                onClick={() => void plan.refresh()}
                disabled={plan.refreshing}
              >
                <RefreshCw className={plan.refreshing ? "size-3.5 animate-spin" : "size-3.5"} />
                {plan.refreshing ? "بازتولید…" : "بازتولید"}
              </Button>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <ProgressRing value={Math.round(summary.adherence30d * 100)} size={78} />
            <span className="text-[10px] text-muted-foreground">پایبندی ۳۰ روز</span>
          </div>
        </div>
      </Panel>
    );
  }

  if (plan.status === "loading") {
    return (
      <Panel className={className}>
        <SectionHeading title="برنامهٔ پیشنهادی مدل" subtitle="در حال دریافت…" />
        <p className="text-xs text-muted-foreground">برنامهٔ شما از سرور خوانده می‌شود.</p>
      </Panel>
    );
  }

  if (plan.status === "unauthenticated") {
    return (
      <Panel className={className}>
        <SectionHeading title="برنامهٔ پیشنهادی مدل" subtitle="پس از ارزیابی ساخته می‌شود" />
        <p className="mb-3 text-xs text-muted-foreground">
          با تکمیل ارزیابی اولیه و ارزیابی رشته، موتور FitLytix برنامهٔ تمرین، ساختار تغذیه، طول
          دوره و نوع مربی‌گری را مخصوص شما تولید می‌کند.
        </p>
        <Button size="sm" variant="hero" asChild>
          <Link to="/assessment/common">
            <Sparkles className="size-4" /> شروع ارزیابی
          </Link>
        </Button>
      </Panel>
    );
  }

  return (
    <Panel className={className}>
      <SectionHeading title="برنامهٔ پیشنهادی مدل" subtitle="دریافت برنامه ناموفق بود" />
      <p className="mb-3 text-xs text-muted-foreground">
        {plan.error ?? "ارتباط با سرور برقرار نشد."}
      </p>
      <Button size="sm" variant="outline" onClick={() => void plan.refresh()}>
        <Brain className="size-4" /> تلاش دوباره
      </Button>
    </Panel>
  );
}
```

---

## 26) `src/routes/api/recommend.ts`

```ts
import { createFileRoute } from "@tanstack/react-router";
import { getSessionUser } from "@/lib/auth.server";
import type { RecommendationRequest } from "@/domain/recommendation";
import { recommendPlan } from "@/services/recommendation/engine";
import { getModel, getModelInfo, getModelMetrics } from "@/services/recommendation/model.server";
import { recommendationRequestSchema } from "@/services/recommendation/requestSchema";
import { recordRecommendationEvent } from "@/services/recommendation/store.server";

/**
 * POST /api/recommend
 *
 * Server-side inference of the self-hosted model. Auth is optional: a signed-in
 * athlete is bound to the session identity, a guest can still preview a plan.
 * The response always states `model.source` (model vs fallback) and confidence.
 */
export const Route = createFileRoute("/api/recommend")({
  server: {
    handlers: {
      GET: async () => {
        const info = getModelInfo();
        const metrics = getModelMetrics();
        return Response.json(
          {
            ok: true,
            model: {
              ...info,
              programAccuracy: Object.fromEntries(
                Object.entries(metrics.program).map(([sport, m]) => [
                  sport,
                  {
                    accuracy: m.accuracy,
                    top2Accuracy: m.top2Accuracy,
                    majorityBaseline: m.baselineMajority,
                  },
                ]),
              ),
              nutritionAccuracy: metrics.nutrition.accuracy,
              durationAccuracy: metrics.duration.top2Accuracy,
              adherenceMae: metrics.adherence.mae,
            },
            contract: {
              method: "POST",
              requiredFields: ["sport"],
              durations: getModel().durationMonths,
              sports: getModel().sports,
            },
          },
          { status: 200, headers: { "cache-control": "no-store" } },
        );
      },

      POST: async ({ request }) => {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return Response.json(
            { ok: false, error: "بدنه درخواست JSON معتبر نیست." },
            { status: 400, headers: { "cache-control": "no-store" } },
          );
        }

        const parsed = recommendationRequestSchema.safeParse(raw);
        if (!parsed.success) {
          const firstIssue = parsed.error.issues[0];
          return Response.json(
            {
              ok: false,
              error: firstIssue
                ? `${firstIssue.path.join(".") || "body"}: ${firstIssue.message}`
                : "ورودی نامعتبر است.",
              issues: parsed.error.issues.map((i) => ({
                path: i.path.join("."),
                message: i.message,
              })),
            },
            { status: 400, headers: { "cache-control": "no-store" } },
          );
        }

        const user = await getSessionUser(request).catch(() => null);
        const body = parsed.data as RecommendationRequest;
        const effectiveRequest: RecommendationRequest = {
          ...body,
          ...(user?.athleteId ? { athleteId: user.athleteId } : {}),
        };

        try {
          const result = recommendPlan(effectiveRequest, getModel());

          // Fire-and-forget: logging must never delay or fail the response.
          void recordRecommendationEvent({
            athleteId: user?.athleteId,
            request: effectiveRequest,
            recommendation: result.recommendation,
            diagnostics: result.diagnostics,
          });

          return Response.json(
            { ok: true, ...result, authenticated: Boolean(user) },
            { status: 200, headers: { "cache-control": "no-store" } },
          );
        } catch (error) {
          console.error(
            "[api/recommend] inference failed:",
            error instanceof Error ? error.message : error,
          );
          return Response.json(
            { ok: false, error: "تولید پیشنهاد با خطا مواجه شد. لطفاً دوباره تلاش کنید." },
            { status: 500, headers: { "cache-control": "no-store" } },
          );
        }
      },
    },
  },
});
```

---

## 27) `src/routes/api/plan.ts`

```ts
/**
 * Athlete-facing plan endpoint.
 *
 *   GET  /api/plan   → the plan for the signed-in athlete (stored snapshot when it is
 *                      still valid, otherwise compute + persist)
 *   POST /api/plan   → recompute now, optionally overriding the cycle length / package /
 *                      coaching mode (e.g. the athlete picked a different subscription)
 *
 * Unlike `POST /api/recommend` (stateless, accepts arbitrary input, used by the demo page
 * and by external clients), this route never trusts client-supplied assessment data:
 * everything comes from the authenticated athlete's stored records.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AuthHttpError, requireAuthenticatedUser } from "@/lib/auth.server";
import {
  buildPlanSummary,
  buildProgramFromRecommendation,
} from "@/services/recommendation/presentation";
import { resolvePlanForUser } from "@/services/recommendation/userPlan.server";

const constraintsSchema = z
  .object({
    durationMonths: z
      .union([z.literal(1), z.literal(3), z.literal(6), z.literal(12), z.literal("auto")])
      .optional(),
    packageId: z.enum(["training", "nutrition", "combined"]).optional(),
    coachingPreference: z.enum(["ai", "hybrid", "human", "auto"]).optional(),
    maxSessionsPerWeek: z.number().int().min(1).max(7).optional(),
  })
  .optional();

const bodySchema = z
  .object({
    regenerate: z.boolean().optional(),
    constraints: constraintsSchema,
  })
  .optional();

function authErrorResponse(err: AuthHttpError): Response {
  return Response.json(
    { ok: false, error: err.message, code: "unauthenticated" },
    { status: err.statusCode, headers: { "cache-control": "no-store" } },
  );
}

function failureResponse(error: unknown, scope: string): Response {
  console.error(`[api/plan ${scope}]`, error instanceof Error ? error.message : error);
  return Response.json(
    { ok: false, error: "تولید یا بازیابی برنامه با خطا مواجه شد. لطفاً دوباره تلاش کنید." },
    { status: 500, headers: { "cache-control": "no-store" } },
  );
}

async function respondWithPlan(
  request: Request,
  options: { force: boolean; constraints?: z.infer<typeof constraintsSchema> },
): Promise<Response> {
  const user = await requireAuthenticatedUser(request);
  const resolved = await resolvePlanForUser(user, {
    force: options.force,
    ...(options.constraints ? { constraints: options.constraints } : {}),
    ...(options.force ? { source: "manual" as const } : {}),
  });

  const program = buildProgramFromRecommendation({
    recommendation: resolved.recommendation,
    athleteId: user.athleteId,
  });

  return Response.json(
    {
      ok: true,
      authenticated: true,
      plan: buildPlanSummary(resolved.recommendation),
      program: program.program,
      workout: program.workout,
      meta: {
        fromSnapshot: resolved.fromSnapshot,
        persisted: resolved.persisted,
        snapshotId: resolved.snapshotId,
        generatedAt: resolved.generatedAt,
        inputHash: resolved.inputHash,
        diagnostics: resolved.diagnostics,
        sourcesFa: resolved.sourcesFa,
        missingFa: resolved.missingFa,
      },
    },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}

export const Route = createFileRoute("/api/plan")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          return await respondWithPlan(request, { force: false });
        } catch (err) {
          if (err instanceof AuthHttpError) return authErrorResponse(err);
          return failureResponse(err, "GET");
        }
      },

      POST: async ({ request }) => {
        try {
          const raw = await request.json().catch(() => ({}));
          const parsed = bodySchema.safeParse(raw);
          if (!parsed.success) {
            return Response.json(
              {
                ok: false,
                error: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است.",
              },
              { status: 400, headers: { "cache-control": "no-store" } },
            );
          }
          const body = parsed.data ?? {};
          return await respondWithPlan(request, {
            force: body.regenerate !== false,
            ...(body.constraints ? { constraints: body.constraints } : {}),
          });
        } catch (err) {
          if (err instanceof AuthHttpError) return authErrorResponse(err);
          return failureResponse(err, "POST");
        }
      },
    },
  },
});
```

---

## 28) `src/routes/api/plan-diagnose.ts`

```ts
/**
 * Deployment self-check for the recommendation pipeline.
 *
 *   GET /api/plan-diagnose     (requires a signed-in athlete)
 *
 * Answers the questions that are otherwise buried in logs:
 *   - is the database reachable and are migrations 001–004 applied?
 *   - did this athlete's assessment answers actually land in the tables the model reads?
 *   - which signals are still missing (so a plan is thin)?
 *   - what would the model decide right now, and is a snapshot stored?
 *
 * Read-only: the dry-run recommendation is computed with `persist: false`.
 */
import { createFileRoute } from "@tanstack/react-router";
import type { RowDataPacket } from "mysql2/promise";
import { AuthHttpError, requireAuthenticatedUser } from "@/lib/auth.server";
import { dbQuery, isDatabaseConfigured, tableExists } from "@/lib/db.server";
import { assembleRecommendationRequest } from "@/services/recommendation/assembly.server";
import {
  getLatestRecommendationSnapshot,
  snapshotAgeHours,
} from "@/services/recommendation/snapshots.server";
import { resolvePlanForUser } from "@/services/recommendation/userPlan.server";

const REQUIRED_TABLES = [
  "users",
  "athlete_profiles",
  "assessments",
  "assessment_answers",
  "body_analysis_records",
  "training_sessions",
  "workout_logs",
  "nutrition_logs",
  "subscriptions",
  "subscription_plans",
  "recommendation_events",
  "recommendation_outcomes",
  "model_registry",
  "recommendation_snapshots",
] as const;

async function countRows(sql: string, params: unknown[]): Promise<number | null> {
  try {
    const rows = await dbQuery<RowDataPacket[]>(sql, params);
    return Number(rows[0]?.["total"] ?? 0);
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/plan-diagnose")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const headers = { "cache-control": "no-store" } as const;
        let user;
        try {
          user = await requireAuthenticatedUser(request);
        } catch (err) {
          if (err instanceof AuthHttpError) {
            return Response.json(
              { ok: false, error: err.message, code: "unauthenticated" },
              { status: err.statusCode, headers },
            );
          }
          throw err;
        }

        const tables: Record<string, boolean> = {};
        for (const table of REQUIRED_TABLES) {
          try {
            tables[table] = await tableExists(table);
          } catch {
            tables[table] = false;
          }
        }

        const assembled = await assembleRecommendationRequest(user);
        const latest = await getLatestRecommendationSnapshot(user.id);

        let dryRun: Record<string, unknown> | null = null;
        let dryRunError: string | null = null;
        try {
          const resolved = await resolvePlanForUser(user, { persist: false, force: true });
          dryRun = {
            archetypeId: resolved.recommendation.program.archetypeId,
            archetypeLabelFa: resolved.recommendation.program.labelFa,
            sessionsPerWeek: resolved.recommendation.program.sessionsPerWeek,
            sessionMinutes: resolved.recommendation.program.sessionMinutes,
            durationMonths: resolved.recommendation.duration.months,
            nutritionStrategyId: resolved.recommendation.nutrition.strategyId,
            coachingMode: resolved.recommendation.coaching.mode,
            safetyLevel: resolved.recommendation.safety.level,
            safetyFlags: resolved.recommendation.safety.flags.map((flag) => flag.code),
            confidence: resolved.recommendation.expectations.confidence,
            adherence30d: resolved.recommendation.expectations.adherence30d,
            inputHash: resolved.inputHash,
            latencyMs: resolved.diagnostics?.latencyMs ?? null,
          };
        } catch (err) {
          dryRunError = err instanceof Error ? err.message : String(err);
        }

        const [assessments, snapshots, sessions28d, nutritionDays] = await Promise.all([
          countRows(`SELECT COUNT(*) AS total FROM assessments WHERE athlete_user_id = ?`, [
            user.id,
          ]),
          countRows(`SELECT COUNT(*) AS total FROM recommendation_snapshots WHERE user_id = ?`, [
            user.id,
          ]),
          countRows(
            `SELECT COUNT(*) AS total FROM training_sessions
             WHERE athlete_user_id = ? AND scheduled_at >= (NOW() - INTERVAL 28 DAY)`,
            [user.id],
          ),
          countRows(
            `SELECT COUNT(DISTINCT DATE(logged_at)) AS total FROM nutrition_logs
             WHERE athlete_user_id = ? AND logged_at >= (NOW() - INTERVAL 28 DAY)`,
            [user.id],
          ),
        ]);

        return Response.json(
          {
            ok: true,
            database: {
              configured: isDatabaseConfigured(),
              tables,
              migrations: {
                "001_training_core": tables["training_sessions"] === true,
                "002_mysql_auth_assessment":
                  tables["users"] === true &&
                  tables["assessments"] === true &&
                  tables["assessment_answers"] === true,
                "003_recommendation_engine":
                  tables["recommendation_events"] === true && tables["model_registry"] === true,
                "004_recommendation_snapshots": tables["recommendation_snapshots"] === true,
              },
            },
            athlete: {
              userId: user.id,
              athleteId: user.athleteId,
              primarySport: user.primarySport,
              assessments,
              answersCount: Object.keys(assembled.request.assessmentAnswers ?? {}).length,
              sessions28d,
              nutritionDays28d: nutritionDays,
              bodyFatPct: assembled.request.bodyAnalysis?.bodyFatPct ?? null,
              subscription: assembled.request.constraints ?? null,
              sourcesFa: assembled.sourcesFa,
              missingFa: assembled.missingFa,
            },
            storedSnapshot: latest
              ? {
                  id: latest.id,
                  createdAt: latest.createdAt,
                  ageHours: Number(snapshotAgeHours(latest).toFixed(2)),
                  modelVersion: latest.modelVersion,
                  archetypeId: latest.recommendation.program.archetypeId,
                  durationMonths: latest.recommendation.duration.months,
                }
              : null,
            snapshotCount: snapshots,
            dryRun,
            dryRunError,
            hints: [
              tables["recommendation_snapshots"] !== true
                ? "migration 004 اعمال نشده است: database/migrations/mysql/004_recommendation_snapshots.sql"
                : null,
              tables["recommendation_events"] !== true
                ? "migration 003 اعمال نشده است (لاگ تصمیم‌ها غیرفعال است)"
                : null,
              (assessments ?? 0) === 0
                ? "برای این کاربر ارزیابی‌ای در جدول assessments نیست؛ ابتدا فرم ارزیابی را کامل کنید."
                : null,
              Object.keys(assembled.request.assessmentAnswers ?? {}).length === 0
                ? "کلیدهای پاسخ ذخیره‌شده با مدل هم‌خوان نیستند یا خالی‌اند؛ لاگ [api/assessment] را بررسی کنید."
                : null,
            ].filter((hint): hint is string => hint !== null),
          },
          { status: 200, headers },
        );
      },
    },
  },
});
```

---

## 29) `src/routes/recommendation.tsx`

```tsx
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Brain,
  Check,
  Gauge,
  Loader2,
  Play,
  ShieldCheck,
  Sparkles,
  Utensils,
} from "lucide-react";
import { MarketingShell } from "@/components/layout/MarketingShell";
import { Button } from "@/components/ui/button";
import { MockBadge, PageHeader, Panel, Pill } from "@/components/domain/primitives";
import { SPORT_LIST } from "@/domain/sports";
import type { GoalId, PlanRecommendation, RecommendationRequest } from "@/domain/recommendation";
import { GOAL_LABEL } from "@/domain/recommendation";
import type { ExperienceLevel, SportId } from "@/domain/types";

export const Route = createFileRoute("/recommendation")({
  head: () => ({
    meta: [
      { title: "موتور پیشنهاد برنامه — FitLytix" },
      {
        name: "description",
        content:
          "پیشنهاد برنامه تمرین و ساختار تغذیه بر اساس ارزیابی اولیه، رفتار ۲۸ روز و طول دوره انتخابی — مدل خودمیزبان.",
      },
      { property: "og:title", content: "موتور پیشنهاد برنامه — FitLytix" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RecommendationDemo,
});

const GOALS: GoalId[] = ["strength", "muscle", "fat_loss", "endurance", "competition", "health"];
const EXPERIENCES: { value: ExperienceLevel; label: string }[] = [
  { value: "beginner", label: "مبتدی" },
  { value: "intermediate", label: "متوسط" },
  { value: "advanced", label: "پیشرفته" },
  { value: "elite", label: "حرفه‌ای" },
];

const DURATIONS = [
  { value: "auto", label: "خودکار" },
  { value: 1, label: "۱ ماه" },
  { value: 3, label: "۳ ماه" },
  { value: 6, label: "۶ ماه" },
  { value: 12, label: "۱۲ ماه" },
] as const;

const FIELD_CLASS =
  "w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60";

interface DemoForm {
  sport: SportId;
  goal: GoalId;
  experience: ExperienceLevel;
  age: number;
  weightKg: number;
  heightCm: number;
  sessionsPerWeek: number;
  minutesPerSession: number;
  sleepHours: number;
  pain: "none" | "mild" | "limited";
  planned: number;
  completed: number;
  avgRpe: number;
  duration: "auto" | 1 | 3 | 6 | 12;
}

const DEFAULT_FORM: DemoForm = {
  sport: "crossfit",
  goal: "muscle",
  experience: "intermediate",
  age: 29,
  weightKg: 78,
  heightCm: 178,
  sessionsPerWeek: 4,
  minutesPerSession: 60,
  sleepHours: 7,
  pain: "none",
  planned: 16,
  completed: 12,
  avgRpe: 7.4,
  duration: "auto",
};

const PAIN_ANSWER: Record<DemoForm["pain"], string> = {
  none: "option_1",
  mild: "option_2",
  limited: "option_4",
};

const EXPERIENCE_OPTION: Record<ExperienceLevel, string> = {
  beginner: "option_1",
  intermediate: "option_2",
  advanced: "option_3",
  elite: "option_5",
};

function buildRequest(form: DemoForm): RecommendationRequest {
  const trainingHistory =
    form.experience === "beginner"
      ? "option_1"
      : form.experience === "intermediate"
        ? "option_3"
        : form.experience === "advanced"
          ? "option_4"
          : "option_5";
  const primaryGoal = `option_${GOALS.indexOf(form.goal) + 1}`;
  return {
    sport: form.sport,
    profile: {
      age: form.age,
      gender: "male",
      heightCm: form.heightCm,
      weightKg: form.weightKg,
      experience: form.experience,
      primaryGoal: form.goal,
      sessionsPerWeek: form.sessionsPerWeek,
      minutesPerSession: form.minutesPerSession,
    },
    assessmentAnswers: {
      "common.profile.training_history": trainingHistory,
      "common.goals.primary": primaryGoal,
      "common.schedule.sessions_per_week": form.sessionsPerWeek,
      "common.schedule.minutes_per_session": "option_3",
      "common.safety.pain": PAIN_ANSWER[form.pain],
      "common.recovery.sleep_hours": form.sleepHours,
      "common.recovery.quality": 3,
      "common.recovery.stress": 3,
      "crossfit.level.skill": EXPERIENCE_OPTION[form.experience],
    },
    bodyAnalysis: { weightKg: form.weightKg, heightCm: form.heightCm, bodyFatPct: 18 },
    behavior: {
      plannedSessions: form.planned,
      completedSessions: form.completed,
      avgRpe: form.avgRpe,
      readinessAvg: 72,
      nutritionAdherence: 0.75,
      priorPlanCount: 1,
      priorPlanMonths: 3,
      daysSinceSignup: 120,
    },
    constraints: { durationMonths: form.duration, packageId: "combined" },
  };
}

function RecommendationDemo() {
  const [form, setForm] = useState<DemoForm>(DEFAULT_FORM);
  const [result, setResult] = useState<PlanRecommendation | null>(null);
  const [diagnostics, setDiagnostics] = useState<{
    latencyMs: number;
    fallbackReasons: string[];
    modelVersion: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const update = <K extends keyof DemoForm>(key: K, value: DemoForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildRequest(form)),
      });
      const json = (await response.json()) as
        | { ok: true; recommendation: PlanRecommendation; diagnostics: typeof diagnostics }
        | { ok: false; error?: string };
      if (!response.ok || !json.ok) {
        setError(("error" in json && json.error) || "تولید پیشنهاد با خطا مواجه شد.");
        return;
      }
      setResult(json.recommendation);
      setDiagnostics(json.diagnostics);
    } catch {
      setError("ارتباط با سرور برقرار نشد.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <MarketingShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-10 md:px-8">
        <PageHeader
          eyebrow="SELF-HOSTED ML · PLAN RECOMMENDER"
          title="پیشنهاد برنامه بر اساس ارزیابی و رفتار"
          description="مدل روی سرور خودتان اجرا می‌شود. ورودی‌های ارزیابی، ترکیب بدن و رفتار ۲۸ روز را می‌گیرد و برنامه تمرین، ساختار تغذیه، طول دوره و نوع مربیگری را با دلیل پیشنهاد می‌دهد."
          actions={
            <MockBadge
              label={
                result?.model.trainingData === "logged"
                  ? "مدل آموزش‌دیده روی داده واقعی"
                  : "مدل آموزشی · داده شبیه‌سازی‌شده"
              }
            />
          }
        />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_1fr]">
          {/* -------------------------------------------------- form */}
          <Panel className="h-fit space-y-4 rounded-2xl">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Gauge className="size-4 text-primary" /> ورودی ارزیابی
            </div>

            <div>
              <div className="mb-1.5 text-xs text-muted-foreground">رشته</div>
              <div className="flex flex-wrap gap-1.5">
                {SPORT_LIST.map((sport) => (
                  <button
                    key={sport.id}
                    type="button"
                    onClick={() => update("sport", sport.id)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      form.sport === sport.id
                        ? "border-primary bg-primary-soft text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {sport.nameFa}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-muted-foreground">
                سطح تجربه
                <select
                  className={`${FIELD_CLASS} mt-1`}
                  value={form.experience}
                  onChange={(event) => update("experience", event.target.value as ExperienceLevel)}
                >
                  {EXPERIENCES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted-foreground">
                هدف اصلی
                <select
                  className={`${FIELD_CLASS} mt-1`}
                  value={form.goal}
                  onChange={(event) => update("goal", event.target.value as GoalId)}
                >
                  {GOALS.map((goal) => (
                    <option key={goal} value={goal}>
                      {GOAL_LABEL[goal]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <label className="text-xs text-muted-foreground">
                سن
                <input
                  type="number"
                  className={`${FIELD_CLASS} mt-1`}
                  value={form.age}
                  min={12}
                  max={85}
                  onChange={(event) => update("age", Number(event.target.value))}
                />
              </label>
              <label className="text-xs text-muted-foreground">
                وزن
                <input
                  type="number"
                  className={`${FIELD_CLASS} mt-1`}
                  value={form.weightKg}
                  min={35}
                  max={200}
                  onChange={(event) => update("weightKg", Number(event.target.value))}
                />
              </label>
              <label className="text-xs text-muted-foreground">
                قد
                <input
                  type="number"
                  className={`${FIELD_CLASS} mt-1`}
                  value={form.heightCm}
                  min={140}
                  max={210}
                  onChange={(event) => update("heightCm", Number(event.target.value))}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-muted-foreground">
                جلسات در هفته
                <input
                  type="number"
                  className={`${FIELD_CLASS} mt-1`}
                  value={form.sessionsPerWeek}
                  min={1}
                  max={7}
                  onChange={(event) => update("sessionsPerWeek", Number(event.target.value))}
                />
              </label>
              <label className="text-xs text-muted-foreground">
                دقیقه هر جلسه
                <input
                  type="number"
                  className={`${FIELD_CLASS} mt-1`}
                  value={form.minutesPerSession}
                  min={20}
                  max={150}
                  step={5}
                  onChange={(event) => update("minutesPerSession", Number(event.target.value))}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-muted-foreground">
                خواب شبانه
                <input
                  type="number"
                  className={`${FIELD_CLASS} mt-1`}
                  value={form.sleepHours}
                  min={3}
                  max={12}
                  step={0.5}
                  onChange={(event) => update("sleepHours", Number(event.target.value))}
                />
              </label>
              <label className="text-xs text-muted-foreground">
                وضعیت درد
                <select
                  className={`${FIELD_CLASS} mt-1`}
                  value={form.pain}
                  onChange={(event) => update("pain", event.target.value as DemoForm["pain"])}
                >
                  <option value="none">بدون درد</option>
                  <option value="mild">درد خفیف</option>
                  <option value="limited">پزشک محدود کرده</option>
                </select>
              </label>
            </div>

            <div className="rounded-lg border border-border bg-surface-2/60 p-3">
              <div className="mb-2 text-xs font-semibold">رفتار ۲۸ روز گذشته</div>
              <div className="grid grid-cols-3 gap-2">
                <label className="text-[11px] text-muted-foreground">
                  برنامه‌ریزی‌شده
                  <input
                    type="number"
                    className={`${FIELD_CLASS} mt-1 px-2 py-1`}
                    value={form.planned}
                    min={0}
                    max={40}
                    onChange={(event) => update("planned", Number(event.target.value))}
                  />
                </label>
                <label className="text-[11px] text-muted-foreground">
                  انجام‌شده
                  <input
                    type="number"
                    className={`${FIELD_CLASS} mt-1 px-2 py-1`}
                    value={form.completed}
                    min={0}
                    max={40}
                    onChange={(event) => update("completed", Number(event.target.value))}
                  />
                </label>
                <label className="text-[11px] text-muted-foreground">
                  RPE میانگین
                  <input
                    type="number"
                    className={`${FIELD_CLASS} mt-1 px-2 py-1`}
                    value={form.avgRpe}
                    min={0}
                    max={10}
                    step={0.1}
                    onChange={(event) => update("avgRpe", Number(event.target.value))}
                  />
                </label>
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-xs text-muted-foreground">طول دوره</div>
              <div className="flex flex-wrap gap-1.5">
                {DURATIONS.map((item) => (
                  <button
                    key={String(item.value)}
                    type="button"
                    onClick={() => update("duration", item.value)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      form.duration === item.value
                        ? "border-primary bg-primary-soft text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <Button className="w-full" onClick={run} disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              {loading ? "در حال پیش‌بینی…" : "تولید پیشنهاد"}
            </Button>
            {error && (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertTriangle className="size-3.5" /> {error}
              </p>
            )}
            <p className="text-[11px] leading-5 text-muted-foreground">
              مدل روی داده مصنوعی آموزش دیده است؛ خروجی برای نمایش معماری و جریان داده است و جای
              توصیه پزشکی یا مربی انسانی را نمی‌گیرد.
            </p>
          </Panel>

          {/* -------------------------------------------------- result */}
          <div className="space-y-4">
            {!result && (
              <Panel className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center">
                <Brain className="size-10 text-primary/70" />
                <div className="font-display text-lg font-bold">هنوز پیشنهادی ساخته نشده</div>
                <p className="max-w-sm text-sm text-muted-foreground">
                  ورودی‌ها را تنظیم کنید و «تولید پیشنهاد» را بزنید. خروجی شامل برنامه هفتگی، ساختار
                  تغذیه، طول دوره، پیش‌بینی پایبندی و دلیل انتخاب است.
                </p>
              </Panel>
            )}

            {result && (
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  <Panel className="rounded-xl">
                    <div className="text-[11px] text-muted-foreground">برنامه پیشنهادی</div>
                    <div className="mt-1 font-display text-lg font-bold text-primary">
                      {result.program.labelFa}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {result.program.sessionsPerWeek} جلسه × {result.program.sessionMinutes} دقیقه
                      · {result.program.weeks} هفته
                    </div>
                  </Panel>
                  <Panel className="rounded-xl">
                    <div className="text-[11px] text-muted-foreground">طول دوره</div>
                    <div className="mt-1 font-display text-lg font-bold">
                      {result.duration.months} ماه
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {result.coaching.labelFa}
                    </div>
                  </Panel>
                  <Panel className="rounded-xl">
                    <div className="text-[11px] text-muted-foreground">پیش‌بینی پایبندی</div>
                    <div className="mt-1 font-display text-lg font-bold">
                      {Math.round(result.expectations.adherenceCycle * 100)}٪
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      اطمینان:{" "}
                      {result.expectations.confidence === "high"
                        ? "بالا"
                        : result.expectations.confidence === "medium"
                          ? "متوسط"
                          : "پایین"}
                    </div>
                  </Panel>
                </div>

                {result.safety.flags.length > 0 && (
                  <Panel className="rounded-xl border border-amber-500/30">
                    <div className="mb-2 flex items-center gap-2 text-sm font-bold">
                      <ShieldCheck className="size-4 text-amber-400" /> هشدارهای ایمنی
                    </div>
                    <ul className="space-y-1.5 text-xs text-muted-foreground">
                      {result.safety.flags.map((flag) => (
                        <li key={flag.code}>
                          <span className="font-semibold text-foreground">{flag.labelFa}:</span>{" "}
                          {flag.actionFa}
                        </li>
                      ))}
                    </ul>
                  </Panel>
                )}

                <Panel className="rounded-xl">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-bold">ساختار هفته</div>
                    <Pill color="var(--primary)">{result.program.archetypeId}</Pill>
                  </div>
                  <div className="space-y-2">
                    {result.program.days.map((day) => (
                      <div
                        key={day.index}
                        className="rounded-lg border border-border bg-surface-2/50 p-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold">روز {day.index}</span>
                          <span className="text-xs">{day.titleFa}</span>
                          <span className="text-[11px] text-muted-foreground">— {day.focusFa}</span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {day.blocks.map((block) => (
                            <span
                              key={block}
                              className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground"
                            >
                              {block}
                            </span>
                          ))}
                          {day.mainMovements.map((movement) => (
                            <span
                              key={movement}
                              className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-foreground/80"
                            >
                              {movement}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <ul className="mt-3 space-y-1 text-[11px] text-muted-foreground">
                    {result.program.progressionNotes.slice(0, 4).map((note) => (
                      <li key={note} className="flex gap-1.5">
                        <Check className="mt-0.5 size-3 shrink-0 text-primary" /> {note}
                      </li>
                    ))}
                  </ul>
                </Panel>

                <Panel className="rounded-xl">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold">
                    <Utensils className="size-4 text-primary" /> ساختار تغذیه
                  </div>
                  <div className="mb-2 text-xs text-muted-foreground">
                    {result.nutrition.labelFa} — {result.nutrition.summaryFa}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {result.nutrition.macros.map((macro) => (
                      <div
                        key={macro.id}
                        className="rounded-lg border border-border bg-surface-2/50 p-2.5"
                      >
                        <div className="text-[11px] text-muted-foreground">{macro.labelFa}</div>
                        <div className="mt-0.5 text-sm font-bold">
                          {macro.gPerKg[0]}–{macro.gPerKg[1]} گرم/کیلو
                        </div>
                        <div className="mt-0.5 text-[10px] text-muted-foreground">
                          {macro.roleFa}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {result.nutrition.dayTypes.map((dayType) => (
                      <span
                        key={dayType.dayType}
                        className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {dayType.labelFa} · کربوهیدرات ×{dayType.carbMultiplier}
                      </span>
                    ))}
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                      آب {result.nutrition.hydrationL} لیتر
                    </span>
                  </div>
                  <ul className="mt-3 space-y-1 text-[11px] text-muted-foreground">
                    {result.nutrition.notes.map((note) => (
                      <li key={note}>• {note}</li>
                    ))}
                  </ul>
                </Panel>

                <Panel className="rounded-xl">
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold">
                    <Sparkles className="size-4 text-primary" /> چرا این انتخاب؟
                  </div>
                  <div className="mb-3 space-y-1 text-[11px] text-muted-foreground">
                    <p>{result.duration.rationaleFa}</p>
                    <p>{result.coaching.rationaleFa}</p>
                  </div>
                  <div className="space-y-1.5">
                    {result.explanations.length === 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        ورودی کافی برای توضیح جزئیات ثبت نشده است.
                      </p>
                    )}
                    {result.explanations.map((explanation) => (
                      <div
                        key={explanation.feature}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2/40 px-2.5 py-1.5"
                      >
                        <span className="text-[11px]">
                          <span className="font-semibold">{explanation.labelFa}</span>
                          <span className="text-muted-foreground"> · {explanation.valueFa}</span>
                        </span>
                        <span
                          className={`text-[10px] font-bold ${explanation.direction === "supports" ? "text-emerald-400" : "text-amber-400"}`}
                        >
                          {explanation.direction === "supports" ? "+" : "−"}
                          {explanation.weight.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                    <span>ورودی‌های مصرف‌شده:</span>
                    {result.inputs.used.map((label) => (
                      <span key={label} className="rounded bg-muted/60 px-1.5 py-0.5">
                        {label}
                      </span>
                    ))}
                  </div>
                  {result.inputs.missing.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1 text-[10px] text-amber-400/90">
                      <span>داده ناقص (با میانه جایگزین شد):</span>
                      {result.inputs.missing.map((label) => (
                        <span key={label} className="rounded bg-amber-500/10 px-1.5 py-0.5">
                          {label}
                        </span>
                      ))}
                    </div>
                  )}
                </Panel>

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-[11px] text-muted-foreground">
                  <span>
                    مدل {result.model.version} · منبع{" "}
                    {result.model.source === "model" ? "مدل" : "fallback"}
                    {diagnostics ? ` · ${diagnostics.latencyMs}ms` : ""}
                  </span>
                  <button
                    type="button"
                    className="font-semibold text-primary hover:underline"
                    onClick={() => setShowRaw((v) => !v)}
                  >
                    {showRaw ? "بستن JSON" : "نمایش JSON پاسخ"}
                  </button>
                </div>
                {showRaw && (
                  <pre
                    className="max-h-80 overflow-auto rounded-lg border border-border bg-black/50 p-3 text-[10px] leading-5 text-muted-foreground"
                    dir="ltr"
                  >
                    {JSON.stringify({ recommendation: result, diagnostics }, null, 2)}
                  </pre>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </MarketingShell>
  );
}
```

---

## 30) `scripts/check-model-parity.mjs`

```js
#!/usr/bin/env node
/**
 * Verifies the TypeScript interpreter reproduces sklearn's predictions exactly.
 *
 *   node --experimental-strip-types scripts/check-model-parity.mjs
 *
 * Reads parity fixtures exported during training (200 held-out athletes with
 * sklearn's own probabilities) and asserts the JS implementation matches within
 * 1e-5. Also runs a few feature-extraction invariants so a broken answer mapping
 * fails here instead of silently producing a wrong plan in production.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { classify, regress } from "../src/services/recommendation/ensemble.ts";
import { extractFeatures, toVector } from "../src/services/recommendation/features.ts";

const here = dirname(fileURLToPath(import.meta.url));
const modelDir = join(here, "..", "src", "services", "recommendation", "model");
const model = JSON.parse(readFileSync(join(modelDir, "model.json"), "utf8"));
const parity = JSON.parse(readFileSync(join(modelDir, "parity_cases.json"), "utf8"));

const failures = [];
const maxError = { program: 0, nutrition: 0, duration: 0, coaching: 0, sessions: 0, adherence: 0 };

function compare(label, actual, expected, bucket) {
  const error = Math.abs(actual - expected);
  if (error > maxError[bucket]) maxError[bucket] = error;
  if (error > 1e-5) {
    failures.push(`${label}: expected ${expected}, got ${actual} (Δ${error.toExponential(2)})`);
  }
}

for (const [caseIndex, testCase] of parity.cases.entries()) {
  const features = testCase.features;
  const programModel = model.models.program[testCase.sport];
  const program = classify(programModel, features);
  testCase.expected.program.probabilities.forEach((expected, i) => {
    compare(`case#${caseIndex} program`, program.probabilities[i] ?? 0, expected, "program");
  });

  const nutrition = classify(model.models.nutrition, features);
  testCase.expected.nutrition.probabilities.forEach((expected, i) => {
    compare(`case#${caseIndex} nutrition`, nutrition.probabilities[i] ?? 0, expected, "nutrition");
  });

  const duration = classify(model.models.duration, features);
  testCase.expected.duration.probabilities.forEach((expected, i) => {
    compare(`case#${caseIndex} duration`, duration.probabilities[i] ?? 0, expected, "duration");
  });

  const coaching = classify(model.models.coaching, features);
  testCase.expected.coaching.probabilities.forEach((expected, i) => {
    compare(`case#${caseIndex} coaching`, coaching.probabilities[i] ?? 0, expected, "coaching");
  });

  compare(
    `case#${caseIndex} sessions`,
    regress(model.models.sessions, features),
    testCase.expected.sessions,
    "sessions",
  );
  compare(
    `case#${caseIndex} adherence`,
    regress(model.models.adherence, features),
    testCase.expected.adherence,
    "adherence",
  );
}

// ---- feature extraction invariants ----------------------------------------
function build(answers, overrides = {}) {
  return extractFeatures({ sport: "crossfit", answers, ...overrides }, model.fillValues);
}

const beginner = build({
  "common.profile.training_history": "option_1",
  "common.schedule.sessions_per_week": 3,
  "common.safety.pain": "option_1",
});
const advanced = build(
  {
    "common.profile.training_history": "option_5",
    "common.schedule.sessions_per_week": 6,
    "common.safety.pain": "option_1",
    "crossfit.strength.back_squat_1rm": 150,
    "crossfit.strength.deadlift_1rm": 190,
  },
  { profile: { weightKg: 80 } },
);

if (!(beginner.named.experience_rank < advanced.named.experience_rank)) {
  failures.push("experience_rank did not increase with training history");
}
if (!(beginner.named.strength_index < advanced.named.strength_index)) {
  failures.push("strength_index did not increase with measured 1RMs");
}
if (beginner.named.pain_severity !== 0)
  failures.push("pain-free answer should map to pain_severity 0");
if (beginner.named.strength_available !== 0)
  failures.push("strength_available should be 0 without records");
if (advanced.named.strength_available !== 1)
  failures.push("strength_available should be 1 with records");
if (advanced.named.goal_health !== 1)
  failures.push("default goal should be health when no goal is provided");

const vector = toVector(advanced.named, model.features);
if (vector.length !== model.features.length) failures.push("feature vector length mismatch");
if (vector.some((v) => !Number.isFinite(v)))
  failures.push("feature vector contains non-finite values");

const painy = build({
  "common.safety.pain": "option_4",
  "common.safety.areas": ["option_4", "option_5"],
});
if (painy.named.pain_severity < 3) failures.push("clinician-limited pain must map to severity 3");
if (painy.named.pain_area_count !== 2) failures.push("pain_area_count did not count flagged areas");

const sleeping = build({ "common.recovery.sleep_hours": 5 });
if (sleeping.named.sleep_hours !== 5) failures.push("sleep_hours was not parsed");

// ---- report ---------------------------------------------------------------
const worst = Object.entries(maxError).sort((a, b) => b[1] - a[1])[0];
console.log(
  `Parity fixtures       : ${parity.cases.length} athletes (model ${parity.modelVersion})`,
);
console.log(
  `Max absolute error    : program ${maxError.program.toExponential(1)} | nutrition ${maxError.nutrition.toExponential(1)} | ` +
    `duration ${maxError.duration.toExponential(1)} | coaching ${maxError.coaching.toExponential(1)} | ` +
    `sessions ${maxError.sessions.toExponential(1)} | adherence ${maxError.adherence.toExponential(1)}`,
);
console.log(`Worst bucket          : ${worst?.[0]} (${worst?.[1].toExponential(1)})`);
console.log(`Feature invariants    : ${failures.length === 0 ? "ok" : "FAILED"}`);

if (failures.length > 0) {
  console.error(`\n${failures.length} failure(s):`);
  for (const failure of failures.slice(0, 20)) console.error(`  - ${failure}`);
  process.exitCode = 1;
} else {
  console.log("All checks passed — TS inference matches sklearn.");
}
```

---

## 31) `scripts/e2e-plan.mjs`

```js
#!/usr/bin/env node
/**
 * End-to-end check of the recommendation pipeline against a RUNNING FitLytix server
 * and its real MySQL database.
 *
 *   E2E_EMAIL=... E2E_PASSWORD=... E2E_BASE_URL=https://app.fitlytix.ir npm run e2e:plan
 *
 * What it proves (the parts that cannot be tested statically):
 *   1. login/registration + session cookie work,
 *   2. POST /api/assessment stores the answers the model actually reads,
 *   3. a plan is generated automatically right after the assessment,
 *   4. GET /api/plan returns that plan and (with migration 004) it is persisted,
 *   5. POST /api/plan honours an explicit cycle-length override,
 *   6. /api/plan-diagnose reports which migrations/signals are in place.
 *
 * Environment:
 *   E2E_BASE_URL   default http://127.0.0.1:3000
 *   E2E_EMAIL      required (an existing account, or one to create)
 *   E2E_PASSWORD   required
 *   E2E_REGISTER   "1" to register the account when login fails
 *   E2E_SPORT      crossfit | hyrox | functional | bodybuilding | running (default crossfit)
 *
 * Exit codes: 0 all good, 1 assertions failed, 2 configuration problem.
 */

const BASE = (process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const EMAIL = process.env.E2E_EMAIL?.trim() ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const REGISTER = process.env.E2E_REGISTER === "1";
const SPORT = process.env.E2E_SPORT ?? "crossfit";

if (!EMAIL || !PASSWORD) {
  console.error("E2E_EMAIL و E2E_PASSWORD را تنظیم کنید.");
  console.error("مثال: E2E_EMAIL=test@fitlytix.ir E2E_PASSWORD=… npm run e2e:plan");
  process.exit(2);
}

const SPORT_TEMPLATES = {
  crossfit: "crossfit-foundation",
  hyrox: "hyrox-foundation",
  functional: "functional-foundation",
  bodybuilding: "bodybuilding-foundation",
  running: "running-foundation",
};

const COMMON_ANSWERS = {
  "common.profile.age": 31,
  "common.profile.height_cm": 180,
  "common.profile.weight_kg": 82,
  "common.profile.training_history": "option_3",
  "common.goals.primary": "option_1",
  "common.schedule.sessions_per_week": "option_3",
  "common.schedule.minutes_per_session": "option_3",
  "common.recovery.sleep_hours": 7.5,
  "common.recovery.stress": 2,
  "common.safety.pain": "option_1",
  "common.body.condition": "option_3",
  "common.access.environment": "option_2",
};

const SPORT_ANSWERS = {
  crossfit: {
    "crossfit.history.duration": "option_3",
    "crossfit.schedule.sessions": 4,
    "crossfit.level.skill": "option_3",
    "crossfit.level.goal": "option_2",
    "crossfit.strength.back_squat_1rm": 140,
    "crossfit.strength.deadlift_1rm": 170,
    "crossfit.skill.gymnastics": ["option_2", "option_3"],
    "crossfit.engine.row_2k": "7:20",
  },
  hyrox: {
    "hyrox.race.experience": "option_2",
    "hyrox.running.5k_time": "24:30",
    "hyrox.running.10k_time": "51:00",
    "hyrox.stations.ski_1k": "4:10",
    "hyrox.stations.row_1k": "3:55",
    "hyrox.stations.wall_balls": 60,
  },
  functional: {
    "functional.environment.access": ["option_1", "option_2"],
    "functional.conditioning.preference": "option_3",
    "functional.movement.overhead": "option_3",
    "functional.strength.core": "option_3",
  },
  bodybuilding: {
    "bodybuilding.lifts.bench_press": 90,
    "bodybuilding.lifts.squat": 120,
    "bodybuilding.lifts.rdl": 130,
    "bodybuilding.cardio.frequency": "option_2",
    "bodybuilding.equipment.access": ["option_1", "option_2"],
  },
  running: {
    "running.records.5k": "24:30",
    "running.records.10k": "51:00",
    "running.records.half": "1:56:00",
    "running.training.zones": "option_3",
    "running.pace.easy": "5:45",
  },
};

let cookie = "";
const results = [];

function record(ok, label, detail = "") {
  results.push({ ok, label, detail });
  if (!ok) process.exitCode = 1;
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function call(path, init = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...init.headers,
    },
    redirect: "follow",
  });

  const setCookie =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);
  if (setCookie.length > 0) {
    const pairs = setCookie.map((entry) => String(entry).split(";")[0]).filter(Boolean);
    if (pairs.length > 0) cookie = pairs.join("; ");
  }

  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  return { status: response.status, body };
}

async function main() {
  console.log(`FitLytix recommendation e2e → ${BASE} (sport: ${SPORT})\n`);

  const health = await call("/api/health");
  record(health.status === 200, "GET /api/health", `HTTP ${health.status}`);
  if (health.status !== 200) return;

  const login = await call("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  if (login.status !== 200 && REGISTER) {
    const register = await call("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        firstName: "E2E",
        lastName: "Runner",
        phone: "09120000000",
        email: EMAIL,
        password: PASSWORD,
      }),
    });
    record(
      register.status === 200 || register.status === 201,
      "POST /api/auth/register",
      `HTTP ${register.status}`,
    );
    if (register.status !== 200 && register.status !== 201) {
      record(false, "ورود/ثبت‌نام", JSON.stringify(register.body).slice(0, 200));
      return;
    }
    const retry = await call("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    record(retry.status === 200, "POST /api/auth/login (پس از ثبت‌نام)", `HTTP ${retry.status}`);
    if (retry.status !== 200) return;
  } else {
    record(login.status === 200, "POST /api/auth/login", `HTTP ${login.status}`);
    if (login.status !== 200) {
      if (login.status >= 500) {
        console.log(
          "   ⚠ سرور خطای ۵۰۰ داد: احتمالاً DB_* در محیط ست نشده یا MySQL در دسترس نیست. " +
            "ابتدا GET /api/db-test را چک کنید و لاگ سرور را ببینید.",
        );
      }
      record(false, "راهنما", "اگر حساب ندارید E2E_REGISTER=1 را اضافه کنید.");
      return;
    }
  }

  const common = await call("/api/assessment", {
    method: "POST",
    body: JSON.stringify({
      templateId: "common-foundation",
      answers: COMMON_ANSWERS,
      bodyAnalysis: { weightKg: 82, heightCm: 180, bodyFatPct: 18 },
      wearable: { intent: "no", providers: [] },
    }),
  });
  record(
    common.status === 200 && common.body?.ok === true,
    "POST /api/assessment (عمومی)",
    `HTTP ${common.status}`,
  );

  const sport = await call("/api/assessment", {
    method: "POST",
    body: JSON.stringify({
      templateId: SPORT_TEMPLATES[SPORT] ?? SPORT_TEMPLATES.crossfit,
      sport: SPORT,
      experienceLevel: "intermediate",
      answers: SPORT_ANSWERS[SPORT] ?? SPORT_ANSWERS.crossfit,
    }),
  });
  const sportOk = sport.status === 200 && sport.body?.ok === true;
  record(sportOk, `POST /api/assessment (${SPORT})`, `HTTP ${sport.status}`);
  if (sport.body?.plan) {
    record(true, "برنامه پس از ارزیابی خودکار ساخته شد", JSON.stringify(sport.body.plan));
  } else {
    record(
      false,
      "برنامه پس از ارزیابی ساخته نشد",
      "پاسخ assessment فیلد plan نداشت — لاگ سرور را ببینید.",
    );
  }

  const plan = await call("/api/plan");
  const planBody = plan.body ?? {};
  const okPlan = plan.status === 200 && planBody.ok === true && planBody.plan;
  record(
    okPlan,
    "GET /api/plan",
    okPlan
      ? `HTTP ${plan.status}`
      : `HTTP ${plan.status} ${JSON.stringify(planBody).slice(0, 160)}`,
  );

  if (okPlan) {
    const summary = planBody.plan;
    console.log(
      `   → ${summary.archetypeId} · ${summary.sessionsPerWeek}×${summary.sessionMinutes} دقیقه · ` +
        `${summary.durationMonths} ماه · ${summary.nutritionStrategyId} · ${summary.coachingMode} · ایمنی ${summary.safetyLevel}`,
    );
    record(
      [1, 3, 6, 12].includes(summary.durationMonths),
      "طول دوره معتبر است",
      String(summary.durationMonths),
    );
    record(
      planBody.meta?.persisted === true,
      "برنامه در دیتابیس ذخیره شد (migration 004)",
      planBody.meta?.persisted ? `snapshot=${planBody.meta.snapshotId}` : "meta.persisted=false",
    );
    record(
      Array.isArray(planBody.meta?.sourcesFa) && planBody.meta.sourcesFa.length > 0,
      "ورودی‌های واقعی خوانده شدند",
      (planBody.meta?.sourcesFa ?? []).join("، "),
    );
    record(
      Array.isArray(summary.explanations) && summary.explanations.length > 0,
      "توضیح‌پذیری فعال است",
      `${summary.explanations?.length ?? 0} توضیح`,
    );
  }

  const override = await call("/api/plan", {
    method: "POST",
    body: JSON.stringify({ regenerate: true, constraints: { durationMonths: 3 } }),
  });
  const overrideOk = override.status === 200 && override.body?.plan?.durationMonths === 3;
  record(
    overrideOk,
    "POST /api/plan با override سه‌ماهه",
    `durationMonths=${override.body?.plan?.durationMonths}`,
  );

  const diagnose = await call("/api/plan-diagnose");
  if (diagnose.status === 200 && diagnose.body?.ok) {
    const db = diagnose.body.database ?? {};
    console.log("\nوضعیت دیتابیس:");
    for (const [name, applied] of Object.entries(db.migrations ?? {})) {
      console.log(`   ${applied ? "✓" : "✗"} ${name}`);
    }
    const missingTables = Object.entries(db.tables ?? {})
      .filter(([, exists]) => !exists)
      .map(([name]) => name);
    if (missingTables.length > 0) console.log(`   جداول غایب: ${missingTables.join(", ")}`);
    const athlete = diagnose.body.athlete ?? {};
    console.log(
      `\nورودی‌های خوانده‌شده: ${(athlete.sourcesFa ?? []).join("، ") || "—"}\n` +
        `ورودی‌های غایب: ${(athlete.missingFa ?? []).join("، ") || "—"}\n` +
        `پاسخ‌های قابل‌استفاده: ${athlete.answersCount} · جلسات ۲۸ روز: ${athlete.sessions28d ?? "-"} · روزهای تغذیه: ${athlete.nutritionDays28d ?? "-"}`,
    );
    for (const hint of diagnose.body.hints ?? []) console.log(`   ⚠ ${hint}`);
    record(missingTables.length === 0, "همهٔ جداول لازم موجودند", missingTables.join(", ") || "ok");
    record(
      (athlete.answersCount ?? 0) > 0,
      "پاسخ‌های ارزیابی به ویژگی‌های مدل نگاشت شدند",
      `${athlete.answersCount} کلید`,
    );
  } else {
    record(false, "GET /api/plan-diagnose", `HTTP ${diagnose.status}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} بررسی موفق`);
  if (failed.length > 0) {
    console.log("بررسی‌های ناموفق:");
    for (const item of failed)
      console.log(`  - ${item.label}${item.detail ? ` (${item.detail})` : ""}`);
    process.exitCode = 1;
  } else {
    console.log("همهٔ بررسی‌ها موفق — مسیر ارزیابی → برنامه → ذخیره‌سازی سالم است.");
  }
}

main().catch((error) => {
  console.error("e2e failed unexpectedly:", error);
  process.exitCode = 1;
});
```

---

## 32) `scripts/verify-prod.mjs`

```js
// Smoke-checks a running production server: node scripts/verify-prod.mjs [baseUrl]
// Covers pages, the auth-independent APIs and a real recommendation inference,
// so a deploy that forgot to build (or whose model artefact is broken) fails loudly.
const base = process.argv[2] ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`;
const paths = [
  "/api/health",
  "/",
  "/onboarding",
  "/assessment/common",
  "/athlete/dashboard",
  "/coach",
  "/plans",
  "/recommendation",
  "/api/recommend",
];
let failed = 0;
for (const p of paths) {
  try {
    const res = await fetch(base + p);
    console.log(`${res.status} ${p}`);
    if (!res.ok) failed++;
  } catch (e) {
    console.log(`ERR ${p} ${e.message}`);
    failed++;
  }
}

// End-to-end check of the self-hosted model: assessment -> plan recommendation.
try {
  const res = await fetch(`${base}/api/recommend`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sport: "crossfit",
      profile: { age: 30, experience: "intermediate", primaryGoal: "strength", sessionsPerWeek: 4 },
      assessmentAnswers: { "common.safety.pain": "option_1", "common.recovery.sleep_hours": 7 },
    }),
  });
  const json = await res.json().catch(() => ({}));
  const recommendation = json?.recommendation;
  if (!res.ok || !json?.ok || !recommendation?.program?.archetypeId) {
    console.log(`ERR POST /api/recommend ${res.status} ${JSON.stringify(json).slice(0, 200)}`);
    failed++;
  } else {
    console.log(
      `200 POST /api/recommend -> ${recommendation.program.archetypeId} · ` +
        `${recommendation.duration.months}mo · ${recommendation.nutrition.strategyId} · ` +
        `model ${recommendation.model.version} (${recommendation.model.source}, ${recommendation.model.trainingData})`,
    );
  }
} catch (e) {
  console.log(`ERR POST /api/recommend ${e.message}`);
  failed++;
}

console.log(failed ? `\n${failed} check(s) failed` : "\nAll smoke checks passed");
process.exit(failed ? 1 : 0);
```

---

## 33) `database/migrations/mysql/003_fitlytix_recommendation_engine.sql`

```sql
-- FitLytix MySQL migration 003: recommendation engine audit + feedback loop
-- Additive only: CREATE TABLE IF NOT EXISTS. No drops, no destructive updates.
--
-- Why these tables exist:
--   recommendation_events   every decision the self-hosted model made (context + action)
--   recommendation_outcomes the reward signal once a cycle ends (did it work?)
--   model_registry          which model version is live, with its evaluation report
--
-- Together they let you retrain on real data instead of the synthetic simulator:
--   features = input_json / athlete history, action = chosen programme + duration,
--   reward = completed_cycle, adherence, progress_score.

CREATE TABLE IF NOT EXISTS recommendation_events (
  id CHAR(36) NOT NULL PRIMARY KEY,
  athlete_id CHAR(36) NULL,
  sport VARCHAR(40) NOT NULL,
  model_version VARCHAR(60) NOT NULL,
  model_source VARCHAR(20) NOT NULL DEFAULT 'model',
  program_archetype VARCHAR(60) NOT NULL,
  nutrition_strategy VARCHAR(40) NOT NULL,
  duration_months TINYINT UNSIGNED NOT NULL,
  coaching_mode VARCHAR(20) NOT NULL,
  safety_level VARCHAR(20) NOT NULL DEFAULT 'none',
  confidence VARCHAR(10) NOT NULL DEFAULT 'medium',
  adherence_cycle DECIMAL(4,3) NULL,
  input_json JSON NOT NULL,
  output_json JSON NOT NULL,
  latency_ms INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_reco_events_athlete (athlete_id, created_at),
  KEY idx_reco_events_sport (sport, created_at),
  KEY idx_reco_events_model (model_version),
  KEY idx_reco_events_archetype (program_archetype, duration_months)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS recommendation_outcomes (
  id CHAR(36) NOT NULL PRIMARY KEY,
  event_id CHAR(36) NOT NULL,
  athlete_id CHAR(36) NOT NULL,
  completed_cycle BOOLEAN NOT NULL DEFAULT FALSE,
  adherence DECIMAL(4,3) NULL,
  sessions_completed SMALLINT UNSIGNED NULL,
  progress_score DECIMAL(5,2) NULL,
  note VARCHAR(500) NULL,
  recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_reco_outcomes_event (event_id),
  KEY idx_reco_outcomes_athlete (athlete_id, recorded_at),
  CONSTRAINT fk_reco_outcomes_event FOREIGN KEY (event_id) REFERENCES recommendation_events(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS model_registry (
  id CHAR(36) NOT NULL PRIMARY KEY,
  model_version VARCHAR(60) NOT NULL,
  kind VARCHAR(40) NOT NULL DEFAULT 'plan_recommender',
  schema_version SMALLINT UNSIGNED NOT NULL,
  artifact_sha256 CHAR(64) NOT NULL,
  trained_at DATETIME NOT NULL,
  metrics_json JSON NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_model_registry_version (model_version),
  KEY idx_model_registry_active (kind, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 34) `database/migrations/mysql/004_recommendation_snapshots.sql`

```sql
-- 004 — Snapshot of every plan the recommendation engine produced for an athlete.
--
-- Why a dedicated table (instead of only recommendation_events from 003):
--   * the athlete UI must be able to re-open *the exact plan it showed* days later,
--     even after the model artefact changed;
--   * support/coach needs the inputs that produced a plan, not just its outputs;
--   * retraining needs a time-ordered history of (inputs → action → later outcome).
--
-- Additive and non-destructive: safe to run on an existing database.

CREATE TABLE IF NOT EXISTS recommendation_snapshots (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  sport VARCHAR(30) NOT NULL,
  source VARCHAR(24) NOT NULL DEFAULT 'assessment',
  model_version VARCHAR(64) NOT NULL,
  model_schema_version INT NOT NULL DEFAULT 1,
  model_training_data VARCHAR(32) NOT NULL DEFAULT 'simulated',
  archetype_id VARCHAR(64) NOT NULL,
  nutrition_strategy_id VARCHAR(64) NOT NULL,
  duration_months TINYINT UNSIGNED NOT NULL,
  coaching_mode VARCHAR(20) NOT NULL,
  package_id VARCHAR(20) NOT NULL,
  safety_level VARCHAR(20) NOT NULL DEFAULT 'none',
  confidence VARCHAR(10) NOT NULL DEFAULT 'low',
  adherence_30d DECIMAL(4,3) NOT NULL DEFAULT 0,
  adherence_cycle DECIMAL(4,3) NOT NULL DEFAULT 0,
  data_completeness DECIMAL(4,3) NOT NULL DEFAULT 0,
  input_hash CHAR(64) NOT NULL,
  request_json JSON NOT NULL,
  result_json LONGTEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_snapshot_input (user_id, input_hash, model_version),
  KEY idx_snapshot_user_created (user_id, created_at),
  KEY idx_snapshot_user_sport (user_id, sport, created_at),
  CONSTRAINT fk_snapshot_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Latest plan per athlete without scanning history.
CREATE OR REPLACE VIEW v_latest_recommendation AS
SELECT s.*
FROM recommendation_snapshots s
JOIN (
  SELECT user_id, MAX(created_at) AS created_at
  FROM recommendation_snapshots
  GROUP BY user_id
) latest ON latest.user_id = s.user_id AND latest.created_at = s.created_at;
```

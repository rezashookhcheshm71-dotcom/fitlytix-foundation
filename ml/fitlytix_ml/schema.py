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

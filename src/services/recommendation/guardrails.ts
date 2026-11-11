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

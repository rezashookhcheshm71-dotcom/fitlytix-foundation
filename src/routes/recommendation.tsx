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

import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Dna, LogIn, UserPlus } from "lucide-react";
import { z } from "zod";
import { MarketingShell } from "@/components/layout/MarketingShell";
import { Button } from "@/components/ui/button";
import { ASSESSMENT_STEPS, AssessmentSectionCard, StepIndicator } from "@/components/domain/assessment";
import { Panel, Pill, ProgressRing } from "@/components/domain/primitives";
import { SportCard } from "@/components/domain/sport";
import { assessmentEngine } from "@/services/assessment/engine";
import { EXPERIENCE_LABEL, SPORTS, SPORT_LIST } from "@/domain/sports";
import type { AssessmentAnswers, ExperienceLevel, SportId } from "@/domain/types";

const searchSchema = z.object({
  sport: z.enum(["crossfit", "hyrox", "functional", "bodybuilding", "running"]).optional(),
});

export const Route = createFileRoute("/assessment/sport")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "ارزیابی اختصاصی رشته — FitLytix" },
      { name: "description", content: "ارزیابی کوتاه و رشته‌محور برای شناخت سطح، هدف، محدودیت و داده‌های تمرینی." },
      { property: "og:title", content: "ارزیابی اختصاصی رشته — FitLytix" },
      { property: "og:description", content: "بخش‌های اختصاصی هر رشته ورزشی." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SportAssessment,
});

const levels: ExperienceLevel[] = ["beginner", "intermediate", "advanced", "elite"];

function SportAssessment() {
  const { sport: sportParam } = Route.useSearch();
  const navigate = useNavigate();
  const [sport, setSport] = useState<SportId | undefined>(sportParam);
  const [level, setLevel] = useState<ExperienceLevel>("beginner");
  const [answers, setAnswers] = useState<AssessmentAnswers>({});
  const [savedBySport, setSavedBySport] = useState<
    Record<string, { experienceLevel: ExperienceLevel; answers: AssessmentAnswers }>
  >({});
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [requiresAuthPrompt, setRequiresAuthPrompt] = useState(false);

  const template = sport ? assessmentEngine.getSportTemplate(sport) : null;
  const sections = useMemo(
    () => (template ? assessmentEngine.visibleFields(template, level) : []),
    [template, level],
  );
  const completion = template ? assessmentEngine.completion({ ...template, sections }, answers) : 0;

  useEffect(() => {
    let active = true;
    const draft = assessmentEngine.loadSportDraft();
    if (draft?.sport && !sportParam) {
      setSport(draft.sport);
    }
    if (draft?.level) {
      setLevel(draft.level);
    }
    if (draft?.answers && Object.keys(draft.answers).length > 0) {
      setAnswers(draft.answers);
    }

    assessmentEngine.loadCurrentState().then((state) => {
      if (!active) return;
      setAuthenticated(state.authenticated);
      if (state.authenticated && state.sportAssessments) {
        const map: Record<string, { experienceLevel: ExperienceLevel; answers: AssessmentAnswers }> = {};
        for (const [k, v] of Object.entries(state.sportAssessments)) {
          map[k] = { experienceLevel: v.experienceLevel, answers: v.answers };
        }
        setSavedBySport(map);

        const activeSport = sportParam ?? draft?.sport ?? state.primarySport;
        if (activeSport && !sportParam && !draft?.sport) {
          setSport(activeSport);
        }
        if (activeSport && map[activeSport] && (!draft?.answers || Object.keys(draft.answers).length === 0)) {
          setLevel(map[activeSport].experienceLevel);
          setAnswers(map[activeSport].answers);
        }
      }
    });

    return () => {
      active = false;
    };
  }, [sportParam]);

  async function handleSubmit() {
    if (!template || !sport) return;
    setSubmitError(null);
    setRequiresAuthPrompt(false);

    assessmentEngine.saveSportDraft({ sport, level, answers });

    setSubmitting(true);
    const result = await assessmentEngine.submitSport({
      sport,
      experienceLevel: level,
      templateId: template.id,
      answers,
    });
    setSubmitting(false);

    if (result.status === "unauthenticated") {
      setRequiresAuthPrompt(true);
      setSubmitError(result.error ?? "برای ذخیره دائمی ارزیابی تخصصی لازم است وارد حساب کاربری خود شوید.");
      return;
    }

    if (!result.ok) {
      setSubmitError(result.error ?? "خطا در ذخیره ارزیابی تخصصی.");
      return;
    }

    navigate({ to: "/plans", search: { coaching: "hybrid" } });
  }

  return (
    <MarketingShell minimal>
      <div className="mx-auto w-full max-w-6xl px-4 py-10 md:px-8">
        <StepIndicator steps={ASSESSMENT_STEPS} current={1} />

        <div className="mb-6 mt-8">
          <div className="mb-1 text-xs font-semibold text-primary">ارزیابی تخصصی</div>
          <h1 className="text-2xl font-extrabold md:text-3xl">بیشتر چه تمرینی انجام می‌دی؟</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            هر رشته سؤال‌های خودش را دارد؛ فقط چیزهایی را می‌پرسیم که روی برنامه‌ات اثر می‌گذارند.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {SPORT_LIST.map((s) => (
            <SportCard
              key={s.id}
              sport={s}
              selected={sport === s.id}
              onSelect={(id) => {
                setSport(id);
                const prev = savedBySport[id];
                if (prev) {
                  setLevel(prev.experienceLevel);
                  setAnswers(prev.answers);
                } else {
                  setAnswers({});
                }
                navigate({ to: "/assessment/sport", search: { sport: id }, replace: true });
              }}
            />
          ))}
        </div>

        {template && sport && (
          <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_260px]">
            <div className="space-y-4">
              <Panel className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold" style={{ color: `var(${SPORTS[sport].colorToken})` }}>
                    ارزیابی {SPORTS[sport].nameFa}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    سطحت را انتخاب کن؛ اگر سابقه بیشتری داشته باشی، جزئیات دقیق‌تری می‌پرسیم.
                  </div>
                </div>
                <div className="flex gap-1.5 rounded-xl bg-muted/50 p-1">
                  {levels.map((l) => (
                    <Button
                      key={l}
                      type="button"
                      variant={level === l ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setLevel(l)}
                      className="h-8 px-3 text-xs"
                    >
                      {EXPERIENCE_LABEL[l]}
                    </Button>
                  ))}
                </div>
              </Panel>
              {sections.map((s, i) => (
                <AssessmentSectionCard
                  key={s.id}
                  section={s}
                  answers={answers}
                  index={i}
                  onChange={(id, v) => {
                    setAnswers((a) => {
                      const next = { ...a, [id]: v };
                      assessmentEngine.saveSportDraft({ sport, level, answers: next });
                      return next;
                    });
                  }}
                />
              ))}
            </div>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <Panel glass className="flex flex-col items-center gap-4 text-center">
                <ProgressRing
                  value={completion * 100}
                  size={120}
                  stroke={10}
                  color={`var(${SPORTS[sport].colorToken})`}
                >
                  <span className="num text-2xl font-bold">{Math.round(completion * 100)}٪</span>
                  <span className="text-[10px] text-muted-foreground">{sections.length} بخش</span>
                </ProgressRing>
                <p className="text-xs text-muted-foreground">
                  از این جواب‌ها برای انتخاب سطح، حجم و تمرکز برنامه استفاده می‌شود.
                </p>

                {submitError && (
                  <div className="w-full rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs leading-6 text-destructive">
                    {submitError}
                  </div>
                )}

                {requiresAuthPrompt && (
                  <div className="w-full space-y-2 rounded-xl border border-primary/30 bg-primary-soft p-3 text-xs">
                    <p className="text-foreground">
                      پاسخ‌های شما موقتاً نگه داشته شد. برای ثبت دائمی وارد شوید یا حساب بسازید:
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button asChild size="sm" variant="default" className="w-full">
                        <Link to="/login" search={{ redirect: `/assessment/sport?sport=${sport}` }}>
                          <LogIn className="size-3.5" /> ورود
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline" className="w-full">
                        <Link to="/register" search={{ redirect: `/assessment/sport?sport=${sport}` }}>
                          <UserPlus className="size-3.5" /> ثبت‌نام
                        </Link>
                      </Button>
                    </div>
                  </div>
                )}

                <Button
                  variant="hero"
                  className="w-full"
                  disabled={submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? "در حال ذخیره..." : "انتخاب نوع مربی‌گری"} <Dna />
                </Button>
                <Link
                  to="/assessment/common"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="size-3 rotate-180" /> بازگشت به ارزیابی عمومی
                </Link>

                {authenticated === true ? (
                  <Pill color="var(--success)">
                    <CheckCircle2 className="me-1 inline size-3" /> ذخیره در دیتابیس فعال است
                  </Pill>
                ) : authenticated === false ? (
                  <Link
                    to="/login"
                    search={{ redirect: `/assessment/sport?sport=${sport}` }}
                    className="text-[11px] text-primary hover:underline"
                  >
                    برای ذخیره دائمی وارد حساب شوید
                  </Link>
                ) : null}
              </Panel>
            </aside>
          </div>
        )}
      </div>
    </MarketingShell>
  );
}

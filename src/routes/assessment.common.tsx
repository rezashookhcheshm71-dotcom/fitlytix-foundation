import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, LogIn, UserPlus } from "lucide-react";
import { MarketingShell } from "@/components/layout/MarketingShell";
import { Button } from "@/components/ui/button";
import { ASSESSMENT_STEPS, AssessmentSectionCard, StepIndicator } from "@/components/domain/assessment";
import { Panel, Pill, ProgressRing } from "@/components/domain/primitives";
import { assessmentEngine } from "@/services/assessment/engine";
import type { AssessmentAnswers } from "@/domain/types";
import {
  BodyAnalysisIntake,
  emptyBodyIntake,
  toBodyInput,
  type BodyIntakeState,
} from "@/components/domain/body-analysis";
import { zodErrors } from "@/components/domain/body-analysis-dialog";
import { bodyAnalysisService } from "@/services/body-analysis/service";
import { WearableIntake, type WearableIntakeState } from "@/components/domain/health-data";
import { healthDataService } from "@/services/health-data/service";

export const Route = createFileRoute("/assessment/common")({
  head: () => ({
    meta: [
      { title: "ارزیابی عمومی — FitLytix" },
      { name: "description", content: "پروفایل پایه، هدف‌ها و سلامت؛ ورودی مشترک Fitness DNA." },
      { property: "og:title", content: "ارزیابی عمومی — FitLytix" },
      { property: "og:description", content: "پروفایل پایه، هدف‌ها و سلامت؛ ورودی مشترک Fitness DNA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CommonAssessment,
});

function CommonAssessment() {
  const navigate = useNavigate();
  const template = assessmentEngine.getCommonTemplate();
  const [answers, setAnswers] = useState<AssessmentAnswers>({});
  const [body, setBody] = useState<BodyIntakeState>(emptyBodyIntake);
  const [wearable, setWearable] = useState<WearableIntakeState>({ providers: [] });
  const [bodyErrors, setBodyErrors] = useState<Record<string, string>>({});
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [requiresAuthPrompt, setRequiresAuthPrompt] = useState(false);

  const completion = useMemo(
    () => assessmentEngine.completion(template, answers),
    [template, answers],
  );

  // Load saved common assessment, wearable preference (Step 3), or local session draft on mount
  useEffect(() => {
    let active = true;
    const draft = assessmentEngine.loadCommonDraft();
    if (draft?.answers && Object.keys(draft.answers).length > 0) {
      setAnswers(draft.answers);
    }
    if (draft?.wearable) {
      setWearable(draft.wearable);
    }

    assessmentEngine.loadCurrentState().then((state) => {
      if (!active) return;
      setAuthenticated(state.authenticated);
      if (state.athleteId) {
        setAthleteId(state.athleteId);
      }
      if (state.authenticated) {
        if (
          state.commonAssessment?.answers &&
          Object.keys(state.commonAssessment.answers).length > 0 &&
          (!draft?.answers || Object.keys(draft.answers).length === 0)
        ) {
          setAnswers(state.commonAssessment.answers);
        }
        if (state.wearable && (!draft?.wearable || !draft.wearable.intent)) {
          setWearable({
            intent: state.wearable.intent,
            providers: state.wearable.providers ?? [],
          });
        }
      }
    });

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit() {
    setSubmitError(null);
    setRequiresAuthPrompt(false);

    let validatedBodyData = undefined;
    if (body.mode === "has") {
      const parsed = bodyAnalysisService.validate(toBodyInput(body));
      if (!parsed.success) {
        setBodyErrors(zodErrors(parsed.error.issues));
        return;
      }
      setBodyErrors({});
      validatedBodyData = parsed.data;
    }

    // Preserve draft in sessionStorage so nothing is lost if user needs to sign in first
    assessmentEngine.saveCommonDraft({ answers, wearable });

    setSubmitting(true);
    const result = await assessmentEngine.submitCommon({
      templateId: template.id,
      answers,
      bodyAnalysis: validatedBodyData,
      wearable: wearable.intent ? wearable : undefined,
    });
    setSubmitting(false);

    if (result.status === "unauthenticated") {
      setRequiresAuthPrompt(true);
      setSubmitError(result.error ?? "برای ذخیره دائمی ارزیابی لازم است وارد حساب کاربری خود شوید.");
      return;
    }

    if (!result.ok) {
      setSubmitError(result.error ?? "خطا در ذخیره ارزیابی عمومی.");
      return;
    }

    // Sync in-session client services using the server-verified athleteId
    const resolvedId = result.athleteId ?? athleteId;
    if (resolvedId) {
      if (validatedBodyData) {
        bodyAnalysisService.add(resolvedId, validatedBodyData);
      }
      if (wearable.intent) {
        healthDataService.setIntent(resolvedId, wearable.intent, wearable.providers);
      }
    }

    navigate({ to: "/assessment/sport", search: {} });
  }

  return (
    <MarketingShell minimal>
      <div className="mx-auto w-full max-w-5xl px-4 py-10 md:px-8">
        <StepIndicator steps={ASSESSMENT_STEPS} current={0} />

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_260px]">
          <div className="space-y-4">
            <div className="mb-2">
              <div className="mb-1 text-xs font-semibold text-primary">شناخت اولیه</div>
              <h1 className="text-2xl font-extrabold md:text-3xl">اول از خودت بگو</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                چند سؤال کوتاه تا برنامه با وقت، هدف و شرایط واقعی تو هماهنگ باشد.
              </p>
            </div>

            {/* Step 1: Common Assessment Questionnaire Sections (including Section 3: common.life) */}
            {template.sections.map((s, i) => (
              <AssessmentSectionCard
                key={s.id}
                section={s}
                answers={answers}
                index={i}
                onChange={(id, v) => {
                  setAnswers((a) => {
                    const next = { ...a, [id]: v };
                    assessmentEngine.saveCommonDraft({ answers: next, wearable });
                    return next;
                  });
                }}
              />
            ))}

            {/* Step 2: Optional Body Composition / InBody Intake */}
            <BodyAnalysisIntake state={body} onChange={setBody} errors={bodyErrors} />

            {/* Step 3: Recoverable Smartwatch & Wearable Health Sensor Intake */}
            <WearableIntake
              state={wearable}
              onChange={(nextWearable) => {
                setWearable(nextWearable);
                assessmentEngine.saveCommonDraft({ answers, wearable: nextWearable });
              }}
            />
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Panel glass className="flex flex-col items-center gap-4 text-center">
              <ProgressRing value={completion * 100} size={120} stroke={10}>
                <span className="num text-2xl font-bold">{Math.round(completion * 100)}٪</span>
                <span className="text-[10px] text-muted-foreground">تکمیل</span>
              </ProgressRing>
              <p className="text-xs text-muted-foreground">
                لازم نیست عددی را حدس بزنی؛ هرجا مطمئن نیستی می‌توانی رد شوی.
              </p>

              {submitError && (
                <div className="w-full rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs leading-6 text-destructive">
                  {submitError}
                </div>
              )}

              {requiresAuthPrompt && (
                <div className="w-full space-y-2 rounded-xl border border-primary/30 bg-primary-soft p-3 text-xs">
                  <p className="text-foreground">
                    پاسخ‌های شما موقتاً نگه داشته شد. برای ثبت دائمی در پروفایل خود وارد شوید یا حساب بسازید:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button asChild size="sm" variant="default" className="w-full">
                      <Link to="/login" search={{ redirect: "/assessment/common" }}>
                        <LogIn className="size-3.5" /> ورود
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="w-full">
                      <Link to="/register" search={{ redirect: "/assessment/common" }}>
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
                {submitting ? "در حال ذخیره..." : "ادامه: انتخاب رشته"} <ArrowLeft />
              </Button>

              <Link to="/onboarding" className="text-xs text-muted-foreground hover:text-foreground">
                بازگشت
              </Link>

              {authenticated === true ? (
                <Pill color="var(--success)">
                  <CheckCircle2 className="me-1 inline size-3" /> ذخیره در دیتابیس فعال است
                </Pill>
              ) : authenticated === false ? (
                <Link
                  to="/login"
                  search={{ redirect: "/assessment/common" }}
                  className="text-[11px] text-primary hover:underline"
                >
                  برای ذخیره دائمی وارد حساب شوید
                </Link>
              ) : null}
            </Panel>
          </aside>
        </div>
      </div>
    </MarketingShell>
  );
}

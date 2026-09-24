import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Dna } from "lucide-react";
import { z } from "zod";
import { MarketingShell } from "@/components/layout/MarketingShell";
import { Button } from "@/components/ui/button";
import { ASSESSMENT_STEPS, AssessmentSectionCard, StepIndicator } from "@/components/domain/assessment";
import { MockBadge, Panel, ProgressRing } from "@/components/domain/primitives";
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
      { name: "description", content: "بخش‌های اختصاصی کراس‌فیت: Warm-up، Bodybuilding، Engine، WOD، Skill، Weightlifting، Cooldown." },
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

  const template = sport ? assessmentEngine.getSportTemplate(sport) : null;
  const sections = useMemo(() => (template ? assessmentEngine.visibleFields(template, level) : []), [template, level]);
  const completion = template ? assessmentEngine.completion({ ...template, sections }, answers) : 0;

  return (
    <MarketingShell minimal>
      <div className="mx-auto w-full max-w-6xl px-4 py-10 md:px-8">
        <StepIndicator steps={ASSESSMENT_STEPS} current={1} />

        <div className="mb-6 mt-8">
          <div className="mb-1 text-xs font-semibold text-primary">ارزیابی تخصصی</div>
          <h1 className="text-2xl font-extrabold md:text-3xl">بیشتر چه تمرینی انجام می‌دی؟</h1>
          <p className="mt-1 text-sm text-muted-foreground">هر رشته سؤال‌های خودش را دارد؛ فقط چیزهایی را می‌پرسیم که روی برنامه‌ات اثر می‌گذارند.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {SPORT_LIST.map((s) => (
            <SportCard key={s.id} sport={s} selected={sport === s.id} onSelect={(id) => { setSport(id); setAnswers({}); navigate({ to: "/assessment/sport", search: { sport: id }, replace: true }); }} />
          ))}
        </div>

        {template && sport && (
          <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_260px]">
            <div className="space-y-4">
              <Panel className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-display text-sm font-bold" style={{ color: `var(${SPORTS[sport].colorToken})` }}>{SPORTS[sport].name} Assessment</div>
                  <div className="text-xs text-muted-foreground">سطحت را انتخاب کن؛ اگر سابقه بیشتری داشته باشی، جزئیات دقیق‌تری می‌پرسیم.</div>
                </div>
                <div className="flex gap-1.5 rounded-xl bg-muted/50 p-1">
                  {levels.map((l) => (
                    <Button key={l} type="button" variant={level === l ? "default" : "ghost"} size="sm" onClick={() => setLevel(l)} className="h-8 px-3 text-xs">
                      {EXPERIENCE_LABEL[l]}
                    </Button>
                  ))}
                </div>
              </Panel>
              {sections.map((s, i) => (
                <AssessmentSectionCard key={s.id} section={s} answers={answers} index={i} onChange={(id, v) => setAnswers((a) => ({ ...a, [id]: v }))} />
              ))}
            </div>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <Panel glass className="flex flex-col items-center gap-4 text-center">
                <ProgressRing value={completion * 100} size={120} stroke={10} color={`var(${SPORTS[sport].colorToken})`}>
                  <span className="num text-2xl font-bold">{Math.round(completion * 100)}٪</span>
                  <span className="text-[10px] text-muted-foreground">{sections.length} بخش</span>
                </ProgressRing>
                <p className="text-xs text-muted-foreground">از این جواب‌ها برای انتخاب سطح، حجم و تمرکز برنامه استفاده می‌شود.</p>
                <Button
                  variant="hero"
                  className="w-full"
                  onClick={async () => {
                    await assessmentEngine.submit("ath_001", template.id, answers);
                    navigate({ to: "/plans", search: { coaching: "hybrid" } });
                  }}
                >
                  انتخاب نوع مربی‌گری <Dna />
                </Button>
                <Link to="/assessment/common" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="size-3 rotate-180" /> بازگشت به ارزیابی عمومی
                </Link>
                <MockBadge label="ذخیره‌سازی هنوز متصل نیست" />
              </Panel>
            </aside>
          </div>
        )}
      </div>
    </MarketingShell>
  );
}

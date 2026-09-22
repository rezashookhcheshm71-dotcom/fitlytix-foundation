import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { MarketingShell } from "@/components/layout/MarketingShell";
import { Button } from "@/components/ui/button";
import { AssessmentSectionCard, StepIndicator } from "@/components/domain/assessment";
import { MockBadge, Panel, ProgressRing } from "@/components/domain/primitives";
import { assessmentEngine } from "@/services/assessment/engine";
import type { AssessmentAnswers } from "@/domain/types";

export const Route = createFileRoute("/assessment/common")({
  head: () => ({
    meta: [
      { title: "ارزیابی عمومی — FitLytix" },
      { name: "description", content: "پروفایل پایه، هدف‌ها و سلامت؛ ورودی مشترک Fitness DNA." },
      { property: "og:title", content: "ارزیابی عمومی — FitLytix" },
      { property: "og:description", content: "پروفایل پایه، هدف‌ها و سلامت؛ ورودی مشترک Fitness DNA." },
    ],
  }),
  component: CommonAssessment,
});

export const ASSESSMENT_STEPS = [{ label: "عمومی" }, { label: "رشته" }, { label: "Fitness DNA" }, { label: "پلن" }];

function CommonAssessment() {
  const navigate = useNavigate();
  const template = assessmentEngine.getCommonTemplate();
  const [answers, setAnswers] = useState<AssessmentAnswers>({});
  const completion = useMemo(() => assessmentEngine.completion(template, answers), [template, answers]);

  return (
    <MarketingShell minimal>
      <div className="mx-auto w-full max-w-5xl px-4 py-10 md:px-8">
        <StepIndicator steps={ASSESSMENT_STEPS} current={0} />

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_260px]">
          <div className="space-y-4">
            <div className="mb-2">
              <div className="mb-1 text-xs font-semibold text-primary">COMMON ASSESSMENT</div>
              <h1 className="text-2xl font-extrabold md:text-3xl">ارزیابی عمومی</h1>
              <p className="mt-1 text-sm text-muted-foreground">این بخش برای همه رشته‌ها مشترک است و پایه پروفایل شما را می‌سازد.</p>
            </div>
            {template.sections.map((s, i) => (
              <AssessmentSectionCard key={s.id} section={s} answers={answers} index={i} onChange={(id, v) => setAnswers((a) => ({ ...a, [id]: v }))} />
            ))}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Panel glass className="flex flex-col items-center gap-4 text-center">
              <ProgressRing value={completion * 100} size={120} stroke={10}>
                <span className="num text-2xl font-bold">{Math.round(completion * 100)}٪</span>
                <span className="text-[10px] text-muted-foreground">تکمیل</span>
              </ProgressRing>
              <p className="text-xs text-muted-foreground">می‌توانید ناقص ادامه دهید؛ موتور ارزیابی سوالات مهم‌تر را بعداً یادآوری می‌کند.</p>
              <Button
                variant="hero"
                className="w-full"
                onClick={async () => {
                  await assessmentEngine.submit("ath_001", template.id, answers);
                  navigate({ to: "/assessment/sport", search: { sport: "crossfit" } });
                }}
              >
                ادامه: انتخاب رشته <ArrowLeft />
              </Button>
              <Link to="/onboarding" className="text-xs text-muted-foreground hover:text-foreground">بازگشت</Link>
              <MockBadge label="ذخیره‌سازی هنوز متصل نیست" />
            </Panel>
          </aside>
        </div>
      </div>
    </MarketingShell>
  );
}

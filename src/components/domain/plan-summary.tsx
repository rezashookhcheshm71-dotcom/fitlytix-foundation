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

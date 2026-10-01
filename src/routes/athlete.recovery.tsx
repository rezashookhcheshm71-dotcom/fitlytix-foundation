import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { MockBadge, PageHeader, Panel, SectionHeading } from "@/components/domain/primitives";
import { ReadinessCard, WhyNote } from "@/components/domain/coaching";
import { RecoveryBars } from "@/components/domain/charts";
import { METRIC_DEFS } from "@/domain/types";
import { demoAthlete, demoRecoveryHistory } from "@/mock/athlete";
import { healthDataService } from "@/services/health-data/service";
import { recoveryService } from "@/services/recovery/service";

export const Route = createFileRoute("/athlete/recovery")({
  validateSearch: (s) => z.object({ sport: z.enum(["crossfit", "hyrox", "functional", "bodybuilding", "running"]).optional() }).parse(s),
  head: () => ({ meta: [
    { title: "ریکاوری و آمادگی — FitLytix" },
    { name: "description", content: "آمادگی امروز، عوامل مؤثر و روند خواب و HRV." },
    { property: "og:title", content: "ریکاوری و آمادگی — FitLytix" },
    { property: "og:description", content: "آمادگی امروز، عوامل مؤثر و روند خواب و HRV." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: RecoveryPage,
});

function RecoveryPage() {
  const sport = Route.useSearch().sport ?? demoAthlete.primarySport;
  const r = recoveryService.assess(demoAthlete.id, sport);
  const series = (["sleep_duration", "hrv", "resting_hr"] as const).map((t) => ({ t, rows: healthDataService.listMetrics(demoAthlete.id, t) }));
  const tip = r.level === "ready" ? "برای جلسه برنامه‌ریزی‌شده آماده‌ای؛ گرم کردن کامل را فراموش نکن." : r.level === "moderate" ? "جلسه را انجام بده ولی ست‌های سنگین آخر را سبک‌تر کن." : "امروز تحرک سبک و پیاده‌روی؛ خواب امشب را در اولویت بگذار.";
  return (
    <AppShell mode="athlete" userName={`${demoAthlete.identity.firstName} ${demoAthlete.identity.lastName}`} userRole="ریکاوری">
      <PageHeader eyebrow="ریکاوری" title="بدنت امروز چقدر آماده است؟" description="نتیجه از خواب، HRV، بار تمرین و وضعیت ثبت‌شده می‌آید؛ تشخیص پزشکی نیست." actions={<MockBadge label="محاسبه نمایشی" />} />
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <ReadinessCard r={r} />
        <Panel><SectionHeading title="پیشنهاد امروز" /><p className="text-sm leading-7">{tip}</p><WhyNote why={r.why} /><div className="mt-4"><RecoveryBars data={demoRecoveryHistory} height={130} /></div></Panel>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {series.map(({ t, rows }) => (
          <Panel key={t}>
            <SectionHeading title={METRIC_DEFS[t].label} subtitle={METRIC_DEFS[t].unit} />
            {rows.length ? <div className="flex h-24 items-end gap-1" aria-label={`روند ${METRIC_DEFS[t].label}`}>{rows.slice(-7).map((m) => { const max = Math.max(...rows.map((x) => x.value)); return <div key={m.id} className="flex flex-1 flex-col items-center gap-1"><div className="w-full rounded-t bg-primary/60" style={{ height: `${(m.value / max) * 80}px` }} /><span className="num text-[9px] text-muted-foreground">{m.value}</span></div>; })}</div> : <p className="text-xs text-muted-foreground">هنوز ثبت نشده.</p>}
          </Panel>
        ))}
      </div>
    </AppShell>
  );
}

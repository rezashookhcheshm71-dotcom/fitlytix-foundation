import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { MockBadge, PageHeader, Panel, SectionHeading } from "@/components/domain/primitives";
import { HealthDataPanel } from "@/components/domain/health-data";
import { METRIC_DEFS, PROVIDER_LABEL } from "@/domain/types";
import { demoAthlete } from "@/mock/athlete";
import { healthDataService } from "@/services/health-data/service";

export const Route = createFileRoute("/athlete/health")({
  head: () => ({ meta: [
    { title: "دستگاه‌ها و داده سلامت — FitLytix" },
    { name: "description", content: "وضعیت ساعت و اپ سلامت، و ثبت دستی خواب، HRV و ضربان استراحت." },
    { property: "og:title", content: "دستگاه‌ها و داده سلامت — FitLytix" },
    { property: "og:description", content: "وضعیت ساعت و اپ سلامت، و ثبت دستی خواب، HRV و ضربان استراحت." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: HealthPage,
});

function HealthPage() {
  const [v, setV] = useState(0);
  const rows = healthDataService.listMetrics(demoAthlete.id).slice().reverse().slice(0, 20);
  void v;
  return (
    <AppShell mode="athlete" userName={`${demoAthlete.identity.firstName} ${demoAthlete.identity.lastName}`} userRole="داده سلامت">
      <PageHeader eyebrow="سلامت" title="ساعت و داده‌های سلامت" description="اتصال مستقیم به Garmin، Apple Health و بقیه به‌زودی؛ فعلاً داده را دستی وارد کن." actions={<MockBadge label="بدون اتصال واقعی" />} />
      <HealthDataPanel athleteId={demoAthlete.id} version={v} onChanged={() => setV((x) => x + 1)} />
      <Panel>
        <SectionHeading title="آخرین ثبت‌ها" subtitle="هر ثبت یک رکورد جدا با منبع و زمان" />
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-[11px] text-muted-foreground"><th className="py-2 text-start">داده</th><th className="text-start">مقدار</th><th className="text-start">منبع</th><th className="text-start">زمان</th></tr></thead>
          <tbody>{rows.map((m) => <tr key={m.id} className="border-t border-border/60"><td className="py-2">{METRIC_DEFS[m.metricType].label}</td><td className="num">{m.value} {m.unit}</td><td className="text-xs text-muted-foreground">{PROVIDER_LABEL[m.source]}</td><td className="num text-xs text-muted-foreground">{m.startTime.slice(0, 16).replace("T", " ")}</td></tr>)}</tbody></table></div>
      </Panel>
    </AppShell>
  );
}

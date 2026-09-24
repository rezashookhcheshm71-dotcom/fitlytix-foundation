import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Dna } from "lucide-react";
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Bar, MockBadge, PageHeader, Panel, Pill, SectionHeading } from "@/components/domain/primitives";
import { DnaRadarChart } from "@/components/domain/charts";
import { demoAthlete } from "@/mock/athlete";
import { SPORTS } from "@/domain/sports";
import { athleteDashboardService } from "@/services/athlete/dashboard";

const searchSchema = z.object({ sport: z.enum(["crossfit", "hyrox", "functional", "bodybuilding", "running"]).optional() });

export const Route = createFileRoute("/athlete/fitness-dna")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({ meta: [
    { title: "پروفایل عملکرد — FitLytix" },
    { name: "description", content: "نمای چندبعدی توانایی‌ها و نیازهای ورزشکار، متناسب با رشته ورزشی." },
    { property: "og:title", content: "پروفایل عملکرد — FitLytix" },
    { property: "og:description", content: "نمای چندبعدی توانایی‌ها و نیازهای ورزشکار، متناسب با رشته ورزشی." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: FitnessDnaPage,
});

function FitnessDnaPage() {
  const { sport: selectedSport } = Route.useSearch();
  const sport = selectedSport ?? demoAthlete.primarySport;
  const data = athleteDashboardService.getSnapshot(demoAthlete.id, sport);
  const sportMeta = SPORTS[sport];
  const name = `${demoAthlete.identity.firstName} ${demoAthlete.identity.lastName}`;

  return (
    <AppShell mode="athlete" userName={name} userRole={`${sportMeta.name} · ${data.level}`}>
      <PageHeader
        eyebrow={<span className="inline-flex items-center gap-1.5"><Dna className="size-3.5" /> پروفایل عملکرد · {sportMeta.name}</span>}
        title={data.dna.archetype}
        description="این تصویر از پاسخ‌های ارزیابی و روند تمرین ساخته می‌شود؛ با ثبت داده‌های واقعی دقیق‌تر خواهد شد."
        actions={<Button asChild variant="hero"><Link to="/plans">دیدن برنامه پیشنهادی <ArrowLeft /></Link></Button>}
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <Panel>
          <DnaRadarChart dimensions={data.dna.dimensions} height={380} />
          <div className="flex items-center justify-between"><MockBadge label="داده نمایشی" /><span className="text-xs text-muted-foreground">{data.dna.dimensions.length} محور متناسب با رشته</span></div>
        </Panel>
        <Panel>
          <SectionHeading title="جزئیات عملکرد" subtitle={sportMeta.name} />
          <ul className="space-y-4">{data.dna.dimensions.map((dimension) => (
            <li key={dimension.id}>
              <div className="mb-1 flex items-center justify-between gap-3"><div><span className="font-bold">{dimension.label}</span><span className="ms-2 text-xs text-muted-foreground">{dimension.labelEn}</span></div><div className="flex items-center gap-2"><span className={dimension.trend >= 0 ? "font-mono text-xs text-success" : "font-mono text-xs text-destructive"}>{dimension.trend >= 0 ? "+" : ""}{dimension.trend}</span><span className="font-mono w-8 text-end text-sm font-bold">{dimension.score}</span></div></div>
              <Bar value={dimension.score / 100} color={`var(${sportMeta.colorToken})`} />
              <p className="mt-1 text-xs text-muted-foreground">{dimension.insight}</p>
            </li>
          ))}</ul>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">{data.dna.insights.map((insight) => <Panel key={insight.label}><Pill color={`var(${sportMeta.colorToken})`}>{insight.label}</Pill><p className="mt-3 text-sm leading-7">{insight.text}</p></Panel>)}</div>
    </AppShell>
  );
}
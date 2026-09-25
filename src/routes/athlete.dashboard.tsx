import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Clock, Moon, Play, Target, Zap } from "lucide-react";
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Bar, MockBadge, Panel, Pill, ProgressRing, SectionHeading, Stat } from "@/components/domain/primitives";
import { DnaRadarChart, RecoveryBars } from "@/components/domain/charts";
import { BodyChangesPanel } from "@/components/domain/body-analysis";
import { AddBodyAnalysisDialog } from "@/components/domain/body-analysis-dialog";
import { SPORTS, SPORT_LIST } from "@/domain/sports";
import type { SportId } from "@/domain/types";
import { athleteDashboardService } from "@/services/athlete/dashboard";
import { bodyAnalysisService } from "@/services/body-analysis/service";
import { demoAthlete, demoRecovery, demoRecoveryHistory } from "@/mock/athlete";

const searchSchema = z.object({
  sport: z.enum(["crossfit", "hyrox", "functional", "bodybuilding", "running"]).optional(),
  body: z.enum(["empty", "single"]).optional(),
});

export const Route = createFileRoute("/athlete/dashboard")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({ meta: [
    { title: "داشبورد ورزشکار — FitLytix" },
    { name: "description", content: "تمرین امروز، ریکاوری و پروفایل عملکرد متناسب با رشته ورزشی." },
    { property: "og:title", content: "داشبورد ورزشکار — FitLytix" },
    { property: "og:description", content: "تمرین امروز، ریکاوری و پروفایل عملکرد متناسب با رشته ورزشی." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: AthleteDashboard,
});

function AthleteDashboard() {
  const { sport: selectedSport, body } = Route.useSearch();
  const navigate = useNavigate();
  const sport: SportId = selectedSport ?? demoAthlete.primarySport;
  const data = athleteDashboardService.getSnapshot(demoAthlete.id, sport);
  const sportMeta = SPORTS[sport];
  const name = `${demoAthlete.identity.firstName} ${demoAthlete.identity.lastName}`;
  const [addOpen, setAddOpen] = useState(false);
  const [bodyVersion, setBodyVersion] = useState(0);
  const bodyRecords = useMemo(() => {
    const all = bodyAnalysisService.list(demoAthlete.id);
    // Demo-only views for QA: ?body=empty | ?body=single
    return body === "empty" ? [] : body === "single" ? all.slice(-1) : all;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, bodyVersion]);

  return (
    <AppShell mode="athlete" userName={name} userRole={`${sportMeta.name} · ${data.level}`}>
      <div className="mb-5 flex flex-wrap gap-2 pb-1" aria-label="نمایش نمونه رشته">
        {SPORT_LIST.map((item) => <Button key={item.id} size="sm" variant={sport === item.id ? "default" : "outline"} onClick={() => navigate({ to: "/athlete/dashboard", search: { sport: item.id }, replace: true })}>{item.name}</Button>)}
      </div>

      <section className="mb-6 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-carbon p-6 ring-1 ring-border md:p-8 animate-rise">
          <div className="relative">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><span>امروز</span><span>·</span><MockBadge label="پیشنهاد نمایشی" /></div>
            <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">سلام {demoAthlete.identity.firstName}</h1>
            <div className="mt-4 flex items-start gap-3 rounded-xl bg-background/50 p-4 ring-1 ring-border/70">
              <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><Target className="size-4" /></span>
              <div><div className="text-xs font-bold text-primary">تمرکز امروز</div><p className="mt-1 text-sm leading-7">{data.focus}</p></div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button asChild variant="hero" size="lg"><Link to="/athlete/program"><Play /> شروع تمرین امروز</Link></Button>
              <span className="font-mono inline-flex items-center gap-1.5 text-sm text-muted-foreground"><Clock className="size-4" /> {data.workout.duration} دقیقه</span>
            </div>
          </div>
        </div>
        <Panel className="flex flex-col animate-rise [animation-delay:80ms]">
          <div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold text-muted-foreground">جلسه بعدی</span><Pill color={`var(${sportMeta.colorToken})`}>امروز</Pill></div>
          <h2 className="font-display text-lg font-bold">{data.workout.title}</h2><p className="text-xs text-muted-foreground">{data.workout.detail}</p>
          <div className="mt-5 grid grid-cols-2 gap-2">{data.workout.blocks.map((block, index) => <div key={block} className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs"><span className="font-mono text-muted-foreground">{index + 1}</span><span>{block}</span></div>)}</div>
          <Link to="/athlete/program" className="mt-auto inline-flex items-center gap-1 pt-5 text-xs font-semibold text-primary">دیدن جزئیات <ArrowLeft className="size-3.5" /></Link>
        </Panel>
      </section>

      <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Panel>
          <div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold text-muted-foreground">برنامه فعلی</span><Pill>{data.program.phase}</Pill></div>
          <h2 className="font-display text-lg font-bold">{data.program.name}</h2>
          <div className="mt-5 flex justify-between text-xs"><span>هفته {data.program.week} از {data.program.totalWeeks}</span><span className="font-mono text-muted-foreground">{Math.round(data.program.week / data.program.totalWeeks * 100)}٪</span></div>
          <Bar value={data.program.week / data.program.totalWeeks} className="mt-2" color={`var(${sportMeta.colorToken})`} />
          <div className="mt-5 grid grid-cols-3 gap-2">{data.metrics.map((metric) => <Stat key={metric.label} label={metric.label} value={metric.value} unit={metric.note} />)}</div>
        </Panel>
        <Panel>
          <div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold text-muted-foreground">ریکاوری</span><Pill color="var(--success)">آماده</Pill></div>
          <div className="flex items-center gap-4"><ProgressRing value={data.recovery.readiness} size={88} stroke={9} color="var(--success)"><span className="font-mono text-xl font-bold">{data.recovery.readiness}</span><span className="text-[9px] text-muted-foreground">آمادگی</span></ProgressRing><div className="grid flex-1 grid-cols-2 gap-3"><Mini icon={Moon} label="خواب" value={data.recovery.sleep} /><Mini icon={Zap} label="HRV" value={`${demoRecovery.hrv}`} /><Mini icon={Target} label="وضعیت" value={data.recovery.label} /><Mini icon={Clock} label="فشار" value={data.recovery.strain} /></div></div>
          <RecoveryBars data={demoRecoveryHistory} height={90} />
          <p className="mt-2 text-xs leading-6 text-muted-foreground">{data.recovery.detail}</p>
        </Panel>
        <Panel className="md:col-span-2 xl:col-span-1">
          <div className="mb-1 flex items-center justify-between"><span className="text-xs font-bold text-muted-foreground">پروفایل عملکرد</span><Link to="/athlete/fitness-dna" search={{ sport }} className="text-xs font-semibold text-primary">نمای کامل</Link></div>
          <h2 className="font-bold">{data.dna.archetype}</h2><DnaRadarChart dimensions={data.dna.dimensions} height={210} compact />
        </Panel>
      </section>

      <BodyChangesPanel records={bodyRecords} sport={sport} onAdd={() => setAddOpen(true)} />
      <AddBodyAnalysisDialog open={addOpen} onOpenChange={setAddOpen} athleteId={demoAthlete.id} onSaved={() => setBodyVersion((v) => v + 1)} />

      <section className="mb-6 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Panel><SectionHeading title="برداشت این هفته" subtitle={sportMeta.name} /><div className="space-y-3">{data.dna.insights.map((insight) => <div key={insight.label} className="grid grid-cols-[90px_1fr] gap-3 border-b border-border/60 pb-3 last:border-0"><span className="text-xs font-semibold text-muted-foreground">{insight.label}</span><p className="text-sm">{insight.text}</p></div>)}</div></Panel>
        <Panel><SectionHeading title="جلسات اخیر" subtitle="سه جلسه آخر" action={{ label: "تاریخچه", to: "/athlete/performance" }} /><div className="divide-y divide-border/60">{data.sessions.map((session) => <div key={`${session.date}-${session.title}`} className="grid grid-cols-[75px_1fr_auto] items-center gap-3 py-3"><span className="text-xs text-muted-foreground">{session.date}</span><div><div className="text-sm font-semibold">{session.title}</div><div className="text-xs text-muted-foreground">{session.load}</div></div><span className="font-mono text-sm font-bold">{session.result}</span></div>)}</div></Panel>
      </section>
    </AppShell>
  );
}

function Mini({ icon: Icon, label, value }: { icon: typeof Moon; label: string; value: string }) {
  return <div className="flex items-center gap-2"><Icon className="size-3.5 text-muted-foreground" /><div><div className="text-[10px] text-muted-foreground">{label}</div><div className="font-mono text-sm font-bold">{value}</div></div></div>;
}
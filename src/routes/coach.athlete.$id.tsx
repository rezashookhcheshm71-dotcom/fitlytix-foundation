import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, MessageSquare, Pencil } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar } from "@/components/domain/athlete";
import { Bar, MockBadge, Panel, Pill, ProgressRing, SectionHeading, Stat } from "@/components/domain/primitives";
import { DnaRadarChart, PerformanceTrendChart, RecoveryBars } from "@/components/domain/charts";
import { SportBadge } from "@/components/domain/sport";
import { SkillRow, WorkoutBlockCard } from "@/components/domain/workout";
import { EXPERIENCE_LABEL, SPORTS } from "@/domain/sports";
import { aiCoachingEngine } from "@/services/ai-coaching/engine";
import { findRosterAthlete, demoCoach } from "@/mock/coach";
import { demoBenchmarks, demoDNA, demoPerformance, demoPRs, demoRecovery, demoRecoveryHistory, demoSessions, demoSkills, demoAthlete } from "@/mock/athlete";
import { demoProgram, todayWorkout } from "@/mock/program";

export const Route = createFileRoute("/coach/athlete/$id")({
  loader: async ({ params }) => {
    // TODO(backend): fetch athlete 360 aggregate from DB by id
    const item = findRosterAthlete(params.id);
    if (!item) throw notFound();
    const adjustments = await aiCoachingEngine.suggestAdjustments({ profile: item.athlete, dna: demoDNA, history: demoPerformance, recovery: demoRecovery });
    return { item, adjustments };
  },
  head: ({ loaderData }) => {
    const n = loaderData ? `${loaderData.item.athlete.identity.firstName} ${loaderData.item.athlete.identity.lastName}` : "ورزشکار";
    return {
      meta: [
        { title: `Athlete 360 · ${n} — FitLytix` },
        { name: "description", content: "نمای ۳۶۰ درجه ورزشکار: عملکرد، برنامه، Fitness DNA، ریکاوری، هدف‌ها، ارزیابی، بنچمارک‌ها، PRها و مهارت‌ها." },
        { property: "og:title", content: `Athlete 360 · ${n} — FitLytix` },
        { property: "og:description", content: "نمای ۳۶۰ درجه ورزشکار برای مربی." },
        ...(loaderData ? [] : [{ name: "robots", content: "noindex" }]),
      ],
    };
  },
  component: Athlete360,
});

const tabs = ["Overview", "Performance", "Program", "Fitness DNA", "Recovery", "Goals", "Assessment", "Benchmarks", "PRs", "Skills", "Calendar", "Sessions", "Exercise History"];

function Athlete360() {
  const { item, adjustments } = Route.useLoaderData();
  const a = item.athlete;
  const sport = SPORTS[a.primarySport];
  const color = `var(${sport.colorToken})`;
  const coachName = `${demoCoach.identity.firstName} ${demoCoach.identity.lastName}`;
  const name = `${a.identity.firstName} ${a.identity.lastName}`;
  const isDemo = a.id === demoAthlete.id;

  return (
    <AppShell mode="coach" userName={coachName} userRole="مربی · CrossFit L2">
      <Link to="/coach" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5 rotate-180" /> بازگشت به ورزشکاران</Link>

      <div className="mb-6 flex flex-col gap-4 rounded-3xl bg-gradient-carbon p-6 ring-1 ring-border md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={name} color={color} className="size-16 text-xl" />
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Athlete 360</div>
            <h1 className="text-2xl font-extrabold">{name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <SportBadge sport={sport} />
              <span>{EXPERIENCE_LABEL[a.experience]}</span>
              <span>·</span>
              <span>{a.coachingType === "hybrid" ? "AI + مربی" : a.coachingType === "ai" ? "AI Coach" : "مربی انسانی"}</span>
              <span>·</span>
              <span className="num">{a.heightCm} cm / {a.weightKg} kg</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ProgressRing value={item.readiness} size={64} stroke={6} color="var(--success)"><span className="num text-sm font-bold">{item.readiness}</span></ProgressRing>
          <div className="flex flex-col gap-2">
            <Button variant="hero" size="sm"><Pencil /> ویرایش برنامه</Button>
            <Button variant="outline" size="sm"><MessageSquare /> پیام</Button>
          </div>
        </div>
      </div>

      {!isDemo && <MockBadge label="برای این ورزشکار داده کامل نمایشی وجود ندارد — داده ورزشکار نمونه نمایش داده می‌شود" className="mb-4" />}

      <Tabs defaultValue="Overview" dir="rtl">
        <div className="overflow-x-auto pb-2">
          <TabsList className="h-auto min-w-max gap-1 bg-card p-1">
            {tabs.map((t) => <TabsTrigger key={t} value={t} className="font-display text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">{t}</TabsTrigger>)}
          </TabsList>
        </div>

        <TabsContent value="Overview" className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Panel><Stat label="Performance Index" value={item.performanceIndex} delta={item.trend} tone="primary" /></Panel>
            <Panel><Stat label="پایبندی" value={`${Math.round(item.adherence * 100)}٪`} tone="success" /></Panel>
            <Panel><Stat label="آمادگی" value={item.readiness} unit="%" /></Panel>
            <Panel><Stat label="جلسه بعدی" value={<span className="text-base">{item.nextWorkout}</span>} /></Panel>
          </div>
          <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
            <Panel><SectionHeading title="روند عملکرد" /><PerformanceTrendChart data={demoPerformance} height={220} /></Panel>
            <Panel>
              <SectionHeading title="پیشنهاد موتور" subtitle="Program Adjustment" />
              <ul className="space-y-3">
                {adjustments.map((adj, i) => (
                  <li key={i} className="rounded-xl bg-muted/50 p-3">
                    <div className="flex items-center justify-between"><span className="text-xs font-bold">{adj.change}</span><Pill>{adj.impact}</Pill></div>
                    <div className="mt-1 text-[11px] text-muted-foreground">دلیل: {adj.reason}</div>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2"><Button size="sm" variant="hero">اعمال</Button><Button size="sm" variant="ghost">رد</Button></div>
              <MockBadge className="mt-3" label="پیشنهاد نمایشی" />
            </Panel>
          </div>
        </TabsContent>

        <TabsContent value="Performance" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel className="lg:col-span-2"><PerformanceTrendChart data={demoPerformance} height={260} /></Panel>
          <Panel><SectionHeading title="جلسات اخیر" />{demoSessions.map((s) => <div key={s.id} className="flex items-center justify-between border-b border-border/60 py-2 text-sm last:border-0"><span className="font-display">{s.title}</span><span className="num font-bold">{s.score}</span></div>)}</Panel>
          <Panel><SectionHeading title="آمادگی هفته" /><RecoveryBars data={demoRecoveryHistory} height={160} /></Panel>
        </TabsContent>

        <TabsContent value="Program" className="mt-4">
          <Panel className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><div className="font-display font-bold">{demoProgram.name}</div><div className="text-xs text-muted-foreground">{demoProgram.phase} · هفته {demoProgram.weekIndex}/{demoProgram.totalWeeks}</div></div>
            <Button asChild variant="outline" size="sm"><Link to="/coach/programs">همه برنامه‌ها</Link></Button>
          </Panel>
          <div className="grid gap-4 md:grid-cols-2">{todayWorkout.blocks.map((b) => <WorkoutBlockCard key={b.id} block={b} compact />)}</div>
        </TabsContent>

        <TabsContent value="Fitness DNA" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel><DnaRadarChart dimensions={demoDNA.dimensions} height={320} /></Panel>
          <Panel><SectionHeading title={demoDNA.archetype} subtitle={demoDNA.archetypeEn} /><p className="text-sm leading-7 text-muted-foreground">{demoDNA.summary}</p><div className="mt-3 flex flex-wrap gap-1.5">{demoDNA.limiters.map((l) => <Pill key={l} color="var(--warning)">{l}</Pill>)}</div></Panel>
        </TabsContent>

        <TabsContent value="Recovery" className="mt-4 grid gap-4 lg:grid-cols-3">
          <Panel><Stat label="خواب" value={demoRecovery.sleepHours} unit="h" /></Panel>
          <Panel><Stat label="HRV" value={demoRecovery.hrv} unit="ms" tone="info" /></Panel>
          <Panel><Stat label="Soreness" value={demoRecovery.soreness} unit="%" tone="warning" /></Panel>
          <Panel className="lg:col-span-3"><RecoveryBars data={demoRecoveryHistory} height={180} /><p className="mt-2 text-xs text-muted-foreground">{demoRecovery.recommendation}</p></Panel>
        </TabsContent>

        <TabsContent value="Goals" className="mt-4">
          <Panel><ul className="space-y-4">{(isDemo ? demoAthlete.goals : []).map((g) => <li key={g.id}><div className="flex justify-between text-sm"><span className="font-semibold">{g.title}</span><span className="num text-muted-foreground">{g.target} · {g.deadline}</span></div><Bar value={g.progress} className="mt-1.5" /></li>)}{!isDemo && <p className="text-sm text-muted-foreground">هدفی ثبت نشده.</p>}</ul></Panel>
        </TabsContent>

        <TabsContent value="Assessment" className="mt-4">
          <Panel><SectionHeading title="آخرین ارزیابی" subtitle="CrossFit v1 · 1404/06/20" /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Back Squat 1RM", "165 kg"], ["Row 2k", "7:11"], ["Strict Pull-up", "18"], ["DU unbroken", "85"], ["Fran", "4:38"], ["Overhead Mobility", "3/5"], ["Sleep", "7.4h"], ["Scaling", "Rx"]].map(([k, v]) => <div key={k} className="rounded-xl bg-muted/50 p-3"><div className="font-display text-[11px] text-muted-foreground">{k}</div><div className="num text-lg font-bold">{v}</div></div>)}</div><Button asChild variant="outline" size="sm" className="mt-4"><Link to="/assessment/sport" search={{ sport: a.primarySport }}>باز کردن فرم ارزیابی</Link></Button></Panel>
        </TabsContent>

        <TabsContent value="Benchmarks" className="mt-4"><Panel>{demoBenchmarks.map((b) => <div key={b.id} className="flex items-center justify-between border-b border-border/60 py-3 last:border-0"><span className="font-display font-semibold">{b.name}</span><span className="num text-xs text-muted-foreground">{b.date}</span><span className="num font-bold">{b.result} <span className="text-xs text-success">{b.delta}</span></span></div>)}</Panel></TabsContent>
        <TabsContent value="PRs" className="mt-4"><Panel>{demoPRs.map((p) => <div key={p.id} className="flex items-center justify-between border-b border-border/60 py-3 last:border-0"><span className="font-display font-semibold">{p.exerciseName}</span><span className="num text-xs text-muted-foreground">{p.date}</span><span className="num font-bold">{p.value} {p.unit}</span></div>)}</Panel></TabsContent>
        <TabsContent value="Skills" className="mt-4"><Panel><div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">{demoSkills.map((s) => <SkillRow key={s.id} skill={s} />)}</div></Panel></TabsContent>
        <TabsContent value="Calendar" className="mt-4"><Panel><div className="grid grid-cols-7 gap-2">{demoProgram.workouts.map((w) => <div key={w.id} className={`rounded-xl border p-2 text-center ${w.status === "today" ? "border-primary bg-primary-soft" : "border-border"}`}><div className="num text-[10px] text-muted-foreground">{w.date.slice(5)}</div><div className="mt-1 truncate text-[10px] font-semibold">{w.focus}</div></div>)}</div></Panel></TabsContent>
        <TabsContent value="Sessions" className="mt-4"><Panel>{demoSessions.map((s) => <div key={s.id} className="flex flex-wrap items-center gap-3 border-b border-border/60 py-3 last:border-0"><span className="num text-xs text-muted-foreground">{s.date}</span><span className="font-display flex-1 font-semibold">{s.title}</span><span className="num">RPE {s.rpe}</span><span className="num font-bold">{s.score}</span></div>)}</Panel></TabsContent>
        <TabsContent value="Exercise History" className="mt-4"><Panel>{demoPRs.map((p) => <div key={p.id} className="border-b border-border/60 py-3 last:border-0"><div className="flex justify-between"><span className="font-display font-semibold">{p.exerciseName}</span><span className="num text-xs text-muted-foreground">{p.previous} → {p.value} {p.unit}</span></div><Bar value={Math.min(1, p.value / ((p.previous ?? p.value) * 1.15))} className="mt-2" height={4} /></div>)}</Panel></TabsContent>
      </Tabs>
    </AppShell>
  );
}

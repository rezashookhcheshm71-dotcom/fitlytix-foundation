import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Clock, Flame, Moon, Play, Target, Zap } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Bar, MockBadge, Panel, Pill, ProgressRing, SectionHeading, Stat } from "@/components/domain/primitives";
import { DnaRadarChart, PerformanceTrendChart, RecoveryBars } from "@/components/domain/charts";
import { SkillRow } from "@/components/domain/workout";
import { BLOCK_META } from "@/domain/sports";
import { aiCoachingEngine, AI_ENGINE_LABEL } from "@/services/ai-coaching/engine";
import { performanceEngine } from "@/services/performance/engine";
import { demoAthlete, demoDNA, demoPerformance, demoRecovery, demoRecoveryHistory, demoSessions, demoSkills } from "@/mock/athlete";
import { demoProgram, todayWorkout } from "@/mock/program";

export const Route = createFileRoute("/athlete/dashboard")({
  head: () => ({
    meta: [
      { title: "داشبورد ورزشکار — FitLytix" },
      { name: "description", content: "تمرکز امروز، برنامه فعال، روند عملکرد، ریکاوری و Fitness DNA در یک نگاه." },
      { property: "og:title", content: "داشبورد ورزشکار — FitLytix" },
      { property: "og:description", content: "تمرکز امروز، برنامه فعال، روند عملکرد، ریکاوری و Fitness DNA در یک نگاه." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AthleteDashboard,
});

function AthleteDashboard() {
  const ctx = { profile: demoAthlete, dna: demoDNA, history: demoPerformance, recovery: demoRecovery };
  const focus = aiCoachingEngine.todaysFocus(ctx);
  const readiness = performanceEngine.readinessLabel(demoRecovery.readiness);
  const delta = performanceEngine.performanceDelta(demoPerformance);
  const name = `${demoAthlete.identity.firstName} ${demoAthlete.identity.lastName}`;

  return (
    <AppShell mode="athlete" userName={name} userRole="CrossFit · پیشرفته">
      {/* Greeting + Today's focus */}
      <section className="mb-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-carbon p-6 ring-1 ring-border md:p-8 animate-rise">
          <div className="pointer-events-none absolute -end-20 -top-20 size-72 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>سه‌شنبه ۳۱ شهریور</span>
              <span>·</span>
              <MockBadge label={AI_ENGINE_LABEL} />
            </div>
            <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">سلام {demoAthlete.identity.firstName}</h1>
            <div className="mt-4 flex items-start gap-3 rounded-2xl bg-background/50 p-4 ring-1 ring-border/70">
              <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><Target className="size-4" /></span>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-primary">Today's Focus</div>
                <p className="mt-1 text-sm leading-7">{focus}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button asChild variant="hero" size="lg">
                <Link to="/athlete/program"><Play /> شروع تمرین امروز</Link>
              </Button>
              <span className="num inline-flex items-center gap-1.5 text-sm text-muted-foreground"><Clock className="size-4" /> {todayWorkout.estimatedMin} دقیقه · {todayWorkout.blocks.length} بلوک</span>
            </div>
          </div>
        </div>

        {/* Next workout */}
        <Panel className="flex flex-col animate-rise [animation-delay:80ms]">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Next Workout</span>
            <Pill color="var(--primary)">امروز</Pill>
          </div>
          <h3 className="font-display text-lg font-bold">{todayWorkout.title}</h3>
          <p className="text-xs text-muted-foreground">{todayWorkout.focus}</p>
          <ul className="mt-4 space-y-2">
            {todayWorkout.blocks.map((b) => {
              const m = BLOCK_META[b.type];
              return (
                <li key={b.id} className="flex items-center gap-3 text-sm">
                  <span className="size-2 rounded-full" style={{ background: m.cssVar, boxShadow: `0 0 8px ${m.cssVar}` }} />
                  <span className="font-display text-xs font-semibold" style={{ color: m.cssVar }}>{m.en}</span>
                  <span className="truncate text-muted-foreground">{b.movements[0]?.exerciseName}{b.movements[1] ? ` · ${b.movements[1].exerciseName}` : ""}</span>
                  <span className="num ms-auto text-xs text-muted-foreground">{b.durationMin}′</span>
                </li>
              );
            })}
          </ul>
          <Link to="/athlete/program" className="mt-auto inline-flex items-center gap-1 pt-4 text-xs font-semibold text-primary hover:underline">جزئیات بلوک‌ها <ArrowLeft className="size-3.5" /></Link>
        </Panel>
      </section>

      {/* Row: active program / recovery / DNA */}
      <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Panel className="animate-rise [animation-delay:120ms]">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Active Program</span>
            <Pill>{demoProgram.generatedBy === "hybrid" ? "AI + مربی" : demoProgram.generatedBy}</Pill>
          </div>
          <h3 className="font-display text-lg font-bold">{demoProgram.name}</h3>
          <p className="text-xs text-muted-foreground">{demoProgram.phase} · هدف: {demoProgram.goal}</p>
          <div className="mt-4 flex items-center justify-between text-xs">
            <span>هفته <span className="num font-bold">{demoProgram.weekIndex}</span> از <span className="num">{demoProgram.totalWeeks}</span></span>
            <span className="num text-muted-foreground">{Math.round((demoProgram.weekIndex / demoProgram.totalWeeks) * 100)}٪</span>
          </div>
          <Bar value={demoProgram.weekIndex / demoProgram.totalWeeks} className="mt-2" />
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat label="پایبندی" value={`${Math.round(demoProgram.adherence * 100)}٪`} tone="success" />
            <Stat label="جلسات هفته" value="4/5" />
            <Stat label="بار هفتگی" value="25" unit="AU" />
          </div>
        </Panel>

        <Panel className="animate-rise [animation-delay:160ms]">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Recovery</span>
            <Pill color={readiness.tone === "success" ? "var(--success)" : readiness.tone === "warning" ? "var(--warning)" : "var(--destructive)"}>{readiness.label}</Pill>
          </div>
          <div className="flex items-center gap-4">
            <ProgressRing value={demoRecovery.readiness} size={88} stroke={9} color="var(--success)">
              <span className="num text-xl font-bold">{demoRecovery.readiness}</span>
              <span className="text-[9px] text-muted-foreground">آمادگی</span>
            </ProgressRing>
            <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-2">
              <Mini icon={Moon} label="خواب" value={`${demoRecovery.sleepHours}h`} />
              <Mini icon={Zap} label="HRV" value={`${demoRecovery.hrv}`} />
              <Mini icon={Flame} label="Strain" value={`${demoRecovery.strain}`} />
              <Mini icon={Target} label="RHR" value={`${demoRecovery.restingHr}`} />
            </div>
          </div>
          <div className="mt-3"><RecoveryBars data={demoRecoveryHistory} height={90} /></div>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">{demoRecovery.recommendation}</p>
        </Panel>

        <Panel className="animate-rise [animation-delay:200ms] md:col-span-2 xl:col-span-1">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Fitness DNA</span>
            <Link to="/athlete/fitness-dna" className="text-xs font-semibold text-primary hover:underline">کامل</Link>
          </div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold">{demoDNA.archetype}</h3>
            <span className="font-display text-xs text-muted-foreground">{demoDNA.archetypeEn}</span>
          </div>
          <DnaRadarChart dimensions={demoDNA.dimensions} height={200} compact />
          <div className="flex flex-wrap gap-1.5">
            {demoDNA.limiters.map((l) => <Pill key={l} color="var(--warning)">محدودکننده: {l}</Pill>)}
          </div>
        </Panel>
      </section>

      {/* Trend + skills */}
      <section className="mb-6 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Panel className="animate-rise [animation-delay:240ms]">
          <SectionHeading title="روند عملکرد" subtitle="Performance Index · ۸ هفته اخیر" action={{ label: "تحلیل کامل", to: "/athlete/performance" }} />
          <div className="mb-3 flex gap-6">
            <Stat label="Performance Index" value={demoPerformance.at(-1)?.performanceIndex} delta={delta} tone="primary" />
            <Stat label="Strength" value={demoPerformance.at(-1)?.strength} delta={8} tone="success" />
            <Stat label="Engine" value={demoPerformance.at(-1)?.engine} delta={13} tone="info" />
          </div>
          <PerformanceTrendChart data={demoPerformance} height={220} />
        </Panel>

        <Panel className="animate-rise [animation-delay:280ms]">
          <SectionHeading title="پیشرفت مهارت‌ها" subtitle="Skill Progress" action={{ label: "همه", to: "/athlete/fitness-dna" }} />
          <div className="space-y-4">
            {demoSkills.slice(1, 6).map((s) => <SkillRow key={s.id} skill={s} />)}
          </div>
        </Panel>
      </section>

      {/* Recent sessions */}
      <section>
        <Panel className="animate-rise [animation-delay:320ms]">
          <SectionHeading title="جلسات اخیر" subtitle="Recent Sessions" action={{ label: "تاریخچه", to: "/athlete/performance" }} />
          <ul className="divide-y divide-border/60">
            {demoSessions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                <span className="num w-20 text-xs text-muted-foreground">{s.date}</span>
                <span className="font-display flex-1 text-sm font-semibold">{s.title}</span>
                {s.prAchieved && <Pill color="var(--primary)">PR</Pill>}
                <span className="num text-sm font-bold">{s.score}</span>
                <span className="num text-xs text-muted-foreground">RPE {s.rpe}</span>
                <span className="num text-xs text-muted-foreground">{s.durationMin}′</span>
                <Bar value={s.blocksCompleted / s.totalBlocks} className="w-16" height={4} color={s.blocksCompleted === s.totalBlocks ? "var(--success)" : "var(--warning)"} />
              </li>
            ))}
          </ul>
        </Panel>
      </section>
    </AppShell>
  );
}

function Mini({ icon: Icon, label, value }: { icon: typeof Moon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-3.5 text-muted-foreground" />
      <div>
        <div className="text-[10px] text-muted-foreground">{label}</div>
        <div className="num text-sm font-bold">{value}</div>
      </div>
    </div>
  );
}

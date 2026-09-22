import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Dna } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Bar, MockBadge, PageHeader, Panel, Pill, SectionHeading } from "@/components/domain/primitives";
import { DnaRadarChart } from "@/components/domain/charts";
import { SkillRow } from "@/components/domain/workout";
import { demoAthlete, demoDNA, demoSkills } from "@/mock/athlete";

export const Route = createFileRoute("/athlete/fitness-dna")({
  head: () => ({
    meta: [
      { title: "Fitness DNA — FitLytix" },
      { name: "description", content: "پروفایل چندبعدی ورزشکار: قدرت، توان، موتور، ژیمناستیک، تحرک، ریکاوری، استمرار و مهارت." },
      { property: "og:title", content: "Fitness DNA — FitLytix" },
      { property: "og:description", content: "پروفایل چندبعدی ورزشکار از ارزیابی و تاریخچه عملکرد." },
    ],
  }),
  component: FitnessDnaPage,
});

const dimColor: Record<string, string> = {
  strength: "var(--block-strength)",
  power: "var(--primary)",
  engine: "var(--block-engine)",
  gymnastics: "var(--block-skill)",
  mobility: "var(--block-warmup)",
  recovery: "var(--block-cooldown)",
  consistency: "var(--success)",
  skill: "var(--block-weightlifting)",
};

function FitnessDnaPage() {
  const name = `${demoAthlete.identity.firstName} ${demoAthlete.identity.lastName}`;
  return (
    <AppShell mode="athlete" userName={name} userRole="CrossFit · پیشرفته">
      <PageHeader
        eyebrow={<span className="inline-flex items-center gap-1.5"><Dna className="size-3.5" /> FITNESS DNA · {demoDNA.generatedAt}</span>}
        title={<>{demoDNA.archetype} <span className="font-display text-xl text-muted-foreground">{demoDNA.archetypeEn}</span></>}
        description={demoDNA.summary}
        actions={<Button asChild variant="hero"><Link to="/plans">دریافت برنامه بر اساس DNA <ArrowLeft /></Link></Button>}
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <Panel className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,oklch(0.72_0.19_45/12%),transparent_60%)]" />
          <DnaRadarChart dimensions={demoDNA.dimensions} height={380} />
          <div className="flex items-center justify-between">
            <MockBadge label={`منبع: ${demoDNA.source === "mock" ? "داده نمایشی" : "موتور"}`} />
            <span className="text-[11px] text-muted-foreground">۸ بُعد · صدک نسبت به هم‌رده‌ها</span>
          </div>
        </Panel>

        <Panel>
          <SectionHeading title="ابعاد" subtitle="Dimension breakdown" />
          <ul className="space-y-4">
            {demoDNA.dimensions.map((d) => (
              <li key={d.id}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{d.label}</span>
                    <span className="font-display text-[11px] text-muted-foreground">{d.labelEn}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.percentile && <span className="num text-[11px] text-muted-foreground">P{d.percentile}</span>}
                    <span className={`num text-[11px] font-semibold ${d.trend >= 0 ? "text-success" : "text-destructive"}`}>{d.trend >= 0 ? "+" : ""}{d.trend}</span>
                    <span className="num w-8 text-end text-sm font-bold">{d.score}</span>
                  </div>
                </div>
                <Bar value={d.score / 100} color={dimColor[d.id]} />
                <div className="mt-1 text-[11px] text-muted-foreground">{d.insight}</div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel>
          <SectionHeading title="نقاط قوت" />
          <div className="flex flex-wrap gap-2">{demoDNA.strengths.map((s) => <Pill key={s} color="var(--success)">{s}</Pill>)}</div>
        </Panel>
        <Panel>
          <SectionHeading title="محدودکننده‌ها" subtitle="موتور برنامه روی این‌ها تمرکز می‌کند" />
          <div className="flex flex-wrap gap-2">{demoDNA.limiters.map((s) => <Pill key={s} color="var(--warning)">{s}</Pill>)}</div>
        </Panel>
        <Panel>
          <SectionHeading title="هدف‌ها" subtitle="Goals" />
          <ul className="space-y-3">
            {demoAthlete.goals.map((g) => (
              <li key={g.id}>
                <div className="flex items-center justify-between text-sm"><span className="font-semibold">{g.title}</span><span className="num text-xs text-muted-foreground">{Math.round(g.progress * 100)}٪</span></div>
                <Bar value={g.progress} className="mt-1" height={4} />
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel className="mt-4">
        <SectionHeading title="نقشه مهارت‌ها" subtitle="Skill map" />
        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
          {demoSkills.map((s) => <SkillRow key={s.id} skill={s} />)}
        </div>
      </Panel>
    </AppShell>
  );
}

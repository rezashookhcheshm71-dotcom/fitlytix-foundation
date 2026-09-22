import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Bar, PageHeader, Panel, Pill } from "@/components/domain/primitives";
import { SportBadge } from "@/components/domain/sport";
import { SPORTS } from "@/domain/sports";
import { coachRoster, demoCoach } from "@/mock/coach";
import { demoProgram } from "@/mock/program";

export const Route = createFileRoute("/coach/programs")({
  head: () => ({
    meta: [
      { title: "برنامه‌ها — Coach · FitLytix" },
      { name: "description", content: "برنامه‌های فعال ورزشکاران، فاز، هفته و پایبندی." },
      { property: "og:title", content: "برنامه‌ها — Coach · FitLytix" },
      { property: "og:description", content: "برنامه‌های فعال ورزشکاران، فاز، هفته و پایبندی." },
    ],
  }),
  component: CoachPrograms,
});

const phases = ["Strength Accumulation", "Engine Build", "Competition Prep", "Foundations", "Hypertrophy", "Threshold Block"];

function CoachPrograms() {
  const name = `${demoCoach.identity.firstName} ${demoCoach.identity.lastName}`;
  return (
    <AppShell mode="coach" userName={name} userRole="مربی · CrossFit L2">
      <PageHeader eyebrow="PROGRAMS" title="برنامه‌های فعال" description="هر برنامه به یک ورزشکار، یک رشته و یک فاز متصل است." actions={<Button variant="hero"><Plus /> برنامه جدید</Button>} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {coachRoster.map((r, i) => {
          const sport = SPORTS[r.athlete.primarySport];
          const week = ((i * 2) % 8) + 1;
          return (
            <Link key={r.athlete.id} to="/coach/athlete/$id" params={{ id: r.athlete.id }}>
              <Panel className="h-full transition-all hover:-translate-y-0.5 hover:border-primary/30">
                <div className="mb-2 flex items-center justify-between"><SportBadge sport={sport} /><Pill>{r.athlete.coachingType === "ai" ? "AI" : r.athlete.coachingType === "human" ? "مربی" : "Hybrid"}</Pill></div>
                <div className="font-display text-base font-bold">{i === 0 ? demoProgram.name : `${sport.name} — ${phases[i]}`}</div>
                <div className="text-xs text-muted-foreground">{r.athlete.identity.firstName} {r.athlete.identity.lastName} · {phases[i]}</div>
                <div className="mt-4 flex justify-between text-xs"><span>هفته <span className="num font-bold">{i === 0 ? demoProgram.weekIndex : week}</span>/8</span><span className="num text-muted-foreground">پایبندی {Math.round(r.adherence * 100)}٪</span></div>
                <Bar value={(i === 0 ? demoProgram.weekIndex : week) / 8} className="mt-2" color={`var(${sport.colorToken})`} />
              </Panel>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}

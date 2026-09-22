import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Calendar, ClipboardList, Library, LineChart, Ruler, Sparkles, Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { AthleteCard } from "@/components/domain/athlete";
import { MockBadge, PageHeader, Panel, SectionHeading, Stat } from "@/components/domain/primitives";
import { coachRoster, demoCoach } from "@/mock/coach";

export const Route = createFileRoute("/coach/")({
  head: () => ({
    meta: [
      { title: "Coach Command Center — FitLytix" },
      { name: "description", content: "مدیریت ورزشکاران، برنامه‌ها، پایگاه حرکات، اسکیلینگ، مهارت‌ها، ارزیابی‌ها و عملکرد." },
      { property: "og:title", content: "Coach Command Center — FitLytix" },
      { property: "og:description", content: "مدیریت ورزشکاران، برنامه‌ها، حرکات و عملکرد در یک مرکز فرماندهی." },
    ],
  }),
  component: CoachHome,
});

const modules = [
  { icon: Users, label: "Athletes", fa: "ورزشکاران", to: "/coach" as const },
  { icon: Calendar, label: "Programs", fa: "برنامه‌ها", to: "/coach/programs" as const },
  { icon: Library, label: "Exercise DB", fa: "پایگاه حرکات", to: "/coach/exercises" as const },
  { icon: Ruler, label: "Scaling", fa: "اسکیلینگ", to: "/coach/exercises" as const },
  { icon: Sparkles, label: "Skills", fa: "مهارت‌ها", to: "/coach/athlete/$id" as const },
  { icon: ClipboardList, label: "Assessments", fa: "ارزیابی‌ها", to: "/coach/athlete/$id" as const },
  { icon: LineChart, label: "Performance", fa: "عملکرد", to: "/coach/athlete/$id" as const },
];

function CoachHome() {
  const name = `${demoCoach.identity.firstName} ${demoCoach.identity.lastName}`;
  const attention = coachRoster.filter((r) => r.flag === "attention");
  const avgReadiness = Math.round(coachRoster.reduce((a, r) => a + r.readiness, 0) / coachRoster.length);
  const avgAdherence = Math.round((coachRoster.reduce((a, r) => a + r.adherence, 0) / coachRoster.length) * 100);

  return (
    <AppShell mode="coach" userName={name} userRole="مربی · CrossFit L2">
      <PageHeader eyebrow="COACH COMMAND CENTER" title={`صبح بخیر، ${demoCoach.identity.firstName}`} description="وضعیت تیم امروز. موارد نیازمند توجه اول نمایش داده می‌شوند." actions={<MockBadge label="روستر نمایشی" />} />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Panel><Stat label="ورزشکاران فعال" value={coachRoster.length} /></Panel>
        <Panel><Stat label="میانگین آمادگی" value={avgReadiness} unit="%" tone="success" /></Panel>
        <Panel><Stat label="میانگین پایبندی" value={avgAdherence} unit="%" tone="info" /></Panel>
        <Panel className="border-destructive/30">
          <Stat label="نیازمند توجه" value={attention.length} tone="warning" />
          {attention[0] && (
            <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-destructive"><AlertTriangle className="size-3" /> {attention[0].athlete.identity.firstName}: پایبندی افت کرده</div>
          )}
        </Panel>
      </div>

      <div className="mb-6 overflow-x-auto">
        <div className="flex min-w-max gap-2">
          {modules.map((m) => (
            <Link key={m.label} to={m.to} params={{ id: "ath_001" }} className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold transition-colors hover:border-primary/40 hover:text-primary">
              <m.icon className="size-3.5 text-primary" /> {m.fa} <span className="font-display text-muted-foreground">{m.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <SectionHeading title="ورزشکاران" subtitle="کلیک روی هر کارت → Athlete 360" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[...coachRoster].sort((a, b) => (a.flag === "attention" ? -1 : b.flag === "attention" ? 1 : 0)).map((r, i) => (
          <div key={r.athlete.id} className="animate-rise" style={{ animationDelay: `${i * 60}ms` }}>
            <AthleteCard item={r} />
          </div>
        ))}
      </div>
    </AppShell>
  );
}

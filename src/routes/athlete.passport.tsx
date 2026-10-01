import type { ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Share2 } from "lucide-react";
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/domain/athlete";
import { Bar, MockBadge, PageHeader, Panel, Pill } from "@/components/domain/primitives";
import { EXPERIENCE_LABEL, SPORTS } from "@/domain/sports";
import { demoAthlete } from "@/mock/athlete";
import { athlete360Service } from "@/services/athlete/athlete360";

export const Route = createFileRoute("/athlete/passport")({
  validateSearch: (s) => z.object({ sport: z.enum(["crossfit", "hyrox", "functional", "bodybuilding", "running"]).optional() }).parse(s),
  head: () => ({ meta: [
    { title: "پاسپورت ورزشکار — FitLytix" },
    { name: "description", content: "خلاصه فشرده رشته، سطح، Fitness DNA، رکوردها و هدف‌ها." },
    { property: "og:title", content: "پاسپورت ورزشکار — FitLytix" },
    { property: "og:description", content: "خلاصه فشرده رشته، سطح، Fitness DNA، رکوردها و هدف‌ها." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: PassportPage,
});

function PassportPage() {
  const sport = Route.useSearch().sport ?? demoAthlete.primarySport;
  const p = athlete360Service.passport(demoAthlete.id, sport);
  const color = `var(${SPORTS[sport].colorToken})`;
  return (
    <AppShell mode="athlete" userName={p.name} userRole="پاسپورت">
      <PageHeader eyebrow="پاسپورت" title="خلاصه ورزشی تو در یک نگاه" actions={<Button variant="outline" size="sm" disabled title="اشتراک‌گذاری در نسخه بعد"><Share2 /> اشتراک‌گذاری (به‌زودی)</Button>} />
      <Panel className="mx-auto max-w-xl overflow-hidden p-0">
        <div className="h-1" style={{ background: color }} />
        <div className="p-6">
          <div className="flex items-center gap-4"><Avatar name={p.name} color={color} className="size-14" /><div><h2 className="text-xl font-extrabold">{p.name}</h2><div className="mt-1 flex gap-2 text-xs text-muted-foreground"><Pill color={color}>{SPORTS[sport].name}</Pill><span>{EXPERIENCE_LABEL[p.level]}</span><span>· {p.archetype}</span></div></div></div>
          <div className="mt-6 grid grid-cols-3 gap-3">{p.topDimensions.map((d) => <div key={d.label} className="rounded-xl bg-muted/40 p-3 text-center"><div className="num text-2xl font-bold">{d.score}</div><div className="text-[11px] text-muted-foreground">{d.label}</div></div>)}</div>
          <Block title="رکوردها">{p.prs.map((r) => <Row key={r.name} a={r.name} b={r.value} />)}</Block>
          {p.benchmarks.length > 0 && <Block title="بنچمارک‌ها">{p.benchmarks.map((r) => <Row key={r.name} a={r.name} b={r.result} />)}</Block>}
          {p.skills.length > 0 && <Block title="مهارت‌ها"><div className="flex flex-wrap gap-1.5">{p.skills.map((s) => <Pill key={s}>{s}</Pill>)}</div></Block>}
          <Block title="هدف‌ها"><ul className="list-inside list-disc text-sm">{p.goals.map((g) => <li key={g}>{g}</li>)}</ul></Block>
          <Block title="استمرار"><Bar value={p.consistency} color={color} /><p className="num mt-1 text-xs text-muted-foreground">{Math.round(p.consistency * 100)}٪ جلسه‌های برنامه</p></Block>
          <p className="mt-4 text-sm text-muted-foreground">{p.progressNote}</p>
          <MockBadge className="mt-4" label="نسخه نمایشی" />
        </div>
      </Panel>
    </AppShell>
  );
}
function Block({ title, children }: { title: string; children: ReactNode }) {
  return <div className="mt-5"><div className="mb-2 text-xs font-bold text-muted-foreground">{title}</div>{children}</div>;
}
function Row({ a, b }: { a: string; b: string }) {
  return <div className="flex justify-between border-b border-border/50 py-1.5 text-sm last:border-0"><span>{a}</span><span className="num font-bold">{b}</span></div>;
}

import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/domain/athlete";
import { MockBadge, PageHeader, Panel, Pill } from "@/components/domain/primitives";
import { EXPERIENCE_LABEL, SPORTS, SPORT_LIST } from "@/domain/sports";
import type { SportId } from "@/domain/types";
import { coachService, type RosterSegment } from "@/services/coach/service";

export const Route = createFileRoute("/coach/athletes")({
  head: () => ({ meta: [
    { title: "ورزشکاران — مربی FitLytix" },
    { name: "description", content: "فهرست ورزشکاران با فیلتر رشته، سطح، هدف و وضعیت." },
    { property: "og:title", content: "ورزشکاران — مربی FitLytix" },
    { property: "og:description", content: "فهرست ورزشکاران با فیلتر رشته، سطح، هدف و وضعیت." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: CoachAthletes,
});

const SEGMENTS: { id: RosterSegment; label: string }[] = [
  { id: "all", label: "اولویت توجه" }, { id: "by_sport", label: "بر اساس رشته" }, { id: "by_level", label: "بر اساس سطح" },
  { id: "most_improved", label: "بیشترین پیشرفت" }, { id: "most_consistent", label: "منظم‌ترین" }, { id: "by_goal", label: "نوع هدف" },
];
const GOAL_LABEL: Record<string, string> = { performance: "عملکرد", body: "بدن", health: "سلامت", skill: "مهارت", race: "مسابقه" };

function CoachAthletes() {
  const [sport, setSport] = useState<SportId | undefined>();
  const [level, setLevel] = useState<string | undefined>();
  const [goalType, setGoalType] = useState<string | undefined>();
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [segment, setSegment] = useState<RosterSegment>("all");
  const list = coachService.sort(coachService.roster({ sport, level, goalType, attentionOnly }), segment);
  const chip = (on: boolean, label: string, onClick: () => void) => <Button key={label} size="sm" variant={on ? "default" : "outline"} onClick={onClick} className="h-8 text-xs">{label}</Button>;

  return (
    <AppShell mode="coach" userName="سارا موسوی" userRole="مربی">
      <PageHeader eyebrow="ورزشکاران" title="همه ورزشکارها" description="دسته‌بندی‌ها شفاف و بر اساس عدد قابل اندازه‌گیری‌اند؛ امتیاز «بهترین ورزشکار» نداریم." actions={<MockBadge label="روستر نمایشی" />} />
      <Panel className="mb-4 space-y-3">
        <div className="flex flex-wrap gap-1.5">{chip(!sport, "همه رشته‌ها", () => setSport(undefined))}{SPORT_LIST.map((s) => chip(sport === s.id, s.name, () => setSport(s.id)))}</div>
        <div className="flex flex-wrap gap-1.5">{chip(!level, "همه سطوح", () => setLevel(undefined))}{(["beginner", "intermediate", "advanced"] as const).map((l) => chip(level === l, EXPERIENCE_LABEL[l]!, () => setLevel(l)))}</div>
        <div className="flex flex-wrap gap-1.5">{chip(!goalType, "همه هدف‌ها", () => setGoalType(undefined))}{Object.entries(GOAL_LABEL).map(([k, v]) => chip(goalType === k, v, () => setGoalType(k)))}{chip(attentionOnly, "فقط نیاز به توجه", () => setAttentionOnly((x) => !x))}</div>
      </Panel>
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">{SEGMENTS.map((s) => <Button key={s.id} size="sm" variant={segment === s.id ? "secondary" : "ghost"} onClick={() => setSegment(s.id)}>{s.label}</Button>)}</div>

      {list.length === 0 ? <Panel className="text-center text-sm text-muted-foreground">با این فیلترها ورزشکاری پیدا نشد.</Panel> : (
        <Panel className="overflow-x-auto p-0">
          <table className="w-full min-w-[820px] text-sm">
            <thead><tr className="border-b border-border text-[11px] text-muted-foreground">{["ورزشکار", "رشته / سطح", "هدف", "آمادگی", "پایبندی", "روند", "آخرین جلسه", "جلسه بعدی", "وضعیت"].map((h) => <th key={h} className="p-3 text-start font-medium">{h}</th>)}</tr></thead>
            <tbody>{list.map((r) => {
              const s = SPORTS[r.athlete.primarySport]; const name = `${r.athlete.identity.firstName} ${r.athlete.identity.lastName}`;
              return (
                <tr key={r.athlete.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                  <td className="p-3"><Link to="/coach/athlete/$id" params={{ id: r.athlete.id }} className="flex items-center gap-2 font-semibold hover:text-primary"><Avatar name={name} color={`var(${s.colorToken})`} className="size-8" />{name}</Link></td>
                  <td className="p-3 text-xs"><Pill color={`var(${s.colorToken})`}>{s.name}</Pill> <span className="text-muted-foreground">{EXPERIENCE_LABEL[r.athlete.experience]}</span></td>
                  <td className="p-3 text-xs">{r.goal}</td>
                  <td className={`num p-3 font-bold ${r.readiness < 55 ? "text-destructive" : r.readiness < 70 ? "text-warning" : "text-success"}`}>{r.readiness}</td>
                  <td className="num p-3">{Math.round(r.adherence * 100)}٪</td>
                  <td className={`num p-3 ${r.trend < 0 ? "text-destructive" : "text-success"}`}>{r.trend > 0 ? "+" : ""}{r.trend}</td>
                  <td className="p-3 text-xs text-muted-foreground">{r.lastSession}</td>
                  <td className="p-3 font-display text-xs">{r.nextWorkout}</td>
                  <td className="p-3 text-xs">{r.flag === "attention" ? <Pill color="var(--destructive)">نیاز به توجه</Pill> : r.flag === "recovering" ? <Pill color="var(--warning)">ریکاوری</Pill> : r.flag === "peak" ? <Pill color="var(--success)">فرم خوب</Pill> : "—"}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </Panel>
      )}
    </AppShell>
  );
}

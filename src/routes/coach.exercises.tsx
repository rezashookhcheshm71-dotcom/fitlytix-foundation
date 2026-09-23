import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { PageHeader, Panel, Pill } from "@/components/domain/primitives";
import { SPORTS } from "@/domain/sports";
import { demoCoach } from "@/mock/coach";
import { demoExercises } from "@/mock/program";

export const Route = createFileRoute("/coach/exercises")({
  head: () => ({
    meta: [
      { title: "پایگاه حرکات — Coach · FitLytix" },
      { name: "description", content: "حرکات، الگوهای حرکتی، تجهیزات و گزینه‌های اسکیلینگ." },
      { property: "og:title", content: "پایگاه حرکات — Coach · FitLytix" },
      { property: "og:description", content: "حرکات، الگوهای حرکتی، تجهیزات و گزینه‌های اسکیلینگ." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Exercises,
});

function Exercises() {
  const name = `${demoCoach.identity.firstName} ${demoCoach.identity.lastName}`;
  const [q, setQ] = useState("");
  const list = demoExercises.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()) || e.nameFa?.includes(q));
  return (
    <AppShell mode="coach" userName={name} userRole="مربی · CrossFit L2">
      <PageHeader eyebrow="EXERCISE DATABASE" title="پایگاه حرکات و اسکیلینگ" description="هر حرکت با الگو، تجهیزات، رشته‌ها و گزینه‌های اسکیلینگ تعریف می‌شود." />
      <div className="relative mb-4 max-w-md">
        <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی حرکت…" className="h-11 ps-9" />
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.map((e) => (
          <Panel key={e.id} className="flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <div><div className="font-display font-bold">{e.name}</div>{e.nameFa && <div className="text-xs text-muted-foreground">{e.nameFa}</div>}</div>
              <span className="num text-xs text-muted-foreground">{"●".repeat(e.difficulty)}{"○".repeat(5 - e.difficulty)}</span>
            </div>
            <div className="flex flex-wrap gap-1.5"><Pill>{e.pattern}</Pill>{e.equipment.map((eq) => <Pill key={eq} className="bg-muted text-muted-foreground">{eq}</Pill>)}</div>
            <div className="flex flex-wrap gap-1.5">{e.sports.map((s) => <span key={s} className="font-display text-[10px] font-bold" style={{ color: `var(${SPORTS[s].colorToken})` }}>{SPORTS[s].name}</span>)}</div>
            <div className="text-[11px] text-muted-foreground">اسکیلینگ: <span className="font-display text-foreground">{e.scalingOptions.join(" · ")}</span></div>
          </Panel>
        ))}
      </div>
    </AppShell>
  );
}

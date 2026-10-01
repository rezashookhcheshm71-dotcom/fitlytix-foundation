import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Circle } from "lucide-react";
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { Bar, MockBadge, PageHeader, Panel, Pill } from "@/components/domain/primitives";
import { JourneyBar } from "@/components/domain/coaching";
import { SPORTS } from "@/domain/sports";
import { demoAthlete } from "@/mock/athlete";
import { goalsService } from "@/services/goals/service";

export const Route = createFileRoute("/athlete/goals")({
  validateSearch: (s) => z.object({ sport: z.enum(["crossfit", "hyrox", "functional", "bodybuilding", "running"]).optional() }).parse(s),
  head: () => ({ meta: [
    { title: "هدف‌ها و مسیر — FitLytix" },
    { name: "description", content: "هدف‌ها، مایل‌استون‌ها و تمرکز این هفته در مسیر ورزشی‌ات." },
    { property: "og:title", content: "هدف‌ها و مسیر — FitLytix" },
    { property: "og:description", content: "هدف‌ها، مایل‌استون‌ها و تمرکز این هفته در مسیر ورزشی‌ات." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: GoalsPage,
});

function GoalsPage() {
  const sport = Route.useSearch().sport ?? demoAthlete.primarySport;
  const goals = goalsService.list(demoAthlete.id, sport);
  return (
    <AppShell mode="athlete" userName={`${demoAthlete.identity.firstName} ${demoAthlete.identity.lastName}`} userRole={SPORTS[sport].name}>
      <PageHeader eyebrow="هدف‌ها" title="به کجا می‌خواهی برسی؟" description="هر هدف چند قدم مشخص دارد؛ این هفته فقط روی قدم بعدی تمرکز کن." actions={<MockBadge label="نسخه نمایشی" />} />
      <div className="space-y-4">
        {goals.map((g) => (
          <Panel key={g.id}>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div><h2 className="text-lg font-bold">{g.title}</h2><p className="num text-xs text-muted-foreground">الان: {g.current} · هدف: {g.target}{g.deadline ? ` · تا ${g.deadline}` : ""}</p></div>
              <Pill color={g.status === "at_risk" ? "var(--warning)" : "var(--success)"}>{g.status === "at_risk" ? "نیاز به توجه" : g.status === "done" ? "انجام شد" : "در مسیر"}</Pill>
            </div>
            <Bar value={g.progress} />
            <div className="my-5"><JourneyBar stage={goalsService.journeyStage(g)} /></div>
            <div className="grid gap-4 md:grid-cols-2">
              <ul className="space-y-2">{g.milestones.map((m) => <li key={m.id} className="flex items-center gap-2 text-sm">{m.done ? <CheckCircle2 className="size-4 text-success" /> : <Circle className="size-4 text-muted-foreground" />}<span className={m.done ? "" : "text-muted-foreground"}>{m.title}</span>{m.date && <span className="num text-[10px] text-muted-foreground">{m.date}</span>}</li>)}</ul>
              <div className="rounded-xl bg-primary-soft p-4"><div className="text-xs font-bold text-primary">تمرکز این هفته</div><p className="mt-1 text-sm leading-7">{g.weeklyFocus}</p></div>
            </div>
          </Panel>
        ))}
      </div>
    </AppShell>
  );
}

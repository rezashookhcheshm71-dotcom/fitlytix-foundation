import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { MockBadge, PageHeader, Panel, SectionHeading } from "@/components/domain/primitives";
import { SPORTS, SPORT_LIST } from "@/domain/sports";
import { coachRoster } from "@/mock/coach";

export const Route = createFileRoute("/coach/performance")({
  head: () => ({ meta: [
    { title: "عملکرد تیم — مربی FitLytix" },
    { name: "description", content: "روند شاخص عملکرد و پیشرفت ورزشکاران به تفکیک رشته." },
    { property: "og:title", content: "عملکرد تیم — مربی FitLytix" },
    { property: "og:description", content: "روند شاخص عملکرد و پیشرفت ورزشکاران به تفکیک رشته." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: CoachPerformance,
});

function CoachPerformance() {
  return (
    <AppShell mode="coach" userName="سارا موسوی" userRole="مربی">
      <PageHeader eyebrow="عملکرد" title="روند تیم به تفکیک رشته" description="شاخص عملکرد هر رشته با معیار همان رشته سنجیده می‌شود؛ مقایسه بین رشته‌ها معنی ندارد." actions={<MockBadge label="نسخه نمایشی" />} />
      <div className="grid gap-4 lg:grid-cols-2">{SPORT_LIST.map((s) => {
        const list = coachRoster.filter((r) => r.athlete.primarySport === s.id);
        if (!list.length) return null;
        return (
          <Panel key={s.id}>
            <SectionHeading title={s.name} subtitle={`${list.length} ورزشکار`} />
            <ul className="space-y-3">{list.map((r) => (
              <li key={r.athlete.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 text-sm">
                <Link to="/coach/athlete/$id" params={{ id: r.athlete.id }} className="font-semibold hover:text-primary">{r.athlete.identity.firstName} {r.athlete.identity.lastName}</Link>
                <div className="h-2 w-24 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${r.performanceIndex}%`, background: `var(${SPORTS[s.id].colorToken})` }} /></div>
                <span className={`num w-14 text-end text-xs ${r.trend < 0 ? "text-destructive" : "text-success"}`}>{r.performanceIndex} ({r.trend > 0 ? "+" : ""}{r.trend})</span>
              </li>
            ))}</ul>
          </Panel>
        );
      })}</div>
    </AppShell>
  );
}

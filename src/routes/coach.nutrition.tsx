import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Bar, MockBadge, PageHeader, Panel, Pill } from "@/components/domain/primitives";
import { SPORTS } from "@/domain/sports";
import { coachRoster } from "@/mock/coach";
import { PACKAGES } from "@/services/subscriptions/service";

export const Route = createFileRoute("/coach/nutrition")({
  head: () => ({ meta: [
    { title: "تغذیه ورزشکاران — مربی FitLytix" },
    { name: "description", content: "بسته‌های تغذیه فعال، پایبندی و ورزشکارانی که نیاز به بازبینی برنامه غذایی دارند." },
    { property: "og:title", content: "تغذیه ورزشکاران — مربی FitLytix" },
    { property: "og:description", content: "بسته‌های تغذیه فعال و پایبندی ورزشکاران." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: CoachNutrition,
});

function CoachNutrition() {
  const withNutrition = coachRoster.filter((r) => r.packageId && PACKAGES[r.packageId].includes.nutrition);
  return (
    <AppShell mode="coach" userName="سارا موسوی" userRole="مربی">
      <PageHeader eyebrow="تغذیه" title="ورزشکاران با بسته تغذیه" description="پایبندی پایین‌تر از ۶۰٪ یعنی احتمالاً برنامه باید ساده‌تر شود." actions={<MockBadge label="نسخه نمایشی" />} />
      <div className="grid gap-3 md:grid-cols-2">{withNutrition.map((r) => {
        const n = r.nutritionAdherence ?? 0;
        return (
          <Panel key={r.athlete.id}>
            <div className="flex items-start justify-between gap-2"><div><div className="font-bold">{r.athlete.identity.firstName} {r.athlete.identity.lastName}</div><div className="text-xs text-muted-foreground">{SPORTS[r.athlete.primarySport].name} · {r.goal}</div></div><Pill>{PACKAGES[r.packageId!].name}</Pill></div>
            <div className="mt-4 flex justify-between text-xs"><span>پایبندی تغذیه</span><span className={`num font-bold ${n < 0.6 ? "text-warning" : "text-success"}`}>{Math.round(n * 100)}٪</span></div>
            <Bar value={n} className="mt-1.5" color={n < 0.6 ? "var(--warning)" : "var(--success)"} />
            <Button asChild size="sm" variant="outline" className="mt-4"><Link to="/coach/assistant" search={{ athlete: r.athlete.id }}>پیش‌نویس تغذیه</Link></Button>
          </Panel>
        );
      })}</div>
    </AppShell>
  );
}

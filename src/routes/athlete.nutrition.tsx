import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Droplets } from "lucide-react";
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { MockBadge, PageHeader, Panel, Pill, SectionHeading, Stat } from "@/components/domain/primitives";
import { PackageNotice } from "@/components/domain/coaching";
import type { DayType } from "@/domain/types";
import { demoAthlete } from "@/mock/athlete";
import { nutritionService } from "@/services/nutrition/service";
import { subscriptionService } from "@/services/subscriptions/service";

export const Route = createFileRoute("/athlete/nutrition")({
  validateSearch: (s) => z.object({ pkg: z.enum(["training", "nutrition", "combined"]).optional() }).parse(s),
  head: () => ({ meta: [
    { title: "تغذیه — FitLytix" },
    { name: "description", content: "ساختار وعده‌ها، زمان‌بندی و آب متناسب با روز تمرین یا استراحت." },
    { property: "og:title", content: "تغذیه — FitLytix" },
    { property: "og:description", content: "ساختار وعده‌ها، زمان‌بندی و آب متناسب با روز تمرین یا استراحت." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: NutritionPage,
});

const DAY_LABEL: Record<DayType, string> = { hard: "روز سنگین", training: "روز تمرین", rest: "روز استراحت" };

function NutritionPage() {
  const { pkg } = Route.useSearch();
  const pack = subscriptionService.getPackage(demoAthlete.id, pkg);
  const [day, setDay] = useState<DayType>("training");
  const profile = nutritionService.getProfile(demoAthlete.id);
  const plan = nutritionService.getDailyPlan(demoAthlete.id, day);
  const adherence = nutritionService.adherence(demoAthlete.id);
  const [logged, setLogged] = useState(false);

  return (
    <AppShell mode="athlete" userName={`${demoAthlete.identity.firstName} ${demoAthlete.identity.lastName}`} userRole={`بسته ${pack.name}`}>
      <PageHeader eyebrow="تغذیه" title="امروز چی بخوریم؟" description="ساختار وعده‌ها و ایده‌ها؛ مقدار دقیق را مربی‌ات با تو تنظیم می‌کند." actions={<MockBadge label="نسخه نمایشی" />} />
      {!pack.includes.nutrition ? <PackageNotice included={false} what="nutrition" /> : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">{(Object.keys(DAY_LABEL) as DayType[]).map((d) => <Button key={d} size="sm" variant={day === d ? "default" : "outline"} onClick={() => setDay(d)}>{DAY_LABEL[d]}</Button>)}</div>
          {pack.includes.training && <p className="mb-4 text-xs text-muted-foreground">در بسته ترکیبی، نوع روز از برنامه تمرینی‌ات می‌آید.</p>}
          <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <Panel>
              <SectionHeading title={DAY_LABEL[day]} subtitle={plan.notes[0]} />
              <ol className="space-y-3">{plan.meals.map((m, i) => <li key={m.id} className="grid grid-cols-[28px_1fr] gap-3 rounded-xl bg-muted/40 p-3"><span className="num text-sm font-bold text-primary">{i + 1}</span><div><div className="flex flex-wrap items-center gap-2 text-sm font-bold">{m.title}<span className="text-[11px] font-normal text-muted-foreground">{m.timing}</span></div><p className="mt-1 text-sm leading-7">{m.idea}</p></div></li>)}</ol>
              {plan.notes.slice(1).map((n) => <p key={n} className="mt-3 text-xs text-warning">{n}</p>)}
            </Panel>
            <div className="space-y-4">
              <Panel><div className="flex items-center gap-3"><Droplets className="size-6 text-info" /><Stat label="آب امروز" value={plan.hydrationL} unit="لیتر" tone="info" /></div></Panel>
              <Panel><Stat label="پایبندی ۳ روز اخیر" value={adherence !== undefined ? `${Math.round(adherence * 100)}٪` : "—"} tone="success" />
                <Button className="mt-3 w-full" variant="outline" size="sm" disabled={logged} onClick={() => { nutritionService.addFeedback({ athleteId: demoAthlete.id, date: new Date().toISOString().slice(0, 10), adherence: 1, hunger: 3, energy: 4 }); setLogged(true); }}>{logged ? "ثبت شد (فقط همین نشست)" : "امروز طبق برنامه خوردم"}</Button>
              </Panel>
              {profile && <Panel><SectionHeading title="ترجیحات تو" /><div className="flex flex-wrap gap-1.5">{profile.likes.map((l) => <Pill key={l} color="var(--success)">{l}</Pill>)}{profile.dislikes.map((l) => <Pill key={l}>بدون {l}</Pill>)}{profile.allergies.map((l) => <Pill key={l} color="var(--destructive)">حساسیت: {l}</Pill>)}</div><p className="mt-3 text-[11px] text-muted-foreground">{profile.mealsPerDay} وعده در روز</p></Panel>}
            </div>
          </div>
          <p className="mt-4 text-[11px] text-muted-foreground">این ساختار پیشنهادی است و جای مشاوره پزشکی یا رژیم درمانی را نمی‌گیرد.</p>
        </>
      )}
    </AppShell>
  );
}

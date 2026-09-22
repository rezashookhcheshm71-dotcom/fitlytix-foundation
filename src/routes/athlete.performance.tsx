import { createFileRoute } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Bar, PageHeader, Panel, Pill, SectionHeading, Stat } from "@/components/domain/primitives";
import { PerformanceTrendChart, RecoveryBars } from "@/components/domain/charts";
import { performanceEngine } from "@/services/performance/engine";
import { demoAthlete, demoBenchmarks, demoPerformance, demoPRs, demoRecoveryHistory, demoSessions } from "@/mock/athlete";

export const Route = createFileRoute("/athlete/performance")({
  head: () => ({
    meta: [
      { title: "عملکرد — FitLytix" },
      { name: "description", content: "روند شاخص عملکرد، رکوردهای شخصی، بنچمارک‌ها و تاریخچه جلسات." },
      { property: "og:title", content: "عملکرد — FitLytix" },
      { property: "og:description", content: "روند شاخص عملکرد، رکوردهای شخصی، بنچمارک‌ها و تاریخچه جلسات." },
    ],
  }),
  component: PerformancePage,
});

function PerformancePage() {
  const name = `${demoAthlete.identity.firstName} ${demoAthlete.identity.lastName}`;
  const last = demoPerformance.at(-1)!;
  return (
    <AppShell mode="athlete" userName={name} userRole="CrossFit · پیشرفته">
      <PageHeader eyebrow="PERFORMANCE ENGINE" title="تحلیل عملکرد" description="حلقه عملکرد: تمرین ← بازخورد ← داده ← ریکاوری ← تحلیل ← اصلاح برنامه." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Panel><Stat label="Performance Index" value={last.performanceIndex} delta={performanceEngine.performanceDelta(demoPerformance)} tone="primary" /></Panel>
        <Panel><Stat label="Strength Index" value={last.strength} delta={8} tone="success" /></Panel>
        <Panel><Stat label="Engine Index" value={last.engine} delta={13} tone="info" /></Panel>
        <Panel><Stat label="حجم هفتگی" value={last.volume} unit="AU" delta={7} /></Panel>
      </div>

      <div className="mb-6 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Panel>
          <SectionHeading title="روند ۸ هفته" subtitle="Performance Index · Strength · Engine" />
          <PerformanceTrendChart data={demoPerformance} height={280} />
        </Panel>
        <Panel>
          <SectionHeading title="آمادگی هفته" subtitle="Readiness · 7 days" />
          <RecoveryBars data={demoRecoveryHistory} height={200} />
          <p className="mt-3 text-xs leading-6 text-muted-foreground">میانگین آمادگی ۷۲٪. دو روز زیر ۶۵٪ با خواب کمتر از ۶.۵ ساعت همبستگی دارد.</p>
        </Panel>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Panel>
          <SectionHeading title="رکوردهای شخصی" subtitle="Personal Records" />
          <ul className="divide-y divide-border/60">
            {demoPRs.map((pr) => {
              const gain = pr.previous ? (pr.unit === "sec" ? pr.previous - pr.value : pr.value - pr.previous) : 0;
              return (
                <li key={pr.id} className="flex items-center gap-3 py-3">
                  <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary"><Trophy className="size-4" /></span>
                  <div className="flex-1">
                    <div className="font-display text-sm font-semibold">{pr.exerciseName}</div>
                    <div className="num text-[11px] text-muted-foreground">{pr.date}</div>
                  </div>
                  <div className="text-end">
                    <div className="num text-base font-bold">{pr.unit === "sec" ? `${Math.floor(pr.value / 60)}:${String(pr.value % 60).padStart(2, "0")}` : pr.value} <span className="text-xs text-muted-foreground">{pr.unit === "sec" ? "" : pr.unit}</span></div>
                    <div className="num text-[11px] text-success">+{gain}{pr.unit === "sec" ? "s" : ` ${pr.unit}`}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
        <Panel>
          <SectionHeading title="بنچمارک WODها" subtitle="Benchmarks" />
          <ul className="divide-y divide-border/60">
            {demoBenchmarks.map((b) => (
              <li key={b.id} className="flex items-center gap-3 py-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm font-semibold">{b.name}</span>
                    <Pill color={b.rxOrScaled === "rx" ? "var(--primary)" : undefined}>{b.rxOrScaled.toUpperCase()}</Pill>
                  </div>
                  <div className="num text-[11px] text-muted-foreground">{b.date} · {b.type.replace("_", " ")}</div>
                </div>
                <div className="text-end">
                  <div className="num text-base font-bold">{b.result}</div>
                  <div className="num text-[11px] text-success">{b.delta}</div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel>
        <SectionHeading title="تاریخچه جلسات" subtitle="Workout Results & Feedback" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-[11px] text-muted-foreground">
              <tr className="text-start">
                <th className="py-2 text-start font-medium">تاریخ</th>
                <th className="py-2 text-start font-medium">جلسه</th>
                <th className="py-2 text-start font-medium">نتیجه</th>
                <th className="py-2 text-start font-medium">RPE</th>
                <th className="py-2 text-start font-medium">مدت</th>
                <th className="py-2 text-start font-medium">تکمیل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {demoSessions.map((s) => (
                <tr key={s.id}>
                  <td className="num py-3 text-xs text-muted-foreground">{s.date}</td>
                  <td className="py-3 font-display font-semibold">{s.title} {s.prAchieved && <Pill color="var(--primary)" className="ms-1">PR</Pill>}</td>
                  <td className="num py-3 font-bold">{s.score}</td>
                  <td className="num py-3">{s.rpe}</td>
                  <td className="num py-3">{s.durationMin}′</td>
                  <td className="py-3"><Bar value={s.blocksCompleted / s.totalBlocks} className="w-20" height={4} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </AppShell>
  );
}

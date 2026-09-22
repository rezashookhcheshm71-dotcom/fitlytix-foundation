import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, MessageSquare, Play } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { MockBadge, PageHeader, Panel, Pill } from "@/components/domain/primitives";
import { WorkoutBlockCard } from "@/components/domain/workout";
import { demoAthlete } from "@/mock/athlete";
import { demoProgram, todayWorkout } from "@/mock/program";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/athlete/program")({
  head: () => ({
    meta: [
      { title: "برنامه تمرینی — FitLytix" },
      { name: "description", content: "بلوک‌های تمرین امروز: گرم کردن، قدرت، موتور، WOD، مهارت و سرد کردن." },
      { property: "og:title", content: "برنامه تمرینی — FitLytix" },
      { property: "og:description", content: "بلوک‌های تمرین امروز: گرم کردن، قدرت، موتور، WOD، مهارت و سرد کردن." },
    ],
  }),
  component: ProgramPage,
});

const statusColor = { completed: "var(--success)", today: "var(--primary)", planned: "var(--muted-foreground)", skipped: "var(--destructive)" };

function ProgramPage() {
  const name = `${demoAthlete.identity.firstName} ${demoAthlete.identity.lastName}`;
  return (
    <AppShell mode="athlete" userName={name} userRole="CrossFit · پیشرفته">
      <PageHeader
        eyebrow={`${demoProgram.name} · هفته ${demoProgram.weekIndex}/${demoProgram.totalWeeks}`}
        title={todayWorkout.title}
        description={`${todayWorkout.focus} · تقریباً ${todayWorkout.estimatedMin} دقیقه`}
        actions={
          <>
            <Button variant="outline"><MessageSquare /> بازخورد به مربی</Button>
            <Button variant="hero" size="lg"><Play /> شروع جلسه</Button>
          </>
        }
      />

      {/* Week strip */}
      <div className="mb-6 overflow-x-auto">
        <ol className="flex min-w-max gap-2">
          {demoProgram.workouts.map((w) => {
            const c = statusColor[w.status];
            return (
              <li key={w.id} className={cn("w-40 rounded-2xl border p-3 transition-all", w.status === "today" ? "border-primary/50 bg-primary-soft" : "border-border bg-card")}>
                <div className="flex items-center justify-between">
                  <span className="num text-[10px] text-muted-foreground">{w.date}</span>
                  {w.status === "completed" ? <CheckCircle2 className="size-3.5 text-success" /> : <span className="size-2 rounded-full" style={{ background: c }} />}
                </div>
                <div className="mt-1 truncate font-display text-xs font-bold">{w.title}</div>
                <div className="text-[10px] text-muted-foreground">{w.focus}</div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <div className="grid gap-4 md:grid-cols-2">
          {todayWorkout.blocks.map((b) => (
            <div key={b.id} className={cn(b.type === "wod" && "md:col-span-2")}>
              <WorkoutBlockCard block={b} />
            </div>
          ))}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <Panel glass>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Session Intent</div>
            <p className="text-sm leading-7">هفته سوم بلوک انباشت قدرت. اولویت: کیفیت اسکوات با تمپو ثابت؛ WOD را با پیس یکنواخت بزن، نه سریع‌تر از هفته قبل.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Pill color="var(--block-strength)">Strength Focus</Pill>
              <Pill color="var(--block-engine)">Zone 3</Pill>
              <Pill>RPE 8</Pill>
            </div>
          </Panel>
          <Panel>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Program Adjustment</div>
            <ul className="space-y-2 text-xs leading-6 text-muted-foreground">
              <li>• حجم وزنه‌برداری این هفته ۱۰٪ کمتر (آمادگی ۷۸٪)</li>
              <li>• بلوک مهارت حلقه به ۲ جلسه/هفته افزایش یافت</li>
              <li>• Fran هفته آینده تکرار می‌شود برای بنچمارک</li>
            </ul>
            <MockBadge label="پیشنهاد موتور — نمایشی" className="mt-3" />
          </Panel>
        </aside>
      </div>
    </AppShell>
  );
}

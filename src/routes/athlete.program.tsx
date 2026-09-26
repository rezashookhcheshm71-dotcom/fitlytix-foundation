import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { CheckCircle2, MessageSquare, Play } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { MockBadge, PageHeader } from "@/components/domain/primitives";
import { WorkoutBlockCard } from "@/components/domain/workout";
import { demoAthlete } from "@/mock/athlete";
import { programDisplayService } from "@/services/program/service";
import { SPORTS, SPORT_LIST, EXPERIENCE_LABEL } from "@/domain/sports";
import type { ExperienceLevel, SportId } from "@/domain/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/athlete/program")({
  validateSearch: (search) =>
    z
      .object({
        sport: z.enum(["crossfit", "bodybuilding", "hyrox", "functional", "running"]).optional(),
        level: z.enum(["beginner", "intermediate", "advanced", "elite"]).optional(),
      })
      .parse(search),
  head: () => ({
    meta: [
      { title: "برنامه تمرینی — FitLytix" },
      {
        name: "description",
        content: "تمرین امروز با آموزش حرکت، جایگزین‌ها و پیشرفت بخش‌به‌بخش.",
      },
      { property: "og:title", content: "برنامه تمرینی — FitLytix" },
      {
        property: "og:description",
        content: "تمرین امروز با آموزش حرکت، جایگزین‌ها و پیشرفت بخش‌به‌بخش.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProgramPage,
});

function ProgramPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const sport: SportId = search.sport ?? demoAthlete.primarySport;
  const experience: ExperienceLevel = search.level ?? demoAthlete.experience;
  const { program, workout } = programDisplayService.getToday(sport, experience);
  const [activeBlock, setActiveBlock] = useState<string>();
  const [doneBlocks, setDoneBlocks] = useState<string[]>([]);
  const [sessionStarted, setSessionStarted] = useState(false);
  const completed = doneBlocks.filter((id) => workout.blocks.some((b) => b.id === id)).length;
  const currentBlock = workout.blocks.find((b) => b.id === activeBlock);
  const startSession = () => {
    setSessionStarted(true);
    const first = workout.blocks[0];
    if (first) {
      setActiveBlock(first.id);
      document
        .getElementById("workout-block-1")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  const changeBlock = (id: string) => {
    setSessionStarted(true);
    if (doneBlocks.includes(id)) {
      setDoneBlocks(doneBlocks.filter((item) => item !== id));
      setActiveBlock(id);
      return;
    }
    if (activeBlock === id) {
      const nextDone = [...doneBlocks, id];
      setDoneBlocks(nextDone);
      setActiveBlock(workout.blocks.find((b) => !nextDone.includes(b.id))?.id);
    } else setActiveBlock(id);
  };
  const name = `${demoAthlete.identity.firstName} ${demoAthlete.identity.lastName}`;
  return (
    <AppShell
      mode="athlete"
      userName={name}
      userRole={`${SPORTS[sport].nameFa} · ${EXPERIENCE_LABEL[experience]}`}
    >
      <PageHeader
        eyebrow={
          sport === "crossfit"
            ? `${program.name} · هفته ${program.weekIndex}/${program.totalWeeks}`
            : `${SPORTS[sport].nameFa} · برنامه نمایشی`
        }
        title="تمرین امروز"
        description={`${workout.title} · ${workout.focus}`}
        actions={
          <Button variant="hero" size="lg" onClick={startSession}>
            <Play /> {sessionStarted ? "ادامه جلسه" : "شروع جلسه"}
          </Button>
        }
      />
      <div className="mb-5 flex flex-wrap gap-2" aria-label="نمایش نمونه رشته و سطح">
        {SPORT_LIST.map((item) => (
          <Button
            key={item.id}
            size="sm"
            variant={sport === item.id ? "secondary" : "ghost"}
            onClick={() => {
              setActiveBlock(undefined);
              setDoneBlocks([]);
              setSessionStarted(false);
              navigate({
                to: "/athlete/program",
                search: { sport: item.id, level: experience },
                replace: true,
              });
            }}
          >
            {item.nameFa}
          </Button>
        ))}
        <select
          aria-label="سطح تجربه"
          value={experience}
          onChange={(event) => {
            setActiveBlock(undefined);
            setDoneBlocks([]);
            setSessionStarted(false);
            navigate({
              to: "/athlete/program",
              search: { sport, level: event.target.value as ExperienceLevel },
              replace: true,
            });
          }}
          className="rounded-md border border-border bg-secondary px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {(["beginner", "intermediate", "advanced", "elite"] as const).map((level) => (
            <option key={level} value={level}>
              {EXPERIENCE_LABEL[level]}
            </option>
          ))}
        </select>
      </div>
      <section className="mb-6 border-y border-border py-5" aria-label="پیشرفت جلسه">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-sm">
          <div className="min-w-0">
            <strong>{workout.focus}</strong>
            <p className="mt-1 text-muted-foreground">
              حدود {workout.estimatedMin} دقیقه · {workout.blocks.length} بخش
            </p>
          </div>
          <strong className="num text-xl text-primary">
            {completed}/{workout.blocks.length}
          </strong>
        </div>
        <div
          role="progressbar"
          aria-label="بخش‌های انجام‌شده"
          aria-valuenow={completed}
          aria-valuemin={0}
          aria-valuemax={workout.blocks.length}
          className="mt-4 flex h-2 gap-1 overflow-hidden rounded-full bg-muted"
        >
          {workout.blocks.map((b) => (
            <span
              key={b.id}
              className={cn(
                "h-full flex-1 transition-colors",
                doneBlocks.includes(b.id)
                  ? "bg-success"
                  : b.id === activeBlock
                    ? "bg-primary"
                    : "bg-secondary",
              )}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
          {completed === workout.blocks.length
            ? "همه بخش‌ها انجام شد"
            : currentBlock
              ? `در حال انجام: ${currentBlock.title}`
              : "آماده شروع"}{" "}
          · پیشرفت فعلاً فقط در همین صفحه می‌ماند.
        </p>
      </section>
      <div className="mb-6 overflow-x-auto">
        <ol className="flex min-w-max gap-2">
          {(sport === "crossfit" ? program.workouts : [workout]).map((w) => {
            return (
              <li
                key={w.id}
                className={cn(
                  "w-40 rounded-lg border p-3",
                  w.status === "today"
                    ? "border-primary/50 bg-primary-soft"
                    : "border-border bg-card",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="num text-[10px] text-muted-foreground">{w.date}</span>
                  {w.status === "completed" ? (
                    <CheckCircle2 className="size-3.5 text-success" />
                  ) : (
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        w.status === "today" ? "bg-primary" : "bg-muted-foreground",
                      )}
                    />
                  )}
                </div>
                <div className="mt-1 truncate font-display text-xs font-bold">{w.title}</div>
                <div className="text-[10px] text-muted-foreground">{w.focus}</div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="space-y-4">
        {workout.blocks.map((b, index) => (
          <div key={b.id}>
            <WorkoutBlockCard
              block={b}
              number={index + 1}
              experience={experience}
              sport={sport}
              status={doneBlocks.includes(b.id) ? "done" : b.id === activeBlock ? "active" : "idle"}
              onStatusChange={() => changeBlock(b.id)}
            />
          </div>
        ))}
      </div>
      <section className="mt-8 border-t border-border pt-6">
        <h2 className="text-lg font-bold">خلاصه جلسه</h2>
        <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
          {completed} بخش از {workout.blocks.length} بخش انجام شده ·{" "}
          {workout.blocks
            .filter((b) => doneBlocks.includes(b.id))
            .reduce((sum, b) => sum + b.durationMin, 0)}{" "}
          دقیقه از زمان تقریبی بخش‌ها
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {workout.blocks.find((b) => b.type === "cooldown")
            ? "سرد کردن را هم انجام بده تا جلسه کامل شود."
            : "پایان جلسه"}
        </p>
        <div className="mt-4 flex items-center gap-3">
          <Button variant="outline" disabled title="ثبت بازخورد در نسخه بعدی فعال می‌شود">
            <MessageSquare /> ثبت بازخورد
          </Button>
          <MockBadge label="ثبت بازخورد به‌زودی" />
        </div>
      </section>
    </AppShell>
  );
}

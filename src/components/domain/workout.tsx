import { useState } from "react";
import { BookOpen, Check, ChevronDown, Clock, Gauge, Play } from "lucide-react";
import type { ExperienceLevel, Skill, SportId, WorkoutBlock } from "@/domain/types";
import { getExerciseEducation } from "@/mock/exercise-education";
import { readableLoad, readableScheme, readableTempo } from "@/domain/workout-display";
import { Button } from "@/components/ui/button";
import { ExerciseGuide } from "./exercise-guide";
import { BLOCK_META } from "@/domain/sports";
import { cn } from "@/lib/utils";
import { Bar, Pill } from "./primitives";

export function WorkoutBlockCard({
  block,
  compact,
  number,
  experience = "advanced",
  sport = "crossfit",
  status,
  onStatusChange,
}: {
  block: WorkoutBlock;
  compact?: boolean;
  number?: number;
  experience?: ExperienceLevel;
  sport?: SportId;
  status?: "idle" | "active" | "done";
  onStatusChange?: () => void;
}) {
  const meta = BLOCK_META[block.type];
  const beginner = !compact && experience === "beginner";
  const [expanded, setExpanded] = useState<string | null>(null);
  const [guideId, setGuideId] = useState<string>();
  const guide = getExerciseEducation(guideId);
  return (
    <article
      id={number ? `workout-block-${number}` : undefined}
      className={cn(
        "card-surface overflow-hidden rounded-lg border-s-2 p-4 md:p-5",
        status === "done" && "opacity-75",
        status === "active" && "border-s-primary",
      )}
      style={{ borderInlineStartColor: status === "active" ? undefined : meta.cssVar }}
    >
      <header className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {number && (
              <span className="num font-bold text-primary">{String(number).padStart(2, "0")}</span>
            )}
            <span>{meta.fa}</span>
            {block.format && <Pill>{block.format}</Pill>}
          </div>
          <h3 className="mt-1 text-base font-bold text-foreground">{block.title}</h3>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">
            {beginner ? "هدف این بخش: " : ""}
            {block.intent}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" /> <span className="num">{block.durationMin}</span> دقیقه
          </span>
          {block.targetRpe && (
            <span
              className="inline-flex items-center gap-1"
              title="شدت تمرین از ۱ تا ۱۰؛ شدت ۸ یعنی حدود ۲ تکرار دیگر می‌توانستی انجام بدهی"
            >
              <Gauge className="size-3.5" /> {beginner ? "شدت" : "RPE"}{" "}
              <span className="num">{block.targetRpe}</span>
              {beginner && " از ۱۰"}
            </span>
          )}
        </div>
      </header>
      <ul className="space-y-2">
        {block.movements.map((m, i) => {
          const exercise = getExerciseEducation(m.exerciseId);
          const key = `${block.id}-${i}`;
          const open = expanded === key;
          const tempo = readableTempo(m.notes);
          return (
            <li key={key} className="rounded-md border border-border bg-secondary/40 p-3">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-semibold">
                      {beginner
                        ? exercise?.nameFa ||
                          (m.exerciseName === "Rest" ? "استراحت" : m.exerciseName)
                        : m.exerciseName}
                    </span>
                    {beginner && exercise?.nameFa && (
                      <span className="text-xs text-muted-foreground" dir="ltr">
                        {m.exerciseName}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-foreground">
                    <span className={cn(!beginner && "num")}>
                      {beginner ? readableScheme(m.scheme) : m.scheme}
                    </span>
                    {m.load && (
                      <span className="text-muted-foreground">
                        {" "}
                        · {beginner ? readableLoad(m) : m.load}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="min-h-11 min-w-11"
                  aria-label={`${open ? "بستن" : "جزئیات"} ${m.exerciseName}`}
                  aria-expanded={open}
                  onClick={() => setExpanded(open ? null : key)}
                >
                  <ChevronDown className={cn("transition-transform", open && "rotate-180")} />
                </Button>
              </div>
              {beginner && exercise && (
                <Button
                  variant="link"
                  size="sm"
                  className="mt-1 h-9 px-0"
                  onClick={() => setGuideId(exercise.id)}
                >
                  <BookOpen /> آموزش حرکت
                </Button>
              )}
              {open && (
                <div className="mt-3 space-y-2 border-t border-border pt-3 text-xs leading-6">
                  {tempo && <p>{beginner ? tempo : m.notes}</p>}
                  {m.scaling && (
                    <p>
                      <strong>اگر این حرکت برات سخته: </strong>
                      {m.scaling.replace(
                        "Tempo 31X1",
                        beginner ? "با سرعت کنترل‌شده" : "Tempo 31X1",
                      )}
                      {beginner &&
                        m.scaling.includes("Tempo 31X1") &&
                        `؛ ${readableTempo("tempo 31X1")}`}
                    </p>
                  )}
                  {exercise?.shortDescription && (
                    <p className="text-muted-foreground">{exercise.shortDescription}</p>
                  )}
                  {exercise && !beginner && (
                    <Button
                      variant="link"
                      size="sm"
                      className="h-9 px-0"
                      onClick={() => setGuideId(exercise.id)}
                    >
                      <BookOpen /> آموزش حرکت
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {onStatusChange && (
        <div className="mt-4 flex justify-end border-t border-border pt-3">
          <Button
            variant={status === "done" ? "outline" : status === "active" ? "default" : "secondary"}
            size="sm"
            className="min-h-11"
            onClick={onStatusChange}
          >
            {status === "done" ? (
              <>
                <Check /> انجام شد · بازگردانی
              </>
            ) : status === "active" ? (
              <>
                <Check /> انجام شد
              </>
            ) : (
              <>
                <Play /> شروع این بخش
              </>
            )}
          </Button>
        </div>
      )}
      <ExerciseGuide
        exercise={guide}
        sport={sport}
        open={Boolean(guideId)}
        onOpenChange={(open) => {
          if (!open) setGuideId(undefined);
        }}
      />
    </article>
  );
}

const statusMeta: Record<Skill["status"], { fa: string; color: string }> = {
  locked: { fa: "قفل", color: "var(--muted-foreground)" },
  learning: { fa: "در حال یادگیری", color: "var(--warning)" },
  consistent: { fa: "پایدار", color: "var(--info)" },
  mastered: { fa: "تسلط", color: "var(--success)" },
};

export function SkillRow({ skill, className }: { skill: Skill; className?: string }) {
  const s = statusMeta[skill.status];
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-sm font-semibold text-foreground">{skill.name}</span>
        <Pill color={s.color}>{s.fa}</Pill>
      </div>
      <Bar value={skill.progress} color={s.color} height={5} />
      {skill.nextMilestone && (
        <span className="text-[11px] text-muted-foreground">بعدی: {skill.nextMilestone}</span>
      )}
    </div>
  );
}

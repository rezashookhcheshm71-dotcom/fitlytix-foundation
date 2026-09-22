import { Clock, Gauge } from "lucide-react";
import type { Skill, WorkoutBlock } from "@/domain/types";
import { BLOCK_META } from "@/domain/sports";
import { cn } from "@/lib/utils";
import { Bar, Pill } from "./primitives";

export function WorkoutBlockCard({ block, compact }: { block: WorkoutBlock; compact?: boolean }) {
  const meta = BLOCK_META[block.type];
  return (
    <article
      className="card-surface relative overflow-hidden rounded-2xl p-5 transition-transform duration-300 hover:-translate-y-0.5"
      style={{ borderInlineStartWidth: 3, borderInlineStartColor: meta.cssVar }}
    >
      <div
        className="pointer-events-none absolute -end-10 -top-10 size-32 rounded-full opacity-20 blur-2xl"
        style={{ background: meta.cssVar }}
      />
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display text-[11px] font-bold uppercase tracking-widest" style={{ color: meta.cssVar }}>
              {meta.en}
            </span>
            {block.format && <Pill color={meta.cssVar}>{block.format}</Pill>}
          </div>
          <h3 className="mt-1 text-base font-bold text-foreground">{block.title}</h3>
          {!compact && <p className="mt-0.5 text-xs text-muted-foreground">{block.intent}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-[11px] text-muted-foreground">
          <span className="num inline-flex items-center gap-1">
            <Clock className="size-3" /> {block.durationMin}′
          </span>
          {block.targetRpe && (
            <span className="num inline-flex items-center gap-1">
              <Gauge className="size-3" /> RPE {block.targetRpe}
            </span>
          )}
        </div>
      </header>
      <ul className="divide-y divide-border/60">
        {block.movements.map((m, i) => (
          <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
            <span className="font-display text-sm font-semibold text-foreground">{m.exerciseName}</span>
            <span className="num text-sm text-muted-foreground">
              {m.scheme}
              {m.load && <span className="text-foreground"> · {m.load}</span>}
            </span>
            {m.scaling && !compact && (
              <span className="w-full text-[11px] text-muted-foreground">
                اسکیلینگ: <span className="font-display">{m.scaling}</span>
              </span>
            )}
          </li>
        ))}
      </ul>
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

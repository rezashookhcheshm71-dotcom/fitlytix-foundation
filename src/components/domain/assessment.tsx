import {
  Dumbbell,
  Flame,
  Footprints,
  Grid3x3,
  HeartPulse,
  Moon,
  Sparkles,
  Sunrise,
  Target,
  Timer,
  User,
  Weight,
  Wind,
  Activity,
  type LucideIcon,
} from "lucide-react";
import type { AssessmentAnswers, AssessmentField, AssessmentSection } from "@/domain/types";
import { BLOCK_META } from "@/domain/sports";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { Pill } from "./primitives";

const icons: Record<string, LucideIcon> = {
  User, Target, HeartPulse, Sunrise, Dumbbell, Wind, Flame, Sparkles, Weight, Moon, Footprints, Grid3x3, Timer, Activity,
};

export function StepIndicator({ steps, current }: { steps: { label: string }[]; current: number }) {
  return (
    <ol className="flex items-center gap-2">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.label} className="flex flex-1 items-center gap-2">
            <div className="flex flex-col gap-1.5 flex-1">
              <div className={cn("h-1.5 w-full rounded-full transition-colors", done ? "bg-primary" : active ? "bg-gradient-ember" : "bg-muted")} />
              <span className={cn("text-[11px] font-medium", active ? "text-foreground" : "text-muted-foreground")}>{s.label}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function AssessmentSectionCard({
  section,
  answers,
  onChange,
  index,
}: {
  section: AssessmentSection;
  answers: AssessmentAnswers;
  onChange: (id: string, v: AssessmentAnswers[string]) => void;
  index: number;
}) {
  const Icon = icons[section.icon] ?? Activity;
  const color = section.blockToken ? BLOCK_META[section.blockToken].cssVar : "var(--primary)";
  const answered = section.fields.filter((f) => {
    const v = answers[f.id];
    return v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
  }).length;

  return (
    <section
      className="card-surface animate-rise relative overflow-hidden rounded-2xl p-5 md:p-6"
      style={{ animationDelay: `${index * 60}ms`, borderInlineStartWidth: 3, borderInlineStartColor: color }}
    >
      <div className="pointer-events-none absolute -end-10 -top-10 size-40 rounded-full opacity-15 blur-3xl" style={{ background: color }} />
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-xl" style={{ background: `color-mix(in oklch, ${color} 16%, transparent)`, color }}>
            <Icon className="size-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold">{section.title}</h3>
              {section.titleEn && <span className="font-display text-[11px] font-semibold uppercase tracking-widest" style={{ color }}>{section.titleEn}</span>}
            </div>
            <p className="text-xs text-muted-foreground">{section.description}</p>
          </div>
        </div>
        <Pill color={answered === section.fields.length ? "var(--success)" : undefined}>
          <span className="num">{answered}/{section.fields.length}</span>
        </Pill>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        {section.fields.map((f) => (
          <FieldControl key={f.id} field={f} value={answers[f.id]} onChange={(v) => onChange(f.id, v)} color={color} />
        ))}
      </div>
    </section>
  );
}

function FieldControl({
  field,
  value,
  onChange,
  color,
}: {
  field: AssessmentField;
  value: AssessmentAnswers[string];
  onChange: (v: AssessmentAnswers[string]) => void;
  color: string;
}) {
  const labelEl = (
    <div className="mb-1.5 flex items-center justify-between">
      <label className="text-xs font-semibold text-foreground">{field.label}</label>
      <span className="flex items-center gap-1.5">
        {field.advancedOnly && <span className="text-[10px] font-semibold" style={{ color }}>ADV</span>}
        {field.unit && <span className="font-display text-[10px] text-muted-foreground">{field.unit}</span>}
      </span>
    </div>
  );

  if (field.type === "select") {
    return (
      <div>
        {labelEl}
        <div className="flex flex-wrap gap-1.5">
          {field.options?.map((o) => {
            const on = value === o;
            return (
              <button key={o} type="button" onClick={() => onChange(on ? undefined : o)}
                className={cn("rounded-lg border px-3 py-1.5 text-xs font-medium transition-all", on ? "border-transparent text-primary-foreground" : "border-border bg-muted/40 text-muted-foreground hover:text-foreground")}
                style={on ? { background: color } : undefined}>
                {o}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (field.type === "multiselect") {
    const arr = Array.isArray(value) ? value : [];
    return (
      <div className="sm:col-span-2">
        {labelEl}
        <div className="flex flex-wrap gap-1.5">
          {field.options?.map((o) => {
            const on = arr.includes(o);
            return (
              <button key={o} type="button" onClick={() => onChange(on ? arr.filter((x) => x !== o) : [...arr, o])}
                className={cn("rounded-lg border px-3 py-1.5 font-display text-xs font-medium transition-all", on ? "border-transparent" : "border-border bg-muted/40 text-muted-foreground hover:text-foreground")}
                style={on ? { background: `color-mix(in oklch, ${color} 22%, transparent)`, color, borderColor: color } : undefined}>
                {o}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (field.type === "scale") {
    const min = field.min ?? 1;
    const max = field.max ?? 10;
    const v = typeof value === "number" ? value : Math.round((min + max) / 2);
    return (
      <div>
        {labelEl}
        <div className="flex items-center gap-3" dir="ltr">
          <Slider min={min} max={max} step={1} value={[v]} onValueChange={([n]) => onChange(n)} className="flex-1" />
          <span className="num w-8 text-center text-sm font-bold" style={{ color }}>{v}</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      {labelEl}
      <Input
        dir={field.type === "text" ? undefined : "ltr"}
        inputMode={field.type === "number" || field.type === "load" ? "decimal" : undefined}
        placeholder={field.type === "time" ? "07:12" : field.hint ?? "—"}
        value={value === undefined ? "" : String(value)}
        onChange={(e) => onChange(field.type === "number" || field.type === "load" ? (e.target.value === "" ? undefined : Number(e.target.value)) : e.target.value)}
        className={cn("h-10 bg-muted/40", field.type !== "text" && "font-display")}
      />
    </div>
  );
}

export const ASSESSMENT_STEPS = [{ label: "عمومی" }, { label: "رشته" }, { label: "Fitness DNA" }, { label: "پلن" }];

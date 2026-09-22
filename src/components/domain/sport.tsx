import { Activity, Dumbbell, Flame, Footprints, Timer, type LucideIcon } from "lucide-react";
import type { Sport, SportId } from "@/domain/types";
import { cn } from "@/lib/utils";

const icons: Record<string, LucideIcon> = { Flame, Timer, Activity, Dumbbell, Footprints };

export function SportIcon({ sport, className }: { sport: Sport; className?: string }) {
  const Icon = icons[sport.icon] ?? Activity;
  return <Icon className={className} />;
}

export function SportCard({
  sport,
  selected,
  onSelect,
}: {
  sport: Sport;
  selected?: boolean;
  onSelect?: (id: SportId) => void;
}) {
  const color = `var(${sport.colorToken})`;
  return (
    <button
      type="button"
      onClick={() => onSelect?.(sport.id)}
      className={cn(
        "group relative flex w-full flex-col items-start overflow-hidden rounded-2xl border p-5 text-start transition-all duration-300",
        selected
          ? "border-transparent bg-card-elevated shadow-glow"
          : "border-border bg-card hover:-translate-y-0.5 hover:border-primary/30",
      )}
      style={selected ? { boxShadow: `0 0 0 1.5px ${color}, 0 16px 40px -16px ${color}` } : undefined}
    >
      <div
        className="pointer-events-none absolute -end-8 -top-8 size-32 rounded-full opacity-25 blur-2xl transition-opacity group-hover:opacity-40"
        style={{ background: color }}
      />
      <span
        className="mb-4 inline-flex size-11 items-center justify-center rounded-xl"
        style={{ background: `color-mix(in oklch, ${color} 18%, transparent)`, color }}
      >
        <SportIcon sport={sport} className="size-5" />
      </span>
      <span className="font-display text-lg font-bold text-foreground">{sport.name}</span>
      <span className="text-sm font-medium text-muted-foreground">{sport.nameFa}</span>
      <span className="mt-2 text-xs text-muted-foreground">{sport.tagline}</span>
      <span className="mt-4 text-[10px] font-semibold uppercase tracking-widest" style={{ color }}>
        {sport.assessmentSections.length} بخش ارزیابی
      </span>
    </button>
  );
}

export function SportBadge({ sport, className }: { sport: Sport; className?: string }) {
  const color = `var(${sport.colorToken})`;
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-display text-[11px] font-bold", className)}
      style={{ color, background: `color-mix(in oklch, ${color} 14%, transparent)` }}
    >
      <SportIcon sport={sport} className="size-3" />
      {sport.name}
    </span>
  );
}

import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, BatteryCharging, TrendingUp } from "lucide-react";
import type { CoachAthleteSummary } from "@/domain/types";
import { EXPERIENCE_LABEL, SPORTS } from "@/domain/sports";
import { cn } from "@/lib/utils";
import { Bar, ProgressRing } from "./primitives";
import { SportBadge } from "./sport";

export function Avatar({ name, className, color }: { name: string; className?: string; color?: string }) {
  const initials = name.trim().slice(0, 1);
  return (
    <span
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-foreground ring-1 ring-border",
        className,
      )}
      style={color ? { background: `color-mix(in oklch, ${color} 22%, var(--secondary))` } : undefined}
    >
      {initials}
    </span>
  );
}

const flagMeta = {
  attention: { label: "نیاز به توجه", icon: AlertTriangle, color: "var(--destructive)" },
  peak: { label: "اوج فرم", icon: TrendingUp, color: "var(--success)" },
  recovering: { label: "در ریکاوری", icon: BatteryCharging, color: "var(--warning)" },
} as const;

export function AthleteCard({ item }: { item: CoachAthleteSummary }) {
  const { athlete } = item;
  const sport = SPORTS[athlete.primarySport];
  const color = `var(${sport.colorToken})`;
  const name = `${athlete.identity.firstName} ${athlete.identity.lastName}`;
  const flag = item.flag ? flagMeta[item.flag] : null;
  return (
    <Link
      to="/coach/athlete/$id"
      params={{ id: athlete.id }}
      className="card-surface group relative flex flex-col gap-4 overflow-hidden rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30"
    >
      <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: color }} />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={name} color={color} className="size-11" />
          <div>
            <div className="font-bold text-foreground">{name}</div>
            <div className="mt-1 flex items-center gap-2">
              <SportBadge sport={sport} />
              <span className="text-[11px] text-muted-foreground">{EXPERIENCE_LABEL[athlete.experience]}</span>
            </div>
          </div>
        </div>
        <ProgressRing value={item.readiness} size={52} stroke={5} color={item.readiness > 70 ? "var(--success)" : item.readiness > 55 ? "var(--warning)" : "var(--destructive)"}>
          <span className="num text-xs font-bold">{item.readiness}</span>
        </ProgressRing>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <Metric label="شاخص عملکرد" value={item.performanceIndex} delta={item.trend} />
        <Metric label="پایبندی" value={`${Math.round(item.adherence * 100)}٪`} />
        <Metric label="آخرین جلسه" value={item.lastSession} small />
      </div>
      <Bar value={item.adherence} color={color} height={4} />

      <div className="flex items-center justify-between text-xs">
        <span className="truncate text-muted-foreground">
          بعدی: <span className="font-display text-foreground">{item.nextWorkout}</span>
        </span>
        {flag ? (
          <span className="inline-flex shrink-0 items-center gap-1 font-semibold" style={{ color: flag.color }}>
            <flag.icon className="size-3.5" /> {flag.label}
          </span>
        ) : (
          <ArrowLeft className="size-4 text-muted-foreground transition-transform group-hover:-translate-x-1" />
        )}
      </div>
    </Link>
  );
}

function Metric({ label, value, delta, small }: { label: string; value: React.ReactNode; delta?: number; small?: boolean }) {
  return (
    <div className="rounded-xl bg-muted/50 px-2 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={cn("num mt-0.5 font-bold text-foreground", small ? "text-xs" : "text-base")}>
        {value}
        {delta !== undefined && (
          <span className={cn("ms-1 text-[10px]", delta >= 0 ? "text-success" : "text-destructive")}>
            {delta >= 0 ? "▲" : "▼"}
            {Math.abs(delta)}
          </span>
        )}
      </div>
    </div>
  );
}

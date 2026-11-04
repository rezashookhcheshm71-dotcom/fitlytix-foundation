import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/* Surface ------------------------------------------------------------------ */
export function Panel({
  className,
  children,
  glass,
  variant = "base",
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  glass?: boolean;
  /**
   * Surface weight. A screen where every panel carries the same weight has no
   * hierarchy, which is most of why the product looked plain: 105 panels, all
   * outlined, all equal. `raised` is for the one panel carrying the headline
   * number, `quiet` for supporting detail that should recede. Padding is not part
   * of the variant, so callers still control density.
   */
  variant?: "base" | "raised" | "quiet";
}) {
  const surface = glass
    ? "glass"
    : variant === "raised"
      ? "surface-raised"
      : variant === "quiet"
        ? "surface-sunken"
        : "card-surface";
  return (
    <div className={cn("rounded-2xl p-5", surface, className)} {...rest}>
      {children}
    </div>
  );
}

/* Section heading ----------------------------------------------------------- */
export function SectionHeading({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: { label: string; to: string };
  className?: string | undefined;
}) {
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-4", className)}>
      <div>
        <h2 className="text-base font-bold text-foreground md:text-lg">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground md:text-sm">{subtitle}</p>}
      </div>
      {action && (
        <Link
          to={action.to}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          {action.label}
          <ArrowLeft className="size-3.5" />
        </Link>
      )}
    </div>
  );
}

/* Mock / engine label ------------------------------------------------------- */
export function MockBadge({
  label = "داده نمایشی",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground",
        className,
      )}
    >
      <Sparkles className="size-3" />
      {label}
    </span>
  );
}

/* Stat ---------------------------------------------------------------------- */
export function Stat({
  label,
  value,
  unit,
  delta,
  tone = "default",
  size = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  delta?: number;
  tone?: "default" | "primary" | "success" | "info" | "warning";
  /**
   * `hero` is the headline number of a screen. The previous ceiling was text-3xl
   * (30px) against a text-lg section heading, so the most important figure on a
   * page was barely larger than a label and nothing read as a focal point. Hero
   * goes to 60px: about 5:1 against the 11px label, which is how the category
   * leaders get their calm - one very large number, very little else around it.
   *
   * The label keeps normal tracking on purpose. Letter-spacing breaks the joins in
   * Persian script, so hierarchy here comes from size and colour alone.
   */
  size?: "default" | "hero";
  className?: string | undefined;
}) {
  const toneClass = {
    default: "text-foreground",
    primary: "text-primary",
    success: "text-success",
    info: "text-info",
    warning: "text-warning",
  }[tone];
  return (
    <div className={cn("flex flex-col", size === "hero" ? "gap-2" : "gap-1", className)}>
      <span
        className={cn(
          "font-medium text-muted-foreground",
          size === "hero" ? "text-xs" : "text-[11px]",
        )}
      >
        {label}
      </span>
      <div className="flex items-baseline gap-1.5">
        <span
          className={cn(
            "num font-bold",
            size === "hero"
              ? "text-5xl leading-[0.85] tracking-tight md:text-6xl"
              : "text-2xl leading-none md:text-3xl",
            toneClass,
          )}
        >
          {value}
        </span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
        {delta !== undefined && (
          <span
            className={cn(
              "num ms-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
              delta >= 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
            )}
          >
            {delta >= 0 ? "+" : ""}
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}

/* Progress ring ------------------------------------------------------------- */
export function ProgressRing({
  value,
  size = 96,
  stroke = 8,
  color = "var(--primary)",
  track = "oklch(1 0 0 / 8%)",
  children,
  className,
}: {
  value: number; // 0..100
  size?: number;
  stroke?: number;
  color?: string | undefined;
  track?: string;
  children?: ReactNode;
  className?: string | undefined;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(100, Math.max(0, value)) / 100) * c;
  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          className="animate-ring"
          style={{ ["--ring-circumference" as string]: c, filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/* Linear bar ---------------------------------------------------------------- */
export function Bar({
  value,
  color = "var(--primary)",
  className,
  height = 6,
}: {
  value: number; // 0..1
  color?: string | undefined;
  className?: string | undefined;
  height?: number;
}) {
  return (
    <div
      className={cn("w-full overflow-hidden rounded-full bg-muted", className)}
      style={{ height }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{
          width: `${Math.round(value * 100)}%`,
          background: color,
          boxShadow: `0 0 10px ${color}`,
        }}
      />
    </div>
  );
}

/* Pill ---------------------------------------------------------------------- */
export function Pill({
  children,
  color,
  className,
}: {
  children: ReactNode;
  color?: string | undefined;
  className?: string | undefined;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        !color && "bg-secondary text-secondary-foreground",
        className,
      )}
      style={
        color ? { color, background: `color-mix(in oklch, ${color} 14%, transparent)` } : undefined
      }
    >
      {children}
    </span>
  );
}

/* Page header --------------------------------------------------------------- */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
      <div className="animate-rise">
        {eyebrow && <div className="mb-2 text-xs font-semibold text-primary">{eyebrow}</div>}
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

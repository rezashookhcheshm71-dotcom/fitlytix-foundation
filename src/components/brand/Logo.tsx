import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex size-9 items-center justify-center rounded-xl bg-gradient-ember shadow-glow",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-5 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 14l4-8 4 12 4-10 3 6h3" />
      </svg>
    </span>
  );
}

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <Link to="/" className={cn("group inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {!compact && (
        <span className="font-display text-lg font-bold tracking-tight text-foreground">
          Fit<span className="text-primary">Lytix</span>
        </span>
      )}
    </Link>
  );
}

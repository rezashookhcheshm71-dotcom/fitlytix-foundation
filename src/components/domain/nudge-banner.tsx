/**
 * What the athlete should do next, derived from what did *not* happen.
 *
 * Deliberately quiet: at most a short list, no streak counters, no manufactured urgency.
 * Each line names the fact it is based on, so the athlete can disagree with it.
 */
import { AlertCircle, Info, ArrowLeft } from "lucide-react";
import type { Nudge } from "@/services/athlete/nudges";
import { Panel } from "@/components/domain/primitives";

export function NudgeBanner({
  nudges,
  onAction,
  className,
}: {
  nudges: Nudge[];
  onAction?: (() => void) | undefined;
  className?: string | undefined;
}) {
  if (nudges.length === 0) return null;

  return (
    <Panel className={className}>
      <ul className="space-y-3">
        {nudges.map((nudge) => {
          const isAction = nudge.severity === "action";
          const Icon = isAction ? AlertCircle : Info;
          return (
            <li key={nudge.code} className="flex items-start gap-3">
              <Icon
                className="mt-0.5 size-4 shrink-0"
                style={{ color: isAction ? "var(--warning)" : "var(--info)" }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{nudge.titleFa}</div>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">{nudge.bodyFa}</p>
                {onAction && (
                  <button
                    type="button"
                    onClick={onAction}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    {nudge.actionFa}
                    <ArrowLeft className="size-3" aria-hidden />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

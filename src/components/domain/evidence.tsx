// The single honest empty state (P37).
//
// One component for all three non-ok Slot statuses, so the copy, the icon and
// the visual weight of "we do not know" stay consistent across the product and
// cannot drift per screen. Law 1 requires an absent measurement to say what is
// missing; this is where that sentence lives.
//
// Styling follows src/lib/locale.ts: logical properties only (ps-/pe-/ms-/me-,
// text-start), never physical left/right, because the whole product is RTL.
import { AlertTriangle, CircleSlash, Info } from "lucide-react";
import type { Slot } from "@/domain/evidence";
import { cn } from "@/lib/utils";

/** Per-status copy and accent. Kept here so a wording change is one edit. */
const PRESENTATION = {
  missing: {
    title: "داده‌ای ثبت نشده",
    tone: "text-muted-foreground",
    border: "border-border",
    Icon: Info,
  },
  implausible: {
    // P25: label it «غیرِمعقول» wherever it is read, and never let it into an
    // average or a score. The value is shown because hiding it would destroy the
    // evidence needed to work out why it was recorded.
    title: "مقدارِ غیرِمعقول",
    tone: "text-warning",
    border: "border-warning/40",
    Icon: AlertTriangle,
  },
  no_reference: {
    title: "بدونِ مرجعِ معتبر",
    tone: "text-info",
    border: "border-info/40",
    Icon: CircleSlash,
  },
} as const;

export function EmptySlot({
  slot,
  label,
  className,
  compact = false,
}: {
  /** Only the non-ok statuses render anything; an ok slot renders nothing here. */
  slot: Slot<unknown>;
  /** What the missing thing is, e.g. «ضربانِ استراحت». */
  label: string;
  /** `| undefined` because exactOptionalPropertyTypes rejects passing an
   *  explicit undefined into a plain optional prop. */
  className?: string | undefined;
  /** Tighter variant for table cells and dense panels. */
  compact?: boolean | undefined;
}) {
  if (slot.status === "ok") return null;

  const view = PRESENTATION[slot.status];
  const Icon = view.Icon;

  return (
    <div
      className={cn(
        "rounded-xl border border-dashed bg-muted/30 text-start",
        view.border,
        compact ? "px-3 py-2" : "px-4 py-3",
        className,
      )}
      // The status is machine-readable so a survey script can count honest empty
      // states across the product without parsing Persian copy.
      data-slot-status={slot.status}
    >
      <div className="flex items-start gap-2">
        <Icon className={cn("mt-0.5 size-4 shrink-0", view.tone)} aria-hidden="true" />
        <div className="min-w-0">
          <div className={cn("text-xs font-bold", view.tone)}>
            {label} · {view.title}
          </div>
          <div className="mt-0.5 text-xs leading-5 text-muted-foreground">{slot.reason}</div>

          {slot.status === "implausible" && (
            <div className="num mt-1 text-sm font-bold text-foreground">
              {String(slot.value)}
              <span className="ms-2 text-[11px] font-normal text-muted-foreground">
                ثبت‌شده، در هیچ میانگین یا امتیازی وارد نمی‌شود
              </span>
            </div>
          )}

          {slot.status === "no_reference" && (
            <div className="num mt-1 text-sm font-bold text-foreground">{String(slot.value)}</div>
          )}

          {slot.status === "missing" && slot.hint && (
            <div className="mt-1 text-[11px] text-muted-foreground">{slot.hint}</div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Renders a value when present, otherwise the honest empty state.
 *
 * This is the shape most screens want: one call, and the empty state cannot be
 * forgotten because there is no branch left to write at the call site.
 */
export function SlotValue({
  slot,
  label,
  format,
  className,
  compact = false,
}: {
  slot: Slot<unknown>;
  label: string;
  /** Renders the value; defaults to String(). Never called for a missing slot. */
  format?: ((value: unknown) => string) | undefined;
  className?: string | undefined;
  compact?: boolean | undefined;
}) {
  if (slot.status === "ok") {
    return (
      <span className={cn("num", className)}>
        {format ? format(slot.value) : String(slot.value)}
      </span>
    );
  }
  return <EmptySlot slot={slot} label={label} className={className} compact={compact} />;
}

/**
 * Recovery panel, driven by real measurements (P35).
 *
 * This replaces a panel that was fabricated in three separate ways: a readiness
 * verdict hardcoded as «آماده» regardless of any data, an HRV value read straight
 * from demoRecovery, and a seven-bar history from demoRecoveryHistory. None of
 * those described the person looking at the screen.
 *
 * THE VERDICT IS THE INTERESTING PART. The old panel always said «آماده». A
 * readiness verdict needs a published basis for calling someone ready, and
 * src/lib/reference-ranges.ts establishes none for readiness, HRV or sleep - those
 * are explicitly NOT_ESTABLISHED or uncovered. So this component shows the real
 * numbers and declines to grade them. Withholding a judgement is not the same as
 * having no data: the measurement is displayed, only the label is not earned.
 *
 * Where nothing was ever recorded, the shared EmptySlot says so.
 */
import type { ReactNode } from "react";
import { Activity, Moon, Zap } from "lucide-react";

import { EmptySlot } from "@/components/domain/evidence";
import { valueSlotFor, type AthleteHealth, type MetricRow } from "@/lib/athlete-health";

const nf = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 });

/** The three metrics this panel speaks about, in display order. */
const RECOVERY_METRICS = [
  { type: "hrv", Icon: Activity, label: "HRV" },
  { type: "sleep_duration", Icon: Moon, label: "خواب" },
  { type: "readiness", Icon: Zap, label: "آمادگی" },
] as const;

function Note({ children, tone }: { children: ReactNode; tone?: string | undefined }) {
  return <p className={`text-xs leading-6 ${tone ?? "text-muted-foreground"}`}>{children}</p>;
}

export function RecoverySnapshot({ health }: { health: AthleteHealth }) {
  if (health.state === "loading") {
    return <Note>در حالِ خواندنِ داده‌یِ ریکاوری…</Note>;
  }

  if (health.state === "unauthenticated") {
    return (
      <Note>
        برایِ دیدنِ ریکاوری وارد شو. تا وارد نشوی عددی نشان نمی‌دهیم - نه از خودت، نه از یک ورزشکارِ
        نمونه.
      </Note>
    );
  }

  if (health.state === "error") {
    return (
      <Note tone="text-destructive">
        {health.failure || "خواندنِ داده‌یِ ریکاوری ممکن نشد."} این خطایِ اتصال است، نه اینکه
        داده‌ای نداری.
      </Note>
    );
  }

  const byType = new Map(health.metrics.map((m) => [m.metricType, m]));
  const recorded = RECOVERY_METRICS.filter((m) => {
    const row = byType.get(m.type);
    return row !== undefined && row.status !== "NO_DATA";
  }).length;

  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        {RECOVERY_METRICS.map(({ type, Icon, label }) => {
          const row: MetricRow | undefined = byType.get(type);
          const slot = row ? valueSlotFor(row) : undefined;
          return (
            <div key={type} className="surface-sunken rounded-xl p-2.5">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Icon className="size-3.5" aria-hidden />
                {label}
              </div>
              <div
                className="num mt-1 text-sm font-bold"
                data-slot-status={slot?.status ?? "missing"}
              >
                {slot?.status === "ok" ? slot.value : "—"}
              </div>
              {slot && <EmptySlot slot={slot} label={label} compact />}
              {row && row.status === "INSUFFICIENT_POINTS" && (
                <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                  یک ثبت - روند ندارد
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* The panel used to assert «آماده» unconditionally. No published basis
          exists for grading readiness, HRV or sleep, so no grade is given. */}
      <div className="mt-3" data-recovery-verdict="withheld">
        {recorded === 0 ? (
          <Note>
            هیچ‌کدام از این سه داده ثبت نشده. بدونِ آن‌ها نه آمادگی قابلِ گفتن است، نه وضعیتِ
            ریکاوری - و ما هم از خودمان در نمی‌آوریم.
          </Note>
        ) : (
          <Note>
            {nf.format(recorded)} مورد از سه داده ثبت شده است.{" "}
            <span className="font-semibold">قضاوتی درباره‌یِ «آماده» بودن نشان نمی‌دهیم</span> چون
            هنوز محدوده‌یِ مرجعِ معتبری برایِ آمادگی، HRV و خواب تأسیس نشده؛ عددِ واقعی را می‌بینی،
            برچسبِ بی‌مبنا را نه.
          </Note>
        )}
      </div>
    </div>
  );
}

/**
 * Real health trends (P35).
 *
 * This panel replaces the fabricated 7-day series the demo showed. It reads
 * GET /api/athlete/health, which resolves identity from the session server-side,
 * and renders one honest state per metric.
 *
 * The distinction that matters is between a missing VALUE and a missing TREND:
 *
 * - A metric measured once has a real value and no trend. The value is shown, and
 *   only the trend claim is withheld, with the exact number of further entries
 *   needed. This mirrors P37's rule that the number stays while the judgement is
 *   withheld - withholding both would hide evidence that genuinely exists.
 * - A metric never measured has no value either, and gets the shared EmptySlot.
 *
 * Excluded points are counted and named (P40's fourth obligation: report every
 * exclusion), so a trend drawn from fewer points than were stored says so.
 *
 * Styling follows src/lib/locale.ts: logical properties only, never physical
 * left/right, because the whole product is RTL.
 */

import { EmptySlot } from "@/components/domain/evidence";
import { Panel, SectionHeading } from "@/components/domain/primitives";
import {
  DIRECTION_VIEW,
  nf,
  valueSlotFor,
  type AthleteHealth,
  type MetricRow,
} from "@/lib/athlete-health";

export function HealthTrendsPanel({
  health,
  className,
}: {
  /**
   * Loaded by the calling screen and passed in, rather than fetched here. The
   * dashboard was already calling useAthleteHealth at route level AND inside this
   * panel, so it hit /api/athlete/health twice per load; the health page would have
   * made it three once it also showed the slideshow. Bumping the caller's `version`
   * still refetches, so the refresh control below works exactly as before.
   */
  health: AthleteHealth;
  className?: string | undefined;
}) {
  const { state, metrics, summary, failure, reload, demo: showingDemo } = health;

  return (
    <Panel className={className}>
      {showingDemo && (
        <p
          data-demo-health="design-preview"
          className="mb-3 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-[11px] font-medium leading-5 text-warning"
        >
          حالتِ نمونه — این عددها واقعی نیستند و برای دیدنِ طراحی نشان داده می‌شوند.
        </p>
      )}
      {/* SectionHeading's `action` prop renders a Link, so the refresh control
          lives beside it rather than inside it - widening that shared prop would
          ripple into every other screen that uses it. */}
      <div className="flex items-start justify-between gap-4">
        <SectionHeading
          title="روندها"
          // The subtitle promises the numbers are real, which stops being true in
          // preview mode, so it has to change with the data rather than stay fixed.
          subtitle={
            showingDemo
              ? "داده‌یِ نمونه برای دیدنِ طراحی — عددِ واقعی نیست"
              : "از ثبت‌هایِ واقعیِ خودت، نه داده‌یِ نمونه"
          }
          className="mb-0"
        />
        <button
          type="button"
          onClick={() => void reload()}
          className="shrink-0 text-xs font-semibold text-primary underline-offset-4 hover:underline"
        >
          نوسازی
        </button>
      </div>
      <div className="mb-4" />

      {state === "loading" && (
        <p className="py-6 text-center text-sm text-muted-foreground">در حالِ خواندنِ داده‌ها…</p>
      )}

      {state === "unauthenticated" && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
          <p className="font-semibold">برایِ دیدنِ روندها وارد شو</p>
          <p className="mt-1 text-xs text-muted-foreground">
            داده‌یِ سلامت به حسابِ کاربری گره خورده است. بدونِ ورود، چیزی برایِ نشان دادن وجود ندارد
            و ما هم داده‌یِ کسی را جایِ داده‌یِ تو جا نمی‌زنیم.
          </p>
        </div>
      )}

      {state === "error" && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-semibold text-destructive">{failure}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            این یک خطایِ خواندن است، نه «داده‌ای نداری». دوباره تلاش کن.
          </p>
        </div>
      )}

      {state === "ready" && (
        <>
          {summary && (
            <p className="mb-3 text-xs text-muted-foreground" data-trend-summary>
              از {nf.format(summary.totalMetricTypes)} نوع داده،{" "}
              <span className="font-semibold text-foreground">{nf.format(summary.withTrend)}</span>{" "}
              مورد روندِ قابلِ نمایش دارد و{" "}
              <span className="font-semibold text-foreground">
                {nf.format(summary.withoutTrend)}
              </span>{" "}
              مورد هنوز نه.
            </p>
          )}

          <ul className="space-y-2">
            {metrics.map((row) => {
              const slot = valueSlotFor(row);
              const excludedCount = row.trend?.excluded.length ?? 0;
              return (
                <li
                  key={row.metricType}
                  className="surface-sunken rounded-xl p-3"
                  data-metric-status={row.status}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold">{row.label}</span>
                    <span className="num text-sm font-bold" data-slot-status={slot.status}>
                      {slot.status === "ok" ? slot.value : "—"}
                    </span>
                  </div>

                  {/* The shared honest empty state, rendered only when there is no
                      real reading at all. */}
                  <EmptySlot slot={slot} label={row.label} compact />

                  {slot.status === "ok" && row.status === "ESTABLISHED" && row.trend && (
                    <TrendLine row={row} excludedCount={excludedCount} />
                  )}

                  {slot.status === "ok" && row.status === "INSUFFICIENT_POINTS" && (
                    <p className="mt-1 text-xs text-muted-foreground" data-trend-pending>
                      یک بار ثبت شده. برایِ دیدنِ روند{" "}
                      <span className="font-semibold text-foreground">
                        {nf.format(row.pointsNeeded)}
                      </span>{" "}
                      ثبتِ دیگر لازم است — چون از یک نقطه نمی‌توان جهت گرفت و ما هم نقطه‌یِ دوم را
                      از خودمان در نمی‌آوریم.
                    </p>
                  )}

                  {excludedCount > 0 && row.status !== "ESTABLISHED" && (
                    <p className="mt-1 text-xs text-warning">
                      {nf.format(excludedCount)} ثبت به‌دلیلِ غیرِمعقول بودن از محاسبه بیرون گذاشته
                      شد.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          {metrics.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              هیچ نوع داده‌ای برایِ نمایش وجود ندارد.
            </p>
          )}
        </>
      )}
    </Panel>
  );
}

/** The trend claim itself: direction, change, and the real span it covers. */
function TrendLine({ row, excludedCount }: { row: MetricRow; excludedCount: number }) {
  const trend = row.trend;
  if (!trend || trend.direction === null) return null;
  const view = DIRECTION_VIEW[trend.direction];
  const Icon = view.Icon;

  const parts: string[] = [view.label];
  if (trend.change !== null)
    parts.push(`${trend.change > 0 ? "+" : ""}${nf.format(trend.change)} ${row.unit}`);
  if (trend.changePct !== null) parts.push(`${nf.format(trend.changePct)}٪`);
  if (trend.spanDays !== null) parts.push(`در ${nf.format(trend.spanDays)} روز`);

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span
        className={`inline-flex items-center gap-1 font-semibold ${view.tone}`}
        data-trend-direction={trend.direction}
      >
        <Icon className="size-3.5" aria-hidden />
        {parts.join(" · ")}
      </span>
      {trend.changePct === null && trend.change !== null && (
        <span className="text-muted-foreground" title="مقدارِ نخست صفر بوده، پس درصد معنا ندارد">
          درصد قابلِ محاسبه نیست
        </span>
      )}
      {excludedCount > 0 && (
        <span className="text-warning" data-trend-excluded={excludedCount}>
          {nf.format(excludedCount)} ثبتِ غیرِمعقول بیرون گذاشته شد
        </span>
      )}
    </div>
  );
}

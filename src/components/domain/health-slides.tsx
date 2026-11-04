import { CarouselSlide, type CarouselSlideItem } from "@/components/domain/carousel";
import {
  nf,
  type AthleteHealth,
  type LoadState,
  type MetricRow,
  type RecentRow,
} from "@/lib/athlete-health";

/**
 * P27 — the health tab's own slideshow.
 *
 * Four slideshows now exist and the brief forbids copying the performance tab, so
 * each has to answer a different question. Performance asks where a measured value
 * sits against a published range. The dashboard summarises and flags. Recovery keeps
 * a ledger of where each number in a derived grade came from. The health tab is the
 * place data ENTERS the product, so its question is different again: how much
 * evidence exists for each metric, and how much is still missing.
 *
 * That gives this file its distinctive visual - an evidence meter counting readings
 * against the number the trend rule requires - which none of the other three use.
 * The spec asks directly for it: until there is enough real data the slot should be
 * an honest empty one saying what is missing, never a fabricated number.
 *
 * Nothing here invents a value. Every number comes from the payload or the recent
 * records, and each load state renders its own honest face rather than a guess.
 */

const STATUS_VIEW: Record<MetricRow["status"], { label: string; pip: string; text: string }> = {
  ESTABLISHED: { label: "روند برقرار است", pip: "bg-success", text: "text-success" },
  INSUFFICIENT_POINTS: {
    label: "سنجیده شده ولی برایِ روند کم است",
    pip: "bg-warning",
    text: "text-warning",
  },
  NO_DATA: {
    label: "هرگز سنجیده نشده",
    pip: "bg-muted-foreground/30",
    text: "text-muted-foreground",
  },
};

function SlideShell({
  id,
  title,
  note,
  children,
}: {
  /** Stable hook value. Headings are copy and get reworded; selectors must not. */
  id: string;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex h-full flex-col gap-4 p-6 sm:p-8" data-health-slide={id}>
      <header>
        <h3 className="text-lg font-bold tracking-tight">{title}</h3>
        {note && <p className="mt-1 text-xs leading-6 text-muted-foreground">{note}</p>}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

/**
 * Readings held against readings required. Rendered as pips rather than a bar
 * because the counts are small integers and a bar would hide the exact shortfall,
 * which is the whole point of the slide.
 */
function EvidenceMeter({ row }: { row: MetricRow }) {
  const needed = row.pointsNeeded;
  const have = row.pointCount;
  const filled = Math.min(have, needed);
  const view = STATUS_VIEW[row.status];
  return (
    <div className="flex items-center gap-2" data-evidence-status={row.status}>
      <div className="flex items-center gap-1" aria-hidden="true">
        {Array.from({ length: needed }, (_, i) => (
          <span
            key={i}
            className={`size-2.5 rounded-full ${i < filled ? view.pip : "bg-muted-foreground/15"}`}
          />
        ))}
      </div>
      <span className="num text-[11px] text-muted-foreground">
        {nf.format(have)} از {nf.format(needed)}
      </span>
      {have > needed && (
        <span className="num rounded-full bg-muted px-1.5 text-[10px] font-semibold">
          +{nf.format(have - needed)}
        </span>
      )}
    </div>
  );
}

export function HealthSlideshow({
  health,
  recent,
  recentState,
  className,
}: {
  health: AthleteHealth;
  recent: RecentRow[];
  recentState: LoadState;
  className?: string | undefined;
}) {
  const { state, metrics, summary, failure, demo } = health;

  if (state !== "ready") {
    // One slide stating what applies, rather than four slides built on nothing.
    const message =
      state === "loading"
        ? "در حالِ خواندنِ داده‌یِ سلامت…"
        : state === "unauthenticated"
          ? "برایِ دیدنِ داده‌یِ سلامت لازم است وارد شوی."
          : failure || "خواندنِ داده‌یِ سلامت ممکن نشد.";
    return (
      <CarouselSlide
        slides={[
          {
            id: "unavailable",
            content: (
              <SlideShell id="unavailable" title="داده‌ای برایِ نمایش نیست">
                <p className="text-sm leading-7 text-muted-foreground" data-health-state={state}>
                  {message}
                </p>
              </SlideShell>
            ),
          },
        ]}
        autoMs={0}
        label="نمایشِ اسلایدیِ سلامت"
        className={className}
      />
    );
  }

  const withTrend = metrics.filter((m) => m.status === "ESTABLISHED");
  const short = metrics.filter((m) => m.status === "INSUFFICIENT_POINTS");
  const none = metrics.filter((m) => m.status === "NO_DATA");

  const slides: CarouselSlideItem[] = [
    {
      id: "coverage",
      content: (
        <SlideShell
          id="coverage"
          title="چه بخشی از تو سنجیده شده"
          note={
            demo
              ? "حالتِ نمونه — این عددها واقعی نیستند و برایِ دیدنِ طراحی نشان داده می‌شوند."
              : "شمارِ سنجه‌هایی که دستِ‌کم یک روندِ برقرار دارند، از کلِ انواعی که محصول می‌شناسد."
          }
        >
          <div className="flex flex-col gap-4">
            <div
              className="flex h-3 w-full overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`از ${nf.format(summary?.totalMetricTypes ?? metrics.length)} نوعِ سنجه، ${nf.format(withTrend.length)} روندِ برقرار دارد`}
              data-coverage-track
            >
              <div
                className="h-full bg-success"
                style={{
                  width: `${metrics.length ? (withTrend.length / metrics.length) * 100 : 0}%`,
                }}
              />
              <div
                className="h-full bg-warning"
                style={{
                  width: `${metrics.length ? (short.length / metrics.length) * 100 : 0}%`,
                }}
              />
            </div>
            <ul className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  ["روندِ برقرار", withTrend.length, "text-success"],
                  ["سنجیده، ناکافی", short.length, "text-warning"],
                  ["هرگز سنجیده نشده", none.length, "text-muted-foreground"],
                ] as const
              ).map(([label, count, tone]) => (
                <li key={label} className="rounded-2xl border border-border bg-card/40 p-4">
                  <p className={`num text-3xl font-bold ${tone}`}>{nf.format(count)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{label}</p>
                </li>
              ))}
            </ul>
            {summary && (
              <p className="num text-[11px] text-muted-foreground" data-coverage-summary>
                سرور می‌گوید {nf.format(summary.totalMetricTypes)} نوعِ سنجه شناخته شده است؛{" "}
                {nf.format(summary.withTrend)} روند دارد و {nf.format(summary.withoutTrend)} ندارد.
              </p>
            )}
          </div>
        </SlideShell>
      ),
    },
    {
      id: "evidence",
      content: (
        <SlideShell
          id="evidence"
          title="چقدر مدرک برایِ هر سنجه هست"
          note="قاعده‌یِ روند به دو ثبت نیاز دارد؛ یک ثبت روند نیست. اینجا شمارِ واقعیِ ثبت‌ها کنارِ همان آستانه آمده."
        >
          <ul className="flex flex-col gap-2">
            {metrics.map((row) => (
              <li
                key={row.metricType}
                data-metric-status={row.status}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/40 px-3 py-2.5"
              >
                <span className="text-xs font-semibold">{row.label}</span>
                <EvidenceMeter row={row} />
                <span className={`text-[11px] ${STATUS_VIEW[row.status].text}`}>
                  {STATUS_VIEW[row.status].label}
                </span>
              </li>
            ))}
          </ul>
        </SlideShell>
      ),
    },
    {
      id: "recent",
      content: (
        <SlideShell
          id="recent"
          title="آخرین ثبت‌ها"
          note="هر ردیف یک رکوردِ جدا در پایگاهِ داده است، با منبع و زمانِ خودش. ثبتِ ردشده پنهان نمی‌شود."
        >
          {recentState === "ready" && recent.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {recent.map((r, i) => (
                <li
                  key={`${r.metricType}-${r.at}-${i}`}
                  data-recent-excluded={r.excluded ? "yes" : "no"}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5 ${
                    r.excluded
                      ? "border-destructive/40 bg-destructive/5"
                      : "border-border bg-card/40"
                  }`}
                >
                  <span className="text-xs font-semibold">{r.label}</span>
                  <span className="num text-xs">
                    {r.value === null ? "بدونِ مقدار" : `${nf.format(r.value)} ${r.unit}`}
                  </span>
                  <span className="num text-[11px] text-muted-foreground">
                    {r.at.slice(0, 10)} · {r.source ?? "منبعِ نامشخص"}
                  </span>
                  {r.excluded && (
                    <span className="text-[10px] font-semibold text-destructive">
                      از روند کنار گذاشته شد
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm leading-7 text-muted-foreground" data-recent-state={recentState}>
              {recentState === "loading"
                ? "در حالِ خواندنِ آخرین ثبت‌ها…"
                : recentState === "unauthenticated"
                  ? "بدونِ ورود، ثبتی برایِ نشان دادن وجود ندارد."
                  : recentState === "error"
                    ? "خواندنِ آخرین ثبت‌ها ممکن نشد."
                    : "هنوز هیچ ثبتی در پایگاهِ داده نیست."}
            </p>
          )}
        </SlideShell>
      ),
    },
    {
      id: "missing",
      content: (
        <SlideShell
          id="missing"
          title="چه چیزی کم است"
          note="برایِ هر سنجه‌یِ ناتمام، دقیقاً همان تعدادِ ثبتی که تا برقراریِ روند فاصله است. عددِ جانشین گذاشته نمی‌شود."
        >
          {short.length + none.length === 0 ? (
            <p className="text-sm leading-7 text-success" data-missing-count="0">
              هر سنجه‌ای که اینجا شناخته شده دستِ‌کم یک روندِ برقرار دارد.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {[...short, ...none].map((row) => {
                const gap = Math.max(0, row.pointsNeeded - row.pointCount);
                return (
                  <li
                    key={row.metricType}
                    data-missing-metric={row.metricType}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border px-3 py-2.5"
                  >
                    <span className="text-xs font-semibold">{row.label}</span>
                    <span className="num text-[11px] text-muted-foreground">
                      {row.pointCount === 0
                        ? `هیچ ثبتی نیست — ${nf.format(gap)} ثبتِ دیگر لازم است`
                        : `${nf.format(row.pointCount)} ثبت هست — ${nf.format(gap)} ثبتِ دیگر تا روند`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </SlideShell>
      ),
    },
  ];

  return (
    <CarouselSlide
      slides={slides}
      autoMs={7000}
      label="نمایشِ اسلایدیِ سلامت"
      className={className}
    />
  );
}

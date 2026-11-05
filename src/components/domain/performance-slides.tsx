import { CarouselSlide, type CarouselSlideItem } from "@/components/domain/carousel";
import { Panel, ProgressRing, Stat } from "@/components/domain/primitives";
import {
  NO_REFERENCE,
  REFERENCE_RANGES,
  type MetricKey,
  type NoReferenceKey,
} from "@/lib/reference-ranges";
import { nf, type AthleteHealth, type MetricRow } from "@/lib/athlete-health";

/**
 * P25 - the performance tab's five slides (spec line 435).
 *
 * The spec fixes the shape: current view as rings, measured cards carrying a
 * "no reference" marker, a position bar conditional on reference + sex + age,
 * inconsistencies, and a trend slide that admits when nothing has happened. Data
 * comes from GET /api/athlete/health, keeping the newest of each type.
 *
 * Two of those five cannot produce a number today, and the spec also says what to do
 * in that case (line 650): an honest empty slot naming what is missing, never a
 * fabricated one. So:
 *
 *   - The rings cannot show position within a reference range, because that needs
 *     sex and age and neither is read from the database anywhere. They show evidence
 *     sufficiency instead - real, computable, and the thing that actually gates a
 *     performance claim. The centre carries the newest recorded value where one
 *     exists.
 *   - The position slide shows the published ranges themselves, with empty tracks,
 *     and states the two missing inputs by name.
 *   - The inconsistency slide cannot run for the same reason and says so.
 *
 * This is a different question from the other slideshows on purpose: recovery asks
 * where each number came from, health asks how much evidence exists, and this one
 * asks what can legitimately be claimed about performance right now.
 */

/**
 * The two metric types the spec deliberately excludes from scoring. Derived from
 * NO_REFERENCE rather than retyped, and normalised to both spellings because the
 * health API uses snake_case metricType while reference-ranges uses camelCase keys -
 * one source of truth, two surface forms.
 */
const NO_REFERENCE_TYPES = new Set(
  Object.keys(NO_REFERENCE).flatMap((k) => [k, k.replace(/([A-Z])/g, "_$1").toLowerCase()]),
);

/** Snake_case API metricType back to the camelCase NO_REFERENCE key. */
function noRefKeyOf(metricType: string): NoReferenceKey {
  const camel = metricType.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase());
  return (camel in NO_REFERENCE ? camel : metricType) as NoReferenceKey;
}

/**
 * The published ranges, read straight out of REFERENCE_RANGES so this slide cannot
 * drift from the single source of truth. Shown with empty tracks: the ranges are
 * real published data, but a position inside them is not computable without sex and
 * age, so no bar is drawn. Where a range depends on sex, both published variants are
 * shown rather than one silently standing in for both.
 */
const POSITION_ROWS = (Object.keys(REFERENCE_RANGES) as MetricKey[]).map((key) => {
  const entry = REFERENCE_RANGES[key];
  const range = entry.range;
  const bySex = entry.bySex;
  return {
    label: entry.label,
    needsSex: range === null,
    text: range
      ? `${nf.format(range.min)}–${nf.format(range.max)}`
      : bySex
        ? `مرد ${nf.format(bySex.male.min)}–${nf.format(bySex.male.max)} · زن ${nf.format(
            bySex.female.min,
          )}–${nf.format(bySex.female.max)}`
        : "بازه به جنسیت وابسته است",
  };
});

function SlideShell({
  id,
  eyebrow,
  title,
  note,
  children,
}: {
  /** Stable hook value. Headings are copy and get reworded; selectors must not. */
  id: string;
  eyebrow: string;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex h-full flex-col gap-4 p-6 sm:p-8" data-performance-slide={id}>
      <header>
        <p className="num text-[10px] font-bold text-primary">{eyebrow}</p>
        <h3 className="mt-1 text-lg font-bold tracking-tight">{title}</h3>
        {note && <p className="mt-1 text-xs leading-6 text-muted-foreground">{note}</p>}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

/** One ring per metric: how much of the required record exists, and the newest value. */
function EvidenceRing({ row }: { row: MetricRow }) {
  const complete = row.pointsNeeded > 0 ? (row.pointCount / row.pointsNeeded) * 100 : 0;
  const last = row.trend?.last;
  return (
    <div className="flex flex-col items-center gap-2" data-ring-status={row.status}>
      <ProgressRing value={Math.min(100, complete)} size={104} stroke={7}>
        {last ? (
          <span className="num text-center text-sm font-bold leading-tight">
            {nf.format(last.value)}
            <span className="block text-[9px] font-normal text-muted-foreground">{row.unit}</span>
          </span>
        ) : (
          <span className="text-center text-[10px] leading-4 text-muted-foreground">
            ثبت
            <br />
            نشده
          </span>
        )}
      </ProgressRing>
      <span className="text-center text-[11px] text-muted-foreground">{row.label}</span>
    </div>
  );
}

export function PerformanceSlideshow({
  health,
  className,
}: {
  health: AthleteHealth;
  className?: string | undefined;
}) {
  const { state, metrics, failure, demo } = health;

  if (state !== "ready") {
    // One slide naming what applies, rather than five slides built on nothing.
    const message =
      state === "loading"
        ? "در حالِ خواندنِ داده‌یِ سلامت…"
        : state === "unauthenticated"
          ? "برایِ دیدنِ تحلیلِ عملکرد لازم است وارد شوی."
          : failure || "خواندنِ داده‌یِ سلامت ممکن نشد.";
    return (
      <CarouselSlide
        slides={[
          {
            id: "unavailable",
            content: (
              <SlideShell id="unavailable" eyebrow="PERFORMANCE" title="داده‌ای برایِ تحلیل نیست">
                <p
                  className="text-sm leading-7 text-muted-foreground"
                  data-performance-state={state}
                >
                  {message}
                </p>
              </SlideShell>
            ),
          },
        ]}
        autoMs={0}
        label="نمایشِ اسلایدیِ عملکرد"
        className={className}
      />
    );
  }

  const measured = metrics.filter((m) => m.trend?.last);
  const neverRecorded = metrics.filter((m) => m.pointCount === 0);
  const singlePoint = metrics.filter((m) => m.pointCount === 1);
  const established = metrics.filter((m) => m.status === "ESTABLISHED");

  const slides: CarouselSlideItem[] = [
    {
      id: "current",
      content: (
        <SlideShell
          id="current"
          eyebrow="01 · نمایِ کنونی"
          title="چقدر از تو سنجیده شده"
          note={
            demo
              ? "حالتِ نمونه — این عددها واقعی نیستند و برایِ دیدنِ طراحی نشان داده می‌شوند."
              : "حلقه‌ها جایگاهِ تو در یک بازه‌یِ مرجع نیستند — آن محاسبه به جنسیت و سن نیاز دارد که هیچ‌کدام خوانده نمی‌شود. آنچه نشان داده می‌شود کفایتِ شواهد است، و در مرکزِ هر حلقه تازه‌ترین مقدارِ ثبت‌شده‌یِ خودت."
          }
        >
          <div className="flex flex-wrap justify-start gap-6">
            {metrics.map((row) => (
              <EvidenceRing key={row.metricType} row={row} />
            ))}
          </div>
        </SlideShell>
      ),
    },
    {
      id: "measured",
      content: (
        <SlideShell
          id="measured"
          eyebrow="02 · سنجیده‌ها"
          title="آنچه اندازه‌گیری شده، و آنچه مرجع ندارد"
          note="بعضی سنجه‌ها عمداً هیچ بازه‌یِ مرجعِ منتشرشده‌ای ندارند. بودنِ عدد به معنایِ قابلِ تفسیر بودنش نیست، و اینجا آن دو از هم جدا شده‌اند."
        >
          {measured.length === 0 ? (
            <p className="text-sm leading-7 text-muted-foreground" data-measured-count="0">
              هنوز هیچ سنجه‌ای ثبت نشده، پس کارتی برایِ نشان دادن نیست.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2" data-measured-count={measured.length}>
              {measured.map((row) => {
                const noRef = NO_REFERENCE_TYPES.has(row.metricType);
                return (
                  <li key={row.metricType}>
                    <Panel variant={noRef ? "quiet" : "base"} className="p-4">
                      <Stat
                        label={row.label}
                        value={nf.format(row.trend!.last!.value)}
                        unit={row.unit}
                        tone={noRef ? "default" : "primary"}
                      />
                      {noRef && (
                        <p
                          className="mt-2 text-[10px] leading-5 text-warning"
                          data-no-reference={row.metricType}
                        >
                          بی‌مرجع — {NO_REFERENCE[noRefKeyOf(row.metricType)].reason}
                        </p>
                      )}
                    </Panel>
                  </li>
                );
              })}
            </ul>
          )}
        </SlideShell>
      ),
    },
    {
      id: "position",
      content: (
        <SlideShell
          id="position"
          eyebrow="03 · جایگاه"
          title="جایگاهِ تو در بازه‌یِ مرجع — محاسبه نمی‌شود"
          note="positionOf بدونِ جنسیت و سن سرسختانه رد می‌کند: «no sex, no age, no position. Never default.» ستونِ athlete_profiles.gender در مهاجرتِ ۰۰۲ خطِ ۶۸ وجود دارد، ولی هیچ مسیرِ کدِ واقعی آن را از پایگاه‌داده نمی‌خواند. آنچه در ادامه می‌بینی خودِ بازه‌هایِ منتشرشده است، با نوارِ خالی."
        >
          <ul className="flex flex-col gap-2" data-position-computed="0">
            {POSITION_ROWS.map(({ label, text, needsSex }) => (
              <li
                key={label}
                className="surface-sunken flex flex-wrap items-center justify-between gap-3 rounded-xl px-3 py-2.5"
              >
                <span className="text-xs font-semibold">{label}</span>
                <span className="num text-[11px] text-muted-foreground">{text}</span>
                {/* The track is empty on purpose. A bar sitting at zero would read as
                    "measured at the minimum"; an empty track reads as "not computed". */}
                <span
                  className="h-1.5 w-24 rounded-full bg-muted-foreground/15"
                  data-position-track="empty"
                />
                {needsSex && (
                  <span className="text-[10px] font-semibold text-warning">وابسته به جنسیت</span>
                )}
              </li>
            ))}
          </ul>
        </SlideShell>
      ),
    },
    {
      id: "inconsistencies",
      content: (
        <SlideShell
          id="inconsistencies"
          eyebrow="04 · ناسازگاری‌ها"
          title="آنچه با هم نمی‌خواند — قابلِ بررسی نیست"
          note="دو مانعِ مستقل، هر دو صریح گفته می‌شوند تا «ناسازگاری پیدا نشد» با «بررسی انجام نشد» اشتباه گرفته نشود."
        >
          <ul className="flex flex-col gap-2 text-xs leading-6 text-muted-foreground">
            <li
              className="surface-sunken rounded-xl px-3 py-2.5"
              data-inconsistency-blocker="context"
            >
              <code className="num">inconsistencies(snapshot, ctx)</code> به یک{" "}
              <code className="num">PositionContext</code> با جنسیت و سن نیاز دارد و آن را ندارد.
            </li>
            <li className="surface-sunken rounded-xl px-3 py-2.5" data-inconsistency-blocker="api">
              <code className="num">GET /api/athlete/health</code> امروز نه جایگاه برمی‌گرداند نه
              ناسازگاری — پس حتی اگر ورودی‌ها کامل بودند، چیزی برایِ انتقال به این صفحه وجود نداشت.
            </li>
            <li className="text-[11px]" data-inconsistency-found="0">
              این «هیچ ناسازگاری‌ای پیدا نشد» نیست. این «بررسی انجام نشد» است.
            </li>
          </ul>
        </SlideShell>
      ),
    },
    {
      id: "trend",
      content: (
        <SlideShell
          id="trend"
          eyebrow="05 · روند"
          title="روند، یا اعتراف به اینکه اتفاقی نیفتاده"
          note="یک نقطه روند نیست. زیرِ دو ثبت، جهت null می‌ماند و هرگز «صفر» یا «تخت» گزارش نمی‌شود، چون تخت یعنی سنجیده‌ایم و تغییر نکرده."
        >
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-3" data-trend-counts>
              <Panel variant={established.length ? "base" : "quiet"} className="p-4">
                <Stat
                  label="روندِ برقرار"
                  value={nf.format(established.length)}
                  size="hero"
                  tone="success"
                />
              </Panel>
              <Panel variant={singlePoint.length ? "base" : "quiet"} className="p-4">
                <Stat
                  label="فقط یک نقطه"
                  value={nf.format(singlePoint.length)}
                  size="hero"
                  tone="warning"
                />
              </Panel>
              <Panel variant={neverRecorded.length ? "base" : "quiet"} className="p-4">
                <Stat label="اتفاق نیفتاده" value={nf.format(neverRecorded.length)} size="hero" />
              </Panel>
            </div>
            {neverRecorded.length > 0 && (
              <ul className="flex flex-col gap-2" data-trend-empty>
                {neverRecorded.map((row) => (
                  <li
                    key={row.metricType}
                    className="surface-sunken flex flex-wrap items-center justify-between gap-3 rounded-xl border-dashed px-3 py-2.5"
                  >
                    <span className="text-xs font-semibold">{row.label}</span>
                    <span className="num text-[11px] text-muted-foreground">
                      هیچ ثبتی نیست — {nf.format(row.pointsNeeded)} ثبتِ دیگر تا روند
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SlideShell>
      ),
    },
  ];

  return (
    <CarouselSlide
      slides={slides}
      autoMs={7000}
      label="نمایشِ اسلایدیِ عملکرد"
      className={className}
    />
  );
}

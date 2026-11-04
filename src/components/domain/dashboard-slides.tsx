import { Activity, AlertTriangle, Gauge, Ruler } from "lucide-react";
import { CarouselSlide, type CarouselSlideItem } from "@/components/domain/carousel";
import { EmptySlot } from "@/components/domain/evidence";
import { Panel, ProgressRing } from "@/components/domain/primitives";
import {
  DIRECTION_VIEW,
  formatValue,
  nf,
  valueSlotFor,
  type AthleteHealth,
  type MetricRow,
} from "@/lib/athlete-health";
import { REFERENCE_RANGES, type MetricKey } from "@/lib/reference-ranges";
import { cn } from "@/lib/utils";

/**
 * The dashboard slideshow (spec P21): four slides, sitting above <CoachCards>.
 *
 *   1. خلاصه                  - rings
 *   2. سنجیده‌ها              - measured cards
 *   3. جایگاه                 - position bar
 *   4. آنچه نیاز به توجه دارد - inconsistencies
 *
 * Slides 1, 2 and 4 render real evidence from GET /api/athlete/health. Slide 3
 * cannot, and that is stated on the slide instead of being papered over - see the
 * comment there for the exact reason and the exact thing that would unblock it.
 *
 * The four slides are the spec's, but their contents are composed here from what
 * this repository can actually produce. P21's own patch targeted a seeded server
 * build that reads metrics through useLatestMetrics and renders <CoachCards> under
 * an flx-system.css stylesheet; two of those three exist here and one does not, so
 * the patch could not be applied verbatim.
 */

/** Object.keys on a Record with literal keys widens to string[], so this is cast. */
const POSITION_KEYS = Object.keys(REFERENCE_RANGES) as MetricKey[];

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

function SlideShell({
  eyebrow,
  title,
  note,
  demo = false,
  children,
}: {
  eyebrow: string;
  title: string;
  note?: string | undefined;
  /** Dev-only design preview. Marks every slide so a screenshot cannot be
      mistaken for somebody's real measurements. */
  demo?: boolean | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col gap-4 p-5 md:p-7">
      {demo && (
        <div
          className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-[11px] text-warning"
          data-demo-slides="design-preview"
        >
          <AlertTriangle className="size-3.5 shrink-0" />
          <span>
            حالتِ نمونه — فقط برایِ دیدنِ طراحی. عددها ساختگی‌اند و این حالت در ساختِ پروداکشن
            غیرفعال است.
          </span>
        </div>
      )}
      <div>
        <div className="mb-1 text-xs font-semibold text-primary">{eyebrow}</div>
        <h2 className="text-lg font-bold text-foreground md:text-xl">{title}</h2>
        {note && <p className="mt-1 text-xs text-muted-foreground md:text-sm">{note}</p>}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

function Ring({
  value,
  total,
  label,
  color,
}: {
  value: number;
  total: number;
  label: string;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <ProgressRing value={pct(value, total)} size={104} stroke={9} color={color}>
        <span className="num text-xl font-bold text-foreground">{nf.format(value)}</span>
        <span className="num text-[10px] text-muted-foreground">از {nf.format(total)}</span>
      </ProgressRing>
      <span className="text-center text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

/** Slide 2: one card per metric that has at least one real reading. */
function MeasuredCard({ row }: { row: MetricRow }) {
  const last = row.trend?.last ?? null;
  const direction = row.trend?.direction ?? null;
  const view = direction ? DIRECTION_VIEW[direction] : null;
  const change = row.trend?.change ?? null;

  return (
    <div className="surface-sunken rounded-xl p-3">
      <div className="text-[11px] font-medium text-muted-foreground">{row.label}</div>
      <div className="num mt-1 text-xl font-bold text-foreground">
        {last ? formatValue(last.value, row.unit) : "—"}
      </div>
      {/* One direction line, with the change appended only when there is one.
          Written as view.Icon rather than a destructured Icon: the local variable
          stays `Component | undefined` even inside a `view &&` guard, which
          TypeScript rightly refuses to render as JSX. */}
      {view && (
        <div className={cn("mt-1 flex items-center gap-1 text-[11px]", view.tone)}>
          <view.Icon className="size-3.5" />
          <span>
            {view.label}
            {change !== null && change !== 0 && (
              <span className="num">
                {" "}
                ({change > 0 ? "+" : ""}
                {nf.format(change)})
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

export function DashboardSlideshow({
  health,
  className,
}: {
  health: AthleteHealth;
  className?: string | undefined;
}) {
  // The sample rows arrive through useAthleteHealth, so this component has no
  // second copy of them and no branch of its own to keep in step. `demo` now only
  // decides whether to draw the warning banner.
  const { state, metrics, summary, failure } = health;
  // The warning follows the data the hook actually returned, so a production build
  // cannot show sample rows and a dev build cannot show them unlabelled.
  const demo = health.demo;

  /* Until there is a real payload there is nothing to summarise, and inventing
     four slides of placeholders would be exactly the fabrication the rest of this
     codebase has been stripped of. One slide that says what is happening is the
     honest version of the same space. */
  if (state !== "ready") {
    const waiting: CarouselSlideItem[] = [
      {
        id: "waiting",
        content: (
          <SlideShell
            demo={demo}
            eyebrow="داشبورد"
            title={
              state === "loading"
                ? "در حالِ خواندنِ داده‌یِ سلامت"
                : state === "unauthenticated"
                  ? "وارد نشده‌ای"
                  : "خواندنِ داده‌یِ سلامت ممکن نشد"
            }
            note={
              state === "error"
                ? failure
                : state === "unauthenticated"
                  ? "برایِ دیدنِ سنجه‌هایِ خودت باید وارد شوی."
                  : "سنجه‌ها از health_metrics خوانده می‌شوند، نه از داده‌یِ نمایشی."
            }
          >
            <div
              className="flex h-full items-center justify-center text-muted-foreground"
              data-dash-slide={state}
            >
              <Activity className="size-6" />
            </div>
          </SlideShell>
        ),
      },
    ];
    return (
      <CarouselSlide
        slides={waiting}
        autoMs={0}
        minHeight={280}
        label="وضعیتِ داده‌یِ سلامت"
        className={className}
      />
    );
  }

  const total = summary?.totalMetricTypes ?? metrics.length;
  const measured = metrics.filter((row) => row.trend?.last != null);
  const withTrend = summary?.withTrend ?? 0;
  const neverMeasured = metrics.filter((row) => row.status === "NO_DATA");
  const onePoint = metrics.filter((row) => row.status === "INSUFFICIENT_POINTS");
  const excluded = metrics.flatMap((row) =>
    (row.trend?.excluded ?? []).map((point) => ({ row, point })),
  );

  const slides: CarouselSlideItem[] = [
    /* --- 1. خلاصه - حلقه‌ها ------------------------------------------------- */
    {
      id: "summary",
      content: (
        <SlideShell
          demo={demo}
          eyebrow="خلاصه"
          title="چه اندازه از داده‌یِ سلامتِ تو واقعاً وجود دارد"
          note="هر حلقه یک شمارشِ واقعی است، از health_metrics. هیچ‌کدام امتیاز یا رتبه نیست."
        >
          <div
            className="flex h-full flex-wrap items-center justify-center gap-6 md:gap-10"
            data-dash-slide="summary"
          >
            <Ring value={measured.length} total={total} label="سنجیده‌شده" color="var(--primary)" />
            <Ring value={withTrend} total={total} label="دارایِ روند" color="var(--success)" />
            <Ring
              value={neverMeasured.length}
              total={total}
              label="هرگز سنجیده نشده"
              color="var(--warning)"
            />
          </div>
        </SlideShell>
      ),
    },

    /* --- 2. سنجیده‌ها - کارت‌هایِ سنجیده ------------------------------------ */
    {
      id: "measured",
      content: (
        <SlideShell
          demo={demo}
          eyebrow="سنجیده‌ها"
          title="آخرین مقدارِ ثبت‌شده، با روندش"
          note={
            measured.length === 0
              ? "هنوز هیچ سنجه‌ای ثبت نشده است."
              : "روند تنها با دو نقطه ساخته می‌شود؛ یک نقطه مقدار است نه روند."
          }
        >
          {measured.length === 0 ? (
            <div
              className="flex h-full items-center justify-center text-sm text-muted-foreground"
              data-dash-slide="measured-empty"
            >
              <Gauge className="me-2 size-4" />
              داده‌یِ سنجه‌شده‌ای برایِ نمایش نیست.
            </div>
          ) : (
            <div
              className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4"
              data-dash-slide="measured"
            >
              {measured.map((row) => (
                <MeasuredCard key={row.metricType} row={row} />
              ))}
            </div>
          )}
        </SlideShell>
      ),
    },

    /* --- 3. جایگاه - نوارِ جایگاه -------------------------------------------
       BLOCKED, AND THE SLIDE SAYS SO.

       A position is "where this value sits inside its published reference range",
       and positionOf() computes it. Its first line is the published hard rule:

         if (ctx.sex === null || ctx.age === null) return null;   // never default

       Age is reachable - the assessment captures common.profile.age and the
       repository writes it to athlete_profiles.age. Sex is not: no code in this
       repository reads it, even though athlete_profiles.gender exists in the
       schema (migration 002, `gender VARCHAR(20) NULL`). So every position here
       would be null, and the only way to get a number on screen would be to
       assume a sex - which the rule forbids and which would produce a confident,
       wrong, sex-specific reading of somebody's body fat.

       What is shown instead is real: the published ranges themselves. Three of the
       four do not depend on sex at all, and body fat says plainly that it does. */
    {
      id: "position",
      content: (
        <SlideShell
          demo={demo}
          eyebrow="جایگاه"
          title="جایگاهِ سنجه‌ها در بازه‌یِ مرجع"
          note="برایِ محاسبه‌یِ جایگاه، جنسیت لازم است و این برنامه هنوز آن را نمی‌خواند. حدس هم نمی‌زند."
        >
          <div className="flex flex-col gap-3" data-dash-slide="position">
            {POSITION_KEYS.map((key) => {
              const entry = REFERENCE_RANGES[key];
              const range = entry.range;
              const needsSex = range === null;
              return (
                <div key={key} className="surface-sunken rounded-xl p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-xs font-semibold text-foreground">{entry.label}</span>
                    <span className="num text-[11px] text-muted-foreground">
                      {range
                        ? `${nf.format(range.min)} – ${nf.format(range.max)} ${entry.unit}`
                        : "بازه‌اش به جنسیت بستگی دارد"}
                    </span>
                  </div>
                  {/* The track is drawn, the fill is not: there is no position to
                      fill it with. An empty track reads as "not computed", while a
                      bar at zero would read as "measured at the minimum". */}
                  <div
                    className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                    data-position-track={key}
                    data-position-status={needsSex ? "needs-sex" : "blocked"}
                  />
                  <div className="mt-1.5 text-[11px] text-muted-foreground">
                    {needsSex
                      ? "بدونِ جنسیت بازه‌ای انتخاب نمی‌شود."
                      : "بازه منتشر شده است، ولی جایگاهِ تو محاسبه نمی‌شود."}
                  </div>
                </div>
              );
            })}
            <p className="text-[11px] text-muted-foreground">
              ستونِ <span className="num">gender</span> در جدولِ{" "}
              <span className="num">athlete_profiles</span> وجود دارد؛ خواندنش از آن جدول این اسلاید
              را واقعی می‌کند.
            </p>
          </div>
        </SlideShell>
      ),
    },

    /* --- 4. آنچه نیاز به توجه دارد ------------------------------------------ */
    {
      id: "attention",
      content: (
        <SlideShell
          demo={demo}
          eyebrow="آنچه نیاز به توجه دارد"
          title="جاهایی که داده کم است، نه جاهایی که داده بد است"
          note="ناسازگاریِ میانِ سنجه‌ها هم به همان جنسیتِ نایاب نیاز دارد، پس اینجا فهرست نمی‌شود."
        >
          <div className="flex flex-col gap-3" data-dash-slide="attention">
            {neverMeasured.length === 0 && onePoint.length === 0 && excluded.length === 0 && (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                <Activity className="me-2 size-4" />
                چیزی برایِ توجه نیست.
              </div>
            )}

            {neverMeasured.length > 0 && (
              <div className="surface-sunken rounded-xl p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Ruler className="size-3.5 text-warning" />
                  <span className="num">{nf.format(neverMeasured.length)}</span> سنجه هرگز ثبت نشده
                </div>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {neverMeasured.map((row) => (
                    <li key={row.metricType}>
                      <EmptySlot slot={valueSlotFor(row)} label={row.label} compact />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {onePoint.length > 0 && (
              <div className="surface-sunken rounded-xl p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <AlertTriangle className="size-3.5 text-info" />
                  <span className="num">{nf.format(onePoint.length)}</span> سنجه فقط یک نقطه دارد
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  یک نقطه مقدار است، نه روند. برایِ ساختنِ روندِ هر کدام یک ثبتِ دیگر لازم است.
                </p>
              </div>
            )}

            {excluded.length > 0 && (
              <div className="surface-sunken rounded-xl p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <AlertTriangle className="size-3.5 text-destructive" />
                  <span className="num">{nf.format(excluded.length)}</span> ثبت از میانگین بیرون
                  گذاشته شد
                </div>
                <ul className="mt-2 flex flex-col gap-1">
                  {excluded.map(({ row, point }) => (
                    <li
                      key={`${row.metricType}-${point.at}`}
                      className="flex items-baseline justify-between gap-3 text-[11px] text-muted-foreground"
                    >
                      <span>{row.label}</span>
                      <span className="num">
                        {formatValue(point.value, row.unit)} — {point.reason}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  بیرون گذاشته‌شده یعنی دیده نشده نیست: مقدار گزارش می‌شود، در میانگین نمی‌آید.
                </p>
              </div>
            )}
          </div>
        </SlideShell>
      ),
    },
  ];

  return (
    <CarouselSlide
      slides={slides}
      minHeight={500}
      label={demo ? "نمایشِ اسلایدیِ داشبورد — حالتِ نمونه" : "نمایشِ اسلایدیِ داشبورد"}
      className={cn("mb-6", className)}
    />
  );
}

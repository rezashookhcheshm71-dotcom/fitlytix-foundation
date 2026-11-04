import { CarouselSlide, type CarouselSlideItem } from "@/components/domain/carousel";
import {
  METRIC_DEFS,
  READINESS_LABEL,
  type HealthMetric,
  type ReadinessAssessment,
} from "@/domain/types";

/**
 * P27 — the recovery tab's own slideshow.
 *
 * The brief is explicit that this must not be a copy of the performance tab, so it
 * is not built on the same spine. Performance answers "where does a measured value
 * sit against a published range". Recovery cannot answer that at all: the inputs are
 * mostly unrecorded, and `ReadinessAssessment` types its own `source` as the literal
 * "mock", so there is no measurement to position.
 *
 * What recovery does have, and no other tab has, is provenance: `assess()` exposes
 * every factor with the place it came from - a value the athlete recorded, or one
 * lifted from a per-sport snapshot that ignores the athlete entirely. So the spine
 * here is a ledger of what is known, what is assumed, and what that makes the score
 * worth. That is a different question with a different shape, not a restyled ring.
 *
 * Nothing in here invents a number. Every value comes from the assessment or from
 * the recorded series, and where there is no record the slide says so.
 */

type Series = { t: HealthMetric["metricType"]; rows: HealthMetric[] }[];

/**
 * Mirrors the thresholds in recoveryService.assess. They are duplicated here only to
 * be shown, because the point of the slide is that a grade rests on two unnamed
 * constants; if the service changes, this text has to change with it.
 */
const THRESHOLDS = { ready: 72, moderate: 55 };

const EFFECT_VIEW = {
  positive: { label: "به سودِ تو", className: "border-success/40 bg-success/10 text-success" },
  neutral: { label: "بی‌اثر", className: "border-border bg-muted/40 text-muted-foreground" },
  negative: {
    label: "به زیانِ تو",
    className: "border-destructive/40 bg-destructive/10 text-destructive",
  },
} as const;

/**
 * The channel a factor's number arrived through. Deliberately NOT phrased as
 * ownership: this tab reads its series with a fixed demo athlete id rather than the
 * signed-in user's, so "از ثبتِ خودت" would claim the reader's own data for rows that
 * are not theirs. "snapshot" is marked assumed because that number is not a
 * measurement of anyone - it is a per-sport constant.
 */
const SOURCE_VIEW: Record<string, { label: string; assumed: boolean }> = {
  manual: { label: "ثبتِ دستی", assumed: false },
  assessment: { label: "پرسشنامه", assumed: false },
  snapshot: { label: "snapshotِ ورزش — فرض، نه اندازه‌گیری", assumed: true },
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
    <section className="flex h-full flex-col gap-4 p-6 sm:p-8" data-recovery-slide={id}>
      <header>
        <h3 className="text-lg font-bold tracking-tight">{title}</h3>
        {note && <p className="mt-1 text-xs leading-6 text-muted-foreground">{note}</p>}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

export function RecoverySlideshow({
  assessment,
  series,
  className,
}: {
  assessment: ReadinessAssessment;
  series: Series;
  className?: string | undefined;
}) {
  const slides: CarouselSlideItem[] = [
    {
      id: "inputs",
      content: (
        <SlideShell
          id="inputs"
          title="ورودی‌هایِ تو"
          note="آمادگی از این سه داده ساخته می‌شود. هرکدام یا ثبت شده یا نشده — سومی وجود ندارد. این تب ردیف‌ها را با شناسه‌یِ ثابتِ نمونه می‌خواند، نه با شناسه‌یِ تو."
        >
          <ul className="grid gap-3 sm:grid-cols-3">
            {series.map(({ t, rows }) => {
              const last = rows.at(-1);
              return (
                <li
                  key={t}
                  data-input-status={rows.length ? "recorded" : "unrecorded"}
                  className="rounded-2xl border border-border bg-card/40 p-4"
                >
                  <p className="text-xs text-muted-foreground">{METRIC_DEFS[t].label}</p>
                  {last ? (
                    <>
                      <p className="num mt-2 text-2xl font-bold">
                        {last.value}
                        <span className="ms-1 text-[11px] font-normal text-muted-foreground">
                          {METRIC_DEFS[t].unit}
                        </span>
                      </p>
                      <p className="num mt-1 text-[11px] text-muted-foreground">
                        {rows.length} ثبت · آخرین {last.startTime.slice(0, 10)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="num mt-2 text-2xl font-bold text-muted-foreground/40">—</p>
                      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                        هنوز ثبت نشده، پس در نمره نقشی ندارد.
                      </p>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </SlideShell>
      ),
    },
    {
      id: "factors",
      content: (
        <SlideShell
          id="factors"
          title="عوامل و مبنایشان"
          note="هر عامل دو چیز دارد: اثرش روی نمره، و جایی که عددش از آن آمده. این دو با هم خوانده می‌شوند."
        >
          <ul className="flex flex-col gap-2">
            {assessment.factors.map((f) => {
              const effect = EFFECT_VIEW[f.effect];
              const source = SOURCE_VIEW[f.source] ?? { label: f.source, assumed: false };
              return (
                <li
                  key={`${f.key}-${f.source}`}
                  data-factor-source={f.source}
                  data-factor-effect={f.effect}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5 ${
                    source.assumed ? "border-warning/40 bg-warning/5" : "border-border bg-card/40"
                  }`}
                >
                  <span className="text-xs font-semibold">{f.label}</span>
                  <span className="num text-xs text-muted-foreground">{f.value}</span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${effect.className}`}
                  >
                    {effect.label}
                  </span>
                  <span
                    className={`text-[10px] ${source.assumed ? "font-semibold text-warning" : "text-muted-foreground"}`}
                  >
                    {source.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </SlideShell>
      ),
    },
    {
      id: "basis",
      content: (
        <SlideShell
          id="basis"
          title="نمره و آنچه رویش ایستاده"
          note="نمره نمایش داده می‌شود چون صفحه این را از قبل نشان می‌داد؛ اینجا مبنایش هم کنارش آمده."
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-border bg-card/40 p-5">
              <p className="num text-5xl font-bold leading-none" data-recovery-score>
                {assessment.score}
              </p>
              <div>
                <p className="text-sm font-semibold">{READINESS_LABEL[assessment.level]}</p>
                <p className="num mt-1 text-[11px] text-muted-foreground">
                  آستانه‌ها: ≥{THRESHOLDS.ready} آماده · ≥{THRESHOLDS.moderate} متوسط · وگرنه نیاز
                  به ریکاوری
                </p>
              </div>
            </div>
            <ul className="flex flex-col gap-2 text-xs leading-6 text-muted-foreground">
              <li data-recovery-basis="mock-source">
                نوعِ <code className="num">ReadinessAssessment</code> فیلدِ{" "}
                <code className="num">source</code> را به خودِ «mock» قفل کرده، پس این ارزیابی از
                نظرِ خودِ کد هرگز داده‌یِ واقعی نیست.
              </li>
              <li data-recovery-basis="snapshot-ignores-athlete">
                پایه‌یِ نمره از <code className="num">SPORT_DASHBOARDS[sport]</code> می‌آید و آن
                تابع <code className="num">athleteId</code> را با <code className="num">void</code>{" "}
                دور می‌اندازد — یعنی برای هر ورزشکاری در آن ورزش یک عدد است.
              </li>
              <li data-recovery-basis="dashboard-withholds">
                همین داده روی داشبورد درجه نمی‌گیرد: آن پنل می‌گوید هیچ مبنایِ منتشرشده‌ای برایِ
                درجه‌بندیِ آمادگی وجود ندارد. این دو موضع باید یکی شوند.
              </li>
            </ul>
          </div>
        </SlideShell>
      ),
    },
    {
      id: "week",
      content: (
        <SlideShell
          id="week"
          title="هفت روزِ ثبت‌شده"
          note="فقط روزی که واقعاً ثبت شده ستون دارد. روزِ خالی ستونِ صفر نمی‌گیرد، چون صفر یعنی اندازه‌گیری‌شده."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            {series.map(({ t, rows }) => {
              const max = rows.length ? Math.max(...rows.map((r) => r.value)) : 0;
              return (
                <div key={t} className="rounded-2xl border border-border bg-card/40 p-4">
                  <p className="text-xs font-semibold">{METRIC_DEFS[t].label}</p>
                  {rows.length ? (
                    <div
                      className="mt-3 flex h-20 items-end gap-1"
                      role="img"
                      aria-label={`هفت روزِ اخیرِ ${METRIC_DEFS[t].label}`}
                    >
                      {rows.slice(-7).map((r) => (
                        <div
                          key={r.id}
                          className="flex-1 rounded-t bg-primary/60"
                          style={{ height: `${Math.max(4, (r.value / max) * 100)}%` }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 flex h-20 items-center">
                      <p className="text-[11px] leading-5 text-muted-foreground">
                        هیچ روزی ثبت نشده — نموداری وجود ندارد.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SlideShell>
      ),
    },
  ];

  return (
    <CarouselSlide
      slides={slides}
      autoMs={7000}
      label="نمایشِ اسلایدیِ ریکاوری"
      className={className}
    />
  );
}

/**
 * ریکاوری — built only from the athlete's daily check-ins.
 *
 * There is no HRV or resting-heart-rate stream in this product yet, so none is invented: the
 * score comes from what the athlete typed (sleep, stress, readiness), and the page says which
 * check-in it used. When there is no check-in, the page asks for one instead of guessing.
 */
import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { MockBadge, Panel, PageHeader, SectionHeading } from "@/components/domain/primitives";
import { Button } from "@/components/ui/button";
import { ReadinessCard, WhyNote } from "@/components/domain/coaching";
import { RecoveryBars } from "@/components/domain/charts";
import { useAthleteOverview } from "@/hooks/use-athlete-overview";
import { getCurrentUser, type SessionUserDto } from "@/lib/auth";
import { faNumber } from "@/lib/locale";
import type { ReadinessAssessment, ReadinessFactor, ReadinessLevel } from "@/domain/platform";

export const Route = createFileRoute("/athlete/recovery")({
  validateSearch: (s) =>
    z
      .object({
        sport: z.enum(["crossfit", "hyrox", "functional", "bodybuilding", "running"]).optional(),
      })
      .parse(s),
  head: () => ({
    meta: [
      { title: "ریکاوری و آمادگی — FitLytix" },
      { name: "description", content: "آمادگی امروز بر پایهٔ چک‌این روزانهٔ خودتان." },
      { property: "og:title", content: "ریکاوری و آمادگی — FitLytix" },
      { property: "og:description", content: "آمادگی امروز بر پایهٔ چک‌این روزانهٔ خودتان." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RecoveryPage,
});

type Checkin = {
  date: string;
  sleepHours: number | null;
  stress: number | null;
  readiness: number | null;
  weightKg: number | null;
};

const levelFor = (score: number): ReadinessLevel =>
  score >= 80 ? "ready" : score >= 60 ? "moderate" : "recovery_needed";

/** Sleep and stress are the only inputs the athlete controls, so they carry the estimate. */
function scoreFromCheckin(entry: Checkin): number {
  if (entry.readiness !== null) return Math.round(entry.readiness);
  let score = 65;
  if (entry.sleepHours !== null) score += (entry.sleepHours - 7) * 9;
  if (entry.stress !== null) score -= (entry.stress - 5) * 6;
  return Math.max(20, Math.min(100, Math.round(score)));
}

function readinessFromCheckin(entry: Checkin): ReadinessAssessment {
  const score = scoreFromCheckin(entry);
  const factors: ReadinessFactor[] = [];

  if (entry.sleepHours !== null) {
    factors.push({
      key: "sleep",
      label: "خواب",
      value: `${faNumber(entry.sleepHours)} ساعت`,
      effect: entry.sleepHours >= 7 ? "positive" : entry.sleepHours < 6 ? "negative" : "neutral",
      source: "manual",
    });
  }
  if (entry.stress !== null) {
    factors.push({
      key: "fatigue",
      label: "تنش گزارش‌شده",
      value: `${faNumber(entry.stress)} از ۱۰`,
      effect: entry.stress <= 4 ? "positive" : entry.stress >= 7 ? "negative" : "neutral",
      source: "manual",
    });
  }
  if (entry.readiness !== null) {
    factors.push({
      key: "performance",
      label: "آمادگی ثبت‌شده",
      value: `${faNumber(entry.readiness)} از ۱۰۰`,
      effect: entry.readiness >= 70 ? "positive" : entry.readiness < 50 ? "negative" : "neutral",
      source: "manual",
    });
  }

  return {
    athleteId: "",
    date: entry.date,
    score,
    level: levelFor(score),
    factors,
    why:
      entry.readiness !== null
        ? `این عدد همان «آمادگی» است که در چک‌این ${entry.date} ثبت کرده‌اید.`
        : `این عدد از خواب و تنش ثبت‌شده در چک‌این ${entry.date} برآورد شده؛ ضربان‌سنج یا پوشیدنی خوانده نشده است.`,
    source: "checkin",
  };
}

function tipFor(r: ReadinessAssessment, entry: Checkin): string {
  if (r.level === "ready") {
    return "برای جلسهٔ برنامه‌ریزی‌شده آماده‌اید؛ گرم‌کردن کامل را جا نیندازید.";
  }
  if (r.level === "moderate") {
    return "جلسه را انجام دهید اما ست‌های سنگین آخر را سبک‌تر کنید و RPE را زیر ۸ نگه دارید.";
  }
  return entry.sleepHours !== null && entry.sleepHours < 6
    ? "دیشب کم خوابیده‌اید: امروز تحرک سبک و خواب زودتر؛ جلسهٔ سنگین را یک روز عقب بیندازید."
    : "امروز تحرک سبک و پیاده‌روی؛ اگر تنش بالاست، شدت را کم کنید و امشب را به خواب بدهید.";
}

function Trend({
  label,
  unit,
  rows,
  valueOf,
}: {
  label: string;
  unit: string;
  rows: Checkin[];
  valueOf: (entry: Checkin) => number | null;
}) {
  const points = rows
    .map((entry) => ({ date: entry.date, value: valueOf(entry) }))
    .filter((point): point is { date: string; value: number } => point.value !== null)
    .slice(-7);
  const max = Math.max(...points.map((point) => point.value), 1);

  return (
    <Panel>
      <SectionHeading title={label} subtitle={unit} />
      {points.length === 0 ? (
        <p className="text-xs text-muted-foreground">هنوز ثبت نشده.</p>
      ) : (
        <div
          className="flex h-24 items-end gap-1"
          role="img"
          aria-label={`روند ${label} در ${faNumber(points.length)} چک‌این آخر`}
        >
          {points.map((point) => (
            <div key={point.date} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-primary/60"
                style={{ height: `${(point.value / max) * 80}px` }}
              />
              <span className="num text-[9px] text-muted-foreground">{faNumber(point.value)}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function RecoveryPage() {
  const { status, data } = useAthleteOverview();
  const [user, setUser] = useState<SessionUserDto | null>(null);

  useEffect(() => {
    let active = true;
    void getCurrentUser().then(({ user: current }) => {
      if (active && current) setUser(current);
    });
    return () => {
      active = false;
    };
  }, []);

  const name = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "ورزشکار";
  const checkins = data?.checkins ?? [];
  const newest = checkins.at(-1) ?? null;
  const readiness = newest ? readinessFromCheckin(newest) : null;
  const history = data?.recoveryHistory ?? [];

  return (
    <AppShell mode="athlete" userName={name} userRole="ریکاوری">
      <PageHeader
        eyebrow="ریکاوری"
        title="بدن امروز چقدر آماده است؟"
        description="همهٔ اعداد این صفحه از چک‌این روزانهٔ خودتان می‌آید؛ تشخیص پزشکی نیست."
        actions={newest ? undefined : <MockBadge label="بدون داده" />}
      />

      {status === "loading" && (
        <Panel className="text-center text-sm text-muted-foreground">
          در حال خواندن چک‌این‌ها…
        </Panel>
      )}

      {(status === "unauthenticated" || status === "error") && (
        <Panel className="text-center text-sm text-muted-foreground">
          {status === "unauthenticated"
            ? "برای دیدن ریکاوری، وارد شوید."
            : "خواندن داده‌ها ناموفق بود؛ کمی بعد دوباره سر بزنید."}
        </Panel>
      )}

      {(status === "ready" || status === "empty") && !newest && (
        <Panel className="space-y-3">
          <p className="text-sm">هنوز چک‌اینی ثبت نکرده‌اید، پس عددی برای آمادگی وجود ندارد.</p>
          <p className="text-xs leading-6 text-muted-foreground">
            روزی یک چک‌این کوتاه (خواب، تنش، آمادگی) کافی است؛ همان چیزی است که برنامهٔ فردا را
            دقیق‌تر می‌کند و پنجرهٔ سنجش برنامه را باز می‌کند.
          </p>
          <Button asChild size="sm">
            <Link to="/athlete/program">ثبت چک‌این امروز</Link>
          </Button>
        </Panel>
      )}

      {readiness && newest && (
        <>
          <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <ReadinessCard r={readiness} />
            <Panel>
              <SectionHeading title="پیشنهاد امروز" subtitle={`بر پایهٔ چک‌این ${newest.date}`} />
              <p className="text-sm leading-7">{tipFor(readiness, newest)}</p>
              <WhyNote
                why={readiness.why}
                inputs={[
                  newest.sleepHours !== null ? `خواب ${newest.sleepHours} ساعت` : "",
                  newest.stress !== null ? `تنش ${newest.stress}` : "",
                  newest.readiness !== null ? `آمادگی ${newest.readiness}` : "",
                ].filter(Boolean)}
              />
              {history.length >= 2 && (
                <div className="mt-4">
                  <RecoveryBars data={history} height={130} />
                </div>
              )}
            </Panel>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Trend label="خواب" unit="ساعت" rows={checkins} valueOf={(entry) => entry.sleepHours} />
            <Trend label="تنش" unit="از ۱۰" rows={checkins} valueOf={(entry) => entry.stress} />
            <Trend label="وزن" unit="کیلوگرم" rows={checkins} valueOf={(entry) => entry.weightKg} />
          </div>

          <Panel className="mt-4">
            <SectionHeading
              title="چک‌این‌های اخیر"
              subtitle={`${faNumber(checkins.length)} روز ثبت‌شده`}
            />
            <div className="divide-y divide-border/60">
              {[...checkins].reverse().map((entry) => (
                <div
                  key={entry.date}
                  className="grid grid-cols-[90px_1fr_1fr_1fr] items-center gap-3 py-2 text-xs"
                >
                  <span className="num text-muted-foreground">{entry.date}</span>
                  <span>
                    خواب:{" "}
                    <span className="num font-semibold">
                      {entry.sleepHours === null ? "—" : faNumber(entry.sleepHours)}
                    </span>
                  </span>
                  <span>
                    تنش:{" "}
                    <span className="num font-semibold">
                      {entry.stress === null ? "—" : faNumber(entry.stress)}
                    </span>
                  </span>
                  <span>
                    آمادگی:{" "}
                    <span className="num font-semibold">
                      {entry.readiness === null ? "—" : faNumber(entry.readiness)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </AppShell>
  );
}

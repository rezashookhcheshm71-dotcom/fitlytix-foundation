/**
 * /coach/data-quality — «برنامهٔ هر ورزشکار بر چه مبنایی ساخته شده؟»
 *
 * One row per athlete: what they logged in the last 4 weeks (sessions, meals, check-ins), the
 * plan the model produced for them, and the completeness the model itself recorded. A plan with
 * zero behaviour data is not wrong, it is just generic — this screen makes that visible.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, Stat } from "@/components/domain/primitives";
import { useCoachInsights } from "@/hooks/use-coach-insights";
import { faNumber } from "@/lib/locale";

export const Route = createFileRoute("/coach/data-quality")({
  head: () => ({
    meta: [
      { title: "کیفیت دادهٔ ورزشکاران — FitLytix" },
      {
        name: "description",
        content:
          "هر ورزشکار در ۴ هفتهٔ گذشته چند جلسه، وعده و چک‌این ثبت کرده و برنامهٔ او بر چه مبنایی ساخته شده است.",
      },
      { property: "og:title", content: "کیفیت دادهٔ ورزشکاران — FitLytix" },
      { property: "og:description", content: "شفافیت دادهٔ پشت هر برنامهٔ پیشنهادی." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CoachDataQuality,
});

const LEVEL_LABEL = { good: "خوب", fair: "متوسط", poor: "ضعیف" } as const;
const LEVEL_COLOR = { good: "#16a34a", fair: "#d97706", poor: "#dc2626" } as const;

const percent = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)}٪`);

function CoachDataQuality() {
  const { status, data, error, reload } = useCoachInsights();

  return (
    <AppShell mode="coach" userName="مربی" userRole="مربی">
      <PageHeader
        eyebrow="شفافیت داده"
        title="کیفیت دادهٔ ورزشکاران"
        description="هر برنامه بر پایهٔ داده‌ای ساخته می‌شود که واقعاً وجود دارد. اینجا می‌بینید کدام ورزشکار داده کافی می‌دهد و کدام برنامه هنوز عمومی است."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/coach/insights">
              گزارش عملکرد آرکیتایپ‌ها <ArrowLeft className="ms-1 size-3.5" />
            </Link>
          </Button>
        }
      />

      {status === "loading" ? <Panel>در حال خواندن داده از دیتابیس…</Panel> : null}

      {status === "forbidden" || status === "error" ? (
        <Panel className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-destructive">
            <AlertTriangle className="size-4" /> {error}
          </div>
          <Button size="sm" variant="outline" onClick={() => void reload()}>
            تلاش دوباره
          </Button>
        </Panel>
      ) : null}

      {status === "ready" && data ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Panel>
              <Stat label="ورزشکاران" value={faNumber(data.summary.athletes)} />
            </Panel>
            <Panel>
              <Stat
                label="با سابقهٔ تمرین ۲۸ روز"
                value={faNumber(data.summary.withSessions)}
                tone="info"
              />
            </Panel>
            <Panel>
              <Stat label="با ثبت تغذیه" value={faNumber(data.summary.withMeals)} tone="info" />
            </Panel>
            <Panel>
              <Stat
                label="با چک‌این ۱۴ روز"
                value={faNumber(data.summary.withCheckins)}
                tone="success"
              />
            </Panel>
            <Panel>
              <Stat
                label="برنامه‌های برچسب‌خورده"
                value={`${faNumber(data.summary.labelledPlans)} / ${faNumber(data.summary.plans)}`}
                tone="primary"
              />
            </Panel>
          </div>

          <Panel className="overflow-x-auto">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-bold">جدول کیفیت داده</h2>
                <p className="text-xs text-muted-foreground">
                  امتیاز = ۴۰٪ جلسات + ۳۰٪ روزهای تغذیه + ۳۰٪ چک‌این‌ها (نسبت به هدف ۱۲ جلسه / ۲۰
                  روز / ۱۴ چک‌این)
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => void reload()}>
                به‌روزرسانی
              </Button>
            </div>

            {data.athletes.length === 0 ? (
              <p className="text-sm text-muted-foreground">هنوز ورزشکاری در دیتابیس نیست.</p>
            ) : (
              <table className="w-full min-w-[820px] text-right text-xs">
                <thead className="text-[11px] text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 font-semibold">ورزشکار</th>
                    <th className="py-2 font-semibold">جلسات ۲۸ روز</th>
                    <th className="py-2 font-semibold">RPE</th>
                    <th className="py-2 font-semibold">روزهای تغذیه</th>
                    <th className="py-2 font-semibold">چک‌این ۱۴ روز</th>
                    <th className="py-2 font-semibold">خواب / آمادگی</th>
                    <th className="py-2 font-semibold">برنامهٔ فعلی</th>
                    <th className="py-2 font-semibold">کامل‌بودن داده</th>
                    <th className="py-2 font-semibold">پایبندی اندازه‌گیری‌شده</th>
                    <th className="py-2 font-semibold">امتیاز</th>
                  </tr>
                </thead>
                <tbody>
                  {data.athletes.map((athlete) => (
                    <tr key={athlete.userId} className="border-b border-border/60">
                      <td className="py-2">
                        <div className="font-semibold">{athlete.name}</div>
                        <div className="text-[10px] text-muted-foreground">{athlete.email}</div>
                      </td>
                      <td className="num py-2">
                        {faNumber(athlete.sessionsCompleted28d)}/{faNumber(athlete.sessions28d)}
                      </td>
                      <td className="num py-2">
                        {athlete.avgRpe === null
                          ? "—"
                          : faNumber(athlete.avgRpe, { maximumFractionDigits: 1 })}
                      </td>
                      <td className="num py-2">{faNumber(athlete.mealDays28d)}</td>
                      <td className="num py-2">{faNumber(athlete.checkins14d)}</td>
                      <td className="num py-2">
                        {athlete.avgSleep14d === null
                          ? "—"
                          : faNumber(athlete.avgSleep14d, { maximumFractionDigits: 1 })}
                        h /{" "}
                        {athlete.avgReadiness14d === null
                          ? "—"
                          : faNumber(athlete.avgReadiness14d, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="py-2">
                        {athlete.archetypeId ? (
                          <div className="space-y-0.5">
                            <div className="font-semibold">{athlete.archetypeId}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {athlete.sport} · اعتماد {athlete.confidence ?? "—"}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">بدون برنامه</span>
                        )}
                      </td>
                      <td className="num py-2">{percent(athlete.dataCompleteness)}</td>
                      <td className="num py-2">{percent(athlete.measuredAdherence)}</td>
                      <td className="py-2">
                        <Badge
                          variant="outline"
                          style={{
                            borderColor: LEVEL_COLOR[athlete.level],
                            color: LEVEL_COLOR[athlete.level],
                          }}
                        >
                          {LEVEL_LABEL[athlete.level]} · {Math.round(athlete.score * 100)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel className="mt-4">
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 text-primary" />
              <p>
                ورزشکاری که فقط ارزیابی داده، برنامهٔ درستی دریافت می‌کند اما شخصی‌سازی‌شده با
                تاریخچه نیست. با ثبت روزانهٔ تمرین/تغذیه/چک‌این، همان برنامه دقیق‌تر و سقف جلسات
                هفتگی واقع‌بینانه‌تر می‌شود.
              </p>
            </div>
          </Panel>
        </>
      ) : null}
    </AppShell>
  );
}

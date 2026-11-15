/**
 * /coach/insights — «کدام آرکیتایپ واقعاً جواب می‌دهد؟»
 *
 * Joins stored plans with their measured outcomes and ranks archetypes by realised adherence.
 * Nothing here is simulated: rows only appear once an athlete has logged behaviour for a few
 * days after the plan was generated.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, ArrowLeft, BarChart3 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, Stat } from "@/components/domain/primitives";
import { useCoachInsights } from "@/hooks/use-coach-insights";
import { faNumber } from "@/lib/locale";

export const Route = createFileRoute("/coach/insights")({
  head: () => ({
    meta: [
      { title: "گزارش عملکرد آرکیتایپ‌ها — FitLytix" },
      {
        name: "description",
        content:
          "کدام الگوی برنامه در واقعیت پایبندی و بازخورد بهتری ساخته است؛ بر اساس داده‌های ثبت‌شدهٔ ورزشکاران.",
      },
      { property: "og:title", content: "گزارش عملکرد آرکیتایپ‌ها — FitLytix" },
      { property: "og:description", content: "مقایسهٔ آرکیتایپ‌های مدل با پایبندی واقعی." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CoachInsights,
});

const percent = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)}٪`);

const SPORT_FA: Record<string, string> = {
  crossfit: "کراسفیت",
  hyrox: "هایروکس",
  functional: "فانکشنال",
  bodybuilding: "بدنسازی",
  running: "دویدن",
};

function CoachInsights() {
  const { status, data, error, reload } = useCoachInsights();
  const archetypes = data?.archetypes ?? [];
  const ranked = [...archetypes].sort((a, b) => (b.avgAdherence ?? -1) - (a.avgAdherence ?? -1));
  const enough = ranked.filter((row) => row.labelled >= 3);

  return (
    <AppShell mode="coach" userName="مربی" userRole="مربی">
      <PageHeader
        eyebrow="گزارش تحلیلی"
        title="عملکرد آرکیتایپ‌ها در واقعیت"
        description="برنامه‌ای که در دفتر خوب به‌نظر می‌رسد ممکن است در هفتهٔ سوم رها شود. این صفحه پایبندی واقعیِ هر الگو را نشان می‌دهد."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/coach/data-quality">
              کیفیت دادهٔ ورزشکاران <ArrowLeft className="ms-1 size-3.5" />
            </Link>
          </Button>
        }
      />

      {status === "loading" ? <Panel>در حال محاسبه از دیتابیس…</Panel> : null}

      {status === "forbidden" || status === "error" ? (
        <Panel className="space-y-3">
          <p className="text-sm font-bold text-destructive">{error}</p>
          <Button size="sm" variant="outline" onClick={() => void reload()}>
            تلاش دوباره
          </Button>
        </Panel>
      ) : null}

      {status === "ready" && data ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Panel>
              <Stat label="برنامه‌های ساخته‌شده" value={faNumber(data.summary.plans)} />
            </Panel>
            <Panel>
              <Stat
                label="برنامه‌های برچسب‌خورده"
                value={faNumber(data.summary.labelledPlans)}
                tone="primary"
              />
            </Panel>
            <Panel>
              <Stat
                label="میانگین پایبندی واقعی"
                value={percent(data.summary.avgAdherence)}
                tone="success"
              />
            </Panel>
            <Panel>
              <Stat label="آرکیتایپ‌های با ≥۳ نمونه" value={faNumber(enough.length)} tone="info" />
            </Panel>
          </div>

          {ranked.length === 0 ? (
            <Panel className="space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <BarChart3 className="size-4 text-primary" /> هنوز نتیجه‌ای اندازه‌گیری نشده
              </div>
              <p className="text-sm leading-7 text-muted-foreground">
                برچسب نتیجه وقتی ساخته می‌شود که ورزشکار بعد از ساخت برنامه حداقل سه روز
                جلسه/وعده/چک‌این ثبت کند. تا آن زمان این جدول خالی می‌ماند و گزارش فقط بر پایهٔ
                پیش‌بینی مدل است — نه واقعیت.
              </p>
            </Panel>
          ) : (
            <Panel className="overflow-x-auto">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-bold">رتبه‌بندی بر اساس پایبندی واقعی</h2>
                  <p className="text-xs text-muted-foreground">
                    ستون «نمونه» تعداد برنامه‌های برچسب‌خورده است؛ زیر ۳ نمونه را جدی نگیرید.
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => void reload()}>
                  به‌روزرسانی
                </Button>
              </div>
              <table className="w-full min-w-[720px] text-right text-xs">
                <thead className="text-[11px] text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 font-semibold">آرکیتایپ</th>
                    <th className="py-2 font-semibold">رشته</th>
                    <th className="py-2 font-semibold">برنامه‌ها</th>
                    <th className="py-2 font-semibold">نمونهٔ برچسب‌خورده</th>
                    <th className="py-2 font-semibold">پایبندی واقعی</th>
                    <th className="py-2 font-semibold">پایبندی تغذیه</th>
                    <th className="py-2 font-semibold">RPE</th>
                    <th className="py-2 font-semibold">دوره‌های کامل‌شده</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((row) => (
                    <tr
                      key={`${row.sport}-${row.archetypeId}`}
                      className="border-b border-border/60"
                    >
                      <td className="py-2 font-semibold">{row.archetypeId}</td>
                      <td className="py-2 text-muted-foreground">
                        {SPORT_FA[row.sport] ?? row.sport}
                      </td>
                      <td className="num py-2">{faNumber(row.plans)}</td>
                      <td className="num py-2">{faNumber(row.labelled)}</td>
                      <td className="num py-2 font-bold">{percent(row.avgAdherence)}</td>
                      <td className="num py-2">{percent(row.avgNutritionAdherence)}</td>
                      <td className="num py-2">
                        {row.avgRpe === null
                          ? "—"
                          : faNumber(row.avgRpe, { maximumFractionDigits: 1 })}
                      </td>
                      <td className="num py-2">{faNumber(row.completedCycles)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}

          <Panel className="mt-4">
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Activity className="mt-0.5 size-4 text-primary" />
              <p>
                تفسیر ورزشی: اگر آرکیتایپ پرحجم در هفتهٔ سوم رها می‌شود، مقصر ورزشکار نیست؛ بار
                تمرین با زندگی واقعی او نمی‌خواند. این جدول همان بازخوردی است که بعداً در بازآموزی
                مدل استفاده می‌شود.
              </p>
            </div>
          </Panel>
        </>
      ) : null}
    </AppShell>
  );
}

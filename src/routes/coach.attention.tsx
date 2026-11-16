/**
 * «نیاز به توجه» — built from what athletes actually did (or stopped doing).
 *
 * Each row is one nudge the athlete themselves received, so the coach and the athlete are
 * looking at the same fact. There is no readiness score here and no ranking of people: only
 * "who has been silent, and what is the smallest useful next step".
 */
import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Eye } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, Panel, Pill, SectionHeading, Stat } from "@/components/domain/primitives";
import { Button } from "@/components/ui/button";
import { useCoachAttention } from "@/hooks/use-coach-attention";
import { getCurrentUser, type SessionUserDto } from "@/lib/auth";
import { faNumber } from "@/lib/locale";

export const Route = createFileRoute("/coach/attention")({
  head: () => ({
    meta: [
      { title: "نیاز به توجه — مربی FitLytix" },
      {
        name: "description",
        content: "ورزشکارانی که چند روز است چیزی ثبت نکرده‌اند، بر پایهٔ دادهٔ واقعی.",
      },
      { property: "og:title", content: "نیاز به توجه — مربی FitLytix" },
      {
        property: "og:description",
        content: "ورزشکارانی که چند روز است چیزی ثبت نکرده‌اند، بر پایهٔ دادهٔ واقعی.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AttentionPage,
});

function AttentionPage() {
  const { status, data, reload } = useCoachAttention();
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

  const coachName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "مربی";

  return (
    <AppShell mode="coach" userName={coachName} userRole="مربی">
      <PageHeader
        eyebrow="نیاز به توجه"
        title="امروز اول سراغ این‌ها برو"
        description="هر مورد از یک واقعیت ثبت‌شده می‌آید: چند روز است جلسه، چک‌این یا وعده‌ای ثبت نشده. تصمیم نهایی با توست."
        actions={
          <Button variant="outline" size="sm" onClick={() => void reload()}>
            به‌روزرسانی
          </Button>
        }
      />

      {status === "loading" && (
        <Panel className="text-center text-sm text-muted-foreground">در حال خواندن داده‌ها…</Panel>
      )}

      {status === "forbidden" && (
        <Panel className="text-center text-sm text-muted-foreground">
          این صفحه فقط برای حساب مربی است.
        </Panel>
      )}

      {status === "error" && (
        <Panel className="text-center text-sm">
          خواندن فهرست ناموفق بود.
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={() => void reload()}>
              تلاش دوباره
            </Button>
          </div>
        </Panel>
      )}

      {status === "ready" && data && (
        <>
          <section className="mb-6 grid gap-3 sm:grid-cols-4">
            <Stat label="ورزشکار" value={faNumber(data.summary.athletes)} />
            <Stat label="اقدام امروز" value={faNumber(data.summary.act)} />
            <Stat label="زیر نظر" value={faNumber(data.summary.watch)} />
            <Stat label="بی‌نیاز از پیگیری" value={faNumber(data.summary.quiet)} />
          </section>

          {data.items.length === 0 ? (
            <Panel className="text-center text-sm text-muted-foreground">
              {data.summary.athletes === 0
                ? "هنوز ورزشکاری در حساب شما نیست."
                : "همهٔ ورزشکارها در سه روز گذشته چیزی ثبت کرده‌اند؛ امروز پیگیری لازم نیست."}
            </Panel>
          ) : (
            <section>
              <SectionHeading title="فهرست پیگیری" subtitle="اقدام‌ها اول، بعد موارد زیر نظر" />
              <div className="space-y-3">
                {data.items.map((item) => (
                  <Panel
                    key={item.id}
                    className={item.severity === "act" ? "border-destructive/30" : undefined}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-start gap-3">
                        {item.severity === "act" ? (
                          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                        ) : (
                          <Eye className="mt-0.5 size-4 shrink-0 text-warning" />
                        )}
                        <div>
                          <Link
                            to="/coach/athlete/$id"
                            params={{ id: item.athleteId }}
                            className="font-bold hover:text-primary"
                          >
                            {item.athleteName}
                          </Link>
                          <p className="text-xs text-muted-foreground">{item.detailFa}</p>
                          <p className="num mt-1 text-[11px] text-muted-foreground">
                            {item.silentDaysFa}
                          </p>
                        </div>
                      </div>
                      <Pill
                        color={item.severity === "act" ? "var(--destructive)" : "var(--warning)"}
                      >
                        {item.severity === "act" ? "اقدام" : "زیر نظر"}
                      </Pill>
                    </div>
                    <p className="mt-3 rounded-lg bg-muted/40 p-3 text-sm">
                      قدم بعدی: {item.actionFa}
                    </p>
                  </Panel>
                ))}
              </div>
            </section>
          )}

          <p className="mt-6 flex items-start gap-2 text-xs leading-6 text-muted-foreground">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            این فهرست فقط واقعیت‌ها را می‌گوید؛ عدد آمادگی یا امتیاز ورزشکار در آن ساخته نمی‌شود.
          </p>
        </>
      )}
    </AppShell>
  );
}

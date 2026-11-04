import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Circle } from "lucide-react";
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { Bar, MockBadge, PageHeader, Panel, Pill } from "@/components/domain/primitives";
import { JourneyBar } from "@/components/domain/coaching";
import { SPORTS } from "@/domain/sports";
import { demoAthlete } from "@/mock/athlete";
import { getCurrentUser, type SessionUserDto } from "@/lib/auth";
import { goalsService } from "@/services/goals/service";

export const Route = createFileRoute("/athlete/goals")({
  validateSearch: (s) =>
    z
      .object({
        sport: z.enum(["crossfit", "hyrox", "functional", "bodybuilding", "running"]).optional(),
      })
      .parse(s),
  head: () => ({
    meta: [
      { title: "هدف‌ها و مسیر — FitLytix" },
      { name: "description", content: "هدف‌ها، مایل‌استون‌ها و تمرکز این هفته در مسیر ورزشی‌ات." },
      { property: "og:title", content: "هدف‌ها و مسیر — FitLytix" },
      {
        property: "og:description",
        content: "هدف‌ها، مایل‌استون‌ها و تمرکز این هفته در مسیر ورزشی‌ات.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GoalsPage,
});

function GoalsPage() {
  // The sport fallback only picks which set of labels to show, exactly like the
  // scopingLevel case in the sport assessment: it scopes the view and is never
  // persisted or presented as the athlete's own choice.
  const sport = Route.useSearch().sport ?? demoAthlete.primarySport;

  // P35: identity comes from the session. This page used to greet the visitor as
  // demoAthlete and ask for his goals.
  const [sessionUser, setSessionUser] = useState<SessionUserDto | null>(null);
  useEffect(() => {
    let active = true;
    getCurrentUser().then(({ user }) => {
      if (active && user) setSessionUser(user);
    });
    return () => {
      active = false;
    };
  }, []);

  const athleteId = sessionUser?.athleteId ?? "";
  const goals = goalsService.list(athleteId, sport);
  const name = sessionUser
    ? `${sessionUser.firstName} ${sessionUser.lastName}`.trim() || "کاربر"
    : "وارد نشده";

  return (
    <AppShell
      mode="athlete"
      userName={name}
      userRole={SPORTS[sport].name}
      userId={sessionUser?.id ?? null}
    >
      <PageHeader
        eyebrow="هدف‌ها"
        title="به کجا می‌خواهی برسی؟"
        description="هر هدف چند قدم مشخص دارد؛ این هفته فقط روی قدم بعدی تمرکز کن."
        actions={<MockBadge label="ذخیره‌سازیِ هدف هنوز وصل نیست" />}
      />
      <div className="space-y-4">
        {/* Law 1: an honest empty state that says what is missing and why. This
            used to render fabricated goals - one sample person's targets with the
            visitor's own id stamped over them. */}
        {goals.length === 0 && (
          <Panel data-empty-state="goals">
            <h2 className="text-base font-bold">هنوز هدفی ثبت نشده</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              دو چیز کم است: اول اینکه هیچ هدفی برایِ حسابِ تو ثبت نشده، و دوم اینکه{" "}
              <span className="font-semibold text-foreground">
                ذخیره‌سازیِ هدف‌ها هنوز وصل نیست
              </span>{" "}
              - یعنی حتی اگر هدفی هم تعیین کنی، جایی ماندگار نمی‌شود. تا اتصالِ جدولِ هدف‌ها این بخش
              خالی می‌ماند و ما هم هدفِ نمونه را به‌جایِ هدفِ تو جا نمی‌زنیم.
            </p>
          </Panel>
        )}
        {goals.map((g) => (
          <Panel key={g.id}>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold">{g.title}</h2>
                <p className="num text-xs text-muted-foreground">
                  الان: {g.current} · هدف: {g.target}
                  {g.deadline ? ` · تا ${g.deadline}` : ""}
                </p>
              </div>
              <Pill color={g.status === "at_risk" ? "var(--warning)" : "var(--success)"}>
                {g.status === "at_risk"
                  ? "نیاز به توجه"
                  : g.status === "done"
                    ? "انجام شد"
                    : "در مسیر"}
              </Pill>
            </div>
            <Bar value={g.progress} />
            <div className="my-5">
              <JourneyBar stage={goalsService.journeyStage(g)} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <ul className="space-y-2">
                {g.milestones.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 text-sm">
                    {m.done ? (
                      <CheckCircle2 className="size-4 text-success" />
                    ) : (
                      <Circle className="size-4 text-muted-foreground" />
                    )}
                    <span className={m.done ? "" : "text-muted-foreground"}>{m.title}</span>
                    {m.date && (
                      <span className="num text-[10px] text-muted-foreground">{m.date}</span>
                    )}
                  </li>
                ))}
              </ul>
              <div className="rounded-xl bg-primary-soft p-4">
                <div className="text-xs font-bold text-primary">تمرکز این هفته</div>
                <p className="mt-1 text-sm leading-7">{g.weeklyFocus}</p>
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </AppShell>
  );
}

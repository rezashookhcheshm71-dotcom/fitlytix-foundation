import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Clock, Play, Target } from "lucide-react";
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Bar, MockBadge, Panel, Pill, SectionHeading, Stat } from "@/components/domain/primitives";
import { DnaRadarChart } from "@/components/domain/charts";
import { BodyChangesPanel } from "@/components/domain/body-analysis";
import { AddBodyAnalysisDialog } from "@/components/domain/body-analysis-dialog";
import type { BodyAnalysisRecord } from "@/domain/body-analysis";
import { SPORTS, SPORT_LIST } from "@/domain/sports";
import type { SportId } from "@/domain/types";
import { getCurrentUser, type SessionUserDto } from "@/lib/auth";
import { assessmentEngine } from "@/services/assessment/engine";
import { athleteDashboardService } from "@/services/athlete/dashboard";
import { bodyAnalysisService } from "@/services/body-analysis/service";
import { demoAthlete } from "@/mock/athlete";
import { CoachCards, JourneyBar, PackageNotice, ReadinessCard } from "@/components/domain/coaching";
import { DashboardSlideshow } from "@/components/domain/dashboard-slides";
import { HealthDataPanel } from "@/components/domain/health-data";
import { HealthTrendsPanel } from "@/components/domain/health-trends";
import { useAthleteHealth } from "@/lib/athlete-health";
import { RecoverySnapshot } from "@/components/domain/recovery-snapshot";
import { decisionEngine } from "@/services/decision-engine/service";
import { goalsService } from "@/services/goals/service";
import { nutritionService } from "@/services/nutrition/service";
import { subscriptionService } from "@/services/subscriptions/service";

// Every enum search param in this app ends in .catch(undefined). TanStack Router
// pre-parses the query string as JSON and then validates it, so a value outside the
// enum used to throw and return HTTP 500 for the whole page - a mistyped link, a
// stale bookmark or a crawler probe took the screen down. .catch drops just that one
// field and leaves the rest of the object validated, so an unrecognised filter means
// "no filter" rather than "no page".
const searchSchema = z.object({
  sport: z
    .enum(["crossfit", "hyrox", "functional", "bodybuilding", "running"])
    .optional()
    .catch(undefined),
  body: z.enum(["empty", "single"]).optional().catch(undefined),
  pkg: z.enum(["training", "nutrition", "combined"]).optional().catch(undefined),
  health: z.enum(["empty"]).optional().catch(undefined),
  // Design preview for the slideshow. Unlike body=empty, which only removes real
  // data, this one invents content, so it is gated on the dev build below and is
  // inert in production.
  slides: z.enum(["demo"]).optional().catch(undefined),
});

export const Route = createFileRoute("/athlete/dashboard")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "داشبورد ورزشکار — FitLytix" },
      {
        name: "description",
        content: "تمرین امروز، ریکاوری و پروفایل عملکرد متناسب با رشته ورزشی.",
      },
      { property: "og:title", content: "داشبورد ورزشکار — FitLytix" },
      {
        property: "og:description",
        content: "تمرین امروز، ریکاوری و پروفایل عملکرد متناسب با رشته ورزشی.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AthleteDashboard,
});

function AthleteDashboard() {
  const { sport: selectedSport, body, pkg, health, slides } = Route.useSearch();
  // Dev-only design preview. Feeding the flag to the hook rather than to each
  // component means every health-driven panel here lights up from one dataset.
  const demoSlides = slides === "demo" && import.meta.env.DEV;
  const [healthVersion, setHealthVersion] = useState(0);
  const [sessionUser, setSessionUser] = useState<SessionUserDto | null>(null);
  const [persistedSport, setPersistedSport] = useState<SportId | null>(null);
  const [persistedBodyRecords, setPersistedBodyRecords] = useState<BodyAnalysisRecord[] | null>(
    null,
  );
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    getCurrentUser().then(({ user }) => {
      if (!active || !user) return;
      setSessionUser(user);
    });
    assessmentEngine.loadCurrentState().then((state) => {
      if (!active || !state.authenticated) return;
      if (state.primarySport) setPersistedSport(state.primarySport);
      if (state.bodyRecords && state.bodyRecords.length > 0) {
        setPersistedBodyRecords(state.bodyRecords);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const sport: SportId = selectedSport ?? persistedSport ?? demoAthlete.primarySport;
  // P35: identity no longer falls back to the demo athlete. Substituting his name
  // and id when there is no session is the same fabrication F2 removed from sport
  // and experience level - it reports a person who is not there. An empty string
  // and a null name are honest; "ath_001" is not.
  const activeAthleteId = sessionUser?.athleteId ?? "";
  // Passed the real id even though the adapter currently ignores it, so the call
  // says the truth about whose snapshot is being asked for.
  const data = athleteDashboardService.getSnapshot(activeAthleteId, sport);
  const sportMeta = SPORTS[sport];
  const firstName: string | null = sessionUser?.firstName?.trim() || null;
  const name = sessionUser
    ? `${sessionUser.firstName} ${sessionUser.lastName}`.trim() || "کاربر"
    : "وارد نشده";
  // Real health evidence for the recovery panel and the trends list. One fetch,
  // shared, so the two views cannot disagree.
  const athleteHealth = useAthleteHealth(healthVersion, demoSlides);
  const [addOpen, setAddOpen] = useState(false);
  const [bodyVersion, setBodyVersion] = useState(0);
  const bodyRecords = useMemo(() => {
    const all =
      persistedBodyRecords && persistedBodyRecords.length > 0
        ? persistedBodyRecords
        : bodyAnalysisService.list(demoAthlete.id);
    // Demo-only views for QA: ?body=empty | ?body=single
    return body === "empty" ? [] : body === "single" ? all.slice(-1) : all;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, bodyVersion, persistedBodyRecords]);
  const pack = subscriptionService.getPackage(demoAthlete.id, pkg);
  // `healthVersion` used to be listed here (with an eslint-disable) so ctx would
  // recompute after a manual health entry changed the in-memory service. P35 moved
  // that write to the database, so bumping the version can no longer change what
  // this mock returns - the dependency was dead, and the disable that hid it went
  // with it.
  const ctx = useMemo(() => decisionEngine.context(demoAthlete.id, sport, pkg), [sport, pkg]);
  const recs = decisionEngine.recommend(ctx);
  const goal = goalsService.primary(demoAthlete.id, sport);
  const nutritionPlan = nutritionService.getDailyPlan(
    demoAthlete.id,
    ctx.readiness.level === "ready" ? "hard" : "training",
  );

  return (
    <AppShell
      mode="athlete"
      userName={name}
      userRole={`${sportMeta.name} · ${data.level}`}
      userId={sessionUser?.id ?? null}
    >
      {/* P35: this dashboard mixes two kinds of content and used to look uniform,
          so a visitor could not tell which numbers were theirs. The program,
          performance and package sections are read from a static per-sport demo
          snapshot that is identical for every account - athleteDashboardService
          discards the athlete id entirely. Saying so is cheaper than implying
          ownership of someone else's training week. */}
      <div
        className="mb-5 rounded-xl border border-warning/40 bg-warning/5 p-3 text-xs leading-6"
        data-demo-scope="snapshot"
      >
        <span className="font-bold">بخش‌هایِ نمونه:</span> برنامه، پروفایلِ عملکرد و بسته از یک
        داده‌یِ نمایشیِ ثابت خوانده می‌شوند که برایِ همه‌یِ حساب‌ها یکسان است و{" "}
        <span className="font-semibold">مالِ تو نیست</span>.{" "}
        <span className="font-bold text-foreground">بخش‌هایِ واقعی:</span> روندها و ریکاوری از
        ثبت‌هایِ خودت در پایگاهِ داده خوانده می‌شوند.
      </div>
      <div className="mb-5 flex flex-wrap gap-2 pb-1" aria-label="نمایش نمونه رشته">
        {SPORT_LIST.map((item) => (
          <Button
            key={item.id}
            size="sm"
            variant={sport === item.id ? "default" : "outline"}
            onClick={() =>
              navigate({ to: "/athlete/dashboard", search: { sport: item.id }, replace: true })
            }
          >
            {item.name}
          </Button>
        ))}
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-2" aria-label="بسته نمایشی">
        <span className="text-[11px] text-muted-foreground">بسته (نمایشی):</span>
        {(["training", "nutrition", "combined"] as const).map((id) => (
          <Button
            key={id}
            size="sm"
            variant={pack.id === id ? "secondary" : "ghost"}
            onClick={() =>
              navigate({ to: "/athlete/dashboard", search: { sport, pkg: id }, replace: true })
            }
          >
            {subscriptionService.getPackage(demoAthlete.id, id).name}
          </Button>
        ))}
      </div>

      {/* P21: the dashboard slideshow sits above the coach cards. Its slides
          are built from the real health payload, and the one slide that cannot
          be - position within the reference range - says why instead of guessing. */}
      <DashboardSlideshow health={athleteHealth} />

      <CoachCards recs={recs} />

      {goal && (
        <Panel className="mb-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold text-muted-foreground">هدف اصلی</span>
              <h2 className="font-bold">{goal.title}</h2>
            </div>
            <Link
              to="/athlete/goals"
              search={{ sport }}
              className="text-xs font-semibold text-primary"
            >
              همه هدف‌ها
            </Link>
          </div>
          <JourneyBar stage={goalsService.journeyStage(goal)} />
        </Panel>
      )}

      {!pack.includes.training && (
        <section className="mb-6 grid gap-4 lg:grid-cols-2">
          <PackageNotice included={false} what="training" />
          <ReadinessCard r={ctx.readiness} />
        </section>
      )}

      {pack.includes.training && (
        <>
          <section className="mb-6 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-carbon p-6 ring-1 ring-border md:p-8 animate-rise">
              <div className="relative">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>امروز</span>
                  <span>·</span>
                  <MockBadge label="پیشنهاد نمایشی" />
                </div>
                <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">
                  {firstName ? `سلام ${firstName}` : "سلام"}
                </h1>
                <div className="mt-4 flex items-start gap-3 rounded-xl bg-background/50 p-4 ring-1 ring-border/70">
                  <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <Target className="size-4" />
                  </span>
                  <div>
                    <div className="text-xs font-bold text-primary">تمرکز امروز</div>
                    <p className="mt-1 text-sm leading-7">{data.focus}</p>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Button asChild variant="hero" size="lg">
                    <Link to="/athlete/program">
                      <Play /> شروع تمرین امروز
                    </Link>
                  </Button>
                  <span className="font-mono inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="size-4" /> {data.workout.duration} دقیقه
                  </span>
                </div>
              </div>
            </div>
            <Panel className="flex flex-col animate-rise [animation-delay:80ms]">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">جلسه بعدی</span>
                <Pill color={`var(${sportMeta.colorToken})`}>امروز</Pill>
              </div>
              <h2 className="font-display text-lg font-bold">{data.workout.title}</h2>
              <p className="text-xs text-muted-foreground">{data.workout.detail}</p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                {data.workout.blocks.map((block, index) => (
                  <div
                    key={block}
                    className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs"
                  >
                    <span className="font-mono text-muted-foreground">{index + 1}</span>
                    <span>{block}</span>
                  </div>
                ))}
              </div>
              <Link
                to="/athlete/program"
                className="mt-auto inline-flex items-center gap-1 pt-5 text-xs font-semibold text-primary"
              >
                دیدن جزئیات <ArrowLeft className="size-3.5" />
              </Link>
            </Panel>
          </section>

          <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Panel>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">برنامه فعلی</span>
                <Pill>{data.program.phase}</Pill>
              </div>
              <h2 className="font-display text-lg font-bold">{data.program.name}</h2>
              <div className="mt-5 flex justify-between text-xs">
                <span>
                  هفته {data.program.week} از {data.program.totalWeeks}
                </span>
                <span className="font-mono text-muted-foreground">
                  {Math.round((data.program.week / data.program.totalWeeks) * 100)}٪
                </span>
              </div>
              <Bar
                value={data.program.week / data.program.totalWeeks}
                className="mt-2"
                color={`var(${sportMeta.colorToken})`}
              />
              <div className="mt-5 grid grid-cols-3 gap-2">
                {data.metrics.map((metric) => (
                  <Stat
                    key={metric.label}
                    label={metric.label}
                    value={metric.value}
                    unit={metric.note}
                  />
                ))}
              </div>
            </Panel>
            <Panel>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">ریکاوری</span>
                {/* P35: this used to be an unconditional <Pill>آماده</Pill>. A verdict
                    with no measurement behind it is a fabricated result, so it is
                    gone; RecoverySnapshot shows real values and grades nothing. */}
              </div>
              <RecoverySnapshot health={athleteHealth} />
            </Panel>
            <Panel className="md:col-span-2 xl:col-span-1">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">پروفایل عملکرد</span>
                <Link
                  to="/athlete/fitness-dna"
                  search={{ sport }}
                  className="text-xs font-semibold text-primary"
                >
                  نمای کامل
                </Link>
              </div>
              <h2 className="font-bold">{data.dna.archetype}</h2>
              <DnaRadarChart dimensions={data.dna.dimensions} height={210} compact />
            </Panel>
          </section>
        </>
      )}

      {pack.includes.nutrition ? (
        <Panel className="mb-6">
          <SectionHeading
            title="تغذیه امروز"
            subtitle={nutritionPlan.notes[0]}
            action={{ label: "برنامه کامل", to: "/athlete/nutrition" }}
          />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {nutritionPlan.meals.map((m) => (
              <div key={m.id} className="rounded-xl bg-muted/40 p-3">
                <div className="text-xs font-bold">{m.title}</div>
                <div className="text-[11px] text-muted-foreground">{m.timing}</div>
                <p className="mt-1 text-xs leading-6">{m.idea}</p>
              </div>
            ))}
          </div>
        </Panel>
      ) : (
        <div className="mb-6">
          <PackageNotice included={false} what="nutrition" />
        </div>
      )}

      {/* P35: real trends from health_metrics. The fabricated series this sits
          beside is the reason the panel exists. */}
      <HealthTrendsPanel version={healthVersion} demo={demoSlides} className="mb-4" />
      <HealthDataPanel
        athleteId={activeAthleteId}
        empty={health === "empty"}
        version={healthVersion}
        onChanged={() => setHealthVersion((v) => v + 1)}
      />

      <BodyChangesPanel records={bodyRecords} sport={sport} onAdd={() => setAddOpen(true)} />
      <AddBodyAnalysisDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        athleteId={activeAthleteId}
        onSaved={() => setBodyVersion((v) => v + 1)}
      />

      <section className="mb-6 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Panel>
          <SectionHeading title="برداشت این هفته" subtitle={sportMeta.name} />
          <div className="space-y-3">
            {data.dna.insights.map((insight) => (
              <div
                key={insight.label}
                className="grid grid-cols-[90px_1fr] gap-3 border-b border-border/60 pb-3 last:border-0"
              >
                <span className="text-xs font-semibold text-muted-foreground">{insight.label}</span>
                <p className="text-sm">{insight.text}</p>
              </div>
            ))}
          </div>
        </Panel>
        {pack.includes.training && (
          <Panel>
            <SectionHeading
              title="جلسات اخیر"
              subtitle="سه جلسه آخر"
              action={{ label: "تاریخچه", to: "/athlete/performance" }}
            />
            <div className="divide-y divide-border/60">
              {data.sessions.map((session) => (
                <div
                  key={`${session.date}-${session.title}`}
                  className="grid grid-cols-[75px_1fr_auto] items-center gap-3 py-3"
                >
                  <span className="text-xs text-muted-foreground">{session.date}</span>
                  <div>
                    <div className="text-sm font-semibold">{session.title}</div>
                    <div className="text-xs text-muted-foreground">{session.load}</div>
                  </div>
                  <span className="font-mono text-sm font-bold">{session.result}</span>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </section>
    </AppShell>
  );
}

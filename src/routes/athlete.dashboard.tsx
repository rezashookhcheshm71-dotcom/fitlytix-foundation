import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Clock, Moon, Play, Target, Zap } from "lucide-react";
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  Bar,
  MockBadge,
  Panel,
  Pill,
  ProgressRing,
  SectionHeading,
  Stat,
} from "@/components/domain/primitives";
import { DnaRadarChart, RecoveryBars } from "@/components/domain/charts";
import { BodyChangesPanel } from "@/components/domain/body-analysis";
import { AddBodyAnalysisDialog } from "@/components/domain/body-analysis-dialog";
import type { BodyAnalysisRecord } from "@/domain/body-analysis";
import { SPORTS, SPORT_LIST } from "@/domain/sports";
import type { SportId } from "@/domain/types";
import { getCurrentUser, type SessionUserDto } from "@/lib/auth";
import { faNumber } from "@/lib/locale";
import { assessmentEngine } from "@/services/assessment/engine";
import { athleteDashboardService } from "@/services/athlete/dashboard";
import { bodyAnalysisService } from "@/services/body-analysis/service";
import { demoAthlete } from "@/mock/athlete";
import { NudgeBanner } from "@/components/domain/nudge-banner";
import { usePlan } from "@/hooks/use-plan";
import { useAthleteOverview } from "@/hooks/use-athlete-overview";
import { CoachCards, JourneyBar, PackageNotice, ReadinessCard } from "@/components/domain/coaching";
import { PlanSummaryCard } from "@/components/domain/plan-summary";
import { DataEntryCard } from "@/components/domain/data-entry-card";
import { HealthDataPanel } from "@/components/domain/health-data";
import { decisionEngine } from "@/services/decision-engine/service";
import { goalsService } from "@/services/goals/service";
import { nutritionService } from "@/services/nutrition/service";
import { subscriptionService } from "@/services/subscriptions/service";

const searchSchema = z.object({
  sport: z.enum(["crossfit", "hyrox", "functional", "bodybuilding", "running"]).optional(),
  body: z.enum(["empty", "single"]).optional(),
  pkg: z.enum(["training", "nutrition", "combined"]).optional(),
  health: z.enum(["empty"]).optional(),
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
  const { sport: selectedSport, body, pkg, health } = Route.useSearch();
  const [healthVersion, setHealthVersion] = useState(0);
  const [sessionUser, setSessionUser] = useState<SessionUserDto | null>(null);
  const [persistedSport, setPersistedSport] = useState<SportId | null>(null);
  const [persistedBodyRecords, setPersistedBodyRecords] = useState<BodyAnalysisRecord[] | null>(
    null,
  );
  const navigate = useNavigate();
  const plan = usePlan();
  const overview = useAthleteOverview();

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

  const realWorkout = plan.data?.workout ?? null;
  const realPlan = plan.data?.plan ?? null;
  const realProgram = plan.data?.program ?? null;
  const recorded = overview.data;
  const sport: SportId =
    selectedSport ?? persistedSport ?? realPlan?.sport ?? demoAthlete.primarySport;
  const activeAthleteId = sessionUser?.athleteId ?? demoAthlete.id;
  const data = athleteDashboardService.getSnapshot(demoAthlete.id, sport);
  const programPhase = realProgram?.phase ?? data.program.phase;
  const programName = realProgram?.name ?? data.program.name;
  const weekIndex = realProgram?.weekIndex ?? data.program.week;
  const totalWeeks = realProgram?.totalWeeks ?? data.program.totalWeeks;
  const recovery = recorded?.recovery ?? null;
  const history = recorded?.recoveryHistory ?? [];
  const sportMeta = SPORTS[sport];
  const firstName = sessionUser?.firstName || demoAthlete.identity.firstName;
  const name = sessionUser
    ? `${sessionUser.firstName} ${sessionUser.lastName}`.trim()
    : `${demoAthlete.identity.firstName} ${demoAthlete.identity.lastName}`;
  const [addOpen, setAddOpen] = useState(false);
  const [bodyVersion, setBodyVersion] = useState(0);
  const bodyRecords = useMemo(() => {
    // Same pattern as the decision context below: the body-analysis dialog writes outside React.
    void bodyVersion;
    const all =
      persistedBodyRecords && persistedBodyRecords.length > 0
        ? persistedBodyRecords
        : bodyAnalysisService.list(demoAthlete.id);
    // Demo-only views for QA: ?body=empty | ?body=single
    return body === "empty" ? [] : body === "single" ? all.slice(-1) : all;
  }, [body, bodyVersion, persistedBodyRecords]);
  const pack = subscriptionService.getPackage(demoAthlete.id, pkg);
  const ctx = useMemo(() => {
    // `healthVersion` is read here on purpose: the health panel writes outside React, and this
    // recomputes the decision context once it has.
    void healthVersion;
    return decisionEngine.context(demoAthlete.id, sport, pkg);
  }, [sport, pkg, healthVersion]);
  const recs = decisionEngine.recommend(ctx);
  const goal = goalsService.primary(demoAthlete.id, sport);
  const nutritionPlan = nutritionService.getDailyPlan(
    demoAthlete.id,
    ctx.readiness.level === "ready" ? "hard" : "training",
  );

  return (
    <AppShell mode="athlete" userName={name} userRole={`${sportMeta.name} · ${data.level}`}>
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

      <NudgeBanner className="mb-6" nudges={recorded?.nudges ?? []} />

      <CoachCards recs={recs} />

      <PlanSummaryCard className="mb-6" />

      <DataEntryCard
        className="mb-6"
        onSaved={() => {
          void fetch("/api/plan", {
            method: "POST",
            credentials: "same-origin",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ force: true }),
          }).then(() => window.location.reload());
        }}
      />

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
                  {realWorkout ? <span>برنامهٔ شما</span> : <MockBadge label="پیشنهاد نمایشی" />}
                </div>
                <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">سلام {firstName}</h1>
                <div className="mt-4 flex items-start gap-3 rounded-xl bg-background/50 p-4 ring-1 ring-border/70">
                  <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <Target className="size-4" />
                  </span>
                  <div>
                    <div className="text-xs font-bold text-primary">تمرکز امروز</div>
                    <p className="mt-1 text-sm leading-7">{realWorkout?.focus ?? data.focus}</p>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Button asChild variant="hero" size="lg">
                    <Link to="/athlete/program">
                      <Play /> شروع تمرین امروز
                    </Link>
                  </Button>
                  <span className="font-mono inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="size-4" />{" "}
                    {realWorkout?.estimatedMin ?? data.workout.duration} دقیقه
                  </span>
                </div>
              </div>
            </div>
            <Panel className="flex flex-col animate-rise [animation-delay:80ms]">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">جلسه بعدی</span>
                <Pill color={`var(${sportMeta.colorToken})`}>امروز</Pill>
              </div>
              <h2 className="font-display text-lg font-bold">
                {realWorkout?.title ?? data.workout.title}
              </h2>
              <p className="text-xs text-muted-foreground">
                {realWorkout?.focus ?? data.workout.detail}
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                {(realWorkout
                  ? realWorkout.blocks.slice(0, 4).map((block) => block.title)
                  : data.workout.blocks
                ).map((block, index) => (
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
                <Pill>{programPhase}</Pill>
              </div>
              <h2 className="font-display text-lg font-bold">{programName}</h2>
              <div className="mt-5 flex justify-between text-xs">
                <span>
                  هفته {faNumber(weekIndex)} از {faNumber(totalWeeks)}
                </span>
                <span className="font-mono text-muted-foreground">
                  {faNumber(Math.round((weekIndex / Math.max(1, totalWeeks)) * 100))}٪
                </span>
              </div>
              <Bar
                value={weekIndex / Math.max(1, totalWeeks)}
                className="mt-2"
                color={`var(${sportMeta.colorToken})`}
              />
              <div className="mt-5 grid grid-cols-3 gap-2">
                {realPlan ? (
                  <>
                    <Stat
                      label="جلسه در هفته"
                      value={faNumber(realPlan.sessionsPerWeek)}
                      unit="جلسه"
                    />
                    <Stat
                      label="دقیقه هر جلسه"
                      value={faNumber(realPlan.sessionMinutes)}
                      unit="دقیقه"
                    />
                    <Stat
                      label="پایبندی چرخه"
                      value={`${faNumber(Math.round(realPlan.adherenceCycle * 100))}٪`}
                      unit="ثبت‌شده"
                    />
                  </>
                ) : (
                  data.metrics.map((metric) => (
                    <Stat
                      key={metric.label}
                      label={metric.label}
                      value={metric.value}
                      unit={metric.note}
                    />
                  ))
                )}
              </div>
            </Panel>
            <Panel>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">ریکاوری</span>
                {recovery ? (
                  <Pill color={recovery.isToday ? "var(--success)" : "var(--warning)"}>
                    {recovery.isToday ? "چک‌این امروز" : `آخرین چک‌این ${recovery.date}`}
                  </Pill>
                ) : (
                  <Pill color="var(--warning)">چک‌این نشده</Pill>
                )}
              </div>
              {recovery ? (
                <>
                  <div className="flex items-center gap-4">
                    <ProgressRing
                      value={recovery.readiness ?? 0}
                      size={88}
                      stroke={9}
                      color="var(--success)"
                    >
                      <span className="font-mono text-xl font-bold">
                        {recovery.readiness === null ? "—" : faNumber(recovery.readiness)}
                      </span>
                      <span className="text-[9px] text-muted-foreground">آمادگی</span>
                    </ProgressRing>
                    <div className="grid flex-1 grid-cols-2 gap-3">
                      <Mini
                        icon={Moon}
                        label="خواب"
                        value={recovery.sleepHours === null ? "—" : `${recovery.sleepHours} س`}
                      />
                      <Mini
                        icon={Zap}
                        label="تنش"
                        value={recovery.stress === null ? "—" : `${recovery.stress}`}
                      />
                      <Mini icon={Target} label="وضعیت" value={recovery.labelFa} />
                      <Mini icon={Clock} label="تاریخ" value={recovery.date} />
                    </div>
                  </div>
                  {history.length >= 2 && <RecoveryBars data={history} height={90} />}
                  <p className="mt-2 text-xs leading-6 text-muted-foreground">
                    این اعداد از چک‌این‌های خود شما می‌آید؛ اگر امروز ثبت نکرده‌اید، از کارت ثبت
                    داده انجام دهید.
                  </p>
                </>
              ) : (
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>هنوز چک‌اینی ثبت نکرده‌اید، پس عددی برای ریکاوری وجود ندارد.</p>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/athlete/program">ثبت چک‌این امروز</Link>
                  </Button>
                </div>
              )}
            </Panel>
            <Panel className="md:col-span-2 xl:col-span-1">
              <div className="mb-1 flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                  پروفایل عملکرد
                  <MockBadge label="نمایشی" />
                </span>
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

      <section className="mb-6 grid gap-3 sm:grid-cols-4">
        <Stat
          label="جلسهٔ ثبت‌شده (۲۸ روز)"
          value={faNumber(recorded?.counts.sessionsLogged ?? 0)}
          unit={`${faNumber(recorded?.counts.sessionsCompleted ?? 0)} انجام‌شده`}
        />
        <Stat
          label="روز چک‌این"
          value={faNumber(recorded?.counts.checkinDays ?? 0)}
          unit="از ۲۸ روز"
        />
        <Stat
          label="روز ثبت وعده"
          value={faNumber(recorded?.counts.mealDays ?? 0)}
          unit="از ۲۸ روز"
        />
        <Stat
          label="وضعیت داده"
          value={
            overview.status === "empty" ? "خالی" : overview.status === "ready" ? "در حال رشد" : "—"
          }
          unit={overview.status === "empty" ? "اولین ثبت را انجام دهید" : "بر پایهٔ ثبت‌های شما"}
        />
      </section>

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
              subtitle="سه جلسهٔ آخر از دادهٔ ثبت‌شده"
              action={{ label: "تاریخچه", to: "/athlete/performance" }}
            />
            <div className="divide-y divide-border/60">
              {(recorded?.recentSessions ?? []).length === 0 ? (
                <p className="py-3 text-sm text-muted-foreground">
                  هنوز جلسه‌ای ثبت نشده است. اولین جلسه را از کارت ثبت داده وارد کنید.
                </p>
              ) : (
                (recorded?.recentSessions ?? []).map((session) => (
                  <div
                    key={session.id}
                    className="grid grid-cols-[75px_1fr_auto] items-center gap-3 py-3"
                  >
                    <span className="num text-xs text-muted-foreground">{session.date}</span>
                    <div>
                      <div className="text-sm font-semibold">{session.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {session.status === "completed" ? "انجام شد" : "ثبت موقت"}
                        {session.minutes !== null ? ` · ${faNumber(session.minutes)} دقیقه` : ""}
                      </div>
                    </div>
                    <span className="font-mono text-sm font-bold">
                      {session.rpe !== null ? `RPE ${faNumber(session.rpe)}` : "—"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Panel>
        )}
      </section>
    </AppShell>
  );
}

function Mini({ icon: Icon, label, value }: { icon: typeof Moon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-3.5 text-muted-foreground" />
      <div>
        <div className="text-[10px] text-muted-foreground">{label}</div>
        <div className="font-mono text-sm font-bold">{value}</div>
      </div>
    </div>
  );
}

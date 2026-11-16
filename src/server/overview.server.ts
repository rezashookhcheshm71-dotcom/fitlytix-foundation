/**
 * Everything the athlete dashboard needs that is *actually recorded*.
 *
 * One round trip instead of five: the recent logs (sessions / meals / check-ins) that
 * `listRecentLogs` already reads, reduced to the numbers a dashboard shows, plus the same
 * nudges the program page renders so the two screens never disagree.
 *
 * Nothing here invents a value: an athlete with no check-in has `recovery: null`, and the
 * dashboard is expected to say so.
 */
import { listRecentLogs } from "@/server/logging.repository";
import { getAthleteNudges } from "@/server/nudges.server";
import type { Nudge } from "@/services/athlete/nudges";

export interface AthleteOverview {
  generatedAt: string;
  /** Rolling counts, computed from the stored rows over the *same* window (28 days). */
  counts: {
    sessionsLogged: number;
    sessionsCompleted: number;
    checkinDays: number;
    mealDays: number;
  };
  recovery: {
    /** ISO date (YYYY-MM-DD) of the newest check-in. */
    date: string;
    isToday: boolean;
    readiness: number | null;
    sleepHours: number | null;
    stress: number | null;
    labelFa: string;
  } | null;
  /** Readiness per check-in, oldest → newest, for the bar chart. */
  recoveryHistory: { day: string; readiness: number }[];
  /** Newest 14 check-ins, oldest → newest — the raw rows the recovery page plots. */
  checkins: {
    date: string;
    sleepHours: number | null;
    stress: number | null;
    readiness: number | null;
    weightKg: number | null;
  }[];
  recentSessions: {
    id: string;
    title: string;
    status: string;
    rpe: number | null;
    minutes: number | null;
    /** YYYY-MM-DD only — the dashboard never renders a raw timestamp. */
    date: string;
  }[];
  nudges: Nudge[];
}

const dayOf = (value: string | null | undefined): string =>
  value ? String(value).slice(0, 10) : "";

function readinessLabelFa(readiness: number | null): string {
  if (readiness === null) return "نامشخص";
  if (readiness >= 80) return "آماده";
  if (readiness >= 60) return "قابل تمرین";
  if (readiness >= 40) return "سبک";
  return "استراحت";
}

export async function getAthleteOverview(userId: string): Promise<AthleteOverview> {
  const [logs, nudges] = await Promise.all([
    listRecentLogs(userId, 28),
    getAthleteNudges(userId).catch(() => [] as Nudge[]),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const checkins = [...logs.checkins].sort((a, b) => dayOf(a.date).localeCompare(dayOf(b.date)));
  const newest = checkins.at(-1) ?? null;

  const mealDays = new Set(logs.nutrition.map((meal) => dayOf(meal.at)).filter(Boolean));

  return {
    generatedAt: new Date().toISOString(),
    counts: {
      sessionsLogged: logs.sessions.length,
      sessionsCompleted: logs.sessions.filter((session) => session.status === "completed").length,
      checkinDays: new Set(checkins.map((entry) => dayOf(entry.date)).filter(Boolean)).size,
      mealDays: mealDays.size,
    },
    recovery: newest
      ? {
          date: dayOf(newest.date),
          isToday: dayOf(newest.date) === today,
          readiness: newest.readiness,
          sleepHours: newest.sleepHours,
          stress: newest.stress,
          labelFa: readinessLabelFa(newest.readiness),
        }
      : null,
    checkins: checkins.slice(-14).map((entry) => ({
      date: dayOf(entry.date),
      sleepHours: entry.sleepHours,
      stress: entry.stress,
      readiness: entry.readiness,
      weightKg: entry.weightKg,
    })),
    recoveryHistory: checkins
      .filter((entry) => entry.readiness !== null)
      .slice(-10)
      .map((entry) => ({
        day: dayOf(entry.date).slice(5).replace("-", "/"),
        readiness: Number(entry.readiness),
      })),
    recentSessions: logs.sessions.slice(0, 3).map((session) => ({
      id: session.id,
      title: session.title || "جلسه ثبت‌شده",
      status: session.status,
      rpe: session.rpe,
      minutes: session.minutes,
      date: dayOf(session.at),
    })),
    nudges,
  };
}

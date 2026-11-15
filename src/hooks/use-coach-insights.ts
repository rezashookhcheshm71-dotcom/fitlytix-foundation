/**
 * Client hook for GET /api/coach-insights.
 *
 * Coach screens must be honest about a page that shows real athlete data: explicit loading,
 * `forbidden` (signed in but not a coach) and `error` states instead of a blank table.
 */
import { useCallback, useEffect, useState } from "react";

export interface AthleteDataQualityRow {
  userId: string;
  email: string;
  name: string;
  sessions28d: number;
  sessionsCompleted28d: number;
  avgRpe: number | null;
  mealDays28d: number;
  checkins14d: number;
  avgSleep14d: number | null;
  avgReadiness14d: number | null;
  archetypeId: string | null;
  sport: string | null;
  lastPlanAt: string | null;
  confidence: string | null;
  dataCompleteness: number | null;
  measuredAdherence: number | null;
  score: number;
  level: "poor" | "fair" | "good";
}

export interface ArchetypePerformanceRow {
  archetypeId: string;
  sport: string;
  plans: number;
  labelled: number;
  avgAdherence: number | null;
  avgNutritionAdherence: number | null;
  avgRpe: number | null;
  completedCycles: number;
}

export interface CoachInsightsPayload {
  generatedAt: string;
  summary: {
    athletes: number;
    withSessions: number;
    withCheckins: number;
    withMeals: number;
    plans: number;
    labelledPlans: number;
    avgAdherence: number | null;
  };
  athletes: AthleteDataQualityRow[];
  archetypes: ArchetypePerformanceRow[];
}

export type CoachInsightsStatus = "loading" | "ready" | "forbidden" | "error";

export function useCoachInsights(limit = 200) {
  const [status, setStatus] = useState<CoachInsightsStatus>("loading");
  const [data, setData] = useState<CoachInsightsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const response = await fetch(`/api/coach-insights?limit=${limit}`, {
        credentials: "same-origin",
      });
      if (response.status === 401) {
        setStatus("forbidden");
        setError("برای دیدن این صفحه باید با حساب مربی وارد شوید.");
        return;
      }
      if (response.status === 403) {
        setStatus("forbidden");
        setError("این بخش فقط برای نقش مربی/مدیر است.");
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setStatus("error");
        setError(body.error ?? `HTTP ${response.status}`);
        return;
      }
      const body = (await response.json()) as { ok?: boolean } & CoachInsightsPayload;
      if (!body.ok) {
        setStatus("error");
        setError("پاسخ سرور معتبر نبود.");
        return;
      }
      setData(body);
      setStatus("ready");
      setError(null);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "اتصال برقرار نشد.");
    }
  }, [limit]);

  useEffect(() => {
    void load();
  }, [load]);

  return { status, data, error, reload: load };
}

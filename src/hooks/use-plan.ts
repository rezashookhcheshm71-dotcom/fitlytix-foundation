/**
 * Client hook around GET/POST /api/plan.
 *
 * States are explicit so pages can degrade honestly:
 *   loading        → skeleton / demo fallback
 *   unauthenticated→ show demo content + "complete your assessment" call-to-action
 *   ready          → the athlete's real, stored plan
 *   error          → demo fallback + retry
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { PlanDurationMonths } from "@/domain/recommendation";
import type { Program, Workout } from "@/domain/types";
import type { PlanSummary } from "@/services/recommendation/presentation";
import type { RecommendationDiagnostics } from "@/services/recommendation/engine";

export interface PlanMeta {
  fromSnapshot: boolean;
  persisted: boolean;
  snapshotId: string | null;
  generatedAt: string;
  inputHash: string;
  diagnostics: RecommendationDiagnostics | null;
  sourcesFa: string[];
  missingFa: string[];
}

export interface PlanResponse {
  ok: true;
  authenticated: true;
  plan: PlanSummary;
  program: Program;
  workout: Workout;
  meta: PlanMeta;
}

export type PlanStatus = "loading" | "unauthenticated" | "ready" | "error";

export interface UsePlanResult {
  status: PlanStatus;
  data: PlanResponse | null;
  error: string | null;
  refreshing: boolean;
  refresh: (constraints?: { durationMonths?: PlanDurationMonths | "auto" }) => Promise<void>;
}

async function readPlan(
  init?: RequestInit,
): Promise<{ status: PlanStatus; data: PlanResponse | null; error: string | null }> {
  const response = await fetch("/api/plan", {
    credentials: "same-origin",
    headers: { accept: "application/json" },
    ...init,
  });

  if (response.status === 401 || response.status === 403) {
    return { status: "unauthenticated", data: null, error: null };
  }

  const json = (await response.json().catch(() => null)) as
    (PlanResponse | { ok: false; error?: string }) | null;

  if (!response.ok || !json || !("ok" in json) || json.ok !== true) {
    return {
      status: "error",
      data: null,
      error:
        (json && "error" in json && typeof json.error === "string" && json.error) ||
        "دریافت برنامه ناموفق بود.",
    };
  }

  return { status: "ready", data: json, error: null };
}

export function usePlan(options: { enabled?: boolean } = {}): UsePlanResult {
  const enabled = options.enabled !== false;
  const [status, setStatus] = useState<PlanStatus>(enabled ? "loading" : "unauthenticated");
  const [data, setData] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await readPlan();
        if (cancelled || !mounted.current) return;
        setStatus(result.status);
        setData(result.data);
        setError(result.error);
      } catch {
        if (cancelled || !mounted.current) return;
        setStatus("error");
        setError("ارتباط با سرور برقرار نشد.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const refresh = useCallback(
    async (constraints?: { durationMonths?: PlanDurationMonths | "auto" }) => {
      if (!enabled) return;
      setRefreshing(true);
      try {
        const result = await readPlan({
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ regenerate: true, ...(constraints ? { constraints } : {}) }),
        });
        if (!mounted.current) return;
        setStatus(result.status);
        setData(result.data);
        setError(result.error);
      } catch {
        if (!mounted.current) return;
        setStatus("error");
        setError("به‌روزرسانی برنامه ناموفق بود.");
      } finally {
        if (mounted.current) setRefreshing(false);
      }
    },
    [enabled],
  );

  return { status, data, error, refreshing, refresh };
}

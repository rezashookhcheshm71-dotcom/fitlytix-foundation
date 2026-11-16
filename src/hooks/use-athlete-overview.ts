/**
 * Client hook for GET /api/athlete/overview.
 *
 * The dashboard renders recorded facts, so "no data yet" is a real state, not an error:
 * `status === "empty"` when the athlete has not logged anything in the window.
 */
import { useCallback, useEffect, useState } from "react";
import type { AthleteOverview } from "@/server/overview.server";

export type OverviewStatus = "loading" | "ready" | "empty" | "unauthenticated" | "error";

export function useAthleteOverview(enabled = true) {
  const [status, setStatus] = useState<OverviewStatus>(enabled ? "loading" : "unauthenticated");
  const [data, setData] = useState<AthleteOverview | null>(null);

  const load = useCallback(async () => {
    if (!enabled) {
      setStatus("unauthenticated");
      return;
    }
    try {
      const response = await fetch("/api/athlete/overview", { credentials: "same-origin" });
      if (response.status === 401 || response.status === 403) {
        setStatus("unauthenticated");
        setData(null);
        return;
      }
      const body = (await response.json().catch(() => null)) as
        ({ ok: true } & AthleteOverview) | { ok: false } | null;
      if (!response.ok || !body || body.ok !== true) {
        setStatus("error");
        setData(null);
        return;
      }
      const { ok: _ok, ...overview } = body;
      setData(overview);
      const anythingLogged =
        overview.counts.sessionsLogged > 0 ||
        overview.counts.checkinDays > 0 ||
        overview.counts.mealDays > 0;
      setStatus(anythingLogged ? "ready" : "empty");
    } catch {
      setStatus("error");
      setData(null);
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { status, data, reload: load };
}

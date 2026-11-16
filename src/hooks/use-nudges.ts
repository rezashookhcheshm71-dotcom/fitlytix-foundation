/**
 * Client hook for GET /api/nudges.
 *
 * Nudges are advisory: a failure must never block the program page, so `error` collapses to an
 * empty list and the UI simply shows nothing.
 */
import { useCallback, useEffect, useState } from "react";
import type { Nudge } from "@/services/athlete/nudges";

export function useNudges(enabled = true) {
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const reload = useCallback(async () => {
    if (!enabled) {
      setNudges([]);
      setStatus("ready");
      return;
    }
    try {
      const response = await fetch("/api/nudges", { credentials: "same-origin" });
      const body = (await response.json().catch(() => ({}))) as { nudges?: Nudge[] };
      setNudges(Array.isArray(body.nudges) ? body.nudges : []);
      setStatus("ready");
    } catch {
      setNudges([]);
      setStatus("error");
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { nudges, status, reload };
}

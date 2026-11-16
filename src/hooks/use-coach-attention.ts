/** Client hook for GET /api/coach/attention (coach roles only). */
import { useCallback, useEffect, useState } from "react";
import type { CoachAttention } from "@/domain/attention";

export type AttentionStatus = "loading" | "ready" | "forbidden" | "error";

export function useCoachAttention(enabled = true) {
  const [status, setStatus] = useState<AttentionStatus>(enabled ? "loading" : "forbidden");
  const [data, setData] = useState<CoachAttention | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const response = await fetch("/api/coach/attention", { credentials: "same-origin" });
      if (response.status === 401 || response.status === 403) {
        setStatus("forbidden");
        setData(null);
        return;
      }
      const body = (await response.json().catch(() => null)) as
        ({ ok: true } & CoachAttention) | { ok: false } | null;
      if (!response.ok || !body || body.ok !== true) {
        setStatus("error");
        setData(null);
        return;
      }
      const { ok: _ok, ...attention } = body;
      setData(attention);
      setStatus("ready");
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

/**
 * Client-side access to the user's real health evidence (P35).
 *
 * Split out of src/components/domain/health-trends.tsx for a concrete reason: that
 * file exports a component, and React Fast Refresh only works when a module
 * exports components alone. Sharing the hook and its view helpers from here keeps
 * hot reload working and lets several screens render the same evidence without
 * each fetching it separately - and without their views drifting apart.
 *
 * Identity is resolved server-side from the session cookie, so there is no
 * athleteId parameter anywhere in this module. A caller cannot ask for somebody
 * else's data, which is the whole point after the page used to read "ath_001".
 */
import { useCallback, useEffect, useState } from "react";

import { missingSlot, okSlot, type Slot } from "@/domain/evidence";
import type { Trend, TrendPoint } from "@/domain/trend";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";

export type MetricStatus = "ESTABLISHED" | "INSUFFICIENT_POINTS" | "NO_DATA";

export type MetricRow = {
  metricType: string;
  label: string;
  unit: string;
  status: MetricStatus;
  pointCount: number;
  pointsNeeded: number;
  trend: {
    direction: Trend["direction"];
    change: number | null;
    changePct: number | null;
    spanDays: number | null;
    last: TrendPoint | null;
    excluded: { value: number; at: string; reason: string }[];
  } | null;
};

export type HealthPayload = {
  ok: boolean;
  summary?: { totalMetricTypes: number; withTrend: number; withoutTrend: number };
  metrics?: MetricRow[];
};

export type LoadState = "loading" | "ready" | "unauthenticated" | "error";

/** Shared Persian numeral formatting so every health view agrees on one style. */
export const nf = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 });

export function formatValue(value: number, unit: string): string {
  return `${nf.format(value)} ${unit}`;
}

/**
 * Builds the value slot for a metric. An ok slot means a real reading exists; a
 * missing slot means nothing was ever recorded.
 *
 * A single measurement yields an ok slot even though it supports no trend: the
 * reading is real, and only the trend claim is withheld.
 */
/**
 * One Persian label, icon and tone per trend direction.
 *
 * This lives here rather than in a component file so that every view showing a
 * trend - the trends panel and the dashboard slideshow - reads the same words for
 * the same direction. Two files each defining "rising" is how a product ends up
 * saying two different things about one fact. It also keeps the component files
 * exporting only components, which is what react-refresh wants.
 */
export const DIRECTION_VIEW = {
  rising: { label: "رو به بالا", Icon: TrendingUp, tone: "text-success" },
  falling: { label: "رو به پایین", Icon: TrendingDown, tone: "text-info" },
  flat: { label: "بدونِ تغییر", Icon: Minus, tone: "text-muted-foreground" },
} as const;

export function valueSlotFor(row: MetricRow): Slot<string> {
  const last = row.trend?.last;
  if (row.status === "NO_DATA" || last === null || last === undefined) {
    return missingSlot<string>(
      `${row.label} هرگز ثبت نشده است.`,
      "یک اندازه‌گیری ثبت کن تا از همان لحظه داده‌یِ واقعی داشته باشی.",
    );
  }
  return okSlot<string>(formatValue(last.value, row.unit), "health_metrics");
}

/** Metrics with real evidence come first; never-measured ones sink to the bottom. */
const STATUS_RANK: Record<MetricStatus, number> = {
  ESTABLISHED: 0,
  INSUFFICIENT_POINTS: 1,
  NO_DATA: 2,
};

export type AthleteHealth = {
  state: LoadState;
  metrics: MetricRow[];
  summary: HealthPayload["summary"];
  failure: string;
  reload: () => Promise<void>;
};

/**
 * Fetches the signed-in user's real health payload.
 *
 * `version` is a refetch trigger: bump it after saving a measurement so the views
 * sharing this hook all update together.
 */
export function useAthleteHealth(version: number): AthleteHealth {
  const [state, setState] = useState<LoadState>("loading");
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [summary, setSummary] = useState<HealthPayload["summary"]>(undefined);
  const [failure, setFailure] = useState("");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch("/api/athlete/health", { credentials: "include" });
      if (res.status === 401) {
        setState("unauthenticated");
        return;
      }
      const json = (await res.json().catch(() => ({}))) as HealthPayload;
      if (!res.ok || !json.ok || !Array.isArray(json.metrics)) {
        setFailure("خواندنِ داده‌یِ سلامت ممکن نشد.");
        setState("error");
        return;
      }
      setMetrics(
        [...json.metrics].sort(
          (a, b) =>
            STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
            a.metricType.localeCompare(b.metricType),
        ),
      );
      setSummary(json.summary);
      setFailure("");
      setState("ready");
    } catch {
      setFailure("اتصال به سرور برقرار نشد.");
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, version]);

  return { state, metrics, summary, failure, reload: load };
}

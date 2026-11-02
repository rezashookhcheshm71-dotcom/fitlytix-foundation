/**
 * /api/athlete/health (P35)
 *
 * GET  - the user's own trends, per metric.
 * POST - record manual measurements, which is what makes a second data point exist.
 *
 * Both are scoped to the authenticated session user. There is no athleteId
 * parameter: the previous health service was in-memory and keyed to the demo
 * athlete "ath_001", which meant every signed-in user was shown his data. Identity
 * comes from the session and cannot be overridden by the caller.
 *
 * The GET payload is deliberately machine-readable about absence. Each metric
 * carries `status`, `pointCount` and `pointsNeeded`, so a client can render an
 * honest empty state without parsing Persian copy or guessing from an empty array.
 */
import { createFileRoute } from "@tanstack/react-router";

import { METRIC_DEFS, MANUAL_METRICS } from "@/domain/types";
import { pointsNeededForTrend } from "@/domain/trend";
import { AuthHttpError, getSessionUser } from "@/lib/auth.server";
import { healthRepository } from "@/server/health.repository";

const NO_STORE = { "cache-control": "no-store" } as const;

/** Normalises a MySQL DATETIME (Date or string) to ISO-8601. */
function toIso(value: string | Date | null): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.length > 0) {
    const parsed = Date.parse(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
    return Number.isNaN(parsed) ? value : new Date(parsed).toISOString();
  }
  return "";
}

function unauthorized() {
  return Response.json(
    { ok: false, error: "ابتدا وارد شوید." },
    { status: 401, headers: NO_STORE },
  );
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export const Route = createFileRoute("/api/athlete/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await getSessionUser(request);
          if (!user) return unauthorized();

          const trends = await healthRepository.trendsForUser(user.id);
          // Raw recent recordings, newest first, for the "latest entries" table.
          // Unlike the trends these keep excluded values, marked as such - the
          // evidence stays visible even where it is not trusted.
          const rawRows = await healthRepository.listMetrics(user.id, { limit: 50 });
          const recent = rawRows
            .slice()
            .reverse()
            .slice(0, 20)
            .map((row) => {
              const metricType = row.metric_type;
              const points = trends[metricType]?.points ?? [];
              const excluded = trends[metricType]?.excluded ?? [];
              const asNumber = Number(row.value);
              const atIso = toIso(row.start_time);
              const wasExcluded =
                excluded.some((e) => e.at === atIso && e.value === asNumber) ||
                !points.some((pt) => pt.at === atIso && pt.value === asNumber);
              return {
                metricType,
                label: METRIC_DEFS[metricType as keyof typeof METRIC_DEFS]?.label ?? metricType,
                unit: row.unit ?? METRIC_DEFS[metricType as keyof typeof METRIC_DEFS]?.unit ?? "",
                value: Number.isFinite(asNumber) ? asNumber : null,
                at: atIso,
                // Passed through verbatim: the source is part of the evidence, and
                // a manual entry must not be displayed as if a watch recorded it.
                source: row.source ?? null,
                excluded: wasExcluded,
              };
            });

          // Every metric type is reported, including those with no rows at all, so
          // the client can distinguish "measured once" from "never measured".
          const metrics = Object.entries(METRIC_DEFS).map(([metricType, def]) => {
            const trend = trends[metricType];
            const pointCount = trend?.points.length ?? 0;
            return {
              metricType,
              label: def.label,
              unit: def.unit,
              status: trend?.status ?? "NO_DATA",
              pointCount,
              pointsNeeded: pointsNeededForTrend(pointCount),
              trend: trend
                ? {
                    direction: trend.direction,
                    change: trend.change,
                    changePct: trend.changePct,
                    spanDays: trend.spanDays,
                    first: trend.first,
                    last: trend.last,
                    points: trend.points,
                    excluded: trend.excluded,
                  }
                : null,
            };
          });

          const established = metrics.filter((m) => m.status === "ESTABLISHED").length;

          return Response.json(
            {
              ok: true,
              // Surfaced rather than hidden: a trend needs two points, and most
              // metrics currently have one.
              summary: {
                totalMetricTypes: metrics.length,
                withTrend: established,
                withoutTrend: metrics.length - established,
              },
              metrics,
              recent,
              capturable: MANUAL_METRICS,
            },
            { status: 200, headers: NO_STORE },
          );
        } catch (err) {
          console.error("[api/athlete/health] GET:", message(err));
          return Response.json(
            { ok: false, error: "خواندنِ داده‌یِ سلامت ممکن نشد." },
            { status: 500, headers: NO_STORE },
          );
        }
      },

      POST: async ({ request }) => {
        try {
          const user = await getSessionUser(request);
          if (!user) return unauthorized();

          const body = (await request.json().catch(() => null)) as unknown;
          const result = await healthRepository.recordManualEntry(user.id, body);

          if (result.written === 0) {
            return Response.json(
              { ok: false, error: "هیچ داده‌ای برایِ ثبت ارسال نشد." },
              { status: 400, headers: NO_STORE },
            );
          }

          return Response.json({ ok: true, ...result }, { status: 201, headers: NO_STORE });
        } catch (err) {
          if (err instanceof AuthHttpError) {
            return Response.json(
              { ok: false, error: err.message },
              { status: err.statusCode, headers: NO_STORE },
            );
          }
          console.error("[api/athlete/health] POST:", message(err));
          return Response.json(
            { ok: false, error: "ثبتِ داده‌یِ سلامت ممکن نشد." },
            { status: 500, headers: NO_STORE },
          );
        }
      },
    },
  },
});

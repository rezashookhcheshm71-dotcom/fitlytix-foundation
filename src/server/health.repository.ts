/**
 * Health metrics repository (P35).
 *
 * `health_metrics` has existed since migration 002 with an index built for exactly
 * this query - idx_health_metrics_athlete_type_time on
 * (athlete_user_id, metric_type, start_time) - and had ZERO readers. The live
 * database holds one row per metric at a single timestamp, so the trend the product
 * advertises had no data to be built from and no way to accumulate any.
 *
 * This module is the missing half: a read path that turns stored rows into trends,
 * and a write path that lets a second measurement exist at all.
 *
 * Two rules carried over from the rest of the codebase:
 *
 * - Column names are discovered with DESCRIBE, never assumed. Migrations in git and
 *   the live schema are known to diverge (P33), so a hardcoded column list would
 *   break on whichever side it was not written against.
 * - Failure is reported, not swallowed. If the table is missing a write throws
 *   rather than returning success, because telling a user their measurement was
 *   saved when it was not is worse than telling them it failed.
 */
import crypto from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";

import { METRIC_DEFS, manualHealthInputSchema, type HealthMetricType } from "@/domain/types";
import { buildTrend, trendPointsFrom, type Trend } from "@/domain/trend";
import { AuthHttpError } from "@/lib/auth.server";
import { dbExecute, dbQuery, getTableColumns, tableExists } from "@/lib/db.server";

const TABLE = "health_metrics";

/** A row shaped for trend consumption. See trendPointsFrom for the coercion rules. */
export type HealthMetricRow = {
  metric_type: string;
  value: number | string | null;
  start_time: string | Date | null;
  unit?: string | null;
};

export type TrendsByMetric = Record<string, Trend>;

export const healthRepository = {
  /**
   * Reads a user's metrics, oldest first, using the composite index.
   *
   * Returns an empty array rather than throwing when the table is absent: a read
   * has an honest answer ("nothing recorded") that a write does not.
   */
  async listMetrics(
    userId: string,
    opts: { metricTypes?: readonly string[]; limit?: number } = {},
  ): Promise<HealthMetricRow[]> {
    if (!(await tableExists(TABLE))) {
      console.error(`[health] table ${TABLE} does not exist; apply migration 002. Returning none.`);
      return [];
    }

    const cols = await getTableColumns(TABLE);
    const userCol = cols.has("athlete_user_id") ? "athlete_user_id" : null;
    const typeCol = cols.has("metric_type") ? "metric_type" : null;
    const timeCol = cols.has("start_time") ? "start_time" : null;
    if (!userCol || !typeCol || !timeCol) {
      console.error(
        `[health] ${TABLE} is missing an expected column (athlete_user_id/metric_type/start_time). Present: ${[...cols].join(", ")}`,
      );
      return [];
    }

    const where: string[] = [`${userCol} = ?`];
    const params: unknown[] = [userId];
    const wanted = opts.metricTypes?.filter((t) => t.length > 0);
    if (wanted && wanted.length > 0) {
      where.push(`${typeCol} IN (${wanted.map(() => "?").join(", ")})`);
      params.push(...wanted);
    }

    // Bounded so a long history cannot exhaust memory; newest-first then reversed
    // is avoided in favour of an explicit ASC ordering the index can serve.
    const limit = Math.min(Math.max(opts.limit ?? 500, 1), 5000);
    const rows = await dbQuery<RowDataPacket[]>(
      `SELECT ${typeCol} AS metric_type, value, ${timeCol} AS start_time,
              ${cols.has("unit") ? "unit" : "NULL AS unit"}
         FROM ${TABLE}
        WHERE ${where.join(" AND ")}
        ORDER BY ${timeCol} ASC
        LIMIT ${limit}`,
      params,
    );

    return rows.map((row) => ({
      metric_type: String(row["metric_type"] ?? ""),
      value: row["value"] as number | string | null,
      start_time: row["start_time"] as string | Date | null,
      unit: (row["unit"] as string | null) ?? null,
    }));
  },

  /**
   * Records manual measurements - the capture path that makes a trend possible.
   *
   * One row per metric per submission, each stamped with its own start_time. The
   * unit is taken from METRIC_DEFS rather than from the caller, so a client cannot
   * store a kilogram value under a pound unit and have the trend compare them.
   */
  async recordManualEntry(
    userId: string,
    input: unknown,
  ): Promise<{ written: number; metrics: string[]; measuredAt: string }> {
    const parsed = manualHealthInputSchema.safeParse(input);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw new AuthHttpError(400, first?.message ?? "ورودی نامعتبر است.");
    }

    if (!(await tableExists(TABLE))) {
      // A write that cannot be written must not report success.
      throw new AuthHttpError(
        503,
        "ذخیره‌یِ داده‌یِ سلامت ممکن نیست: جدولِ health_metrics در دسترس نیست.",
      );
    }

    const cols = await getTableColumns(TABLE);
    const required = [
      "id",
      "athlete_user_id",
      "source",
      "metric_type",
      "value",
      "unit",
      "start_time",
    ];
    const missing = required.filter((c) => !cols.has(c));
    if (missing.length > 0) {
      throw new AuthHttpError(
        503,
        `ذخیره‌یِ داده‌یِ سلامت ممکن نیست: ستون‌هایِ ${missing.join("، ")} در جدول وجود ندارند.`,
      );
    }

    const entries = Object.entries(parsed.data.values) as [HealthMetricType, number][];
    const written: string[] = [];

    for (const [metricType, value] of entries) {
      const def = METRIC_DEFS[metricType];
      if (!def) {
        // safeParse already rejects unknown keys; this keeps the guarantee local.
        console.error(`[health] refusing to store unknown metric type: ${String(metricType)}`);
        continue;
      }
      await dbExecute(
        `INSERT INTO ${TABLE}
           (id, athlete_user_id, source, metric_type, value, unit, start_time${cols.has("metadata") ? ", metadata" : ""})
         VALUES (?, ?, ?, ?, ?, ?, ?${cols.has("metadata") ? ", ?" : ""})`,
        [
          crypto.randomUUID(),
          userId,
          "manual",
          metricType,
          value,
          def.unit,
          toSqlDatetime(parsed.data.measuredAt),
          ...(cols.has("metadata")
            ? [
                JSON.stringify({
                  origin: "manual_entry",
                  ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
                }),
              ]
            : []),
        ],
      );
      written.push(metricType);
    }

    return { written: written.length, metrics: written, measuredAt: parsed.data.measuredAt };
  },

  /**
   * Every trend for a user, keyed by metric type.
   *
   * Metrics with no rows are simply absent from the result: the caller renders an
   * honest empty state for them rather than this function inventing a placeholder.
   */
  async trendsForUser(
    userId: string,
    opts: { metricTypes?: readonly string[] } = {},
  ): Promise<TrendsByMetric> {
    const rows = await this.listMetrics(userId, opts);
    const grouped = trendPointsFrom(rows);
    const trends: TrendsByMetric = {};
    for (const [metricType, points] of Object.entries(grouped)) {
      trends[metricType] = buildTrend(points);
    }
    return trends;
  },
};

/**
 * Converts an ISO date or date-time into the DATETIME literal MySQL expects.
 *
 * A bare date ("2026-11-02") is midnight UTC, not local time: the user picks a day,
 * and the day they picked is the day stored. Inventing a time of day would be a
 * fabricated measurement timestamp.
 */
function toSqlDatetime(value: string): string {
  const parsed = Date.parse(value.includes("T") ? value : `${value}T00:00:00Z`);
  if (Number.isNaN(parsed)) {
    throw new AuthHttpError(400, "تاریخ نامعتبر است.");
  }
  return new Date(parsed).toISOString().slice(0, 19).replace("T", " ");
}

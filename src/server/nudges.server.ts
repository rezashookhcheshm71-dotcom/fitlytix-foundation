/**
 * Server wrapper for athlete nudges: read four timestamps, hand them to the pure rules.
 *
 * Everything is schema-adaptive and best-effort — the production database predates some
 * columns, and a missing table must degrade to "no fact known" rather than a 500.
 */
import type { RowDataPacket } from "mysql2/promise";
import { dbQuery, tableExists } from "@/lib/db.server";
import { getLatestRecommendationSnapshot } from "@/services/recommendation/snapshots.server";
import { computeNudges, type Nudge } from "@/services/athlete/nudges";

const dayMs = 86_400_000;

function daysSince(value: unknown): number | null {
  if (!value) return null;
  const at = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(at.getTime())) return null;
  return Math.floor((Date.now() - at.getTime()) / dayMs);
}

async function newestTimestamp(table: string, column: string, userId: string): Promise<unknown> {
  if (!(await tableExists(table))) return null;
  try {
    const rows = await dbQuery<RowDataPacket[]>(
      `SELECT MAX(\`${column}\`) AS ts FROM \`${table}\` WHERE athlete_user_id = ?`,
      [userId],
    );
    return rows[0]?.["ts"] ?? null;
  } catch {
    return null;
  }
}

function startOfTodayUtc(): string {
  const now = new Date();
  return `${now.toISOString().slice(0, 10)} 00:00:00`;
}

export async function getAthleteNudges(userId: string): Promise<Nudge[]> {
  const snapshot = await getLatestRecommendationSnapshot(userId).catch(() => null);
  const planAgeDays = snapshot?.createdAt ? daysSince(snapshot.createdAt) : null;

  const [lastSession, lastNutrition, lastCheckin, todayCheckin] = await Promise.all([
    newestTimestamp("training_sessions", "scheduled_at", userId),
    newestTimestamp("nutrition_logs", "logged_at", userId),
    newestTimestamp("athlete_checkins", "created_at", userId),
    tableExists("athlete_checkins").then(async (exists) => {
      if (!exists) return null;
      try {
        const rows = await dbQuery<RowDataPacket[]>(
          `SELECT COUNT(*) AS n FROM athlete_checkins
           WHERE athlete_user_id = ? AND created_at >= ?`,
          [userId, startOfTodayUtc()],
        );
        return Number(rows[0]?.["n"] ?? 0);
      } catch {
        return null;
      }
    }),
  ]);

  return computeNudges({
    hasPlan: Boolean(snapshot),
    planAgeDays,
    daysSinceSession: daysSince(lastSession),
    daysSinceCheckin: daysSince(lastCheckin),
    daysSinceNutrition: daysSince(lastNutrition),
    checkedInToday: (todayCheckin ?? 0) > 0,
  });
}

/**
 * Coach-facing analytics over *real* rows: how much each athlete actually logged, and which
 * programme archetypes are producing adherence in the field.
 *
 * Two questions this answers:
 *   1. «این برنامه بر چه مبنایی ساخته شده؟» → sessions / meals / check-ins per athlete plus the
 *      completeness the model recorded when it generated the plan.
 *   2. «کدام آرکیتایپ واقعاً جواب می‌دهد؟» → adherence per archetype, joined snapshot → outcome.
 *
 * Everything is best-effort and read-only; a missing table yields an empty section instead of
 * an error page.
 */
import type { RowDataPacket } from "mysql2/promise";
import { dbQuery, getTableColumns, isDatabaseConfigured, tableExists } from "@/lib/db.server";

export interface AthleteDataQuality {
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

export interface ArchetypePerformance {
  archetypeId: string;
  sport: string;
  plans: number;
  labelled: number;
  avgAdherence: number | null;
  avgNutritionAdherence: number | null;
  avgRpe: number | null;
  completedCycles: number;
}

export interface CoachInsights {
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
  athletes: AthleteDataQuality[];
  archetypes: ArchetypePerformance[];
}

const num = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

async function safeQuery(sql: string, params: unknown[] = []): Promise<RowDataPacket[]> {
  try {
    return await dbQuery<RowDataPacket[]>(sql, params);
  } catch {
    return [];
  }
}

/** 0..1 quality score: behaviour data is what makes a plan personal, so it dominates. */
function qualityScore(args: { sessions: number; mealDays: number; checkins: number }): {
  score: number;
  level: AthleteDataQuality["level"];
} {
  const score =
    Math.min(1, args.sessions / 12) * 0.4 +
    Math.min(1, args.mealDays / 20) * 0.3 +
    Math.min(1, args.checkins / 14) * 0.3;
  const rounded = Math.round(score * 100) / 100;
  return { score: rounded, level: rounded >= 0.6 ? "good" : rounded >= 0.25 ? "fair" : "poor" };
}

export async function getCoachInsights(options: { limit?: number } = {}): Promise<CoachInsights> {
  const limit = Math.floor(Math.min(500, Math.max(1, options.limit ?? 200)));
  const empty: CoachInsights = {
    generatedAt: new Date().toISOString(),
    summary: {
      athletes: 0,
      withSessions: 0,
      withCheckins: 0,
      withMeals: 0,
      plans: 0,
      labelledPlans: 0,
      avgAdherence: null,
    },
    athletes: [],
    archetypes: [],
  };

  if (!isDatabaseConfigured()) return empty;
  if (!(await tableExists("users"))) return empty;

  const users = await safeQuery(
    `SELECT id, email, first_name, last_name, role
     FROM users
     WHERE role IS NULL OR LOWER(role) NOT IN ('coach', 'head_coach', 'admin')
     ORDER BY created_at DESC
     LIMIT ${limit}`,
  );

  if (users.length === 0) return empty;

  const sessions = (await tableExists("training_sessions"))
    ? await safeQuery(
        `SELECT athlete_user_id AS uid,
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'completed' OR completed_at IS NOT NULL THEN 1 ELSE 0 END) AS done,
                AVG(perceived_exertion) AS rpe
         FROM training_sessions
         WHERE scheduled_at >= (NOW() - INTERVAL 28 DAY)
         GROUP BY athlete_user_id`,
      )
    : [];

  const meals = (await tableExists("nutrition_logs"))
    ? await safeQuery(
        `SELECT athlete_user_id AS uid, COUNT(DISTINCT DATE(logged_at)) AS days
         FROM nutrition_logs
         WHERE logged_at >= (NOW() - INTERVAL 28 DAY)
         GROUP BY athlete_user_id`,
      )
    : [];

  const checkins = (await tableExists("athlete_checkins"))
    ? await safeQuery(
        `SELECT athlete_user_id AS uid, COUNT(*) AS total,
                AVG(sleep_hours) AS sleep, AVG(readiness) AS readiness
         FROM athlete_checkins
         WHERE checkin_date >= (CURDATE() - INTERVAL 14 DAY)
         GROUP BY athlete_user_id`,
      )
    : [];

  let latestPlans: RowDataPacket[] = [];
  if (await tableExists("recommendation_snapshots")) {
    const columns = await getTableColumns("recommendation_snapshots");
    latestPlans = columns.has("seq")
      ? await safeQuery(
          `SELECT s.user_id, s.archetype_id, s.sport, s.created_at, s.confidence, s.data_completeness
           FROM recommendation_snapshots s
           JOIN (SELECT user_id, MAX(seq) AS seq FROM recommendation_snapshots GROUP BY user_id) m
             ON m.user_id = s.user_id AND m.seq = s.seq`,
        )
      : await safeQuery(
          `SELECT s.user_id, s.archetype_id, s.sport, s.created_at, s.confidence, s.data_completeness
           FROM recommendation_snapshots s
           JOIN (SELECT user_id, MAX(created_at) AS created_at FROM recommendation_snapshots GROUP BY user_id) m
             ON m.user_id = s.user_id AND m.created_at = s.created_at`,
        );
  }

  const measured = (await tableExists("recommendation_outcomes"))
    ? await safeQuery(
        `SELECT s.user_id, AVG(o.adherence) AS adherence, COUNT(*) AS n
         FROM recommendation_outcomes o
         JOIN recommendation_snapshots s ON s.id = o.snapshot_id
         GROUP BY s.user_id`,
      )
    : [];

  const byUid = <T extends RowDataPacket>(rows: T[], key = "uid") => {
    const map = new Map<string, T>();
    for (const row of rows) {
      const id = String(row[key] ?? "");
      if (id) map.set(id, row);
    }
    return map;
  };

  const sessionMap = byUid(sessions);
  const mealMap = byUid(meals);
  const checkinMap = byUid(checkins);
  const planMap = byUid(latestPlans, "user_id");
  const measuredMap = byUid(measured, "user_id");

  const athletes: AthleteDataQuality[] = users.map((row) => {
    const userId = String(row["id"]);
    const sessionRow = sessionMap.get(userId);
    const mealRow = mealMap.get(userId);
    const checkinRow = checkinMap.get(userId);
    const planRow = planMap.get(userId);
    const measuredRow = measuredMap.get(userId);

    const sessions28d = num(sessionRow?.["total"]) ?? 0;
    const mealDays28d = num(mealRow?.["days"]) ?? 0;
    const checkins14d = num(checkinRow?.["total"]) ?? 0;
    const quality = qualityScore({
      sessions: sessions28d,
      mealDays: mealDays28d,
      checkins: checkins14d,
    });

    return {
      userId,
      email: String(row["email"] ?? ""),
      name: [row["first_name"], row["last_name"]].filter(Boolean).join(" ").trim() || "بدون نام",
      sessions28d,
      sessionsCompleted28d: num(sessionRow?.["done"]) ?? 0,
      avgRpe: num(sessionRow?.["rpe"]),
      mealDays28d,
      checkins14d,
      avgSleep14d: num(checkinRow?.["sleep"]),
      avgReadiness14d: num(checkinRow?.["readiness"]),
      archetypeId: planRow ? String(planRow["archetype_id"] ?? "") || null : null,
      sport: planRow ? String(planRow["sport"] ?? "") || null : null,
      lastPlanAt: planRow ? String(planRow["created_at"] ?? "") || null : null,
      confidence: planRow ? String(planRow["confidence"] ?? "") || null : null,
      dataCompleteness: planRow ? num(planRow["data_completeness"]) : null,
      measuredAdherence: num(measuredRow?.["adherence"]),
      score: quality.score,
      level: quality.level,
    };
  });

  const archetypes = (await tableExists("recommendation_outcomes"))
    ? (
        await safeQuery(
          `SELECT s.archetype_id, s.sport, COUNT(*) AS plans,
                  SUM(CASE WHEN o.adherence IS NOT NULL THEN 1 ELSE 0 END) AS labelled,
                  AVG(o.adherence) AS adherence,
                  AVG(o.nutrition_adherence) AS nutrition,
                  AVG(o.avg_rpe) AS rpe,
                  SUM(CASE WHEN o.completed_cycle = 1 THEN 1 ELSE 0 END) AS cycles
           FROM recommendation_snapshots s
           JOIN recommendation_outcomes o ON o.snapshot_id = s.id
           GROUP BY s.archetype_id, s.sport
           ORDER BY plans DESC`,
        )
      ).map((row) => ({
        archetypeId: String(row["archetype_id"] ?? ""),
        sport: String(row["sport"] ?? ""),
        plans: num(row["plans"]) ?? 0,
        labelled: num(row["labelled"]) ?? 0,
        avgAdherence: num(row["adherence"]),
        avgNutritionAdherence: num(row["nutrition"]),
        avgRpe: num(row["rpe"]),
        completedCycles: num(row["cycles"]) ?? 0,
      }))
    : [];

  const totalPlans = await safeQuery(`SELECT COUNT(*) AS total FROM recommendation_snapshots`).then(
    (rows) => num(rows[0]?.["total"]) ?? 0,
  );

  const allAdherence = measured
    .map((row) => num(row["adherence"]))
    .filter((v): v is number => v !== null);

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      athletes: athletes.length,
      withSessions: athletes.filter((a) => a.sessions28d > 0).length,
      withCheckins: athletes.filter((a) => a.checkins14d > 0).length,
      withMeals: athletes.filter((a) => a.mealDays28d > 0).length,
      plans: totalPlans,
      labelledPlans: athletes.filter((a) => a.measuredAdherence !== null).length,
      avgAdherence: allAdherence.length
        ? Math.round((allAdherence.reduce((a, b) => a + b, 0) / allAdherence.length) * 1000) / 1000
        : null,
    },
    athletes,
    archetypes,
  };
}

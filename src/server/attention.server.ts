/**
 * «امروز اول سراغ این‌ها برو» — real roster, real silence.
 *
 * The list is built from four timestamps per athlete (plan, session, check-in, meal) run through
 * the athlete's own nudge rules, so the coach sees exactly why the athlete is being nudged and
 * gets the same suggested next step. No invented readiness score, no ranking of people.
 *
 * Read-only, schema-adaptive: a missing table means "we know nothing about that signal", and
 * the item is simply not produced.
 */
import type { RowDataPacket } from "mysql2/promise";
import { dbQuery, isDatabaseConfigured, tableExists } from "@/lib/db.server";
import { computeNudges, NUDGE_THRESHOLDS } from "@/services/athlete/nudges";
import type { CoachAttention, LiveAttentionItem } from "@/domain/attention";

const LOOKBACK_DAYS = 90;
const dayMs = 86_400_000;

async function safeQuery(sql: string, params: unknown[] = []): Promise<RowDataPacket[]> {
  try {
    return await dbQuery<RowDataPacket[]>(sql, params);
  } catch {
    return [];
  }
}

/** Accepts a MySQL DATE/DATETIME (Date or string); null on anything unusable. */
function daysSince(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const at = value instanceof Date ? value : new Date(String(value).slice(0, 10));
  if (Number.isNaN(at.getTime())) return null;
  const days = Math.floor((Date.now() - at.getTime()) / dayMs);
  return days < 0 ? 0 : days;
}

function silenceLabel(days: number | null): string {
  if (days === null) return "هیچ ثبت‌شدنی ندارد";
  if (days === 0) return "امروز فعال بوده";
  return `${days} روز بی‌خبر`;
}

const num = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export async function getCoachAttention(options: { limit?: number } = {}): Promise<CoachAttention> {
  const limit = Math.floor(Math.min(500, Math.max(1, options.limit ?? 200)));
  const empty: CoachAttention = {
    generatedAt: new Date().toISOString(),
    summary: { athletes: 0, act: 0, watch: 0, quiet: 0 },
    items: [],
  };

  if (!isDatabaseConfigured()) return empty;
  if (!(await tableExists("users"))) return empty;

  const roster = await safeQuery(
    `SELECT id, email, first_name, last_name
     FROM users
     WHERE role IS NULL OR LOWER(role) NOT IN ('coach', 'head_coach', 'admin')
     ORDER BY created_at DESC
     LIMIT ${limit}`,
  );
  if (roster.length === 0) return empty;

  const [sessions, checkins, meals, plans] = await Promise.all([
    tableExists("training_sessions").then((exists) =>
      exists
        ? safeQuery(
            `SELECT athlete_user_id AS uid, MAX(scheduled_at) AS last_at, COUNT(*) AS total
             FROM training_sessions
             WHERE scheduled_at >= (NOW() - INTERVAL ${LOOKBACK_DAYS} DAY)
             GROUP BY athlete_user_id`,
          )
        : [],
    ),
    tableExists("athlete_checkins").then((exists) =>
      exists
        ? safeQuery(
            `SELECT athlete_user_id AS uid,
                    MAX(checkin_date) AS last_at,
                    SUM(CASE WHEN checkin_date = CURDATE() THEN 1 ELSE 0 END) AS today
             FROM athlete_checkins
             WHERE checkin_date >= (CURDATE() - INTERVAL ${LOOKBACK_DAYS} DAY)
             GROUP BY athlete_user_id`,
          )
        : [],
    ),
    tableExists("nutrition_logs").then((exists) =>
      exists
        ? safeQuery(
            `SELECT athlete_user_id AS uid, MAX(logged_at) AS last_at
             FROM nutrition_logs
             WHERE logged_at >= (NOW() - INTERVAL ${LOOKBACK_DAYS} DAY)
             GROUP BY athlete_user_id`,
          )
        : [],
    ),
    tableExists("recommendation_snapshots").then((exists) =>
      exists
        ? safeQuery(
            `SELECT user_id AS uid, MAX(created_at) AS last_at
             FROM recommendation_snapshots
             GROUP BY user_id`,
          )
        : [],
    ),
  ]);

  const byUid = (rows: RowDataPacket[]) => new Map(rows.map((row) => [String(row["uid"]), row]));
  const sessionMap = byUid(sessions);
  const checkinMap = byUid(checkins);
  const mealMap = byUid(meals);
  const planMap = byUid(plans);

  const items: LiveAttentionItem[] = [];
  let quiet = 0;

  for (const row of roster) {
    const uid = String(row["id"]);
    const name =
      `${row["first_name"] ?? ""} ${row["last_name"] ?? ""}`.trim() ||
      String(row["email"] ?? "").split("@")[0] ||
      "ورزشکار";

    const sessionRow = sessionMap.get(uid);
    const checkinRow = checkinMap.get(uid);
    const mealRow = mealMap.get(uid);
    const planRow = planMap.get(uid);

    const daysSinceSession = daysSince(sessionRow?.["last_at"]);
    const daysSinceCheckin = daysSince(checkinRow?.["last_at"]);
    const daysSinceMeal = daysSince(mealRow?.["last_at"]);
    const planAge = daysSince(planRow?.["last_at"]);

    const nudges = computeNudges({
      hasPlan: Boolean(planRow),
      planAgeDays: planAge,
      daysSinceSession,
      daysSinceCheckin,
      daysSinceNutrition: daysSinceMeal,
      checkedInToday: num(checkinRow?.["today"]) > 0,
    });

    if (nudges.length === 0) {
      quiet += 1;
      continue;
    }

    const silence =
      [daysSinceSession, daysSinceCheckin, daysSinceMeal]
        .filter((value): value is number => value !== null)
        .sort((a, b) => b - a)[0] ?? null;

    for (const nudge of nudges) {
      items.push({
        id: `${uid}:${nudge.code}`,
        athleteId: uid,
        athleteName: name,
        code: nudge.code,
        severity: nudge.severity === "action" ? "act" : "watch",
        detailFa: nudge.titleFa,
        actionFa: nudge.actionFa,
        silentDaysFa: silenceLabel(silence),
      });
    }
  }

  items.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "act" ? -1 : 1;
    return a.athleteName.localeCompare(b.athleteName, "fa");
  });

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      athletes: roster.length,
      act: items.filter((item) => item.severity === "act").length,
      watch: items.filter((item) => item.severity === "watch").length,
      quiet,
    },
    items,
  };
}

export { NUDGE_THRESHOLDS };

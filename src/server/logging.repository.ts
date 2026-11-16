/**
 * Athlete-facing logging: the thin signals the model needs most.
 *
 * A brand-new athlete has an assessment but no history, so the recommender quietly falls
 * back to the fill values baked into the model (adherence 0.7, RPE 7, no readiness…).
 * These four writes fix that at the source:
 *
 *   session  → `training_sessions`  (completed / planned, RPE, duration)
 *   nutrition→ `nutrition_logs`     (logged days drive nutrition adherence)
 *   checkin  → `athlete_checkins`   (sleep, stress, readiness, body weight)
 *
 * Everything is schema-adaptive (the production database predates some columns) and
 * best-effort: a logging failure never breaks a page.
 */
import crypto from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { dbExecute, dbQuery, getTableColumns, tableExists } from "@/lib/db.server";
import type { AuthenticatedUser } from "@/lib/auth.server";

export interface SessionLogInput {
  title: string;
  performedAt?: string | undefined;
  minutes?: number | undefined;
  rpe?: number | undefined;
  completed?: boolean | undefined;
  sessionType?: string | undefined;
  notes?: string | undefined;
}

export interface NutritionLogInput {
  loggedAt?: string | undefined;
  mealType?: string | undefined;
  description: string;
  calories?: number | undefined;
  proteinG?: number | undefined;
  carbsG?: number | undefined;
  fatG?: number | undefined;
}

export interface CheckinInput {
  date?: string | undefined;
  sleepHours?: number | undefined;
  sleepQuality?: number | undefined;
  stress?: number | undefined;
  readiness?: number | undefined;
  weightKg?: number | undefined;
  restingHr?: number | undefined;
  notes?: string | undefined;
}

export interface CheckinAggregate {
  count: number;
  avgSleepHours?: number | undefined;
  avgStress?: number | undefined;
  avgReadiness?: number | undefined;
  latestWeightKg?: number | undefined;
}

function toSqlDateTime(iso: string | undefined): string {
  const date = iso ? new Date(iso) : new Date();
  const safe = Number.isNaN(date.getTime()) ? new Date() : date;
  return safe.toISOString().slice(0, 19).replace("T", " ");
}

function toSqlDate(iso: string | undefined): string {
  const date = iso ? new Date(iso) : new Date();
  const safe = Number.isNaN(date.getTime()) ? new Date() : date;
  return safe.toISOString().slice(0, 10);
}

/** `training_sessions.program_id` is NOT NULL and FK-bound, so every athlete needs a program. */
async function ensureProgramId(user: AuthenticatedUser): Promise<string | null> {
  try {
    if (!(await tableExists("training_programs"))) return null;
    const rows = await dbQuery<RowDataPacket[]>(
      `SELECT id FROM training_programs WHERE athlete_user_id = ? ORDER BY updated_at DESC LIMIT 1`,
      [user.id],
    );
    const existing = rows[0]?.["id"];
    if (existing) return String(existing);

    const id = crypto.randomUUID();
    const cols = await getTableColumns("training_programs");
    const insertCols = ["id", "athlete_user_id", "title"];
    const insertVals: unknown[] = [id, user.id, "برنامه FitLytix"];
    if (cols.has("source")) {
      insertCols.push("source");
      insertVals.push("fitlytix");
    }
    if (cols.has("status")) {
      insertCols.push("status");
      insertVals.push("active");
    }
    if (cols.has("version_no")) {
      insertCols.push("version_no");
      insertVals.push(1);
    }
    if (cols.has("data_origin")) {
      insertCols.push("data_origin");
      insertVals.push("live");
    }
    const placeholders = insertCols.map(() => "?").join(", ");
    await dbExecute(
      `INSERT INTO training_programs (${insertCols.join(", ")}) VALUES (${placeholders})`,
      insertVals,
    );
    return id;
  } catch (error) {
    console.warn(
      "[logging] ensureProgramId failed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/** Records a session the athlete completed (or deliberately skipped). */
export async function logSession(
  user: AuthenticatedUser,
  input: SessionLogInput,
): Promise<{ id: string } | null> {
  try {
    if (!(await tableExists("training_sessions"))) return null;
    const programId = await ensureProgramId(user);
    if (!programId) return null;

    const cols = await getTableColumns("training_sessions");
    const id = crypto.randomUUID();
    const performedAt = toSqlDateTime(input.performedAt);
    const completed = input.completed !== false;

    const insertCols: string[] = ["id", "program_id", "athlete_user_id", "title"];
    const insertVals: unknown[] = [id, programId, user.id, input.title];

    if (cols.has("scheduled_at")) {
      insertCols.push("scheduled_at");
      insertVals.push(performedAt);
    }
    if (cols.has("status")) {
      insertCols.push("status");
      insertVals.push(completed ? "completed" : "missed");
    }
    if (cols.has("completed_at")) {
      insertCols.push("completed_at");
      insertVals.push(completed ? performedAt : null);
    }
    if (cols.has("started_at") && completed) {
      insertCols.push("started_at");
      insertVals.push(performedAt);
    }
    if (cols.has("session_type") && input.sessionType) {
      insertCols.push("session_type");
      insertVals.push(input.sessionType);
    }
    if (cols.has("perceived_exertion") && input.rpe !== undefined) {
      insertCols.push("perceived_exertion");
      insertVals.push(input.rpe);
    }
    if (cols.has("duration_seconds") && input.minutes !== undefined) {
      insertCols.push("duration_seconds");
      insertVals.push(Math.round(input.minutes * 60));
    }
    if (cols.has("athlete_notes") && input.notes) {
      insertCols.push("athlete_notes");
      insertVals.push(input.notes);
    }
    if (cols.has("data_origin")) {
      insertCols.push("data_origin");
      insertVals.push("live");
    }

    const placeholders = insertCols.map(() => "?").join(", ");
    await dbExecute(
      `INSERT INTO training_sessions (${insertCols.join(", ")}) VALUES (${placeholders})`,
      insertVals,
    );
    return { id };
  } catch (error) {
    console.warn("[logging] logSession failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

/** Records one meal. Logged days — not calories — are what the model reads as adherence. */
export async function logNutrition(
  user: AuthenticatedUser,
  input: NutritionLogInput,
): Promise<{ id: string } | null> {
  try {
    if (!(await tableExists("nutrition_logs"))) return null;
    const cols = await getTableColumns("nutrition_logs");
    const id = crypto.randomUUID();

    const insertCols: string[] = ["id", "athlete_user_id", "description"];
    const insertVals: unknown[] = [id, user.id, input.description];

    if (cols.has("logged_at")) {
      insertCols.push("logged_at");
      insertVals.push(toSqlDateTime(input.loggedAt));
    }
    if (cols.has("meal_type") && input.mealType) {
      insertCols.push("meal_type");
      insertVals.push(input.mealType);
    }
    if (cols.has("calories") && input.calories !== undefined) {
      insertCols.push("calories");
      insertVals.push(Math.round(input.calories));
    }
    if (cols.has("protein_g") && input.proteinG !== undefined) {
      insertCols.push("protein_g");
      insertVals.push(input.proteinG);
    }
    if (cols.has("carbs_g") && input.carbsG !== undefined) {
      insertCols.push("carbs_g");
      insertVals.push(input.carbsG);
    }
    if (cols.has("fat_g") && input.fatG !== undefined) {
      insertCols.push("fat_g");
      insertVals.push(input.fatG);
    }
    if (cols.has("data_origin")) {
      insertCols.push("data_origin");
      insertVals.push("live");
    }

    const placeholders = insertCols.map(() => "?").join(", ");
    await dbExecute(
      `INSERT INTO nutrition_logs (${insertCols.join(", ")}) VALUES (${placeholders})`,
      insertVals,
    );
    return { id };
  } catch (error) {
    console.warn("[logging] logNutrition failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Daily check-in (sleep / stress / readiness / weight). One row per day: submitting twice
 * updates that day instead of piling up duplicates.
 */
export async function logCheckin(
  user: AuthenticatedUser,
  input: CheckinInput,
): Promise<{ id: string } | null> {
  try {
    if (!(await tableExists("athlete_checkins"))) return null;
    const cols = await getTableColumns("athlete_checkins");
    const id = crypto.randomUUID();

    const insertCols: string[] = ["id", "athlete_user_id", "checkin_date"];
    const insertVals: unknown[] = [id, user.id, toSqlDate(input.date)];

    const add = (column: string, value: unknown) => {
      if (value === undefined || !cols.has(column)) return;
      insertCols.push(column);
      insertVals.push(value);
    };
    add("sleep_hours", input.sleepHours);
    add("sleep_quality", input.sleepQuality);
    add("stress", input.stress);
    add("readiness", input.readiness);
    add("weight_kg", input.weightKg);
    add("resting_hr", input.restingHr);
    add("notes", input.notes);
    if (cols.has("source")) {
      insertCols.push("source");
      insertVals.push("manual");
    }

    const placeholders = insertCols.map(() => "?").join(", ");
    const updates = insertCols
      .filter(
        (column) => column !== "id" && column !== "athlete_user_id" && column !== "checkin_date",
      )
      .map((column) => `${column} = VALUES(${column})`)
      .join(", ");

    await dbExecute(
      `INSERT INTO athlete_checkins (${insertCols.join(", ")}) VALUES (${placeholders})
       ON DUPLICATE KEY UPDATE ${updates || "id = id"}`,
      insertVals,
    );
    return { id };
  } catch (error) {
    console.warn("[logging] logCheckin failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

/** Rolling check-in summary — used by the recommender to replace stale assessment answers. */
export async function readCheckinAggregate(userId: string, days = 14): Promise<CheckinAggregate> {
  try {
    if (!(await tableExists("athlete_checkins"))) return { count: 0 };
    const rows = await dbQuery<RowDataPacket[]>(
      `SELECT
         COUNT(*) AS total,
         AVG(sleep_hours) AS sleep,
         AVG(stress) AS stress,
         AVG(readiness) AS readiness
       FROM athlete_checkins
       WHERE athlete_user_id = ? AND checkin_date >= (CURDATE() - INTERVAL ? DAY)`,
      [userId, days],
    );
    const row = rows[0];
    const count = Number(row?.["total"] ?? 0);
    if (!count) return { count: 0 };

    const latest = await dbQuery<RowDataPacket[]>(
      `SELECT weight_kg FROM athlete_checkins
       WHERE athlete_user_id = ? AND weight_kg IS NOT NULL
       ORDER BY checkin_date DESC LIMIT 1`,
      [userId],
    );
    const num = (value: unknown) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
    };

    return {
      count,
      ...(num(row?.["sleep"]) !== undefined ? { avgSleepHours: num(row?.["sleep"]) } : {}),
      ...(num(row?.["stress"]) !== undefined ? { avgStress: num(row?.["stress"]) } : {}),
      ...(num(row?.["readiness"]) !== undefined ? { avgReadiness: num(row?.["readiness"]) } : {}),
      ...(num(latest[0]?.["weight_kg"]) !== undefined
        ? { latestWeightKg: num(latest[0]?.["weight_kg"]) }
        : {}),
    };
  } catch {
    return { count: 0 };
  }
}

export interface RecentSession {
  id: string;
  title: string;
  status: string;
  rpe: number | null;
  minutes: number | null;
  at: string;
}

export interface RecentMeal {
  id: string;
  description: string;
  mealType: string | null;
  calories: number | null;
  proteinG: number | null;
  at: string;
}

export interface RecentCheckin {
  date: string;
  sleepHours: number | null;
  stress: number | null;
  readiness: number | null;
  weightKg: number | null;
}

export interface RecentLogs {
  sessions: RecentSession[];
  nutrition: RecentMeal[];
  checkins: RecentCheckin[];
}

/** Data captured in the last `days` days, for the athlete's "what did I log" panel. */
export async function listRecentLogs(userId: string, days = 14): Promise<RecentLogs> {
  const empty: RecentLogs = { sessions: [], nutrition: [], checkins: [] };
  try {
    const sessions = (await tableExists("training_sessions"))
      ? await dbQuery<RowDataPacket[]>(
          `SELECT id, title, status, perceived_exertion, duration_seconds, scheduled_at, completed_at
           FROM training_sessions
           WHERE athlete_user_id = ? AND scheduled_at >= (NOW() - INTERVAL ? DAY)
           ORDER BY scheduled_at DESC LIMIT 50`,
          [userId, days],
        )
      : [];
    const nutrition = (await tableExists("nutrition_logs"))
      ? await dbQuery<RowDataPacket[]>(
          `SELECT id, description, meal_type, calories, protein_g, logged_at
           FROM nutrition_logs
           WHERE athlete_user_id = ? AND logged_at >= (NOW() - INTERVAL ? DAY)
           ORDER BY logged_at DESC LIMIT 50`,
          [userId, days],
        )
      : [];
    const checkins = (await tableExists("athlete_checkins"))
      ? await dbQuery<RowDataPacket[]>(
          `SELECT checkin_date, sleep_hours, stress, readiness, weight_kg
           FROM athlete_checkins
           WHERE athlete_user_id = ? AND checkin_date >= (CURDATE() - INTERVAL ? DAY)
           ORDER BY checkin_date DESC LIMIT 30`,
          [userId, days],
        )
      : [];

    return {
      ...empty,
      sessions: sessions.map((row) => ({
        id: String(row["id"]),
        title: String(row["title"] ?? ""),
        status: String(row["status"] ?? ""),
        rpe: row["perceived_exertion"] === null ? null : Number(row["perceived_exertion"]),
        minutes:
          row["duration_seconds"] === null
            ? null
            : Math.round(Number(row["duration_seconds"]) / 60),
        at: String(row["scheduled_at"] ?? row["completed_at"] ?? ""),
      })),
      nutrition: nutrition.map((row) => ({
        id: String(row["id"]),
        description: String(row["description"] ?? ""),
        mealType: row["meal_type"] === null ? null : String(row["meal_type"]),
        calories: row["calories"] === null ? null : Number(row["calories"]),
        proteinG: row["protein_g"] === null ? null : Number(row["protein_g"]),
        at: String(row["logged_at"] ?? ""),
      })),
      checkins: checkins.map((row) => ({
        date: String(row["checkin_date"] ?? ""),
        sleepHours: row["sleep_hours"] === null ? null : Number(row["sleep_hours"]),
        stress: row["stress"] === null ? null : Number(row["stress"]),
        readiness: row["readiness"] === null ? null : Number(row["readiness"]),
        weightKg: row["weight_kg"] === null ? null : Number(row["weight_kg"]),
      })),
    };
  } catch (error) {
    console.warn(
      "[logging] listRecentLogs failed:",
      error instanceof Error ? error.message : error,
    );
    return empty;
  }
}

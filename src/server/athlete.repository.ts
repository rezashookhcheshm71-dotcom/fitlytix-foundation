import crypto from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { COMMON_ASSESSMENT, SPORT_ASSESSMENTS } from "@/domain/assessment/templates";
import { bodyAnalysisInputSchema, type BodyAnalysisInput, type BodyAnalysisRecord } from "@/domain/body-analysis";
import { SPORTS } from "@/domain/sports";
import {
  HEALTH_PROVIDERS,
  type AssessmentAnswers,
  type ExperienceLevel,
  type HealthProvider,
  type SportId,
  type WearableIntent,
} from "@/domain/types";
import { assessmentEngine } from "@/services/assessment/engine";
import { AuthHttpError, hashPassword, verifyPassword, type AuthenticatedUser } from "@/lib/auth.server";
import { dbExecute, dbQuery, getTableColumns, tableExists } from "@/lib/db.server";

const CANONICAL_SPORT_UUIDS: Record<SportId, string> = {
  crossfit: "11111111-1111-4111-8111-000000000001",
  hyrox: "11111111-1111-4111-8111-000000000002",
  functional: "11111111-1111-4111-8111-000000000003",
  bodybuilding: "11111111-1111-4111-8111-000000000004",
  running: "11111111-1111-4111-8111-000000000005",
};

export function isValidSportSlug(value: unknown): value is SportId {
  return typeof value === "string" && value in SPORTS;
}

export function isValidExperienceLevel(value: unknown): value is ExperienceLevel {
  return value === "beginner" || value === "intermediate" || value === "advanced" || value === "elite";
}

function nowSqlUtc(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw === "object") return raw as T;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export const athleteRepository = {
  /**
   * Resolves a sport slug (crossfit, hyrox, functional, bodybuilding, running)
   * to the actual MySQL `sports.id` (CHAR(36)). Inserts the canonical sport if missing.
   */
  async resolveSportId(sportSlug: SportId): Promise<string> {
    if (!isValidSportSlug(sportSlug)) {
      throw new AuthHttpError(400, "رشته ورزشی انتخاب‌شده معتبر نیست.");
    }

    const sportMeta = SPORTS[sportSlug];
    const fallbackId = CANONICAL_SPORT_UUIDS[sportSlug];

    if (!(await tableExists("sports"))) {
      return fallbackId;
    }

    const cols = await getTableColumns("sports");
    const slugCol = cols.has("slug") ? "slug" : cols.has("code") ? "code" : null;

    if (slugCol) {
      const rows = await dbQuery<RowDataPacket[]>(
        `SELECT id FROM sports WHERE LOWER(${slugCol}) = ? LIMIT 1`,
        [sportSlug],
      );
      if (rows[0]?.["id"]) {
        return String(rows[0]["id"]);
      }
    }

    if (cols.has("name")) {
      const rows = await dbQuery<RowDataPacket[]>(
        `SELECT id FROM sports WHERE LOWER(name) = ? OR id = ? LIMIT 1`,
        [sportMeta.name.toLowerCase(), fallbackId],
      );
      if (rows[0]?.["id"]) {
        return String(rows[0]["id"]);
      }
    }

    // Safely insert the missing sport row
    const insertCols: string[] = ["id"];
    const insertVals: unknown[] = [fallbackId];

    if (slugCol) {
      insertCols.push(slugCol);
      insertVals.push(sportSlug);
    }
    if (cols.has("name")) {
      insertCols.push("name");
      insertVals.push(sportMeta.name);
    }
    if (cols.has("name_fa")) {
      insertCols.push("name_fa");
      insertVals.push(sportMeta.nameFa);
    }
    if (cols.has("is_active")) {
      insertCols.push("is_active");
      insertVals.push(1);
    }

    const placeholders = insertCols.map(() => "?").join(", ");
    await dbExecute(
      `INSERT IGNORE INTO sports (${insertCols.join(", ")}) VALUES (${placeholders})`,
      insertVals,
    );

    return fallbackId;
  },

  /**
   * Ensures an athlete profile record exists for the given authenticated user ID.
   */
  async ensureAthleteProfile(
    userId: string,
    defaults?: { primarySport?: SportId; experience?: ExperienceLevel },
  ): Promise<{ athleteId: string; primarySport: SportId; experience: ExperienceLevel }> {
    const sport: SportId = defaults?.primarySport ?? "crossfit";
    const experience: ExperienceLevel = defaults?.experience ?? "beginner";
    const sportId = await this.resolveSportId(sport);

    for (const tbl of ["athlete_profiles", "athletes"]) {
      if (!(await tableExists(tbl))) continue;
      const cols = await getTableColumns(tbl);
      const userCol = cols.has("user_id") ? "user_id" : cols.has("athlete_user_id") ? "athlete_user_id" : null;
      if (!userCol) continue;

      const existing = await dbQuery<RowDataPacket[]>(
        `SELECT * FROM ${tbl} WHERE ${userCol} = ? LIMIT 1`,
        [userId],
      );
      if (existing[0]) {
        const row = existing[0];
        const rowSportRaw = String(row["primary_sport_slug"] ?? row["primary_sport"] ?? sport).toLowerCase();
        const rowExpRaw = String(row["experience_level"] ?? row["experience"] ?? experience).toLowerCase();
        return {
          athleteId: String(row["id"] ?? userId),
          primarySport: isValidSportSlug(rowSportRaw) ? rowSportRaw : sport,
          experience: isValidExperienceLevel(rowExpRaw) ? rowExpRaw : experience,
        };
      }

      const newAthleteId = crypto.randomUUID();
      const insertCols: string[] = [];
      const insertVals: unknown[] = [];

      if (cols.has("id")) {
        insertCols.push("id");
        insertVals.push(newAthleteId);
      }
      insertCols.push(userCol);
      insertVals.push(userId);

      if (cols.has("primary_sport_id")) {
        insertCols.push("primary_sport_id");
        insertVals.push(sportId);
      }
      if (cols.has("primary_sport_slug")) {
        insertCols.push("primary_sport_slug");
        insertVals.push(sport);
      } else if (cols.has("primary_sport")) {
        insertCols.push("primary_sport");
        insertVals.push(sport);
      }
      if (cols.has("experience_level")) {
        insertCols.push("experience_level");
        insertVals.push(experience);
      } else if (cols.has("experience")) {
        insertCols.push("experience");
        insertVals.push(experience);
      }

      const placeholders = insertCols.map(() => "?").join(", ");
      await dbExecute(`INSERT INTO ${tbl} (${insertCols.join(", ")}) VALUES (${placeholders})`, insertVals);

      return { athleteId: newAthleteId, primarySport: sport, experience };
    }

    return { athleteId: userId, primarySport: sport, experience };
  },

  /**
   * Registers a new user and athlete profile in MySQL.
   */
  async registerAthlete(input: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    password: string;
  }): Promise<AuthenticatedUser> {
    const email = input.email.trim().toLowerCase();
    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();
    const phone = input.phone.trim();

    if (!email || !email.includes("@")) {
      throw new AuthHttpError(400, "لطفاً یک آدرس ایمیل معتبر وارد کنید.");
    }
    if (!firstName || !lastName) {
      throw new AuthHttpError(400, "وارد کردن نام و نام خانوادگی الزامی است.");
    }
    if (!input.password || input.password.length < 6) {
      throw new AuthHttpError(400, "رمز عبور باید حداقل ۶ کاراکتر باشد.");
    }

    const existing = await dbQuery<RowDataPacket[]>(
      `SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1`,
      [email],
    );
    if (existing.length > 0) {
      throw new AuthHttpError(409, "این ایمیل قبلاً در FitLytix ثبت شده است. لطفاً وارد شوید.");
    }

    const userId = crypto.randomUUID();
    const passwordHash = hashPassword(input.password);
    const cols = await getTableColumns("users");

    const insertCols: string[] = ["id", "email"];
    const insertVals: unknown[] = [userId, email];

    if (cols.has("password_hash")) {
      insertCols.push("password_hash");
      insertVals.push(passwordHash);
    } else if (cols.has("password")) {
      insertCols.push("password");
      insertVals.push(passwordHash);
    }

    if (cols.has("first_name")) {
      insertCols.push("first_name");
      insertVals.push(firstName);
    }
    if (cols.has("last_name")) {
      insertCols.push("last_name");
      insertVals.push(lastName);
    }
    if (cols.has("full_name")) {
      insertCols.push("full_name");
      insertVals.push(`${firstName} ${lastName}`.trim());
    } else if (cols.has("name") && !cols.has("first_name")) {
      insertCols.push("name");
      insertVals.push(`${firstName} ${lastName}`.trim());
    }

    if (cols.has("phone")) {
      insertCols.push("phone");
      insertVals.push(phone);
    } else if (cols.has("mobile")) {
      insertCols.push("mobile");
      insertVals.push(phone);
    }

    if (cols.has("role")) {
      insertCols.push("role");
      insertVals.push("athlete");
    }
    if (cols.has("status")) {
      insertCols.push("status");
      insertVals.push("active");
    }

    const placeholders = insertCols.map(() => "?").join(", ");
    await dbExecute(`INSERT INTO users (${insertCols.join(", ")}) VALUES (${placeholders})`, insertVals);

    const profile = await this.ensureAthleteProfile(userId, {
      primarySport: "crossfit",
      experience: "beginner",
    });

    return {
      id: userId,
      athleteId: profile.athleteId,
      email,
      firstName,
      lastName,
      phone,
      role: "athlete",
      primarySport: profile.primarySport,
    };
  },

  /**
   * Authenticates an existing user by email & password against MySQL `users`.
   */
  async authenticateByEmail(input: { email: string; password: string }): Promise<AuthenticatedUser> {
    const email = input.email.trim().toLowerCase();
    if (!email || !input.password) {
      throw new AuthHttpError(400, "ایمیل و رمز عبور الزامی است.");
    }

    const rows = await dbQuery<RowDataPacket[]>(`SELECT * FROM users WHERE LOWER(email) = ? LIMIT 1`, [email]);
    const row = rows[0];
    if (!row) {
      throw new AuthHttpError(401, "ایمیل یا رمز عبور صحیح نیست.");
    }

    if (row["status"] && String(row["status"]).toLowerCase() === "disabled") {
      throw new AuthHttpError(403, "حساب کاربری غیرفعال است.");
    }

    const storedHash = String(row["password_hash"] ?? row["password"] ?? "");
    if (!verifyPassword(input.password, storedHash)) {
      throw new AuthHttpError(401, "ایمیل یا رمز عبور صحیح نیست.");
    }

    const userId = String(row["id"]);
    const profile = await this.ensureAthleteProfile(userId);
    const fullName = String(row["full_name"] ?? row["name"] ?? "").trim();
    const firstName = String(row["first_name"] ?? (fullName.split(" ")[0] || "ورزشکار"));
    const lastName = String(row["last_name"] ?? fullName.split(" ").slice(1).join(" ") ?? "");
    const phone = String(row["phone"] ?? row["mobile"] ?? "");
    const roleRaw = String(row["role"] ?? "athlete").toLowerCase();
    const role =
      roleRaw === "coach" || roleRaw === "head_coach" || roleRaw === "admin"
        ? (roleRaw as AuthenticatedUser["role"])
        : "athlete";

    return {
      id: userId,
      athleteId: profile.athleteId,
      email: String(row["email"] ?? email),
      firstName,
      lastName,
      phone,
      role,
      primarySport: profile.primarySport,
    };
  },

  /**
   * Validates and persists a Common or Sport-Specific Assessment for the authenticated user.
   * Also persists optional BodyAnalysisInput (Step 2) and WearableIntent/providers (Step 3).
   */
  async saveAssessment(params: {
    user: AuthenticatedUser;
    templateId: string;
    sport?: SportId | undefined;
    experienceLevel?: ExperienceLevel | undefined;
    answers: AssessmentAnswers;
    bodyAnalysis?: Partial<BodyAnalysisInput> | undefined;
    wearable?: { intent?: WearableIntent | undefined; providers?: HealthProvider[] | undefined } | undefined;
  }): Promise<{
    assessmentId: string;
    athleteId: string;
    userId: string;
    templateId: string;
    scope: "common" | SportId;
    sportId: string | null;
    status: "submitted";
    completion: number;
    completedAt: string;
    bodyRecordId?: string | undefined;
    wearableSaved?: boolean | undefined;
  }> {
    const { user, templateId, answers } = params;

    // 1. Validate template and scope on the server
    const isCommon = templateId === COMMON_ASSESSMENT.id || templateId === "common";
    let scope: "common" | SportId = "common";
    let sportSlug: SportId | null = null;
    let sportId: string | null = null;

    if (!isCommon) {
      const resolvedSport: SportId | undefined =
        params.sport && isValidSportSlug(params.sport)
          ? params.sport
          : (Object.keys(SPORT_ASSESSMENTS) as SportId[]).find((s) => SPORT_ASSESSMENTS[s].id === templateId);

      if (!resolvedSport) {
        throw new AuthHttpError(400, "قالب ارزیابی یا رشته ورزشی معتبر نیست.");
      }
      scope = resolvedSport;
      sportSlug = resolvedSport;
      sportId = await this.resolveSportId(resolvedSport);
    }

    const template = isCommon ? COMMON_ASSESSMENT : SPORT_ASSESSMENTS[sportSlug!];
    const allowedFieldIds = new Set(template.sections.flatMap((s) => s.fields.map((f) => f.id)));

    if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
      throw new AuthHttpError(400, "پاسخ‌های ارزیابی معتبر نیستند.");
    }

    // Sanitize answers to only known template fields
    const sanitizedAnswers: AssessmentAnswers = {};
    for (const [key, val] of Object.entries(answers)) {
      if (!allowedFieldIds.has(key)) continue;
      if (val === undefined || val === "") continue;
      if (typeof val === "string" || typeof val === "number") {
        sanitizedAnswers[key] = val;
      } else if (Array.isArray(val) && val.every((item) => typeof item === "string")) {
        sanitizedAnswers[key] = val;
      }
    }

    const experienceLevel: ExperienceLevel = isValidExperienceLevel(params.experienceLevel)
      ? params.experienceLevel
      : "beginner";

    const visibleSections = isCommon
      ? template.sections
      : assessmentEngine.visibleFields(template, experienceLevel);
    const completion = assessmentEngine.completion({ ...template, sections: visibleSections }, sanitizedAnswers);

    const profile = await this.ensureAthleteProfile(user.id, {
      primarySport: sportSlug ?? (isValidSportSlug(user.primarySport) ? user.primarySport : "crossfit"),
      experience: experienceLevel,
    });

    const assessmentId = crypto.randomUUID();
    const completedAtIso = new Date().toISOString();
    const completedAtSql = completedAtIso.slice(0, 19).replace("T", " ");

    // 2. Persist to `assessments` table
    if (await tableExists("assessments")) {
      const cols = await getTableColumns("assessments");
      const insertCols: string[] = [];
      const insertVals: unknown[] = [];

      if (cols.has("id")) {
        insertCols.push("id");
        insertVals.push(assessmentId);
      }
      if (cols.has("athlete_user_id")) {
        insertCols.push("athlete_user_id");
        insertVals.push(user.id);
      }
      if (cols.has("user_id")) {
        insertCols.push("user_id");
        insertVals.push(user.id);
      }
      if (cols.has("athlete_id")) {
        // Check if athlete_id references users(id) or athlete_profiles(id)
        insertCols.push("athlete_id");
        insertVals.push(cols.has("athlete_user_id") ? profile.athleteId : user.id);
      }
      if (cols.has("sport_id")) {
        insertCols.push("sport_id");
        insertVals.push(sportId);
      }
      if (cols.has("sport_slug")) {
        insertCols.push("sport_slug");
        insertVals.push(sportSlug);
      } else if (cols.has("sport") && !cols.has("sport_id")) {
        insertCols.push("sport");
        insertVals.push(sportSlug);
      }
      if (cols.has("template_id")) {
        insertCols.push("template_id");
        insertVals.push(template.id);
      } else if (cols.has("template_code")) {
        insertCols.push("template_code");
        insertVals.push(template.id);
      }
      if (cols.has("template_version")) {
        insertCols.push("template_version");
        insertVals.push(template.version);
      }
      if (cols.has("scope")) {
        insertCols.push("scope");
        insertVals.push(scope);
      } else if (cols.has("assessment_type")) {
        insertCols.push("assessment_type");
        insertVals.push(scope);
      }
      if (cols.has("experience_level")) {
        insertCols.push("experience_level");
        insertVals.push(isCommon ? null : experienceLevel);
      }
      if (cols.has("status")) {
        insertCols.push("status");
        insertVals.push("submitted");
      }
      if (cols.has("completion_ratio")) {
        insertCols.push("completion_ratio");
        insertVals.push(Number(completion.toFixed(4)));
      }
      if (cols.has("answers_json")) {
        insertCols.push("answers_json");
        insertVals.push(JSON.stringify(sanitizedAnswers));
      } else if (cols.has("answers")) {
        insertCols.push("answers");
        insertVals.push(JSON.stringify(sanitizedAnswers));
      } else if (cols.has("payload")) {
        insertCols.push("payload");
        insertVals.push(JSON.stringify(sanitizedAnswers));
      }
      if (cols.has("completed_at")) {
        insertCols.push("completed_at");
        insertVals.push(completedAtSql);
      } else if (cols.has("submitted_at")) {
        insertCols.push("submitted_at");
        insertVals.push(completedAtSql);
      }

      const placeholders = insertCols.map(() => "?").join(", ");
      await dbExecute(
        `INSERT INTO assessments (${insertCols.join(", ")}) VALUES (${placeholders})`,
        insertVals,
      );
    }

    // 3. Persist normalized rows in `assessment_answers` if table exists
    if (await tableExists("assessment_answers")) {
      const ansCols = await getTableColumns("assessment_answers");
      if (ansCols.has("assessment_id") && ansCols.has("field_id")) {
        const valCol = ansCols.has("value_json")
          ? "value_json"
          : ansCols.has("answer_value")
            ? "answer_value"
            : ansCols.has("value")
              ? "value"
              : null;
        if (valCol) {
          for (const [fieldId, val] of Object.entries(sanitizedAnswers)) {
            const rowCols = ansCols.has("id")
              ? ["id", "assessment_id", "field_id", valCol]
              : ["assessment_id", "field_id", valCol];
            const rowVals = ansCols.has("id")
              ? [crypto.randomUUID(), assessmentId, fieldId, JSON.stringify(val)]
              : [assessmentId, fieldId, JSON.stringify(val)];
            await dbExecute(
              `INSERT INTO assessment_answers (${rowCols.join(", ")}) VALUES (${rowCols.map(() => "?").join(", ")})
               ON DUPLICATE KEY UPDATE ${valCol} = VALUES(${valCol})`,
              rowVals,
            );
          }
        }
      }
    }

    // 4. Update athlete profile baseline fields (age, height, weight, sport, wearable intent)
    await this.updateAthleteProfileFromAssessment({
      userId: user.id,
      isCommon,
      sportSlug,
      sportId,
      experienceLevel,
      answers: sanitizedAnswers,
      wearableIntent: params.wearable?.intent,
    });

    // 5. Persist optional BodyAnalysisInput (Step 2 of Common Assessment)
    let bodyRecordId: string | undefined;
    if (isCommon && params.bodyAnalysis && Object.keys(params.bodyAnalysis).length > 0) {
      const parsedBody = bodyAnalysisInputSchema.safeParse(params.bodyAnalysis);
      if (!parsedBody.success) {
        throw new AuthHttpError(400, "اطلاعات آنالیز بدن معتبر نیست. لطفاً مقادیر واردشده را بررسی کنید.");
      }
      const savedBody = await this.addBodyAnalysisRecord(user.id, parsedBody.data);
      bodyRecordId = savedBody.id;
    }

    // 6. Persist optional Wearable preferences (Step 3 of Common Assessment)
    let wearableSaved: boolean | undefined;
    if (isCommon && params.wearable?.intent) {
      await this.saveWearablePreference(
        user.id,
        params.wearable.intent,
        params.wearable.providers ?? [],
      );
      wearableSaved = true;
    }

    return {
      assessmentId,
      athleteId: profile.athleteId,
      userId: user.id,
      templateId: template.id,
      scope,
      sportId,
      status: "submitted",
      completion,
      completedAt: completedAtIso,
      bodyRecordId,
      wearableSaved,
    };
  },

  async updateAthleteProfileFromAssessment(params: {
    userId: string;
    isCommon: boolean;
    sportSlug: SportId | null;
    sportId: string | null;
    experienceLevel: ExperienceLevel;
    answers: AssessmentAnswers;
    wearableIntent?: WearableIntent | undefined;
  }): Promise<void> {
    for (const tbl of ["athlete_profiles", "athletes"]) {
      if (!(await tableExists(tbl))) continue;
      const cols = await getTableColumns(tbl);
      const userCol = cols.has("user_id") ? "user_id" : cols.has("athlete_user_id") ? "athlete_user_id" : null;
      if (!userCol) continue;

      const updates: string[] = [];
      const values: unknown[] = [];

      if (params.isCommon) {
        const age = Number(params.answers["common.profile.age"]);
        const height = Number(params.answers["common.profile.height_cm"]);
        const weight = Number(params.answers["common.profile.weight_kg"]);
        const history = params.answers["common.profile.training_history"];

        if (Number.isFinite(age) && age > 0 && cols.has("age")) {
          updates.push("age = ?");
          values.push(age);
        }
        if (Number.isFinite(height) && height > 0 && cols.has("height_cm")) {
          updates.push("height_cm = ?");
          values.push(height);
        }
        if (Number.isFinite(weight) && weight > 0 && cols.has("weight_kg")) {
          updates.push("weight_kg = ?");
          values.push(weight);
        }
        if (typeof history === "string" && history && cols.has("training_history")) {
          updates.push("training_history = ?");
          values.push(history);
        }
        if (params.wearableIntent && cols.has("wearable_intent")) {
          updates.push("wearable_intent = ?");
          values.push(params.wearableIntent);
        }
      } else if (params.sportSlug) {
        if (cols.has("primary_sport_id") && params.sportId) {
          updates.push("primary_sport_id = ?");
          values.push(params.sportId);
        }
        if (cols.has("primary_sport_slug")) {
          updates.push("primary_sport_slug = ?");
          values.push(params.sportSlug);
        } else if (cols.has("primary_sport")) {
          updates.push("primary_sport = ?");
          values.push(params.sportSlug);
        }
        if (cols.has("experience_level")) {
          updates.push("experience_level = ?");
          values.push(params.experienceLevel);
        } else if (cols.has("experience")) {
          updates.push("experience = ?");
          values.push(params.experienceLevel);
        }
      }

      if (updates.length > 0) {
        values.push(params.userId);
        await dbExecute(`UPDATE ${tbl} SET ${updates.join(", ")} WHERE ${userCol} = ?`, values);
      }
      break;
    }
  },

  /**
   * Append-only persistence for Body Analysis measurements (InBody / manual).
   */
  async addBodyAnalysisRecord(userId: string, input: BodyAnalysisInput): Promise<BodyAnalysisRecord> {
    const parsed = bodyAnalysisInputSchema.parse(input);
    const id = crypto.randomUUID();
    const createdAtIso = new Date().toISOString();

    if (await tableExists("body_analysis_records")) {
      const cols = await getTableColumns("body_analysis_records");
      const insertCols: string[] = [];
      const insertVals: unknown[] = [];

      if (cols.has("id")) {
        insertCols.push("id");
        insertVals.push(id);
      }
      if (cols.has("athlete_user_id")) {
        insertCols.push("athlete_user_id");
        insertVals.push(userId);
      } else if (cols.has("athlete_id")) {
        insertCols.push("athlete_id");
        insertVals.push(userId);
      } else if (cols.has("user_id")) {
        insertCols.push("user_id");
        insertVals.push(userId);
      }
      if (cols.has("measured_at")) {
        insertCols.push("measured_at");
        insertVals.push(parsed.measuredAt);
      }
      if (cols.has("source")) {
        insertCols.push("source");
        insertVals.push(parsed.source);
      }
      if (cols.has("weight_kg")) {
        insertCols.push("weight_kg");
        insertVals.push(parsed.weightKg);
      }
      if (cols.has("body_fat_pct")) {
        insertCols.push("body_fat_pct");
        insertVals.push(parsed.bodyFatPct ?? null);
      }
      if (cols.has("skeletal_muscle_kg")) {
        insertCols.push("skeletal_muscle_kg");
        insertVals.push(parsed.skeletalMuscleKg ?? null);
      }
      if (cols.has("data_json")) {
        insertCols.push("data_json");
        insertVals.push(JSON.stringify(parsed));
      } else if (cols.has("data")) {
        insertCols.push("data");
        insertVals.push(JSON.stringify(parsed));
      }
      if (cols.has("notes")) {
        insertCols.push("notes");
        insertVals.push(parsed.notes ?? null);
      }
      if (cols.has("data_origin")) {
        insertCols.push("data_origin");
        insertVals.push("live");
      }

      if (insertCols.length >= 2) {
        const placeholders = insertCols.map(() => "?").join(", ");
        await dbExecute(
          `INSERT INTO body_analysis_records (${insertCols.join(", ")}) VALUES (${placeholders})`,
          insertVals,
        );
      }
    }

    return {
      ...parsed,
      id,
      athleteId: userId,
      version: 1,
      createdAt: createdAtIso,
    } as BodyAnalysisRecord;
  },

  /**
   * Persists Step 3 Wearable Intake preferences into `wearable_connections` (`status = 'pending'`).
   */
  async saveWearablePreference(
    userId: string,
    intent: WearableIntent,
    providers: HealthProvider[],
  ): Promise<void> {
    if (!(await tableExists("wearable_connections"))) return;

    const cols = await getTableColumns("wearable_connections");
    const userCol = cols.has("athlete_user_id")
      ? "athlete_user_id"
      : cols.has("athlete_id")
        ? "athlete_id"
        : cols.has("user_id")
          ? "user_id"
          : null;
    if (!userCol) return;

    const validProviders = providers.filter((p): p is HealthProvider =>
      (HEALTH_PROVIDERS as readonly string[]).includes(p),
    );

    if (intent !== "yes" || validProviders.length === 0) {
      return;
    }

    const nowSql = nowSqlUtc();
    for (const provider of validProviders) {
      const insertCols: string[] = [];
      const insertVals: unknown[] = [];

      if (cols.has("id")) {
        insertCols.push("id");
        insertVals.push(crypto.randomUUID());
      }
      insertCols.push(userCol);
      insertVals.push(userId);
      if (cols.has("provider")) {
        insertCols.push("provider");
        insertVals.push(provider);
      }
      if (cols.has("status")) {
        insertCols.push("status");
        insertVals.push("pending");
      }
      if (cols.has("scopes_json")) {
        insertCols.push("scopes_json");
        insertVals.push(JSON.stringify([]));
      }
      if (cols.has("metadata")) {
        insertCols.push("metadata");
        insertVals.push(JSON.stringify({ intent, source: "assessment_step_3", updatedAt: nowSql }));
      }

      const placeholders = insertCols.map(() => "?").join(", ");
      await dbExecute(
        `INSERT INTO wearable_connections (${insertCols.join(", ")}) VALUES (${placeholders})
         ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
        insertVals,
      );
    }
  },

  /**
   * Loads the authenticated athlete's persisted assessments, body analysis records, and wearable preferences.
   */
  async getAthleteAssessmentState(user: AuthenticatedUser): Promise<{
    athleteId: string;
    userId: string;
    primarySport: SportId;
    experienceLevel: ExperienceLevel;
    commonAssessment: {
      id: string;
      templateId: string;
      answers: AssessmentAnswers;
      completedAt?: string | undefined;
      status: string;
    } | null;
    sportAssessments: Record<
      string,
      {
        id: string;
        templateId: string;
        sport: SportId;
        experienceLevel: ExperienceLevel;
        answers: AssessmentAnswers;
        completedAt?: string | undefined;
        status: string;
      }
    >;
    bodyRecords: BodyAnalysisRecord[];
    wearable: {
      intent?: WearableIntent | undefined;
      providers: HealthProvider[];
    };
  }> {
    const profile = await this.ensureAthleteProfile(user.id);
    let commonAssessment: {
      id: string;
      templateId: string;
      answers: AssessmentAnswers;
      completedAt?: string | undefined;
      status: string;
    } | null = null;
    const sportAssessments: Record<
      string,
      {
        id: string;
        templateId: string;
        sport: SportId;
        experienceLevel: ExperienceLevel;
        answers: AssessmentAnswers;
        completedAt?: string | undefined;
        status: string;
      }
    > = {};

    if (await tableExists("assessments")) {
      const cols = await getTableColumns("assessments");
      const userCol = cols.has("athlete_user_id")
        ? "athlete_user_id"
        : cols.has("user_id")
          ? "user_id"
          : cols.has("athlete_id")
            ? "athlete_id"
            : null;

      if (userCol) {
        const orderCol = cols.has("created_at")
          ? "created_at"
          : cols.has("completed_at")
            ? "completed_at"
            : "id";
        const rows = await dbQuery<RowDataPacket[]>(
          `SELECT * FROM assessments WHERE ${userCol} = ? ORDER BY ${orderCol} DESC LIMIT 30`,
          [user.id],
        );

        for (const r of rows) {
          const templateId = String(r["template_id"] ?? r["template_code"] ?? "");
          const scopeRaw = String(r["scope"] ?? r["assessment_type"] ?? r["sport_slug"] ?? "").toLowerCase();
          const answersRaw = r["answers_json"] ?? r["answers"] ?? r["payload"];
          const answers = safeJsonParse<AssessmentAnswers>(answersRaw, {});
          const completedAt = r["completed_at"]
            ? new Date(String(r["completed_at"])).toISOString()
            : r["created_at"]
              ? new Date(String(r["created_at"])).toISOString()
              : undefined;
          const status = String(r["status"] ?? "submitted");

          if (templateId === COMMON_ASSESSMENT.id || scopeRaw === "common") {
            if (!commonAssessment) {
              commonAssessment = {
                id: String(r["id"]),
                templateId: templateId || COMMON_ASSESSMENT.id,
                answers,
                completedAt,
                status,
              };
            }
          } else {
            const sportKey = isValidSportSlug(scopeRaw)
              ? scopeRaw
              : (Object.keys(SPORT_ASSESSMENTS) as SportId[]).find(
                  (s) => SPORT_ASSESSMENTS[s].id === templateId,
                );
            if (sportKey && !sportAssessments[sportKey]) {
              const expRaw = String(r["experience_level"] ?? profile.experience).toLowerCase();
              sportAssessments[sportKey] = {
                id: String(r["id"]),
                templateId: templateId || SPORT_ASSESSMENTS[sportKey].id,
                sport: sportKey,
                experienceLevel: isValidExperienceLevel(expRaw) ? expRaw : profile.experience,
                answers,
                completedAt,
                status,
              };
            }
          }
        }
      }
    }

    // Load body analysis records
    const bodyRecords: BodyAnalysisRecord[] = [];
    if (await tableExists("body_analysis_records")) {
      const cols = await getTableColumns("body_analysis_records");
      const userCol = cols.has("athlete_user_id")
        ? "athlete_user_id"
        : cols.has("athlete_id")
          ? "athlete_id"
          : cols.has("user_id")
            ? "user_id"
            : null;
      if (userCol) {
        const rows = await dbQuery<RowDataPacket[]>(
          `SELECT * FROM body_analysis_records WHERE ${userCol} = ? ORDER BY measured_at ASC LIMIT 50`,
          [user.id],
        );
        for (const r of rows) {
          const parsedData = safeJsonParse<Partial<BodyAnalysisInput>>(
            r["data_json"] ?? r["data"],
            {},
          );
          const weightKg = Number(r["weight_kg"] ?? parsedData.weightKg ?? 0);
          if (weightKg > 0) {
            bodyRecords.push({
              ...(parsedData as unknown as BodyAnalysisRecord),
              id: String(r["id"]),
              athleteId: user.id,
              version: 1,
              measuredAt: String(r["measured_at"] ?? parsedData.measuredAt ?? "").slice(0, 10),
              source: (r["source"] ?? parsedData.source ?? "inbody") as BodyAnalysisRecord["source"],
              weightKg,
              ...(r["body_fat_pct"] != null ? { bodyFatPct: Number(r["body_fat_pct"]) } : {}),
              ...(r["skeletal_muscle_kg"] != null
                ? { skeletalMuscleKg: Number(r["skeletal_muscle_kg"]) }
                : {}),
              createdAt: r["created_at"]
                ? new Date(String(r["created_at"])).toISOString()
                : new Date().toISOString(),
            } as BodyAnalysisRecord);
          }
        }
      }
    }

    // Load wearable connections & intent
    let wearableIntent: WearableIntent | undefined;
    const wearableProviders: HealthProvider[] = [];
    if (await tableExists("wearable_connections")) {
      const cols = await getTableColumns("wearable_connections");
      const userCol = cols.has("athlete_user_id")
        ? "athlete_user_id"
        : cols.has("athlete_id")
          ? "athlete_id"
          : cols.has("user_id")
            ? "user_id"
            : null;
      if (userCol) {
        const rows = await dbQuery<RowDataPacket[]>(
          `SELECT * FROM wearable_connections WHERE ${userCol} = ?`,
          [user.id],
        );
        for (const r of rows) {
          const prov = String(r["provider"] ?? "") as HealthProvider;
          if ((HEALTH_PROVIDERS as readonly string[]).includes(prov)) {
            wearableProviders.push(prov);
          }
        }
        if (wearableProviders.length > 0) {
          wearableIntent = "yes";
        }
      }
    }

    return {
      athleteId: profile.athleteId,
      userId: user.id,
      primarySport: profile.primarySport,
      experienceLevel: profile.experience,
      commonAssessment,
      sportAssessments,
      bodyRecords,
      wearable: {
        intent: wearableIntent,
        providers: wearableProviders,
      },
    };
  },
};

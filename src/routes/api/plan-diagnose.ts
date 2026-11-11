/**
 * Deployment self-check for the recommendation pipeline.
 *
 *   GET /api/plan-diagnose     (requires a signed-in athlete)
 *
 * Answers the questions that are otherwise buried in logs:
 *   - is the database reachable and are migrations 001–004 applied?
 *   - did this athlete's assessment answers actually land in the tables the model reads?
 *   - which signals are still missing (so a plan is thin)?
 *   - what would the model decide right now, and is a snapshot stored?
 *
 * Read-only: the dry-run recommendation is computed with `persist: false`.
 */
import { createFileRoute } from "@tanstack/react-router";
import type { RowDataPacket } from "mysql2/promise";
import { AuthHttpError, requireAuthenticatedUser } from "@/lib/auth.server";
import { dbQuery, isDatabaseConfigured, tableExists } from "@/lib/db.server";
import { assembleRecommendationRequest } from "@/services/recommendation/assembly.server";
import {
  getLatestRecommendationSnapshot,
  snapshotAgeHours,
} from "@/services/recommendation/snapshots.server";
import { resolvePlanForUser } from "@/services/recommendation/userPlan.server";

const REQUIRED_TABLES = [
  "users",
  "athlete_profiles",
  "assessments",
  "assessment_answers",
  "body_analysis_records",
  "training_sessions",
  "workout_logs",
  "nutrition_logs",
  "subscriptions",
  "subscription_plans",
  "recommendation_events",
  "recommendation_outcomes",
  "model_registry",
  "recommendation_snapshots",
] as const;

async function countRows(sql: string, params: unknown[]): Promise<number | null> {
  try {
    const rows = await dbQuery<RowDataPacket[]>(sql, params);
    return Number(rows[0]?.["total"] ?? 0);
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/plan-diagnose")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const headers = { "cache-control": "no-store" } as const;
        let user;
        try {
          user = await requireAuthenticatedUser(request);
        } catch (err) {
          if (err instanceof AuthHttpError) {
            return Response.json(
              { ok: false, error: err.message, code: "unauthenticated" },
              { status: err.statusCode, headers },
            );
          }
          throw err;
        }

        const tables: Record<string, boolean> = {};
        for (const table of REQUIRED_TABLES) {
          try {
            tables[table] = await tableExists(table);
          } catch {
            tables[table] = false;
          }
        }

        const assembled = await assembleRecommendationRequest(user);
        const latest = await getLatestRecommendationSnapshot(user.id);

        let dryRun: Record<string, unknown> | null = null;
        let dryRunError: string | null = null;
        try {
          const resolved = await resolvePlanForUser(user, { persist: false, force: true });
          dryRun = {
            archetypeId: resolved.recommendation.program.archetypeId,
            archetypeLabelFa: resolved.recommendation.program.labelFa,
            sessionsPerWeek: resolved.recommendation.program.sessionsPerWeek,
            sessionMinutes: resolved.recommendation.program.sessionMinutes,
            durationMonths: resolved.recommendation.duration.months,
            nutritionStrategyId: resolved.recommendation.nutrition.strategyId,
            coachingMode: resolved.recommendation.coaching.mode,
            safetyLevel: resolved.recommendation.safety.level,
            safetyFlags: resolved.recommendation.safety.flags.map((flag) => flag.code),
            confidence: resolved.recommendation.expectations.confidence,
            adherence30d: resolved.recommendation.expectations.adherence30d,
            inputHash: resolved.inputHash,
            latencyMs: resolved.diagnostics?.latencyMs ?? null,
          };
        } catch (err) {
          dryRunError = err instanceof Error ? err.message : String(err);
        }

        const [assessments, snapshots, sessions28d, nutritionDays] = await Promise.all([
          countRows(`SELECT COUNT(*) AS total FROM assessments WHERE athlete_user_id = ?`, [
            user.id,
          ]),
          countRows(`SELECT COUNT(*) AS total FROM recommendation_snapshots WHERE user_id = ?`, [
            user.id,
          ]),
          countRows(
            `SELECT COUNT(*) AS total FROM training_sessions
             WHERE athlete_user_id = ? AND scheduled_at >= (NOW() - INTERVAL 28 DAY)`,
            [user.id],
          ),
          countRows(
            `SELECT COUNT(DISTINCT DATE(logged_at)) AS total FROM nutrition_logs
             WHERE athlete_user_id = ? AND logged_at >= (NOW() - INTERVAL 28 DAY)`,
            [user.id],
          ),
        ]);

        return Response.json(
          {
            ok: true,
            database: {
              configured: isDatabaseConfigured(),
              tables,
              migrations: {
                "001_training_core": tables["training_sessions"] === true,
                "002_mysql_auth_assessment":
                  tables["users"] === true &&
                  tables["assessments"] === true &&
                  tables["assessment_answers"] === true,
                "003_recommendation_engine":
                  tables["recommendation_events"] === true && tables["model_registry"] === true,
                "004_recommendation_snapshots": tables["recommendation_snapshots"] === true,
              },
            },
            athlete: {
              userId: user.id,
              athleteId: user.athleteId,
              primarySport: user.primarySport,
              assessments,
              answersCount: Object.keys(assembled.request.assessmentAnswers ?? {}).length,
              sessions28d,
              nutritionDays28d: nutritionDays,
              bodyFatPct: assembled.request.bodyAnalysis?.bodyFatPct ?? null,
              subscription: assembled.request.constraints ?? null,
              sourcesFa: assembled.sourcesFa,
              missingFa: assembled.missingFa,
            },
            storedSnapshot: latest
              ? {
                  id: latest.id,
                  createdAt: latest.createdAt,
                  ageHours: Number(snapshotAgeHours(latest).toFixed(2)),
                  modelVersion: latest.modelVersion,
                  archetypeId: latest.recommendation.program.archetypeId,
                  durationMonths: latest.recommendation.duration.months,
                }
              : null,
            snapshotCount: snapshots,
            dryRun,
            dryRunError,
            hints: [
              tables["recommendation_snapshots"] !== true
                ? "migration 004 اعمال نشده است: database/migrations/mysql/004_recommendation_snapshots.sql"
                : null,
              tables["recommendation_events"] !== true
                ? "migration 003 اعمال نشده است (لاگ تصمیم‌ها غیرفعال است)"
                : null,
              (assessments ?? 0) === 0
                ? "برای این کاربر ارزیابی‌ای در جدول assessments نیست؛ ابتدا فرم ارزیابی را کامل کنید."
                : null,
              Object.keys(assembled.request.assessmentAnswers ?? {}).length === 0
                ? "کلیدهای پاسخ ذخیره‌شده با مدل هم‌خوان نیستند یا خالی‌اند؛ لاگ [api/assessment] را بررسی کنید."
                : null,
            ].filter((hint): hint is string => hint !== null),
          },
          { status: 200, headers },
        );
      },
    },
  },
});

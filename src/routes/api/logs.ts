/**
 * Athlete data entry: sessions, meals and daily check-ins.
 *
 *   GET  /api/logs?days=14   → what the athlete logged recently (drives the UI list)
 *   POST /api/logs           → { kind: "session" | "nutrition" | "checkin", ...payload }
 *
 * Every successful write also refreshes the outcome label of the current plan
 * (`recommendation_outcomes`), which is what makes retraining on real data possible.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AuthHttpError, requireAuthenticatedUser } from "@/lib/auth.server";
import { listRecentLogs, logCheckin, logNutrition, logSession } from "@/server/logging.repository";
import { labelOutcomesForUser } from "@/services/recommendation/outcomes.server";

const sessionSchema = z.object({
  title: z.string().trim().min(2).max(180),
  performedAt: z.string().max(40).optional(),
  minutes: z.number().min(1).max(360).optional(),
  rpe: z.number().min(0).max(10).optional(),
  completed: z.boolean().optional(),
  sessionType: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
});

const nutritionSchema = z.object({
  loggedAt: z.string().max(40).optional(),
  mealType: z.string().max(40).optional(),
  description: z.string().trim().min(2).max(255),
  calories: z.number().min(0).max(5000).optional(),
  proteinG: z.number().min(0).max(400).optional(),
  carbsG: z.number().min(0).max(800).optional(),
  fatG: z.number().min(0).max(400).optional(),
});

const checkinSchema = z.object({
  date: z.string().max(40).optional(),
  sleepHours: z.number().min(0).max(16).optional(),
  sleepQuality: z.number().min(1).max(5).optional(),
  stress: z.number().min(1).max(5).optional(),
  readiness: z.number().min(0).max(100).optional(),
  weightKg: z.number().min(25).max(350).optional(),
  restingHr: z.number().min(30).max(220).optional(),
  notes: z.string().max(500).optional(),
});

const bodySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("session"), payload: sessionSchema }),
  z.object({ kind: z.literal("nutrition"), payload: nutritionSchema }),
  z.object({ kind: z.literal("checkin"), payload: checkinSchema }),
]);

export const Route = createFileRoute("/api/logs")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireAuthenticatedUser(request);
          const daysParam = new URL(request.url).searchParams.get("days");
          const days = Math.min(120, Math.max(1, Number(daysParam ?? 14) || 14));
          const logs = await listRecentLogs(user.id, days);
          // Keep the current plan's outcome fresh even on read-only visits (cheap: exits early
          // when the newest snapshot has already been labelled).
          void labelOutcomesForUser(user).catch(() => {});
          return Response.json(
            { ok: true, days, ...logs },
            { headers: { "cache-control": "no-store" } },
          );
        } catch (err) {
          if (err instanceof AuthHttpError) {
            return Response.json(
              { ok: false, error: err.message },
              { status: err.statusCode, headers: { "cache-control": "no-store" } },
            );
          }
          console.error("[api/logs GET]", err instanceof Error ? err.message : err);
          return Response.json(
            { ok: false, error: "خطا در خواندن داده‌های ثبت‌شده." },
            { status: 500, headers: { "cache-control": "no-store" } },
          );
        }
      },

      POST: async ({ request }) => {
        try {
          const user = await requireAuthenticatedUser(request);
          const raw = (await request.json().catch(() => ({}))) as unknown;
          const parsed = bodySchema.safeParse(raw);
          if (!parsed.success) {
            return Response.json(
              {
                ok: false,
                error: "داده ارسالی کامل یا معتبر نیست.",
                issues: parsed.error.issues.map((issue) => issue.path.join(".")),
              },
              { status: 400, headers: { "cache-control": "no-store" } },
            );
          }

          const body = parsed.data;
          const result =
            body.kind === "session"
              ? await logSession(user, body.payload)
              : body.kind === "nutrition"
                ? await logNutrition(user, body.payload)
                : await logCheckin(user, body.payload);

          if (!result) {
            return Response.json(
              {
                ok: false,
                error: "ذخیره نشد. جدول مربوطه در دیتابیس موجود نیست یا اتصال دیتابیس برقرار نیست.",
              },
              { status: 503, headers: { "cache-control": "no-store" } },
            );
          }

          // Best-effort: keep the newest plan's outcome label in sync with what was just logged.
          const outcome = await labelOutcomesForUser(user).catch(() => null);

          return Response.json(
            { ok: true, kind: body.kind, id: result.id, outcome },
            { status: 201, headers: { "cache-control": "no-store" } },
          );
        } catch (err) {
          if (err instanceof AuthHttpError) {
            return Response.json(
              { ok: false, error: err.message },
              { status: err.statusCode, headers: { "cache-control": "no-store" } },
            );
          }
          console.error("[api/logs POST]", err instanceof Error ? err.message : err);
          return Response.json(
            { ok: false, error: "خطا در ذخیرهٔ داده." },
            { status: 500, headers: { "cache-control": "no-store" } },
          );
        }
      },
    },
  },
});

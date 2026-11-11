/**
 * Athlete-facing plan endpoint.
 *
 *   GET  /api/plan   → the plan for the signed-in athlete (stored snapshot when it is
 *                      still valid, otherwise compute + persist)
 *   POST /api/plan   → recompute now, optionally overriding the cycle length / package /
 *                      coaching mode (e.g. the athlete picked a different subscription)
 *
 * Unlike `POST /api/recommend` (stateless, accepts arbitrary input, used by the demo page
 * and by external clients), this route never trusts client-supplied assessment data:
 * everything comes from the authenticated athlete's stored records.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AuthHttpError, requireAuthenticatedUser } from "@/lib/auth.server";
import {
  buildPlanSummary,
  buildProgramFromRecommendation,
} from "@/services/recommendation/presentation";
import { resolvePlanForUser } from "@/services/recommendation/userPlan.server";

const constraintsSchema = z
  .object({
    durationMonths: z
      .union([z.literal(1), z.literal(3), z.literal(6), z.literal(12), z.literal("auto")])
      .optional(),
    packageId: z.enum(["training", "nutrition", "combined"]).optional(),
    coachingPreference: z.enum(["ai", "hybrid", "human", "auto"]).optional(),
    maxSessionsPerWeek: z.number().int().min(1).max(7).optional(),
  })
  .optional();

const bodySchema = z
  .object({
    regenerate: z.boolean().optional(),
    constraints: constraintsSchema,
  })
  .optional();

function authErrorResponse(err: AuthHttpError): Response {
  return Response.json(
    { ok: false, error: err.message, code: "unauthenticated" },
    { status: err.statusCode, headers: { "cache-control": "no-store" } },
  );
}

function failureResponse(error: unknown, scope: string): Response {
  console.error(`[api/plan ${scope}]`, error instanceof Error ? error.message : error);
  return Response.json(
    { ok: false, error: "تولید یا بازیابی برنامه با خطا مواجه شد. لطفاً دوباره تلاش کنید." },
    { status: 500, headers: { "cache-control": "no-store" } },
  );
}

async function respondWithPlan(
  request: Request,
  options: { force: boolean; constraints?: z.infer<typeof constraintsSchema> },
): Promise<Response> {
  const user = await requireAuthenticatedUser(request);
  const resolved = await resolvePlanForUser(user, {
    force: options.force,
    ...(options.constraints ? { constraints: options.constraints } : {}),
    ...(options.force ? { source: "manual" as const } : {}),
  });

  const program = buildProgramFromRecommendation({
    recommendation: resolved.recommendation,
    athleteId: user.athleteId,
  });

  return Response.json(
    {
      ok: true,
      authenticated: true,
      plan: buildPlanSummary(resolved.recommendation),
      program: program.program,
      workout: program.workout,
      meta: {
        fromSnapshot: resolved.fromSnapshot,
        persisted: resolved.persisted,
        snapshotId: resolved.snapshotId,
        generatedAt: resolved.generatedAt,
        inputHash: resolved.inputHash,
        diagnostics: resolved.diagnostics,
        sourcesFa: resolved.sourcesFa,
        missingFa: resolved.missingFa,
      },
    },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}

export const Route = createFileRoute("/api/plan")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          return await respondWithPlan(request, { force: false });
        } catch (err) {
          if (err instanceof AuthHttpError) return authErrorResponse(err);
          return failureResponse(err, "GET");
        }
      },

      POST: async ({ request }) => {
        try {
          const raw = await request.json().catch(() => ({}));
          const parsed = bodySchema.safeParse(raw);
          if (!parsed.success) {
            return Response.json(
              {
                ok: false,
                error: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است.",
              },
              { status: 400, headers: { "cache-control": "no-store" } },
            );
          }
          const body = parsed.data ?? {};
          return await respondWithPlan(request, {
            force: body.regenerate !== false,
            ...(body.constraints ? { constraints: body.constraints } : {}),
          });
        } catch (err) {
          if (err instanceof AuthHttpError) return authErrorResponse(err);
          return failureResponse(err, "POST");
        }
      },
    },
  },
});

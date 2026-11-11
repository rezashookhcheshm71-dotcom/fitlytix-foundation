import { createFileRoute } from "@tanstack/react-router";
import { getSessionUser } from "@/lib/auth.server";
import type { RecommendationRequest } from "@/domain/recommendation";
import { recommendPlan } from "@/services/recommendation/engine";
import { getModel, getModelInfo, getModelMetrics } from "@/services/recommendation/model.server";
import { recommendationRequestSchema } from "@/services/recommendation/requestSchema";
import { recordRecommendationEvent } from "@/services/recommendation/store.server";

/**
 * POST /api/recommend
 *
 * Server-side inference of the self-hosted model. Auth is optional: a signed-in
 * athlete is bound to the session identity, a guest can still preview a plan.
 * The response always states `model.source` (model vs fallback) and confidence.
 */
export const Route = createFileRoute("/api/recommend")({
  server: {
    handlers: {
      GET: async () => {
        const info = getModelInfo();
        const metrics = getModelMetrics();
        return Response.json(
          {
            ok: true,
            model: {
              ...info,
              programAccuracy: Object.fromEntries(
                Object.entries(metrics.program).map(([sport, m]) => [
                  sport,
                  {
                    accuracy: m.accuracy,
                    top2Accuracy: m.top2Accuracy,
                    majorityBaseline: m.baselineMajority,
                  },
                ]),
              ),
              nutritionAccuracy: metrics.nutrition.accuracy,
              durationAccuracy: metrics.duration.top2Accuracy,
              adherenceMae: metrics.adherence.mae,
            },
            contract: {
              method: "POST",
              requiredFields: ["sport"],
              durations: getModel().durationMonths,
              sports: getModel().sports,
            },
          },
          { status: 200, headers: { "cache-control": "no-store" } },
        );
      },

      POST: async ({ request }) => {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return Response.json(
            { ok: false, error: "بدنه درخواست JSON معتبر نیست." },
            { status: 400, headers: { "cache-control": "no-store" } },
          );
        }

        const parsed = recommendationRequestSchema.safeParse(raw);
        if (!parsed.success) {
          const firstIssue = parsed.error.issues[0];
          return Response.json(
            {
              ok: false,
              error: firstIssue
                ? `${firstIssue.path.join(".") || "body"}: ${firstIssue.message}`
                : "ورودی نامعتبر است.",
              issues: parsed.error.issues.map((i) => ({
                path: i.path.join("."),
                message: i.message,
              })),
            },
            { status: 400, headers: { "cache-control": "no-store" } },
          );
        }

        const user = await getSessionUser(request).catch(() => null);
        const body = parsed.data as RecommendationRequest;
        const effectiveRequest: RecommendationRequest = {
          ...body,
          ...(user?.athleteId ? { athleteId: user.athleteId } : {}),
        };

        try {
          const result = recommendPlan(effectiveRequest, getModel());

          // Fire-and-forget: logging must never delay or fail the response.
          void recordRecommendationEvent({
            athleteId: user?.athleteId,
            request: effectiveRequest,
            recommendation: result.recommendation,
            diagnostics: result.diagnostics,
          });

          return Response.json(
            { ok: true, ...result, authenticated: Boolean(user) },
            { status: 200, headers: { "cache-control": "no-store" } },
          );
        } catch (error) {
          console.error(
            "[api/recommend] inference failed:",
            error instanceof Error ? error.message : error,
          );
          return Response.json(
            { ok: false, error: "تولید پیشنهاد با خطا مواجه شد. لطفاً دوباره تلاش کنید." },
            { status: 500, headers: { "cache-control": "no-store" } },
          );
        }
      },
    },
  },
});

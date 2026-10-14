import { createFileRoute } from "@tanstack/react-router";
import type { BodyAnalysisInput } from "@/domain/body-analysis";
import type {
  AssessmentAnswers,
  ExperienceLevel,
  HealthProvider,
  SportId,
  WearableIntent,
} from "@/domain/types";
import { AuthHttpError, requireAuthenticatedUser } from "@/lib/auth.server";
import { athleteRepository } from "@/server/athlete.repository";

export const Route = createFileRoute("/api/assessment")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireAuthenticatedUser(request);
          const state = await athleteRepository.getAthleteAssessmentState(user);
          return Response.json(
            { ok: true, ...state },
            { status: 200, headers: { "cache-control": "no-store" } },
          );
        } catch (err) {
          if (err instanceof AuthHttpError) {
            return Response.json(
              { ok: false, error: err.message },
              { status: err.statusCode, headers: { "cache-control": "no-store" } },
            );
          }
          console.error("[api/assessment GET] Unexpected error:", err instanceof Error ? err.message : err);
          return Response.json(
            { ok: false, error: "خطا در بارگذاری اطلاعات ارزیابی از سرور." },
            { status: 500, headers: { "cache-control": "no-store" } },
          );
        }
      },

      POST: async ({ request }) => {
        try {
          // 1 & 2. Require authenticated user and derive athlete identity strictly from server session
          const user = await requireAuthenticatedUser(request);

          const body = (await request.json().catch(() => ({}))) as {
            templateId?: unknown;
            sport?: unknown;
            experienceLevel?: unknown;
            answers?: unknown;
            bodyAnalysis?: unknown;
            wearable?: unknown;
          };

          const templateId = typeof body.templateId === "string" ? body.templateId.trim() : "";
          if (!templateId) {
            return Response.json(
              { ok: false, error: "شناسه قالب ارزیابی ارسال نشده است." },
              { status: 400, headers: { "cache-control": "no-store" } },
            );
          }

          const answers =
            body.answers && typeof body.answers === "object" && !Array.isArray(body.answers)
              ? (body.answers as AssessmentAnswers)
              : {};

          const sport = typeof body.sport === "string" ? (body.sport as SportId) : undefined;
          const experienceLevel =
            typeof body.experienceLevel === "string" ? (body.experienceLevel as ExperienceLevel) : undefined;

          const bodyAnalysis =
            body.bodyAnalysis && typeof body.bodyAnalysis === "object" && !Array.isArray(body.bodyAnalysis)
              ? (body.bodyAnalysis as Partial<BodyAnalysisInput>)
              : undefined;

          const wearableRaw =
            body.wearable && typeof body.wearable === "object" && !Array.isArray(body.wearable)
              ? (body.wearable as { intent?: unknown; providers?: unknown })
              : undefined;

          const wearable = wearableRaw
            ? {
                intent:
                  wearableRaw.intent === "yes" ||
                  wearableRaw.intent === "no" ||
                  wearableRaw.intent === "manual"
                    ? (wearableRaw.intent as WearableIntent)
                    : undefined,
                providers: Array.isArray(wearableRaw.providers)
                  ? (wearableRaw.providers.filter((p) => typeof p === "string") as HealthProvider[])
                  : undefined,
              }
            : undefined;

          const saved = await athleteRepository.saveAssessment({
            user,
            templateId,
            sport,
            experienceLevel,
            answers,
            bodyAnalysis,
            wearable,
          });

          return Response.json(
            { ok: true, assessment: saved },
            { status: 200, headers: { "cache-control": "no-store" } },
          );
        } catch (err) {
          if (err instanceof AuthHttpError) {
            return Response.json(
              { ok: false, error: err.message },
              { status: err.statusCode, headers: { "cache-control": "no-store" } },
            );
          }
          console.error("[api/assessment POST] Unexpected error:", err instanceof Error ? err.message : err);
          return Response.json(
            { ok: false, error: "ذخیره ارزیابی در پایگاه داده با خطا مواجه شد. لطفاً دوباره تلاش کنید." },
            { status: 500, headers: { "cache-control": "no-store" } },
          );
        }
      },
    },
  },
});

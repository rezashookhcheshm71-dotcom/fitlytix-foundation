/**
 * Coach analytics endpoint.
 *
 *   GET /api/coach-insights?limit=200
 *
 * Returns the same payload for both coach screens (data quality per athlete + archetype
 * performance). Restricted to coach/head_coach/admin roles.
 */
import { createFileRoute } from "@tanstack/react-router";
import { AuthHttpError, requireRole } from "@/lib/auth.server";
import { getCoachInsights } from "@/server/insights.server";

export const Route = createFileRoute("/api/coach-insights")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireRole(request, ["coach", "head_coach", "admin"]);
          const limitParam = Number(new URL(request.url).searchParams.get("limit") ?? 200);
          const insights = await getCoachInsights({
            limit: Number.isFinite(limitParam) ? limitParam : 200,
          });
          return Response.json(
            { ok: true, ...insights },
            { headers: { "cache-control": "no-store" } },
          );
        } catch (err) {
          if (err instanceof AuthHttpError) {
            return Response.json(
              { ok: false, error: err.message },
              { status: err.statusCode, headers: { "cache-control": "no-store" } },
            );
          }
          const message = err instanceof Error ? err.message : String(err);
          console.error("[api/coach-insights]", message);
          return Response.json(
            { ok: false, error: message },
            { status: 500, headers: { "cache-control": "no-store" } },
          );
        }
      },
    },
  },
});

/**
 * GET /api/coach/attention — the athletes who need a message today, from recorded behaviour.
 *
 * Coach/head_coach/admin only. The items are the athlete's own nudges, so coach and athlete
 * always agree on the facts.
 */
import { createFileRoute } from "@tanstack/react-router";
import { AuthHttpError, requireRole } from "@/lib/auth.server";
import { getCoachAttention } from "@/server/attention.server";

export const Route = createFileRoute("/api/coach/attention")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireRole(request, ["coach", "head_coach", "admin"]);
          const limitParam = Number(new URL(request.url).searchParams.get("limit") ?? 200);
          const attention = await getCoachAttention({
            limit: Number.isFinite(limitParam) ? limitParam : 200,
          });
          return Response.json(
            { ok: true, ...attention },
            { headers: { "cache-control": "no-store" } },
          );
        } catch (err) {
          if (err instanceof AuthHttpError) {
            return Response.json(
              { ok: false, error: err.message },
              { status: err.statusCode, headers: { "cache-control": "no-store" } },
            );
          }
          console.error("[api/coach/attention]", err instanceof Error ? err.message : err);
          return Response.json(
            { ok: false, error: "خواندن فهرست توجه ناموفق بود." },
            { status: 500, headers: { "cache-control": "no-store" } },
          );
        }
      },
    },
  },
});

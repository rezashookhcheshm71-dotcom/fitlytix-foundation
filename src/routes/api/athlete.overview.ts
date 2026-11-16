/**
 * GET /api/athlete/overview — the recorded facts behind the athlete dashboard.
 *
 * Counts, the newest check-in, a readiness history and the athlete's nudges, in one call.
 * Signed-in athletes only; the payload never contains another athlete's rows.
 */
import { createFileRoute } from "@tanstack/react-router";
import { AuthHttpError, requireAuthenticatedUser } from "@/lib/auth.server";
import { getAthleteOverview } from "@/server/overview.server";

export const Route = createFileRoute("/api/athlete/overview")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireAuthenticatedUser(request);
          const overview = await getAthleteOverview(user.id);
          return Response.json(
            { ok: true, ...overview },
            { headers: { "cache-control": "no-store" } },
          );
        } catch (err) {
          if (err instanceof AuthHttpError) {
            return Response.json(
              { ok: false, error: err.message },
              { status: err.statusCode, headers: { "cache-control": "no-store" } },
            );
          }
          console.error("[api/athlete/overview]", err instanceof Error ? err.message : err);
          return Response.json(
            { ok: false, error: "خواندن داده‌های ثبت‌شده ناموفق بود." },
            { status: 500, headers: { "cache-control": "no-store" } },
          );
        }
      },
    },
  },
});

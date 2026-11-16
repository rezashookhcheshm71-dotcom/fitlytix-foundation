import { createFileRoute } from "@tanstack/react-router";
import { AuthHttpError, requireAuthenticatedUser } from "@/lib/auth.server";
import { getAthleteNudges } from "@/server/nudges.server";

/**
 * GET /api/nudges — «همین حالا چه کاری بیشترین اثر را دارد؟»
 *
 * Only the signed-in athlete's own facts are read; nothing is shared across accounts.
 */
export const Route = createFileRoute("/api/nudges")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireAuthenticatedUser(request);
          const nudges = await getAthleteNudges(user.id);
          return Response.json({ ok: true, nudges }, { headers: { "cache-control": "no-store" } });
        } catch (err) {
          if (err instanceof AuthHttpError) {
            return Response.json(
              { ok: false, error: err.message, nudges: [] },
              { status: err.statusCode, headers: { "cache-control": "no-store" } },
            );
          }
          console.error("[api/nudges]", err instanceof Error ? err.message : err);
          return Response.json(
            { ok: false, error: "خطا در خواندن پیشنهادهای روزانه.", nudges: [] },
            { status: 500, headers: { "cache-control": "no-store" } },
          );
        }
      },
    },
  },
});

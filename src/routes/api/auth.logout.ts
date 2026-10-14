import { createFileRoute } from "@tanstack/react-router";
import { buildClearSessionCookie, destroySession } from "@/lib/auth.server";

export const Route = createFileRoute("/api/auth/logout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await destroySession(request);
        } catch (err) {
          console.error("[api/auth/logout] Session cleanup error:", err instanceof Error ? err.message : err);
        }
        return Response.json(
          { ok: true },
          {
            status: 200,
            headers: {
              "set-cookie": buildClearSessionCookie(request),
              "cache-control": "no-store",
            },
          },
        );
      },
    },
  },
});

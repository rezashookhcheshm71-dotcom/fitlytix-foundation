import { createFileRoute } from "@tanstack/react-router";
import { getSessionUser } from "@/lib/auth.server";

export const Route = createFileRoute("/api/auth/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await getSessionUser(request);
          if (!user) {
            return Response.json(
              { ok: false, authenticated: false, user: null },
              { status: 401, headers: { "cache-control": "no-store" } },
            );
          }
          return Response.json(
            { ok: true, authenticated: true, user },
            { status: 200, headers: { "cache-control": "no-store" } },
          );
        } catch (err) {
          console.error("[api/auth/me] Error:", err instanceof Error ? err.message : err);
          return Response.json(
            { ok: false, authenticated: false, user: null },
            { status: 401, headers: { "cache-control": "no-store" } },
          );
        }
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { AuthHttpError, buildSessionCookie, createServerSession } from "@/lib/auth.server";
import { athleteRepository } from "@/server/athlete.repository";

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          const email = String(body["email"] ?? "").trim();
          const password = String(body["password"] ?? "");

          const user = await athleteRepository.authenticateByEmail({ email, password });
          const sessionToken = await createServerSession(user.id, request);
          const cookieHeader = buildSessionCookie(sessionToken, request);

          return Response.json(
            { ok: true, user },
            {
              status: 200,
              headers: {
                "set-cookie": cookieHeader,
                "cache-control": "no-store",
              },
            },
          );
        } catch (err) {
          if (err instanceof AuthHttpError) {
            return Response.json(
              { ok: false, error: err.message },
              { status: err.statusCode, headers: { "cache-control": "no-store" } },
            );
          }
          console.error("[api/auth/login] Unexpected error:", err instanceof Error ? err.message : err);
          return Response.json(
            { ok: false, error: "خطا در ورود به حساب کاربری. لطفاً دوباره تلاش کنید." },
            { status: 500, headers: { "cache-control": "no-store" } },
          );
        }
      },
    },
  },
});

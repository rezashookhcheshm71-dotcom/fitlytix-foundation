import { createFileRoute } from "@tanstack/react-router";
import { AuthHttpError, buildSessionCookie, createServerSession } from "@/lib/auth.server";
import { athleteRepository } from "@/server/athlete.repository";

export const Route = createFileRoute("/api/auth/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          const firstName = String(body["firstName"] ?? "").trim();
          const lastName = String(body["lastName"] ?? "").trim();
          const phone = String(body["phone"] ?? "").trim();
          const email = String(body["email"] ?? "").trim();
          const password = String(body["password"] ?? "");

          const user = await athleteRepository.registerAthlete({
            firstName,
            lastName,
            phone,
            email,
            password,
          });

          const sessionToken = await createServerSession(user.id, request);
          const cookieHeader = buildSessionCookie(sessionToken, request);

          return Response.json(
            { ok: true, user },
            {
              status: 201,
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
          const detail = err instanceof Error ? err.message : String(err);
          const mysqlError = err as { code?: string; errno?: number; sqlMessage?: string };
          console.error(
            "[api/auth/register] Unexpected error:",
            detail,
            mysqlError.code ? `code=${mysqlError.code}` : "",
            mysqlError.errno ? `errno=${mysqlError.errno}` : "",
          );
          // The generic message is deliberately vague for users; set FITLYTIX_DEBUG=1 on the
          // server to also return the underlying SQL error while debugging a deployment.
          const debug = process.env["FITLYTIX_DEBUG"] === "1";
          return Response.json(
            {
              ok: false,
              error: "خطا در ثبت‌نام و ایجاد حساب کاربری. لطفاً دوباره تلاش کنید.",
              ...(debug ? { detail, code: mysqlError.code ?? null } : {}),
            },
            { status: 500, headers: { "cache-control": "no-store" } },
          );
        }
      },
    },
  },
});

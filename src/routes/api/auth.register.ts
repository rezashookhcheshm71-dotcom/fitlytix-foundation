import { createFileRoute } from "@tanstack/react-router";
import { AuthHttpError, buildSessionCookie, createServerSession } from "@/lib/auth.server";
import { isRegisterableRole } from "@/domain/roles";
import { athleteRepository, isValidSportSlug } from "@/server/athlete.repository";

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

          // P39: role and sport arrive from a public endpoint, so both are
          // validated here as well as in the repository. A role that is present
          // but not registerable is rejected with 400 rather than downgraded,
          // because silently rewriting it would hide an escalation attempt.
          const roleRaw = body["role"];
          if (roleRaw !== undefined && !isRegisterableRole(roleRaw)) {
            return Response.json(
              {
                ok: false,
                error:
                  "نقشِ انتخاب‌شده برایِ ثبت‌نام معتبر نیست. تنها «ورزشکار» و «مربی» قابلِ ثبت‌اند.",
              },
              { status: 400, headers: { "cache-control": "no-store" } },
            );
          }
          // An unchosen or unrecognised sport becomes null, never a default: this
          // is the API half of F2.
          const primarySport = isValidSportSlug(body["primarySport"]) ? body["primarySport"] : null;

          const user = await athleteRepository.registerAthlete({
            firstName,
            lastName,
            phone,
            email,
            password,
            ...(isRegisterableRole(roleRaw) ? { role: roleRaw } : {}),
            primarySport,
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
          console.error(
            "[api/auth/register] Unexpected error:",
            err instanceof Error ? err.message : err,
          );
          return Response.json(
            { ok: false, error: "خطا در ثبت‌نام و ایجاد حساب کاربری. لطفاً دوباره تلاش کنید." },
            { status: 500, headers: { "cache-control": "no-store" } },
          );
        }
      },
    },
  },
});

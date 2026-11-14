import { createFileRoute } from "@tanstack/react-router";
import { isDatabaseConfigured, testDatabaseConnection } from "@/lib/db.server";

/**
 * Deployment health probe for the MySQL connection.
 *
 * Returns *why* the connection failed (mysql2 error code / errno and which env keys are
 * present) without ever echoing a host, user or password. This is the difference between
 * "اتصال برقرار نشد" and "کاربر MySQL رمز را رد کرد" during a cPanel deployment.
 */
const HINTS: Record<string, string> = {
  DB_NOT_CONFIGURED:
    "متغیرهای DB_* به اپ نرسیده‌اند. SetEnv در .htaccess یا Environment variables در cPanel را بررسی کنید و Restart بزنید.",
  ECONNREFUSED:
    "اتصال TCP رد شد. DB_HOST را localhost (سوکت) امتحان کنید یا مطمئن شوید پورت 3306 روی 127.0.0.1 باز است.",
  ENOTFOUND: "هاست دیتابیس پیدا نشد؛ مقدار DB_HOST را بررسی کنید.",
  ETIMEDOUT: "اتصال به دیتابیس timeout شد؛ فایروال هاست یا DB_HOST را بررسی کنید.",
  ER_ACCESS_DENIED_ERROR: "کاربر یا رمز MySQL غلط است (DB_USER / DB_PASSWORD).",
  ER_DBACCESS_DENIED_ERROR:
    "کاربر MySQL به این دیتابیس دسترسی ندارد؛ در cPanel دسترسی را اضافه کنید.",
  ER_BAD_DB_ERROR: "دیتابیس با این نام وجود ندارد (DB_NAME).",
  ER_NOT_SUPPORTED_AUTH_MODE: "روش احراز هویت MySQL پشتیبانی نمی‌شود.",
  PROTOCOL_CONNECTION_LOST: "اتصال MySQL قطع شد؛ معمولاً محدودیت همزمانی هاست.",
  ER_CON_COUNT_ERROR:
    "سقف اتصال‌های همزمان MySQL پر شده است. نمونه‌های اضافی Node را ببندید و DB_POOL_SIZE (پیش‌فرض ۳) را کم نگه دارید.",
  ER_TOO_MANY_USER_CONNECTIONS:
    "این کاربر MySQL به سقف اتصال مجاز رسیده است؛ اتصال‌های باز را ببندید یا DB_POOL_SIZE را کاهش دهید.",
};

export const Route = createFileRoute("/api/db-test")({
  server: {
    handlers: {
      GET: async () => {
        // Booleans only — never values. The *_PADDED flags catch the classic cPanel typo
        // `SetEnv DB_USER  someone` (double space), which MySQL reports as
        // `Access denied for user ' someone'@'localhost'`.
        const padded = (...names: string[]) =>
          names.some((name) => {
            const raw = process.env[name];
            return raw !== undefined && raw !== raw.trim();
          });
        const env = {
          DB_HOST: Boolean(process.env["DB_HOST"] ?? process.env["MYSQL_HOST"]),
          DB_PORT: Boolean(process.env["DB_PORT"] ?? process.env["MYSQL_PORT"]),
          DB_NAME: Boolean(process.env["DB_NAME"] ?? process.env["MYSQL_DATABASE"]),
          DB_USER: Boolean(process.env["DB_USER"] ?? process.env["MYSQL_USER"]),
          DB_PASSWORD: Boolean(process.env["DB_PASSWORD"] ?? process.env["MYSQL_PASSWORD"]),
          DB_SOCKET: Boolean(process.env["DB_SOCKET"] ?? process.env["MYSQL_SOCKET"]),
          SESSION_SECRET: Boolean(process.env["SESSION_SECRET"]),
          NODE_ENV: process.env["NODE_ENV"] ?? null,
          padded: {
            DB_HOST: padded("DB_HOST", "MYSQL_HOST"),
            DB_NAME: padded("DB_NAME", "MYSQL_DATABASE"),
            DB_USER: padded("DB_USER", "MYSQL_USER"),
            DB_PASSWORD: padded("DB_PASSWORD", "MYSQL_PASSWORD"),
          },
        };

        try {
          const info = await testDatabaseConnection();
          return Response.json(
            { ok: true, rows: [info], env },
            { headers: { "cache-control": "no-store" } },
          );
        } catch (err) {
          const error = err as {
            code?: string;
            errno?: number;
            syscall?: string;
            message?: string;
          };
          const code = error.code ?? (isDatabaseConfigured() ? "UNKNOWN" : "DB_NOT_CONFIGURED");
          console.error(
            `[api/db-test] Database connectivity check failed (${code}):`,
            error.message ?? String(err),
          );
          return Response.json(
            {
              ok: false,
              code,
              errno: error.errno ?? null,
              syscall: error.syscall ?? null,
              hint: HINTS[code] ?? "لاگ سرور را ببینید: [api/db-test].",
              env,
            },
            { status: 503, headers: { "cache-control": "no-store" } },
          );
        }
      },
    },
  },
});

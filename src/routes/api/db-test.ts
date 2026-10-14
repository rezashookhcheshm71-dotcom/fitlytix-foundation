import { createFileRoute } from "@tanstack/react-router";
import { testDatabaseConnection } from "@/lib/db.server";

export const Route = createFileRoute("/api/db-test")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const info = await testDatabaseConnection();
          return Response.json(
            { ok: true, rows: [info] },
            { headers: { "cache-control": "no-store" } },
          );
        } catch (err) {
          console.error("[api/db-test] Database connectivity check failed:", err instanceof Error ? err.message : err);
          return Response.json(
            { ok: false, error: "اتصال به پایگاه داده برقرار نشد." },
            { status: 503, headers: { "cache-control": "no-store" } },
          );
        }
      },
    },
  },
});

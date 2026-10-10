import { createFileRoute } from "@tanstack/react-router";

// Liveness probe for self-hosted deployments. Returns no secrets or user data.
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: () =>
        Response.json(
          { ok: true, service: "fitlytix", environment: process.env["NODE_ENV"] ?? "development" },
          { headers: { "cache-control": "no-store" } },
        ),
    },
  },
});

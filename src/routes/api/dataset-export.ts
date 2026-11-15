/**
 * Training-data export — the bridge from production rows to `ml/train.py`.
 *
 *   GET /api/dataset-export?limit=5000        (header: x-dataset-token: …)
 *
 * Returns newline-delimited JSON: one object per stored plan, with the exact feature vector
 * the runtime used, the action the model chose, and — when the plan has been labelled — what
 * actually happened (adherence, RPE, meals logged). `scripts/export-dataset.mjs` consumes it
 * and writes `data/datasets/*.jsonl` plus a quality report.
 *
 * Guarded by DATASET_EXPORT_TOKEN: this is aggregated athlete data and must never be public.
 */
import { createFileRoute } from "@tanstack/react-router";
import type { RowDataPacket } from "mysql2/promise";
import { dbQuery, isDatabaseConfigured, tableExists } from "@/lib/db.server";
import { getModel } from "@/services/recommendation/model.server";
import { extractFeatures, toVector } from "@/services/recommendation/features";
import type { RecommendationRequest } from "@/domain/recommendation";

function safeParse<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "object") return value as T;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
}

export const Route = createFileRoute("/api/dataset-export")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const expected = process.env["DATASET_EXPORT_TOKEN"];
        const provided =
          request.headers.get("x-dataset-token") ??
          new URL(request.url).searchParams.get("token") ??
          "";
        if (!expected || provided !== expected) {
          return Response.json(
            {
              ok: false,
              error:
                "دسترسی ندارید. متغیر DATASET_EXPORT_TOKEN را روی سرور تنظیم کنید و همان را در هدر x-dataset-token بفرستید.",
            },
            { status: 403, headers: { "cache-control": "no-store" } },
          );
        }

        if (!isDatabaseConfigured()) {
          return Response.json({ ok: false, error: "DB_NOT_CONFIGURED" }, { status: 503 });
        }
        if (!(await tableExists("recommendation_snapshots"))) {
          return Response.json(
            { ok: false, error: "جدول recommendation_snapshots وجود ندارد (مهاجرت ۰۰۴)." },
            { status: 503, headers: { "cache-control": "no-store" } },
          );
        }

        const limitRaw = Number(new URL(request.url).searchParams.get("limit") ?? 5000);
        const limit = Math.min(50_000, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 5000));

        const hasOutcomes = await tableExists("recommendation_outcomes");
        const rows = await dbQuery<RowDataPacket[]>(
          `SELECT s.id, s.user_id, s.sport, s.model_version, s.archetype_id,
                  s.nutrition_strategy_id, s.duration_months, s.coaching_mode,
                  s.safety_level, s.confidence, s.request_json, s.result_json, s.created_at,
                  ${hasOutcomes ? "o.adherence, o.sessions_completed, o.window_days, o.nutrition_adherence, o.avg_rpe, o.completed_cycle, o.progress_score" : "NULL AS adherence, NULL AS sessions_completed, NULL AS window_days, NULL AS nutrition_adherence, NULL AS avg_rpe, NULL AS completed_cycle, NULL AS progress_score"}
           FROM recommendation_snapshots s
           ${hasOutcomes ? "LEFT JOIN recommendation_outcomes o ON o.snapshot_id = s.id" : ""}
           ORDER BY s.created_at DESC
           LIMIT ?`,
          [limit],
        );

        const model = getModel();
        const lines: string[] = [];
        let labelled = 0;
        let withBehaviour = 0;

        for (const row of rows) {
          const request = safeParse<RecommendationRequest | null>(row["request_json"], null);
          if (!request) continue;

          const features = extractFeatures(
            {
              sport: (request.sport ?? String(row["sport"])) as RecommendationRequest["sport"],
              profile: request.profile,
              answers: request.assessmentAnswers,
              bodyAnalysis: request.bodyAnalysis,
              behavior: request.behavior,
            },
            model.fillValues,
          );

          const adherenceRaw = row["adherence"];
          const hasLabel = adherenceRaw !== null && adherenceRaw !== undefined;
          if (hasLabel) labelled += 1;
          if (request.behavior?.completedSessions !== undefined) withBehaviour += 1;

          lines.push(
            JSON.stringify({
              snapshotId: String(row["id"]),
              createdAt: String(row["created_at"] ?? ""),
              modelVersion: String(row["model_version"] ?? ""),
              sport: String(row["sport"] ?? ""),
              features: features.named,
              vector: toVector(features.named, model.features),
              usedSignals: features.used,
              missingSignals: features.missing,
              action: {
                archetypeId: String(row["archetype_id"] ?? ""),
                nutritionStrategyId: String(row["nutrition_strategy_id"] ?? ""),
                durationMonths: Number(row["duration_months"] ?? 0),
                coachingMode: String(row["coaching_mode"] ?? ""),
              },
              outcome: hasLabel
                ? {
                    adherence: Number(adherenceRaw),
                    sessionsCompleted:
                      row["sessions_completed"] === null ? null : Number(row["sessions_completed"]),
                    windowDays: row["window_days"] === null ? null : Number(row["window_days"]),
                    nutritionAdherence:
                      row["nutrition_adherence"] === null
                        ? null
                        : Number(row["nutrition_adherence"]),
                    avgRpe: row["avg_rpe"] === null ? null : Number(row["avg_rpe"]),
                    completedCycle: Number(row["completed_cycle"] ?? 0) === 1,
                    progressScore:
                      row["progress_score"] === null ? null : Number(row["progress_score"]),
                  }
                : null,
            }),
          );
        }

        console.log(
          `[api/dataset-export] rows=${lines.length} labelled=${labelled} withBehaviour=${withBehaviour}`,
        );

        return new Response(lines.join("\n"), {
          status: 200,
          headers: {
            "content-type": "application/x-ndjson; charset=utf-8",
            "cache-control": "no-store",
            "x-dataset-rows": String(lines.length),
            "x-dataset-labelled": String(labelled),
            "x-dataset-behaviour": String(withBehaviour),
          },
        });
      },
    },
  },
});

# FitLytix MySQL migrations

These migrations target the current cPanel MySQL/MariaDB schema (UUIDs stored as `CHAR(36)`, existing `users` and `sports` tables). They are not Supabase/PostgreSQL migrations.

## Safety rules

- Take a full database backup before applying anything.
- Never run destructive statements against production without explicit approval.
- Migration 001 is additive: it creates new tables only. It does not delete or rewrite existing rows.
- Apply against a staging copy first if one is available.
- Do not insert demo athlete IDs into live user tables. Use `data_origin='demo'` for explicitly isolated demo records.
- Never store raw card details, passwords, or unencrypted wearable OAuth tokens in these tables.

## Apply migration 001 on cPanel

1. In cPanel, open **phpMyAdmin** and select the FitLytix database.
2. Use **Export → Quick → SQL** to download a backup first.
3. Open the **Import** tab and import `001_fitlytix_product_domains.sql`.
4. Verify that these new tables exist:
   - `schema_migrations`
   - `training_programs`, `training_sessions`, `workout_items`, `workout_logs`, `workout_feedback`
   - `nutrition_plans`, `nutrition_logs`
   - `ai_coaching_runs`
   - `subscription_plans`, `subscriptions`, `payment_transactions`, `payment_webhook_events`
   - `wearable_connections`, `wearable_sync_logs`
   - `audit_logs`
5. Confirm `schema_migrations` contains version `001_fitlytix_product_domains`.
6. Optionally import `002_fitlytix_core_auth_assessments.sql` to ensure `user_sessions`, `athlete_profiles`, `assessments`, `assessment_answers`, `body_analysis_records`, `health_metrics`, and the 5 canonical `sports` rows (`crossfit`, `hyrox`, `functional`, `bodybuilding`, `running`) are present if any are missing.

If import reports a foreign-key or collation error, stop and share the error text only (do not share credentials). Do not try random ALTER statements.

## Migration 003 — recommendation engine (additive)

`003_fitlytix_recommendation_engine.sql` adds the audit + feedback loop for the
self-hosted plan recommender:

- `recommendation_events` — every model decision with its exact inputs (context), chosen
  action and model version. Append-only.
- `recommendation_outcomes` — the reward signal recorded when a cycle ends
  (`completed_cycle`, `adherence`, `sessions_completed`, `progress_score`).
- `model_registry` — which model version is live, with the artifact SHA256 and metrics.

None of these tables are read on the request path, so the app keeps working if the
migration has not been applied yet (logging is best-effort and silently skipped).
Apply it after 001/002, then start collecting 90 days of data before retraining on
real outcomes (`ml/README.md`).

## Migration 004 — recommendation snapshots (additive)

`004_recommendation_snapshots.sql` stores every plan the model produced for an athlete:

- `recommendation_snapshots` — one row per (athlete, input hash, model version): the exact
  request (`request_json`), the full recommendation (`result_json`) and the chosen action
  columns (archetype, nutrition strategy, cycle length, coaching mode, safety level).
  The UI reads the latest row instead of recomputing, so athletes never see a plan change
  without a reason.
- `v_latest_recommendation` — convenience view with the newest snapshot per athlete.

The app degrades gracefully when the table is absent (plans are computed on demand and not
stored), but with it you get a full audit trail for support and the training data needed to
retrain on real outcomes. Apply after 001/002/003.

## What this migration does not do

- It does not populate sample plans or prices.
- It does not enable a payment provider or wearable API credentials.
- It does not connect application services automatically. The app must use repositories/API routes for these tables, with authentication and authorization checks.
- It does not alter the nine existing MyISAM tables or add the ten previously identified foreign keys to existing assessment/sport tables. Those are a separate, data-preserving migration after backup and a fresh orphan check.
- It does not convert the PostgreSQL/Supabase reference file under `docs/schema/future-schema.sql`; that file remains a separate architecture reference.

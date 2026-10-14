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

## What this migration does not do

- It does not populate sample plans or prices.
- It does not enable a payment provider or wearable API credentials.
- It does not connect application services automatically. The app must use repositories/API routes for these tables, with authentication and authorization checks.
- It does not alter the nine existing MyISAM tables or add the ten previously identified foreign keys to existing assessment/sport tables. Those are a separate, data-preserving migration after backup and a fresh orphan check.
- It does not convert the PostgreSQL/Supabase reference file under `docs/schema/future-schema.sql`; that file remains a separate architecture reference.

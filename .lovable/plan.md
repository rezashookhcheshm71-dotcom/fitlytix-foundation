# Wearable & Health Data (connector-ready, no real integrations)

## What the user will see
1. **Assessment (common step)** — a short optional card under body analysis: "از ساعت یا سنسور هوشمند استفاده می‌کنی؟" with a one-line explanation and three choices: بله / خیر / مطمئن نیستم، بعداً. If "بله": pick one or more of Garmin, Apple Watch / Apple Health, WHOOP, Oura, Polar, Samsung Galaxy Watch, Fitbit, سایر. Skipping never blocks the assessment.
2. **Dashboard — "دستگاه‌ها و داده‌های سلامت" panel** (no new page), next to "تغییرات بدن":
   - Each chosen device: name, clear status badge (وصل نیست / آماده اتصال / وصل / خطا در همگام‌سازی), last sync ("هنوز همگام‌سازی نشده" when none).
   - "اتصال" button opens a small note: "اتصال مستقیم به‌زودی فعال می‌شود" — never a fake success.
   - "ورود دستی" button opens a form.
   - Latest manual values as small cards; empty state for users with no device and no data.
3. **Manual health data form** — measurement date/time plus optional: Resting HR (bpm), HRV (ms), Sleep (h), VO2max (ml/kg/min), Weight (kg), Body Fat (%), Steps, Training Load (arbitrary units). Every field optional except at least one value; sensible ranges with Persian error messages. Each save appends new entries; nothing is overwritten.

## Assumption to confirm
The project has **no backend connected**, so — following the body analysis pattern — data lives in a clean service with an in-memory store and demo data (resets on refresh). The database tables and per-athlete security rules are written as a ready-to-apply schema file but **not applied**. When Lovable Cloud is enabled (e.g. at the server migration), we apply it and swap the service. If you'd rather enable Lovable Cloud now and store data for real, say so.

## Technical details
- `src/domain/health-data.ts`: provider enum (garmin, apple_health, whoop, oura, polar, samsung, fitbit, other, manual), `ConnectionStatus` = not_connected | ready_to_connect | connected | sync_error, `WearableConnection` {id, athleteId, provider, status, externalAccountId?, lastSyncAt?, lastError?, createdAt, updatedAt}, `HealthMetric` {id, athleteId, source/provider, connectionId?, metricType, value, unit, startTime, endTime?, externalId?, deviceId?, metadata?, rawPayload?, createdAt}, `METRIC_DEFS` (type → unit, label, range), zod input schema.
- `src/services/health-data/service.ts`: `listConnections`, `setIntent` (from assessment → creates `ready_to_connect` rows, never `connected`), `requestConnect` (returns `{ available: false }`), `addManual` (append-only), `listMetrics`, `latestByType`. Provider adapter interface `HealthProviderConnector` defined with no implementations; OAuth/tokens explicitly server-only.
- `src/mock/health-data.ts`: small demo data behind the mock boundary.
- Common assessment: add a `wearable` section to the common template's answers flow via a dedicated `WearableIntake` card (reuses existing Button/Panel styles), saved through the service on submit.
- `src/components/domain/health-data.tsx` (panel + manual dialog, Drawer-style responsive dialog like body analysis); mounted in `athlete.dashboard.tsx`; QA param `?health=empty`.
- Fitness DNA: `fitnessDnaService.inputs` gains `healthMetrics: { metricIds, latestByType }` as traceable input only; radar still from snapshot.
- Coaching context: add `wearable` / `healthMetrics` availability entries; no new algorithms.
- `docs/schema/wearable-health.sql` (not applied): `wearable_connections`, `health_metrics` with grants, RLS enabled, policies scoped to `auth.uid()` via athlete ownership, unique (provider, external_id) for future dedupe.
- Update AGENTS.md (one rule), roadmap.md; typecheck/build; browser QA: assessment yes/no/unsure, dashboard empty vs demo, manual entry adds data, connect shows coming-soon.

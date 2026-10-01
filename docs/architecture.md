# FitLytix Foundation — Architecture

FitLytix is an Athlete Intelligence Platform: **Athlete + Human Coach + Smart Engine**.
Core loop: Assessment → Athlete 360 → Fitness DNA → Goals → Training/Nutrition/Recovery → Feedback → Analysis → Program update.

## Layers

```text
src/domain/      Pure types, constants, zod schemas, assessment templates (no UI, no mock)
src/services/    Service boundaries (typed functions). Today: in-memory/mock implementations
src/mock/        Demo data only — imported by services, never by new UI code
src/components/  UI building blocks (domain/* + shadcn ui/*)
src/routes/      Pages (TanStack Start file routes)
docs/schema/     Future database schema (NOT applied)
```

Rule: UI → services → (mock today | API/DB later). Replacing a service implementation must not change UI.

## Domains and service boundaries

| Domain | Module | Notes |
|---|---|---|
| Assessment | `domain/assessment/*`, `services/assessment/engine.ts` | 5 independent sport templates + common; stable field IDs; adaptive depth |
| Athlete 360 | `services/athlete/athlete360.ts`, `services/athlete/dashboard.ts` | One aggregate referencing the same athlete ID; passport projection |
| Body analysis | `domain/body-analysis.ts`, `services/body-analysis` | Append-only, dated records |
| Fitness DNA | `services/fitness-dna/inputs.ts` | Radar from sport snapshot; body/health are traceable inputs |
| Training | `services/program/service.ts`, `domain/exercise-education.ts` | Sport-specific session structures, exercise education by stable IDs |
| Nutrition | `services/nutrition/service.ts` | Profile, meal structure by day type, feedback/adherence. No medical prescriptions |
| Recovery/readiness | `services/recovery/service.ts` | Ready / Moderate / Recovery Needed, factor list + `why` |
| Health/wearables | `services/health-data/service.ts` | Provider-agnostic connections + metrics; connector interface, empty registry |
| Goals/journey | `services/goals/service.ts` | Goals, milestones, weekly focus, journey stage |
| Decision engine | `services/decision-engine/service.ts` | Deterministic recommendations, each with `why` + `inputs` |
| Coach | `services/coach/service.ts` | Editable profile, roster filters/segments, attention items, weekly brief |
| AI proposals | `services/ai-coaching/proposals.ts` | `ProposalProvider` interface; drafts need coach approval |
| Subscriptions | `services/subscriptions/service.ts`, `services/commerce` | Training / Nutrition / Combined packages; payment not connected |
| Notifications | `services/notifications/service.ts` | Examples only; `delivered: false` |
| Coaching context | `services/coaching/context.ts` | Input-availability contract for future engines |

## Mock → backend replacement strategy
1. Keep every exported service signature. Swap the body for `createServerFn` calls (TanStack Start) or `fetch` to an external REST/Node/Python API.
2. Move demo arrays from `src/mock/*` into seed SQL; delete the mock import.
3. Make sync methods async where needed and wrap reads in TanStack Query (`ensureQueryData` + `useSuspenseQuery`).
4. Remove the "نسخه نمایشی" badges only for data that is truly persisted.

## Future database (see `docs/schema/future-schema.sql`)
Tables: athletes, coaches, coach_athletes, organizations (later), assessments, body_analysis_records, wearable_connections, health_metrics, goals, milestones, programs, workouts, workout_results, nutrition_profiles, nutrition_plans, nutrition_feedback, ai_proposals, notifications, subscriptions, user_roles.

## Auth, roles and security
- Roles live in a separate `user_roles` table (`athlete`, `coach`, `head_coach`, `admin`) checked via a `has_role()` security-definer function — never on profile rows, never client-side.
- RLS: athletes read/write only rows where `athlete_id` maps to `auth.uid()`; coaches read rows of athletes linked in `coach_athletes`; organization scope added later via `organization_id`.
- `health_metrics.raw_payload` and provider tokens are server-only; tokens stored encrypted in a separate table never exposed to the client.
- No secrets in the frontend. All provider/AI keys belong to server env.

## Wearable integration strategy
- Each provider implements `HealthProviderConnector` (authorize URL, OAuth callback, sync) **on the server**.
- OAuth callbacks/webhooks go to `/api/public/*` routes that verify signatures/state.
- Sync writes normalized `health_metrics` rows (dedupe on `provider + external_id`). Apple Health / Health Connect require a native companion app; plan for it.
- Status values: `not_connected`, `ready_to_connect`, `connected`, `sync_error`, `manual`. The UI never shows `connected` without a real token.

## AI provider strategy
- `ProposalProvider` is the only seam. A real provider runs server-side, receives the Athlete 360 context, returns structured sections + rationale.
- Proposals are stored with status `needs_review`; only a coach action sets `approved`. Nothing auto-publishes to athletes.
- Product copy avoids "AI" wording on athlete surfaces; coach surfaces label suggestions explicitly.

## Deployment notes
- Build: `bun run build` produces a Worker-style SSR bundle (Vite + TanStack Start). For Node hosting, use the TanStack Start Node preset / adapter and run behind a reverse proxy.
- cPanel/shared hosting: a static-only export is not enough for server functions; use a Node app (cPanel "Setup Node.js App") or host the API separately (Node/Python) and point services to it.
- Environment: server-only keys via host env vars; public config via `VITE_*`.

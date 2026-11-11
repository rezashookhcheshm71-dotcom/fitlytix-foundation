<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## Architecture rules

- Body analysis is one shared, append-only, dated model (`src/domain/body-analysis.ts` + `src/services/body-analysis`) for every sport — never sport-specific fields, never overwrite a record.
- Fitness DNA radar scores come from the sport snapshot; body composition is passed as a separate traceable input (`src/services/fitness-dna/inputs.ts`), not raw scores.
- Future programming/nutrition engines read only `coachingContextService` (`src/services/coaching/context.ts`), which reports available/missing inputs and generates no plans.
- Workout education is a shared exercise catalog referenced by stable exercise IDs; sport-specific sessions live behind a program service so UI never assumes CrossFit blocks.
- Workout completion is local UI state only until a real session/feedback persistence layer exists; never imply saved results.
- Platform domains (health, readiness, nutrition, goals, decisions, proposals, notifications, packages) are typed in `src/domain/platform.ts` and served by one service per domain under `src/services/*`; UI never imports mock data for these. See docs/architecture.md.
- Coach proposals are drafts (`needs_review`) until an explicit coach approval; nothing auto-publishes. Wearables never show `connected` without a real server-side token.
- Plan recommendation is a self-hosted ML model: training lives in `ml/` (Python, offline) and runtime inference is pure TypeScript (`src/services/recommendation/` + JSON trees). Never add a Python/cloud dependency to the request path; never retrain by editing `model.json` by hand.
- The recommendation engine may only _propose_. Safety guardrails and explicit coach approval stay authoritative, `model.source` must be shown honestly, and no medical claim is allowed.
- Production builds target Nitro `node-server` (vite.config.ts) for self-hosted cPanel/Passenger via `app.js`; why: the app is deployed on our own Node server, not a worker host.

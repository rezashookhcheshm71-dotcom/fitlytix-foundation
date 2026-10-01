# FitLytix implementation roadmap

- [x] Replace assessment contracts with stable, versioned, adaptive question models.
- [x] Build independent Common, CrossFit, Bodybuilding, HYROX, Functional, and Running templates.
- [x] Rework assessment UI and flow for Persian-first guided completion.
- [x] Add sport-profile dashboard data and service boundaries for all five sports.
- [x] Make athlete dashboard and Fitness DNA sport-adaptive.
- [x] Harmonize visual tokens, shared controls, RTL mobile navigation, and Persian copy.
- [x] Verify all five assessment paths, representative product navigation, mobile RTL, and diagnostics.
- [x] Body Analysis: optional assessment intake, append-only records, dashboard «تغییرات بدن», DNA/coaching-context boundaries.
- [x] Add shared exercise education model and curated movement guidance without media URLs.
- [x] Build level-adaptive workout cards, accessible education overlay, and local session progress.
- [x] Keep CrossFit demo intact while adding sport-specific Bodybuilding and Running session examples.
- [x] Verify types, lint, preview and four level/sport scenarios.

## Master implementation (Athlete 360 / Coach Command Center)
- [ ] Shared platform domain types (health, readiness, nutrition, goals, decisions, proposals, notifications, passport, packages, coach profile)
- [ ] Services: health-data, recovery, nutrition, goals, subscriptions, decision-engine (+why), notifications, athlete360, coach, ai-proposals
- [ ] Assessment wearable intake card
- [ ] Athlete dashboard: coach cards, health panel, package-aware
- [ ] Athlete routes: nutrition, recovery, goals, passport, health
- [ ] Coach: command center, athletes (filters/segments), attention, assistant (proposal review/approve), profile, nutrition, performance, athlete timeline
- [ ] Expanded multi-sport demo roster
- [ ] docs/architecture.md + future schema SQL (not applied), README
- [ ] QA: types, build, browser

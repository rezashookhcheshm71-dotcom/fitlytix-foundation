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

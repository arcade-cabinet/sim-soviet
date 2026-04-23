# Active Context

## Current Development Focus

Reduce 1.0 to a polished historical campaign from 1917 through 1991, followed
by grounded same-settlement free play.

## Completed In This Scope-Reduction Pass

- Created and verified a full git bundle backup before repository mutation.
- Captured the dirty worktree status, diff, and untracked files separately.
- Removed runtime future scope: deep-future eras, Kardashev progression,
  multi-settlement relocation, per-world timelines, celestial rendering,
  arcologies, post-scarcity pressure, and freeform chaos systems.
- Replaced new-game mode selection with a single historical campaign start.
- Reworked 1991 completion so it persists and cannot refire every tick.
- Kept post-1991 play as conservative continuation of the same settlement.
- Added focused historical-scope regression coverage.

## In Progress

- Clean remaining stale docs and tests that describe removed future systems as
  product scope.
- Run final verification: typecheck, targeted Jest coverage, lint, and build.

## Known Verification Notes

- `pnpm typecheck` has passed after the runtime pruning.
- A full in-band Jest run hit Node heap exhaustion even with an 8 GB heap during
  this cleanup pass; targeted suites are being used to verify the changed paths.

## Scope Guardrail

Do not reintroduce future or space systems for 1.0. Post-1991 free play is local
settlement management under decay, shortages, weather, demographic pressure, and
political fallout.

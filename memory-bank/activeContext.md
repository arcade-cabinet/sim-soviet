# Active Context

## Current Development Focus

Stabilize and document the historical 1.0 product so the repo, docs, and ship
pipeline all describe the same game.

## Recently Completed

- Created and verified a full git bundle backup before repository mutation.
- Captured the dirty worktree status, diff, and untracked files separately.
- Removed runtime future scope: deep-future eras, Kardashev progression,
  multi-settlement relocation, per-world timelines, celestial rendering,
  arcologies, post-scarcity pressure, and freeform chaos systems.
- Replaced new-game mode selection with a single historical campaign start.
- Reworked 1991 completion so it persists and cannot refire every tick.
- Kept post-1991 play as conservative continuation of the same settlement.
- Added focused historical-scope regression coverage.
- Restored the Android debug CD path and reconfirmed Pages deployment.

## In Progress

- Align root docs, memory-bank notes, and `docs/` around the shipped historical
  product.
- Clarify the remaining-work runway in one canonical production checklist.
- Prepare the docs-alignment PR for review and merge.

## Known Verification Notes

- Current verification baseline on `main` is green through CI, Release, and CD.
- Browser and smoke lanes already emit screenshots and diagnostics artifacts.

## Scope Guardrail

Do not reintroduce future or space systems for 1.0. Post-1991 free play is local
settlement management under decay, shortages, weather, demographic pressure, and
political fallout.

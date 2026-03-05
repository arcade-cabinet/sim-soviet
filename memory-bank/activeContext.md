# Active Context

## Current Development Focus

**Branch: `feat/allocation-engine`** — PR #44 open. All planned features implemented.

### Completed in This Branch
- SimulationEngine decomposed into 7 phase modules (phaseChronology through phaseFinalize)
- Classic mode removed entirely (GovernorMode is now `'historical' | 'freeform'` only)
- Consequence levels renamed to Soviet nomenclature: rehabilitated, gulag, rasstrelyat
- **Pressure-valve crisis system**: PressureSystem (10 domains) + WorldAgent + ClimateEventSystem + BlackSwanSystem + ColdBranches (19 branches)
- **Soviet Allocation Engine**: organic growth pipeline (demand → site selection → construction), directives, posture, prestige
- **Buildings-as-UI**: click buildings for contextual panels (FactoryContent, FarmContent, GovernmentHQ ReportsTab)
- **HQ splitting**: multi-function HQ → dedicated buildings as population grows
- **Dynamic map expansion**: grid expands via settlement tier upgrades
- **WorldAgent**: sphere dynamics coordinating world-level state
- **RelocationEngine**: data model for multi-settlement support (gameplay/UI not yet implemented)
- Off-screen building tick for DB-only state updates
- Freeform endless mode with unlimited map expansion
- Global warming terrain effects for freeform centuries
- Expanded playthrough tests and historical accuracy fixes
- All operational docs updated
- 5,641+ tests across 170+ suites

### In Progress
- PR #44 open — cleanup and merge into main
- Multi-settlement gameplay and UI viewport switching (NOT yet implemented, data model only)
- Historical accuracy alignment for playthrough tests

## Key Design Docs (now implemented)
- `docs/plans/2026-03-03-buildings-are-the-ui-design.md` — UX paradigm shift (DONE)
- `docs/plans/2026-03-03-buildings-are-the-ui-plan.md` — 7-phase implementation (DONE)
- `docs/plans/2026-03-03-soviet-allocation-engine-design.md` — DB-backed engine (DONE)
- `docs/plans/2026-03-03-soviet-allocation-engine-plan.md` — 6-phase implementation (DONE)
- `docs/plans/2026-02-28-autonomous-collective-plan.md` — Collective self-organization (DONE)

## Active Branches

| Branch | Purpose | Status |
|--------|---------|--------|
| `main` | Release branch | Current release |
| `feat/allocation-engine` | Allocation engine + pressure-valve crisis + organic growth | PR #44 open |

## Known Issues

- tsconfig: `module: "commonjs"` conflicts with `moduleResolution: "bundler"` — pre-existing, doesn't block builds
- Pre-existing TypeScript errors from yuka type declarations — tests pass because Jest doesn't check types
- Branch protection: main requires PRs — cannot push directly

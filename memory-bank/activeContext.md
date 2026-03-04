# Active Context

## Current Development Focus

**Branch: `feat/allocation-engine`** — Engine decomposition + classic mode removal + doc overhaul.

### Just Completed
- SimulationEngine decomposed into 7 phase modules (phaseChronology through phaseFinalize)
- Classic mode removed entirely (GovernorMode is now `'historical' | 'freeform'` only)
- Consequence levels renamed to Soviet nomenclature: rehabilitated, gulag, rasstrelyat
- Map size removed from NewGameSetup UI (grid starts at 20x20, will expand dynamically)
- All operational docs (CLAUDE.md, memory-bank, AGENTS.md, copilot-instructions) updated to correctly describe the game as a Soviet bureaucrat survival sim, NOT a city builder

### In Progress
- Test updates for new consequence/mode types
- PR #44 open with engine decomposition changes

### NOT YET DONE (planned, documented)
- **Organic settlement growth** — agent-driven demand → site-selection → construction pipeline
- **Buildings-as-UI** — click buildings for contextual panels, strip build toolbar
- **Soviet Allocation Engine** — DB-backed tick, land grants, terrain prestige
- **Dynamic map expansion** — grid expands via settlement tier upgrades
- **Remove direct building placement** — the player should NOT have a build menu

## Key Design Docs (implement these next)
- `docs/plans/2026-03-03-buildings-are-the-ui-design.md` — UX paradigm shift
- `docs/plans/2026-03-03-buildings-are-the-ui-plan.md` — 7-phase implementation
- `docs/plans/2026-03-03-soviet-allocation-engine-design.md` — DB-backed engine
- `docs/plans/2026-03-03-soviet-allocation-engine-plan.md` — 6-phase implementation
- `docs/plans/2026-02-28-autonomous-collective-plan.md` — Collective self-organization

## Active Branches

| Branch | Purpose | Status |
|--------|---------|--------|
| `main` | Release branch | Current release |
| `feat/allocation-engine` | Engine decomposition + mode cleanup | PR #44 open |

## Known Issues

- tsconfig: `module: "commonjs"` conflicts with `moduleResolution: "bundler"` — pre-existing, doesn't block builds
- Pre-existing TypeScript errors from yuka type declarations — tests pass because Jest doesn't check types
- Branch protection: main requires PRs — cannot push directly

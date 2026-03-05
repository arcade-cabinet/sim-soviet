# Active Context

## Current Development Focus

**Branch: `feat/allocation-engine`** — PR #44 open. All planned features implemented.

### Completed in This Branch
- SimulationEngine decomposed into 7 phase modules (phaseChronology through phaseFinalize)
- Classic mode removed entirely (GovernorMode is now `'historical' | 'freeform'` only)
- Consequence levels renamed to Soviet nomenclature: rehabilitated, gulag, rasstrelyat
- **Pressure-valve crisis system**: PressureSystem (15 domains: 10 classical + 5 post-scarcity) + WorldAgent + ClimateEventSystem + BlackSwanSystem + ColdBranches (42 branches)
- **Soviet Allocation Engine**: organic growth pipeline (demand → site selection → construction), directives, posture, prestige
- **Buildings-as-UI**: all 7 phases complete (HUD stripped → organic growth → building-click → directive-only → tiers → upgrades → toolbar removed)
- **HQ splitting**: multi-function HQ → dedicated buildings as population grows
- **Dynamic map expansion**: grid expands via settlement tier upgrades
- **WorldAgent**: sphere dynamics coordinating world-level state
- **Multi-settlement tick loop**: per-settlement agent tree, background aggregate math, viewport switching
- **Kardashev sub-eras (8)**: post_soviet → planetary → solar_engineering → type_one → deconstruction → dyson_swarm → megaearth → type_two_peak
- **Post-scarcity pressure**: 5 new domains (meaning, density, entropy, legacy, ennui)
- **MegaCity law enforcement**: KGB → Security → Sector Judges → Megacity Arbiters
- **Adaptive agent matrix**: 10 terrain profiles wired to 6 core agents, climate polarity
- **Celestial Body Factory**: sphere↔flat morphing (4 body types), MegastructureShell (Dyson)
- **ZonePreloader**: zone-specific asset preloading with progress phases
- **Zone-aware loading screens**: LoadingScreen + SettlementTransitionOverlay with zone flavor text
- **Poly Haven pipeline**: declarative asset fetcher (7 HDRIs, 15 terrain textures, all CC0)
- **3 procedural shaders**: Dyson sphere, Mars atmosphere, O'Neill interior
- 6,730 tests across 283 suites, 0 TypeScript errors
- 20 commits, ~16K lines new code

### In Progress
- PR #44 open — cleanup and merge into main
- Dyson sphere viewport: user has generator to port (DEFERRED)

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

# Active Context

## Current Development Focus

Yuka agent architecture migration — decomposing SimulationEngine into domain agents:

- **Phase 1 COMPLETE**: Created 8 agent subpackages under `src/ai/agents/` (123 files, 28k lines)
- **Phase 2 COMPLETE**: SimulationEngine decomposed from 2207 → 1126 lines (12 methods moved to agents)
- **Phase 3 COMPLETE**: Import rewiring — agents import from `engine/types`, not SimulationEngine
- **Phase 4 COMPLETE**: `src/game/political/` absorbed into `src/ai/agents/political/` (8 files moved)

## Recent Changes

### Yuka Agent Architecture (feat/game-completion branch)

- 8 agent subpackages: core, economy, political, infrastructure, social, workforce, narrative, meta
- 12 private methods MOVED from SimEngine to agents (delete-from-source, not copy)
- Types extracted to `src/game/engine/types.ts` (SimCallbacks, RehabilitationData, SubsystemSaveData)
- `src/game/political/` fully absorbed into `src/ai/agents/political/`
- All 3,277 tests passing, 0 regressions

### Key Agent Methods Added

- `EconomyAgent.applyTickResults()` — fondy, trudodni, currency reform, rations
- `PoliticalAgent.tickEntitiesFull/handleEraTransitionFull/checkConditions`
- `DefenseAgent.processGulagEffect/tickDiseaseFull`
- `CollectiveAgent.tickAutonomous/getHousingCapacity`
- `KGBAgent.applyRehabilitation`
- `SettlementSystem.tickWithCallbacks`
- `WorkerSystem.getAverageSkill`

### Previous Major Work

- Demographics overhaul (PR #39 — merged)
- Documentation/JSDoc/.claude overhaul (PR #39 — merged)
- Game completion sprint (PR #40 — 22 features)
- R3F migration from BabylonJS/Reactylon (completed)

## Active Branches

| Branch | Purpose | Status |
|--------|---------|--------|
| `main` | Release branch | Current |
| `feat/game-completion` | Agent architecture + game completion | In progress (32 commits ahead) |

## Known Issues

- tsconfig: `module: "commonjs"` conflicts with `moduleResolution: "bundler"` — pre-existing, doesn't block builds
- 27 pre-existing TypeScript errors from yuka type declarations (`.name` property, `override` modifier) — tests pass because Jest doesn't check types
- Branch protection: main requires PRs — cannot push directly

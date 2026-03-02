# Active Context

## Current Development Focus

Building-as-Container architecture + RNG purge — replacing per-citizen entities with aggregate workforce on buildings:

- **RNG Purge COMPLETE**: GameRng mandatory on SimulationEngine, all 80+ simulation-critical Math.random() replaced with seeded rng
- **Building-as-Container COMPLETE**: Dual population modes (entity < 200, aggregate >= 200), RaionPool demographics, building production functions
- **Integration Gaps COMPLETE**: Aggregate mode guards on disease, trudodni, UI snapshot; shared poissonSample utility extracted
- **Agent Architecture COMPLETE**: 8 agent subpackages under `src/ai/agents/` (123+ files, 28k+ lines)

## Recent Changes

### Building-as-Container Architecture (feat/game-completion branch)

- **Dual population modes**: `entity` (pop < 200, early game) and `aggregate` (pop >= 200, one-way transition)
- **RaionPool**: District-level age-sex demographics (20 buckets per gender), class counts, vital stats, labor tracking
- **Building workforce fields**: 8 new fields on BuildingComponent (workerCount, residentCount, avgMorale, avgSkill, avgLoyalty, avgVodkaDep, trudodniAccrued, householdCount)
- **Statistical demographics**: Poisson-sampled births/deaths/aging on RaionPool (O(20) per bucket, not O(population))
- **Building production function**: Pure `computeBuildingProduction()` with formula: baseRate × effectiveWorkers × skillFactor × moraleFactor × conditionFactor × powerFactor × eraMod × weatherFactor
- **Brutalist scaling**: Same 55 GLB models scaled proportionally to capacity (no new assets). Base=1.0, mega-block=~5.5, arcology=~8.0
- **Collapse transition**: `collapseEntitiesToBuildings()` removes all citizen/dvor entities, builds RaionPool, populates building workforces
- **Serialization**: Save/load supports both modes with backward compatibility

### RNG Purge

- GameRng mandatory on SimulationEngine (no more Math.random fallbacks)
- All 14 agents receive seeded GameRng via `setRng()` or constructor
- 80+ Math.random() calls replaced across ~20 simulation files
- Population growth gated to yearly immigration (3% housing cap)
- Fixed infinite loop in `generateSeedPhrase()` with constant RNG mock

### Integration Gap Fixes

- Disease system (DefenseAgent, disease.ts): aggregate mode early-returns
- Trudodni accrual (EconomyAgent, trudodni.ts): building-level aggregate path
- UI snapshot (useGameState.ts): raion fallback for population stats
- Shared `poissonSample()` extracted to `src/math/poissonSampling.ts`
- Entity GC sweeps: `sweepOrphanCitizens()`, `sweepEmptyDvory()` on year boundary

### Previous Major Work

- Yuka agent architecture (8 subpackages, 12 methods moved from SimEngine)
- Demographics overhaul (PR #39 — merged)
- Documentation/JSDoc/.claude overhaul (PR #39 — merged)
- Game completion sprint (PR #40 — 22 features)
- R3F migration from BabylonJS/Reactylon (completed)

## Active Branches

| Branch | Purpose | Status |
|--------|---------|--------|
| `main` | Release branch | Current |
| `feat/game-completion` | Building-as-container + RNG purge + agent architecture | In progress |

## Known Issues

- tsconfig: `module: "commonjs"` conflicts with `moduleResolution: "bundler"` — pre-existing, doesn't block builds
- 50 pre-existing TypeScript errors from yuka type declarations (`.name` property, `override` modifier) — tests pass because Jest doesn't check types
- Branch protection: main requires PRs — cannot push directly

# Active Context — SimSoviet 2000

## Current State

**Branch**: `main` — all core systems wired and functional.

**Live site**: https://arcade-cabinet.github.io/sim-soviet/

## Architecture: Canvas 2D + ECS-Direct (GameState ELIMINATED)

BabylonJS/Reactylon fully removed. The game uses a **Canvas 2D** renderer with **pre-baked isometric sprites** from GLB models, matching the SimCity 2000 aesthetic.

**ECS is the single source of truth.** The old `GameState` class has been deleted. All systems read/write ECS directly:
- **Resources**: `getResourceEntity()!.resources.*` (money, food, vodka, power, population + trudodni, blat, timber, steel, cement, prefab, seedFund, emergencyReserve, storageCapacity)
- **Metadata**: `getMetaEntity()!.gameMeta.*` (date, quota, leader, settlement, personnel, gameOver, selectedTool, seed)
- **Buildings**: `buildingsLogic.entities` (ECS archetype query)
- **Grid**: `GameGrid` class (spatial index only — no resource/building data)
- **React bridge**: `gameStore.ts` → `createSnapshot()` reads ECS directly via `useSyncExternalStore`

**Rendering pipeline**: `Canvas2DRenderer.ts` → 6 layers (ground, grid, buildings, hover, preview, particles) drawn via `CanvasRenderingContext2D`. Camera pan/zoom via `Camera2D.ts`. Sprites loaded from `app/public/sprites/soviet/manifest.json` (31 building PNGs + 138 hex tiles).

**Important**: Vite root is `./app`, so static assets must be in `app/public/` (not project-root `public/`). Asset URLs must use `import.meta.env.BASE_URL` prefix (not hardcoded `/`) to work on GitHub Pages subdirectory deployment.

## Recently Completed: Monolith Decomposition + Biome Compliance

### 6 Monolithic Files Decomposed
- [x] **factories.ts** (785→29 lines): split into `src/ecs/factories/` — `buildingFactories.ts`, `citizenFactories.ts`, `settlementFactories.ts`, `storeFactories.ts`, `demographics.ts` + barrel `index.ts`
- [x] **App.tsx** (341→245 lines): extracted `app/hooks/useSimCallbacks.ts` (103 lines) + `app/components/GameModals.tsx` (137 lines)
- [x] **SimulationEngine.ts** (~600 lines removed): extracted `src/game/engine/` — `serializeEngine.ts`, `achievementTick.ts`, `annualReportTick.ts`, `minigameTick.ts`
- [x] **DrawerPanel.tsx**: 10+ section sub-components (`DrawerHeader`, `ArchivesSection`, `AudioSection`, `SettlementSection`, `PopulationRegistrySection`, `QuotaSection`, `CollectiveFocusSection`, `AlertsSection`, `PersonnelFileSection`) + `buildAlerts()` pure function + `thresholdColor()` utility
- [x] **constructionSystem.ts**: extracted `advanceBuilding()`, `resolveCosts()`, `hasSufficientMaterials()`, `deductMaterials()`, `perTickCost()`
- [x] **WorkerSystem.ts**: extracted `processCitizens()`, `processDefections()`, `runGovernorTick()` private methods from monolithic `tick()`

### Biome 100% Clean
- [x] All cognitive complexity violations resolved (max 15 threshold)
- [x] Template literal rules fixed (`settlementFactories.ts`)
- [x] Array index key warnings fixed (`DrawerPanel.tsx`)
- [x] **308 files checked, 0 errors, 0 warnings**

### Previous Session: Playtest TDD Fixes + Code Review
- [x] Population display, food balance, resource defaults, 5 UI callbacks
- [x] Governor dead code, array mutation, unsafe casts, type safety
- [x] +102 integration tests across 7 new test files

### All Previously Complete Systems (verified working)
- [x] Material deduction during construction (constructionSystem.ts perTickCost/hasSufficientMaterials)
- [x] Era construction time multiplier (eraTimeMult param on constructionSystem)
- [x] Weather construction time multiplier (weatherTimeMult param)
- [x] Construction progress bar UI (Canvas2DRenderer draws progress bars)
- [x] Era-gated build menu (RadialBuildMenu calls getAvailableBuildingsForYear)
- [x] Dvor (household) system (DvorComponent, createDvor, createStartingSettlement)
- [x] Demographic tick (births/deaths/aging wired in SimulationEngine)
- [x] Behavioral governor (runGovernor called per worker in WorkerSystem.tick())

## All Major Systems — COMPLETE

### Full Planned Economy (`src/game/economy/`)
- [x] EconomySystem orchestrator — trudodni, fondy, blat, heating, MTS, stakhanovites, rations, currency reforms
- [x] Storage system — overflow + baseline spoilage
- [x] 9 planned economy resource types

### Era & Campaign System (`src/game/era/`)
- [x] 8 Era definitions (war_communism → eternal_soviet)
- [x] Era transitions with modifier blending
- [x] Per-era victory/failure conditions
- [x] Construction method progression
- [x] Checkpoint system

### Worker System (`src/game/workers/`)
- [x] Worker entities, morale/loyalty/skill, vodka dependency
- [x] 6 AI classes, behavioral governor (5-level priority stack)
- [x] CollectiveFocus player control via DrawerPanel

### Political Apparatus (`src/game/political/`)
- [x] PoliticalEntitySystem (politruks, KGB, military)
- [x] PolitburoSystem (ministries, coups, purges)

### Scoring, Achievements, Minigames
- [x] ScoringSystem (3×3 difficulty/consequence), 12 medals, 28+ achievements
- [x] 8 minigames with auto-resolve, GameTally

### NPC Dialogue & Tutorial
- [x] 7 dialogue pools, Comrade Krupnik advisor, 14 tutorial milestones

### Map, Rendering, Audio
- [x] Canvas 2D 6-layer renderer, procedural terrain
- [x] Audio with era/season switching, volume controls
- [x] Worker sprites, political entity badges

### Save/Load, UI
- [x] Full subsystem serialize/deserialize (10+ subsystems including mandates)
- [x] DrawerPanel: save/load, audio, collective focus, population registry, alerts
- [x] Full screen flow: Landing → NewGame → Assignment → Playing

## Key Gotchas

- `notifyStateChange()` MUST be called after any ECS mutation that should trigger React re-renders
- Miniplex predicate archetypes require `world.reindex(entity)` after mutation
- Vite root is `./app` — static assets go in `app/public/`, NOT `public/`
- Asset URLs must use `import.meta.env.BASE_URL` prefix for GitHub Pages compatibility
- **callbacksRef pattern**: `GameWorld.tsx` stores `callbacks` in a `useRef` — inline objects as useEffect deps kill the simulation interval
- **No more GameState**: All data lives in ECS
- **GameView is read-only**: Built fresh per tick from ECS for EventSystem/PravdaSystem lambda conditions
- **Era grace period**: `checkEraConditions()` skips first year + no-buildings
- **GAME_ERA_TO_ECONOMY_ERA**: Maps EraSystem IDs → EconomySystem EraIds
- **Storage spoilage**: storageSystem applies 5%/tick overflow + 0.5%/tick baseline
- **DPR-aware canvas**: `canvas.width = w*dpr; ctx.setTransform(dpr,0,0,dpr,0,0)`

## PRs
- **PR #1–#4**: All MERGED (Canvas 2D, deploy fix, asset paths, game systems)
- **PR #5**: Complete all game systems — 1812 tests — MERGED
- **PR #8**: Audio mute toggle — MERGED
- **PR #9**: Playtest TDD fixes + decomposition — branch `fix/playtest-tdd-demographics-callbacks` — OPEN

## Active Decisions

- **Canvas 2D over BabylonJS**: Pre-baked sprites on 2D canvas (880 KB main JS, 256 KB gzip)
- **ECS as single source of truth**: GameState eliminated
- **Module-level RNG pattern**: `_rng` set by constructors
- **Chronology model**: 1 tick = 1s, 3 ticks/day, 10 days/month, 360 ticks/year
- **Tone**: SURVIVAL game — dark sardonic MASH-style humor, NOT comedy

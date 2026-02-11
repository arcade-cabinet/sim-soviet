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

## Recently Completed: Playtest Fix Session (TDD)

### Game-Breaking Bug Fixes
- [x] **Population display fix**: `gameStore.ts:85` now uses `totalCitizens` (ECS count) instead of `resources.population` (was hardcoded 12)
- [x] **Starting food rebalance**: 200 → 600 base food (enough for ~55 citizens to survive ~2 months without production)
- [x] **Resource store defaults aligned**: food=600, timber=30, steel=10 match `BASE_STARTING` in difficulty.ts

### 5 Missing UI Callbacks Wired in App.tsx
- [x] `onEraChanged` → `EraTransitionModal` (Soviet-aesthetic briefing modal)
- [x] `onMinigame` → `MinigameModal` (presents minigame choices to player)
- [x] `onTutorialMilestone` → feeds to Advisor (Krupnik) via existing onAdvisor path
- [x] `onAchievement` → `addSovietToast()` (uses existing toast system)
- [x] `onGameTally` → `GameTallyScreen` (end-game summary with stats)

### New UI Components
- [x] `EraTransitionModal.tsx` — era change briefing with modifiers display
- [x] `MinigameModal.tsx` — minigame choice presentation
- [x] `GameTallyScreen.tsx` — end-game summary screen with medals

### New Test Coverage (+102 tests)
- [x] `demographics-balance.test.ts` — settlement creation, pop display, food sufficiency
- [x] `RadialBuildMenu.test.tsx` — pointer-events behavior, category/building wedge rendering
- [x] `constructionSystem.test.ts` — full lifecycle (foundation → building → complete)
- [x] `economy-integration.test.ts` — compulsory deliveries, trudodni, fondy, difficulty scaling
- [x] `era-integration.test.ts` — era transitions, building gating, victory/failure conditions
- [x] `political-integration.test.ts` — entity spawning, personnel file, KGB risk scaling
- [x] Extended: `SimulationEngine.wiring.test.ts`, `gameStore.test.ts`

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

## Active Decisions

- **Canvas 2D over BabylonJS**: Pre-baked sprites on 2D canvas (880 KB main JS, 256 KB gzip)
- **ECS as single source of truth**: GameState eliminated
- **Module-level RNG pattern**: `_rng` set by constructors
- **Chronology model**: 1 tick = 1s, 3 ticks/day, 10 days/month, 360 ticks/year
- **Tone**: SURVIVAL game — dark sardonic MASH-style humor, NOT comedy

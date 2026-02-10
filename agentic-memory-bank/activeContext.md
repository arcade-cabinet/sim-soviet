# Active Context — SimSoviet 2000

## Current State

**Branch**: `feat/wire-all-game-systems` — massive systems implementation complete.

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

## Recently Completed: Design-Alignment Team (Phase 1-3)

### Full Planned Economy (`src/game/economy/`)
- [x] EconomySystem orchestrator — trudodni, fondy, blat, heating, MTS, stakhanovites, rations, currency reforms
- [x] Trudodni (labor units) — work contribution tracking per worker/building
- [x] Fondy (state allocations) — material deliveries from central planning
- [x] Blat (connections) — hidden economy currency
- [x] Ration cards — tiered food distribution by era
- [x] MTS system — machine-tractor stations for farm bonuses
- [x] Stakhanovites — random quota-exceeding worker events
- [x] Heating progression — pechka → district heating → crumbling infra
- [x] Production chains — multi-step chains (grain→flour→bread, grain→distillery→vodka)
- [x] Currency reforms — era-triggered denomination changes
- [x] Difficulty multipliers — full set per difficulty level
- [x] Quota escalation — era-based escalation curve
- [x] Storage system — `storageSystem()` with 5%/tick overflow + 0.5%/tick baseline spoilage
- [x] 9 new resource types: trudodni, blat, timber, steel, cement, prefab, seedFund, emergencyReserve, storageCapacity

### Era & Campaign System (`src/game/era/`)
- [x] 8 Era definitions (war_communism → eternal_soviet) with year boundaries
- [x] Era transitions — checked in SimulationEngine, modifier blending over 10 ticks
- [x] Era-specific buildings — cumulative unlock gating
- [x] Era-specific event templates — era filter on EventSystem
- [x] Era Doctrine integration — auto-map doctrine to era
- [x] Per-era victory/failure conditions — checked each tick with grace period
- [x] Construction method progression — manual(2.0×) → mechanized(1.0×) → industrial(0.6×) → decaying(1.5×)
- [x] Checkpoint system — save/restore at era boundaries

### Worker System (`src/game/workers/`)
- [x] Worker entities in ECS — CitizenComponent spawning
- [x] Worker morale/loyalty/skill — hidden stats affecting production
- [x] Vodka dependency per-worker — individual consumption mechanic
- [x] 6 citizen AI classes (Worker/Party/Engineer/Farmer/Soldier/Prisoner)
- [x] Population dynamics — birth/death/defection lifecycle

### Political Apparatus (`src/game/political/`)
- [x] PoliticalEntitySystem — 396 lines orchestrating politruks, KGB, military
- [x] Politruk mechanics — visible entities, taking workers off production
- [x] KGB investigations — agent entities with investigation logic
- [x] Military drain — conscription events, worker removal
- [x] Orgnabor — temporary worker borrowing

### Scoring & Achievements
- [x] ScoringSystem — difficulty (worker/comrade/tovarish), consequences (forgiving/permadeath/harsh)
- [x] Score multiplier matrix — 3×3 difficulty×consequence combos
- [x] 12 satirical Soviet medals
- [x] AchievementTracker — 28+ achievements
- [x] GameTally — end-game summary screen data

### Minigames (`src/game/minigames/`)
- [x] MinigameRouter — 245 lines, building/event tap routing
- [x] 8 minigame definitions: Queue, Ideology Session, Inspection, Conscription, Black Market, Factory Emergency, The Hunt, Interrogation
- [x] Auto-resolve fallback for ignored minigames

### NPC Dialogue (`src/content/dialogue/`)
- [x] 7 dialogue pools: worker, politruk, KGB, military, party, advisor (Krupnik), ambient
- [x] Context-sensitive selection by season, resource level, era, threat level
- [x] MASH-style dark sardonic humor (survival coping, not comedy)

### Tutorial (`src/game/TutorialSystem.ts`)
- [x] 14 milestones — progressive disclosure tied to ticks/events
- [x] Comrade Krupnik — named advisor with personality

### Map & Terrain
- [x] Configurable map sizes (20/30/50) from NewGameFlow
- [x] Rivers — procedural river generation with bridges
- [x] Marshland — difficult terrain with construction penalties
- [x] Interior terrain features — forests/mountains/marshland inside map

### Design Doc Audit Result: ~92% Coverage
Key remaining gaps (cosmetic/edge-case):
- Consumer goods marketplace UI
- Essential worker designation mechanic
- Notification log spatial panning
- Color-blind accessibility mode
- Bridge sprite representations
- Medal ceremony animations

### Previous Work (carried forward)
- [x] All 6 UI prototypes approved and wired into game
- [x] PersonnelFile, CompulsoryDeliveries, SettlementSystem — all integrated
- [x] Annual Report (pripiski) falsification mechanic
- [x] Legacy type→defId migration complete
- [x] ECS Unification — GameState deleted

### PRs Merged
- **PR #1**: Canvas 2D migration, CI/CD setup, systems overhaul, 795 unit tests
- **PR #2**: Fix deploy workflow (upload-pages-artifact v3→v4)
- **PR #3**: Fix sprite/audio asset paths with Vite BASE_URL
- **PR #4**: Game Systems Integration — PolitburoSystem, weather modifiers, biome terrain

## Key Gotchas

- `notifyStateChange()` MUST be called after any ECS mutation that should trigger React re-renders
- Miniplex predicate archetypes require `world.reindex(entity)` after mutation
- Vite root is `./app` — static assets go in `app/public/`, NOT `public/`
- Asset URLs must use `import.meta.env.BASE_URL` prefix for GitHub Pages compatibility
- Audio files ~100MB, need `pnpm download:audio` on fresh clone
- DPR-aware canvas: `canvas.width = w*dpr; ctx.setTransform(dpr,0,0,dpr,0,0)`
- Sprite anchor: `drawX = screenX - anchorX`, `drawY = screenY + TILE_HEIGHT/2 - anchorY`
- **callbacksRef pattern**: `GameWorld.tsx` stores `callbacks` in a `useRef` — inline objects as useEffect deps kill the simulation interval
- **No more GameState**: All data lives in ECS. Systems use `getResourceEntity()` and `getMetaEntity()` directly.
- **GameView is read-only**: Built fresh per tick from ECS for EventSystem/PravdaSystem lambda conditions
- **Era grace period**: `checkEraConditions()` skips first year + no-buildings to prevent premature game-over
- **GAME_ERA_TO_ECONOMY_ERA**: Maps EraSystem IDs → EconomySystem EraIds in SimulationEngine
- **Storage spoilage**: storageSystem applies 5%/tick overflow + 0.5%/tick baseline — tests must account for resource decay

## Active Decisions

- **Canvas 2D over BabylonJS**: Pre-baked sprites on 2D canvas (664 KB main JS, 190 KB gzip)
- **Sprite baking via Blender**: Orthographic camera at 60X/45Z (2:1 dimetric), Cycles renderer
- **ECS as single source of truth**: GameState eliminated, ECS drives everything
- **Module-level RNG pattern**: `_rng` set by constructors, avoids param threading
- **Chronology model**: 1 tick = 1s, 3 ticks/day, 10 days/month (dekada), 360 ticks/year
- **Asset URLs**: Use `import.meta.env.BASE_URL` for all public dir references
- **Tone**: SURVIVAL game — dark sardonic MASH-style humor as coping mechanism, NOT comedy

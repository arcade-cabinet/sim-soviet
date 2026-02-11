# Progress — SimSoviet 2000

## What Works

### Core Game Loop
- [x] 30x30 isometric grid with Canvas 2D rendering
- [x] Building placement (31 building types via radial pie menu)
- [x] Resource system (rubles, food, vodka, power, population + 9 planned economy resources)
- [x] SimulationEngine ticks — 18+ step tick loop with all subsystems
- [x] Power system — buildings require power, coal plants generate it
- [x] 5-Year Plan quota system with food → vodka progression + era escalation
- [x] Starting settlement creation (difficulty-scaled dvory with Russian patronymics)

### ECS Architecture (UNIFIED — GameState eliminated)
- [x] **ECS is the single source of truth** — no more dual authority
- [x] `GameGrid` — spatial index for configurable grid (20/30/50)
- [x] `GameMeta` — ECS component for date, quota, leader, settlement, personnel, gameOver
- [x] `GameView` — read-only snapshot for event/headline lambdas
- [x] `createSnapshot()` in gameStore reads ECS directly (with population breakdown)
- [x] All systems write ECS directly — no syncEcsToGameState
- [x] PolitburoSystem writes resources directly

### Canvas 2D Rendering (COMPLETE)
- [x] `Canvas2DRenderer.ts` — 6-layer renderer (ground, grid, buildings, hover, preview, particles)
- [x] `Camera2D.ts` — pan/zoom with DPR-aware canvas sizing + edge clamping
- [x] `GridMath.ts` — isometric grid-to-screen projection (TILE_WIDTH=80, TILE_HEIGHT=40)
- [x] `SpriteLoader.ts` — manifest-driven sprite loading, 31 building PNGs preloaded in parallel
- [x] `CanvasGestureManager.ts` — tap/pan/pinch/scroll-zoom + drag-to-place + onBuildingPlaced callback
- [x] `ParticleSystem2D.ts` — snow/rain particle effects in screen-space
- [x] `BuildingFootprints.ts` — type→sprite mapping + grid footprint sizes
- [x] Construction progress bar overlay on buildings under construction
- [x] Depth-sorted building rendering (back-to-front by gridX+gridY)
- [x] Worker sprites — class-colored dots
- [x] Political entity badges — role-specific shapes, pulsing, labels

### Sprite Pipeline (COMPLETE)
- [x] `render_sprites.py` — Blender-to-PNG baking, 31 buildings, PPU=80
- [x] `render_hex_tiles.py` — 138 hex terrain tiles, 3 seasons (winter/mud/summer)
- [x] `generate_building_defs.ts` → `buildingDefs.generated.json` with Zod validation

### Seeded Randomness (COMPLETE)
- [x] `SeedSystem.ts` — GameRng class wrapping seedrandom library
- [x] All Math.random() calls replaced with seeded RNG

### Political System (COMPLETE)
- [x] PolitburoSystem — full ministry/politburo lifecycle (10 ministries, 8 archetypes)
- [x] PoliticalEntitySystem — politruks, KGB agents, military as game objects
- [x] Wired into SimulationEngine tick loop

### Economy System (COMPLETE)
- [x] EconomySystem — trudodni, fondy, blat, rations, MTS, stakhanovites, heating, currency reforms
- [x] Storage & spoilage — overflow decay + baseline spoilage
- [x] Difficulty multipliers — full set (worker/comrade/tovarish)
- [x] Quota escalation — era-based curve

### Era & Campaign System (COMPLETE)
- [x] 8 Era definitions with year boundaries, modifiers, doctrine
- [x] Era transitions with 10-tick modifier blending
- [x] Per-era victory/failure conditions with grace period
- [x] Construction method progression (manual → mechanized → industrial → decaying)
- [x] Checkpoint system for era restart

### Worker System (COMPLETE)
- [x] Worker entities in ECS with CitizenComponent
- [x] Worker morale/loyalty/skill hidden stats, vodka dependency
- [x] 6 citizen AI classes
- [x] Behavioral governor — 5-level priority stack (survive → state → trudodni → improve → private)
- [x] CollectiveFocus player control via DrawerPanel
- [x] Worker tap interaction — WorkerInfoPanel with stat bars
- [x] Worker assignment flow — tap-to-assign with ESC cancel

### Construction Phases (COMPLETE)
- [x] ConstructionPhase type ('foundation' | 'building' | 'complete')
- [x] constructionProgress, constructionTicks integer counter fields
- [x] placeNewBuilding() factory — starts at 'foundation' phase
- [x] constructionSystem.ts — ticks progress, phase transitions at 50%/100%
- [x] Material deduction per construction tick (perTickCost/hasSufficientMaterials)
- [x] Era construction time multiplier (eraTimeMult)
- [x] Weather construction time multiplier (weatherTimeMult)
- [x] Construction progress bar UI on building sprites
- [x] operationalBuildings / underConstruction archetypes

### Demographics & Household System (COMPLETE)
- [x] DvorComponent (household) ECS entity with members, surname, loyalty
- [x] DvorMember sub-entities — gender, age, role, labor capacity
- [x] Starting settlement: difficulty-scaled dvory with proper Russian naming
- [x] `createStartingSettlement()` called from GameWorld.tsx on game start
- [x] Demographic tick: births, deaths, aging (wired in SimulationEngine)
- [x] Population breakdown in gameStore snapshot (dvorCount, avgMorale, avgLoyalty, assigned/idle)

### Plan Mandates (COMPLETE)
- [x] `PlanMandates.ts` — era templates, difficulty scaling, fulfillment tracking
- [x] Wired into SimulationEngine (state field, serialize, deserialize)
- [x] Initial mandates generated at game start from era + difficulty
- [x] New mandates generated on era transition
- [x] Building placement → mandate fulfillment tracking (via onBuildingPlaced callback)
- [x] Building Mandates section in FiveYearPlanModal

### Game Systems (ALL COMPLETE)
- [x] PersonnelFile — black marks, commendations, threat levels, arrest mechanic
- [x] CompulsoryDeliveries — doctrine-based state extraction
- [x] SettlementSystem — selo → posyolok → PGT → gorod evolution
- [x] Game speed 1x/2x/3x via gameStore
- [x] Annual Report (pripiski) — falsification mechanic at quota deadlines

### Scoring & Achievements (COMPLETE)
- [x] ScoringSystem — 3 difficulties × 3 consequences
- [x] 12 satirical Soviet medals
- [x] AchievementTracker — 28+ achievements
- [x] GameTally — end-game summary

### Minigames (COMPLETE)
- [x] MinigameRouter — building/event tap routing with auto-resolve
- [x] 8 minigame definitions

### NPC Dialogue (COMPLETE)
- [x] 7 dialogue pools with context-sensitive selection
- [x] Dark sardonic MASH-style humor

### Tutorial (COMPLETE)
- [x] TutorialSystem with 14 milestones
- [x] Comrade Krupnik named advisor

### Events & Narrative (COMPLETE)
- [x] 50+ event templates, weighted random selection with conditions/cooldowns
- [x] PravdaSystem — 145K+ unique headlines
- [x] Event severity → toast mapping

### UI (React 19 + Tailwind CSS 4) — COMPLETE
- [x] LandingPage → NewGameFlow → AssignmentLetter → Game flow
- [x] SovietHUD — settlement tier, date, resources, pause, speed, hamburger
- [x] DrawerPanel — save/load, audio, collective focus, population registry, alerts, personnel
- [x] BottomStrip — Pravda ticker + role/title
- [x] Radial Build Menu — SVG pie menu with era gating (getAvailableBuildingsForYear)
- [x] SovietToastStack — severity-based notifications
- [x] SettlementUpgradeModal, FiveYearPlanModal (with mandates), AnnualReportModal, GameOverModal
- [x] EraTransitionModal, MinigameModal, GameTallyScreen (wired via SimCallbacks)
- [x] CRT overlay + scanline effects

### Audio (COMPLETE)
- [x] AudioManager with music, SFX, ambient categories
- [x] Era-specific music switching, season-based ambient sounds
- [x] Volume controls + mute toggle in DrawerPanel

### Save/Load (COMPLETE)
- [x] Full subsystem serialize/deserialize (10+ subsystems including mandates)
- [x] DrawerPanel has save/load/export/import buttons
- [x] Autosave every 60s
- [x] sql.js WASM backend with localStorage fallback

### Infrastructure
- [x] Vite 7 + TypeScript 5.9 strict mode + Biome
- [x] **2042 unit tests** passing across 62 test files (Vitest + happy-dom)
- [x] GitHub Actions CI + GitHub Pages auto-deploy
- [x] Asset URLs use `import.meta.env.BASE_URL` for subdirectory deployments

## What's Left to Build

### Polish & Enhancement
- [ ] PWA manifest + service worker
- [ ] Medal ceremony animations in GameOverModal
- [ ] Color-blind accessibility mode
- [ ] Notification log spatial panning
- [ ] Consumer goods marketplace UI
- [ ] Mining Expedition minigame (8th type)
- [ ] Transport infrastructure (dirt paths, road depot, rail depot, motor pool)

### Design Doc Gaps (cosmetic/edge-case)
- [ ] Blat KGB risk mechanic (design spec: 2% arrest risk per point above threshold)
- [ ] Overstaffing diminishing returns
- [ ] Cold storage reduced spoilage
- [ ] Gender-aware labor categories (women lower trudodni tier)
- [ ] Disease system for demographic ticks
- [ ] Citizen Dossier modal (tap on citizen → full page)
- [ ] Radial INSPECT/HOUSEHOLD context menus (currently only BUILD context)

## Test & Build Status
- **2144 tests passing, 67 test files** (+102 tests, +5 files from playtest fix session)
- Typecheck clean (tsc --noEmit)
- Production build succeeds (897 KB main JS, 261 KB gzip)
- Biome 100% clean (308 files, 0 errors, 0 warnings)
- 6 monolithic files decomposed into focused sub-modules

## Known Issues
- Audio files ~100MB, not included in deploy (need `pnpm download:audio`)
- Visual regression E2E tests skipped on CI (no Linux baselines)
- `noNonNullAssertion` is off — `!` assertions may hide bugs

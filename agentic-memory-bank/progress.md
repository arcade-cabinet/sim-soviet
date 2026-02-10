# Progress — SimSoviet 2000

## What Works

### Core Game Loop
- [x] 30x30 isometric grid with Canvas 2D rendering
- [x] Building placement (31 building types via radial pie menu)
- [x] Resource system (rubles, food, vodka, power, population + trudodni, blat, timber, steel, cement, prefab, seedFund, emergencyReserve, storageCapacity)
- [x] SimulationEngine ticks every 1s — 13-step tick loop with all subsystems
- [x] Power system — buildings require power, coal plants generate it
- [x] 5-Year Plan quota system with food → vodka progression + era escalation

### ECS Architecture (UNIFIED — GameState eliminated)
- [x] **ECS is the single source of truth** — no more dual authority
- [x] `GameGrid` — spatial index for configurable grid (20/30/50)
- [x] `GameMeta` — ECS component for date, quota, leader, settlement, personnel, gameOver
- [x] `GameView` — read-only snapshot for event/headline lambdas
- [x] `createSnapshot()` in gameStore reads ECS directly
- [x] All systems write ECS directly — no syncEcsToGameState
- [x] PolitburoSystem writes resources directly (no delta-capture hack)

### Canvas 2D Rendering (COMPLETE — BabylonJS removed)
- [x] `Canvas2DRenderer.ts` — 6-layer renderer (ground, grid, buildings, hover, preview, particles)
- [x] `Camera2D.ts` — pan/zoom with DPR-aware canvas sizing + edge clamping
- [x] `GridMath.ts` — isometric grid-to-screen projection (TILE_WIDTH=80, TILE_HEIGHT=40)
- [x] `SpriteLoader.ts` — manifest-driven sprite loading, 31 building PNGs preloaded in parallel
- [x] `CanvasGestureManager.ts` — tap/pan/pinch/scroll-zoom + drag-to-place
- [x] `ParticleSystem2D.ts` — snow/rain particle effects in screen-space
- [x] `BuildingFootprints.ts` — type→sprite mapping + grid footprint sizes
- [x] `GroundRenderer.ts` — seasonal ground colors
- [x] Depth-sorted building rendering (back-to-front by gridX+gridY)

### Sprite Pipeline (COMPLETE)
- [x] `render_sprites.py` — Blender-to-PNG baking, 31 buildings, PPU=80
- [x] `render_hex_tiles.py` — 138 hex terrain tiles, 3 seasons (winter/mud/summer)
- [x] `generate_building_defs.ts` → `buildingDefs.generated.json` with Zod validation

### Seeded Randomness (COMPLETE)
- [x] `SeedSystem.ts` — GameRng class wrapping seedrandom library
- [x] All Math.random() calls replaced with seeded RNG across 10 files

### Political System (COMPLETE)
- [x] PolitburoSystem (2,196 lines) — full ministry/politburo lifecycle
- [x] 10 ministries, 8 personality archetypes, 8x10 interaction matrix
- [x] Coup/purge mechanics, inter-ministry tension system
- [x] 30+ ministry event templates
- [x] PoliticalEntitySystem — politruks, KGB agents, military entities as game objects
- [x] Wired into SimulationEngine.tick() — events, modifiers, leader sync

### Economy System (COMPLETE)
- [x] EconomySystem orchestrator with era-mapped subsystems
- [x] Trudodni (labor units) — work contribution tracking
- [x] Fondy (state allocations) — material deliveries from central planning
- [x] Blat (connections) — hidden economy currency
- [x] Ration cards — tiered food distribution
- [x] MTS system — machine-tractor stations for farm bonuses
- [x] Stakhanovites — random quota-exceeding worker events
- [x] Heating progression — pechka → district heating → crumbling infra
- [x] Production chains — multi-step (grain→flour→bread, grain→vodka)
- [x] Currency reforms — era-triggered denomination changes
- [x] Storage & spoilage — overflow decay + baseline spoilage
- [x] Difficulty multipliers — full set (worker/comrade/tovarish)
- [x] Quota escalation — era-based curve

### Era & Campaign System (COMPLETE)
- [x] 8 Era definitions with year boundaries, modifiers, doctrine
- [x] Era transitions with 10-tick modifier blending
- [x] Era-specific building unlocks (cumulative)
- [x] Per-era victory/failure conditions with grace period
- [x] Construction method progression (manual → mechanized → industrial → decaying)
- [x] Checkpoint system for era restart

### Worker System (COMPLETE)
- [x] Worker entities in ECS with CitizenComponent
- [x] Worker morale/loyalty/skill hidden stats
- [x] Vodka dependency per-worker
- [x] 6 citizen AI classes
- [x] Population dynamics — birth/death/defection lifecycle
- [x] Worker sprites — Canvas2D citizen layer with class-colored dots
- [x] Worker tap interaction — WorkerInfoPanel with stat bars
- [x] Worker assignment flow — tap-to-assign with ESC cancel
- [x] WorkerSystem wired into SimulationEngine tick loop

### Game Systems (ALL COMPLETE)
- [x] PersonnelFile — black marks, commendations, threat levels, arrest mechanic (56 tests)
- [x] CompulsoryDeliveries — doctrine-based state extraction of production (48 tests)
- [x] SettlementSystem — selo → posyolok → PGT → gorod evolution (28 tests)
- [x] Game speed 1x/2x/3x via gameStore
- [x] Annual Report (pripiski) — falsification mechanic at quota deadlines
- [x] All systems wired into SimulationEngine.tick() (13-step tick loop + economy, era, political)

### Scoring & Achievements (COMPLETE)
- [x] ScoringSystem — 3 difficulties × 3 consequences = 9 multiplier combos
- [x] 12 satirical Soviet medals
- [x] AchievementTracker — 28+ achievements
- [x] GameTally — end-game summary screen data

### Minigames (COMPLETE)
- [x] MinigameRouter — building/event tap routing with auto-resolve fallback
- [x] 8 minigame definitions (Queue, Ideology, Inspection, Conscription, Black Market, Factory, Hunt, Interrogation)

### NPC Dialogue (COMPLETE)
- [x] 7 dialogue pools with context-sensitive selection
- [x] Dark sardonic MASH-style humor (survival coping)

### Tutorial (COMPLETE)
- [x] TutorialSystem with 14 milestones
- [x] Comrade Krupnik named advisor

### Events & Narrative
- [x] 50+ event templates across 5 categories + era-specific templates
- [x] Weighted random selection with conditions and cooldowns
- [x] PravdaSystem — 61 generators, 6 weighted categories, 145K+ unique headlines
- [x] Event severity → toast mapping (catastrophic→evacuation, major→critical)

### UI (React 19 + Tailwind CSS 4)
- [x] LandingPage → NewGameFlow → AssignmentLetter → Game flow
- [x] SovietHUD — settlement tier, date, resources, pause, speed, hamburger
- [x] DrawerPanel — slide-out command panel with game data
- [x] BottomStrip — Pravda ticker + role/title
- [x] Radial Build Menu — SVG pie menu (category ring → building ring)
- [x] SovietToastStack — severity-based notifications
- [x] SettlementUpgradeModal — parchment decree for tier transitions
- [x] FiveYearPlanModal — quota directive with production table
- [x] AnnualReportModal — pripiski falsification mechanic
- [x] CRT overlay + scanline effects

### Audio (COMPLETE)
- [x] AudioManager with music, SFX, ambient categories
- [x] 40+ Soviet-era music tracks (OGG/Opus)
- [x] Procedural SFX via Tone.js
- [x] Era-specific music switching via AudioManager.setEra()
- [x] Season-based ambient sounds (winter wind, spring rain)
- [x] Volume controls wired into DrawerPanel
- [ ] Audio files not included in deploy (need `pnpm download:audio`)

### Infrastructure
- [x] Vite 7 + TypeScript 5.9 strict mode + Biome
- [x] **1812 unit tests** passing across 53 test files (Vitest + happy-dom)
- [x] **139 E2E tests** passing (Playwright)
- [x] GitHub Actions CI + GitHub Pages auto-deploy
- [x] Asset URLs use `import.meta.env.BASE_URL` for subdirectory deployments

## What's Left to Build

### High Priority
- [ ] sql.js WASM persistence (save/load .db, IndexedDB, autosave) — UI wired, backend pending
- [x] ~~Wire all new subsystem state into SaveSystem serialization/deserialization~~ — DONE (all 11 subsystems serialize/deserialize, backward-compatible)
- [x] ~~Save/load UI~~ — DONE (DrawerPanel has save/load/export/import buttons)

### Medium Priority
- [ ] PWA manifest + service worker
- [ ] Consumer goods marketplace UI
- [ ] Medal ceremony animations
- [ ] Essential worker designation mechanic

### Low Priority
- [ ] Color-blind accessibility mode
- [ ] Bridge sprite representations
- [ ] Notification log spatial panning
- [ ] SSR/Republic mechanics

## Design Doc Coverage: ~95%
9 design documents with completion metadata frontmatter. All core gameplay systems implemented. Remaining gaps are cosmetic/edge-case UI features.

## Known Issues

- Audio files ~100MB, not deployed to GitHub Pages
- Visual regression E2E tests skipped on CI (no Linux baselines)
- `noNonNullAssertion` is off — `!` assertions may hide bugs
- ~~33 pre-existing Biome lint warnings~~ — FIXED (0 lint errors)
- ~~EventSystem uses wall-clock `Date.now()` for cooldowns~~ — FIXED (already tick-based)

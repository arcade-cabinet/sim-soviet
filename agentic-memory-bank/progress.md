# Progress — SimSoviet 2000

## What Works

### Core Game Loop
- [x] 30x30 isometric grid with Canvas 2D rendering
- [x] Building placement (31 building types via radial pie menu)
- [x] Resource system (rubles, food, vodka, power, population)
- [x] SimulationEngine ticks every 1s — resource production, consumption, population growth
- [x] Power system — buildings require power, coal plants generate it
- [x] 5-Year Plan quota system with food → vodka progression

### ECS Architecture (UNIFIED — GameState eliminated)
- [x] **ECS is the single source of truth** — no more dual authority
- [x] `GameGrid` — spatial index for 30×30 grid (occupancy only)
- [x] `GameMeta` — ECS component for date, quota, leader, settlement, personnel, gameOver
- [x] `GameView` — read-only snapshot for event/headline lambdas
- [x] `createSnapshot()` in gameStore reads ECS directly
- [x] All systems write ECS directly — no syncEcsToGameState
- [x] PolitburoSystem writes resources directly (no delta-capture hack)
- [x] 897 unit tests passing after migration

### Canvas 2D Rendering (COMPLETE — BabylonJS removed)
- [x] `Canvas2DRenderer.ts` — 6-layer renderer (ground, grid, buildings, hover, preview, particles)
- [x] `Camera2D.ts` — pan/zoom with DPR-aware canvas sizing
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
- [x] Wired into SimulationEngine.tick() — events, modifiers, leader sync

### Game Systems (ALL COMPLETE)
- [x] PersonnelFile — black marks, commendations, threat levels, arrest mechanic (56 tests)
- [x] CompulsoryDeliveries — doctrine-based state extraction of production (48 tests)
- [x] SettlementSystem — selo → posyolok → PGT → gorod evolution (28 tests)
- [x] Game speed 1x/2x/3x via gameStore
- [x] Annual Report (pripiski) — falsification mechanic at quota deadlines
- [x] All systems wired into SimulationEngine.tick() (13-step tick loop)

### Events & Narrative
- [x] 50+ event templates across 5 categories
- [x] Weighted random selection with conditions and cooldowns
- [x] PravdaSystem — 61 generators, 6 weighted categories, 145K+ unique headlines
- [x] Event severity → toast mapping (catastrophic→evacuation, major→critical)

### UI (React 19 + Tailwind CSS 4)
- [x] SovietHUD — settlement tier, date, resources, pause, speed, hamburger
- [x] DrawerPanel — slide-out command panel with game data
- [x] BottomStrip — Pravda ticker + role/title
- [x] Radial Build Menu — SVG pie menu (category ring → building ring)
- [x] SovietToastStack — severity-based notifications
- [x] SettlementUpgradeModal — parchment decree for tier transitions
- [x] FiveYearPlanModal — quota directive with production table
- [x] AnnualReportModal — pripiski falsification mechanic
- [x] CRT overlay + scanline effects

### Audio
- [x] AudioManager with music, SFX, ambient categories
- [x] 40+ Soviet-era music tracks (OGG/Opus)
- [x] Procedural SFX via Tone.js
- [ ] Audio files not included in deploy (need `pnpm download:audio`)

### Infrastructure
- [x] Vite 7 + TypeScript 5.9 strict mode + Biome
- [x] **897 unit tests** passing (Vitest + happy-dom)
- [x] **139 E2E tests** passing (Playwright)
- [x] GitHub Actions CI + GitHub Pages auto-deploy
- [x] Asset URLs use `import.meta.env.BASE_URL` for subdirectory deployments

## What's Left to Build

### High Priority
- [ ] Save/load UI
- [ ] sql.js WASM persistence (save/load .db, IndexedDB)
- [ ] Main menu (New Game/Continue/Load), difficulty selection

### Medium Priority
- [ ] Dynamic music selection based on game mood
- [ ] Citizen AI system
- [ ] PWA manifest + service worker

### Low Priority
- [ ] SSR/Republic mechanics
- [ ] Achievements/medals
- [ ] Ambient audio
- [ ] Tutorial
- [ ] Settings UI

## Known Issues

- Audio files ~100MB, not deployed to GitHub Pages
- EventSystem uses wall-clock `Date.now()` for cooldowns (should switch to tick-based)
- Visual regression E2E tests skipped on CI (no Linux baselines)
- `noNonNullAssertion` is off — `!` assertions may hide bugs
- 33 pre-existing Biome lint warnings (prototype `any` types, button types, complexity)

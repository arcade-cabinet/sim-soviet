# Progress — SimSoviet 2000

## What Works

### Core Game Loop
- [x] 30x30 isometric grid with Canvas 2D rendering
- [x] Building placement (31 building types across 9 toolbar categories)
- [x] Resource system (rubles, food, vodka, power, population)
- [x] SimulationEngine ticks every 1s — resource production, consumption, population growth
- [x] Power system — buildings require power, coal plants generate it
- [x] 5-Year Plan quota system with food → vodka progression

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
- [x] Sprite anchor system for correct building positioning
- [x] Unpowered building flicker effect
- [x] Placement preview (green/red ghost sprite)

### Sprite Pipeline (COMPLETE)
- [x] `render_sprites.py` — Blender-to-PNG baking, 31 buildings, PPU=80
- [x] `render_hex_tiles.py` — 138 hex terrain tiles, 3 seasons (winter/mud/summer)
- [x] `generate_building_defs.ts` → `buildingDefs.generated.json` with Zod validation
- [x] Anchor calculation: projected tile base center, auto-crop with numpy
- [x] Footprint from model_size via `Math.round()` (not ceil — models have slight overhangs)

### Seeded Randomness (Phase 1 Complete)
- [x] `SeedSystem.ts` — GameRng class wrapping seedrandom library
- [x] Soviet-themed seed phrases: 60 adjectives × 60 nouns = 216K combos
- [x] All Math.random() calls replaced with seeded RNG across 10 files
- [x] Module-level `_rng` pattern for systems with many generator functions

### Chronology Data Layer (Phase 2 Partial)
- [x] `Chronology.ts` — GameDate interface, Season enum, 7 season profiles, day/night phases
- [x] `WeatherSystem.ts` — 9 weather types, per-season probability tables
- [x] `ChronologySystem.ts` — Tick advancement, season/weather resolution, serialize/deserialize
- [x] ChronologySystem integrated into SimulationEngine (Phase 3 — already was)
- [x] Day/night overlay, seasonal rendering, weather particles (Phase 4 — already was)

### Political System
- [x] PolitburoSystem (2,196 lines) — full ministry/politburo lifecycle
- [x] 10 ministries, 8 personality archetypes, 8x10 interaction matrix
- [x] Coup/purge mechanics, inter-ministry tension system
- [x] 30+ ministry event templates
- [x] **Wired into SimulationEngine.tick()** — events, modifiers, leader sync

### Events & Narrative
- [x] 50+ event templates across 5 categories (disaster, political, economic, cultural, absurdist)
- [x] Weighted random selection with conditions and cooldowns (seeded)
- [x] PravdaSystem — 61 generators, 6 weighted categories, 145K+ unique headlines
- [x] Event-reactive spin (catastrophe → distraction, bad → 35% distraction, good → amplification)
- [x] Toast notifications + Advisor panel

### Content Generation
- [x] NameGenerator (1,108 lines) — 1.1M+ male + 567K female name combinations
- [x] WorldBuilding module — 36 timeline events, 36 radio announcements, 42 loading quotes, 31 achievements

### UI (React 19 + Tailwind CSS 4)
- [x] TopBar with resource display
- [x] Toolbar with 31 building types across 9 categories (Housing, Industry, Power, Services, Govt, Military, Infra + Inspect + Purge)
- [x] QuotaHUD showing 5-year plan progress
- [x] IntroModal with game start flow ("MINISTRY OF PLANNING")
- [x] PravdaTicker scrolling satirical headlines
- [x] Advisor panel (Comrade Vanya)
- [x] CRT overlay + scanline effects
- [x] Responsive layout (useResponsive hook)

### Audio
- [x] AudioManager with music, SFX, ambient categories
- [x] 40+ Soviet-era music tracks (OGG/Opus)
- [x] Procedural SFX via Tone.js
- [x] Volume controls per category
- [ ] Audio files not included in deploy (need `pnpm download:audio`)

### Infrastructure
- [x] Vite 7 + TypeScript 5.9 strict mode + Biome
- [x] **798 unit tests** passing (Vitest + happy-dom)
- [x] **139 E2E tests** passing (Playwright — Desktop Chrome, iPhone SE, Pixel 8a, iPad)
- [x] GitHub Actions CI (Quality Checks + E2E Tests + Mobile CI + CodeQL + CodeRabbit + SonarCloud)
- [x] GitHub Pages auto-deploy on merge to main
- [x] `src/vite-env.d.ts` for Vite client type definitions
- [x] Asset URLs use `import.meta.env.BASE_URL` for subdirectory deployments

### ECS Foundation (present but unused)
- [x] Miniplex world with Entity interface
- [x] Systems: power, production, consumption, population, decay, quota
- [ ] **Not driving SimulationEngine** — GameState is the runtime authority

## What's Left to Build

### Overhaul Plan (Pending Phases)
- [ ] **Phase 3**: Wire ChronologySystem into SimulationEngine, seasonal modifiers, tick-based cooldowns
- [ ] **Phase 4**: Day/night overlay, controllable weather, seasonal ground colors from chronology
- [ ] **Phase 5**: sql.js WASM persistence (save/load .db, IndexedDB continue)
- [ ] **Phase 6**: Main menu (New Game/Continue/Load), difficulty selection

### High Priority
- [x] Wire PolitburoSystem into SimulationEngine.tick() — **DONE**
- [x] Multi-cell building placement — **DONE** (drag-to-place with footprints)
- [x] Victory/loss conditions — **DONE** (quota failures + population wipe + year 1995)
- [ ] Save/load UI
- [ ] Resolve ECS vs GameState duality (plan says remove dead ECS)

### Medium Priority
- [x] Building inspector panel — **DONE** (click building to see stats)
- [x] Pause menu + keyboard shortcuts — **DONE** (Space, Escape, B)
- [ ] Dynamic music selection based on game mood
- [ ] Citizen AI system
- [ ] PWA manifest + service worker

### Low Priority
- [ ] SSR/Republic mechanics
- [ ] Achievements/medals
- [ ] Ambient audio (wind, machinery, radio static)
- [ ] Tutorial beyond initial advisor message
- [ ] Settings UI

## Known Issues

- ECS and GameState are parallel systems that haven't been unified
- ~~PolitburoSystem exists but not integrated into game loop~~ **RESOLVED**
- ~~PolitburoSystem corruption drain overwrites by syncEcsToGameState~~ **RESOLVED** (delta synced to ECS)
- ~~PolitburoSystem event effects not applied to resources~~ **RESOLVED** (wrapper handler applies effects)
- ~~ChronologySystem exists but not integrated into game loop~~ **RESOLVED** (was already integrated)
- Audio files ~100MB, not deployed to GitHub Pages
- EventSystem uses wall-clock `Date.now()` for cooldowns (should switch to tick-based)
- Visual regression E2E tests skipped on CI (no Linux baselines)
- `noNonNullAssertion` is off — `!` assertions may hide bugs

## Decision Evolution

1. **Imperative → React**: Vanilla TS entry → React 19 with Reactylon → Canvas 2D + React DOM overlays
2. **BabylonJS → Canvas 2D**: 4MB bundle → 808KB bundle (288KB before PolitburoSystem). Pre-baked isometric sprites via Blender pipeline.
3. **InputManager → GestureManager → CanvasGestureManager**: Touch-friendly state machine for tap vs pan vs pinch
4. **Direct state → useSyncExternalStore**: Mutable GameState + immutable snapshots for React
5. **Hardcoded `/` paths → `import.meta.env.BASE_URL`**: Required for GitHub Pages `/sim-soviet/` subdirectory deployment
6. **Seeded RNG**: All Math.random() replaced via seedrandom + module-level `_rng` pattern
7. **Chronology data layer**: 7 Russian seasons, 9 weather types, Soviet dekada calendar
8. **31-type toolbar**: Replaced legacy 6-type BUILDING_TYPES with generated buildingDefs categories

# Progress — SimSoviet 2000

## What Works

### Core Game Loop
- [x] 30x30 isometric grid with BabylonJS rendering
- [x] Building placement (6 types + road + bulldoze)
- [x] Resource system (rubles, food, vodka, power, population)
- [x] SimulationEngine ticks every 1s — resource production, consumption, population growth
- [x] Power system — buildings require power, coal plants generate it
- [x] 5-Year Plan quota system with food → vodka progression

### Seeded Randomness (NEW — Phase 1 Complete)
- [x] `SeedSystem.ts` — GameRng class wrapping seedrandom library
- [x] Soviet-themed seed phrases: 60 adjectives × 60 nouns = 216K combos
- [x] GameRng methods: random(), int(), pick(), pickIndex(), coinFlip(), shuffle(), weightedIndex(), id()
- [x] All Math.random() calls replaced with seeded RNG across 10 files
- [x] Module-level `_rng` pattern for systems with many generator functions
- [x] `seed` field added to GameState and GameSnapshot
- [x] GameWorld.tsx creates GameRng from seed and passes to SimulationEngine

### Chronology Data Layer (NEW — Phase 2 Partial)
- [x] `Chronology.ts` — GameDate interface, Season enum, 7 season profiles, day/night phases
- [x] `WeatherSystem.ts` — 9 weather types, per-season probability tables, weather rolling
- [x] `ChronologySystem.ts` — Tick advancement, season/weather resolution, serialize/deserialize
- [ ] **Not yet integrated into SimulationEngine** (Phase 3)
- [ ] **Not yet rendering** (Phase 4)

### Political System
- [x] PolitburoSystem (2,196 lines) — full ministry/politburo lifecycle
- [x] 10 ministries: KGB, Agriculture, Heavy Industry, Culture, Defense, MVD, Gosplan, Health, Education, Transport
- [x] 8 personality archetypes: zealot, idealist, reformer, technocrat, apparatchik, populist, militarist, mystic
- [x] 8x10 personality × ministry interaction matrix with satirical commentary
- [x] Inter-ministry tension system (12 tension rules, conflict/alliance events)
- [x] Coup probability engine (ambition × disloyalty + KGB bonus + faction bonus)
- [x] Purge mechanics (paranoia × disloyalty + corruption risk)
- [x] 30+ ministry event templates
- [x] Appointment strategies per leader type
- [x] KGB Chairman special survival logic ("knows too much")
- [ ] **Not yet wired into SimulationEngine.tick()**

### Events & Narrative
- [x] 50+ event templates across 5 categories (disaster, political, economic, cultural, absurdist)
- [x] Weighted random selection with conditions and cooldowns (now seeded)
- [x] Dynamic text generation using GameState
- [x] PravdaSystem rewritten (1,460 lines) — 61 generators, 6 weighted categories, 145K+ unique headlines
- [x] Contextual generators (13 state-reactive conditions)
- [x] Event-reactive spin (catastrophe → distraction, bad → 35% distraction, good → amplification)
- [x] Anti-repetition (6-entry ring buffer, 45s cooldown)
- [x] Toast notifications for urgent alerts
- [x] Advisor panel for event details

### Content Generation
- [x] NameGenerator (1,108 lines) — 1.1M+ male + 567K female name combinations
- [x] 3-part Russian naming (given + patronymic + surname) with gender-aware forms
- [x] 85 titles across 6 categories, 80 satirical epithets
- [x] WorldBuilding module — 36 timeline events, 36 radio announcements, 42 loading quotes, 31 achievements
- [x] City naming system (66 components)

### UI
- [x] React 19 component tree with DOM overlays on BabylonJS canvas
- [x] TopBar with resource display
- [x] Toolbar with building selection
- [x] QuotaHUD showing 5-year plan progress
- [x] IntroModal with game start flow
- [x] PravdaTicker scrolling headlines
- [x] CRT overlay + scanline effects
- [x] Responsive layout (useResponsive hook)

### Input
- [x] GestureManager state machine (tap vs pan vs pinch)
- [x] Desktop hover highlighting
- [x] Touch-friendly camera controls (ArcRotateCamera with limits)

### Audio
- [x] AudioManager with music, SFX, ambient categories
- [x] 40+ Soviet-era music tracks (OGG/Opus from marxists.org)
- [x] Mood-tagged tracks for context-sensitive selection
- [x] Procedural SFX via Tone.js (build, destroy, notification, coin)
- [x] Volume controls per category + master + mute toggle

### Infrastructure
- [x] Vite 7 build with Tailwind CSS 4
- [x] TypeScript strict mode
- [x] Biome linting and formatting
- [x] Unit tests (Vitest + happy-dom) — 235 tests passing
- [x] E2E tests (Playwright — Desktop Chrome, iPhone SE, Pixel 8a, iPad)
- [x] GitHub Actions CI (lint → typecheck → test → build)
- [x] GitHub Pages auto-deploy on merge to main
- [x] Mobile CI — Android debug APK build
- [x] Design system tokens (colors, typography, spacing, z-index)

### ECS Foundation
- [x] Miniplex world with Entity interface (7 components + 4 tags)
- [x] Archetypes for buildings, citizens, tiles, resources
- [x] Systems: power, production, consumption, population, decay, quota
- [x] Entity factories
- [x] React bindings (ECS.Entity, ECS.Entities, etc.)

### Documentation (3,891 lines total)
- [x] `docs/README.md` — Index of all 10 design documents with reading order
- [x] `docs/design-leadership-architecture.md` — ECS component design, modifier pipeline, phased implementation plan
- [x] `docs/design-era-doctrines.md` — 8 composable policy modifier sets
- [x] `docs/design-leader-archetypes.md` (926 lines) — 11 archetypes with profiles, succession matrix, purge chains
- [x] `docs/design-power-transitions.md` (847 lines) — 7 transition types, probability engine, state machine
- [x] `docs/design-dialog-bible.md` (472 lines) — Trilingual voice guide, advisor messages, leader decrees, citizen complaints
- [x] `docs/reference-pravda-system.md` (436 lines) — Generator categories, word pools, spin doctor, anti-repetition
- [x] `docs/reference-name-generator.md` (354 lines) — Russian naming system, API reference, combinatorial capacity
- [x] `docs/reference-world-building.md` (344 lines) — Timeline, radio, achievements, city naming
- [x] `docs/research-yuka-ai.md` — Yuka AI capabilities mapping
- [x] `docs/AUDIO_ASSETS.md` — 40+ track inventory
- [x] Root `README.md` — Comprehensive public-facing README

## What's Left to Build

### Overhaul Plan (In Progress)
- [ ] **Phase 3**: Wire ChronologySystem into SimulationEngine, seasonal modifiers, heating costs, tick-based cooldowns
- [ ] **Phase 4**: DayLightController, controllable snow/rain, seasonal ground colors, TopBar date display
- [ ] **Phase 5**: sql.js WASM persistence (save/load .db, IndexedDB continue)
- [ ] **Phase 6**: Main menu (New Game/Continue/Load), difficulty selection (COMRADE/PARTY/GULAG)

### High Priority
- [ ] Wire PolitburoSystem into SimulationEngine.tick()
- [ ] Connect PolitburoSystem modifiers to resource systems
- [ ] Build leadership UI (leader portrait, ministry panel, political events display)
- [ ] Wire ECS systems into SimulationEngine (currently uses direct GameState)
- [ ] Save/load UI (needs sql.js persistence from Phase 5)

### Medium Priority
- [ ] 3D building models (replace procedural BabylonJS meshes with GLB models)
- [ ] Citizen AI via Yuka (behavioral agents for workers, officials, etc.)
- [ ] Resource trend indicators in TopBar (arrows showing up/down)
- [ ] Building upgrade/repair mechanics (Durability component exists)
- [ ] More building types (school, hospital, barracks, etc.)
- [ ] Dynamic music selection based on game mood/events

### Low Priority
- [ ] SSR/Republic mechanics (anthems are loaded, gameplay TBD)
- [ ] Achievements/medals system (data exists in WorldBuilding.ts)
- [ ] Sound: ambient wind, machinery, radio static (declared in manifest, not wired)
- [ ] Tutorial flow beyond initial advisor message
- [ ] Settings UI (volume sliders, graphics options)

## Known Issues

- ECS and GameState are parallel systems that haven't been unified
- PolitburoSystem exists but not integrated into game loop
- Chronology data layer exists but not integrated into game loop
- Reactylon v3.5 requires XR stub workaround in vite.config.ts
- Audio files are large (~100MB total) and need download script on fresh clone
- `noNonNullAssertion` is off, so `!` assertions are scattered and may hide bugs
- EventSystem uses wall-clock `Date.now()` for cooldowns (should switch to tick-based in Phase 3)
- PravdaSystem also uses wall-clock cooldowns (same)

## Decision Evolution

1. **Imperative → React**: Started with vanilla TS entry point (`main.ts`), migrated to React 19 with Reactylon
2. **InputManager → GestureManager**: Original input fired on pointerdown, broke touch. New state machine distinguishes tap from pan.
3. **Direct state → useSyncExternalStore**: GameState stays mutable for performance, but React components get immutable snapshots
4. **Added ECS alongside GameState**: Miniplex world introduced for future scalability, hasn't replaced imperative GameState loop yet
5. **Pravda rewrite**: 432 lines → 1,460 lines with compositional grammar, contextual generators, event-reactive spin
6. **PolitburoSystem added**: Full ministry/politburo lifecycle with personality × ministry matrix, coup/purge mechanics
7. **Seeded RNG**: All Math.random() replaced with seedrandom via GameRng class + module-level `_rng` pattern
8. **Chronology data layer**: 7 Russian seasons, 9 weather types, Soviet dekada calendar (10-day months), designed for ~6 min/year pacing

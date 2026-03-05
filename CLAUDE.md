# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Agent Navigation

For comprehensive documentation index, see `AGENTS.md` (root) → `docs/AGENTS.md`.
For agentic memory bank, see `memory-bank/AGENTS.md`.

## CRITICAL: Game Identity

**SimSoviet 1917 is NOT a city builder.** The player does NOT place buildings. The player does NOT choose what to build. The player does NOT micromanage workers.

**SimSoviet 1917** is a **Soviet bureaucrat survival sim** set in an alternate-history USSR that never collapses (1917 → eternity). The player is the **predsedatel** (chairman) — a low-level bureaucrat trying to survive the apparatus. The settlement grows **organically** via autonomous agent systems. The **system is the antagonist**, not external threats.

**What the player does:**
- Observes the settlement as it self-organizes
- Responds to state demands (5-year plan mandates dictate WHAT gets built — player only chooses WHERE)
- Sets collective priorities when demands conflict (food vs quotas vs construction)
- Navigates political conversations with commissars, KGB, military
- Makes moral choices (who to sacrifice, corruption, falsifying reports)
- Overrides the collective in emergencies (costs political capital)

**What the player does NOT do:**
- Choose which buildings to build (Moscow mandates them)
- Individually assign workers (the collective self-organizes)
- Draw roads (they form from worker movement)
- Fight anyone directly
- Freely place structures from a toolbar

**The optimal strategy is comfortable mediocrity.** Meeting quotas exactly. Being unremarkable. If citizens are happy, that's suspicious — or they're drunk.

**Design documents:** `docs/GAME_VISION.md`, `docs/GDD-master.md`, `docs/plans/2026-03-03-buildings-are-the-ui-design.md`, `docs/plans/2026-03-03-soviet-allocation-engine-design.md`

## Project Overview

Built with **React Three Fiber** (R3F + Three.js r183 + React Native 0.83.2 + Expo 55).

The `archive/` directory contains the previous 2D Canvas version (SimSoviet 2000) for reference. The current codebase is a full 3D rewrite.

## Commands

```bash
npm install                # Install dependencies
expo start --web           # Dev server (web) → http://localhost:3000
npx react-native run-ios   # Run on iOS simulator
npx react-native run-android  # Run on Android emulator
npm test                   # Jest tests
npm run lint               # Biome lint
```

## Tech Stack

- **3D Engine**: Three.js r183 via React Three Fiber (R3F v9.5) + drei helpers
- **UI**: React Native 0.83.2 + Expo 55 overlay components (absolute-positioned on 3D canvas)
- **State**: ECS world (`SimulationEngine`) + legacy `GameState` singleton, bridged via `useSyncExternalStore`
- **AI**: Yuka-style agent system (9 subpackages, 169 files, 39k+ lines under `src/ai/agents/`)
- **Audio**: Web Audio API via AudioManager (47 Soviet-era public domain OGG tracks)
- **Build**: Expo, Metro bundler, TypeScript 5.9
- **Database**: sql.js (Wasm-based SQLite) + Drizzle ORM, persisted to IndexedDB
- **Models**: 56 GLB models in `assets/models/soviet/` with manifest.json
- **XR**: @react-three/xr v6 (WebXR support for AR/VR)

## Architecture

### Game modes

Two modes, no classic/manual difficulty:
- **Historical** (default) — real Soviet timeline, governor fires crises on historical dates
- **Freeform** — ChaosEngine drives emergent alternate history

Three consequence levels (Soviet nomenclature):
- **Rehabilitated** — transferred, return after 1 year
- **Gulag** — exiled, return after 3 years (default)
- **Rasstrelyat** — shot, game over, no return

### Screen flow

```
MainMenu → NewGameSetup → Loading Screen → IntroModal → Game
```

`App.web.tsx` manages screen state: `'menu' | 'setup' | 'game'`. On web, Expo resolves `.web.tsx` before `.tsx` — **always edit `App.web.tsx` for web changes**.

### Two-layer rendering: R3F 3D Canvas + React Native DOM

`App.web.tsx` hosts both:
1. **3D Viewport** — R3F `<Canvas>` (WebGL2, PCFShadowMap) + `Content.tsx` (composes all scene components via drei/R3F)
2. **React Native overlays** — TopBar, modals, panels, etc.

### Agent architecture (the brain)

```
src/ai/agents/
├── core/          # ChronologyAgent, WeatherAgent, WorldAgent, worldBranches, worldCountries
├── economy/       # EconomyAgent, FoodAgent, StorageAgent, VodkaAgent
├── political/     # PoliticalAgent, KGBAgent, QuotaAgent, LoyaltyAgent, ScoringSystem
├── infrastructure/ # CollectiveAgent, ConstructionAgent, DecayAgent, PowerAgent, SettlementSystem, TransportSystem
├── social/        # DefenseAgent, DemographicAgent
├── workforce/     # WorkerSystem, PrivatePlotSystem, LoyaltySystem, TrudodniSystem
├── narrative/     # NarrativeAgent, EventSystem, Pravda, Politburo
├── meta/          # AchievementTracker, TutorialSystem, ChairmanAgent, minigames
└── crisis/        # Governor, HistoricalGovernor, FreeformGovernor, ChaosEngine
    ├── pressure/  # PressureSystem, PressureCrisisEngine, PressureDomains, thresholds
    ├── ClimateEventSystem, BlackSwanSystem
    └── WarAgent, FamineAgent, DisasterAgent, CrisisImpactApplicator
```

### Engine decomposition

`SimulationEngine.ts` (~966 lines) is a thin orchestrator. The 27-step tick is decomposed into 7 phase modules in `src/game/engine/`:
- `phaseChronology.ts` — era transitions, governor evaluation, crisis impacts
- `phaseProduction.ts` — production modifiers, power, transport, construction
- `phaseConsumption.ts` — storage, economy, deliveries, food/vodka consumption
- `phaseSocial.ts` — disease, demographics, worker ticks
- `phasePolitical.ts` — loyalty, trudodni, decay, settlement, political entities
- `phaseNarrative.ts` — events, pravda, minigames, achievements
- `phaseFinalize.ts` — autopilot, meta sync, loss check

### Dual population modes

- **Entity mode** (pop < 200, early game): Individual citizen + dvor ECS entities
- **Aggregate mode** (pop >= 200, one-way transition): Buildings ARE computational units, RaionPool demographics

### State flow

Two state systems coexist:
1. **ECS world** (`SimulationEngine`) — canonical game state. Systems tick via `useECSGameLoop`.
2. **Legacy `GameState`** (mutable singleton) — still used by 3D scene components.

### Key patterns

- Scene components are declarative R3F JSX: `<mesh>`, `<meshStandardMaterial>`, etc.
- `useFrame()` from R3F for per-frame animation logic
- `useGLTF()` from drei for loading GLB models (preloaded via ModelPreloader)
- UI components use `pointerEvents="box-none"` to pass through touches to the 3D canvas
- Modal/panel components access engine directly via `getEngine()?.getPersonnelFile()` etc.

## Implementation Status

### Core Systems (implemented, tested, 6,606 tests across 275 suites):
- SimulationEngine decomposition (7 phase modules)
- Building-as-Container architecture (dual population modes: entity < 200, aggregate >= 200)
- RNG purge (seeded GameRng everywhere)
- Yuka agent architecture (9 subpackages, 170+ files, 40k+ lines under `src/ai/agents/`)
- Demographics (dvory, births/deaths/aging, gendered labor, conscription)
- Governor/crisis system (historical + freeform modes)
- SettlementSummary + settlement_state DB schema
- Per-building tick, per-tile terrain tick pure functions
- Protected building classes (government/military never demolished)
- Soviet consequence nomenclature (rehabilitated/gulag/rasstrelyat)

### Allocation Engine (all 6 phases complete):
- **Soviet Allocation Engine** — directives, posture, prestige, DB-backed tick, dvory motivation, land grants
- **Dynamic map expansion** — grid starts small, expands via settlement tier upgrades
- **Autonomous collective pipeline** — demand→site-selection→queue→build (CollectiveAgent.tickAutonomous)
- **Government HQ** — 6 agency tabs (Gosplan, Central Committee, KGB, Military, Politburo, Reports)
- **Gosplan allocation sliders** — two-layer distribution (baseline uniform + merit spike)

### Pressure-Valve Crisis System (replaces ChaosEngine):
- **PressureSystem** — 10 domains (food, morale, loyalty, housing, political, power, infrastructure, demographic, health, economic), dual-spread accumulation
- **PressureCrisisEngine** — emergent crises from sustained pressure (minor warnings + major crises)
- **ClimateEventSystem** — seasonal/weather-gated natural events
- **BlackSwanSystem** — truly probabilistic rare events (meteor, earthquake, solar storm, nuclear accident)
- **WorldAgent** — geopolitical context: 14 countries aggregating into 6 spheres, Khaldun/Turchin cycles, governance transitions
- **42 Cold Branches** — dormant divergence points that activate on pressure conditions (WWIII, EU dissolution, planetary deconstruction, FTL discovery, Type V+ transcendence)
- **Ecological collapse timeline** — 9 inevitable events from 2050 permafrost through 100K magnetic field weakening

### 100,000-Year Gameplay (Kardashev sub-eras):
- **8 Kardashev sub-eras** replacing flat "the_eternal": post_soviet (K 0.72) → planetary → solar_engineering → type_one → deconstruction → dyson_swarm → megaearth → type_two_peak (K 2.0)
- **Post-scarcity pressure transformation** — at K >= 1.0, food/housing/power/economic zeroed; replaced by meaning, density, entropy, legacy, ennui
- **Carrying capacity** — K formula drives expansion pressure, breach crises at 0.85K/0.95K
- **Expanded resources** — oxygen, hydrogen, water, rareEarths, uranium, rocketFuel (gated by terrain)

### Multi-Settlement + Expansion:
- **Per-settlement agent tree** — each settlement has independent ECS world, pressure system, building grid
- **Background ticks** — inactive settlements tick with O(1) aggregate math
- **Viewport switching** — settlement selector, fade transitions, keyboard 1-9
- **Cross-settlement quotas** — Moscow's demands span ALL settlements
- **Resource transfer** — distance-based logistics cost (5% base + distance factor)

### Buildings-as-UI (Phase 1-3 complete):
- **HUD stripped** — build toolbar removed, all non-essential overlays removed, TopBar minimized with overflow menu
- **Organic growth** — fertility-aware placement, desire-path roads (traffic → dirt → gravel → paved)
- **Building interaction** — click→panel with production/worker data, health tinting (durability-based color shift)

### Scene + Visuals:
- **WarOverlay** — parameterized for 6 scales (skirmish → stellar), era-specific aesthetics
- **DomeMesh** — procedural translucent R3F domes with Fresnel glass effect, 4 tint profiles
- **Arcology merging** — buildings merge at pop > 50K, dome auto-placement at 500K
- **Adaptive agent matrix** — 10 terrain profiles (earth variants, lunar, martian, venusian, titan, asteroid, orbital, exoplanet)
- **MegaCity law enforcement** — KGB → Security → Sector Judges → Megacity Arbiters, crime rate model, undercity decay, iso-cubes

### Timelines:
- **Space timeline** — 39 milestones (Sputnik → interstellar), 9 settlement-creating
- **World timeline** — 52 milestones (civilizational backbone, Turchin/Khaldun grounded)
- **Historical divergence** — 1991 one-shot modal, freeform continuation
- **Milestone timeline screen** — chronological record of activated milestones

## Assets

- `assets/models/soviet/` — 56 GLB models with `manifest.json` mapping roles
- `assets/audio/music/` — 47 OGG music tracks (Soviet anthems, war songs, folk)
- `archive/` — Previous 2D Canvas codebase + `poc.html` (reference implementation)

## Code Style

- TypeScript strict mode
- React Native `StyleSheet.create` for all styling (no Tailwind)
- Monospace font: Menlo (iOS) / monospace (Android)
- Soviet aesthetic: red (#c62828), gold (#fbc02d), terminal green (#00e676), dark panels (#2a2e33)

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

Built with **React Three Fiber** (R3F + Three.js r183 + React Native 0.81 + Expo 54).

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
- **UI**: React Native 0.81 + Expo 54 overlay components (absolute-positioned on 3D canvas)
- **State**: ECS world (`SimulationEngine`) + legacy `GameState` singleton, bridged via `useSyncExternalStore`
- **AI**: Yuka-style agent system (9 subpackages, 169 files, 39k+ lines under `src/ai/agents/`)
- **Audio**: Web Audio API via AudioManager (47 Soviet-era public domain OGG tracks)
- **Build**: Expo, Metro bundler, TypeScript 5.7
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

`SimulationEngine.ts` (~910 lines) is a thin orchestrator. The 27-step tick is decomposed into 7 phase modules in `src/game/engine/`:
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

### DONE (implemented, tested):
- SimulationEngine decomposition (7 phase modules)
- Building-as-Container architecture (dual population modes)
- RNG purge (seeded GameRng everywhere)
- Yuka agent architecture (9 subpackages)
- Demographics (dvory, births/deaths/aging, gendered labor)
- Governor/crisis system (historical + freeform + ChaosEngine)
- SettlementSummary + settlement_state DB schema
- Per-building tick, per-tile terrain tick pure functions
- Protected building classes (government/military never demolished)
- Classic mode removed, Soviet consequence nomenclature (rehabilitated/gulag/rasstrelyat)

### NOT YET DONE (planned, documented — see docs/plans/):
- **Organic settlement growth** — buildings auto-placed by agent demand pipeline (docs/plans/2026-03-03-buildings-are-the-ui-design.md)
- **Buildings-as-UI** — click buildings for contextual panels, remove build toolbar
- **Soviet Allocation Engine** — DB-backed tick, dvory motivation, land grants, terrain prestige
- **Dynamic map expansion** — grid starts small, expands via settlement tier upgrades
- **Remove direct building placement** — HUD strip, directive-only player control
- **Autonomous collective full pipeline** — demand→site-selection→queue→build

## Assets

- `assets/models/soviet/` — 56 GLB models with `manifest.json` mapping roles
- `assets/audio/music/` — 47 OGG music tracks (Soviet anthems, war songs, folk)
- `archive/` — Previous 2D Canvas codebase + `poc.html` (reference implementation)

## Code Style

- TypeScript strict mode
- React Native `StyleSheet.create` for all styling (no Tailwind)
- Monospace font: Menlo (iOS) / monospace (Android)
- Soviet aesthetic: red (#c62828), gold (#fbc02d), terminal green (#00e676), dark panels (#2a2e33)

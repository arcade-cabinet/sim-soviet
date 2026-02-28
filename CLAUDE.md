# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SimSoviet 1917** is a satirical 3D city-builder game set in the Soviet Union (starting 1917). Players build structures and manage resources (rubles, food, vodka, power, population) against 5-year plan quotas. Built with **React Three Fiber** (R3F + Three.js r183 + React Native).

The `archive/` directory contains the previous 2D Canvas version (SimSoviet 2000) for reference. The current codebase is a full 3D rewrite.

## Commands

```bash
npm install                # Install dependencies
expo start --web           # Dev server (web) → http://localhost:3000
npx react-native run-ios   # Run on iOS simulator
npx react-native run-android  # Run on Android emulator
npm test                   # Jest tests
npm run lint               # ESLint
```

## Tech Stack

- **3D Engine**: Three.js r183 via React Three Fiber (R3F v9.5) + drei helpers
- **UI**: React Native 0.81 + Expo 54 overlay components (absolute-positioned on 3D canvas)
- **State**: ECS world (`SimulationEngine`) + legacy `GameState` singleton, bridged via `useSyncExternalStore`
- **Audio**: Web Audio API via AudioManager (52 Soviet-era public domain OGG tracks)
- **Build**: Expo, Metro bundler, TypeScript 5.7
- **Database**: sql.js (Wasm-based SQLite) + Drizzle ORM, persisted to IndexedDB
- **Models**: 55 GLB models in `assets/models/soviet/` with manifest.json
- **XR**: @react-three/xr v6 (WebXR support for AR/VR)

## Architecture

### Screen flow

```
MainMenu → NewGameSetup → Loading Screen → IntroModal → Game
```

`App.web.tsx` manages screen state: `'menu' | 'setup' | 'game'`. On web, Expo resolves `.web.tsx` before `.tsx` — **always edit `App.web.tsx` for web changes**.

### Two-layer rendering: R3F 3D Canvas + React Native DOM

`App.web.tsx` hosts both:
1. **3D Viewport** — R3F `<Canvas>` (WebGL2, PCFShadowMap) + `Content.tsx` (composes all scene components via drei/R3F)
2. **React Native overlays** — TopBar, Toolbar, QuotaHUD, Toast, Advisor, Ticker, modals, panels, etc.

### Source structure

```
src/
├── engine/        # Pure TypeScript game logic (no rendering)
│   ├── GameState.ts       # Mutable state class with subscribe/notify
│   ├── SimTick.ts         # Core simulation tick (directives, growth, power, smog, fire, population)
│   ├── BuildingTypes.ts   # 16 building types + 4 grown types × 3 levels
│   ├── GridTypes.ts       # 30×30 grid, terrain types, cell interface
│   ├── BuildActions.ts    # Building placement/bulldoze logic
│   ├── WaterNetwork.ts    # BFS water distribution from pumps through pipes
│   ├── WeatherSystem.ts   # Season/weather state machine
│   ├── TrainSystem.ts     # Train movement + supply drops
│   ├── TrafficSystem.ts   # Vehicle movement on roads
│   ├── MeteorSystem.ts    # Meteor descent + crater impact
│   ├── Directives.ts      # 12 sequential tutorial objectives
│   └── helpers.ts         # Toast, advisor, speed, lens, floating text utilities
├── scene/         # R3F/drei 3D components (22 files — declarative JSX + useFrame/useEffect)
│   ├── ModelPreloader.tsx  # useGLTF.preload for all 55 GLBs + DRACOLoader
│   ├── ModelMapping.ts    # Building type → GLB model name mapping
│   ├── TerrainGrid.tsx    # 30×30 merged mesh with vertex colors + tree geometry
│   ├── CameraController.tsx  # OrbitControls-style: pan/zoom/tilt
│   ├── Environment.tsx    # drei Sky, HDRI IBL, PBR ground, perimeter hills
│   ├── Lighting.tsx       # DirectionalLight + HemisphereLight + fog with day/night cycle
│   ├── BuildingRenderer.tsx  # Manages 3D mesh clones from game state
│   ├── WeatherFX.tsx      # Snow/rain/storm particle systems
│   ├── SmogOverlay.tsx    # Per-tile smog visualization
│   ├── FireRenderer.tsx   # Building fire particles + point lights
│   ├── AuraRenderer.tsx   # Propaganda/gulag aura rings
│   ├── LightningRenderer.tsx  # Jagged bolt mesh + screen flash
│   ├── TrainRenderer.tsx  # Animated train on rail with smoke
│   ├── VehicleRenderer.tsx    # Cars on roads
│   ├── ZeppelinRenderer.tsx   # Firefighting airships
│   ├── MeteorRenderer.tsx # Meteor descent + explosion
│   ├── GhostPreview.tsx   # Building placement preview
│   ├── LensSystem.tsx     # Visual lens modes (water/power/smog/aura)
│   ├── FloatingText.tsx   # Billboard text above buildings
│   └── SceneProps.tsx     # Scene-level prop injection
├── ui/            # React Native overlay components (22 files)
│   ├── styles.ts          # Colors, panel styles, monospace font
│   ├── SovietModal.tsx    # Reusable modal (parchment/terminal variants)
│   ├── TopBar.tsx         # Resource bar + calendar + speed + threat indicator + achievements
│   ├── TabBar.tsx         # ZONING/INFRASTRUCTURE/STATE/PURGE tabs
│   ├── Toolbar.tsx        # Building tool buttons
│   ├── QuotaHUD.tsx       # State quota panel
│   ├── DirectiveHUD.tsx   # Active directive display
│   ├── Advisor.tsx        # Comrade Vanya notification
│   ├── Toast.tsx          # Auto-dismissing notification banner
│   ├── Ticker.tsx         # Scrolling Pravda news ticker
│   ├── Minimap.tsx        # Minimap with real grid data
│   ├── CursorTooltip.tsx  # Tile info on long-press
│   ├── LensSelector.tsx   # Lens toggle buttons
│   ├── IntroModal.tsx     # Dossier briefing overlay
│   ├── MainMenu.tsx       # Soviet-themed landing page
│   ├── LoadingScreen.tsx  # Asset loading progress with propaganda
│   ├── NewGameSetup.tsx   # Difficulty/consequence/seed configuration
│   ├── GameModals.tsx     # Era, minigame, annual report, settlement, plan, game-over modals
│   ├── PersonnelFilePanel.tsx  # Full KGB personnel dossier view
│   ├── AchievementsPanel.tsx   # All achievements with unlock status
│   └── SettingsModal.tsx  # Music + color-blind mode toggles
├── hooks/         # React hooks
│   ├── useGameState.ts    # useSyncExternalStore bridge to GameState (GameSnapshot)
│   ├── useGameLoop.ts     # rAF game loop (simTick + per-frame updates)
│   └── useECSGameLoop.ts  # ECS world tick loop
├── audio/         # Audio system
│   ├── AudioManifest.ts   # Track definitions, playlists, mood mapping
│   └── AudioManager.ts    # Web Audio API music player
├── bridge/        # ECS ↔ React bridge
│   └── GameInit.ts        # initGame() with GameInitOptions + callback wiring
├── game/          # Game systems (ECS-based)
│   ├── SimulationEngine.ts    # Central ECS tick orchestrator
│   ├── PersonnelFile.ts       # KGB threat tracking (marks, commendations, history)
│   ├── AchievementTracker.ts  # 31 achievements + stats tracking
│   ├── ScoringSystem.ts       # Score calculation with difficulty multipliers
│   ├── SettlementSystem.ts    # Settlement tier progression (selo → gorod)
│   └── minigames/             # 9 minigame definitions + router
├── ecs/           # ECS archetypes and components
├── stores/        # External store (gameStore.ts) for cross-cutting state
├── App.web.tsx    # Web root: screen routing + all UI/modal/panel orchestration
├── App.tsx        # Native root (Expo resolves .web.tsx first on web)
└── Content.tsx    # Scene graph root composing all 3D components
```

### State flow

Two state systems coexist:

1. **ECS world** (`SimulationEngine`) — canonical game state. Systems tick via `useECSGameLoop`. UI callbacks (onToast, onEra, onMinigame, etc.) bridge ECS events → React state in `App.web.tsx`.
2. **Legacy `GameState`** (mutable singleton) — still used by 3D scene components. `initGame()` syncs ECS → GameState for terrain, buildings, weather. `useGameSnapshot()` provides a React-friendly snapshot via `useSyncExternalStore`.

Toast/advisor messages use a module-level side-channel in `helpers.ts` (not on GameState).

### Key patterns

- Scene components are declarative R3F JSX: `<mesh>`, `<meshStandardMaterial>`, etc.
- `useFrame()` from R3F for per-frame animation logic
- `useGLTF()` from drei for loading GLB models (preloaded via ModelPreloader)
- `useProgress()` from drei for asset loading tracking
- UI components use `pointerEvents="box-none"` to pass through touches to the 3D canvas
- GLB models are preloaded via `useGLTF.preload()`, then cloned per-building
- Modal/panel components access engine directly via `getEngine()?.getPersonnelFile()` etc. (read-once pattern)

## Assets

- `assets/models/soviet/` — 55 GLB models with `manifest.json` mapping roles
- `assets/audio/music/` — 52 OGG music tracks (Soviet anthems, war songs, folk)
- `archive/` — Previous 2D Canvas codebase + `poc.html` (reference implementation)

## Code Style

- TypeScript strict mode
- React Native `StyleSheet.create` for all styling (no Tailwind)
- Monospace font: Menlo (iOS) / monospace (Android)
- Soviet aesthetic: red (#c62828), gold (#fbc02d), terminal green (#00e676), dark panels (#2a2e33)

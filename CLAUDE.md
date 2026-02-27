# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SimSoviet 1917** is a satirical 3D city-builder game set in the Soviet Union (starting 1917). Players build structures and manage resources (rubles, food, vodka, power, population) against 5-year plan quotas. Built with **Reactylon Native** (BabylonJS 8 + React Native).

The `archive/` directory contains the previous 2D Canvas version (SimSoviet 2000) for reference. The current codebase is a full 3D rewrite.

## Commands

```bash
npm install                # Install dependencies
npx react-native run-ios   # Run on iOS simulator
npx react-native run-android  # Run on Android emulator
npx react-native start     # Start Metro bundler
npm test                   # Jest tests
npm run lint               # ESLint
```

## Tech Stack

- **3D Engine**: BabylonJS 8 via Reactylon Native (`reactylon ^3.5.4`)
- **UI**: React Native 0.74 overlay components (absolute-positioned on 3D canvas)
- **State**: Mutable `GameState` singleton with subscribe/notify + `useSyncExternalStore`
- **Audio**: BabylonJS Sound for OGG music playback (52 Soviet-era public domain tracks)
- **Build**: React Native CLI, Babel with `babel-plugin-reactylon`, TypeScript 5
- **Models**: 55 GLB models in `assets/models/soviet/` with manifest.json

## Architecture

### Two-layer rendering: BabylonJS 3D + React Native DOM

`App.tsx` hosts both:
1. **3D Viewport** — `NativeEngine` + `Scene` + `Content.tsx` (composes all scene components)
2. **React Native overlays** — TopBar, Toolbar, QuotaHUD, Toast, Advisor, Ticker, IntroModal, etc.

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
├── scene/         # BabylonJS 3D components (React FC returning null, imperative in useEffect)
│   ├── ModelCache.ts      # GLB preloader + clone/dispose
│   ├── ModelMapping.ts    # Building type → GLB model name mapping
│   ├── TerrainGrid.tsx    # 30×30 merged mesh with vertex colors + tree geometry
│   ├── CameraController.tsx  # UniversalCamera: pan/zoom/tilt, street-to-bird-eye
│   ├── Lighting.tsx       # Sun + overcast + fog with day/night cycle
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
│   └── FloatingText.tsx   # Billboard text above buildings
├── ui/            # React Native overlay components
│   ├── styles.ts          # Colors, panel styles, monospace font
│   ├── TopBar.tsx         # Resource bar + calendar + speed controls
│   ├── TabBar.tsx         # ZONING/INFRASTRUCTURE/STATE/PURGE tabs
│   ├── Toolbar.tsx        # Building tool buttons
│   ├── QuotaHUD.tsx       # State quota panel
│   ├── DirectiveHUD.tsx   # Active directive display
│   ├── Advisor.tsx        # Comrade Vanya notification
│   ├── Toast.tsx          # Auto-dismissing notification banner
│   ├── Ticker.tsx         # Scrolling Pravda news ticker
│   ├── Minimap.tsx        # Minimap placeholder
│   ├── CursorTooltip.tsx  # Tile info on long-press
│   ├── LensSelector.tsx   # Lens toggle buttons
│   └── IntroModal.tsx     # Dossier briefing overlay
├── hooks/         # React hooks
│   ├── useGameState.ts    # useSyncExternalStore bridge to GameState
│   └── useGameLoop.ts     # rAF game loop (simTick + per-frame updates)
├── audio/         # Audio system
│   ├── AudioManifest.ts   # Track definitions, playlists, mood mapping
│   └── AudioManager.ts    # BabylonJS Sound-based music player
├── App.tsx        # Root: NativeEngine + Scene + all UI overlays
└── Content.tsx    # Scene graph root composing all 3D components
```

### State flow

`GameState` (mutable singleton) → mutated by `simTick()` + user actions → `notify()` → React re-renders via `useSyncExternalStore` in `useGameSnapshot()`.

Toast/advisor messages use a module-level side-channel in `helpers.ts` (not on GameState).

### Key patterns

- Scene components are React FCs that return `null` and do all BabylonJS work imperatively in `useEffect` + `registerBeforeRender`
- `useScene()` from `reactylon` provides the BabylonJS Scene inside `<Scene>` children
- UI components use `pointerEvents="box-none"` to pass through touches to the 3D canvas
- GLB models are preloaded as disabled templates, then cloned per-building

## Assets

- `assets/models/soviet/` — 55 GLB models with `manifest.json` mapping roles
- `assets/audio/music/` — 52 OGG music tracks (Soviet anthems, war songs, folk)
- `archive/` — Previous 2D Canvas codebase + `poc.html` (reference implementation)

## Code Style

- TypeScript strict mode
- React Native `StyleSheet.create` for all styling (no Tailwind)
- Monospace font: Menlo (iOS) / monospace (Android)
- Soviet aesthetic: red (#c62828), gold (#fbc02d), terminal green (#00e676), dark panels (#2a2e33)

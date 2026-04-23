# Technical Context

## Architecture Overview

SimSoviet uses a **two-layer rendering architecture**:

1. **3D Layer** — R3F `<Canvas>` (WebGL2, PCFShadowMap) with 22 scene components in `src/scene/`
2. **UI Layer** — React Native overlay components (absolute-positioned on top of 3D canvas) in `src/ui/`

## Tech Stack Details

| Layer | Technology | Version |
|-------|-----------|---------|
| 3D Engine | Three.js via React Three Fiber | r183 / R3F v9.5 |
| 3D Helpers | drei | Latest |
| UI Framework | React Native | 0.83.2 |
| Platform | Expo | 55 |
| Language | TypeScript | 5.9 |
| State (ECS) | Miniplex | 2.0 |
| State (Legacy) | GameState singleton | Custom |
| Database | sql.js + Drizzle ORM | Wasm SQLite → IndexedDB |
| Audio | Web Audio API | Native |
| XR | @react-three/xr | v6 |
| Bundler | Metro (Expo) | — |
| Testing | Jest | — |

## State Flow

```
ECS World (miniplex)
  → SimulationEngine.tick()
    → systems update components
    → callbacks fire (onToast, onEra, onMinigame)
      → React state in App.web.tsx
        → UI re-renders

Legacy path (still used by scene components):
  GameState (mutable singleton)
    → simTick() / user actions
    → notify()
    → useSyncExternalStore in useGameSnapshot()
      → React re-renders
```

## Build & Deploy Pipeline

- **Dev**: `expo start --web` → http://localhost:3000
- **CI**: TypeScript typecheck + Jest tests on PR
- **CD**: Release Please → tag → release.yml (Expo web build + Pages deploy + Android APK)
- **Deploy**: https://arcade-cabinet.github.io/sim-soviet/

## Key Gotchas

1. **Expo `.web.tsx` resolution** — Metro resolves `App.web.tsx` before `App.tsx` on web. Always edit `App.web.tsx` for web changes.
2. **No `three/webgpu` imports** — Creates dual Three.js instance problem with R3F/drei. Always import from `'three'`.
3. **PCFSoftShadowMap deprecated** — Use `shadows="percentage"` on Canvas, not `shadows={true}`.
4. **Model loading timing** — BuildingRenderer renders before async preload completes → first clone attempts fail → `gameState.notify()` after preload triggers retry.
5. **Audio autoplay** — `startPlaylist()` deferred to IntroModal dismiss (browser autoplay policy).
6. **GitHub Pages base URL** — Assets need `/sim-soviet/` prefix in production. Use `assetUrl()` from `src/utils/assetPath.ts`.
7. **Branch protection** — main requires PRs, cannot push directly.

## Screen Flow

```
MainMenu → NewGameSetup → Loading Screen → IntroModal → Game
```

`App.web.tsx` manages screen state: `'menu' | 'setup' | 'game'`.

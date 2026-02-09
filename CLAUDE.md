# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SimSoviet 2000 is a satirical isometric city-builder game set in the Soviet Union (starting 1980). Players build structures (coal plants, tenements, kolkhozes, vodka plants, gulags) and manage resources (rubles, food, vodka, power, population) against 5-year plan quotas. The game runs in-browser and targets mobile via Capacitor (PWA + Android/iOS).

## Commands

```bash
pnpm install              # Install dependencies (pnpm 10+, Node 22+ required)
pnpm dev                  # Dev server on http://localhost:3000
pnpm build                # TypeScript check + Vite production build → dist/
pnpm typecheck            # tsc --noEmit (strict mode, noUncheckedIndexedAccess)
pnpm lint                 # Biome linter
pnpm lint:fix             # Biome auto-fix
pnpm format               # Biome formatter
pnpm test                 # Vitest unit tests (single run)
pnpm test:watch           # Vitest in watch mode
pnpm test:e2e             # Playwright tests (Desktop Chrome, iPhone SE, Pixel 8a, iPad)
pnpm test:e2e:mobile      # Playwright — mobile device projects only
pnpm download:audio       # Download Soviet-era music from marxists.org → app/public/audio/
```

Run a single test file: `pnpm vitest run src/__tests__/SimulationEngine.test.ts`

## Tech Stack

- **Rendering**: BabylonJS 8 via Reactylon (React-BabylonJS bridge)
- **UI**: React 19 + Tailwind CSS 4, overlaid on the BabylonJS canvas
- **State**: Custom `useSyncExternalStore` bridge in `src/stores/gameStore.ts` — mutable `GameState` class with immutable snapshots for React
- **ECS**: Miniplex 2 with archetypes for buildings, citizens, tiles, resources
- **Audio**: Tone.js for procedural SFX + HTMLAudioElement for music tracks (OGG/Opus)
- **AI**: Yuka (behavioral AI library, `src/ai/`)
- **Build**: Vite 7, TypeScript 5.9, Biome for lint/format
- **Testing**: Vitest (happy-dom env), Playwright for E2E
- **Mobile**: Capacitor 8 for Android/iOS

## Architecture

### Two-layer rendering: BabylonJS + React DOM

The `App.tsx` component hosts both:
1. **BabylonJS viewport** — rendered via Reactylon's `<Engine>` / `<Scene>` components. The `GameWorld` component (`src/components/GameWorld.tsx`) is a render-null component inside `<Scene>` that imperatively creates the `IsometricRenderer`, `GestureManager`, `ParticleSystem`, and `SimulationEngine`.
2. **React DOM overlays** — `TopBar`, `Toolbar`, `QuotaHUD`, `Toast`, `Advisor`, `PravdaTicker`, `IntroModal` sit in DOM elements on top of the canvas.

### State flow

`GameState` (mutable class) → mutated by `SimulationEngine.tick()` and `GestureManager` → `notifyStateChange()` creates an immutable `GameSnapshot` → React components subscribe via `useGameSnapshot()`.

The `SimCallbacks` interface passes messages (toast, advisor, pravda) from the simulation back to React state in `App.tsx`.

### ECS layer (src/ecs/)

Uses Miniplex 2's single-Entity-interface pattern. All components are optional properties on `Entity`. Predicate-based archetypes (powered/unpowered buildings, producers, housing) in `archetypes.ts` require `world.reindex(entity)` after mutations. Systems are pure functions in `src/ecs/systems/` (power, production, consumption, population, decay, quota).

### Input: GestureManager

State machine (`idle → pending → panning`) distinguishes taps from camera pans on touch devices. Only confirmed taps trigger `scene.pick()` for building placement. Replaces the old `InputManager` that fired on pointerdown.

### Event system

`EventSystem` fires weighted-random events (disasters, political, economic, cultural, absurdist) with conditions, cooldowns, and deduplication. `PravdaSystem` generates satirical Pravda newspaper headlines from events and ambient state. Events have dynamic text via functions over `GameState`.

### Path aliases

```
@/*    → src/*
@app/* → app/*
```

Defined in both `tsconfig.json` and `vite.config.ts` (+ `vitest.config.ts`).

### Vite configuration

The Vite root is `./app` (not project root). Output builds to `../dist`. There's a stub alias for `@babylonjs/core/XR/...` to work around Reactylon v3.5 importing nonexistent BabylonJS XR modules.

## Code Style

- Biome: 2-space indent, single quotes, trailing commas (ES5), 100-char line width, semicolons always
- TypeScript strict mode with `noUncheckedIndexedAccess`
- `noNonNullAssertion` is off (non-null assertions are allowed)

## Testing

- Unit tests live in `src/__tests__/` and match `src/**/*.test.ts` or `src/**/*.spec.ts`
- Test environment: happy-dom with `restoreMocks: true`
- E2E tests live in `e2e/`, run against `http://localhost:3000` with visual regression (`maxDiffPixelRatio: 0.05`)
- CI runs: lint → typecheck → test → build (GitHub Actions)

## Deploy

Merges to `main` auto-deploy to GitHub Pages via `.github/workflows/deploy.yml`. The build passes `--base /<repo-name>/` to Vite for correct asset paths.

## Agentic Memory Bank

This project maintains an `agentic-memory-bank/` directory with structured context files that persist across AI agent sessions. See `.clinerules` for the protocol. At session start, read the memory bank files to rebuild project context. After significant work, update `activeContext.md` and `progress.md`.

# Technical Context

## Architecture Overview

SimSoviet uses a layered web game stack:

1. **UI shell** - Expo + React Native Web components in `src/ui/`
2. **3D settlement scene** - React Three Fiber + Three.js in `src/scene/`
3. **Simulation core** - `src/game/` plus AI agents, ECS, and growth systems

## Tech Stack Details

| Layer | Technology | Version/Notes |
|-------|-----------|---------------|
| 3D Engine | Three.js | `^0.183.2` |
| Scene Framework | React Three Fiber | `^9.5.0` |
| 3D Helpers | drei | `^10.7.7` |
| UI Framework | React Native / React Native Web | `0.83.2` / `~0.21.2` |
| Platform | Expo | `~55.0.4` |
| Language | TypeScript | `^5.9.3` |
| ECS | Miniplex | `^2.0.0` |
| Persistence | Expo SQLite | `~55.0.10` |
| Testing | Jest, Vitest browser, Playwright | headed Chrome for browser/E2E |
| Tooling | Biome, Vite, Typedoc | active |

## Main Commands

```bash
pnpm install
pnpm web
pnpm run typecheck
pnpm run lint
pnpm run test:node
pnpm run test:browser
pnpm run build
pnpm run smoke:web
pnpm run test:e2e
```

## State Flow

```text
SimulationEngine + phase modules
  -> AI agents / ECS / growth systems
  -> bridge callbacks and stores
  -> React Native UI + R3F scene
```

Legacy `GameState` compatibility still exists in parts of the scene layer, so
changes that touch rendering often need to respect both the newer engine path
and the remaining bridge surfaces.

## Workflow Context

- **Dev**: `pnpm web`
- **PR verification**: `ci.yml`
- **Tag/release automation**: `release.yml`
- **Main deploy**: `cd.yml`
- **Public site**: https://arcade-cabinet.github.io/sim-soviet/

## Key Gotchas

1. `App.web.tsx` remains the important web entry path.
2. Avoid `three/webgpu` imports; use `three`.
3. GitHub Pages asset paths must respect the repo subpath.
4. Browser and E2E lanes intentionally run in headed Chrome.
5. The historical-only scope is a runtime constraint, not just a docs preference.

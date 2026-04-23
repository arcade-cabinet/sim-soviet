---
title: Architecture
updated: 2026-04-23
status: current
domain: technical
---

# Architecture

This document owns the runtime shape of the game, the major directories, and
the ship pipeline boundaries.

## Stack

| Layer | Technology |
| --- | --- |
| App shell | Expo + React Native Web |
| 3D scene | React Three Fiber + Three.js + drei |
| Core sim | TypeScript simulation engine under `src/game/` |
| ECS | Miniplex |
| AI agents | `src/ai/agents/` |
| Persistence | `expo-sqlite` / web SQLite flow |
| Tests | Jest, Vitest browser, Playwright |
| Build | `expo export --platform web` |

## Runtime Shape

```
React Native UI + menu shell
  -> bridge and stores
  -> SimulationEngine phase orchestration
  -> AI agents, ECS world, and growth systems
  -> React Three Fiber settlement scene
```

## Directory Ownership

| Path | Responsibility |
| --- | --- |
| `src/game/` | Simulation engine, era logic, save flow, chronology |
| `src/game/engine/` | Tick phases and campaign progression |
| `src/ai/agents/` | Economy, political, social, infrastructure, narrative, crisis agents |
| `src/growth/` | Organic building demand, siting, HQ splitting, local expansion |
| `src/ecs/` | World, archetypes, systems, factories |
| `src/scene/` | Local settlement rendering |
| `src/ui/` | Menu, landing page, HUD, HQ tabs, modals, reports |
| `src/content/` | Narrative/dialog content |
| `src/config/` | Historical runtime configs and era data |
| `e2e/` | Playwright smoke and browser campaign tests |
| `scripts/` | Export smoke, asset copy, support tooling |

## Era Building Unlock Policy

Each era in `src/config/eras.json` carries an `unlockedBuildings` array listing
the building defIds newly available during that period. Unlock is **cumulative**:
`getAvailableBuildings` (and the pure utility `getAvailableBuildingsForYear`)
iterate every era from `revolution` up to and including the current one, so a
building unlocked in `collectivization` remains available in all later eras.

The `great_patriotic` era (1941–1945) intentionally sets `unlockedBuildings: []`.
This models the wartime construction freeze: no new building types enter the
Soviet pipeline while the total-war economy is active, and the settlement must
survive on whatever building stock it accumulated through `industrialization`.
This is **not** a data gap — it is the designed constraint enforced by the
wartime `doctrine` and corroborated by the era's `introText` ("everything else
is a luxury; luxuries have been suspended for the duration").

## Current Product Constraints In Code

- New games start the historical campaign only.
- Historical progression ends in 1991.
- Post-1991 continuation stays on the same settlement.
- Runtime config must not expose future/space/multi-settlement systems.
- The local settlement scene is the only playable 3D world.

## Delivery Architecture

### CI

`ci.yml` runs:

- install
- typecheck
- lint
- `test:node`
- build
- headed Chrome Vitest browser lane
- build smoke with diagnostic artifact upload

### Release

`release.yml` handles release-please, Android APK upload, and iOS simulator
artifact generation for created tags.

### CD

`cd.yml` reruns release checks on `main`, deploys Pages, and publishes an
Android debug APK artifact.

## Operational Notes

- Use `pnpm`; the repo pins `pnpm@10.33.0`.
- Web production assets live under `dist/`.
- GitHub Pages expects the production base path logic already handled by the
  app build and asset copy scripts.
- The app is intentionally tested and run in headed Chrome for browser and E2E
  lanes because the WebGL path needs a real display pipeline.

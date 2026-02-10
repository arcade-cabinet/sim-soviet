---
title: ECS Unification -- GameState Eliminated
date: 2026-02-09
status: Complete
category: devlog
commits: af54f48..5cbceee
---

# 004: ECS Unification -- GameState Eliminated

## What Was Built

- **Deleted `GameState` class entirely** -- ECS is now the sole source of truth
- **6-phase migration**:
  1. Foundation types: GameGrid, GameView, GameMeta ECS component
  2. SimulationEngine writes ECS directly, deleted syncEcsToGameState
  3. EventSystem/PravdaSystem use GameView (read-only ECS snapshot)
  4. Canvas2DRenderer/CanvasGestureManager read ECS for buildings/money
  5. gameStore reads ECS directly, SaveSystem takes GameGrid
  6. Delete GameState, update 8 test files
- **897 unit tests** passing after migration (zero GameState references remain)
- **Bug fixes**: toastStore, Slider, SovietHUD, SimulationEngine, RadialBuildMenu
- **Defensive checks**: Divide-by-zero guards across systems

## Key Decisions

- **GameView as compatibility shim**: Rather than rewriting all 50+ event template
  conditions and 61 Pravda generators, `createGameView()` builds a read-only
  object with the same field names as old GameState from live ECS data.
- **GameGrid for spatial queries**: Extracted from GameState as a standalone class.
  Only handles occupancy (which tiles have buildings) -- no resource or building
  component data.
- **GameMeta ECS component**: Consolidates date, quota, leader, settlement,
  personnel file, gameOver flag, selectedTool, and seed into one ECS singleton
  alongside the resources entity.

## Lessons Learned

- The `PolitburoSystem` delta-capture hack (sync money to GameState before tick,
  capture delta, apply back to ECS) was eliminated by having PolitburoSystem
  write resources directly via `getResourceEntity()`.
- `createSnapshot()` in gameStore.ts must handle the case where ECS entities
  don't exist yet (initial render before game world is created).

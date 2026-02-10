---
title: Game Systems Integration
date: 2026-02-09
status: Complete
category: devlog
commits: a18fc65..d292f98
---

# 002: Game Systems Integration

## What Was Built

- **PolitburoSystem** (2,196 lines) wired into SimulationEngine
  - 10 ministries, 8 personality archetypes, 80-cell interaction matrix
  - Coup/purge mechanics, inter-ministry tension system
  - 30+ ministry event templates
  - Weather/Politburo modifiers: farmMod, vodkaMod, popGrowth, decay
- **Biome terrain tiles**: FeatureTileRenderer + TerrainGenerator for seeded
  procedural border terrain placement (138 hex tiles, 3 seasons)
- **PersonnelFile**: Black marks + commendations, threat levels, arrest mechanic
  at 7+ net marks (56 tests)
- **CompulsoryDeliveries**: Doctrine-based state extraction between production
  and consumption steps (48 tests)
- **SettlementSystem**: Settlement tier evolution with 30/60 tick hysteresis
  (selo -> posyolok -> PGT -> gorod, 28 tests)
- **Game speed**: 1x/2x/3x via gameStore
- **Seeded RNG**: GameRng class wrapping seedrandom, module-level `_rng` pattern

## Key Decisions

- **SimulationEngine tick order expanded to 13 steps**: ChronologySystem first,
  PersonnelFile last. CompulsoryDeliveries slots between production and consumption.
- **Module-level `_rng` pattern**: Each system stores `GameRng | null` at module
  scope to avoid threading RNG through every function parameter.
- **GameView for lambdas**: EventSystem and PravdaSystem condition functions use
  `createGameView()` -- a read-only snapshot from ECS with same field names as
  old GameState, avoiding tight coupling to ECS internals.

## PR Merged

- PR #4: Game Systems Integration

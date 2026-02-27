# SimSoviet 3000: Reactylon Native 3D — Design Document

**Date**: 2026-02-26
**Status**: Approved
**Goal**: Replace 2D Canvas game with full 3D BabylonJS city-builder via Reactylon Native

## Summary

Archive existing 2D codebase. Initialize fresh Reactylon Native app. Fully translate the POC (poc.html — SimSoviet 3000: Metropolis Protocol) into a polished 3D game using the 55 existing Soviet GLB models. Free camera from bird's-eye city management to street-level brutalist canyons. React Native overlay UI with retro SimCity 3000 aesthetic. Phase 2 will layer in advanced systems from the archived codebase.

## Phase 1: Full POC Translation to 3D

### Architecture

```
Engine + Scene (Reactylon/BabylonJS)
  └── Content.tsx (scene graph root)
       ├── TerrainGrid — 30x30 ground with water, rail, trees, elevation
       ├── BuildingRenderer — GLB instances on grid
       ├── CameraController — UniversalCamera, bird-eye ↔ street-level
       ├── Lighting — day/night directional sun + ambient
       ├── WeatherFX — snow/rain/storm GPU particles
       ├── SmogOverlay — per-tile volumetric fog
       ├── TrainRenderer — animated train on rail
       ├── VehicleRenderer — cars on roads
       ├── ZeppelinRenderer — firefighter airships
       ├── MeteorRenderer — meteor impact VFX
       ├── LightningRenderer — storm bolts
       ├── FireRenderer — building fire/riot VFX
       ├── AuraRenderer — propaganda/gulag rings
       ├── FloatingText — "+200₽" billboards
       ├── GhostPreview — translucent placement preview
       └── LensSystem — material swaps for power/water/smog/aura views

React Native Overlay (positioned over 3D canvas)
  ├── TopBar — resources, date, season, weather, speed controls
  ├── Toolbar — categorized tabs (zone/infra/state/purge) with building buttons
  ├── QuotaHUD — quota progress bar + deadline
  ├── DirectiveHUD — active directive text + reward
  ├── Minimap — rendered from secondary camera
  ├── Advisor — Comrade Vanya advisory modal
  ├── Toast — notification system
  ├── Ticker — scrolling Pravda headlines
  ├── IntroModal — dossier briefing
  ├── CursorTooltip — tile hover info
  └── LensSelector — lens toggle buttons
```

### Game Engine (TypeScript port of POC)

Direct translation of poc.html's ~1200 lines of game logic:

- **GameState**: Central mutable state (money, pop, food, vodka, power, water, date, grid, buildings, traffic, train, meteor, weather, camera)
- **SimTick**: Per-tick simulation (directive checks, storm events, meteor events, zone growth/evolution, water BFS, power/water distribution, smog diffusion, fire/riot spread, zeppelin firefighting, production, consumption, population growth, quota tracking)
- **BuildingTypes**: 20 placeable types + 4 grown types × 3 density levels
- **WaterNetwork**: BFS from pumps through pipes with 3-tile radius
- **TrainSystem**: Periodic supply drops at adjacent stations
- **MeteorSystem**: Random meteor → crater → cosmic tap authorization
- **WeatherSystem**: Season-driven (winter/mud/summer/autumn), storm lightning
- **TrafficSystem**: Road-network vehicle pathfinding
- **Directives**: 12 sequential objectives with rewards

### 3D Model Mapping

| POC Type | Level 1 | Level 2 | Level 3 |
|----------|---------|---------|---------|
| housing (zone-res) | workers-house-a/b/c | apartment-tower-a/b | apartment-tower-c/d |
| factory (zone-ind) | warehouse | factory-office | bread-factory |
| distillery (zone-ind) | vodka-distillery | vodka-distillery (scaled) | vodka-distillery (+ roof details) |
| farm (zone-farm) | collective-farm-hq | collective-farm-hq (scaled) | collective-farm-hq (+ modular) |
| power | power-station | — | — |
| nuke | power-station (recolored blue) | — | — |
| gulag | gulag-admin | — | — |
| tower (propaganda) | radio-station | — | — |
| pump | concrete-block (blue tint) | — | — |
| station | train-station | — | — |
| mast (aero-mast) | guard-post (+ antenna roof) | — | — |
| space (cosmodrome) | procedural rocket + government-hq base | — | — |

### Camera

UniversalCamera with:
- Scroll/pinch zoom: altitude 5 (street) → 200 (bird's-eye)
- WASD/arrow pan at all altitudes
- Touch: pan gesture, pinch zoom
- At street level: buildings tower overhead, atmospheric fog, visible grime
- At bird's-eye: classic city management overview

### Visual Atmosphere (The "Anti-Manhattanhenge")

- Perpetual overcast: hemisphere light gray-blue, low directional intensity
- Winter: white ground, gray sky, snow particles
- Night: dark ambient, emissive yellow windows on powered buildings
- Smog: green-tinted semi-transparent volumes over polluted tiles
- Street level: narrow concrete canyons between Khrushchyovka towers, puddles, gloom

### Autonomous Infrastructure

CLAUDE.md will include:
- Full project context for fresh sessions
- Quality gate commands (typecheck, lint, test)
- Agent swarm definitions for parallel work
- Memory bank protocol for session continuity

## Phase 2: Advanced Systems (Future)

Layer in from archive/:
- Miniplex 2 ECS replacing flat GameState
- 18-system SimulationEngine tick
- Economy system (trudodni, fondy, blat, rations, MTS, heating, currency)
- 8 era campaigns + transitions
- Worker entities with AI behavioral governor
- Political entities (politruks, KGB, military)
- Politburo ministry system
- 145K+ Pravda headline generator
- 8 minigames
- 28+ achievements + scoring + medals
- Save/load with sql.js
- Tutorial system (14 milestones)
- Full audio (40+ era-specific tracks + Tone.js SFX)
- Settlement tier progression
- Construction phases + materials
- Demographics (dvor/households)

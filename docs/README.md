---
title: Documentation Index
type: index
status: active
last_verified: 2026-03-01
---

# SimSoviet 1917 — Documentation

> *"All documentation is accurate. Discrepancies are the reader's fault."*

This directory contains the design specifications, reference documents, and development logs for **SimSoviet 1917** — a Soviet bureaucrat survival sim (NOT a city builder) set in an alternate-history Soviet Union that never collapses. The player is the predsedatel; the settlement grows organically via autonomous agents. Built with React Three Fiber (Three.js r183 + React Native + Expo).

---

## Start Here

| Document | What You'll Learn |
|----------|-------------------|
| **[GAME_VISION.md](GAME_VISION.md)** | The complete game vision in one document — core loop, eras, economy, political system, what's implemented vs aspirational |
| **[GDD-master.md](GDD-master.md)** | The full master GDD with every mechanic specified in detail |

---

## Game Design (in `design/`)

Domain-specific design documents. Each covers one system in depth.

| Document | Domain | Status |
|----------|--------|--------|
| [overview.md](design/overview.md) | Game identity, core loop, settlement evolution | Complete |
| [economy.md](design/economy.md) | Planned economy: trudodni, fondy, blat, production formulas, heating, storage | Complete |
| [workers.md](design/workers.md) | Worker roles, lifecycle, morale/loyalty/skill, autonomous collective | Complete |
| [demographics.md](design/demographics.md) | Dvor (household) system, family structures, birth/death | Draft |
| [political.md](design/political.md) | Politruks, KGB, military, personnel file, pripiski | Complete |
| [eras.md](design/eras.md) | 8 era campaigns, transitions, doctrine integration | Complete |
| [map-terrain.md](design/map-terrain.md) | Procedural generation, camera, terrain types | Complete |
| [ui-ux.md](design/ui-ux.md) | Mobile-first brutalist UI design | Complete |
| [minigames.md](design/minigames.md) | 8 building/tile-triggered minigames | Complete |
| [scoring.md](design/scoring.md) | Scoring, difficulty, permadeath, consequences | Complete |

---

## Architecture & Systems

Deep reference documents for complex subsystems.

| Document | Description |
|----------|-------------|
| [ECS Architecture](design/ecs-architecture.md) | Miniplex 2.0 — components, archetypes, system pipeline |
| [Leadership Architecture](design/leadership-architecture.md) | Political ECS components, modifier pipeline |
| [Era Doctrines](design/era-doctrines.md) | 8 composable policy modifier sets |
| [Power Transitions](design/power-transitions.md) | 7 leadership succession types, probability engine |
| [Leader Archetypes](design/leader-archetypes.md) | 11 procedural leader personalities |

### Eternal Era & Expansion Systems

| System | Description |
|--------|-------------|
| Kardashev Sub-Eras | 8 stages from Type 0 to Type III+ with distinct mechanics and building sets |
| Post-Scarcity Pressure | 5 pressure domains for abundance-driven crises (identity, meaning, computation) |
| Multi-Settlement | Tick loop across multiple worlds, RelocationEngine, inter-settlement transport |
| Cold Branches | 42 narrative divergence points with cascading consequences |
| Adaptive Agent Matrix | 10 terrain profiles (Siberia to Venus) with per-world parameter swaps |
| Climate Polarity | Ecological collapse timeline vs. terraforming mechanics |
| Procedural Shaders | Dyson sphere, Mars dome, O'Neill cylinder visualization |
| Celestial Body Factory | Sphere-to-flat morph for planet landing transitions |
| Load Zones | 13 zone-aware configurations controlling LOD and memory budgets |

---

## Content & Creative

| Document | Description |
|----------|-------------|
| [Dialog Bible](design/dialog-bible.md) | Trilingual voice guide, advisor monologues, leader decrees |
| [Pravda System](reference/pravda-system.md) | Procedural headline generator — 145K+ combinations |
| [World-Building](reference/world-building.md) | Timeline events, achievements, building flavor, loading quotes |
| [Name Generator](reference/name-generator.md) | Russian name generator — 1.1M+ combinations |

---

## Technical Reference

| Document | Description |
|----------|-------------|
| [Politburo System](reference/politburo-system.md) | Ministry simulation — 10 ministries, 80-cell matrix, 29 events |
| [Yuka AI Research](reference/research-yuka-ai.md) | AI library capabilities mapping |
| [Audio Assets](reference/audio-assets.md) | 47 Soviet-era music tracks inventory |

---

## Development

| Location | Description |
|----------|-------------|
| [devlog/](devlog/README.md) | Chronological record of major milestones |
| [plans/](plans/) | Implementation plans and PRDs |

---

## Reading Order

**Quick start**: Read [GAME_VISION.md](GAME_VISION.md) — covers everything in ~10 minutes.

**Deep dive** (for implementation):
1. GAME_VISION.md — overall picture
2. design/overview.md — core loop and settlement evolution
3. design/economy.md — the planned economy (most complex system)
4. design/workers.md — worker AI and population dynamics
5. design/political.md — personnel file and political apparatus
6. design/eras.md — 8 era campaigns
7. GDD-master.md — full reference for all mechanics
8. design/ecs-architecture.md — technical architecture

---

*43 documentation files | Last updated: March 2026*

---
title: Kardashev Expansion — Eternal Era Systems + Multi-Settlement
type: devlog
status: current
date: 2026-03-05
category: feature
last_verified: 2026-03-05
commits:
  - 20 commits on feat/allocation-engine
---

# 006: Kardashev Expansion — Eternal Era Systems + Multi-Settlement

## Summary

Massive expansion of the Eternal era and post-1991 divergence content. ~16K lines of new code across 100+ files. 6730 tests (up from 6232), 0 TypeScript errors. All 7 phases of Buildings-UI plan completed. All active plans completed and archived.

## What Was Built

### Kardashev Sub-Eras (8 stages)

The Eternal era now spans Kardashev Type 0 through Type III+ with 8 distinct sub-eras, each with unique mechanics, building sets, and crisis systems. The settlement evolves from a Soviet collective farm through planetary civilization to interstellar expansion.

### Post-Scarcity Pressure System (5 new domains)

Extended the pressure-valve crisis engine with 5 new accumulation domains for post-scarcity civilizations. Crises emerge from abundance rather than scarcity — identity dissolution, meaning collapse, computational resource wars, and existential ennui.

### Multi-Settlement Tick Loop

Settlements can now exist across multiple worlds. The tick loop iterates all active settlements with per-world parameter swaps. RelocationEngine handles inter-settlement transport, resource transfer, and population migration.

### Megacity Law Enforcement

Scaled-up political and enforcement systems for million+ population settlements. KGB, militia, and party apparatus operate at aggregate scale with statistical crime/dissent modeling.

### Cold Branches (42)

42 narrative branch points across the world timeline where history diverges. Each branch has 2-3 choices with cascading consequences that alter available technologies, political dynamics, and crisis probabilities.

### Adaptive Agent Matrix (10 profiles)

10 terrain profiles (Siberia, Ukraine, Central Asia, Mars, Titan, Venus, etc.) that swap agent parameters — temperature ranges, resource availability, atmospheric composition, gravity modifiers. Agents auto-adapt behavior to their environment.

### Climate Polarity System

Dual-use climate system: ecological collapse timeline (warming, acidification, desertification) vs. terraforming mechanics (atmospheric processors, ice cap engineering). Climate events feed into the pressure system.

### Procedural Shaders (Dyson / Mars / O'Neill)

Three new procedural shader sets for Kardashev-scale structures:
- Dyson sphere/swarm with energy collection visualization
- Mars colony domes with atmospheric tinting
- O'Neill cylinder with interior sky projection

### Celestial Body Factory

Sphere-to-flat morph system for celestial bodies. Planets render as 3D spheres at orbital distance and morph to flat terrain when the player "lands." Seed-based procedural generation ensures consistent geography.

### Poly Haven Pipeline

New `scripts/fetch-polyhaven.ts` — declarative asset pipeline for CC0 HDRIs, PBR textures, and 3D models from Poly Haven. Requirements-driven sync with manifest tracking and MD5 checksums.

### Load Zones (13)

13 zone-aware loading configurations that control LOD, asset preloading, and memory budgets based on the current game state (surface, orbit, interstellar, etc.). Each zone has a themed loading screen.

### Zone-Aware Loading Screens

Loading screens adapt to the current zone — Soviet propaganda posters for early eras, cosmonaut imagery for space, abstract geometry for deep future. Progress bars use era-appropriate aesthetics.

### Buildings-UI Completion (All 7 Phases)

The Buildings-Are-the-UI plan reached full completion:
1. HUD strip removal
2. Organic growth via autonomous collective
3. Building-click interaction
4. Directive-only player control
5. Settlement tier visualization
6. Building upgrade paths
7. Full removal of direct placement toolbar

## Execution Approach

- **6-agent parallel swarm**: Specialist agents worked concurrently on independent systems
- **Team lead coordination**: Cross-cutting concerns (tick loop changes, ECS schema) handled centrally
- **20 commits**: Incremental, tested, each passing CI
- **Zero regressions**: 498 new tests, all 6730 passing

## Test Coverage

| Area | New Tests | Total |
|------|-----------|-------|
| Crisis/pressure | 45 | ~320 |
| Timeline/branches | 38 | ~180 |
| Agent matrix | 25 | ~90 |
| Multi-settlement | 52 | ~120 |
| Shaders/scene | 18 | ~60 |
| Buildings-UI | 35 | ~150 |
| Other systems | 285 | ~5810 |
| **Total** | **498** | **6730** |

## Key Files

| System | Primary Files |
|--------|--------------|
| Kardashev sub-eras | `src/game/era/kardashev.ts`, `src/config/kardashevSubEras.json` |
| Post-scarcity pressure | `src/ai/agents/crisis/pressure/PressureDomains.ts` |
| Multi-settlement | `src/game/relocation/RelocationEngine.ts`, `src/game/relocation/settlementTypes.ts` |
| Cold branches | `src/ai/agents/core/worldBranches.ts` |
| Adaptive agent matrix | `src/ai/agents/core/agentProfiles.ts` |
| Climate polarity | `src/ai/agents/crisis/ClimateEventSystem.ts` |
| Procedural shaders | `src/scene/shaders/dyson.ts`, `src/scene/shaders/mars.ts`, `src/scene/shaders/oneill.ts` |
| Celestial body factory | `src/scene/CelestialBodyFactory.tsx` |
| Poly Haven pipeline | `scripts/fetch-polyhaven.ts`, `assets/polyhaven-requirements.json` |
| Load zones | `src/scene/loadZones.ts`, `src/ui/ZoneLoadingScreen.tsx` |
| Buildings-UI | `src/ui/BuildingPanelContent/`, `src/growth/OrganicUnlocks.ts` |

## Plans Completed

All active plans were completed and archived during this session:
- Buildings Are the UI (phases 4-7)
- Eternal Expansion Design
- Climate Terraforming Dual-Use
- Adaptive Agent Matrix
- Soviet Allocation Engine (previously completed, archived)

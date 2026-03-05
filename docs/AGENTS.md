# Documentation — Master Agent Index

> **SimSoviet 1917** — Soviet bureaucrat survival sim (NOT a city builder). R3F + Three.js r183 + React Native + Expo.

## Quick Navigation

| Index | Domain | Docs |
|-------|--------|------|
| [`design/AGENTS.md`](design/AGENTS.md) | Game systems design docs | 15 docs |
| [`plans/AGENTS.md`](plans/AGENTS.md) | Implementation plans & PRDs | 4 active + 11 archived |
| [`devlog/AGENTS.md`](devlog/AGENTS.md) | Development milestones | 5 entries |
| [`reference/AGENTS.md`](reference/AGENTS.md) | Subsystem reference docs | 6 docs |
| [`audits/AGENTS.md`](audits/AGENTS.md) | Code-vs-docs audits | 1 audit |

## Frontmatter Schema

Every doc in `docs/` has YAML frontmatter. Scan with: `head -20 docs/**/*.md`

```yaml
---
title: Document Title
type: design | reference | plan | devlog | audit | vision | research | index
status: draft | active | implemented | superseded | archived
implementation:               # Source files that implement the design
  - src/path/to/file.ts
tests:                         # Test files for this system
  - __tests__/path/to/test.ts
coverage: full | partial | none
last_verified: YYYY-MM-DD
# Plan-specific (optional):
plan_status: proposed | in-progress | completed | abandoned
superseded_by: path/to/newer-doc.md
# Devlog-specific (optional):
date: YYYY-MM-DD
category: feature | bugfix | refactor | migration
commits:
  - abc1234
---
```

## Type Taxonomy

| Type | Purpose | Count |
|------|---------|-------|
| `design` | Game system specifications | 16 |
| `plan` | Implementation strategies & PRDs | 4 active + 11 archived |
| `devlog` | Chronological development milestones | 5 |
| `reference` | Subsystem data structure documentation | 6 |
| `audit` | Code-vs-docs alignment assessments | 1 |
| `vision` | High-level game vision | 1 |
| `research` | External library research | 1 |
| `index` | Navigation indexes (README files) | 3 |

## Status Taxonomy

| Status | Meaning |
|--------|---------|
| `draft` | Design spec, not yet fully implemented |
| `active` | In use, may have ongoing changes |
| `implemented` | Fully reflected in code |
| `superseded` | Replaced by a newer document |
| `archived` | Historical reference only |

## Start Here

1. **Quick overview**: [`GAME_VISION.md`](GAME_VISION.md) — covers everything in ~10 minutes
2. **Full GDD**: [`GDD-master.md`](GDD-master.md) — every mechanic specified
3. **Per-system**: Browse [`design/AGENTS.md`](design/AGENTS.md) for domain-specific docs

## All Documents by Status

### Implemented (Canonical — reflects actual code)
| Document | Type | Implementation |
|----------|------|---------------|
| `design/overview.md` | design | — |
| `design/economy.md` | design | `src/ai/agents/economy/` |
| `design/workers.md` | design | `src/ai/agents/workforce/WorkerSystem.ts` |
| `design/demographics.md` | design | `src/ai/agents/social/DemographicAgent.ts`, `src/ai/agents/social/statisticalDemographics.ts` |
| `design/political.md` | design | `src/ai/agents/political/` |
| `design/eras.md` | design | `src/game/era/EraSystem.ts` |
| `design/minigames.md` | design | `src/game/minigames/MinigameRouter.ts` |
| `design/scoring.md` | design | `src/game/ScoringSystem.ts` |
| `design/ecs-architecture.md` | design | `src/ecs/` |

### New Systems (feat/allocation-engine)
| System | Type | Implementation | Description |
|--------|------|---------------|-------------|
| Pressure-Valve Crisis | crisis | `src/ai/agents/crisis/pressure/` (7 files) | 10-domain pressure accumulation, dual-spread model, threshold-based crisis emergence |
| Climate Events | crisis | `src/ai/agents/crisis/ClimateEventSystem.ts` | Tier 2: season/weather-gated natural events that add pressure |
| Black Swan Events | crisis | `src/ai/agents/crisis/BlackSwanSystem.ts` | Tier 3: ultra-rare events (earthquakes, solar storms, nuclear accidents) |
| World Agent | core | `src/ai/agents/core/WorldAgent.ts` | Geopolitical backdrop: spheres of influence, trade, tension, climate trends |
| Sphere Dynamics | core | `src/ai/agents/core/sphereDynamics.ts` | Khaldun + Turchin empire lifecycle cycles, governance drift |
| World Countries | core | `src/ai/agents/core/worldCountries.ts` | Country/sphere data, governance types, 1917 starting state |
| Cold Branches | core | `src/ai/agents/core/worldBranches.ts` | Dormant divergence points activated by pressure conditions |
| Multi-Settlement | game | `src/game/relocation/` (3 files) | Settlement type, RelocationEngine, terrain profiles (Siberia → Mars) |
| HQ Splitting | growth | `src/growth/HQSplitting.ts` | Milestone-based building spawns at population thresholds |
| Building Panel Content | ui | `src/ui/BuildingPanelContent/` (7 files) | Per-role building panels (Factory, Farm, Housing, Service, etc.) |
| HQ Agency Tabs | ui | `src/ui/hq-tabs/` (6 files) | Government HQ tabs (Gosplan, KGB, Military, Politburo, Reports, etc.) |
| Celestial Body Factory | scene | `src/scene/celestial/` (5 files) | Sphere↔flat morphing viewport, 4 body types (Sun/Terran/Martian/Jovian), MegastructureShell |
| ZonePreloader | scene | `src/scene/ZonePreloader.ts` | Zone-specific asset preloading (models, textures, HDRIs) with progress phases |
| Zone-Aware Loading | ui | `src/ui/LoadingScreen.tsx`, `src/ui/SettlementTransitionOverlay.tsx` | Zone-specific loading screens with flavor text + settlement transition overlay |

### Active (In use, ongoing)
| Document | Type |
|----------|------|
| `GAME_VISION.md` | vision |
| `GDD-master.md` | design |
| `design/ui-ux.md` | design |
| `design/dialog-bible.md` | design |
| `reference/politburo-system.md` | reference |
| `reference/pravda-system.md` | reference |
| `reference/name-generator.md` | reference |
| `reference/world-building.md` | reference |
| `reference/audio-assets.md` | reference |

### Draft (Aspirational — not yet fully implemented)
| Document | Type |
|----------|------|
| `design/era-doctrines.md` | design |
| `design/leader-archetypes.md` | design |
| `design/leadership-architecture.md` | design |
| `design/power-transitions.md` | design |

### Superseded (Archived)
| Document | Replaced By |
|----------|-------------|
| `plans/archive/2026-02-26-reactylon-native-3d-design.md` | `plans/archive/2026-02-27-r3f-migration-design.md` |
| `plans/archive/2026-02-26-simSoviet1917-reactylon-native.md` | `plans/archive/2026-02-27-r3f-migration-plan.md` |

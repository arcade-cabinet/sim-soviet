# Design Documents — Agent Index

> Scan frontmatter: `head -20 docs/design/*.md`

## How to Use This Index

Each design document specifies one game system. Read the `implementation` frontmatter field to find the source code, and `tests` for test coverage. Status `implemented` means the design is fully reflected in code; `draft` means aspirational/planned.

## Document Index

| Document | Title | Status | Implementation | Coverage |
|----------|-------|--------|---------------|----------|
| `overview.md` | Game Identity & Core Loop | implemented | — (architectural) | full |
| `economy.md` | The Planned Economy System | implemented | `src/game/economy.ts` | full |
| `workers.md` | Workers — The Central Resource | implemented | `src/game/workers/WorkerSystem.ts` | full |
| `demographics.md` | Demographics & Household System | implemented | `src/ecs/systems/demographicSystem.ts`, `src/ecs/factories/demographics.ts` | partial |
| `political.md` | Political Apparatus | implemented | `src/game/political/PoliticalEntitySystem.ts`, `src/game/politburo/PolitburoSystem.ts` | full |
| `eras.md` | Era-Based Campaigns | implemented | `src/game/era/EraSystem.ts` | full |
| `minigames.md` | Building & Tile Triggered Minigames | implemented | `src/game/minigames/MinigameRouter.ts` | full |
| `scoring.md` | Scoring, Difficulty & Permadeath | implemented | `src/game/ScoringSystem.ts`, `src/game/AchievementTracker.ts` | full |
| `ui-ux.md` | Mobile-First Brutalist UI/UX | active | `src/ui/`, `src/scene/` | partial |
| `ecs-architecture.md` | Miniplex 2.0 ECS Specification | implemented | `src/ecs/world.ts`, `src/ecs/archetypes.ts`, `src/ecs/systems/` | full |
| `era-doctrines.md` | 8 Composable Policy Modifier Sets | draft | `src/game/political/doctrine.ts` | partial |
| `leader-archetypes.md` | 11 Procedural Leader Personalities | draft | `src/game/political/PoliticalEntitySystem.ts` | partial |
| `leadership-architecture.md` | Leadership ECS Components & Modifier Pipeline | draft | `src/game/political/`, `src/game/politburo/` | partial |
| `power-transitions.md` | 7 Succession Mechanics | draft | `src/game/politburo/coups.ts` | partial |
| `dialog-bible.md` | In-Game Voice Guide | active | `src/content/dialogue/` | partial |

## New Systems (feat/allocation-engine — not yet design-doc'd)

These systems are implemented in code but do not yet have corresponding design documents:

| System | Implementation | Description |
|--------|---------------|-------------|
| Pressure-Valve Crisis | `src/ai/agents/crisis/pressure/` (7 files) | 10-domain pressure accumulation with dual-spread model, threshold-based crisis emergence (replaces ChaosEngine dice rolls) |
| Climate Events (Tier 2) | `src/ai/agents/crisis/ClimateEventSystem.ts` | Seasonal/geographic natural events gated by weather and climate trends |
| Black Swan Events (Tier 3) | `src/ai/agents/crisis/BlackSwanSystem.ts` | Ultra-rare events (earthquakes, solar storms, nuclear accidents) with no artificial intervals |
| World Agent | `src/ai/agents/core/WorldAgent.ts` | Geopolitical backdrop — spheres, trade, tension, climate cycles, Moscow scrutiny |
| Sphere Dynamics | `src/ai/agents/core/sphereDynamics.ts` | Khaldun + Turchin overlapping empire lifecycle cycles |
| Cold Branches | `src/ai/agents/core/worldBranches.ts` | Dormant divergence points that activate organically from pressure conditions |
| Multi-Settlement / Relocation | `src/game/relocation/` (3 files) | Settlement type, RelocationEngine, terrain profiles from Siberia to Mars |
| HQ Splitting | `src/growth/HQSplitting.ts` | Milestone-based building spawns at population thresholds (50/150/400) |

## Canonical vs Aspirational

**Canonical** (implemented — reflects actual code):
- overview, economy, workers, demographics, political, eras, minigames, scoring, ecs-architecture

**Aspirational** (draft — design spec not yet fully implemented):
- era-doctrines, leader-archetypes, leadership-architecture, power-transitions

**In Progress** (active — partially implemented):
- ui-ux, dialog-bible

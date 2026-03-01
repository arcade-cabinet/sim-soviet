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

## Canonical vs Aspirational

**Canonical** (implemented — reflects actual code):
- overview, economy, workers, demographics, political, eras, minigames, scoring, ecs-architecture

**Aspirational** (draft — design spec not yet fully implemented):
- era-doctrines, leader-archetypes, leadership-architecture, power-transitions

**In Progress** (active — partially implemented):
- ui-ux, dialog-bible

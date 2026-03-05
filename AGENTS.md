# SimSoviet 1917 — Agent Navigation

> Soviet bureaucrat survival sim (NOT a city builder). The player is the predsedatel — the settlement grows organically via autonomous agents. The player does NOT freely place buildings.
> Built with React Three Fiber + Three.js r183 + React Native + Expo.

## Quick Start for Agents

1. **Read `memory-bank/AGENTS.md`** — project context, tech stack, patterns, current state
2. **Read `docs/AGENTS.md`** — documentation index with frontmatter schema
3. **Read `CLAUDE.md`** — operational instructions (commands, gotchas, code style)

## Navigation

| Resource | Purpose | When to Use |
|----------|---------|-------------|
| [`memory-bank/AGENTS.md`](memory-bank/AGENTS.md) | Agentic memory bank (Cline-style) | First — understand project context |
| [`docs/AGENTS.md`](docs/AGENTS.md) | Documentation index | Find design docs, plans, references |
| [`CLAUDE.md`](CLAUDE.md) | Operational instructions | Commands, tech stack, gotchas |
| [`.claude/agents/`](.claude/agents/) | Specialist agent definitions | Domain-specific expertise |
| [`.claude/commands/`](.claude/commands/) | Custom commands | Audit, status, verification |

## Key Source Directories

| Directory | What | Files |
|-----------|------|-------|
| `src/ai/agents/` | **Yuka domain agents** (9 subpackages: core, economy, political, infrastructure, social, workforce, narrative, meta, crisis) | ~169 |
| `src/ai/agents/crisis/pressure/` | **Pressure-valve crisis system** — 15-domain accumulation (10 classical + 5 post-scarcity), threshold-based crisis emergence | 7 |
| `src/ai/agents/core/` | ChronologyAgent, WeatherAgent, **WorldAgent** (geopolitical sim), sphere dynamics, 42 cold branches | 12 |
| `src/game/` | Thin orchestrator (SimulationEngine) + shared infra (era, Chronology, SeedSystem, SaveSystem) | ~38 |
| `src/game/relocation/` | **Multi-settlement system** — Settlement type, RelocationEngine, terrain profiles (Siberia→Mars) | 3 |
| `src/growth/` | **Organic growth** — HQSplitting, GrowthPacing, OrganicUnlocks, SiteSelectionRules | 4 |
| `src/ecs/` | Miniplex ECS world, archetypes, systems, factories | ~20 |
| `src/engine/` | Legacy game logic (GameState, SimTick) | ~13 |
| `src/scene/` | R3F/drei 3D components | ~25 |
| `src/scene/celestial/` | **Celestial Body Factory** — sphere↔flat morphing, 4 body types, Dyson shell | 5 |
| `src/ui/` | React Native overlay components + **BuildingPanelContent/** + **hq-tabs/** | ~70 |
| `src/content/` | Dialogue pools, worldbuilding content | ~20 |
| `src/bridge/` | ECS ↔ React bridge | 3 |
| `src/hooks/` | React hooks (useGameState, useGameLoop) | 3 |
| `src/audio/` | Web Audio music player | 3 |
| `src/db/` | SQLite (sql.js) + Drizzle ORM | 2 |
| `src/xr/` | WebXR (AR/VR) support | 3 |

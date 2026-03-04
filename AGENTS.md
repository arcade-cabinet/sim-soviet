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
| `src/ai/agents/` | **Yuka domain agents** (8 subpackages: core, economy, political, infrastructure, social, workforce, narrative, meta) | ~123 |
| `src/game/` | Thin orchestrator (SimulationEngine ~1126 lines) + shared infra (era, Chronology, SeedSystem, SaveSystem) | ~15 |
| `src/ecs/` | Miniplex ECS world, archetypes, systems, factories | ~20 |
| `src/engine/` | Legacy game logic (GameState, SimTick) | ~13 |
| `src/scene/` | R3F/drei 3D components | ~25 |
| `src/ui/` | React Native overlay components | ~55 |
| `src/content/` | Dialogue pools, worldbuilding content | ~20 |
| `src/bridge/` | ECS ↔ React bridge | 3 |
| `src/hooks/` | React hooks (useGameState, useGameLoop) | 3 |
| `src/audio/` | Web Audio music player | 3 |
| `src/db/` | SQLite (sql.js) + Drizzle ORM | 2 |
| `src/xr/` | WebXR (AR/VR) support | 3 |

# SimSoviet 1917 — Agent Navigation

> Satirical 3D city-builder set in the Soviet Union (starting 1917).
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
| `src/game/` | ECS game systems (SimulationEngine, demographics, political, economy) | ~107 |
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

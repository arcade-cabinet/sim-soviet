# SimSoviet 1917 — Agent Navigation

> Soviet bureaucrat survival sim. 1.0 is a historical Soviet campaign from 1917 through 1991, followed by grounded same-settlement free play.

## Quick Start

1. Read `CLAUDE.md` for the current product scope and commands.
2. Read `memory-bank/AGENTS.md` for concise project context.
3. Read `docs/AGENTS.md` for the documentation index.

## Current 1.0 Scope

- Keep: settlement simulation, organic growth, historical eras, food/industry/power/transport/politics/KGB/demographics/narrative, classical pressure domains, historical crises, Soviet models/audio/UI, main playable loop.
- Remove: deep future, Kardashev, space/world/per-world timelines, post-scarcity pressure, celestial rendering, multi-settlement relocation, freeform chaos mode.
- Post-1991: continue the same settlement with grounded local pressures only.

## Key Source Directories

| Directory | Purpose |
| --- | --- |
| `src/game/` | Simulation engine, era system, save system, core orchestration |
| `src/game/engine/` | Tick phases: chronology, production, consumption, social, political, narrative, finalize |
| `src/ai/agents/` | Economy, political, infrastructure, social, workforce, narrative, meta, crisis agents |
| `src/ai/agents/crisis/pressure/` | Classical pressure accumulation and crisis emergence |
| `src/growth/` | Organic local settlement growth |
| `src/ecs/` | Miniplex ECS world, archetypes, systems, factories |
| `src/scene/` | Local settlement R3F scene |
| `src/ui/` | React Native overlays, HQ tabs, reports, campaign completion UI |
| `src/content/` | Dialogue and worldbuilding content for the historical campaign |
| `src/config/` | Historical runtime configs |

## Verification

Use the same checks expected for code changes:

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```

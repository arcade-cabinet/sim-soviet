# Design Documents - Agent Index

Each design document describes one historical campaign system. Prefer
`docs/GAME_VISION.md` and `docs/GDD-master.md` for current product scope.

## Canonical Design Docs

| Document | Domain | Status |
|----------|--------|--------|
| `overview.md` | Game identity and core loop | implemented |
| `eras.md` | 1917-1991 historical era progression | implemented |
| `economy.md` | Planned economy, quotas, materials, storage, heating | implemented |
| `workers.md` | Worker roles, lifecycle, and autonomous collective | implemented |
| `demographics.md` | Dvory, family structure, aging, gendered labor | draft/implemented mix |
| `political.md` | Politruks, KGB, military, personnel file, reporting | implemented |
| `scoring.md` | Campaign scoring, consequences, achievements | implemented |
| `era-doctrines.md` | Historical doctrine modifier sets | implemented |
| `ui-ux.md` | Brutalist mobile-first UI | active |
| `ecs-architecture.md` | Miniplex ECS specification | implemented |
| `leader-archetypes.md` | Procedural leader personalities | draft |
| `leadership-architecture.md` | Political ECS modifier pipeline | draft |
| `power-transitions.md` | Succession mechanics | draft |
| `dialog-bible.md` | In-game voice guide | active |

## Current Implemented Systems Without Dedicated Docs

| System | Implementation | Description |
|--------|----------------|-------------|
| Pressure-valve crisis | `src/ai/agents/crisis/pressure/` | Classical local pressure domains and crisis emergence |
| Climate events | `src/ai/agents/crisis/ClimateEventSystem.ts` | Weather and seasonal natural events |
| Black swans | `src/ai/agents/crisis/BlackSwanSystem.ts` | Rare local disasters |
| World backdrop | `src/ai/agents/core/WorldAgent.ts` | Grounded geopolitical tension and Moscow scrutiny |
| Organic growth | `src/growth/` | Demand, site selection, pacing, and HQ splitting |

## Scope Note

1.0 excludes removed future, space, cross-settlement, and abundance-crisis
systems. Do not treat old references to those systems as active design.

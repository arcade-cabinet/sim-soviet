# CLAUDE.md

Operational guidance for agents working in this repository.

## Game Identity

**SimSoviet 1917 is a Soviet bureaucrat survival sim, not a city builder.**

The 1.0 scope is a historical Soviet campaign from **October 1917 through December 1991**. The player is the **predsedatel** of one settlement trying to survive state demands, shortages, political scrutiny, war, famine, corruption, decay, and local disasters. At the 1991 dissolution endpoint, the campaign record closes and the player may continue the same settlement in grounded post-campaign free play.

Post-1991 free play is conservative: no new eras, no new settlements, no space expansion, no alternate global timeline. The same settlement continues with quotas, aging infrastructure, demographic pressure, weather/disasters, political decay, and local management.

The settlement grows organically through agents. The player does not freely place buildings or micromanage workers.

## Player Actions

- Observe the settlement as it self-organizes.
- Respond to five-year plans, quotas, reports, investigations, and mandates.
- Set broad priorities when demands conflict.
- Navigate KGB, party, military, and commissar pressure.
- Make moral choices around sacrifice, corruption, falsification, and emergency overrides.

## Out Of Scope For 1.0

- Kardashev or deep-future eras.
- `the_eternal` or post-scarcity pressure domains.
- Space timelines, world timelines, per-world timelines, Dyson/O'Neill/Mars rendering.
- Multi-settlement relocation or global expansion.
- Freeform chaos branches as a product mode.

## Commands

```bash
pnpm install
pnpm web
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```

Use `pnpm` because `package.json` pins `pnpm@10.28.2`.

## Architecture

- **Frontend**: React Native + Expo + React Three Fiber / Three.js.
- **Simulation**: `src/game/SimulationEngine.ts` orchestrates phase modules under `src/game/engine/`.
- **State**: ECS world is canonical; legacy `GameState` still feeds some scene components.
- **AI agents**: `src/ai/agents/` covers economy, political, infrastructure, social, workforce, narrative, meta, and crisis systems.
- **Campaign eras**: `src/game/era/` and `src/config/eras.json` define the 1917-1991 progression.
- **Scene**: `src/scene/` renders the local settlement only.
- **UI**: `src/ui/` contains overlays, HQ tabs, reports, and campaign completion modal.

## Key Runtime Rules

- New games start the single historical campaign.
- Historical era progression stops at 1991 with `stagnation` as the final era.
- `USSRDissolutionModal` fires once, persists completion state, and either ends the campaign or continues grounded post-campaign free play.
- Post-campaign continuation keeps the historical governor and local settlement mechanics.
- Runtime configs must not expose removed future IDs or resources.

## Code Style

- TypeScript strict mode.
- React Native `StyleSheet.create` for UI styling.
- Monospace Soviet terminal aesthetic: red, gold, terminal green, dark panels.
- Prefer existing agent/ECS patterns over new abstractions.

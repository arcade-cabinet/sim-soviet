# SimSoviet 1917

A Soviet bureaucrat survival sim about managing one settlement through the historical life of the Soviet Union.

The 1.0 campaign runs from **October 1917 through December 1991**. After the 1991 dissolution endpoint, the player can continue the same settlement in grounded free play: no new eras, no new settlements, no space expansion, and no alternate global timeline.

## What This Is

SimSoviet 1917 is not a city builder. The player is the *predsedatel*, a local bureaucrat trying to survive the apparatus. The settlement grows organically through autonomous agents. Moscow and local institutions create the pressure; the player responds through priorities, reports, compromises, and emergency overrides.

## 1.0 Scope

| Phase | Years | Focus |
| --- | --- | --- |
| Historical Campaign | 1917-1991 | Revolution, collectivization, industrialization, WWII, reconstruction, thaw/freeze, stagnation, dissolution |
| Grounded Free Play | 1992+ | Same settlement, same local systems: quotas, aging infrastructure, resource pressure, demographics, weather, disasters, political decay |

## Tech Stack

- Three.js via React Three Fiber + drei
- React Native + Expo
- TypeScript
- Miniplex ECS
- Yuka-style agent architecture
- Drizzle + SQLite persistence

## Quick Start

```bash
pnpm install
pnpm web
```

## Checks

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```

See [CLAUDE.md](./CLAUDE.md) for architecture notes and current product boundaries.

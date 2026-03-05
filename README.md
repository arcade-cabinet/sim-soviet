# SimSoviet 1917

**A Soviet bureaucrat survival sim spanning 100,000 years.**

You are the *predsedatel* (chairman) — a low-level bureaucrat sent to a remote Soviet settlement with a standard allotment of families. Your job: survive the apparatus. The settlement grows organically through autonomous agent systems. The system is the antagonist.

**Play now:** https://arcade-cabinet.github.io/sim-soviet/

## What This Is

SimSoviet 1917 is NOT a city builder. The player does NOT place buildings, choose what to build, or micromanage workers. Moscow mandates what gets built via 5-year plans. The player only chooses WHERE. The optimal strategy is comfortable mediocrity — meeting quotas exactly, being unremarkable. If citizens are happy, that's suspicious. Or they're drunk.

Hard science fiction always lets capitalism win. This game asks: what if the Soviet system survived long enough to reach the conditions communism was theoretically designed for? What if a species that produced both the gulag AND Gagarin could transcend itself through collective action? The answer changes every playthrough.

## Gameplay Scope

| Era | Years | What Happens |
|-----|-------|-------------|
| Historical | 1917-1991 | Real Soviet timeline: Revolution, collectivization, WWII, Cold War, stagnation |
| Post-Soviet | 1991-2100 | Climate adaptation, first domes, sphere dynamics |
| Planetary | 2100-5000 | Moon/Mars colonies, orbital megastructures |
| Type I | ~5000 | Full planetary energy capture |
| Deconstruction | 5000-50000 | Disassemble planets for Dyson swarm |
| Type II Peak | 50000-100000+ | Full solar output captured. NO FTL. The Trap. MegaEarth megacity. |

42 cold branches create emergent alternate history — WWIII, corporate sovereignty, communist universe, FTL discovery, Type V+ transcendence. Each playthrough discovers different branches based on how pressures evolve.

## Tech Stack

- **3D Engine**: Three.js r183 via React Three Fiber v9.5 + drei
- **Platform**: React Native 0.83.2 + Expo 55 (web, iOS, Android)
- **AI**: Yuka-style agent system (9 subpackages, 170+ files, 40k+ lines)
- **State**: ECS world (SimulationEngine) + miniplex
- **Database**: sql.js (Wasm SQLite) + Drizzle ORM
- **Build**: TypeScript 5.9, Metro bundler, pnpm

## Quick Start

```bash
pnpm install
expo start --web       # Dev server → http://localhost:3000
```

### Other platforms

```bash
npx react-native run-ios      # iOS simulator
npx react-native run-android  # Android emulator
```

### Testing

```bash
pnpm test              # 6,606 tests across 275 suites
pnpm run typecheck     # TypeScript strict mode
pnpm run lint          # Biome linter
pnpm run test:e2e      # Playwright E2E
```

## Architecture

The simulation runs a 27-step tick decomposed into 7 phase modules. 27 Yuka-style agents organized into 9 domain packages handle everything from food production to KGB surveillance to Dyson sphere maintenance. Pressure accumulates across 15 domains (10 classical + 5 post-scarcity) and crises emerge organically when gauges redline.

Multiple settlements run independently with per-settlement agent trees. The WorldAgent models geopolitical context — 14 countries aggregating into 6 spheres with Khaldun/Turchin civilizational cycles driving governance transitions across millennia.

See [CLAUDE.md](./CLAUDE.md) for full architecture documentation.

## Releases

Every release automatically:
- Deploys to [GitHub Pages](https://arcade-cabinet.github.io/sim-soviet/)
- Builds a debug Android APK (attached to the release)
- Builds an iOS simulator archive

## License

All rights reserved.

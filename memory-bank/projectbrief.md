# Project Brief

## Identity

**SimSoviet 1917** — A satirical Soviet bureaucrat survival sim in 3D. The player is the predsedatel (chairman) of a collective settlement. The settlement grows organically via autonomous agent systems — the player does NOT place buildings or choose what to build. Moscow mandates construction; the player chooses WHERE and navigates political survival.

**THIS IS NOT A CITY BUILDER.** The system is the antagonist. The optimal strategy is comfortable mediocrity.

## Core Fantasy

You are a low-level Soviet bureaucrat trying not to end up in Siberia. Workers self-organize. The five-year plan dictates what gets built. You navigate politics, set priorities, and intervene only when desperate. If citizens are happy, that's suspicious — or they're drunk.

## Target Platforms

- **Web** (primary) — deployed to GitHub Pages
- **iOS** — via Expo/React Native
- **Android** — via Expo/React Native (APK builds)

## Tech Stack Summary

- **3D Engine**: Three.js r183 via React Three Fiber (R3F v9.5) + drei
- **UI**: React Native 0.81 + Expo 54
- **AI**: Yuka-style agent system (8 subpackages, 123+ files)
- **State**: Miniplex ECS world + legacy GameState singleton
- **Audio**: Web Audio API (52 Soviet-era public domain tracks)
- **Database**: sql.js (Wasm SQLite) + Drizzle ORM → IndexedDB
- **Build**: Expo, Metro bundler, TypeScript 5.7

## Core Gameplay Loop

1. Watch the settlement self-organize (workers auto-assign, paths form organically)
2. Respond to state demands (Moscow mandates buildings — you choose WHERE to place them)
3. Set collective priorities when demands conflict (food vs quotas vs construction)
4. Navigate political apparatus (KGB, politruks, Politburo)
5. Make moral choices (who to sacrifice, corruption level, report falsification)
6. Survive inspections, purges, and era transitions
7. Progress through 8 historical eras (1917 → The Eternal)

## Game Modes

- **Historical** (default) — real Soviet timeline, governor fires crises by year
- **Freeform** — ChaosEngine drives emergent alternate history
- No classic/manual difficulty mode

## Consequence Levels (Soviet nomenclature)

- **Rehabilitated** — transferred, return after 1 year
- **Gulag** — exiled, return after 3 years (default)
- **Rasstrelyat** — shot, game over, no return

## Repository

- GitHub: `arcade-cabinet/sim-soviet`
- Deployed: https://arcade-cabinet.github.io/sim-soviet/
- Current version: v1.1.3

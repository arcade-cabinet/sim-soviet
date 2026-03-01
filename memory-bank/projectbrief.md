# Project Brief

## Identity

**SimSoviet 1917** — A satirical 3D city-builder set in an alternate-history Soviet Union that never collapses. Players build structures and manage resources (rubles, food, vodka, power, population) against 5-year plan quotas imposed by an ever-present bureaucratic apparatus.

## Core Fantasy

You are a low-level Soviet bureaucrat trying to survive. The system is the enemy — not external threats. The optimal strategy is being unremarkable. Workers self-organize; you navigate politics.

## Target Platforms

- **Web** (primary) — deployed to GitHub Pages
- **iOS** — via Expo/React Native
- **Android** — via Expo/React Native (APK builds)

## Tech Stack Summary

- **3D Engine**: Three.js r183 via React Three Fiber (R3F v9.5) + drei
- **UI**: React Native 0.81 + Expo 54
- **State**: Miniplex ECS world + legacy GameState singleton
- **Audio**: Web Audio API (52 Soviet-era public domain tracks)
- **Database**: sql.js (Wasm SQLite) + Drizzle ORM → IndexedDB
- **Build**: Expo, Metro bundler, TypeScript 5.7

## Core Gameplay Loop

1. Receive mandates from the State (5-year plans)
2. Place buildings and allocate workers
3. Manage resources (food, vodka, power, water, money)
4. Navigate political apparatus (KGB, politruks, Politburo)
5. Survive inspections, purges, and era transitions
6. Progress through 8 historical eras (1917 → The Eternal)

## Repository

- GitHub: `arcade-cabinet/sim-soviet`
- Deployed: https://arcade-cabinet.github.io/sim-soviet/
- Current version: v1.1.2

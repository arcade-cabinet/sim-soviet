# Project Brief

## Identity

**SimSoviet 1917** is a satirical Soviet bureaucrat survival sim in 3D. The
player is the predsedatel of a collective settlement. The settlement grows
organically through autonomous systems; the player does not freely choose
buildings or draw a city.

**This is not a city builder.** Moscow and local demand determine what pressure
the settlement is under. The player sets priorities, survives inspections, and
manages the political consequences of failure.

## 1.0 Campaign Scope

The 1.0 campaign is historical:

- Start: October 1917.
- End: the 1991 Soviet dissolution moment.
- Post-campaign: same-settlement grounded free play.

Post-1991 continuation is conservative. It keeps quotas, aging infrastructure,
resource pressure, weather, disasters, demographic decline, and political decay.
It does not unlock new eras, new settlements, space expansion, or alternate
global timelines.

## Core Fantasy

You are a low-level Soviet bureaucrat trying not to be blamed. Workers
self-organize. The plan dictates what gets built. You navigate shortages,
compulsory deliveries, KGB scrutiny, moral compromise, and the personnel file.
Comfortable mediocrity is often the best strategy.

## Target Platforms

- Web via Expo/React Native Web and GitHub Pages.
- iOS via Expo/React Native.
- Android via Expo/React Native builds.

## Tech Stack Summary

- 3D: Three.js via React Three Fiber and drei.
- UI: React Native + Expo.
- Simulation: Yuka-style agent systems plus Miniplex ECS.
- Audio: Web Audio API.
- Persistence: Expo SQLite and web SQLite flow.
- Build/test: TypeScript, Jest, Vitest browser, Playwright, Expo.

## Core Gameplay Loop

1. Watch the settlement self-organize.
2. Respond to Moscow mandates and quotas.
3. Set collective priorities when food, industry, construction, and politics collide.
4. Review reports, pressure, and institutional demands.
5. Manage KGB, politruks, party demands, personnel marks, and moral tradeoffs.
6. Survive historical era transitions through 1991.
7. Review campaign completion, then optionally continue the same settlement.

## Consequence Levels

- Rehabilitated - transferred, later return.
- Gulag - exiled, later return.
- Rasstrelyat - shot, game over.

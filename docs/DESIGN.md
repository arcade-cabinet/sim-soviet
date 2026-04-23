---
title: Design
updated: 2026-04-23
status: current
domain: product
---

# SimSoviet 1917 - Game Design

This document owns the current product identity and the map of every gameplay
pillar. Detailed mechanics live under [`design/`](./design/README.md).

## Identity

SimSoviet 1917 is a **bureaucratic survival sim**, not a freeform city builder.
The player governs one Soviet settlement through the life of the Soviet Union,
surviving pressure from quotas, shortages, weather, politics, KGB scrutiny,
historical crises, and institutional decay.

The player is a **predsedatel** with constrained leverage. The settlement grows
through agents and local demand; the player's job is to read reports, set
priorities, absorb punishment, and decide who pays when the plan breaks.

## 1.0 Promise

- Start in **1917**.
- End the scored historical campaign in **1991**.
- Offer **grounded continuation** with the same settlement after the summary.
- Keep the product centered on local Soviet management pressure, not fantasy
  escalation.

## Pillar Map

| Pillar | What It Covers | Canonical Doc |
| --- | --- | --- |
| Historical campaign | Era structure, pacing, completion, continuation | [design/eras.md](./design/eras.md) |
| Economy and quotas | Food, industry, storage, heating, materials, compulsory deliveries | [design/economy.md](./design/economy.md) |
| Workers and labor | Roles, assignment logic, morale, loyalty, self-organization | [design/workers.md](./design/workers.md) |
| Demographics | Dvory, births, deaths, aging, gendered labor, retirement | [design/demographics.md](./design/demographics.md) |
| Politics and coercion | Party pressure, KGB, investigations, reports, black marks | [design/political.md](./design/political.md) |
| Pressure and scoring | Crisis pressure, achievements, consequences, campaign scoring | [design/scoring.md](./design/scoring.md) |
| Minigames | Crisis interactions, event resolutions, reward/risk side systems | [design/minigames.md](./design/minigames.md) |
| UI and presentation | HUD, panels, reports, menu flow, onboarding tone | [design/ui-ux.md](./design/ui-ux.md) |
| Narrative voice | Advisor writing, tone, event/dialog style | [design/dialog-bible.md](./design/dialog-bible.md) |
| Technical simulation shape | ECS, phase orchestration, data ownership | [design/ecs-architecture.md](./design/ecs-architecture.md) |
| Leadership systems | Archetypes, transitions, political power behavior | [design/leader-archetypes.md](./design/leader-archetypes.md), [design/power-transitions.md](./design/power-transitions.md), [design/leadership-architecture.md](./design/leadership-architecture.md) |

## Game Loop

1. The settlement grows and allocates labor autonomously.
2. Moscow and the wider historical context impose demands.
3. Pressures accumulate across local survival and political systems.
4. The player responds through priorities, reports, interventions, and
   selective dishonesty.
5. The era advances, the settlement changes, and the personnel file records the
   cost.

## What The Game Is Not

- Not a zone-painting or road-drawing sandbox.
- Not a future USSR fantasy.
- Not a multi-settlement empire game.
- Not a world-map strategy layer.
- Not a space-race colonization game.

## Remaining Design Work

The design is playable but not finished. The active design runway is:

- better onboarding;
- stronger differentiation between eras;
- clearer consequence communication;
- tighter panel and report hierarchy;
- late-era tuning so decline stays tense rather than merely slow.

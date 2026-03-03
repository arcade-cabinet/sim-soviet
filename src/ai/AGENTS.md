# AI System — Agent Architecture

This directory contains the Yuka-based AI agent system for SimSoviet 1917.

## Overview

The AI system uses [Yuka](https://mugen87.github.io/yuka/) autonomous agents extending `Vehicle` for game simulation. An `AgentManager` registers all agents with a shared `EntityManager` and drives per-tick updates.

## Directory Structure

```
src/ai/
  AgentManager.ts       # Registers 14 agents, drives EntityManager tick loop
  telegrams.ts          # MSG enum — inter-agent message types
  agents/               # 14 domain agents organized into 5 subpackages
    ChairmanAgent.ts    # Top-level orchestrator (not in a subpackage)
    core/               # Time and weather
    economy/            # Production, food, vodka, storage, trudodni
    political/          # Eras, KGB, loyalty
    infrastructure/     # Power, collective construction
    social/             # Demographics, defense (fire + disease)
```

## Agent Subpackages

| Subpackage       | Agents                                         | Domain                        |
|------------------|-------------------------------------------------|-------------------------------|
| `core/`          | ChronologyAgent, WeatherAgent                   | Time, seasons, weather        |
| `economy/`       | EconomyAgent, FoodAgent, VodkaAgent, StorageAgent| Production, trade, storage    |
| `political/`     | PoliticalAgent, KGBAgent, LoyaltyAgent           | Eras, quotas, surveillance    |
| `infrastructure/`| PowerAgent, CollectiveAgent                      | Power grid, auto-construction |
| `social/`        | DemographicAgent, DefenseAgent                   | Population, fire, disease     |

## Key Files

- **AgentManager.ts** — Creates and registers all 14 agents with the Yuka EntityManager. Provides autopilot mode control and per-tick update dispatch.
- **telegrams.ts** — Defines the `MSG` enum for all inter-agent telegram message types (e.g., `ERA_TRANSITION`, `EMERGENCY_FIRE`, `QUOTA_DEADLINE`).

## Telegram Protocol

Agents communicate via Yuka's telegram system. Key message flows:

- ChronologyAgent emits `NEW_MONTH`, `NEW_YEAR`, `SEASON_CHANGED`
- PoliticalAgent receives `NEW_YEAR` to check era transitions
- DefenseAgent emits `EMERGENCY_FIRE`, `DISEASE_OUTBREAK`
- EconomyAgent emits `FONDY_DELIVERED`, `BLAT_KGB_RISK`

## Integration

The `SimulationEngine` creates an `AgentManager` and calls `agentManager.update(delta)` each tick. Agents read/write ECS world state directly via archetypes and the Miniplex world.

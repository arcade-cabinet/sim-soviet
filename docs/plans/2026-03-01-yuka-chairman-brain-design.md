---
title: "Yuka Multi-Agent Architecture — Systems as Agents + E2E Playthrough"
type: plan
status: active
plan_status: in-progress
date: 2026-03-01
---

# Yuka Multi-Agent Architecture

## Problem

SimSoviet's simulation is a ~1000-line procedural `tick()` that calls 15+ independent algorithms in hardcoded sequence. Each system directly mutates global state. Adding an AI governor on top of this means the governor must reverse-engineer what happened by reading state afterward — fragile, tightly coupled, and impossible to balance.

## Core Insight

Instead of building a brain that understands 20 algorithms, make every algorithm a **Yuka agent**. The Chairman (player/autopilot) is just another agent in the same world. Systems don't just execute — they *decide*, *negotiate*, and *communicate* via Yuka's inter-entity messaging. The game becomes a multi-agent negotiation where the player is one agent among many.

The E2E playthrough is not a separate test harness — it's just the game running with the ChairmanAgent in autopilot mode.

## Design Decisions

- **Yuka v0.7.8** — GoalEvaluator, Think, FuzzyModule, StateMachine, Telegram messaging
- **Full refactor** — all game systems become Yuka agents (not wrappers)
- **Shared EntityManager** — single `Yuka.EntityManager.update(delta)` replaces the procedural tick
- **Turbo speed mode** — 10x and 100x added to the actual game
- **Per-difficulty success thresholds** — Worker: 95%, Comrade: 75-85%, Tovarish: 40-60%
- **In-game autopilot** — player-facing feature, not test-only

## Architecture

### Yuka EntityManager (replaces SimulationEngine.tick)

```
Yuka EntityManager
├─ ChronologyAgent     time advancement, date/month/year boundaries
├─ WeatherAgent        seasonal cycles, storms, temperature
├─ PowerAgent          power distribution, priority allocation during shortages
├─ FoodAgent           production + consumption + rationing + starvation
├─ VodkaAgent          production + consumption + morale effects
├─ EconomyAgent        trudodni, fondy, blat, stakhanovite, MTS, heating, reforms
├─ StorageAgent        capacity limits, spoilage, seasonal decay
├─ CollectiveAgent     demand detection, auto-builder, worker assignment (existing governor)
├─ DemographicAgent    births, deaths, aging, pregnancy, household formation
├─ KGBAgent            inspections, marks, political surveillance, arrests
├─ PoliticalAgent      era transitions, quota enforcement, annual reports
├─ DefenseAgent        fire, meteor, disease detection + response
├─ LoyaltyAgent        dvor loyalty, sabotage, flight risk
└─ ChairmanAgent       player decisions OR autopilot (GoalEvaluator-driven)
```

### Agent Communication (Yuka Telegrams)

Agents communicate via Yuka's `MessageDispatcher.dispatch()`:

```
FoodAgent → ChairmanAgent:    { type: 'FOOD_SHORTAGE', severity: 0.7, ticksToStarvation: 45 }
KGBAgent → ChairmanAgent:     { type: 'INSPECTION_IMMINENT', targetBuilding: 'farm-3' }
WeatherAgent → ALL:           { type: 'WINTER_APPROACHING', monthsAway: 2 }
DemographicAgent → EconomyAgent: { type: 'LABOR_SURPLUS', idleWorkers: 15 }
ChairmanAgent → CollectiveAgent: { type: 'SET_FOCUS', focus: 'food' }
ChairmanAgent → KGBAgent:     { type: 'OFFER_BRIBE', blatAmount: 3 }
PoliticalAgent → ALL:         { type: 'ERA_TRANSITION', newEra: 'collectivization' }
```

Each agent receives telegrams in `state.onMessage()` or `goal.handleMessage()` and adjusts behavior. No direct state mutation across agent boundaries — only messages.

### Agent Structure (each agent follows this pattern)

```typescript
class FoodAgent extends Vehicle {
  brain: Think<FoodAgent>           // Goal arbitration
  evaluators: GoalEvaluator[]       // Priority goals
  fuzzy: FuzzyModule                // Nuanced decisions
  stateMachine: StateMachine        // Behavioral phases

  // Delegates to existing system for math
  private consumptionSystem: () => ConsumptionResult

  update(delta: number): this {
    this.brain.arbitrate()           // Pick highest-priority goal
    this.brain.execute()             // Run goal logic
    return this
  }
}
```

### The 13 Agents — Goals and Responsibilities

#### ChronologyAgent
- **Purpose**: Advance game clock (ticks → hours → days → months → years)
- **Goals**: AdvanceTime (always active, deterministic)
- **Emits**: `NEW_MONTH`, `NEW_YEAR`, `NEW_SEASON` telegrams to all agents
- **Complexity**: Low (deterministic clock, no fuzzy logic needed)

#### WeatherAgent
- **Purpose**: Seasonal weather cycles, storms, temperature
- **Goals**: SeasonCycle, StormGeneration
- **Fuzzy**: stormSeverity, temperatureModifier
- **Emits**: `WEATHER_CHANGED`, `WINTER_APPROACHING`, `STORM_WARNING`
- **Receives**: `NEW_MONTH` from ChronologyAgent

#### PowerAgent
- **Purpose**: Distribute power from plants to buildings
- **Goals**: MaximizeCoverage, PrioritizeCritical
- **Fuzzy**: powerUrgency (demand vs supply ratio)
- **Emits**: `POWER_SHORTAGE`, `BUILDING_UNPOWERED`
- **Decision**: During shortages, decides which buildings get power first (farms > housing > industry). Currently hardcoded, now a goal-driven priority.

#### FoodAgent
- **Purpose**: Food production, consumption, rationing, starvation
- **Goals**: FeedPopulation, BuildReserves, RationDuringShortage
- **Fuzzy**: foodUrgency (per-capita food mapped to LeftShoulder/Triangular/RightShoulder)
- **StateMachine**: Surplus → Stable → Rationing → Starvation
- **Emits**: `FOOD_SHORTAGE`, `STARVATION_WARNING`, `FOOD_SURPLUS`
- **Decision**: Rationing strategy during shortage (feed children first? workers first? equal?)
- **Wraps**: consumptionSystem math + productionSystem food output

#### VodkaAgent
- **Purpose**: Vodka production, consumption, morale effects
- **Goals**: MaintainSupply, BoostMorale
- **Emits**: `VODKA_SHORTAGE`, `MORALE_BOOST`
- **Decision**: Divert grain to vodka production vs food (grain→vodka conversion)

#### EconomyAgent
- **Purpose**: Trudodni accounting, fondy distribution, blat network, reforms
- **Goals**: MeetTrudodniNorms, ManageBlat, ImplementReforms
- **Fuzzy**: economicHealth, reformUrgency
- **StateMachine**: NormalOperations → CrisisMode → ReformPeriod
- **Emits**: `TRUDODNI_SHORTFALL`, `BLAT_OPPORTUNITY`, `REFORM_AVAILABLE`
- **Receives**: `ERA_TRANSITION` (adapts economic model per era)

#### StorageAgent
- **Purpose**: Capacity management, food spoilage
- **Goals**: PreventSpoilage, ExpandCapacity
- **Emits**: `STORAGE_FULL`, `FOOD_SPOILED`

#### CollectiveAgent
- **Purpose**: Demand detection, auto-builder, worker assignment
- **Goals**: HousingDemand, FoodProductionDemand, InfrastructureDemand
- **Fuzzy**: constructionUrgency, laborAvailability
- **Emits**: `BUILDING_PLACED`, `WORKER_ASSIGNED`, `DEMAND_UNMET`
- **Receives**: `SET_FOCUS` from ChairmanAgent, `LABOR_SURPLUS` from DemographicAgent
- **Wraps**: Existing governor.ts + autoBuilder.ts + demandSystem.ts

#### DemographicAgent
- **Purpose**: Births, deaths, aging, pregnancy, household formation
- **Goals**: SustainPopulation, ManageLabor
- **Fuzzy**: laborCapacity (age distribution quality)
- **Emits**: `LABOR_SHORTAGE`, `LABOR_SURPLUS`, `POPULATION_MILESTONE`
- **Receives**: `ERA_TRANSITION` (adjusts birth rates per era)
- **Wraps**: demographicSystem.ts + citizenFactories.ts

#### KGBAgent
- **Purpose**: Political surveillance, inspections, arrests
- **Goals**: FindDissent, EnforceCompliance, PunishFailure
- **Fuzzy**: suspicionLevel (based on player behavior, marks, quota performance)
- **StateMachine**: Watching → Investigating → Arresting
- **Emits**: `INSPECTION_IMMINENT`, `MARKS_INCREASED`, `ARREST_WARRANT`
- **Receives**: `OFFER_BRIBE` from ChairmanAgent
- **Decision**: KGB aggression varies by difficulty preset AND by its own assessment of the Chairman's loyalty

#### PoliticalAgent
- **Purpose**: Era transitions, quota enforcement, 5-year plan management
- **Goals**: EnforceQuota, TransitionEra
- **Emits**: `ERA_TRANSITION`, `QUOTA_DEADLINE`, `PLAN_UPDATED`, `ANNUAL_REPORT_DUE`
- **Receives**: `NEW_YEAR` from ChronologyAgent

#### DefenseAgent
- **Purpose**: Fire, meteor, disease detection and response
- **Goals**: ContainFire, EvacuateMeteor, QuarantineDisease
- **Emits**: `EMERGENCY_FIRE`, `EMERGENCY_METEOR`, `DISEASE_OUTBREAK`
- **Decision**: Resource allocation during emergencies (divert workers? spend resources?)

#### LoyaltyAgent
- **Purpose**: Dvor loyalty tracking, sabotage, flight risk
- **Goals**: MaintainLoyalty, PreventFlight
- **Fuzzy**: dvorLoyalty (food level + quota met + political climate)
- **Emits**: `DVOR_DISLOYAL`, `SABOTAGE_EVENT`, `FLIGHT_RISK`
- **Receives**: `FOOD_SHORTAGE` from FoodAgent, `ERA_TRANSITION` from PoliticalAgent

#### ChairmanAgent (THE PLAYER)
- **Purpose**: Make all player-level decisions
- **Goals**: SurvivalGoal, QuotaGoal, PoliticalGoal, GrowthGoal, DefenseGoal
- **Fuzzy**: foodUrgency, politicalRisk, growthPotential
- **StateMachine**: Assess → Plan → Execute
- **Receives**: ALL telegrams from all other agents
- **Emits**: `SET_FOCUS` to CollectiveAgent, `OFFER_BRIBE` to KGBAgent, minigame/report decisions

**Player mode**: ChairmanAgent receives telegrams but surfaces them as UI events (toasts, modals, advisor messages). Player makes decisions via UI, which the agent executes.

**Autopilot mode**: ChairmanAgent's GoalEvaluator processes telegrams and makes decisions automatically via `brain.arbitrate()`.

### Minigame Decision Logic (ChairmanAgent)

Each `MinigameChoice` has `successChance`, `onSuccess.blackMarks/commendations/blat`, `onFailure`. The PoliticalGoal evaluates:

```
EV(choice) = successChance × value(onSuccess) + (1 - successChance) × value(onFailure)
value(outcome) = commendations + blat - (blackMarks × politicalRiskWeight)
```

Picks the choice that maximizes EV, where `politicalRiskWeight` increases when marks are high (risk-averse under pressure).

### Annual Report Strategy (ChairmanAgent)

- `quotaMet >= 100%` → honest report (safe, earns commendations)
- `quotaMet 60-100%` → falsify if politicalRisk fuzzy value is below 0.5
- `quotaMet < 60%` → honest (falsification too risky when gap is obvious)

## Turbo Speed Mode

| Level | Speed | UI Button | Use Case |
|---|---|---|---|
| 0 | Pause | ‖ | Existing |
| 1 | 1x | ▶ | Existing |
| 2 | 2x | ▶▶ | Existing |
| 3 | 3x | ▶▶▶ | Existing |
| 4 | 10x | ⏩ | Fast-forward through quiet periods |
| 5 | 100x | ⏩⏩ | Turbo — skip to next event/year |

**Implementation**: `useGameLoop.ts` calls `entityManager.update(delta)` (replacing `engine.tick()`). At turbo speeds, multiple updates per frame with reduced render frequency.

**Autopilot + turbo**: ChairmanAgent auto-resolves minigames/modals instantly, so turbo never pauses for player input.

## E2E Playthrough

The playthrough is not a separate test harness. It's the game running in autopilot + turbo mode.

### Playwright Test Flow

```
1. Start new game (per-difficulty)
2. Enable ChairmanAgent autopilot
3. Set speed to turbo (100x)
4. Every year boundary:
   - Brief pause for React re-render
   - Screenshot → e2e/screenshots/{difficulty}-{seed}/{year}.png
   - Log: population, food, era, buildings, marks
5. Verify sustainability checkpoints:
   - Year 5: population > starting
   - Year 20: settlement tier > selo
   - Year 50: has entered era 3+
   - Year 100: population > 200
   - Year 200: still alive (game not over)
6. Record final score, pass/fail
```

### Per-Difficulty Success Matrix

| Difficulty | Runs | Pass Threshold | Timeout/Run |
|---|---|---|---|
| Worker | 5 | 95% (≥5/5) | 5 min |
| Comrade | 10 | 75% (≥8/10) | 5 min |
| Tovarish | 10 | 40% (≥4/10) | 5 min |

These thresholds serve as **difficulty calibration**: if Worker drops below 95% or Tovarish exceeds 60%, the game balance needs adjustment.

## File Structure

```
src/ai/
├── AgentManager.ts             # Yuka EntityManager wrapper, replaces SimulationEngine.tick()
├── agents/
│   ├── ChronologyAgent.ts      # Time advancement
│   ├── WeatherAgent.ts         # Seasons, storms
│   ├── PowerAgent.ts           # Power distribution
│   ├── FoodAgent.ts            # Food production + consumption + rationing
│   ├── VodkaAgent.ts           # Vodka production + consumption
│   ├── EconomyAgent.ts         # Trudodni, fondy, blat, reforms
│   ├── StorageAgent.ts         # Capacity, spoilage
│   ├── CollectiveAgent.ts      # Demand detection, auto-builder, governor
│   ├── DemographicAgent.ts     # Births, deaths, aging, households
│   ├── KGBAgent.ts             # Inspections, marks, arrests
│   ├── PoliticalAgent.ts       # Eras, quotas, plans
│   ├── DefenseAgent.ts         # Fire, meteor, disease response
│   ├── LoyaltyAgent.ts         # Dvor loyalty, sabotage, flight
│   └── ChairmanAgent.ts        # Player decisions / autopilot
├── goals/                       # Shared GoalEvaluator implementations
│   ├── SurvivalGoal.ts
│   ├── QuotaGoal.ts
│   ├── PoliticalGoal.ts
│   ├── GrowthGoal.ts
│   └── DefenseGoal.ts
├── fuzzy/                       # FuzzyModule configurations
│   └── GameFuzzy.ts            # All fuzzy linguistic variables + rules
├── decisions/                   # Decision-making utilities
│   ├── MinigameDecider.ts      # Expected-value minigame choice picker
│   └── ReportDecider.ts        # Annual report strategy
└── telegrams.ts                # Typed telegram definitions (all message types)
```

## Migration Strategy

### Phase 1: Yuka infrastructure + ChairmanAgent
Install Yuka. Create AgentManager, ChairmanAgent, turbo speed mode. ChairmanAgent handles minigames/reports while existing systems continue as-is. The E2E playthrough works at this stage.

### Phase 2: Convert core decision-making systems
KGBAgent, PoliticalAgent, CollectiveAgent, EconomyAgent — the systems that genuinely benefit from goal-driven AI. Replace their procedural code with Yuka agents. Telegram communication between agents.

### Phase 3: Convert remaining systems
FoodAgent, VodkaAgent, WeatherAgent, DemographicAgent, etc. Each conversion makes one more system a Yuka agent. Tests adapt incrementally.

### Phase 4: Remove SimulationEngine.tick()
Once all systems are agents, `SimulationEngine.tick()` becomes `AgentManager.update(delta)`. The 1000-line procedural orchestrator is replaced by Yuka's entity manager.

## Serialization

All Yuka agents support `toJSON()`/`fromJSON()` out of the box. Save/load serializes the entire AgentManager state, replacing the current piecemeal serialization.

## What This Enables

- **Emergent gameplay**: Agents negotiate rather than follow scripts. KGB behavior emerges from its goals, not hardcoded thresholds.
- **Difficulty through agent tuning**: Worker difficulty = friendly KGB (low suspicion bias). Tovarish = paranoid KGB (high suspicion bias). Same agent, different characterBias.
- **Testability**: Each agent testable in isolation. Feed it telegrams, verify its decisions.
- **Balance calibration**: E2E playthroughs reveal which agents are too aggressive or too passive.
- **Future expansion**: New game systems = new agents, plugged into the same EntityManager. No changes to the orchestrator.

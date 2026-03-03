# Agent Directory

14 Yuka `Vehicle`-based agents organized into 5 domain subpackages.

## Agent Inventory

| # | Agent              | Subpackage       | Absorbed Systems                                       | Key Telegrams                          |
|---|--------------------|------------------|--------------------------------------------------------|----------------------------------------|
| 1 | ChairmanAgent      | (top-level)      | Top-level orchestrator                                  | Receives all, delegates decisions      |
| 2 | ChronologyAgent    | core/            | ChronologySystem.ts                                     | NEW_MONTH, NEW_YEAR, SEASON_CHANGED    |
| 3 | WeatherAgent       | core/            | WeatherSystem.ts (weather rolling)                      | WEATHER_CHANGED                        |
| 4 | EconomyAgent       | economy/         | economy.ts (EconomySystem class), TrudodniSystem.ts     | FONDY_DELIVERED, BLAT_KGB_RISK, STAKHANOVITE_EVENT |
| 5 | FoodAgent          | economy/         | PrivatePlotSystem.ts                                    | FOOD_CRISIS, FOOD_SURPLUS              |
| 6 | VodkaAgent         | economy/         | (vodka production logic)                                | VODKA_SHORTAGE                         |
| 7 | StorageAgent       | economy/         | (storage capacity logic)                                | STORAGE_OVERFLOW, STORAGE_CRITICAL     |
| 8 | PoliticalAgent     | political/       | era/EraSystem.ts, PlanMandates.ts, annualReportTick.ts  | ERA_TRANSITION, QUOTA_DEADLINE, PLAN_UPDATED |
| 9 | KGBAgent           | political/       | PersonnelFile.ts                                        | DVOR_DISLOYAL, ARREST_IMMINENT         |
|10 | LoyaltyAgent       | political/       | LoyaltySystem.ts                                        | SABOTAGE_EVENT, FLIGHT_RISK            |
|11 | PowerAgent         | infrastructure/  | (power distribution logic)                              | POWER_OUTAGE, POWER_RESTORED           |
|12 | CollectiveAgent    | infrastructure/  | governor.ts, demandSystem.ts, autoBuilder.ts, CollectivePlanner.ts | AUTO_BUILD, DEMAND_DETECTED  |
|13 | DemographicAgent   | social/          | demographicSystem.ts (agent wrapper)                    | BIRTH, DEATH, AGING                    |
|14 | DefenseAgent       | social/          | FireSystem.ts, DiseaseSystem.ts                         | EMERGENCY_FIRE, DISEASE_OUTBREAK       |

## Subpackage Details

### core/ — Time and Weather

- **ChronologyAgent** — Advances game time (ticks, days, months, years, seasons). Emits temporal telegrams that drive all other agents.
- **WeatherAgent** — Rolls weather each season using probability tables. Weather affects farming, construction, fire spread, and movement.
- **weather-types.ts** — Shared WeatherType enum, WeatherProfile interface, SEASON_WEATHER probability tables. Canonical location for weather types used across the codebase.

### economy/ — Production and Trade

- **EconomyAgent** — Central planned economy simulation: trudodni accrual, fondy delivery, blat risk, rations, MTS rental, currency reform, heating, production chains, consumer goods. State machine: NormalOperations / CrisisMode / ReformPeriod.
- **FoodAgent** — Private plot food production per dvor. Era-dependent yield multipliers.
- **VodkaAgent** — Vodka production monitoring and demand assessment.
- **StorageAgent** — Storage capacity tracking and overflow management.
- **trudodni.ts** — Standalone trudodni (work-day) accrual system with per-building tracking. 7-category system (1930-1966) with gender-differentiated labor values.

### political/ — Eras, Quotas, Surveillance

- **PoliticalAgent** — Era transitions (8 Soviet eras from Revolution to Eternal), 5-year plan quota enforcement, mandate generation and fulfillment, annual report management. Absorbs EraSystem and PlanMandates logic.
- **KGBAgent** — KGB threat tracking: black marks, commendations, investigations, informants, arrest probability. Absorbs PersonnelFile logic.
- **LoyaltyAgent** — Per-dvor loyalty assessment. Loyalty drives sabotage (10% chance below 20) and flight (5% chance below 10). Food supply is the primary loyalty driver.

### infrastructure/ — Power and Construction

- **PowerAgent** — Power distribution across buildings. Priority-based allocation when supply is insufficient.
- **CollectiveAgent** — Autonomous collective AI: 5-level governor priority stack (survive > state_demand > trudodni > improve > private), threshold-based construction demand detection, Manhattan-distance building placement, mandate+demand queue generation. Absorbs governor.ts, demandSystem.ts, autoBuilder.ts, and CollectivePlanner.ts.

### social/ — Population and Defense

- **DemographicAgent** — Wraps the ECS demographic tick system for agent-based orchestration. Tracks births, deaths, aging, pregnancy, household formation.
- **DefenseAgent** — Fire system (spread, damage, zeppelin AI) and disease system (4 types: typhus, cholera, influenza, scurvy). Monthly outbreak checks with environmental modifiers.
- **disease.ts** — Standalone disease outbreak and recovery system. 4 disease types with spread/mortality rates, medical building prevention, seasonal modifiers.

## Backward Compatibility

Several agents export backward-compatible aliases for the deprecated system classes they absorbed:

| Alias                          | Agent             | Original File              |
|--------------------------------|-------------------|----------------------------|
| `ChronologySystem`             | ChronologyAgent   | game/ChronologySystem.ts   |
| `EconomySystem`                | EconomyAgent      | game/economy.ts            |
| `EraSystem`                    | PoliticalAgent    | game/era/EraSystem.ts      |
| `PersonnelFile`                | KGBAgent          | game/PersonnelFile.ts      |
| `FireSystem`                   | DefenseAgent      | game/FireSystem.ts         |
| `CollectivePlanner`            | CollectiveAgent   | game/CollectivePlanner.ts  |

Standalone function re-exports (e.g., `tickLoyalty`, `accrueTrudodni`, `detectConstructionDemands`) provide functional API compatibility for callers that used the deprecated module-level functions.

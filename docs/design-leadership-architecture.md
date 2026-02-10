# Leadership System Architecture — Implementation Blueprint

## Core Design: Modifier Pipeline with ECS Components

Political state lives in ECS components. A singleton `PoliticalSystem` entity holds the current leader, doctrine, and ministry data. A `policyModifierSystem()` runs each tick to calculate composite modifiers consumed by existing systems.

**Composition**: Leader archetype × Era doctrine × Ministry tweaks = final `PolicyModifiers`

## New ECS Components

### Leader
```typescript
interface Leader {
  name: string;
  title: string;
  archetype: string;      // key into LEADER_ARCHETYPES
  doctrine: string;        // key into ERA_DOCTRINES
  approval: number;        // 0-100
  paranoia: number;        // 0-100
  yearsInPower: number;
  portraitId: number;
}
```

### Ministry
```typescript
interface Ministry {
  type: 'production' | 'defense' | 'culture' | 'propaganda' | 'security';
  ministerName: string;
  ministerArchetype: string;
  modifiers: PolicyModifiers;
  loyalty: number;         // 0-100, affects coup chance
}
```

### PolicyModifiers (the computed result)
```typescript
interface PolicyModifiers {
  // Economic
  buildingCostMultiplier: number;
  productionRateMultiplier: number;
  consumptionRateMultiplier: number;
  taxRate: number;
  // Population
  populationGrowthMultiplier: number;
  immigrationRate: number;
  emigrationRate: number;
  // Industrial
  powerEfficiency: number;
  decayRateMultiplier: number;
  pollutionMultiplier: number;
  // Political
  eventWeightModifiers: Record<string, number>;
  quotaMultiplier: number;
  propagandaEffectiveness: number;
  // Citizen
  citizenHappinessModifier: number;
  loyaltyModifier: number;
  fearModifier: number;
  // Flags
  enableConscription: boolean;
  enablePurges: boolean;
  enableCensorship: boolean;
  enableRationing: boolean;
}
```

### Politburo
```typescript
interface Politburo {
  leaderId: string;
  ministryIds: string[];
  lastSuccessionYear: number;
  successionCooldownYears: number;
}
```

## Data Flow

```
Game Tick
→ leadershipSystem (succession checks, approval/paranoia updates)
→ policyModifierSystem (compose Leader × Doctrine × Ministries → PolicyModifiers)
→ powerSystem (reads modifiers.powerEfficiency)
→ productionSystem (reads modifiers.productionRateMultiplier)
→ consumptionSystem (reads modifiers.consumptionRateMultiplier)
→ populationSystem (reads modifiers.populationGrowthMultiplier)
→ EventSystem (reads modifiers.eventWeightModifiers)
→ notifyStateChange → React re-render
```

## Directory Structure

```
src/
├── political/                     [NEW]
│   ├── LeaderArchetypes.ts       — archetype registry with base modifiers
│   ├── EraDoctrine.ts            — doctrine definitions with policy modifiers
│   ├── MinistrySystem.ts         — ministry definitions and loyalty calc
│   ├── NameGenerator.ts          — procedural Russian names
│   └── PolicyEvents.ts           — political event templates
├── ecs/
│   ├── world.ts                  [MODIFY] add Leader, Ministry, PolicyModifiers, Politburo
│   ├── archetypes.ts             [MODIFY] add politburoEntity, leaderEntity, ministries queries
│   └── systems/
│       ├── policyModifierSystem.ts  [NEW] compose modifiers
│       ├── leadershipSystem.ts      [NEW] lifecycle logic
│       ├── powerSystem.ts           [MODIFY] apply modifiers
│       ├── productionSystem.ts      [MODIFY] apply modifiers
│       ├── consumptionSystem.ts     [MODIFY] apply modifiers
│       └── populationSystem.ts      [MODIFY] apply modifiers
├── game/
│   ├── SimulationEngine.ts       [MODIFY] call political systems in tick()
│   └── EventSystem.ts            [MODIFY] apply weight modifiers
└── stores/
    └── gameStore.ts              [DONE] snapshot reads ECS political state directly
```

## Phased Implementation

### Phase 1: ECS Foundation (1-2 days)
- Add component interfaces to world.ts
- Add political queries to archetypes.ts
- Create default PolicyModifiers (all 1.0, no-op)
- Extend GameSnapshot

### Phase 2: Data Registries (2-3 days)
- LeaderArchetypes.ts — 6+ archetypes with base modifiers
- EraDoctrine.ts — 8 era doctrines (now decoupled from years)
- NameGenerator.ts — 50+ first names, 50+ surnames, patronymic rules
- MinistrySystem.ts — 5 ministry types

### Phase 3: Modifier Composition (2 days)
- policyModifierSystem.ts — reads political entities, writes computed modifiers
- leadershipSystem.ts — initializePolitburo(), stub succession
- Wire into SimulationEngine.tick()

### Phase 4: Integrate Modifiers (3 days)
- Apply modifiers in power, production, consumption, population systems
- Apply event weight modifiers in EventSystem
- Apply building cost modifiers in GestureManager

### Phase 5: Leadership Lifecycle (3-4 days)
- Succession triggers: natural death, coup, "health reasons", mysterious disappearance
- triggerSuccession() — generate new leader, reshuffle ministries
- De-[previous leader]-ization mechanic
- Political event templates

### Phase 6: Political Events & UI (3 days)
- Political event templates in PolicyEvents.ts
- React hooks: useLeader(), useMinistries(), usePolicyModifiers()
- Leader portrait display, ministry panel

### Phase 7: Tuning & Polish (2-3 days)
- Balance archetype modifiers
- Tune succession probabilities (1-2 leaders per 20 game-years)
- Playtest full 30-year game

## Key Integration Points

- `getActiveModifiers()` returns default (1.0) modifiers if no leader exists — safe fallback
- All multipliers clamped to [0.1, 10.0] to prevent game-breaking values
- Political components don't use predicate queries → no reindex needed
- Leadership system runs BEFORE modifier system, which runs BEFORE resource systems
- Modifier composition runs once per tick (1s) — negligible cost

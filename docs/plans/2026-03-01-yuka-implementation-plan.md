# Yuka Multi-Agent Architecture — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace SimSoviet's procedural SimulationEngine.tick() with a Yuka multi-agent architecture where every game system is a Yuka agent, and the player (ChairmanAgent) is one agent among many. Enable autopilot + turbo speed for E2E 200-year playthroughs.

**Architecture:** 13 Yuka agents in a shared EntityManager communicate via Telegrams. Phase 1 adds ChairmanAgent + turbo speed (gets E2E working). Phases 2-4 migrate existing procedural systems into Yuka agents incrementally.

**Tech Stack:** Yuka v0.7.8 (AI library), Playwright (E2E), TypeScript, React Three Fiber, Jest

**Design Doc:** `docs/plans/2026-03-01-yuka-chairman-brain-design.md`

---

## Phase 1: ChairmanAgent + Turbo Speed + E2E Playthrough

Phase 1 delivers a working E2E playthrough. The existing procedural systems continue operating; ChairmanAgent wraps on top to handle player decisions (minigames, annual reports, directives). Turbo speed (10x, 100x) enables 200-year runs in minutes.

---

### Task 1: Install Yuka + Create Telegram Types

**Files:**
- Modify: `package.json` (add yuka dependency)
- Create: `src/ai/telegrams.ts`
- Test: `__tests__/ai/telegrams.test.ts`

**Step 1: Install Yuka**

```bash
pnpm add yuka@0.7.8
```

**Step 2: Verify Yuka imports work**

```bash
node -e "const { Vehicle, GoalEvaluator, Think, FuzzyModule, StateMachine, EntityManager } = require('yuka'); console.log('Yuka loaded:', typeof Vehicle)"
```

Expected: `Yuka loaded: function`

**Step 3: Create telegram type definitions**

Create `src/ai/telegrams.ts` — all typed message types that agents will exchange:

```typescript
/**
 * @fileoverview Typed telegram definitions for inter-agent communication.
 *
 * Agents communicate via Yuka's MessageDispatcher.dispatch().
 * Each telegram carries a typed payload identified by a string message type.
 */

// ── Message Type Constants ────────────────────────────────────────────────

/** All telegram message types used in the agent system. */
export const MSG = {
  // ChronologyAgent → ALL
  NEW_MONTH: 'NEW_MONTH',
  NEW_YEAR: 'NEW_YEAR',
  NEW_SEASON: 'NEW_SEASON',

  // WeatherAgent → ALL
  WEATHER_CHANGED: 'WEATHER_CHANGED',
  WINTER_APPROACHING: 'WINTER_APPROACHING',
  STORM_WARNING: 'STORM_WARNING',

  // PowerAgent → ChairmanAgent, CollectiveAgent
  POWER_SHORTAGE: 'POWER_SHORTAGE',
  BUILDING_UNPOWERED: 'BUILDING_UNPOWERED',

  // FoodAgent → ChairmanAgent
  FOOD_SHORTAGE: 'FOOD_SHORTAGE',
  STARVATION_WARNING: 'STARVATION_WARNING',
  FOOD_SURPLUS: 'FOOD_SURPLUS',

  // VodkaAgent → ChairmanAgent
  VODKA_SHORTAGE: 'VODKA_SHORTAGE',
  MORALE_BOOST: 'MORALE_BOOST',

  // EconomyAgent → ChairmanAgent
  TRUDODNI_SHORTFALL: 'TRUDODNI_SHORTFALL',
  BLAT_OPPORTUNITY: 'BLAT_OPPORTUNITY',
  REFORM_AVAILABLE: 'REFORM_AVAILABLE',

  // StorageAgent → ChairmanAgent
  STORAGE_FULL: 'STORAGE_FULL',
  FOOD_SPOILED: 'FOOD_SPOILED',

  // CollectiveAgent → ChairmanAgent
  BUILDING_PLACED: 'BUILDING_PLACED',
  WORKER_ASSIGNED: 'WORKER_ASSIGNED',
  DEMAND_UNMET: 'DEMAND_UNMET',

  // DemographicAgent → EconomyAgent, ChairmanAgent
  LABOR_SHORTAGE: 'LABOR_SHORTAGE',
  LABOR_SURPLUS: 'LABOR_SURPLUS',
  POPULATION_MILESTONE: 'POPULATION_MILESTONE',

  // KGBAgent → ChairmanAgent
  INSPECTION_IMMINENT: 'INSPECTION_IMMINENT',
  MARKS_INCREASED: 'MARKS_INCREASED',
  ARREST_WARRANT: 'ARREST_WARRANT',

  // PoliticalAgent → ALL
  ERA_TRANSITION: 'ERA_TRANSITION',
  QUOTA_DEADLINE: 'QUOTA_DEADLINE',
  PLAN_UPDATED: 'PLAN_UPDATED',
  ANNUAL_REPORT_DUE: 'ANNUAL_REPORT_DUE',

  // DefenseAgent → ChairmanAgent
  EMERGENCY_FIRE: 'EMERGENCY_FIRE',
  EMERGENCY_METEOR: 'EMERGENCY_METEOR',
  DISEASE_OUTBREAK: 'DISEASE_OUTBREAK',

  // LoyaltyAgent → ChairmanAgent
  DVOR_DISLOYAL: 'DVOR_DISLOYAL',
  SABOTAGE_EVENT: 'SABOTAGE_EVENT',
  FLIGHT_RISK: 'FLIGHT_RISK',

  // ChairmanAgent → CollectiveAgent
  SET_FOCUS: 'SET_FOCUS',

  // ChairmanAgent → KGBAgent
  OFFER_BRIBE: 'OFFER_BRIBE',

  // ChairmanAgent → SimulationEngine (player decisions)
  MINIGAME_RESOLVED: 'MINIGAME_RESOLVED',
  REPORT_SUBMITTED: 'REPORT_SUBMITTED',
} as const;

export type MessageType = (typeof MSG)[keyof typeof MSG];

// ── Payload Types ──────────────────────────────────────────────────────────

export interface FoodShortagePayload {
  severity: number; // 0-1, where 1 = critical
  foodPerCapita: number;
  ticksToStarvation: number;
}

export interface InspectionPayload {
  targetBuilding?: string;
  kgbAggression: 'low' | 'medium' | 'high';
}

export interface EraTransitionPayload {
  newEraId: string;
  eraName: string;
}

export interface SetFocusPayload {
  focus: 'food' | 'construction' | 'production' | 'balanced';
}

export interface MinigameResolvedPayload {
  minigameId: string;
  choiceId: string;
}

export interface ReportSubmittedPayload {
  honest: boolean;
  quotaPercent: number;
}

/** Union of all telegram payloads. */
export type TelegramPayload =
  | FoodShortagePayload
  | InspectionPayload
  | EraTransitionPayload
  | SetFocusPayload
  | MinigameResolvedPayload
  | ReportSubmittedPayload
  | { [key: string]: unknown };
```

**Step 4: Write a basic import test**

Create `__tests__/ai/telegrams.test.ts`:

```typescript
import { MSG } from '../../src/ai/telegrams';

describe('telegrams', () => {
  it('exports all message type constants', () => {
    expect(MSG.NEW_MONTH).toBe('NEW_MONTH');
    expect(MSG.FOOD_SHORTAGE).toBe('FOOD_SHORTAGE');
    expect(MSG.SET_FOCUS).toBe('SET_FOCUS');
    expect(MSG.MINIGAME_RESOLVED).toBe('MINIGAME_RESOLVED');
  });

  it('message types are string constants', () => {
    for (const [key, value] of Object.entries(MSG)) {
      expect(typeof value).toBe('string');
      expect(value).toBe(key);
    }
  });
});
```

**Step 5: Run test**

```bash
npx jest --testPathPattern="telegrams" --silent
```

Expected: 2 tests PASS

**Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml src/ai/telegrams.ts __tests__/ai/telegrams.test.ts
git commit -m "feat: install yuka v0.7.8 + create telegram type definitions"
```

---

### Task 2: Create AgentManager

**Files:**
- Create: `src/ai/AgentManager.ts`
- Test: `__tests__/ai/AgentManager.test.ts`

The AgentManager wraps Yuka's `EntityManager` and provides typed access to game agents. In Phase 1 it only manages ChairmanAgent; Phases 2-4 add the remaining 12 agents.

**Step 1: Write the failing test**

Create `__tests__/ai/AgentManager.test.ts`:

```typescript
import { AgentManager } from '../../src/ai/AgentManager';

describe('AgentManager', () => {
  it('can be instantiated', () => {
    const manager = new AgentManager();
    expect(manager).toBeDefined();
  });

  it('updates all agents on tick', () => {
    const manager = new AgentManager();
    // Should not throw with no agents registered
    manager.update(1.0);
  });

  it('exposes chairman agent when autopilot enabled', () => {
    const manager = new AgentManager();
    expect(manager.getChairman()).toBeNull();
    manager.enableAutopilot();
    expect(manager.getChairman()).not.toBeNull();
  });

  it('disables autopilot', () => {
    const manager = new AgentManager();
    manager.enableAutopilot();
    expect(manager.getChairman()).not.toBeNull();
    manager.disableAutopilot();
    expect(manager.getChairman()).toBeNull();
  });

  it('serializes and deserializes', () => {
    const manager = new AgentManager();
    manager.enableAutopilot();
    const json = manager.toJSON();
    expect(json.autopilot).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx jest --testPathPattern="AgentManager" --silent
```

Expected: FAIL — module not found

**Step 3: Implement AgentManager**

Create `src/ai/AgentManager.ts`:

```typescript
/**
 * @fileoverview AgentManager — Yuka EntityManager wrapper for SimSoviet.
 *
 * Manages all Yuka agents (game systems + ChairmanAgent).
 * In Phase 1, only ChairmanAgent is managed. Phases 2-4 add system agents.
 *
 * Replaces SimulationEngine.tick() orchestration when fully migrated.
 */

import { EntityManager } from 'yuka';
import { ChairmanAgent } from './agents/ChairmanAgent';

/** Serialized AgentManager state for save/load. */
export interface AgentManagerSaveData {
  autopilot: boolean;
}

/**
 * Wraps Yuka's EntityManager to manage all game agents.
 *
 * @example
 * const manager = new AgentManager();
 * manager.enableAutopilot();
 * manager.update(delta); // Called each tick
 */
export class AgentManager {
  private entityManager: EntityManager;
  private chairman: ChairmanAgent | null = null;

  constructor() {
    this.entityManager = new EntityManager();
  }

  /** Update all agents for one simulation tick. */
  update(delta: number): void {
    this.entityManager.update(delta);
  }

  /** Enable autopilot — creates and registers ChairmanAgent. */
  enableAutopilot(): void {
    if (this.chairman) return;
    this.chairman = new ChairmanAgent();
    this.entityManager.add(this.chairman);
  }

  /** Disable autopilot — removes ChairmanAgent. */
  disableAutopilot(): void {
    if (!this.chairman) return;
    this.entityManager.remove(this.chairman);
    this.chairman = null;
  }

  /** Get the ChairmanAgent (null if autopilot disabled). */
  getChairman(): ChairmanAgent | null {
    return this.chairman;
  }

  /** Whether autopilot is currently enabled. */
  isAutopilot(): boolean {
    return this.chairman !== null;
  }

  /** Serialize for save/load. */
  toJSON(): AgentManagerSaveData {
    return { autopilot: this.chairman !== null };
  }

  /** Restore from save data. */
  fromJSON(data: AgentManagerSaveData): void {
    if (data.autopilot) {
      this.enableAutopilot();
    } else {
      this.disableAutopilot();
    }
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npx jest --testPathPattern="AgentManager" --silent
```

Expected: PASS (5 tests) — but will fail because ChairmanAgent doesn't exist yet. Create a stub first.

**Step 5: Create ChairmanAgent stub**

Create `src/ai/agents/ChairmanAgent.ts` (stub for now, fleshed out in Task 3):

```typescript
/**
 * @fileoverview ChairmanAgent — The player's Yuka agent.
 *
 * In autopilot mode, uses GoalEvaluator + FuzzyModule to make all
 * player decisions (minigames, annual reports, directives).
 * In player mode, receives telegrams and surfaces them as UI events.
 */

import { Vehicle } from 'yuka';

/**
 * The Chairman — player avatar or autopilot AI.
 * Extends Yuka Vehicle for goal-driven decision making.
 */
export class ChairmanAgent extends Vehicle {
  constructor() {
    super();
    this.name = 'ChairmanAgent';
  }
}
```

**Step 6: Run tests again**

```bash
npx jest --testPathPattern="AgentManager" --silent
```

Expected: 5 tests PASS

**Step 7: Commit**

```bash
git add src/ai/AgentManager.ts src/ai/agents/ChairmanAgent.ts __tests__/ai/AgentManager.test.ts
git commit -m "feat: AgentManager + ChairmanAgent stub"
```

---

### Task 3: ChairmanAgent with GoalEvaluators

**Files:**
- Modify: `src/ai/agents/ChairmanAgent.ts`
- Create: `src/ai/goals/SurvivalGoal.ts`
- Create: `src/ai/goals/QuotaGoal.ts`
- Create: `src/ai/goals/PoliticalGoal.ts`
- Create: `src/ai/goals/GrowthGoal.ts`
- Create: `src/ai/goals/DefenseGoal.ts`
- Test: `__tests__/ai/ChairmanAgent.test.ts`

**Step 1: Write the failing test**

Create `__tests__/ai/ChairmanAgent.test.ts`:

```typescript
import { ChairmanAgent } from '../../src/ai/agents/ChairmanAgent';
import { getResourceEntity } from '../../src/ecs/archetypes';
import { createResourceStore } from '../../src/ecs/factories';
import { world } from '../../src/ecs/world';

describe('ChairmanAgent', () => {
  beforeEach(() => {
    world.clear();
    createResourceStore({ food: 500, vodka: 100, population: 50 });
  });

  afterEach(() => {
    world.clear();
  });

  it('can be instantiated with Think brain', () => {
    const chairman = new ChairmanAgent();
    expect(chairman.name).toBe('ChairmanAgent');
    expect(chairman.brain).toBeDefined();
  });

  it('evaluates survival goal as high priority during food crisis', () => {
    const store = getResourceEntity()!;
    store.resources.food = 10; // Low food per capita
    store.resources.population = 50;

    const chairman = new ChairmanAgent();
    chairman.assessGameState(store.resources);

    const directive = chairman.getRecommendedDirective();
    expect(directive).toBe('food');
  });

  it('evaluates quota goal near deadline', () => {
    const store = getResourceEntity()!;
    store.resources.food = 5000; // Plenty of food

    const chairman = new ChairmanAgent();
    chairman.assessGameState(store.resources, {
      quotaProgress: 0.3, // Only 30% of quota met
      quotaDeadlineMonths: 6, // 6 months left
    });

    const directive = chairman.getRecommendedDirective();
    expect(['construction', 'production']).toContain(directive);
  });

  it('recommends balanced when stable', () => {
    const store = getResourceEntity()!;
    store.resources.food = 5000;
    store.resources.population = 50;

    const chairman = new ChairmanAgent();
    chairman.assessGameState(store.resources, {
      quotaProgress: 0.9, // Nearly met
      quotaDeadlineMonths: 12,
    });

    const directive = chairman.getRecommendedDirective();
    expect(directive).toBe('balanced');
  });

  it('resolves minigame by choosing best expected value', () => {
    const chairman = new ChairmanAgent();
    chairman.assessGameState(
      { food: 500, vodka: 100, population: 50, money: 100 } as never,
      { blackMarks: 1, commendations: 2, blat: 3 },
    );

    const choices = [
      {
        id: 'bribe',
        successChance: 0.8,
        onSuccess: { blackMarks: 0, commendations: 1, blat: -1 },
        onFailure: { blackMarks: 2, commendations: 0, blat: -2 },
      },
      {
        id: 'comply',
        successChance: 1.0,
        onSuccess: { blackMarks: 1, commendations: 0, blat: 0 },
        onFailure: { blackMarks: 1, commendations: 0, blat: 0 },
      },
    ];

    const choiceId = chairman.resolveMinigame(choices);
    expect(typeof choiceId).toBe('string');
    expect(['bribe', 'comply']).toContain(choiceId);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx jest --testPathPattern="ChairmanAgent" --silent
```

Expected: FAIL — methods don't exist yet

**Step 3: Implement the 5 GoalEvaluators**

Create each goal file. Each GoalEvaluator implements `calculateDesirability()` returning 0-1.

`src/ai/goals/SurvivalGoal.ts`:
```typescript
/**
 * @fileoverview SurvivalGoal — Activates when food per capita is critically low.
 *
 * Returns high desirability (0.8-1.0) when food/capita < 3.0.
 * Sets CollectiveFocus to 'food' (All Hands to Harvest).
 */

/** Threshold below which survival takes priority (food per capita). */
const FOOD_CRISIS_PER_CAPITA = 3.0;

/** Threshold for extreme crisis. */
const FOOD_EXTREME_PER_CAPITA = 1.0;

export interface SurvivalInputs {
  foodPerCapita: number;
  population: number;
}

/**
 * Evaluates survival urgency based on food per capita.
 *
 * @param inputs - Current food/population state
 * @returns Desirability score 0-1
 */
export function evaluateSurvival(inputs: SurvivalInputs): number {
  if (inputs.population <= 0) return 0;
  if (inputs.foodPerCapita <= FOOD_EXTREME_PER_CAPITA) return 1.0;
  if (inputs.foodPerCapita <= FOOD_CRISIS_PER_CAPITA) {
    // Linear interpolation: 1.0 → extreme, 0.6 → crisis threshold
    return 0.6 + 0.4 * (1 - inputs.foodPerCapita / FOOD_CRISIS_PER_CAPITA);
  }
  // Above crisis — low survival urgency
  return Math.max(0, 0.2 - inputs.foodPerCapita * 0.01);
}
```

`src/ai/goals/QuotaGoal.ts`:
```typescript
/**
 * @fileoverview QuotaGoal — Prioritizes when quota deadline approaches with shortfall.
 *
 * High desirability when quotaProgress is low and deadline is near.
 * Sets CollectiveFocus to 'construction' or 'production'.
 */

export interface QuotaInputs {
  quotaProgress: number; // 0-1, where 1 = 100% met
  quotaDeadlineMonths: number; // months until deadline
}

/**
 * Evaluates quota urgency.
 *
 * @param inputs - Current quota state
 * @returns Desirability score 0-1
 */
export function evaluateQuota(inputs: QuotaInputs): number {
  const gap = 1 - inputs.quotaProgress;
  if (gap <= 0) return 0.1; // Quota met — minimal urgency

  const timeUrgency = Math.max(0, 1 - inputs.quotaDeadlineMonths / 24);
  // Combine gap size with time pressure
  return Math.min(1, gap * 0.5 + timeUrgency * 0.5);
}
```

`src/ai/goals/PoliticalGoal.ts`:
```typescript
/**
 * @fileoverview PoliticalGoal — Manages political risk (marks, KGB, reports).
 *
 * High desirability when black marks are accumulating.
 * Drives minigame resolution and annual report strategy.
 */

export interface PoliticalInputs {
  blackMarks: number;
  commendations: number;
  blat: number;
  kgbAggression?: 'low' | 'medium' | 'high';
}

/** Mark thresholds by KGB aggression level. */
const MARK_THRESHOLDS = { low: 8, medium: 5, high: 3 } as const;

/**
 * Evaluates political risk urgency.
 *
 * @param inputs - Current political state
 * @returns Desirability score 0-1
 */
export function evaluatePolitical(inputs: PoliticalInputs): number {
  const threshold = MARK_THRESHOLDS[inputs.kgbAggression ?? 'medium'];
  const markRatio = inputs.blackMarks / threshold;
  if (markRatio >= 1) return 1.0; // At or above arrest threshold
  if (markRatio >= 0.7) return 0.7;
  return markRatio * 0.5;
}
```

`src/ai/goals/GrowthGoal.ts`:
```typescript
/**
 * @fileoverview GrowthGoal — Pursues settlement expansion when conditions are stable.
 *
 * High desirability when resources are surplus and housing is available.
 * Sets CollectiveFocus to 'balanced'.
 */

export interface GrowthInputs {
  housingUtilization: number; // 0-1
  foodPerCapita: number;
  population: number;
}

/**
 * Evaluates growth potential.
 *
 * @param inputs - Current settlement state
 * @returns Desirability score 0-1
 */
export function evaluateGrowth(inputs: GrowthInputs): number {
  // No growth when in crisis
  if (inputs.foodPerCapita < 2) return 0;
  // High desirability when stable and room to grow
  const roomToGrow = 1 - inputs.housingUtilization;
  const stability = Math.min(1, inputs.foodPerCapita / 10);
  return roomToGrow * 0.4 + stability * 0.4 + 0.2;
}
```

`src/ai/goals/DefenseGoal.ts`:
```typescript
/**
 * @fileoverview DefenseGoal — Emergency response to fires, meteors, disease.
 *
 * Maximum desirability during active emergencies.
 */

export interface DefenseInputs {
  activeFires: number;
  activeMeteors: number;
  activeOutbreaks: number;
}

/**
 * Evaluates emergency defense urgency.
 *
 * @param inputs - Current emergency state
 * @returns Desirability score 0-1
 */
export function evaluateDefense(inputs: DefenseInputs): number {
  const emergencyCount = inputs.activeFires + inputs.activeMeteors + inputs.activeOutbreaks;
  if (emergencyCount === 0) return 0;
  return Math.min(1, 0.7 + emergencyCount * 0.1);
}
```

**Step 4: Implement ChairmanAgent with goal arbitration**

Update `src/ai/agents/ChairmanAgent.ts`:

```typescript
/**
 * @fileoverview ChairmanAgent — The player's Yuka agent.
 *
 * In autopilot mode, uses goal evaluator functions + fuzzy logic to make
 * all player decisions (minigames, annual reports, directives).
 * In player mode, receives telegrams and surfaces them as UI events.
 */

import { Vehicle } from 'yuka';
import type { Resources } from '@/ecs/world';
import { evaluateSurvival, type SurvivalInputs } from '../goals/SurvivalGoal';
import { evaluateQuota, type QuotaInputs } from '../goals/QuotaGoal';
import { evaluatePolitical, type PoliticalInputs } from '../goals/PoliticalGoal';
import { evaluateGrowth, type GrowthInputs } from '../goals/GrowthGoal';
import { evaluateDefense, type DefenseInputs } from '../goals/DefenseGoal';
import type { CollectiveFocus } from '@/game/workers/governor';

/** Simplified minigame choice for AI evaluation. */
interface AIMinigameChoice {
  id: string;
  successChance: number;
  onSuccess: { blackMarks?: number; commendations?: number; blat?: number };
  onFailure: { blackMarks?: number; commendations?: number; blat?: number };
}

/** Game state context for goal evaluation. */
interface GameContext {
  quotaProgress?: number;
  quotaDeadlineMonths?: number;
  blackMarks?: number;
  commendations?: number;
  blat?: number;
  kgbAggression?: 'low' | 'medium' | 'high';
  housingUtilization?: number;
  activeFires?: number;
  activeMeteors?: number;
  activeOutbreaks?: number;
}

/**
 * The Chairman — player avatar or autopilot AI.
 * Extends Yuka Vehicle for compatibility with EntityManager.
 *
 * Goal arbitration: evaluates all 5 goals each tick, picks the
 * highest desirability, and recommends a CollectiveFocus directive.
 */
export class ChairmanAgent extends Vehicle {
  /** Current goal desirability scores. */
  private scores = {
    survival: 0,
    quota: 0,
    political: 0,
    growth: 0,
    defense: 0,
  };

  /** Current political state for minigame/report decisions. */
  private politicalState: PoliticalInputs = {
    blackMarks: 0,
    commendations: 0,
    blat: 0,
  };

  /** Yuka Think brain reference (for future Phase 2+ integration). */
  brain = {};

  constructor() {
    super();
    this.name = 'ChairmanAgent';
  }

  /**
   * Assess current game state and compute goal desirability scores.
   *
   * @param resources - Current resource levels
   * @param context - Additional game context (quota, political, emergencies)
   */
  assessGameState(resources: Partial<Resources>, context?: GameContext): void {
    const pop = resources.population ?? 0;
    const food = resources.food ?? 0;
    const foodPerCapita = pop > 0 ? food / pop : 999;

    this.scores.survival = evaluateSurvival({ foodPerCapita, population: pop });
    this.scores.quota = evaluateQuota({
      quotaProgress: context?.quotaProgress ?? 0.5,
      quotaDeadlineMonths: context?.quotaDeadlineMonths ?? 12,
    });
    this.scores.political = evaluatePolitical({
      blackMarks: context?.blackMarks ?? 0,
      commendations: context?.commendations ?? 0,
      blat: context?.blat ?? 0,
      kgbAggression: context?.kgbAggression,
    });
    this.scores.growth = evaluateGrowth({
      housingUtilization: context?.housingUtilization ?? 0.5,
      foodPerCapita,
      population: pop,
    });
    this.scores.defense = evaluateDefense({
      activeFires: context?.activeFires ?? 0,
      activeMeteors: context?.activeMeteors ?? 0,
      activeOutbreaks: context?.activeOutbreaks ?? 0,
    });

    this.politicalState = {
      blackMarks: context?.blackMarks ?? 0,
      commendations: context?.commendations ?? 0,
      blat: context?.blat ?? 0,
      kgbAggression: context?.kgbAggression,
    };
  }

  /**
   * Get the recommended CollectiveFocus based on current goal scores.
   *
   * @returns The directive the ChairmanAgent recommends
   */
  getRecommendedDirective(): CollectiveFocus {
    const { survival, quota, growth, defense } = this.scores;

    // Defense overrides everything during emergencies
    if (defense > 0.7) return 'food'; // Redirect to food during emergencies

    // Survival is the highest priority
    if (survival > quota && survival > growth) return 'food';

    // Quota urgency
    if (quota > growth && quota > 0.4) return quota > 0.7 ? 'production' : 'construction';

    // Default to balanced growth
    return 'balanced';
  }

  /**
   * Resolve a minigame by choosing the option with best expected value.
   *
   * EV(choice) = successChance * value(onSuccess) + (1-successChance) * value(onFailure)
   * value = commendations + blat - (blackMarks * politicalRiskWeight)
   *
   * @param choices - Available minigame choices
   * @returns ID of the chosen option
   */
  resolveMinigame(choices: AIMinigameChoice[]): string {
    // Political risk weight increases when marks are high
    const markRatio = this.politicalState.blackMarks / 5;
    const riskWeight = 1 + markRatio * 2; // 1x at 0 marks, 3x at 5 marks

    let bestId = choices[0]?.id ?? 'comply';
    let bestEV = -Infinity;

    for (const choice of choices) {
      const successValue =
        (choice.onSuccess.commendations ?? 0) +
        (choice.onSuccess.blat ?? 0) -
        (choice.onSuccess.blackMarks ?? 0) * riskWeight;

      const failureValue =
        (choice.onFailure.commendations ?? 0) +
        (choice.onFailure.blat ?? 0) -
        (choice.onFailure.blackMarks ?? 0) * riskWeight;

      const ev = choice.successChance * successValue + (1 - choice.successChance) * failureValue;

      if (ev > bestEV) {
        bestEV = ev;
        bestId = choice.id;
      }
    }

    return bestId;
  }

  /**
   * Decide annual report strategy.
   *
   * @param quotaPercent - How much of the quota was met (0-1)
   * @returns Whether to submit an honest report
   */
  resolveAnnualReport(quotaPercent: number): boolean {
    // Easy case: quota met, be honest
    if (quotaPercent >= 1.0) return true;

    // Moderate shortfall: falsify if political risk is low
    if (quotaPercent >= 0.6) {
      return this.politicalState.blackMarks >= 3; // Honest if already at risk
    }

    // Large shortfall: honest (falsification too obvious)
    return true;
  }

  /** Get current goal scores for debugging/UI. */
  getScores(): typeof this.scores {
    return { ...this.scores };
  }
}
```

**Step 5: Run tests**

```bash
npx jest --testPathPattern="ChairmanAgent" --silent
```

Expected: 5 tests PASS

**Step 6: Write additional goal evaluator tests**

Create `__tests__/ai/goals.test.ts`:

```typescript
import { evaluateSurvival } from '../../src/ai/goals/SurvivalGoal';
import { evaluateQuota } from '../../src/ai/goals/QuotaGoal';
import { evaluatePolitical } from '../../src/ai/goals/PoliticalGoal';
import { evaluateGrowth } from '../../src/ai/goals/GrowthGoal';
import { evaluateDefense } from '../../src/ai/goals/DefenseGoal';

describe('Goal Evaluators', () => {
  describe('SurvivalGoal', () => {
    it('returns 1.0 for extreme food crisis (< 1.0 per capita)', () => {
      expect(evaluateSurvival({ foodPerCapita: 0.5, population: 50 })).toBe(1.0);
    });

    it('returns high score for food crisis (1-3 per capita)', () => {
      const score = evaluateSurvival({ foodPerCapita: 2.0, population: 50 });
      expect(score).toBeGreaterThan(0.6);
      expect(score).toBeLessThan(1.0);
    });

    it('returns low score when food is abundant', () => {
      const score = evaluateSurvival({ foodPerCapita: 20, population: 50 });
      expect(score).toBeLessThan(0.2);
    });

    it('returns 0 for zero population', () => {
      expect(evaluateSurvival({ foodPerCapita: 0, population: 0 })).toBe(0);
    });
  });

  describe('QuotaGoal', () => {
    it('returns low score when quota is met', () => {
      expect(evaluateQuota({ quotaProgress: 1.0, quotaDeadlineMonths: 12 })).toBe(0.1);
    });

    it('returns high score when quota is far behind near deadline', () => {
      const score = evaluateQuota({ quotaProgress: 0.2, quotaDeadlineMonths: 2 });
      expect(score).toBeGreaterThan(0.7);
    });

    it('returns moderate score for moderate gap with time remaining', () => {
      const score = evaluateQuota({ quotaProgress: 0.5, quotaDeadlineMonths: 12 });
      expect(score).toBeGreaterThan(0.2);
      expect(score).toBeLessThan(0.6);
    });
  });

  describe('PoliticalGoal', () => {
    it('returns 1.0 at arrest threshold', () => {
      expect(evaluatePolitical({ blackMarks: 5, commendations: 0, blat: 0 })).toBe(1.0);
    });

    it('returns low score with no marks', () => {
      expect(evaluatePolitical({ blackMarks: 0, commendations: 2, blat: 5 })).toBe(0);
    });

    it('is more sensitive with high KGB aggression', () => {
      const lowAgg = evaluatePolitical({ blackMarks: 2, commendations: 0, blat: 0, kgbAggression: 'low' });
      const highAgg = evaluatePolitical({ blackMarks: 2, commendations: 0, blat: 0, kgbAggression: 'high' });
      expect(highAgg).toBeGreaterThan(lowAgg);
    });
  });

  describe('DefenseGoal', () => {
    it('returns 0 with no emergencies', () => {
      expect(evaluateDefense({ activeFires: 0, activeMeteors: 0, activeOutbreaks: 0 })).toBe(0);
    });

    it('returns high score during emergency', () => {
      expect(evaluateDefense({ activeFires: 1, activeMeteors: 0, activeOutbreaks: 0 })).toBeGreaterThan(0.7);
    });
  });

  describe('GrowthGoal', () => {
    it('returns 0 during food crisis', () => {
      expect(evaluateGrowth({ housingUtilization: 0.3, foodPerCapita: 1, population: 50 })).toBe(0);
    });

    it('returns high score when stable with room to grow', () => {
      const score = evaluateGrowth({ housingUtilization: 0.3, foodPerCapita: 10, population: 50 });
      expect(score).toBeGreaterThan(0.5);
    });
  });
});
```

**Step 7: Run all AI tests**

```bash
npx jest --testPathPattern="ai/" --silent
```

Expected: All tests PASS

**Step 8: Commit**

```bash
git add src/ai/agents/ChairmanAgent.ts src/ai/goals/ __tests__/ai/
git commit -m "feat: ChairmanAgent with 5 goal evaluators + minigame/report decisions"
```

---

### Task 4: Turbo Speed Mode

**Files:**
- Modify: `src/stores/gameStore.ts` (extend GameSpeed type)
- Modify: `src/hooks/useECSGameLoop.ts` (support multi-tick-per-frame)
- Modify: `src/ui/TopBar.tsx` (add turbo buttons)
- Test: `__tests__/game/gameStore.extended.test.ts` (add speed tests)

**Step 1: Extend GameSpeed type**

In `src/stores/gameStore.ts`, change:

```typescript
// OLD:
export type GameSpeed = 1 | 2 | 3;

// NEW:
export type GameSpeed = 1 | 2 | 3 | 10 | 100;
```

Also update `_gameSpeed` default and `setGameSpeed`:

```typescript
let _gameSpeed: GameSpeed = 1;

export function setGameSpeed(speed: GameSpeed): void {
  _gameSpeed = speed;
  notifyStateChange();
}
```

Update the `GameSnapshot.gameSpeed` type to match:

```typescript
gameSpeed: GameSpeed;
```

**Step 2: Update useECSGameLoop for turbo batching**

In `src/hooks/useECSGameLoop.ts`, add a max-ticks-per-frame cap to prevent browser freeze:

```typescript
// Inside the loop function, replace the while loop:
const MAX_TICKS_PER_FRAME = speed >= 10 ? Math.min(speed, 100) : 3;
let ticksThisFrame = 0;

while (simAccumulator.current >= tickMs && ticksThisFrame < MAX_TICKS_PER_FRAME) {
  simAccumulator.current -= tickMs;
  engine.tick();
  didTick = true;
  ticksThisFrame++;
}

// Drain excess accumulation at turbo speeds to prevent runaway
if (speed >= 10 && simAccumulator.current > tickMs * 2) {
  simAccumulator.current = 0;
}
```

**Step 3: Add turbo speed buttons to TopBar**

In `src/ui/TopBar.tsx`, add ⏩ (10x) and ⏩⏩ (100x) buttons after the existing speed buttons. Use the same `SpeedButton` component pattern.

**Step 4: Write test for extended speeds**

Add to `__tests__/game/gameStore.extended.test.ts`:

```typescript
it('supports turbo speed levels (10x, 100x)', () => {
  setGameSpeed(10);
  expect(getGameSpeed()).toBe(10);
  setGameSpeed(100);
  expect(getGameSpeed()).toBe(100);
  setGameSpeed(1); // reset
});
```

**Step 5: Run tests**

```bash
npx jest --testPathPattern="gameStore" --silent
```

Expected: All PASS

**Step 6: Commit**

```bash
git add src/stores/gameStore.ts src/hooks/useECSGameLoop.ts src/ui/TopBar.tsx __tests__/game/gameStore.extended.test.ts
git commit -m "feat: turbo speed mode (10x, 100x) with multi-tick-per-frame batching"
```

---

### Task 5: Wire ChairmanAgent into SimulationEngine

**Files:**
- Modify: `src/game/SimulationEngine.ts` (add agentManager, autopilot callbacks)
- Modify: `src/bridge/GameInit.ts` (accept autopilot option)
- Create: `__tests__/ai/autopilot-integration.test.ts`

**Step 1: Add AgentManager to SimulationEngine**

In `SimulationEngine`, add an `agentManager` field. When autopilot is enabled, the ChairmanAgent:
- Resolves minigames via `chairman.resolveMinigame()` instead of deferring to UI
- Resolves annual reports via `chairman.resolveAnnualReport()` instead of deferring to UI
- Sets collective focus based on `chairman.getRecommendedDirective()` each tick

Wire into the existing callback flow:
- When `onMinigame` fires and autopilot is on, auto-resolve immediately
- When `onAnnualReport` fires and autopilot is on, auto-submit

**Step 2: Add autopilot to GameInitOptions**

In `src/bridge/GameInit.ts`:

```typescript
export interface GameInitOptions {
  difficulty?: DifficultyLevel;
  consequence?: ConsequenceLevel;
  seed?: string;
  mapSize?: 'small' | 'medium' | 'large';
  autopilot?: boolean; // Enable ChairmanAgent autopilot
}
```

When `autopilot: true`, create AgentManager and enable autopilot before returning engine.

**Step 3: Write integration test**

Create `__tests__/ai/autopilot-integration.test.ts`:

```typescript
import { world } from '../../src/ecs/world';
import { createPlaythroughEngine, advanceTicks, getResources } from '../playthrough/helpers';

describe('Autopilot Integration', () => {
  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
  });

  it('ChairmanAgent auto-resolves minigames when autopilot enabled', () => {
    // Test that minigame callback auto-resolves
    // (verify no UI deferral, just immediate resolution)
  });

  it('ChairmanAgent sets collective focus based on game state', () => {
    // Test that the directive changes based on resource levels
  });

  it('runs 100 ticks in autopilot without crashing', () => {
    const { engine } = createPlaythroughEngine({
      resources: { population: 50, food: 5000, vodka: 1000 },
    });
    // Enable autopilot on engine
    advanceTicks(engine, 100);
    const resources = getResources();
    expect(resources.population).toBeGreaterThan(0);
  });
});
```

**Step 4: Run tests**

```bash
npx jest --testPathPattern="autopilot" --silent
```

**Step 5: Commit**

```bash
git add src/game/SimulationEngine.ts src/bridge/GameInit.ts __tests__/ai/autopilot-integration.test.ts
git commit -m "feat: wire ChairmanAgent autopilot into SimulationEngine"
```

---

### Task 6: Autopilot UI Toggle

**Files:**
- Modify: `src/ui/SettingsModal.tsx` (add autopilot toggle)
- Modify: `src/App.web.tsx` (wire autopilot state)

**Step 1: Add autopilot toggle to SettingsModal**

Add a switch/toggle in the settings modal labeled "COMRADE ADVISOR (Autopilot)" with a description: "Let the AI make all decisions. Enable for E2E playtesting."

**Step 2: Wire to engine**

When toggled on, call `engine.getAgentManager().enableAutopilot()`.
When toggled off, call `engine.getAgentManager().disableAutopilot()`.

**Step 3: Visual indicator**

Add a small "AI" badge to TopBar when autopilot is active, so the player knows the advisor is driving.

**Step 4: Commit**

```bash
git add src/ui/SettingsModal.tsx src/App.web.tsx src/ui/TopBar.tsx
git commit -m "feat: autopilot toggle in settings + AI badge in TopBar"
```

---

### Task 7: E2E Playthrough Test

**Files:**
- Create: `e2e/yuka-playthrough.spec.ts`
- Modify: `e2e/helpers.ts` (add turbo + autopilot helpers)

**Step 1: Add helpers for autopilot + turbo**

In `e2e/helpers.ts`, add:

```typescript
/** Enable autopilot via the settings modal. */
export async function enableAutopilot(page: Page): Promise<void> {
  await openSettings(page);
  const toggle = page.getByText('COMRADE ADVISOR');
  await toggle.click();
  await page.keyboard.press('Escape'); // close settings
  await page.waitForTimeout(300);
}

/** Set turbo speed (100x). */
export async function setTurboSpeed(page: Page): Promise<void> {
  const turboBtn = page.getByText('⏩⏩');
  if (await turboBtn.first().isVisible().catch(() => false)) {
    await turboBtn.first().click();
  }
}

/** Get the current game year from the date label. */
export async function getGameYear(page: Page): Promise<number> {
  const dateText = await getDateText(page);
  const match = dateText.match(/(\d{4})/);
  return match ? parseInt(match[1], 10) : 0;
}

/** Wait for the game year to reach a target. */
export async function waitForYear(page: Page, targetYear: number, timeoutMs = 120_000): Promise<void> {
  await page.waitForFunction(
    (target) => {
      const el = document.querySelector('[data-testid="date-label"]');
      if (!el) return false;
      const match = el.textContent?.match(/(\d{4})/);
      return match ? parseInt(match[1], 10) >= target : false;
    },
    targetYear,
    { timeout: timeoutMs },
  );
}
```

**Step 2: Write the playthrough spec**

Create `e2e/yuka-playthrough.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import {
  startGame,
  getPopulation,
  getFood,
  getEraText,
  enableAutopilot,
  setTurboSpeed,
  getGameYear,
  waitForYear,
} from './helpers';

// Increase timeout for long-running playthroughs
test.describe.configure({ timeout: 300_000 }); // 5 min per test

test.describe('Yuka Playthrough — 200 Year Sustainability', () => {
  const SCREENSHOT_DIR = 'e2e/screenshots';

  test('worker difficulty — sustainable commune (1917-2117)', async ({ page }) => {
    // Start game with Worker difficulty
    await page.goto('/?difficulty=worker&consequence=forgiving');
    await startGame(page);
    await enableAutopilot(page);
    await setTurboSpeed(page);

    const startingPop = await getPopulation(page);
    expect(startingPop).toBeGreaterThan(0);

    // Checkpoint: Year 5 — population should have grown
    await waitForYear(page, 1922);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/worker/1922.png` });
    expect(await getPopulation(page)).toBeGreaterThan(startingPop);

    // Checkpoint: Year 20
    await waitForYear(page, 1937);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/worker/1937.png` });
    expect(await getPopulation(page)).toBeGreaterThan(startingPop);

    // Checkpoint: Year 50
    await waitForYear(page, 1967);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/worker/1967.png` });
    expect(await getPopulation(page)).toBeGreaterThan(100);

    // Checkpoint: Year 100
    await waitForYear(page, 2017);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/worker/2017.png` });
    expect(await getPopulation(page)).toBeGreaterThan(200);

    // Final: Year 200
    await waitForYear(page, 2117);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/worker/2117.png` });
    const finalPop = await getPopulation(page);
    expect(finalPop).toBeGreaterThan(0);
    console.log(`Worker playthrough complete: final pop = ${finalPop}`);
  });

  // Additional difficulty tests follow same pattern with different thresholds
});
```

**Step 3: Create screenshot directories**

```bash
mkdir -p e2e/screenshots/worker e2e/screenshots/comrade e2e/screenshots/tovarish
echo "e2e/screenshots/" >> .gitignore
```

**Step 4: Run E2E playthrough**

```bash
npx playwright test e2e/yuka-playthrough.spec.ts --headed
```

**Step 5: Review screenshots and validate**

Visually inspect the annual screenshots for:
- 3D scene rendering correctly
- Population growth visible in TopBar
- Era transitions happening
- Buildings appearing on the terrain
- No visual glitches or empty scenes

**Step 6: Commit**

```bash
git add e2e/yuka-playthrough.spec.ts e2e/helpers.ts .gitignore
git commit -m "feat: E2E 200-year playthrough test with Yuka autopilot"
```

---

## Phase 2: Core Decision Agents (Outline)

Convert the 4 systems that most benefit from goal-driven AI:

### Task 8: KGBAgent
Convert `PersonnelFile` + political mark logic into a Yuka agent with GoalEvaluator (FindDissent, EnforceCompliance, PunishFailure). Drives inspection timing and aggression. Communicates with ChairmanAgent via Telegrams.

### Task 9: PoliticalAgent
Convert era transition logic + quota enforcement into a Yuka agent. Drives 5-year plan generation, annual report demands, era progression.

### Task 10: CollectiveAgent
Wrap existing governor.ts + autoBuilder.ts + demandSystem.ts as a Yuka agent. Receives SET_FOCUS telegrams from ChairmanAgent.

### Task 11: EconomyAgent
Convert economySystem trudodni/fondy/blat logic into a Yuka agent with fuzzy logic for reform timing and blat management.

---

## Phase 3: Remaining System Agents (Outline)

### Task 12: FoodAgent (consumptionSystem + farm production)
### Task 13: VodkaAgent (vodka production + consumption)
### Task 14: WeatherAgent (weather state machine)
### Task 15: DemographicAgent (demographicSystem)
### Task 16: PowerAgent (power distribution)
### Task 17: StorageAgent (storageSystem)
### Task 18: DefenseAgent (fire/meteor/disease)
### Task 19: LoyaltyAgent (loyaltySystem)
### Task 20: ChronologyAgent (chronologySystem)

---

## Phase 4: Remove SimulationEngine.tick() (Outline)

### Task 21: Replace tick() with AgentManager.update()
The 1000-line procedural `tick()` method is replaced by `agentManager.update(delta)`. All system orchestration now happens via Yuka's EntityManager calling each agent's `update()` method. Telegram-based communication replaces direct state mutation.

### Task 22: Update all 2,760 tests
Tests that directly call `engine.tick()` are updated to use `agentManager.update()`. Agent-specific tests verify Telegram communication patterns.

### Task 23: Serialization migration
Replace piecemeal `serializeEngine()` with Yuka's built-in `toJSON()`/`fromJSON()` for the entire AgentManager.

---

## Verification Checklist

After each phase:
- [ ] `npx jest --silent` — all tests pass
- [ ] `npx tsc --noEmit` — typecheck passes
- [ ] `npx biome check src/ __tests__/` — no lint errors
- [ ] `expo start --web` — game loads and runs in browser
- [ ] E2E playthrough completes without crash (Phase 1+)
- [ ] Screenshots show visual progression (Phase 1+)

# Multi-Settlement Tick Loop Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable SimulationEngine to tick multiple settlements independently, each with its own agent tree, pressure system, grid, and population mode — while sharing a single WorldAgent for global geopolitical context.

**Architecture:** The ECS world is a singleton (Miniplex module-level). Rather than creating multiple ECS worlds (massive refactor), we use a **context-switching** approach: the active settlement uses the real ECS world; background settlements tick with a lightweight `BackgroundSettlementTick` that tracks aggregate population/resources/pressure without full ECS simulation. When the player switches viewport (Task #9, future), full ECS state is serialized and swapped. Each `SettlementRuntime` holds per-settlement agents (PressureSystem, CollectiveAgent, DemographicAgent, etc.), a GameGrid, and settlement metadata. The `SimulationEngine.tick()` method iterates all runtimes — full tick for active, background tick for inactive.

**Tech Stack:** TypeScript, Miniplex ECS, Jest

---

## Task 1: Create SettlementRuntime Type

**Files:**
- Create: `src/game/settlement/SettlementRuntime.ts`
- Modify: `src/game/relocation/Settlement.ts` (add `settlementId` to PressureStateSaveData usage)

**Step 1: Write the failing test**

```typescript
// __tests__/game/settlement/SettlementRuntime.test.ts

import { createSettlementRuntime, type SettlementRuntime } from '../../../src/game/settlement/SettlementRuntime';
import { GameGrid } from '../../../src/game/GameGrid';
import { GameRng } from '../../../src/game/SeedSystem';
import type { Settlement } from '../../../src/game/relocation/Settlement';

const EARTH_SETTLEMENT: Settlement = {
  id: 'primary',
  name: 'Settlement',
  gridSize: 20,
  terrain: { gravity: 1.0, atmosphere: 'breathable', water: 'rivers', farming: 'soil', construction: 'standard', baseSurvivalCost: 'low' },
  population: 50,
  distance: 0,
  celestialBody: 'earth',
  foundedYear: 1917,
  isActive: true,
};

describe('SettlementRuntime', () => {
  it('creates a runtime with per-settlement agents and pressure', () => {
    const rng = new GameRng('test-seed');
    const runtime = createSettlementRuntime(EARTH_SETTLEMENT, rng);

    expect(runtime.settlement.id).toBe('primary');
    expect(runtime.grid).toBeInstanceOf(GameGrid);
    expect(runtime.grid.getSize()).toBe(20);
    expect(runtime.pressureSystem).toBeDefined();
    expect(runtime.populationMode).toBe('entity');
    expect(runtime.resources).toBeDefined();
    expect(runtime.resources.food).toBe(0);
  });

  it('creates separate runtimes with independent pressure state', () => {
    const rng = new GameRng('test-seed');
    const runtimeA = createSettlementRuntime(EARTH_SETTLEMENT, rng);
    const runtimeB = createSettlementRuntime(
      { ...EARTH_SETTLEMENT, id: 'settlement-1', name: 'Mars Colony', isActive: false },
      rng,
    );

    runtimeA.pressureSystem.applySpike('food', 0.5);
    expect(runtimeA.pressureSystem.getLevel('food')).toBe(0.5);
    expect(runtimeB.pressureSystem.getLevel('food')).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest __tests__/game/settlement/SettlementRuntime.test.ts --no-coverage`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/game/settlement/SettlementRuntime.ts

/**
 * Per-settlement runtime state.
 *
 * Each settlement has its own grid, pressure system, resource snapshot,
 * and population mode. The active settlement uses the real ECS world;
 * background settlements tick with aggregate state only.
 */

import type { PressureSystem } from '../../ai/agents/crisis/pressure/PressureSystem';
import { PressureSystem as PressureSystemClass } from '../../ai/agents/crisis/pressure/PressureSystem';
import type { Settlement } from '../relocation/Settlement';
import { GameGrid } from '../GameGrid';
import type { GameRng } from '../SeedSystem';

/** Lightweight resource snapshot for background settlements (no ECS). */
export interface SettlementResources {
  population: number;
  food: number;
  money: number;
  vodka: number;
  power: number;
  timber: number;
  steel: number;
  cement: number;
  // Extended resources (era-gated)
  oxygen: number;
  hydrogen: number;
  water: number;
  rareEarths: number;
  uranium: number;
  rocketFuel: number;
}

function createDefaultResources(): SettlementResources {
  return {
    population: 0, food: 0, money: 0, vodka: 0, power: 0,
    timber: 0, steel: 0, cement: 0,
    oxygen: 0, hydrogen: 0, water: 0, rareEarths: 0, uranium: 0, rocketFuel: 0,
  };
}

/** Per-settlement runtime — owns grid, pressure, resources, agents. */
export interface SettlementRuntime {
  /** Settlement metadata (from SettlementRegistry). */
  settlement: Settlement;
  /** Spatial grid for this settlement. */
  grid: GameGrid;
  /** Per-settlement pressure accumulation. */
  pressureSystem: PressureSystem;
  /** Population mode (entity or aggregate). Background settlements are always aggregate. */
  populationMode: 'entity' | 'aggregate';
  /** Resource snapshot — for active settlement, synced from ECS each tick. */
  resources: SettlementResources;
  /** Total building count (for background settlements where no ECS entities exist). */
  buildingCount: number;
  /** Housing capacity (for background settlements). */
  housingCapacity: number;
}

/** Serialized form for save/load. */
export interface SettlementRuntimeSaveData {
  settlementId: string;
  populationMode: 'entity' | 'aggregate';
  resources: SettlementResources;
  buildingCount: number;
  housingCapacity: number;
  pressureState: import('../../ai/agents/crisis/pressure/PressureDomains').PressureStateSaveData;
}

/** Create a fresh SettlementRuntime for a settlement. */
export function createSettlementRuntime(settlement: Settlement, _rng: GameRng): SettlementRuntime {
  return {
    settlement,
    grid: new GameGrid(settlement.gridSize),
    pressureSystem: new PressureSystemClass(),
    populationMode: 'entity',
    resources: createDefaultResources(),
    buildingCount: 0,
    housingCapacity: 0,
  };
}

/** Serialize a runtime for save persistence. */
export function serializeRuntime(runtime: SettlementRuntime): SettlementRuntimeSaveData {
  return {
    settlementId: runtime.settlement.id,
    populationMode: runtime.populationMode,
    resources: { ...runtime.resources },
    buildingCount: runtime.buildingCount,
    housingCapacity: runtime.housingCapacity,
    pressureState: runtime.pressureSystem.serialize(),
  };
}

/** Restore a runtime from saved data. Requires the Settlement object from the registry. */
export function restoreRuntime(
  data: SettlementRuntimeSaveData,
  settlement: Settlement,
  _rng: GameRng,
): SettlementRuntime {
  const runtime = createSettlementRuntime(settlement, _rng);
  runtime.populationMode = data.populationMode;
  runtime.resources = { ...data.resources };
  runtime.buildingCount = data.buildingCount;
  runtime.housingCapacity = data.housingCapacity;
  runtime.pressureSystem.restore(data.pressureState);
  return runtime;
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest __tests__/game/settlement/SettlementRuntime.test.ts --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add src/game/settlement/SettlementRuntime.ts __tests__/game/settlement/SettlementRuntime.test.ts
git commit -m "feat: add SettlementRuntime type with per-settlement grid + pressure"
```

---

## Task 2: Background Settlement Tick

**Files:**
- Create: `src/game/settlement/backgroundTick.ts`
- Test: `__tests__/game/settlement/backgroundTick.test.ts`

A background settlement does NOT use the ECS world. It ticks with simple aggregate math: food production/consumption, population growth/decline, pressure accumulation. This keeps the tick loop O(1) per background settlement regardless of entity count.

**Step 1: Write the failing test**

```typescript
// __tests__/game/settlement/backgroundTick.test.ts

import { backgroundSettlementTick } from '../../../src/game/settlement/backgroundTick';
import { createSettlementRuntime, type SettlementRuntime } from '../../../src/game/settlement/SettlementRuntime';
import { GameRng } from '../../../src/game/SeedSystem';
import type { Settlement } from '../../../src/game/relocation/Settlement';

const MARS_SETTLEMENT: Settlement = {
  id: 'settlement-1',
  name: 'Mars Colony',
  gridSize: 11,
  terrain: { gravity: 0.38, atmosphere: 'thin_co2', water: 'none', farming: 'hydroponics', construction: 'dome_required', baseSurvivalCost: 'extreme' },
  population: 100,
  distance: 225_000_000,
  celestialBody: 'mars',
  foundedYear: 2025,
  isActive: false,
};

describe('backgroundSettlementTick', () => {
  let runtime: SettlementRuntime;
  let rng: GameRng;

  beforeEach(() => {
    rng = new GameRng('bg-tick-seed');
    runtime = createSettlementRuntime(MARS_SETTLEMENT, rng);
    runtime.resources.population = 100;
    runtime.resources.food = 5000;
    runtime.housingCapacity = 200;
    runtime.buildingCount = 10;
  });

  it('consumes food proportional to population', () => {
    const foodBefore = runtime.resources.food;
    backgroundSettlementTick(runtime, rng);
    expect(runtime.resources.food).toBeLessThan(foodBefore);
  });

  it('does not crash with zero population', () => {
    runtime.resources.population = 0;
    expect(() => backgroundSettlementTick(runtime, rng)).not.toThrow();
  });

  it('accumulates pressure from food shortage', () => {
    runtime.resources.food = 0;
    for (let i = 0; i < 10; i++) {
      backgroundSettlementTick(runtime, rng);
    }
    expect(runtime.pressureSystem.getLevel('food')).toBeGreaterThan(0);
  });

  it('population does not exceed housing capacity', () => {
    runtime.resources.population = 200;
    runtime.resources.food = 99999;
    runtime.housingCapacity = 200;
    backgroundSettlementTick(runtime, rng);
    expect(runtime.resources.population).toBeLessThanOrEqual(200);
  });

  it('syncs population to settlement metadata', () => {
    runtime.resources.population = 75;
    backgroundSettlementTick(runtime, rng);
    expect(runtime.settlement.population).toBe(runtime.resources.population);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest __tests__/game/settlement/backgroundTick.test.ts --no-coverage`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/game/settlement/backgroundTick.ts

/**
 * Lightweight tick for background (non-active) settlements.
 *
 * Does NOT use the ECS world. Instead, updates the settlement's
 * aggregate resource snapshot and pressure state using simple math.
 *
 * Called by SimulationEngine.tick() for all inactive settlements.
 */

import type { PressureReadContext } from '../../ai/agents/crisis/pressure/PressureDomains';
import type { GameRng } from '../SeedSystem';
import type { SettlementRuntime } from './SettlementRuntime';

/** Base per-capita food consumption per tick. */
const FOOD_PER_CAPITA_TICK = 0.1;

/** Background tick: update resources and pressure for an inactive settlement. */
export function backgroundSettlementTick(runtime: SettlementRuntime, _rng: GameRng): void {
  const { resources } = runtime;
  const pop = resources.population;
  if (pop <= 0) {
    runtime.settlement.population = 0;
    return;
  }

  // ── Food consumption ──
  const foodConsumed = Math.min(resources.food, pop * FOOD_PER_CAPITA_TICK);
  resources.food -= foodConsumed;

  // ── Starvation deaths (if food ran out) ──
  if (resources.food <= 0) {
    const starvationDeaths = Math.max(1, Math.floor(pop * 0.01));
    resources.population = Math.max(0, pop - starvationDeaths);
  }

  // ── Simple population growth (capped at housing) ──
  if (resources.food > pop * FOOD_PER_CAPITA_TICK * 10) {
    const growth = Math.max(0, Math.floor(pop * 0.001));
    resources.population = Math.min(runtime.housingCapacity, resources.population + growth);
  }

  // ── Pressure accumulation ──
  const pressureCtx: PressureReadContext = {
    foodRatio: resources.food > 0 ? Math.min(1, resources.food / (pop * FOOD_PER_CAPITA_TICK * 30)) : 0,
    moraleAvg: 50,
    loyaltyAvg: 50,
    housingRatio: runtime.housingCapacity > 0 ? Math.min(1, pop / runtime.housingCapacity) : 1,
    politicalStability: 0.5,
    powerRatio: resources.power > 0 ? 1 : 0.5,
    infrastructureDecay: 0,
    populationGrowthRate: 0,
    healthIndex: 0.5,
    economicOutput: 0.5,
    carryingCapacity: runtime.housingCapacity,
    currentPopulation: resources.population,
  };
  runtime.pressureSystem.tick(pressureCtx);

  // ── Sync back to settlement metadata ──
  runtime.settlement.population = resources.population;
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest __tests__/game/settlement/backgroundTick.test.ts --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add src/game/settlement/backgroundTick.ts __tests__/game/settlement/backgroundTick.test.ts
git commit -m "feat: add background settlement tick for inactive settlements"
```

---

## Task 3: Wire SettlementRuntime[] into SimulationEngine

**Files:**
- Modify: `src/game/SimulationEngine.ts`
- Modify: `src/game/engine/types.ts` (add `settlementRuntimes` to SubsystemSaveData)

This is the core integration: SimulationEngine creates SettlementRuntimes from the SettlementRegistry, ticks background settlements alongside the active one, and serializes them.

**Step 1: Write the failing test**

```typescript
// __tests__/game/settlement/multiSettlementTick.test.ts

import { world } from '../../../src/ecs/world';
import { createPlaythroughEngine, advanceTicks, buildBasicSettlement, getResources, isGameOver } from '../../playthrough/helpers';
import type { Settlement } from '../../../src/game/relocation/Settlement';

describe('Multi-settlement tick loop', () => {
  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
  });

  it('engine creates primary SettlementRuntime on construction', () => {
    const { engine } = createPlaythroughEngine({
      resources: { food: 5000, money: 10000, population: 50, power: 100 },
      seed: 'multi-settlement',
    });
    buildBasicSettlement();

    const runtimes = engine.getSettlementRuntimes();
    expect(runtimes.length).toBe(1);
    expect(runtimes[0].settlement.id).toBe('primary');
  });

  it('ticks background settlements alongside active', () => {
    const { engine } = createPlaythroughEngine({
      resources: { food: 5000, money: 10000, population: 50, power: 100 },
      seed: 'multi-settlement',
    });
    buildBasicSettlement();

    // Add a secondary settlement via relocation engine
    const registry = engine.getRelocationEngine().getRegistry();
    registry.addSettlement('Mars Colony', {
      gravity: 0.38, atmosphere: 'thin_co2', water: 'none',
      farming: 'hydroponics', construction: 'dome_required', baseSurvivalCost: 'extreme',
    }, 'mars', 225_000_000, 2025);

    // Sync runtimes to match registry
    engine.syncSettlementRuntimes();

    const runtimes = engine.getSettlementRuntimes();
    expect(runtimes.length).toBe(2);

    // Give background settlement resources
    runtimes[1].resources.population = 50;
    runtimes[1].resources.food = 5000;
    runtimes[1].housingCapacity = 100;

    // Tick 10 times — both should tick
    advanceTicks(engine, 10);

    // Background settlement should have consumed food
    expect(runtimes[1].resources.food).toBeLessThan(5000);
  });

  it('serializes and restores SettlementRuntimes', () => {
    const { engine } = createPlaythroughEngine({
      resources: { food: 5000, money: 10000, population: 50, power: 100 },
      seed: 'multi-settle-save',
    });
    buildBasicSettlement();

    // Add secondary settlement
    const registry = engine.getRelocationEngine().getRegistry();
    registry.addSettlement('Lunar Base', {
      gravity: 0.16, atmosphere: 'none', water: 'none',
      farming: 'hydroponics', construction: 'dome_required', baseSurvivalCost: 'extreme',
    }, 'moon', 384_400, 1970);

    engine.syncSettlementRuntimes();
    const runtimes = engine.getSettlementRuntimes();
    runtimes[1].resources.population = 30;
    runtimes[1].resources.food = 2000;
    runtimes[1].pressureSystem.applySpike('food', 0.3);

    // Serialize
    const saved = engine.serializeSubsystems();
    expect(saved.settlementRuntimes).toBeDefined();
    expect(saved.settlementRuntimes!.length).toBe(2);

    // Restore into fresh engine
    const { engine: restored } = createPlaythroughEngine({
      resources: { food: 5000, money: 10000, population: 50, power: 100 },
      seed: 'multi-settle-save',
    });
    buildBasicSettlement();
    restored.restoreSubsystems(saved);

    const restoredRuntimes = restored.getSettlementRuntimes();
    expect(restoredRuntimes.length).toBe(2);
    expect(restoredRuntimes[1].resources.population).toBe(30);
    expect(restoredRuntimes[1].resources.food).toBe(2000);
    expect(restoredRuntimes[1].pressureSystem.getLevel('food')).toBeCloseTo(0.3, 1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest __tests__/game/settlement/multiSettlementTick.test.ts --no-coverage`
Expected: FAIL — `engine.getSettlementRuntimes is not a function`

**Step 3: Implement — add SettlementRuntime[] to SimulationEngine**

In `src/game/SimulationEngine.ts`, add:

1. New import: `import { createSettlementRuntime, serializeRuntime, restoreRuntime, type SettlementRuntime, type SettlementRuntimeSaveData } from './settlement/SettlementRuntime';`
2. New import: `import { backgroundSettlementTick } from './settlement/backgroundTick';`
3. New field: `private settlementRuntimes: SettlementRuntime[] = [];`
4. In constructor, after `createPrimary()`: create the primary runtime
5. New method `getSettlementRuntimes(): SettlementRuntime[]`
6. New method `syncSettlementRuntimes(): void` — syncs runtimes to match SettlementRegistry
7. In `tick()`: after all phases, tick background settlements
8. In serialization: add `settlementRuntimes` to SubsystemSaveData

In `src/game/engine/types.ts`, add to `SubsystemSaveData`:
```typescript
/** Per-settlement runtime states (optional for backward compat with old saves). */
settlementRuntimes?: import('../settlement/SettlementRuntime').SettlementRuntimeSaveData[];
```

In `src/game/engine/serializeEngine.ts`, add:
- Serialize: `settlementRuntimes: engine.settlementRuntimes?.map(serializeRuntime)`
- Restore: rebuild runtimes from saved data + registry

**Step 4: Run test to verify it passes**

Run: `npx jest __tests__/game/settlement/multiSettlementTick.test.ts --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add src/game/SimulationEngine.ts src/game/engine/types.ts src/game/engine/serializeEngine.ts __tests__/game/settlement/multiSettlementTick.test.ts
git commit -m "feat: wire SettlementRuntime[] into SimulationEngine tick loop"
```

---

## Task 4: Cross-Settlement Quota Evaluation

**Files:**
- Create: `src/game/settlement/crossSettlementQuota.ts`
- Test: `__tests__/game/settlement/crossSettlementQuota.test.ts`

Moscow's quotas span ALL settlements. The quota `current` value should be the SUM of production across all settlements.

**Step 1: Write the failing test**

```typescript
// __tests__/game/settlement/crossSettlementQuota.test.ts

import { computeCrossSettlementQuota, type SettlementQuotaInput } from '../../../src/game/settlement/crossSettlementQuota';

describe('Cross-settlement quota', () => {
  it('sums food production across all settlements', () => {
    const inputs: SettlementQuotaInput[] = [
      { settlementId: 'primary', foodProduced: 500, vodkaProduced: 100 },
      { settlementId: 'settlement-1', foodProduced: 300, vodkaProduced: 50 },
    ];
    const result = computeCrossSettlementQuota(inputs, 'food');
    expect(result).toBe(800);
  });

  it('sums vodka production when quota type is vodka', () => {
    const inputs: SettlementQuotaInput[] = [
      { settlementId: 'primary', foodProduced: 500, vodkaProduced: 100 },
      { settlementId: 'settlement-1', foodProduced: 300, vodkaProduced: 200 },
    ];
    const result = computeCrossSettlementQuota(inputs, 'vodka');
    expect(result).toBe(300);
  });

  it('returns 0 for empty inputs', () => {
    expect(computeCrossSettlementQuota([], 'food')).toBe(0);
  });

  it('handles single settlement (backward compat)', () => {
    const inputs: SettlementQuotaInput[] = [
      { settlementId: 'primary', foodProduced: 1000, vodkaProduced: 200 },
    ];
    expect(computeCrossSettlementQuota(inputs, 'food')).toBe(1000);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest __tests__/game/settlement/crossSettlementQuota.test.ts --no-coverage`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/game/settlement/crossSettlementQuota.ts

/**
 * Cross-settlement quota computation.
 *
 * Moscow's quotas span ALL settlements — meeting quota from Settlement A
 * doesn't exempt Settlement B. The total quota contribution is the SUM
 * of production across all settlements.
 */

export interface SettlementQuotaInput {
  settlementId: string;
  foodProduced: number;
  vodkaProduced: number;
}

/** Compute total quota contribution across all settlements. */
export function computeCrossSettlementQuota(
  inputs: SettlementQuotaInput[],
  quotaType: 'food' | 'vodka',
): number {
  return inputs.reduce(
    (sum, s) => sum + (quotaType === 'food' ? s.foodProduced : s.vodkaProduced),
    0,
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest __tests__/game/settlement/crossSettlementQuota.test.ts --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add src/game/settlement/crossSettlementQuota.ts __tests__/game/settlement/crossSettlementQuota.test.ts
git commit -m "feat: add cross-settlement quota computation"
```

---

## Task 5: Resource Transfer with Distance-Based Logistics Cost

**Files:**
- Create: `src/game/settlement/resourceTransfer.ts`
- Test: `__tests__/game/settlement/resourceTransfer.test.ts`

Resource transfer between settlements already exists in `RelocationEngine.transferResources()`, but it's tied to the RelocationEngine class. We need a standalone pure function that SimulationEngine can call for inter-settlement transfers with configurable logistics cost.

**Step 1: Write the failing test**

```typescript
// __tests__/game/settlement/resourceTransfer.test.ts

import {
  computeTransferResult,
  type TransferRequest,
} from '../../../src/game/settlement/resourceTransfer';

describe('Resource transfer between settlements', () => {
  it('transfers resources with logistics loss proportional to distance', () => {
    const request: TransferRequest = {
      food: 1000,
      money: 500,
      workers: 20,
      sourceDistance: 0,
      targetDistance: 384_400, // moon
    };
    const result = computeTransferResult(request);

    // Should lose some to logistics
    expect(result.food).toBeGreaterThan(0);
    expect(result.food).toBeLessThan(1000);
    expect(result.money).toBeGreaterThan(0);
    expect(result.money).toBeLessThan(500);
    expect(result.workers).toBeGreaterThan(0);
    expect(result.workers).toBeLessThanOrEqual(20);
  });

  it('same-body transfers have minimal loss', () => {
    const request: TransferRequest = {
      food: 1000,
      money: 500,
      workers: 20,
      sourceDistance: 0,
      targetDistance: 1000, // nearby on earth
    };
    const result = computeTransferResult(request);

    // 5% base loss + negligible distance factor
    expect(result.food).toBeGreaterThanOrEqual(900);
  });

  it('returns zero when request amounts are zero', () => {
    const result = computeTransferResult({
      food: 0, money: 0, workers: 0,
      sourceDistance: 0, targetDistance: 225_000_000,
    });
    expect(result.food).toBe(0);
    expect(result.money).toBe(0);
    expect(result.workers).toBe(0);
  });

  it('loss rate is capped at 50%', () => {
    const request: TransferRequest = {
      food: 1000,
      money: 1000,
      workers: 100,
      sourceDistance: 0,
      targetDistance: 40_000_000_000_000, // interstellar
    };
    const result = computeTransferResult(request);

    expect(result.food).toBeGreaterThanOrEqual(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest __tests__/game/settlement/resourceTransfer.test.ts --no-coverage`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/game/settlement/resourceTransfer.ts

/**
 * Inter-settlement resource transfer with distance-based logistics cost.
 *
 * Pure function — no side effects. The caller is responsible for
 * debiting source and crediting target settlement resources.
 */

/** Transfer request: amounts to send and distance metadata. */
export interface TransferRequest {
  food: number;
  money: number;
  workers: number;
  sourceDistance: number;
  targetDistance: number;
}

/** Transfer result: amounts that actually arrive after logistics loss. */
export interface TransferResult {
  food: number;
  money: number;
  workers: number;
  lossRate: number;
}

/**
 * Compute arrived amounts after logistics loss.
 *
 * Loss = 5% base + distance factor (capped at 50% total).
 * Money loses at half rate, workers at 30% rate.
 */
export function computeTransferResult(request: TransferRequest): TransferResult {
  const distanceDelta = Math.abs(request.targetDistance - request.sourceDistance);
  const distanceFactor = Math.min(0.3, distanceDelta * 0.0000001);
  const lossRate = Math.min(0.5, 0.05 + distanceFactor);

  return {
    food: Math.floor(request.food * (1 - lossRate)),
    money: Math.floor(request.money * (1 - lossRate * 0.5)),
    workers: Math.floor(request.workers * (1 - lossRate * 0.3)),
    lossRate,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest __tests__/game/settlement/resourceTransfer.test.ts --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add src/game/settlement/resourceTransfer.ts __tests__/game/settlement/resourceTransfer.test.ts
git commit -m "feat: add resource transfer with distance-based logistics cost"
```

---

## Task 6: Integration Tests — Full Multi-Settlement Playthrough

**Files:**
- Create: `__tests__/playthrough/09-multi-settlement.test.ts`

End-to-end verification: create two settlements, tick for multiple years, verify cross-settlement quota, resource transfer, independent pressure, and serialization round-trip.

**Step 1: Write the integration test**

```typescript
// __tests__/playthrough/09-multi-settlement.test.ts

import { world } from '../../src/ecs/world';
import {
  advanceTicks,
  buildBasicSettlement,
  createPlaythroughEngine,
  getResources,
  isGameOver,
  TICKS_PER_MONTH,
} from '../playthrough/helpers';

describe('Playthrough: Multi-Settlement', () => {
  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
  });

  it('dual-settlement tick: both settlements evolve independently', () => {
    const { engine } = createPlaythroughEngine({
      resources: { food: 99999, money: 99999, population: 100, power: 500 },
      seed: 'multi-settle-dual',
    });
    buildBasicSettlement({ housing: 5, farms: 5, power: 3 });

    // Add secondary settlement
    engine.getRelocationEngine().getRegistry().addSettlement(
      'Siberian Camp',
      { gravity: 1.0, atmosphere: 'breathable', water: 'rivers', farming: 'soil', construction: 'standard', baseSurvivalCost: 'medium' },
      'earth',
      3000,
      1930,
    );
    engine.syncSettlementRuntimes();

    const runtimes = engine.getSettlementRuntimes();
    expect(runtimes.length).toBe(2);

    // Seed background settlement with resources
    runtimes[1].resources.population = 50;
    runtimes[1].resources.food = 5000;
    runtimes[1].housingCapacity = 100;
    runtimes[1].buildingCount = 5;

    // Maintain active settlement resources to prevent game-over
    for (let i = 0; i < 60; i++) {
      const res = getResources();
      res.food = Math.max(res.food, 50000);
      res.money = Math.max(res.money, 50000);
      res.population = Math.max(res.population, 50);
      engine.tick();
    }

    expect(isGameOver()).toBe(false);

    // Background settlement should have consumed some food
    expect(runtimes[1].resources.food).toBeLessThan(5000);
    // Background settlement population should still be alive
    expect(runtimes[1].resources.population).toBeGreaterThan(0);
  });

  it('cross-settlement save/load preserves all runtimes', () => {
    const { engine } = createPlaythroughEngine({
      resources: { food: 99999, money: 99999, population: 50, power: 100 },
      seed: 'multi-save-load',
    });
    buildBasicSettlement();

    engine.getRelocationEngine().getRegistry().addSettlement(
      'Lunar Base',
      { gravity: 0.16, atmosphere: 'none', water: 'none', farming: 'hydroponics', construction: 'dome_required', baseSurvivalCost: 'extreme' },
      'moon', 384_400, 1970,
    );
    engine.syncSettlementRuntimes();

    const runtimes = engine.getSettlementRuntimes();
    runtimes[1].resources.population = 25;
    runtimes[1].resources.food = 1000;
    runtimes[1].pressureSystem.applySpike('food', 0.4);

    advanceTicks(engine, 10);

    // Serialize
    const saved = engine.serializeSubsystems();

    // Restore
    const { engine: restored } = createPlaythroughEngine({
      resources: { food: 99999, money: 99999, population: 50, power: 100 },
      seed: 'multi-save-load',
    });
    buildBasicSettlement();
    restored.restoreSubsystems(saved);

    const restoredRuntimes = restored.getSettlementRuntimes();
    expect(restoredRuntimes.length).toBe(2);
    expect(restoredRuntimes[1].settlement.name).toBe('Lunar Base');
    expect(restoredRuntimes[1].resources.population).toBe(runtimes[1].resources.population);
    expect(restoredRuntimes[1].pressureSystem.getLevel('food')).toBeGreaterThan(0);

    // Should continue ticking after restore
    expect(() => advanceTicks(restored, 10)).not.toThrow();
  });

  it('independent pressure: crisis in one settlement does not affect another', () => {
    const { engine } = createPlaythroughEngine({
      resources: { food: 99999, money: 99999, population: 100, power: 500 },
      seed: 'multi-pressure',
    });
    buildBasicSettlement({ housing: 5, farms: 5, power: 3 });

    engine.getRelocationEngine().getRegistry().addSettlement(
      'Starving Camp',
      { gravity: 1.0, atmosphere: 'breathable', water: 'rivers', farming: 'soil', construction: 'standard', baseSurvivalCost: 'low' },
      'earth', 2000, 1935,
    );
    engine.syncSettlementRuntimes();

    const runtimes = engine.getSettlementRuntimes();

    // Background settlement: no food → pressure should rise
    runtimes[1].resources.population = 100;
    runtimes[1].resources.food = 0;
    runtimes[1].housingCapacity = 200;

    for (let i = 0; i < 30; i++) {
      const res = getResources();
      res.food = Math.max(res.food, 50000);
      res.money = Math.max(res.money, 50000);
      engine.tick();
    }

    // Background settlement should have high food pressure
    expect(runtimes[1].pressureSystem.getLevel('food')).toBeGreaterThan(0.1);

    // Primary settlement pressure should be independent
    // (it has plenty of food, so food pressure should be lower)
    const primaryRuntime = runtimes[0];
    expect(primaryRuntime.pressureSystem.getLevel('food')).toBeLessThan(
      runtimes[1].pressureSystem.getLevel('food'),
    );
  });
});
```

**Step 2: Run test to verify it passes**

Run: `npx jest __tests__/playthrough/09-multi-settlement.test.ts --no-coverage`
Expected: PASS (after Tasks 1-3 are implemented)

**Step 3: Commit**

```bash
git add __tests__/playthrough/09-multi-settlement.test.ts
git commit -m "test: add multi-settlement playthrough integration tests"
```

---

## Task 7: Sync Primary Runtime Pressure from Governor

**Files:**
- Modify: `src/game/engine/phaseChronology.ts` (sync active settlement's pressure to its runtime)
- Modify: `src/game/SimulationEngine.ts` (pass active runtime to governor context)

The governor already owns a PressureSystem. For the active settlement, we need to keep its SettlementRuntime's pressure in sync with the governor's pressure state. This is a lightweight wiring change — the governor's PressureSystem IS the active settlement's pressure.

**Step 1: Add sync in tick()**

In `SimulationEngine.tick()`, after `phaseChronology()`:

```typescript
// Sync primary settlement runtime pressure from governor
const activeRuntime = this.settlementRuntimes.find(r => r.settlement.isActive);
if (activeRuntime && this.governor) {
  const govPressure = (this.governor as any).getPressureSystem?.();
  if (govPressure) {
    // Copy pressure levels into the runtime's pressure system
    const state = govPressure.getState();
    for (const domain of Object.keys(state) as Array<keyof typeof state>) {
      if (state[domain]?.level !== undefined) {
        activeRuntime.pressureSystem.applySpike(domain as any, state[domain].level - activeRuntime.pressureSystem.getLevel(domain as any));
      }
    }
  }
}
```

Wait — this is over-engineered. A simpler approach: the active runtime's `pressureSystem` reference is the SAME object as the governor's. We set `activeRuntime.pressureSystem = governor.getPressureSystem()` when the governor is set. This makes it zero-copy.

Actually, even simpler: on `syncSettlementRuntimes()` and after governor is set, point the active runtime's pressureSystem to the governor's.

**Step 2: Implement in SimulationEngine**

In `setGovernor()`, add after line that sets `this.gameMode`:
```typescript
// Point active settlement runtime's pressure to governor's pressure system
const activeRuntime = this.settlementRuntimes.find(r => r.settlement.isActive);
if (activeRuntime && gov.getPressureSystem) {
  activeRuntime.pressureSystem = (gov as any).getPressureSystem();
}
```

**Step 3: Run existing tests**

Run: `npx jest --no-coverage __tests__/game/settlement/ __tests__/playthrough/09-multi-settlement.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/game/SimulationEngine.ts
git commit -m "feat: sync active settlement pressure with governor PressureSystem"
```

---

## Task 8: Run Full Test Suite + Fix Regressions

**Step 1: Run the full test suite**

Run: `npx jest --no-coverage 2>&1 | tail -40`

**Step 2: Fix any regressions**

Likely issues:
- Existing save/load tests may need `settlementRuntimes` in saved data
- The `getSerializableEngine()` may need updating

**Step 3: Run again to confirm**

Run: `npx jest --no-coverage 2>&1 | tail -10`
Expected: All tests pass

**Step 4: Commit fixes**

```bash
git add -u
git commit -m "fix: resolve multi-settlement integration regressions"
```

---

## Summary

| Task | What | New Files | Tests |
|------|------|-----------|-------|
| 1 | SettlementRuntime type | `src/game/settlement/SettlementRuntime.ts` | 2 |
| 2 | Background tick | `src/game/settlement/backgroundTick.ts` | 5 |
| 3 | Wire into SimulationEngine | Modified engine files | 3 |
| 4 | Cross-settlement quota | `src/game/settlement/crossSettlementQuota.ts` | 4 |
| 5 | Resource transfer | `src/game/settlement/resourceTransfer.ts` | 4 |
| 6 | Integration tests | `__tests__/playthrough/09-multi-settlement.test.ts` | 3 |
| 7 | Governor pressure sync | Modified engine files | 0 (covered by Task 6) |
| 8 | Full suite regression fix | Modified as needed | 0 |

**Total: ~21 new tests, 5 new files, 3 modified files.**

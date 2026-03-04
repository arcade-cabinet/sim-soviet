/**
 * Performance benchmark: 1000-year simulation stress test.
 *
 * Proves the aggregate-mode architecture scales to millennium timescales
 * without unbounded memory growth, NaN corruption, or population collapse.
 *
 * Uses aggregate mode (building-as-container) with infinite resources
 * to isolate engine performance from game balance concerns.
 */

import { getResourceEntity } from '../../src/ecs/archetypes';
import { createBuilding, createMetaStore, createResourceStore } from '../../src/ecs/factories';
import type { RaionPool } from '../../src/ecs/world';
import { world } from '../../src/ecs/world';
import { GameGrid } from '../../src/game/GameGrid';
import type { SimCallbacks } from '../../src/game/SimulationEngine';
import { SimulationEngine } from '../../src/game/SimulationEngine';

// ── Constants ──────────────────────────────────────────────────────────────

const TICKS_PER_YEAR = 360;
const AGE_BUCKET_COUNT = 20;

// ── Helpers ────────────────────────────────────────────────────────────────

jest.setTimeout(120000);

function createMockCallbacks(): SimCallbacks & Record<string, jest.Mock> {
  return {
    onToast: jest.fn(),
    onAdvisor: jest.fn(),
    onPravda: jest.fn(),
    onStateChange: jest.fn(),
    onSeasonChanged: jest.fn(),
    onWeatherChanged: jest.fn(),
    onDayPhaseChanged: jest.fn(),
    onBuildingCollapsed: jest.fn(),
    onGameOver: jest.fn(),
    onSettlementChange: jest.fn(),
    onNewPlan: jest.fn(),
    onEraChanged: jest.fn(),
    onAnnualReport: jest.fn(),
    onMinigame: jest.fn(),
    onTutorialMilestone: jest.fn(),
    onAchievement: jest.fn(),
    onGameTally: jest.fn(),
  };
}

function createRaionPool(totalPop: number): RaionPool {
  const maleAgeBuckets = new Array<number>(AGE_BUCKET_COUNT).fill(0);
  const femaleAgeBuckets = new Array<number>(AGE_BUCKET_COUNT).fill(0);

  const bucketWeights = [8, 7, 7, 7, 7, 6, 6, 5, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1, 0.5, 0.2];
  const totalWeight = bucketWeights.reduce((s, w) => s + w, 0);

  let assigned = 0;
  for (let i = 0; i < AGE_BUCKET_COUNT; i++) {
    const bucketPop = Math.round(totalPop * (bucketWeights[i]! / totalWeight));
    const males = Math.round(bucketPop * 0.48);
    const females = bucketPop - males;
    maleAgeBuckets[i] = males;
    femaleAgeBuckets[i] = females;
    assigned += males + females;
  }
  maleAgeBuckets[3]! += totalPop - assigned;

  let laborForce = 0;
  for (let i = 3; i <= 12; i++) {
    laborForce += maleAgeBuckets[i]! + femaleAgeBuckets[i]!;
  }

  return {
    totalPopulation: totalPop,
    totalHouseholds: Math.floor(totalPop / 3),
    maleAgeBuckets,
    femaleAgeBuckets,
    classCounts: { worker: Math.floor(totalPop * 0.7), peasant: Math.floor(totalPop * 0.3) },
    birthsThisYear: 0,
    deathsThisYear: 0,
    totalBirths: 0,
    totalDeaths: 0,
    pregnancyWaves: [0, 0, 0],
    laborForce,
    assignedWorkers: Math.floor(laborForce * 0.7),
    idleWorkers: Math.floor(laborForce * 0.3),
    avgMorale: 55,
    avgLoyalty: 50,
    avgSkill: 40,
  };
}

function buildBenchmarkSettlement(raion: RaionPool): void {
  let nextX = 0;
  const spacing = 2;

  for (let i = 0; i < 3; i++) {
    createBuilding(nextX, 0, 'power-station');
    nextX += spacing;
  }

  const housingTypes = ['apartment-tower-a', 'apartment-tower-b', 'apartment-tower-c', 'apartment-tower-d'];
  for (let i = 0; i < 8; i++) {
    const bld = createBuilding(nextX, 0, housingTypes[i % 4]!);
    if (bld.building) {
      bld.building.residentCount = Math.floor(raion.totalPopulation / 8);
      bld.building.householdCount = Math.floor(raion.totalHouseholds / 8);
    }
    nextX += spacing;
  }

  for (let i = 0; i < 4; i++) {
    const bld = createBuilding(nextX, 0, 'collective-farm-hq');
    if (bld.building) {
      bld.building.workerCount = Math.floor(raion.assignedWorkers / 10);
      bld.building.avgSkill = raion.avgSkill;
      bld.building.avgMorale = raion.avgMorale;
    }
    nextX += spacing;
  }

  for (let i = 0; i < 2; i++) {
    const bld = createBuilding(nextX, 0, 'bread-factory');
    if (bld.building) {
      bld.building.workerCount = Math.floor(raion.assignedWorkers / 10);
      bld.building.avgSkill = raion.avgSkill;
      bld.building.avgMorale = raion.avgMorale;
    }
    nextX += spacing;
  }

  for (let i = 0; i < 2; i++) {
    const bld = createBuilding(nextX, 0, 'vodka-distillery');
    if (bld.building) {
      bld.building.workerCount = Math.floor(raion.assignedWorkers / 10);
      bld.building.avgSkill = raion.avgSkill;
      bld.building.avgMorale = raion.avgMorale;
    }
    nextX += spacing;
  }

  for (let i = 0; i < 2; i++) {
    createBuilding(nextX, 0, 'warehouse');
    nextX += spacing;
  }
}

function createBenchmarkEngine(): { engine: SimulationEngine; callbacks: SimCallbacks & Record<string, jest.Mock> } {
  world.clear();

  const raion = createRaionPool(5000);

  const storeEntity = createResourceStore({
    population: 5000,
    food: 999_999_999,
    vodka: 999_999_999,
    money: 999_999_999,
    timber: 999_999_999,
    steel: 999_999_999,
    cement: 999_999_999,
  });
  storeEntity.resources.raion = raion;

  createMetaStore({ date: { year: 1917, month: 10, tick: 0 } });

  jest.spyOn(Math, 'random').mockReturnValue(0.42);

  const grid = new GameGrid();
  const callbacks = createMockCallbacks();

  buildBenchmarkSettlement(raion);

  const engine = new SimulationEngine(grid, callbacks, undefined, 'worker', 'rehabilitated');

  return { engine, callbacks };
}

function getRaion(): RaionPool | undefined {
  return getResourceEntity()?.resources?.raion;
}

function getResources() {
  return getResourceEntity()!.resources;
}

function topUpResources(): void {
  const res = getResources();
  res.food = Math.max(res.food, 999_999_999);
  res.vodka = Math.max(res.vodka, 999_999_999);
  res.money = Math.max(res.money, 999_999_999);
  res.timber = Math.max(res.timber, 999_999_999);
  res.steel = Math.max(res.steel, 999_999_999);
  res.cement = Math.max(res.cement, 999_999_999);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Performance Benchmark', () => {
  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
  });

  it('simulates 1000 years in under 60 seconds', () => {
    const { engine } = createBenchmarkEngine();
    const totalTicks = 1000 * TICKS_PER_YEAR;

    const start = performance.now();

    for (let tick = 0; tick < totalTicks; tick++) {
      // Top up resources every year to prevent resource-death shortcuts
      if (tick % TICKS_PER_YEAR === 0) {
        topUpResources();
      }
      engine.tick();
    }

    const elapsed = performance.now() - start;

    console.log(`\n  1000 years (${totalTicks} ticks): ${(elapsed / 1000).toFixed(2)}s`);
    console.log(`  Avg tick: ${(elapsed / totalTicks).toFixed(3)}ms`);

    expect(elapsed).toBeLessThan(60000);
  }, 120000);

  it('maintains bounded memory growth', () => {
    const { engine } = createBenchmarkEngine();

    // Force GC if available (Node --expose-gc)
    const gc = (globalThis as unknown as { gc?: () => void }).gc;

    const heapSnapshots: { year: number; heapUsedMB: number }[] = [];

    for (let year = 0; year < 500; year++) {
      if (year % TICKS_PER_YEAR === 0) {
        topUpResources();
      }

      for (let tick = 0; tick < TICKS_PER_YEAR; tick++) {
        if (tick === 0) topUpResources();
        engine.tick();
      }

      if (year % 100 === 0 || year === 499) {
        gc?.();
        const heapUsedMB = process.memoryUsage().heapUsed / (1024 * 1024);
        heapSnapshots.push({ year: 1917 + year, heapUsedMB });
      }
    }

    console.log('\n  === Heap Usage Over 500 Years ===');
    for (const s of heapSnapshots) {
      console.log(`  year=${s.year} heap=${s.heapUsedMB.toFixed(1)}MB`);
    }

    // Heap should not grow by more than 3x from first snapshot to last
    const firstHeap = heapSnapshots[0]!.heapUsedMB;
    const lastHeap = heapSnapshots[heapSnapshots.length - 1]!.heapUsedMB;
    const growthRatio = lastHeap / firstHeap;

    console.log(`  Growth ratio: ${growthRatio.toFixed(2)}x (${firstHeap.toFixed(1)}MB → ${lastHeap.toFixed(1)}MB)`);
    expect(growthRatio).toBeLessThan(3);
  }, 120000);

  it('produces no NaN values after 1000 years', () => {
    const { engine } = createBenchmarkEngine();
    const totalTicks = 1000 * TICKS_PER_YEAR;

    let nanDetectedAtTick = -1;

    for (let tick = 0; tick < totalTicks; tick++) {
      if (tick % TICKS_PER_YEAR === 0) {
        topUpResources();
      }
      engine.tick();

      // Check every 10 years for NaN (checking every tick is too slow)
      if (tick % (10 * TICKS_PER_YEAR) === 0) {
        const res = getResources();
        const raion = getRaion();

        const resourceValues = [
          res.food,
          res.vodka,
          res.money,
          res.power,
          res.powerUsed,
          res.population,
          res.trudodni,
          res.blat,
          res.timber,
          res.steel,
          res.cement,
          res.prefab,
          res.seedFund,
          res.emergencyReserve,
          res.storageCapacity,
        ];

        for (const val of resourceValues) {
          if (Number.isNaN(val)) {
            nanDetectedAtTick = tick;
            break;
          }
        }

        if (raion) {
          const raionValues = [
            raion.totalPopulation,
            raion.totalHouseholds,
            raion.laborForce,
            raion.assignedWorkers,
            raion.idleWorkers,
            raion.avgMorale,
            raion.avgLoyalty,
            raion.avgSkill,
            raion.birthsThisYear,
            raion.deathsThisYear,
            raion.totalBirths,
            raion.totalDeaths,
          ];

          for (const val of raionValues) {
            if (Number.isNaN(val)) {
              nanDetectedAtTick = tick;
              break;
            }
          }
        }

        if (nanDetectedAtTick >= 0) break;
      }
    }

    if (nanDetectedAtTick >= 0) {
      const yearOfNaN = Math.floor(nanDetectedAtTick / TICKS_PER_YEAR);
      console.log(`  NaN detected at tick ${nanDetectedAtTick} (year ~${1917 + yearOfNaN})`);
    }

    expect(nanDetectedAtTick).toBe(-1);

    // Final check on all resource values
    const res = getResources();
    expect(Number.isNaN(res.food)).toBe(false);
    expect(Number.isNaN(res.population)).toBe(false);
    expect(Number.isNaN(res.money)).toBe(false);

    console.log(`  No NaN values detected across 1000 years (checked every 10 years)`);
  }, 120000);

  it('population survives at least 500 years', () => {
    const { engine } = createBenchmarkEngine();

    let lastNonZeroYear = 0;
    const snapshots: { year: number; pop: number }[] = [];

    for (let year = 0; year < 1000; year++) {
      topUpResources();

      for (let tick = 0; tick < TICKS_PER_YEAR; tick++) {
        engine.tick();
      }

      const raion = getRaion();
      const pop = raion?.totalPopulation ?? getResources().population;

      if (pop > 0) {
        lastNonZeroYear = year;
      }

      if (year % 50 === 0 || year === 999) {
        snapshots.push({ year: 1917 + year, pop });
      }
    }

    console.log('\n  === Population Over 1000 Years ===');
    for (const s of snapshots) {
      console.log(`  year=${s.year} pop=${s.pop.toLocaleString()}`);
    }
    console.log(`  Population survived until year ${1917 + lastNonZeroYear}`);

    // Population must be non-zero for at least 500 years
    expect(lastNonZeroYear).toBeGreaterThanOrEqual(500);
  }, 120000);
});

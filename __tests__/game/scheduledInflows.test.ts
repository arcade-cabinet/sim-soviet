/**
 * @fileoverview Tests for Task 3: WW2 conscription rate + scheduled population inflows.
 *
 * 3a: Wartime conscription rate is 0.15 (15% of population per interval)
 * 3b: Scheduled inflows fire at correct intervals per era
 */

import {
  type DoctrineContext,
  evaluateDoctrineMechanics,
  resetPaperwork,
  resetThawFreezeState,
} from '@/ai/agents/political/doctrine';
import { political } from '@/config';
import { createMetaStore, createResourceStore } from '@/ecs/factories';
import { world } from '@/ecs/world';
import { GameGrid } from '@/game/GameGrid';
import { GameRng } from '@/game/SeedSystem';
import type { SimCallbacks } from '@/game/SimulationEngine';
import { SimulationEngine } from '@/game/SimulationEngine';

function makeCtx(overrides: Partial<DoctrineContext> = {}): DoctrineContext {
  return {
    currentEraId: 'revolution',
    totalTicks: 30,
    currentFood: 100,
    currentPop: 50,
    currentMoney: 200,
    quotaProgress: 0.5,
    rng: new GameRng('test-conscription'),
    eraStartTick: 0,
    currentPaperwork: 0,
    ...overrides,
  };
}

function createMockCallbacks(): SimCallbacks {
  return {
    onToast: jest.fn(),
    onAdvisor: jest.fn(),
    onPravda: jest.fn(),
    onStateChange: jest.fn(),
    onTutorialMilestone: jest.fn(),
    onAchievement: jest.fn(),
    onGameTally: jest.fn(),
    onGameOver: jest.fn(),
    onEraChanged: jest.fn(),
    onMinigame: jest.fn(),
    onSettlementChange: jest.fn(),
  };
}

// ── 3a: Wartime Conscription Rate ──────────────────────────────

describe('Wartime conscription rate (3a)', () => {
  beforeEach(() => {
    resetThawFreezeState();
    resetPaperwork();
  });

  it('config wartimeConscriptionRate is 0.15', () => {
    expect(political.doctrine.wartimeConscriptionRate).toBe(0.15);
  });

  it('conscription removes 15% of population per interval', () => {
    const effects = evaluateDoctrineMechanics(
      makeCtx({ currentEraId: 'great_patriotic', totalTicks: 120, currentPop: 100 }),
    );
    const conscription = effects.find((e) => e.mechanicId === 'wartime_conscription');
    expect(conscription).toBeDefined();
    // 15% of 100 = 15
    expect(conscription!.popDelta).toBe(-15);
  });

  it('conscription at 120-tick intervals across ~12 firings is devastating', () => {
    // Simulate cumulative conscription over 1440 ticks (4 wartime years)
    let pop = 100;
    let totalConscripted = 0;
    for (let tick = 120; tick <= 1440; tick += 120) {
      if (pop <= 10) break; // mechanic stops at <= 10
      const effects = evaluateDoctrineMechanics(
        makeCtx({ currentEraId: 'great_patriotic', totalTicks: tick, currentPop: pop }),
      );
      const conscription = effects.find((e) => e.mechanicId === 'wartime_conscription');
      if (conscription) {
        totalConscripted += Math.abs(conscription.popDelta);
        pop += conscription.popDelta;
      }
    }
    // With 15% per interval across 12 firings, cumulative loss should be significant
    // (1 - 0.85^12) ≈ 86% of original pop consumed
    expect(totalConscripted).toBeGreaterThan(60); // > 60% of original 100
  });

  it('conscription does not fire when pop is 10 or below', () => {
    const effects = evaluateDoctrineMechanics(
      makeCtx({ currentEraId: 'great_patriotic', totalTicks: 120, currentPop: 10 }),
    );
    const conscription = effects.find((e) => e.mechanicId === 'wartime_conscription');
    expect(conscription).toBeUndefined();
  });
});

// ── 3b: Scheduled Inflows Configuration ────────────────────────

describe('Scheduled inflow config (3b)', () => {
  it('inflowSchedule exists in political config', () => {
    expect(political.doctrine.inflowSchedule).toBeDefined();
  });

  it('has entries for collectivization through stagnation', () => {
    const schedule = political.doctrine.inflowSchedule;
    expect(schedule.collectivization).toBeDefined();
    expect(schedule.industrialization).toBeDefined();
    expect(schedule.great_patriotic).toBeDefined();
    expect(schedule.reconstruction).toBeDefined();
    expect(schedule.thaw_and_freeze).toBeDefined();
    expect(schedule.stagnation).toBeDefined();
  });

  it('great_patriotic is marked as once-only', () => {
    const gp = political.doctrine.inflowSchedule.great_patriotic;
    expect(gp.once).toBe(true);
    expect(gp.type).toBe('evacuee_influx');
    expect(gp.count).toEqual([10, 30]);
  });

  it('collectivization uses forced_resettlement every 3 years', () => {
    const col = political.doctrine.inflowSchedule.collectivization;
    expect(col.type).toBe('forced_resettlement');
    expect(col.intervalYears).toBe(3);
  });

  it('industrialization uses moscow_assignment every 2 years', () => {
    const ind = political.doctrine.inflowSchedule.industrialization;
    expect(ind.type).toBe('moscow_assignment');
    expect(ind.intervalYears).toBe(2);
  });

  it('reconstruction uses veteran_return every 2 years', () => {
    const rec = political.doctrine.inflowSchedule.reconstruction;
    expect(rec.type).toBe('veteran_return');
    expect(rec.intervalYears).toBe(2);
    expect(rec.count).toEqual([5, 20]);
  });
});

// ── 3b: Scheduled Inflows Integration (SimulationEngine) ───────

describe('Scheduled inflows integration (3b)', () => {
  let grid: GameGrid;
  let cb: ReturnType<typeof createMockCallbacks>;
  let engine: SimulationEngine;

  beforeEach(() => {
    world.clear();
    grid = new GameGrid();
    cb = createMockCallbacks();
    // Prevent EventSystem from firing random events
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    createResourceStore();
    createMetaStore();
    engine = new SimulationEngine(grid, cb);
  });

  afterEach(() => {
    world.clear();
    jest.restoreAllMocks();
  });

  it('serializes lastInflowYear and evacueeInfluxFired', () => {
    const data = engine.serializeSubsystems();
    expect(data.engineState).toBeDefined();
    expect(data.engineState!.lastInflowYear).toBeDefined();
    expect(data.engineState!.evacueeInfluxFired).toBe(false);
  });

  it('restores lastInflowYear and evacueeInfluxFired from save data', () => {
    const data = engine.serializeSubsystems();
    data.engineState!.lastInflowYear = { industrialization: 1935 };
    data.engineState!.evacueeInfluxFired = true;

    engine.restoreSubsystems(data);
    const data2 = engine.serializeSubsystems();
    expect(data2.engineState!.lastInflowYear).toEqual({ industrialization: 1935 });
    expect(data2.engineState!.evacueeInfluxFired).toBe(true);
  });

  it('defaults missing inflowYear/evacueeInflux fields for old saves', () => {
    const data = engine.serializeSubsystems();
    // Simulate old save without these fields
    delete data.engineState!.lastInflowYear;
    delete data.engineState!.evacueeInfluxFired;

    engine.restoreSubsystems(data);
    const data2 = engine.serializeSubsystems();
    expect(data2.engineState!.lastInflowYear).toEqual({});
    expect(data2.engineState!.evacueeInfluxFired).toBe(false);
  });
});

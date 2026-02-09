import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildingsLogic, getResourceEntity } from '../ecs/archetypes';
import { createBuilding, createResourceStore } from '../ecs/factories';
import type { QuotaState } from '../ecs/systems';
import { world } from '../ecs/world';
import { GameState } from '../game/GameState';
import type { SimCallbacks } from '../game/SimulationEngine';
import { SimulationEngine } from '../game/SimulationEngine';

/**
 * Creates mock callbacks that satisfy the SimulationEngine constructor.
 */
function createMockCallbacks(): SimCallbacks {
  return {
    onToast: vi.fn(),
    onAdvisor: vi.fn(),
    onPravda: vi.fn(),
    onStateChange: vi.fn(),
    onGameOver: vi.fn(),
    onBuildingCollapsed: vi.fn(),
  };
}

/** Number of ticks in one full year (3 ticks/day * 10 days/month * 12 months) */
const TICKS_PER_YEAR = 360;

/**
 * Advance the engine by a number of years.
 * Mocks Math.random to avoid stochastic event interference.
 */
function advanceYears(engine: SimulationEngine, years: number): void {
  for (let i = 0; i < years * TICKS_PER_YEAR; i++) {
    engine.tick();
  }
}

describe('SimulationEngine edge cases', () => {
  let gs: GameState;
  let cb: SimCallbacks;
  let engine: SimulationEngine;

  beforeEach(() => {
    world.clear();
    gs = new GameState();
    cb = createMockCallbacks();
    createResourceStore({
      money: gs.money,
      food: gs.food,
      vodka: gs.vodka,
      power: gs.power,
      powerUsed: gs.powerUsed,
      population: gs.pop,
    });
    engine = new SimulationEngine(gs, cb);
  });

  afterEach(() => {
    world.clear();
    vi.restoreAllMocks();
  });

  // ── No victory condition ─────────────────────────────────────

  describe('no victory condition: the Soviet state is eternal', () => {
    it('game does not end after any number of years with quota met', () => {
      world.clear();
      const gs2 = new GameState();
      gs2.date.year = 1990;
      gs2.date.month = 12;
      const cb2 = createMockCallbacks();
      createResourceStore({ food: 9999, vodka: 9999, population: 100 });
      const engine2 = new SimulationEngine(gs2, cb2);

      vi.spyOn(Math, 'random').mockReturnValue(0.99);

      // Tick through 5 years — game should not end with a victory
      advanceYears(engine2, 5);

      // onGameOver should NOT have been called with victory=true
      const gameOverCalls = (cb2.onGameOver as ReturnType<typeof vi.fn>).mock.calls as [
        boolean,
        string,
      ][];
      const victoryCalls = gameOverCalls.filter((call) => call[0] === true);
      expect(victoryCalls).toHaveLength(0);
    });
  });

  // ── Loss condition: 3 consecutive quota failures ──────────

  describe('loss condition: 3 consecutive quota failures', () => {
    it('ends game after 3 consecutive quota failures', () => {
      world.clear();
      const gs2 = new GameState();
      gs2.date.year = 1926;
      gs2.date.month = 12; // First deadline at 1927
      const cb2 = createMockCallbacks();
      // Not enough food to meet any quota of 500
      createResourceStore({ food: 10, vodka: 10, population: 0 });
      const engine2 = new SimulationEngine(gs2, cb2);

      vi.spyOn(Math, 'random').mockReturnValue(0.99);

      // Advance through 3 five-year plans: 1927, 1932, 1937
      // Year 1926 Oct → 1927 Jan (fail 1) — 3 months (90 ticks)
      for (let i = 0; i < 90; i++) engine2.tick();

      // After first failure, deadline advances to 1932
      expect(cb2.onAdvisor).toHaveBeenCalledWith(expect.stringContaining('failed the 5-Year Plan'));

      // Year 1927 -> 1932 (fail 2)
      advanceYears(engine2, 5);

      // Year 1932 -> 1937 (fail 3) — game over
      advanceYears(engine2, 5);

      expect(cb2.onGameOver).toHaveBeenCalledWith(false, expect.stringContaining('Politburo'));
      expect(gs2.gameOver).not.toBeNull();
      expect(gs2.gameOver!.victory).toBe(false);
    });

    it('resets failure counter when quota is met', () => {
      world.clear();
      const gs2 = new GameState();
      gs2.date.year = 1926;
      const cb2 = createMockCallbacks();
      // Enough food initially (pop=0 means no consumption)
      createResourceStore({ food: 600, vodka: 0, population: 0 });
      const engine2 = new SimulationEngine(gs2, cb2);

      vi.spyOn(Math, 'random').mockReturnValue(0.99);

      // Oct 1926 → Jan 1927 (90 ticks = 3 months): quota met (food >= 500)
      for (let i = 0; i < 90; i++) engine2.tick();

      expect(cb2.onAdvisor).toHaveBeenCalledWith(expect.stringContaining('Quota met'));

      // After success, quota switches to vodka, failure counter resets
      const quota = engine2.getQuota() as QuotaState;
      expect(quota.type).toBe('vodka');
    });
  });

  // ── Loss condition: population reaches 0 ──────────────────

  describe('loss condition: population reaches 0', () => {
    it('ends game when population hits 0 after first year with buildings', () => {
      world.clear();
      const gs2 = new GameState();
      const cb2 = createMockCallbacks();
      createResourceStore({ food: 9999, vodka: 9999, population: 3 });
      const engine2 = new SimulationEngine(gs2, cb2);
      createBuilding(0, 0, 'apartment-tower-a');

      vi.spyOn(Math, 'random').mockReturnValue(0.99);

      // Advance past TICKS_PER_YEAR (360) ticks so the grace period expires
      for (let i = 0; i < 361; i++) engine2.tick();

      // Now set food to 0 and let starvation kill everyone
      const store = getResourceEntity()!;
      store.resources.food = 0;
      store.resources.vodka = 0;
      store.resources.population = 3;
      engine2.tick();

      expect(gs2.pop).toBe(0);
      expect(cb2.onGameOver).toHaveBeenCalledWith(false, expect.stringContaining('perished'));
      expect(gs2.gameOver!.victory).toBe(false);
    });

    it('does not end game during first year even if pop=0 with buildings', () => {
      world.clear();
      const gs2 = new GameState();
      const cb2 = createMockCallbacks();
      createResourceStore({ food: 0, vodka: 0, population: 3 });
      const engine2 = new SimulationEngine(gs2, cb2);
      createBuilding(0, 0, 'apartment-tower-a');

      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      engine2.tick();

      // Pop drops to 0 but within first year (totalTicks <= TICKS_PER_YEAR), so no game over
      expect(gs2.pop).toBe(0);
      expect(cb2.onGameOver).not.toHaveBeenCalled();
    });

    it('does not end game if pop=0 but no buildings', () => {
      world.clear();
      const gs2 = new GameState();
      const cb2 = createMockCallbacks();
      createResourceStore({ food: 0, vodka: 0, population: 0 });
      const engine2 = new SimulationEngine(gs2, cb2);

      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      // Advance past first year
      for (let i = 0; i < 400; i++) engine2.tick();

      // Pop=0 but no buildings => no game over
      expect(cb2.onGameOver).not.toHaveBeenCalled();
    });
  });

  // ── Game does not tick after ended ────────────────────────

  describe('game does not tick after ended', () => {
    it('tick() is a no-op after game over', () => {
      world.clear();
      const gs2 = new GameState();
      const cb2 = createMockCallbacks();
      createResourceStore({ food: 9999, vodka: 9999, population: 3 });
      const engine2 = new SimulationEngine(gs2, cb2);
      createBuilding(0, 0, 'apartment-tower-a');

      vi.spyOn(Math, 'random').mockReturnValue(0.99);

      // Advance past first year so pop-loss check activates
      for (let i = 0; i < 361; i++) engine2.tick();

      // Now cause starvation to trigger game over
      const store = getResourceEntity()!;
      store.resources.food = 0;
      store.resources.vodka = 0;
      store.resources.population = 3;
      engine2.tick();
      expect(gs2.gameOver).not.toBeNull();

      const yearAtGameOver = gs2.date.year;
      const popAtGameOver = gs2.pop;
      const stateChangeCountAtGameOver = (cb2.onStateChange as ReturnType<typeof vi.fn>).mock.calls
        .length;

      // Additional ticks should be ignored
      engine2.tick();
      engine2.tick();
      engine2.tick();

      expect(gs2.date.year).toBe(yearAtGameOver);
      expect(gs2.pop).toBe(popAtGameOver);
      expect(cb2.onStateChange).toHaveBeenCalledTimes(stateChangeCountAtGameOver);
    });

    it('tick count does not increase after game ends', () => {
      world.clear();
      const gs2 = new GameState();
      const cb2 = createMockCallbacks();
      createResourceStore({ food: 9999, vodka: 9999, population: 2 });
      const engine2 = new SimulationEngine(gs2, cb2);
      createBuilding(0, 0, 'apartment-tower-a');

      vi.spyOn(Math, 'random').mockReturnValue(0.99);

      // Advance past first year
      for (let i = 0; i < 361; i++) engine2.tick();

      // Cause starvation
      const store = getResourceEntity()!;
      store.resources.food = 0;
      store.resources.vodka = 0;
      store.resources.population = 2;
      engine2.tick(); // Game ends here
      const tickVal = gs2.date.tick;

      engine2.tick();
      expect(gs2.date.tick).toBe(tickVal);
    });
  });

  // ── ECS world sync after each tick ────────────────────────

  describe('ECS world sync after each tick', () => {
    it('GameState.buildings matches ECS buildingsLogic entities', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'apartment-tower-a');
      createBuilding(2, 2, 'collective-farm-hq');

      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      engine.tick();

      // GameState.buildings should have the same count as ECS
      expect(gs.buildings.length).toBe(buildingsLogic.entities.length);

      // Each building should have matching data
      for (const gsBuilding of gs.buildings) {
        const ecsEntity = buildingsLogic.entities.find(
          (e) => e.position.gridX === gsBuilding.x && e.position.gridY === gsBuilding.y
        );
        expect(ecsEntity).toBeDefined();
        expect(ecsEntity!.building.powered).toBe(gsBuilding.powered);
      }
    });

    it('GameState resources match ECS resource store after tick', () => {
      const store = getResourceEntity()!;
      store.resources.food = 999;
      store.resources.vodka = 888;
      store.resources.money = 7777;
      store.resources.population = 42;

      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      engine.tick();

      // After tick, ECS store values are synced to GameState
      // Note: consumption/production may change values, so just check sync consistency
      expect(gs.food).toBe(store.resources.food);
      expect(gs.vodka).toBe(store.resources.vodka);
      expect(gs.money).toBe(store.resources.money);
      expect(gs.pop).toBe(store.resources.population);
      expect(gs.power).toBe(store.resources.power);
      expect(gs.powerUsed).toBe(store.resources.powerUsed);
    });

    it('quota state is synced to GameState after tick', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      const store = getResourceEntity()!;
      store.resources.food = 350;
      engine.tick();

      const engineQuota = engine.getQuota();
      expect(gs.quota.type).toBe(engineQuota.type);
      expect(gs.quota.target).toBe(engineQuota.target);
      expect(gs.quota.current).toBe(engineQuota.current);
      expect(gs.quota.deadlineYear).toBe(engineQuota.deadlineYear);
    });
  });

  // ── Resource balance: no infinite-money exploit ───────────

  describe('resource balance: no infinite-money exploit', () => {
    it('money does not increase without an explicit source', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      const initialMoney = gs.money;

      engine.tick();
      engine.tick();
      engine.tick();

      // Money should not increase just from ticking
      // (unless an event grants money, which we avoided with high random)
      expect(gs.money).toBeLessThanOrEqual(initialMoney);
    });

    it('food production is bounded by number of powered farms', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'collective-farm-hq'); // base 20 food/tick, modified by weather + politburo

      const store = getResourceEntity()!;
      const initialFood = store.resources.food;

      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      engine.tick();

      // Food should increase or stay same (snow/blizzard → farmModifier=0.0 is valid)
      if (store.resources.population === 0) {
        expect(gs.food).toBeGreaterThanOrEqual(initialFood);
      } else {
        // With population, consumption may offset production
        expect(gs.food).toBeGreaterThanOrEqual(
          initialFood - Math.ceil(store.resources.population / 10)
        );
      }
    });

    it('vodka production is bounded by number of powered distilleries', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'vodka-distillery'); // base 10 vodka/tick, modified by politburo

      const store = getResourceEntity()!;
      const initialVodka = store.resources.vodka;

      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      engine.tick();

      // Vodka should increase (exact amount depends on politburo modifiers)
      if (store.resources.population === 0) {
        expect(gs.vodka).toBeGreaterThan(initialVodka);
      } else {
        // With population, consumption may offset production
        const consumed = Math.ceil(store.resources.population / 20);
        expect(gs.vodka).toBeGreaterThanOrEqual(initialVodka - consumed);
      }
    });

    it('resources remain non-negative after consumption', () => {
      const store = getResourceEntity()!;
      store.resources.food = 5;
      store.resources.vodka = 2;
      store.resources.population = 100;
      store.resources.money = 0;

      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      engine.tick();

      // Food and vodka should not go negative
      expect(gs.food).toBeGreaterThanOrEqual(0);
      expect(gs.vodka).toBeGreaterThanOrEqual(0);
      expect(gs.money).toBeGreaterThanOrEqual(0);
    });
  });

  // ── Gulag effect edge cases ───────────────────────────────

  describe('gulag effect', () => {
    it('powered gulag has a chance to reduce population', () => {
      world.clear();
      const gs2 = new GameState();
      const cb2 = createMockCallbacks();
      createResourceStore({ food: 9999, vodka: 9999, population: 100 });
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'gulag-admin');

      // Mock random to always trigger gulag effect (< 0.1)
      vi.spyOn(Math, 'random').mockReturnValue(0.05);
      const engine2 = new SimulationEngine(gs2, cb2);
      engine2.tick();

      // Population should have decreased by at least 1 (gulag effect)
      // Note: consumption also runs, but food is abundant
      expect(gs2.pop).toBeLessThan(100);
    });

    it('unpowered gulag does not affect population', () => {
      world.clear();
      const gs2 = new GameState();
      const cb2 = createMockCallbacks();
      createResourceStore({ food: 9999, vodka: 9999, population: 100 });
      createBuilding(1, 1, 'gulag-admin'); // No power plant

      vi.spyOn(Math, 'random').mockReturnValue(0.05);
      const engine2 = new SimulationEngine(gs2, cb2);
      engine2.tick();

      // Population should not decrease from gulag (it's unpowered)
      // Population growth may occur if housing cap allows, but no gulag effect
      const store = getResourceEntity()!;
      // Gulag has no housing cap positive contribution
      expect(store.resources.population).toBe(100);
    });
  });

  // ── Multiple ticks stability ──────────────────────────────

  describe('stability over many ticks', () => {
    it('engine does not throw over 100 ticks', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'apartment-tower-a');
      createBuilding(2, 2, 'collective-farm-hq');
      createBuilding(3, 3, 'vodka-distillery');

      vi.spyOn(Math, 'random').mockReturnValue(0.99);

      expect(() => {
        for (let i = 0; i < 100; i++) {
          engine.tick();
        }
      }).not.toThrow();
    });

    it('onStateChange fires every non-ended tick', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99);

      for (let i = 0; i < 10; i++) {
        engine.tick();
      }

      expect(cb.onStateChange).toHaveBeenCalledTimes(10);
    });
  });

  // ── Season / weather / day-phase callback edge cases ──────

  describe('chronology callbacks', () => {
    it('fires onSeasonChanged when season transitions', () => {
      const onSeasonChanged = vi.fn();
      world.clear();
      const gs2 = new GameState();
      const cb2 = { ...createMockCallbacks(), onSeasonChanged };
      createResourceStore({ food: 9999, vodka: 9999, population: 0 });
      const engine2 = new SimulationEngine(gs2, cb2);

      vi.spyOn(Math, 'random').mockReturnValue(0.99);

      // Tick through enough ticks to go through multiple seasons
      // 90 ticks = 3 months, should trigger at least 1 season change
      for (let i = 0; i < 120; i++) {
        engine2.tick();
      }

      expect(onSeasonChanged).toHaveBeenCalled();
    });
  });
});

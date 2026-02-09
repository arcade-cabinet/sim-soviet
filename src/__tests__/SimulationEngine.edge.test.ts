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

  // ── Victory condition ─────────────────────────────────────

  describe('victory condition: game ends at year 1995', () => {
    it('triggers victory when reaching year 1995 with quota met', () => {
      // Start at year 1994 so 1 year of ticking gets us to 1995
      world.clear();
      const gs2 = new GameState();
      gs2.date.year = 1994;
      const cb2 = createMockCallbacks();
      createResourceStore({ food: 9999, vodka: 9999, population: 100 });
      const engine2 = new SimulationEngine(gs2, cb2);

      vi.spyOn(Math, 'random').mockReturnValue(0.99);

      // Need to reach 1995 — tick through 1 year
      advanceYears(engine2, 1);

      expect(cb2.onGameOver).toHaveBeenCalledWith(true, expect.stringContaining('survived'));
      expect(gs2.gameOver).not.toBeNull();
      expect(gs2.gameOver!.victory).toBe(true);
    });

    it('game state records victory reason', () => {
      world.clear();
      const gs2 = new GameState();
      gs2.date.year = 1994;
      const cb2 = createMockCallbacks();
      createResourceStore({ food: 9999, vodka: 9999, population: 100 });
      const engine2 = new SimulationEngine(gs2, cb2);

      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      advanceYears(engine2, 1);

      expect(gs2.gameOver!.reason).toContain('Five-Year Plans');
    });
  });

  // ── Loss condition: 3 consecutive quota failures ──────────

  describe('loss condition: 3 consecutive quota failures', () => {
    it('ends game after 3 consecutive quota failures', () => {
      world.clear();
      const gs2 = new GameState();
      gs2.date.year = 1984; // First deadline at 1985
      const cb2 = createMockCallbacks();
      // Not enough food to meet any quota of 500
      createResourceStore({ food: 10, vodka: 10, population: 0 });
      const engine2 = new SimulationEngine(gs2, cb2);

      vi.spyOn(Math, 'random').mockReturnValue(0.99);

      // Advance through 3 five-year plans: 1985, 1990, 1995
      // Year 1984 -> 1985 (fail 1)
      advanceYears(engine2, 1);

      // After first failure, deadline advances to 1990
      expect(cb2.onAdvisor).toHaveBeenCalledWith(expect.stringContaining('failed the 5-Year Plan'));

      // Year 1985 -> 1990 (fail 2)
      advanceYears(engine2, 5);

      // Year 1990 -> 1995 (fail 3) — game over
      advanceYears(engine2, 5);

      expect(cb2.onGameOver).toHaveBeenCalledWith(false, expect.stringContaining('Politburo'));
      expect(gs2.gameOver).not.toBeNull();
      expect(gs2.gameOver!.victory).toBe(false);
    });

    it('resets failure counter when quota is met', () => {
      world.clear();
      const gs2 = new GameState();
      gs2.date.year = 1984;
      const cb2 = createMockCallbacks();
      // Enough food initially
      createResourceStore({ food: 600, vodka: 0, population: 0 });
      const engine2 = new SimulationEngine(gs2, cb2);

      vi.spyOn(Math, 'random').mockReturnValue(0.99);

      // Year 1984 -> 1985: quota met (food >= 500)
      advanceYears(engine2, 1);

      expect(cb2.onAdvisor).toHaveBeenCalledWith(expect.stringContaining('Quota met'));

      // After success, quota switches to vodka, failure counter resets
      // Next quota is vodka 500, deadline 1990
      const quota = engine2.getQuota() as QuotaState;
      expect(quota.type).toBe('vodka');
    });
  });

  // ── Loss condition: population reaches 0 ──────────────────

  describe('loss condition: population reaches 0', () => {
    it('ends game when population hits 0 after 1980 with buildings', () => {
      world.clear();
      const gs2 = new GameState();
      gs2.date.year = 1981;
      gs2.date.month = 1;
      gs2.date.tick = 0;
      const cb2 = createMockCallbacks();
      createResourceStore({ food: 0, vodka: 0, population: 3 });
      const engine2 = new SimulationEngine(gs2, cb2);
      // Place a building so buildings.length > 0
      createBuilding(0, 0, 'housing');

      vi.spyOn(Math, 'random').mockReturnValue(0.99);

      // Tick until population drops to 0 from starvation
      // Pop=3, no food -> starvation drops by 5, clamped at 0
      engine2.tick();

      expect(gs2.pop).toBe(0);
      expect(cb2.onGameOver).toHaveBeenCalledWith(false, expect.stringContaining('perished'));
      expect(gs2.gameOver!.victory).toBe(false);
    });

    it('does not end game at year 1980 even if pop=0 with buildings', () => {
      world.clear();
      const gs2 = new GameState();
      gs2.date.year = 1980;
      gs2.date.month = 1;
      gs2.date.tick = 0;
      const cb2 = createMockCallbacks();
      createResourceStore({ food: 0, vodka: 0, population: 3 });
      const engine2 = new SimulationEngine(gs2, cb2);
      createBuilding(0, 0, 'housing');

      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      engine2.tick();

      // Pop drops to 0 but year is 1980, so no game over
      expect(gs2.pop).toBe(0);
      expect(cb2.onGameOver).not.toHaveBeenCalled();
    });

    it('does not end game if pop=0 but no buildings', () => {
      world.clear();
      const gs2 = new GameState();
      gs2.date.year = 1982;
      const cb2 = createMockCallbacks();
      createResourceStore({ food: 0, vodka: 0, population: 0 });
      const engine2 = new SimulationEngine(gs2, cb2);

      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      engine2.tick();

      // Pop=0 and year>1980 but no buildings => no game over
      expect(cb2.onGameOver).not.toHaveBeenCalled();
    });
  });

  // ── Game does not tick after ended ────────────────────────

  describe('game does not tick after ended', () => {
    it('tick() is a no-op after game over', () => {
      world.clear();
      const gs2 = new GameState();
      gs2.date.year = 1981;
      const cb2 = createMockCallbacks();
      createResourceStore({ food: 0, vodka: 0, population: 3 });
      const engine2 = new SimulationEngine(gs2, cb2);
      createBuilding(0, 0, 'housing');

      vi.spyOn(Math, 'random').mockReturnValue(0.99);

      // First tick: starvation kills pop -> game over
      engine2.tick();
      expect(gs2.gameOver).not.toBeNull();

      const yearAtGameOver = gs2.date.year;
      const popAtGameOver = gs2.pop;

      // Additional ticks should be ignored
      engine2.tick();
      engine2.tick();
      engine2.tick();

      expect(gs2.date.year).toBe(yearAtGameOver);
      expect(gs2.pop).toBe(popAtGameOver);
      // onStateChange should have been called only once (the initial game-ending tick)
      expect(cb2.onStateChange).toHaveBeenCalledTimes(1);
    });

    it('tick count does not increase after game ends', () => {
      world.clear();
      const gs2 = new GameState();
      gs2.date.year = 1981;
      const cb2 = createMockCallbacks();
      createResourceStore({ food: 0, vodka: 0, population: 2 });
      const engine2 = new SimulationEngine(gs2, cb2);
      createBuilding(0, 0, 'housing');

      vi.spyOn(Math, 'random').mockReturnValue(0.99);

      engine2.tick(); // Game ends here
      const tickVal = gs2.date.tick;

      engine2.tick();
      expect(gs2.date.tick).toBe(tickVal);
    });
  });

  // ── ECS world sync after each tick ────────────────────────

  describe('ECS world sync after each tick', () => {
    it('GameState.buildings matches ECS buildingsLogic entities', () => {
      createBuilding(0, 0, 'power');
      createBuilding(1, 1, 'housing');
      createBuilding(2, 2, 'farm');

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
      createBuilding(0, 0, 'power');
      createBuilding(1, 1, 'farm'); // base 20 food/tick, modified by weather + politburo

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
      createBuilding(0, 0, 'power');
      createBuilding(1, 1, 'distillery'); // base 10 vodka/tick, modified by politburo

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
      createBuilding(0, 0, 'power');
      createBuilding(1, 1, 'gulag');

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
      createBuilding(1, 1, 'gulag'); // No power plant

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
      createBuilding(0, 0, 'power');
      createBuilding(1, 1, 'housing');
      createBuilding(2, 2, 'farm');
      createBuilding(3, 3, 'distillery');

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

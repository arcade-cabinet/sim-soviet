import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getResourceEntity } from '../ecs/archetypes';
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
  };
}

describe('SimulationEngine', () => {
  let gs: GameState;
  let cb: SimCallbacks;
  let engine: SimulationEngine;

  beforeEach(() => {
    world.clear();
    gs = new GameState();
    cb = createMockCallbacks();
    // Prevent EventSystem from firing random events during deterministic tests.
    // Value >0.12 means the 12% event roll always fails.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    // Create ECS resource store matching GameState defaults
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
  });

  // ── Time advancement (via ChronologySystem) ────────────────

  describe('time advancement', () => {
    it('advances hour by HOURS_PER_TICK on each tick', () => {
      engine.tick();
      // ChronologySystem advances by HOURS_PER_TICK (8)
      // gs.date.tick is mapped to the hour value
      expect(gs.date.tick).toBe(8);
    });

    it('rolls month after 30 ticks', () => {
      // 3 ticks/day × 10 days/month = 30 ticks per month
      for (let i = 0; i < 30; i++) engine.tick();
      expect(gs.date.month).toBe(2);
    });

    it('rolls year after 360 ticks', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      // 30 ticks/month × 12 months = 360 ticks per year
      for (let i = 0; i < 360; i++) engine.tick();
      expect(gs.date.year).toBe(1981);
      expect(gs.date.month).toBe(1);
    });

    it('handles multiple ticks within the same month', () => {
      for (let i = 0; i < 5; i++) engine.tick();
      // 5 ticks × 8 hours = 40 hours → day 2, hour 16
      expect(gs.date.tick).toBe(16);
      expect(gs.date.month).toBe(1);
    });
  });

  // ── Resource calculation: power ─────────────────────────

  describe('power calculation', () => {
    it('calculates total power from power plants', () => {
      createBuilding(0, 0, 'power'); // powerOutput=100
      engine.tick();
      expect(gs.power).toBe(100);
    });

    it('accumulates power from multiple plants', () => {
      createBuilding(0, 0, 'power');
      createBuilding(1, 1, 'power');
      engine.tick();
      expect(gs.power).toBe(200);
    });

    it('reports 0 power with no power plants', () => {
      createBuilding(0, 0, 'housing');
      engine.tick();
      expect(gs.power).toBe(0);
    });
  });

  // ── Resource calculation: food ──────────────────────────

  describe('food production', () => {
    it('produces food from powered farms', () => {
      createBuilding(0, 0, 'power');
      createBuilding(1, 1, 'farm');
      const store = getResourceEntity()!;
      const initialFood = store.resources.food;
      engine.tick();
      expect(gs.food).toBe(initialFood + 20);
    });

    it('does not produce food from unpowered farms', () => {
      createBuilding(1, 1, 'farm');
      const store = getResourceEntity()!;
      const initialFood = store.resources.food;
      engine.tick();
      expect(gs.food).toBe(initialFood);
    });

    it('produces food from multiple farms', () => {
      createBuilding(0, 0, 'power');
      createBuilding(1, 1, 'farm');
      createBuilding(2, 2, 'farm');
      const store = getResourceEntity()!;
      const initialFood = store.resources.food;
      engine.tick();
      expect(gs.food).toBe(initialFood + 40);
    });
  });

  // ── Resource calculation: vodka ─────────────────────────

  describe('vodka production', () => {
    it('produces vodka from powered distilleries', () => {
      createBuilding(0, 0, 'power');
      createBuilding(1, 1, 'distillery');
      const store = getResourceEntity()!;
      const initialVodka = store.resources.vodka;
      engine.tick();
      expect(gs.vodka).toBe(initialVodka + 10);
    });

    it('does not produce vodka from unpowered distilleries', () => {
      createBuilding(1, 1, 'distillery');
      const store = getResourceEntity()!;
      const initialVodka = store.resources.vodka;
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      engine.tick();
      expect(gs.vodka).toBe(initialVodka);
    });
  });

  // ── Power distribution ─────────────────────────────────

  describe('power distribution', () => {
    it('tracks total power used by buildings', () => {
      createBuilding(0, 0, 'power'); // powerOutput=100
      createBuilding(1, 1, 'housing'); // powerReq=5
      createBuilding(2, 2, 'farm'); // powerReq=2
      engine.tick();
      expect(gs.powerUsed).toBe(7);
    });

    it('marks buildings as unpowered when power exceeds supply', () => {
      createBuilding(1, 1, 'housing'); // No power plant
      engine.tick();
      const building = gs.buildings.find((b) => b.type === 'housing');
      expect(building!.powered).toBe(false);
    });

    it('marks buildings as powered when power is available', () => {
      createBuilding(0, 0, 'power');
      createBuilding(1, 1, 'housing');
      engine.tick();
      const housing = gs.buildings.find((b) => b.type === 'housing');
      expect(housing!.powered).toBe(true);
    });

    it('power plants themselves are always powered', () => {
      createBuilding(0, 0, 'power');
      engine.tick();
      const plant = gs.buildings.find((b) => b.type === 'power');
      expect(plant!.powered).toBe(true);
    });
  });

  // ── Food consumption ────────────────────────────────────

  describe('food consumption', () => {
    it('consumes food based on population (pop/10 rounded up)', () => {
      const store = getResourceEntity()!;
      store.resources.population = 15;
      store.resources.food = 100;
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      engine.tick();
      expect(gs.food).toBe(98); // 100 - ceil(15/10) = 100 - 2
    });

    it('consumes 0 food when population is 0', () => {
      const store = getResourceEntity()!;
      store.resources.population = 0;
      store.resources.food = 100;
      engine.tick();
      expect(gs.food).toBe(100);
    });

    it('causes starvation when food is insufficient', () => {
      const store = getResourceEntity()!;
      store.resources.population = 100;
      store.resources.food = 0;
      store.resources.vodka = 100;
      engine.tick();
      expect(gs.pop).toBeLessThanOrEqual(95);
      expect(cb.onToast).toHaveBeenCalledWith('STARVATION DETECTED');
    });

    it('reduces population by 5 during starvation (clamped at 0)', () => {
      const store = getResourceEntity()!;
      store.resources.population = 3;
      store.resources.food = 0;
      engine.tick();
      expect(gs.pop).toBe(0);
    });
  });

  // ── Vodka consumption ───────────────────────────────────

  describe('vodka consumption', () => {
    it('consumes vodka based on population (pop/20 rounded up)', () => {
      const store = getResourceEntity()!;
      store.resources.population = 20;
      store.resources.vodka = 50;
      store.resources.food = 100; // enough to avoid starvation
      engine.tick();
      expect(gs.vodka).toBe(49); // 50 - ceil(20/20) = 50 - 1
    });

    it('does not reduce population when vodka runs out', () => {
      const store = getResourceEntity()!;
      store.resources.population = 100;
      store.resources.food = 1000;
      store.resources.vodka = 0;
      engine.tick();
      expect(gs.pop).toBe(100);
    });
  });

  // ── Population growth ───────────────────────────────────

  describe('population growth', () => {
    it('does not grow population without housing', () => {
      const store = getResourceEntity()!;
      store.resources.food = 1000;
      store.resources.population = 0;
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      engine.tick();
      expect(gs.pop).toBe(0);
    });

    it('grows population when housing and food are available', () => {
      createBuilding(0, 0, 'power');
      createBuilding(1, 1, 'housing'); // housingCap=50
      const store = getResourceEntity()!;
      store.resources.food = 1000;
      store.resources.population = 5;
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      engine.tick();
      // populationSystem: rng undefined, Math.floor(0.5 * 3) = 1
      expect(gs.pop).toBe(6);
    });

    it('does not grow population when at housing cap', () => {
      createBuilding(0, 0, 'power');
      createBuilding(1, 1, 'housing'); // housingCap=50
      const store = getResourceEntity()!;
      store.resources.food = 1000;
      store.resources.population = 50;
      engine.tick();
      expect(gs.pop).toBe(50);
    });

    it('does not grow population when food is low', () => {
      createBuilding(0, 0, 'power');
      createBuilding(1, 1, 'housing');
      const store = getResourceEntity()!;
      store.resources.food = 5;
      store.resources.population = 1;
      engine.tick();
      // After consumption: food = 5 - ceil(1/10) = 4
      // populationSystem: food(4) > 10? No → no growth
      expect(gs.pop).toBeLessThanOrEqual(1);
    });
  });

  // ── Quota system ────────────────────────────────────────

  describe('quota system', () => {
    it('updates quota.current to match food when quota type is food', () => {
      const store = getResourceEntity()!;
      store.resources.food = 350;
      engine.tick();
      expect(gs.quota.current).toBe(350);
    });

    it('updates quota.current to match vodka when quota type is vodka', () => {
      // Default quota type is 'food', change to 'vodka'
      const quota = engine.getQuota() as QuotaState;
      quota.type = 'vodka';
      const store = getResourceEntity()!;
      store.resources.vodka = 75;
      engine.tick();
      expect(gs.quota.current).toBe(75);
    });

    it('shows success advisor and advances to vodka quota on year rollover when quota is met', () => {
      // Start close to the year boundary (year 1984 → 1985 matches deadline)
      world.clear();
      const gs2 = new GameState();
      gs2.date.year = 1984;
      const cb2 = createMockCallbacks();
      createResourceStore({ food: 600, vodka: 50, population: 0 });
      const engine2 = new SimulationEngine(gs2, cb2);

      vi.spyOn(Math, 'random').mockReturnValue(0.99);

      // Tick through one full year (360 ticks) to trigger newYear
      for (let i = 0; i < 360; i++) engine2.tick();

      expect(cb2.onAdvisor).toHaveBeenCalledWith(expect.stringContaining('Quota met'));
      expect(gs2.quota.type).toBe('vodka');
      expect(gs2.quota.target).toBe(500);
    });

    it('shows game-over advisor when quota is failed', () => {
      world.clear();
      const gs2 = new GameState();
      gs2.date.year = 1984;
      const cb2 = createMockCallbacks();
      createResourceStore({ food: 100, vodka: 50, population: 0 }); // Below target of 500
      const engine2 = new SimulationEngine(gs2, cb2);

      vi.spyOn(Math, 'random').mockReturnValue(0.99);

      for (let i = 0; i < 360; i++) engine2.tick();

      expect(cb2.onAdvisor).toHaveBeenCalledWith(expect.stringContaining('failed the 5-Year Plan'));
    });
  });

  // ── Callback integration ──────────────────────────────────

  describe('callback integration', () => {
    it('calls onStateChange every tick', () => {
      engine.tick();
      expect(cb.onStateChange).toHaveBeenCalledTimes(1);
    });

    it('calls onStateChange on every tick', () => {
      engine.tick();
      engine.tick();
      engine.tick();
      expect(cb.onStateChange).toHaveBeenCalledTimes(3);
    });
  });

  // ── Subsystem access ──────────────────────────────────────

  describe('subsystem access', () => {
    it('exposes the event system', () => {
      const evtSys = engine.getEventSystem();
      expect(evtSys).toBeDefined();
      expect(typeof evtSys.tick).toBe('function');
    });

    it('exposes the pravda system', () => {
      const pravda = engine.getPravdaSystem();
      expect(pravda).toBeDefined();
      expect(typeof pravda.generateAmbientHeadline).toBe('function');
    });

    it('exposes the chronology system', () => {
      const chrono = engine.getChronology();
      expect(chrono).toBeDefined();
      expect(typeof chrono.tick).toBe('function');
    });

    it('exposes the quota state', () => {
      const quota = engine.getQuota();
      expect(quota).toBeDefined();
      expect(quota.type).toBe('food');
      expect(quota.target).toBe(500);
    });
  });
});

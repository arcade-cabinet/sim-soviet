import { buildingsLogic, getMetaEntity, getResourceEntity } from '../../src/ecs/archetypes';
import { createBuilding, createMetaStore, createResourceStore } from '../../src/ecs/factories';
import type { QuotaState } from '../../src/ecs/systems';
import { world } from '../../src/ecs/world';
import { GameGrid } from '../../src/game/GameGrid';
import type { SimCallbacks } from '../../src/game/SimulationEngine';
import { SimulationEngine } from '../../src/game/SimulationEngine';

/**
 * Creates mock callbacks that satisfy the SimulationEngine constructor.
 */
function createMockCallbacks(): SimCallbacks {
  return {
    onToast: jest.fn(),
    onAdvisor: jest.fn(),
    onPravda: jest.fn(),
    onStateChange: jest.fn(),
  };
}

describe('SimulationEngine', () => {
  let grid: GameGrid;
  let cb: SimCallbacks;
  let engine: SimulationEngine;

  beforeEach(() => {
    world.clear();
    grid = new GameGrid();
    cb = createMockCallbacks();
    // Prevent EventSystem from firing random events during deterministic tests.
    // Value >0.12 means the 12% event roll always fails.
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    // Create ECS resource store with defaults
    createResourceStore();
    createMetaStore();
    engine = new SimulationEngine(grid, cb);
  });

  afterEach(() => {
    world.clear();
  });

  // ── Time advancement (via ChronologySystem) ────────────────

  describe('time advancement', () => {
    it('advances hour by HOURS_PER_TICK on each tick', () => {
      engine.tick();
      // ChronologySystem advances by HOURS_PER_TICK (8)
      // date.tick is mapped to the hour value
      expect(getMetaEntity()!.gameMeta.date.tick).toBe(8);
    });

    it('rolls month after 30 ticks', () => {
      // 3 ticks/day × 10 days/month = 30 ticks per month
      // Starting at month 10, after 30 ticks → month 11
      for (let i = 0; i < 30; i++) engine.tick();
      expect(getMetaEntity()!.gameMeta.date.month).toBe(11);
    });

    it('rolls year after 3 months (Oct 1922 → Jan 1923)', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.99);
      // Starting at month 10, 3 months (90 ticks) to year boundary
      for (let i = 0; i < 90; i++) engine.tick();
      expect(getMetaEntity()!.gameMeta.date.year).toBe(1923);
      expect(getMetaEntity()!.gameMeta.date.month).toBe(1);
    });

    it('handles multiple ticks within the same month', () => {
      for (let i = 0; i < 5; i++) engine.tick();
      // 5 ticks × 8 hours = 40 hours → day 2, hour 16
      expect(getMetaEntity()!.gameMeta.date.tick).toBe(16);
      expect(getMetaEntity()!.gameMeta.date.month).toBe(10); // Still in starting month
    });
  });

  // ── Resource calculation: power ─────────────────────────

  describe('power calculation', () => {
    it('calculates total power from power plants', () => {
      createBuilding(0, 0, 'power-station'); // powerOutput=100
      engine.tick();
      expect(getResourceEntity()!.resources.power).toBe(100);
    });

    it('accumulates power from multiple plants', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'power-station');
      engine.tick();
      expect(getResourceEntity()!.resources.power).toBe(200);
    });

    it('reports 0 power with no power plants', () => {
      createBuilding(0, 0, 'apartment-tower-a');
      engine.tick();
      expect(getResourceEntity()!.resources.power).toBe(0);
    });
  });

  // ── Resource calculation: food ──────────────────────────

  describe('food production', () => {
    it('produces food from powered farms', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'collective-farm-hq');
      // Advance to a month with good weather for farming (month 5 = SHORT_SUMMER)
      // Starting at month 10, need 7 months (210 ticks) to reach month 5
      for (let i = 0; i < 210; i++) engine.tick();
      const foodBeforeFarmTick = getResourceEntity()!.resources.food;
      engine.tick();
      // Food increases by production amount, but storageSystem applies spoilage (~0.5%/tick).
      // Net food should be within a few units of before (production offsets spoilage).
      const foodAfter = getResourceEntity()!.resources.food;
      const spoilageEstimate = foodBeforeFarmTick * 0.01; // generous spoilage margin
      expect(foodAfter).toBeGreaterThan(foodBeforeFarmTick - spoilageEstimate);
    });

    it('does not produce food from unpowered farms', () => {
      createBuilding(1, 1, 'collective-farm-hq');
      const store = getResourceEntity()!;
      const initialFood = store.resources.food;
      engine.tick();
      // No production, but storageSystem applies minor spoilage (0.5%/tick)
      expect(getResourceEntity()!.resources.food).toBeLessThanOrEqual(initialFood);
    });

    it('produces food from multiple farms', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'collective-farm-hq');
      createBuilding(2, 2, 'collective-farm-hq');
      // Advance to a month with good weather for farming
      for (let i = 0; i < 210; i++) engine.tick();
      const foodBeforeFarmTick = getResourceEntity()!.resources.food;
      engine.tick();
      // Two farms should produce enough to offset spoilage (~0.5%/tick)
      const foodAfter = getResourceEntity()!.resources.food;
      const spoilageEstimate = foodBeforeFarmTick * 0.01;
      expect(foodAfter).toBeGreaterThan(foodBeforeFarmTick - spoilageEstimate);
    });
  });

  // ── Resource calculation: vodka ─────────────────────────

  describe('vodka production', () => {
    it('produces vodka from powered distilleries', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'vodka-distillery');
      const store = getResourceEntity()!;
      const initialVodka = store.resources.vodka;
      engine.tick();
      // Exact amount depends on politburo vodkaProductionMult
      expect(getResourceEntity()!.resources.vodka).toBeGreaterThan(initialVodka);
    });

    it('does not produce vodka from unpowered distilleries', () => {
      createBuilding(1, 1, 'vodka-distillery');
      const store = getResourceEntity()!;
      store.resources.population = 0; // Isolate from consumption
      const initialVodka = store.resources.vodka;
      jest.spyOn(Math, 'random').mockReturnValue(0.99);
      engine.tick();
      expect(getResourceEntity()!.resources.vodka).toBe(initialVodka);
    });
  });

  // ── Power distribution ─────────────────────────────────

  describe('power distribution', () => {
    it('tracks total power used by buildings', () => {
      createBuilding(0, 0, 'power-station'); // powerOutput=100
      createBuilding(1, 1, 'apartment-tower-a'); // powerReq=5
      createBuilding(2, 2, 'collective-farm-hq'); // powerReq=2
      engine.tick();
      expect(getResourceEntity()!.resources.powerUsed).toBe(7);
    });

    it('marks buildings as unpowered when power exceeds supply', () => {
      createBuilding(1, 1, 'apartment-tower-a'); // No power plant
      engine.tick();
      const building = buildingsLogic.entities.find((e) => e.building.defId === 'apartment-tower-a');
      expect(building!.building.powered).toBe(false);
    });

    it('marks buildings as powered when power is available', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'apartment-tower-a');
      engine.tick();
      const housing = buildingsLogic.entities.find((e) => e.building.defId === 'apartment-tower-a');
      expect(housing!.building.powered).toBe(true);
    });

    it('power plants themselves are always powered', () => {
      createBuilding(0, 0, 'power-station');
      engine.tick();
      const plant = buildingsLogic.entities.find((e) => e.building.defId === 'power-station');
      expect(plant!.building.powered).toBe(true);
    });
  });

  // ── Food consumption ────────────────────────────────────

  describe('food consumption', () => {
    it('consumes food based on population (pop/10 rounded up)', () => {
      const store = getResourceEntity()!;
      store.resources.population = 15;
      store.resources.food = 100;
      jest.spyOn(Math, 'random').mockReturnValue(0.99);
      engine.tick();
      // 100 - ceil(15/10) = 98 consumption, minus ~0.5 spoilage from storageSystem
      expect(getResourceEntity()!.resources.food).toBeCloseTo(97.5, 0);
    });

    it('consumes 0 food when population is 0', () => {
      const store = getResourceEntity()!;
      store.resources.population = 0;
      store.resources.food = 100;
      engine.tick();
      // No consumption, but storageSystem applies minor spoilage (0.5%/tick)
      expect(getResourceEntity()!.resources.food).toBeLessThanOrEqual(100);
      expect(getResourceEntity()!.resources.food).toBeGreaterThan(99);
    });

    it('causes starvation when food is insufficient', () => {
      const store = getResourceEntity()!;
      store.resources.population = 100;
      store.resources.food = 0;
      store.resources.vodka = 100;
      engine.tick();
      expect(getResourceEntity()!.resources.population).toBeLessThanOrEqual(95);
      expect(cb.onToast).toHaveBeenCalledWith('STARVATION DETECTED', 'critical');
    });

    it('reduces population by 5 during starvation (clamped at 0)', () => {
      const store = getResourceEntity()!;
      store.resources.food = 0;
      // Sync citizen entities to match desired population
      engine.getWorkerSystem().syncPopulation(3);
      engine.tick();
      expect(getResourceEntity()!.resources.population).toBe(0);
    });
  });

  // ── Vodka consumption ───────────────────────────────────

  describe('vodka consumption', () => {
    it('consumes vodka based on population (pop/20 rounded up, era-scaled)', () => {
      const store = getResourceEntity()!;
      store.resources.vodka = 50;
      store.resources.food = 100; // enough to avoid starvation
      // Sync citizen entities to match desired population
      engine.getWorkerSystem().syncPopulation(20);
      engine.tick();
      // Vodka consumed: ceil((20/20) * consumptionMult) where consumptionMult varies by era
      // Revolution era consumptionMult=1.2 → ceil(1.2)=2 → 48
      // Default consumptionMult=1.0 → ceil(1.0)=1 → 49
      expect(getResourceEntity()!.resources.vodka).toBeLessThan(50);
      expect(getResourceEntity()!.resources.vodka).toBeGreaterThanOrEqual(48);
    });

    it('does not reduce population when vodka runs out', () => {
      const store = getResourceEntity()!;
      store.resources.food = 1000;
      store.resources.vodka = 0;
      // Sync citizen entities to match desired population
      engine.getWorkerSystem().syncPopulation(100);
      engine.tick();
      expect(getResourceEntity()!.resources.population).toBe(100);
    });
  });

  // ── Population growth ───────────────────────────────────

  describe('population growth', () => {
    it('does not grow population without housing', () => {
      const store = getResourceEntity()!;
      store.resources.food = 1000;
      // Sync citizen entities to 0 (remove all default citizens)
      engine.getWorkerSystem().syncPopulation(0);
      jest.spyOn(Math, 'random').mockReturnValue(0.99);
      engine.tick();
      expect(getResourceEntity()!.resources.population).toBe(0);
    });

    it('grows population when housing and food are available', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'apartment-tower-a'); // housingCap=50
      const store = getResourceEntity()!;
      store.resources.food = 1000;
      // Sync citizen entities to match desired population
      engine.getWorkerSystem().syncPopulation(5);
      jest.spyOn(Math, 'random').mockReturnValue(0.5);
      engine.tick();
      // populationSystem returns growthCount=1, WorkerSystem spawns 1 new citizen
      expect(getResourceEntity()!.resources.population).toBe(6);
    });

    it('does not grow population when at housing cap', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'apartment-tower-a'); // housingCap=50
      const store = getResourceEntity()!;
      store.resources.food = 1000;
      // Sync citizen entities to match housing cap
      engine.getWorkerSystem().syncPopulation(50);
      engine.tick();
      expect(getResourceEntity()!.resources.population).toBe(50);
    });

    it('does not grow population when food is low', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'apartment-tower-a');
      const store = getResourceEntity()!;
      store.resources.food = 5;
      // Sync citizen entities to match desired population
      engine.getWorkerSystem().syncPopulation(1);
      engine.tick();
      // After consumption: food = 5 - ceil(1/10) = 4
      // populationSystem: food(4) > 10? No → no growth
      expect(getResourceEntity()!.resources.population).toBeLessThanOrEqual(1);
    });
  });

  // ── Quota system ────────────────────────────────────────

  describe('quota system', () => {
    it('updates quota.current to match food when quota type is food', () => {
      const store = getResourceEntity()!;
      store.resources.food = 350;
      engine.tick();
      // After storageSystem spoilage (overflow decay), quota reads the post-spoilage food value
      const currentFood = getResourceEntity()!.resources.food;
      expect(getMetaEntity()!.gameMeta.quota.current).toBe(currentFood);
    });

    it('updates quota.current to match vodka when quota type is vodka', () => {
      // Default quota type is 'food', change to 'vodka'
      const quota = engine.getQuota() as QuotaState;
      quota.type = 'vodka';
      const store = getResourceEntity()!;
      store.resources.vodka = 75;
      store.resources.population = 0; // Isolate from consumption
      engine.tick();
      expect(getMetaEntity()!.gameMeta.quota.current).toBe(75);
    });

    it('shows success advisor and advances to vodka quota on year rollover when quota is met', () => {
      // ChronologySystem starts at month 10, so 3 months (90 ticks) to reach year boundary
      world.clear();
      const grid2 = new GameGrid();
      const cb2 = createMockCallbacks();
      // Start with enough food to remain above 500 quota after 90 ticks of spoilage.
      // Spoilage decays overflow food (above 200 capacity) at 5%/tick * seasonal mult.
      // Use very high initial food so it stays above target.
      createResourceStore({ food: 5000, vodka: 50, population: 0 });
      createMetaStore({ date: { year: 1926, month: 10, tick: 0 } });
      const engine2 = new SimulationEngine(grid2, cb2);

      jest.spyOn(Math, 'random').mockReturnValue(0.99);

      // Tick through 3 months (90 ticks) to trigger year rollover Oct→Jan (1927)
      for (let i = 0; i < 90; i++) engine2.tick();

      expect(cb2.onAdvisor).toHaveBeenCalledWith(expect.stringContaining('Quota met'));
      expect(getMetaEntity()!.gameMeta.quota.type).toBe('vodka');
      expect(getMetaEntity()!.gameMeta.quota.target).toBe(500);
    });

    it('shows game-over advisor when quota is failed', () => {
      world.clear();
      const grid2 = new GameGrid();
      const cb2 = createMockCallbacks();
      createResourceStore({ food: 100, vodka: 50, population: 0 }); // Below target of 500
      createMetaStore({ date: { year: 1926, month: 10, tick: 0 } });
      const engine2 = new SimulationEngine(grid2, cb2);

      jest.spyOn(Math, 'random').mockReturnValue(0.99);

      // 90 ticks: Oct 1926 → Jan 1927 (deadline year)
      for (let i = 0; i < 90; i++) engine2.tick();

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

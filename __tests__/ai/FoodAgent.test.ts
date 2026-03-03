import type { FoodAgentSaveData } from '../../src/ai/agents/economy/FoodAgent';
import { FoodAgent } from '../../src/ai/agents/economy/FoodAgent';
import { getResourceEntity } from '../../src/ecs/archetypes';
import { createBuilding, createResourceStore } from '../../src/ecs/factories';
import { createDvor } from '../../src/ecs/factories/settlementFactories';
import { powerSystem } from '../../src/ecs/systems/powerSystem';
import { world } from '../../src/ecs/world';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a dvor with one working-age adult (age 30, male). */
function addDvor(plotSize = 0.25): void {
  const entity = createDvor('test-dvor', 'TestFamily', [{ name: 'Ivan', gender: 'male', age: 30 }]);
  // Patch the dvor's private plot size for tests that care about it
  (entity as any).dvor.privatePlotSize = plotSize;
  (entity as any).dvor.privateLivestock = { cow: 0, pig: 0, sheep: 0, poultry: 0 };
}

/** Run `n` update calls with 0 food to starve the population. */
function starve(agent: FoodAgent, n: number, pop: number): void {
  const store = getResourceEntity()!;
  for (let i = 0; i < n; i++) {
    store.resources.food = 0;
    store.resources.population = pop;
    agent.update(1);
  }
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('FoodAgent', () => {
  let agent: FoodAgent;

  beforeEach(() => {
    world.clear();
    createResourceStore({ food: 1000, vodka: 500, population: 0 });
    agent = new FoodAgent();
  });

  afterEach(() => {
    world.clear();
  });

  // ── Instantiation ────────────────────────────────────────────────────────

  it('can be instantiated with name FoodAgent', () => {
    expect(agent.name).toBe('FoodAgent');
  });

  // ── Food consumption calculation ─────────────────────────────────────────

  describe('food consumption calculation', () => {
    it('calculateFoodNeed returns ceil(pop/25) for default multiplier', () => {
      expect(agent.calculateFoodNeed(100)).toBe(4); // ceil(100/25)
      expect(agent.calculateFoodNeed(101)).toBe(5); // ceil(101/25)
      expect(agent.calculateFoodNeed(1)).toBe(1);
      expect(agent.calculateFoodNeed(10)).toBe(1);
    });

    it('calculateFoodNeed scales with consumptionMult', () => {
      expect(agent.calculateFoodNeed(100, 2)).toBe(8); // ceil(100/25*2)
      expect(agent.calculateFoodNeed(100, 0.5)).toBe(2); // ceil(100/25*0.5)
    });

    it('consumes ceil(pop/25) food per tick', () => {
      const store = getResourceEntity()!;
      store.resources.population = 100;
      store.resources.food = 500;
      agent.update(1);
      expect(store.resources.food).toBe(496); // 500 - ceil(100/25)
    });

    it('consumes correct food for population of 11', () => {
      const store = getResourceEntity()!;
      store.resources.population = 11;
      store.resources.food = 100;
      agent.update(1);
      // ceil(11/25) = 1
      expect(store.resources.food).toBe(99);
    });

    it('consumptionMult doubles food need', () => {
      const store = getResourceEntity()!;
      store.resources.population = 100;
      store.resources.food = 500;
      agent.update(1, { consumptionMult: 2 });
      // ceil(100/25 * 2) = 8
      expect(store.resources.food).toBe(492);
    });

    it('consumes nothing when population is 0', () => {
      const store = getResourceEntity()!;
      store.resources.population = 0;
      store.resources.food = 500;
      agent.update(1);
      expect(store.resources.food).toBe(500);
    });
  });

  // ── Starvation counter ───────────────────────────────────────────────────

  describe('starvation counter', () => {
    it('starts at 0', () => {
      expect(agent.getStarvationCounter()).toBe(0);
    });

    it('increments when food is insufficient', () => {
      const store = getResourceEntity()!;
      store.resources.food = 0;
      store.resources.population = 100;
      agent.update(1);
      expect(agent.getStarvationCounter()).toBe(1);
    });

    it('resets to 0 when food is sufficient', () => {
      const store = getResourceEntity()!;
      store.resources.population = 100;

      // Starve for 5 ticks
      starve(agent, 5, 100);
      expect(agent.getStarvationCounter()).toBe(5);

      // Feed — counter resets
      store.resources.food = 1000;
      agent.update(1);
      expect(agent.getStarvationCounter()).toBe(0);
    });

    it('does not return starvation deaths during grace period (90 ticks)', () => {
      const store = getResourceEntity()!;
      store.resources.population = 100;
      store.resources.food = 0;
      const result = agent.update(1);
      // Tick 1 — within grace period
      expect(result.starvationDeaths).toBe(0);
    });

    it('returns starvation deaths after grace period expires (>180 ticks)', () => {
      const store = getResourceEntity()!;
      store.resources.population = 100;

      // Exhaust grace period (180 ticks)
      starve(agent, 180, 100);
      expect(agent.getStarvationCounter()).toBe(180);

      // Tick 181 — should cause deaths
      store.resources.food = 0;
      store.resources.population = 100;
      const result = agent.update(1);
      expect(result.starvationDeaths).toBe(2);
    });

    it('clamps starvation deaths at population size when pop < 2', () => {
      const store = getResourceEntity()!;
      store.resources.population = 1;
      starve(agent, 181, 1);
      const result = agent.update(1);
      expect(result.starvationDeaths).toBe(1);
    });

    it('grace period resets after food restored mid-starvation', () => {
      const store = getResourceEntity()!;
      store.resources.population = 100;

      // Starve for 50 ticks (within grace)
      starve(agent, 50, 100);

      // Feed — resets counter
      store.resources.food = 1000;
      store.resources.population = 100;
      agent.update(1);
      expect(agent.getStarvationCounter()).toBe(0);

      // Starve again — grace restarted (no deaths in next tick)
      store.resources.food = 0;
      const result = agent.update(1);
      expect(result.starvationDeaths).toBe(0);
    });

    it('getTicksUntilStarvation returns full grace at start', () => {
      expect(agent.getTicksUntilStarvation()).toBe(180);
    });

    it('getTicksUntilStarvation decreases as starvation counter rises', () => {
      const store = getResourceEntity()!;
      store.resources.population = 100;
      starve(agent, 10, 100);
      expect(agent.getTicksUntilStarvation()).toBe(170);
    });

    it('getTicksUntilStarvation returns 0 once deaths begin', () => {
      const store = getResourceEntity()!;
      store.resources.population = 100;
      starve(agent, 181, 100);
      expect(agent.getTicksUntilStarvation()).toBe(0);
    });
  });

  // ── Food state machine ───────────────────────────────────────────────────

  describe('food state machine', () => {
    it('starts in stable state', () => {
      expect(agent.getFoodState()).toBe('stable');
    });

    it('transitions to surplus when food >= 2x need', () => {
      const store = getResourceEntity()!;
      store.resources.population = 10;
      // need = 1, surplus threshold = 2; store has 1000 >> 2
      agent.update(1);
      expect(agent.getFoodState()).toBe('surplus');
    });

    it('transitions to rationing when food is zero for first tick', () => {
      const store = getResourceEntity()!;
      store.resources.population = 100;
      store.resources.food = 0;
      agent.update(1);
      expect(agent.getFoodState()).toBe('rationing');
    });

    it('transitions to starvation after grace period', () => {
      const store = getResourceEntity()!;
      store.resources.population = 100;
      starve(agent, 181, 100);
      expect(agent.getFoodState()).toBe('starvation');
    });

    it('returns to stable from rationing when food restored', () => {
      const store = getResourceEntity()!;
      store.resources.population = 100;
      // One tick of rationing
      store.resources.food = 0;
      agent.update(1);
      expect(agent.getFoodState()).toBe('rationing');

      // Restore food: enough but not 2x surplus
      store.resources.food = 10; // exactly the need for pop=100
      agent.update(1);
      expect(agent.getFoodState()).toBe('stable');
    });
  });

  // ── Telegram emission decisions ──────────────────────────────────────────

  describe('telegram emission decisions', () => {
    it('shouldEmitFoodShortage is false in stable state', () => {
      expect(agent.shouldEmitFoodShortage()).toBe(false);
    });

    it('shouldEmitFoodShortage is true in rationing state', () => {
      const store = getResourceEntity()!;
      store.resources.population = 100;
      store.resources.food = 0;
      agent.update(1);
      expect(agent.shouldEmitFoodShortage()).toBe(true);
    });

    it('shouldEmitFoodShortage is true in starvation state', () => {
      const store = getResourceEntity()!;
      store.resources.population = 100;
      starve(agent, 181, 100);
      expect(agent.shouldEmitFoodShortage()).toBe(true);
    });

    it('shouldEmitStarvationWarning is false before grace expires', () => {
      const store = getResourceEntity()!;
      store.resources.population = 100;
      starve(agent, 5, 100);
      expect(agent.shouldEmitStarvationWarning()).toBe(false);
    });

    it('shouldEmitStarvationWarning is true after grace expires', () => {
      const store = getResourceEntity()!;
      store.resources.population = 100;
      starve(agent, 181, 100);
      expect(agent.shouldEmitStarvationWarning()).toBe(true);
    });

    it('shouldEmitFoodSurplus is true in surplus state', () => {
      const store = getResourceEntity()!;
      store.resources.population = 10;
      // food=1000 >> 2*ceil(10/10)=2 → surplus
      agent.update(1);
      expect(agent.shouldEmitFoodSurplus()).toBe(true);
    });

    it('shouldEmitFoodSurplus is false in stable state', () => {
      const store = getResourceEntity()!;
      store.resources.population = 100;
      store.resources.food = 5; // need=4, threshold=8; 5<8 → stable not surplus
      agent.update(1);
      expect(agent.shouldEmitFoodSurplus()).toBe(false);
    });

    it('MSG constants are accessible', () => {
      expect(FoodAgent.MSG.FOOD_SHORTAGE).toBe('FOOD_SHORTAGE');
      expect(FoodAgent.MSG.STARVATION_WARNING).toBe('STARVATION_WARNING');
      expect(FoodAgent.MSG.FOOD_SURPLUS).toBe('FOOD_SURPLUS');
    });
  });

  // ── Private plot production ──────────────────────────────────────────────

  describe('private plot production by era', () => {
    beforeEach(() => {
      world.clear();
      createResourceStore({ food: 0, vodka: 0, population: 0 });
      agent = new FoodAgent();
    });

    it('calculatePrivatePlotProduction returns 0 with no dvory', () => {
      expect(agent.calculatePrivatePlotProduction('revolution')).toBe(0);
    });

    it('calculatePrivatePlotProduction returns 0 for great_patriotic era', () => {
      addDvor(0.5);
      expect(agent.calculatePrivatePlotProduction('great_patriotic')).toBe(0);
    });

    it('calculatePrivatePlotProduction returns positive for revolution era', () => {
      addDvor(0.25);
      const output = agent.calculatePrivatePlotProduction('revolution');
      // 0.25 * 200 / 12 ≈ 4.17
      expect(output).toBeGreaterThan(0);
      expect(output).toBeCloseTo((0.25 * 200) / 12, 2);
    });

    it('calculatePrivatePlotProduction is higher in thaw_and_freeze era (1.5x)', () => {
      addDvor(0.25);
      const revolution = agent.calculatePrivatePlotProduction('revolution');
      const thaw = agent.calculatePrivatePlotProduction('thaw_and_freeze');
      expect(thaw).toBeCloseTo(revolution * 1.5, 4);
    });

    it('calculatePrivatePlotProduction is lower in stagnation era (0.8x)', () => {
      addDvor(0.25);
      const revolution = agent.calculatePrivatePlotProduction('revolution');
      const stagnation = agent.calculatePrivatePlotProduction('stagnation');
      expect(stagnation).toBeCloseTo(revolution * 0.8, 4);
    });

    it('update() adds private plot food to store', () => {
      addDvor(0.25);
      const store = getResourceEntity()!;
      store.resources.food = 0;
      store.resources.population = 0;
      agent.update(1, { eraId: 'revolution' });
      // Plot food should have been added
      const expected = (0.25 * 200) / 12;
      expect(store.resources.food).toBeCloseTo(expected, 1);
    });

    it('dvor without working-age member does not produce food', () => {
      // Create a dvor with only a retired member (age 65 male → retired)
      const entity = createDvor('old-dvor', 'OldFamily', [{ name: 'Dedo', gender: 'male', age: 65 }]);
      (entity as any).dvor.privatePlotSize = 0.5;
      (entity as any).dvor.privateLivestock = { cow: 0, pig: 0, sheep: 0, poultry: 0 };

      const output = agent.calculatePrivatePlotProduction('revolution');
      expect(output).toBe(0);
    });
  });

  // ── Farm production via update() ─────────────────────────────────────────

  describe('farm production via update()', () => {
    beforeEach(() => {
      world.clear();
      createResourceStore({ food: 0, vodka: 0, population: 0 });
      agent = new FoodAgent();
    });

    it('powered farm produces food', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'collective-farm-hq');
      powerSystem();
      agent.update(1);
      const store = getResourceEntity()!;
      expect(store.resources.food).toBe(20);
    });

    it('unpowered farm produces no food', () => {
      createBuilding(1, 1, 'collective-farm-hq');
      powerSystem();
      agent.update(1);
      const store = getResourceEntity()!;
      expect(store.resources.food).toBe(0);
    });

    it('farmModifier doubles food production', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'collective-farm-hq');
      powerSystem();
      agent.update(1, { farmModifier: 2.0 });
      const store = getResourceEntity()!;
      expect(store.resources.food).toBe(40);
    });

    it('farmModifier=0 yields no farm output', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'collective-farm-hq');
      powerSystem();
      agent.update(1, { farmModifier: 0 });
      const store = getResourceEntity()!;
      expect(store.resources.food).toBe(0);
    });

    it('vodka distillery grain diversion: consumes 1 food per vodka produced', () => {
      const store = getResourceEntity()!;
      store.resources.food = 1000;
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'vodka-distillery');
      powerSystem();
      agent.update(1);
      expect(store.resources.vodka).toBe(10);
      expect(store.resources.food).toBe(990);
    });

    it('vodka production limited by available grain', () => {
      const store = getResourceEntity()!;
      store.resources.food = 10; // 10 vodka worth (1:1 ratio)
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'vodka-distillery');
      powerSystem();
      agent.update(1);
      expect(store.resources.vodka).toBe(10);
      expect(store.resources.food).toBe(0);
    });
  });

  // ── Serialization round-trip ─────────────────────────────────────────────

  describe('serialization round-trip', () => {
    it('toJSON captures starvation counter and food state', () => {
      const store = getResourceEntity()!;
      store.resources.population = 100;
      starve(agent, 10, 100);

      const saved: FoodAgentSaveData = agent.toJSON();
      expect(saved.starvationCounter).toBe(10);
      expect(saved.foodState).toBe('rationing');
    });

    it('fromJSON restores starvation counter and food state', () => {
      const store = getResourceEntity()!;
      store.resources.population = 100;
      starve(agent, 10, 100);

      const saved = agent.toJSON();
      const agent2 = new FoodAgent();
      agent2.fromJSON(saved);

      expect(agent2.getStarvationCounter()).toBe(saved.starvationCounter);
      expect(agent2.getFoodState()).toBe(saved.foodState);
    });

    it('fromJSON with starvation state preserves warning emission', () => {
      const store = getResourceEntity()!;
      store.resources.population = 100;
      starve(agent, 181, 100);

      const saved = agent.toJSON();
      const agent2 = new FoodAgent();
      agent2.fromJSON(saved);

      expect(agent2.shouldEmitStarvationWarning()).toBe(true);
      expect(agent2.shouldEmitFoodShortage()).toBe(true);
    });

    it('reset() clears counter and state', () => {
      const store = getResourceEntity()!;
      store.resources.population = 100;
      starve(agent, 10, 100);
      expect(agent.getStarvationCounter()).toBe(10);

      agent.reset();
      expect(agent.getStarvationCounter()).toBe(0);
      expect(agent.getFoodState()).toBe('stable');
    });
  });
});

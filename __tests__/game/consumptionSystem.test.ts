import { getResourceEntity } from '../../src/ecs/archetypes';
import { createResourceStore } from '../../src/ecs/factories';
import {
  consumptionSystem,
  resetStarvationCounter,
  setStarvationCallback,
} from '../../src/ecs/systems/consumptionSystem';
import { world } from '../../src/ecs/world';
import { createTestDvory } from '../playthrough/helpers';

describe('consumptionSystem', () => {
  beforeEach(() => {
    world.clear();
    createResourceStore({ food: 1000, vodka: 500, population: 0 });
    createTestDvory(100);
    setStarvationCallback(undefined); // Clear any previous callback
    resetStarvationCounter(); // Reset grace period counter
  });

  afterEach(() => {
    setStarvationCallback(undefined);
    resetStarvationCounter();
    world.clear();
  });

  // ── Food consumption ──────────────────────────────────────

  describe('food consumption', () => {
    it('consumes ceil(pop/10) food per tick', () => {
      const store = getResourceEntity()!;
      store.resources.population = 100;
      store.resources.food = 500;
      consumptionSystem();
      // ceil(100/10) = 10
      expect(store.resources.food).toBe(490);
    });

    it('consumes 1 food for population of 1', () => {
      const store = getResourceEntity()!;
      store.resources.population = 1;
      store.resources.food = 100;
      consumptionSystem();
      // ceil(1/10) = 1
      expect(store.resources.food).toBe(99);
    });

    it('consumes 1 food for population of 10', () => {
      const store = getResourceEntity()!;
      store.resources.population = 10;
      store.resources.food = 100;
      consumptionSystem();
      // ceil(10/10) = 1
      expect(store.resources.food).toBe(99);
    });

    it('consumes 2 food for population of 11', () => {
      const store = getResourceEntity()!;
      store.resources.population = 11;
      store.resources.food = 100;
      consumptionSystem();
      // ceil(11/10) = 2
      expect(store.resources.food).toBe(98);
    });

    it('consumes 2 food for population of 15', () => {
      const store = getResourceEntity()!;
      store.resources.population = 15;
      store.resources.food = 100;
      consumptionSystem();
      // ceil(15/10) = 2
      expect(store.resources.food).toBe(98);
    });
  });

  // ── Starvation ────────────────────────────────────────────

  describe('starvation', () => {
    /** Run starvation ticks to exhaust the grace period (90 ticks). */
    function exhaustGracePeriod(store: ReturnType<typeof getResourceEntity>) {
      for (let i = 0; i < 90; i++) {
        consumptionSystem();
      }
    }

    it('does NOT return starvation deaths during grace period', () => {
      const store = getResourceEntity()!;
      store.resources.population = 100;
      store.resources.food = 0;
      const result = consumptionSystem();
      // Within grace period — no deaths yet
      expect(result.starvationDeaths).toBe(0);
    });

    it('returns 5 starvation deaths after grace period expires', () => {
      const store = getResourceEntity()!;
      store.resources.population = 100;
      store.resources.food = 0;
      exhaustGracePeriod(store);
      // Grace period exhausted — next tick should cause deaths
      const result = consumptionSystem();
      expect(result.starvationDeaths).toBe(5);
      // Population is NOT modified — caller (SimulationEngine) routes through WorkerSystem
      expect(store.resources.population).toBe(100);
    });

    it('sets food to 0 during starvation (consumes whatever is available)', () => {
      const store = getResourceEntity()!;
      store.resources.population = 100;
      store.resources.food = 5; // need ceil(100/10)=10, have only 5
      consumptionSystem();
      // Food is consumed (set to 0) even during starvation
      expect(store.resources.food).toBe(0);
    });

    it('clamps starvation deaths at population size when pop < 5', () => {
      const store = getResourceEntity()!;
      store.resources.population = 3;
      store.resources.food = 0;
      exhaustGracePeriod(store);
      const result = consumptionSystem();
      expect(result.starvationDeaths).toBe(3);
    });

    it('returns 1 starvation death when pop is 1 after grace period', () => {
      const store = getResourceEntity()!;
      store.resources.population = 1;
      store.resources.food = 0;
      exhaustGracePeriod(store);
      const result = consumptionSystem();
      expect(result.starvationDeaths).toBe(1);
    });

    it('fires starvation callback on each tick with insufficient food', () => {
      const cb = jest.fn();
      setStarvationCallback(cb);

      const store = getResourceEntity()!;
      store.resources.population = 50;
      store.resources.food = 0;
      consumptionSystem();

      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('does not fire starvation callback when food is sufficient', () => {
      const cb = jest.fn();
      setStarvationCallback(cb);

      const store = getResourceEntity()!;
      store.resources.population = 50;
      store.resources.food = 1000;
      consumptionSystem();

      expect(cb).not.toHaveBeenCalled();
    });

    it('resets grace period when food becomes available', () => {
      const store = getResourceEntity()!;
      store.resources.population = 100;
      store.resources.food = 0;

      // Starve for 25 ticks (within grace period)
      for (let i = 0; i < 25; i++) {
        consumptionSystem();
      }

      // Feed the population — resets counter
      store.resources.food = 1000;
      consumptionSystem();

      // Starve again — grace period restarted
      store.resources.food = 0;
      const result = consumptionSystem();
      expect(result.starvationDeaths).toBe(0);
    });
  });

  // ── Vodka consumption ─────────────────────────────────────

  describe('vodka consumption', () => {
    it('consumes ceil(pop/20) vodka per tick', () => {
      const store = getResourceEntity()!;
      store.resources.population = 100;
      store.resources.vodka = 500;
      consumptionSystem();
      // ceil(100/20) = 5
      expect(store.resources.vodka).toBe(495);
    });

    it('consumes 1 vodka for population of 1', () => {
      const store = getResourceEntity()!;
      store.resources.population = 1;
      store.resources.vodka = 50;
      consumptionSystem();
      // ceil(1/20) = 1
      expect(store.resources.vodka).toBe(49);
    });

    it('consumes 1 vodka for population of 20', () => {
      const store = getResourceEntity()!;
      store.resources.population = 20;
      store.resources.vodka = 50;
      consumptionSystem();
      // ceil(20/20) = 1
      expect(store.resources.vodka).toBe(49);
    });

    it('consumes 2 vodka for population of 21', () => {
      const store = getResourceEntity()!;
      store.resources.population = 21;
      store.resources.vodka = 50;
      consumptionSystem();
      // ceil(21/20) = 2
      expect(store.resources.vodka).toBe(48);
    });

    it('does not consume vodka if not enough available', () => {
      const store = getResourceEntity()!;
      store.resources.population = 100;
      store.resources.vodka = 0;
      consumptionSystem();
      // Vodka stays at 0, no penalty
      expect(store.resources.vodka).toBe(0);
    });

    it('vodka shortage does not cause starvation deaths', () => {
      const store = getResourceEntity()!;
      store.resources.population = 100;
      store.resources.food = 1000;
      store.resources.vodka = 0;
      const result = consumptionSystem();
      expect(result.starvationDeaths).toBe(0);
      expect(store.resources.population).toBe(100);
    });

    it('vodka shortage with insufficient supply does not go negative', () => {
      const store = getResourceEntity()!;
      store.resources.population = 100;
      store.resources.vodka = 2; // need 5, have 2
      consumptionSystem();
      // Not enough vodka → skip consumption, vodka stays at 2
      expect(store.resources.vodka).toBe(2);
    });
  });

  // ── Zero population ───────────────────────────────────────

  describe('zero population', () => {
    it('consumes nothing when population is 0', () => {
      const store = getResourceEntity()!;
      store.resources.population = 0;
      store.resources.food = 100;
      store.resources.vodka = 50;
      consumptionSystem();
      expect(store.resources.food).toBe(100);
      expect(store.resources.vodka).toBe(50);
      expect(store.resources.population).toBe(0);
    });
  });

  // ── Both resources consumed in one tick ────────────────────

  describe('both food and vodka consumed together', () => {
    it('consumes both food and vodka in a single tick', () => {
      const store = getResourceEntity()!;
      store.resources.population = 40;
      store.resources.food = 100;
      store.resources.vodka = 50;
      consumptionSystem();
      // food: 100 - ceil(40/10) = 100 - 4 = 96
      // vodka: 50 - ceil(40/20) = 50 - 2 = 48
      expect(store.resources.food).toBe(96);
      expect(store.resources.vodka).toBe(48);
    });
  });

  // ── Edge: no resource store ───────────────────────────────

  describe('edge: no resource store', () => {
    it('does not throw when resource store is missing', () => {
      world.clear();
      expect(() => consumptionSystem()).not.toThrow();
    });
  });

  // ── Consumption does not go below 0 ───────────────────────

  describe('consumption does not produce negative resources', () => {
    it('food consumption when food exactly meets need', () => {
      const store = getResourceEntity()!;
      store.resources.population = 10;
      store.resources.food = 1; // ceil(10/10) = 1
      consumptionSystem();
      expect(store.resources.food).toBe(0);
    });

    it('vodka consumption when vodka exactly meets need', () => {
      const store = getResourceEntity()!;
      store.resources.population = 20;
      store.resources.food = 1000;
      store.resources.vodka = 1; // ceil(20/20) = 1
      consumptionSystem();
      expect(store.resources.vodka).toBe(0);
    });
  });
});

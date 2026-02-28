import { getResourceEntity } from '../../src/ecs/archetypes';
import { createBuilding, createResourceStore } from '../../src/ecs/factories';
import { powerSystem } from '../../src/ecs/systems/powerSystem';
import { productionSystem } from '../../src/ecs/systems/productionSystem';
import { world } from '../../src/ecs/world';

describe('productionSystem', () => {
  beforeEach(() => {
    world.clear();
    createResourceStore({ food: 0, vodka: 0 });
  });

  afterEach(() => {
    world.clear();
  });

  // ── Farm production ───────────────────────────────────────

  describe('farm food production', () => {
    it('a powered farm produces 20 food per tick', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'collective-farm-hq');
      powerSystem();
      productionSystem();
      const store = getResourceEntity()!;
      expect(store.resources.food).toBe(20);
    });

    it('an unpowered farm produces 0 food', () => {
      createBuilding(1, 1, 'collective-farm-hq'); // no power plant
      powerSystem();
      productionSystem();
      const store = getResourceEntity()!;
      expect(store.resources.food).toBe(0);
    });

    it('two powered farms produce 40 food per tick', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'collective-farm-hq');
      createBuilding(2, 2, 'collective-farm-hq');
      powerSystem();
      productionSystem();
      const store = getResourceEntity()!;
      expect(store.resources.food).toBe(40);
    });

    it('three powered farms produce 60 food per tick', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'collective-farm-hq');
      createBuilding(2, 2, 'collective-farm-hq');
      createBuilding(3, 3, 'collective-farm-hq');
      powerSystem();
      productionSystem();
      const store = getResourceEntity()!;
      expect(store.resources.food).toBe(60);
    });

    it('food accumulates over multiple ticks', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'collective-farm-hq');
      powerSystem();
      productionSystem();
      productionSystem();
      productionSystem();
      const store = getResourceEntity()!;
      expect(store.resources.food).toBe(60);
    });
  });

  // ── Distillery production ─────────────────────────────────
  // FIX-05: Vodka now requires 2 grain (food) per 1 vodka produced.
  // Tests pre-seed food to cover grain costs.

  describe('distillery vodka production', () => {
    it('a powered distillery produces 10 vodka per tick (with grain)', () => {
      const store = getResourceEntity()!;
      store.resources.food = 1000; // sufficient grain
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'vodka-distillery');
      powerSystem();
      productionSystem();
      expect(store.resources.vodka).toBe(10);
      expect(store.resources.food).toBe(980); // 1000 - 10*2
    });

    it('an unpowered distillery produces 0 vodka', () => {
      createBuilding(1, 1, 'vodka-distillery');
      powerSystem();
      productionSystem();
      const store = getResourceEntity()!;
      expect(store.resources.vodka).toBe(0);
    });

    it('two powered distilleries produce 20 vodka per tick (with grain)', () => {
      const store = getResourceEntity()!;
      store.resources.food = 1000;
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'vodka-distillery');
      createBuilding(2, 2, 'vodka-distillery');
      powerSystem();
      productionSystem();
      expect(store.resources.vodka).toBe(20);
      expect(store.resources.food).toBe(960); // 1000 - 20*2
    });

    it('vodka accumulates over multiple ticks (with grain)', () => {
      const store = getResourceEntity()!;
      store.resources.food = 1000;
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'vodka-distillery');
      powerSystem();
      productionSystem();
      productionSystem();
      expect(store.resources.vodka).toBe(20);
      expect(store.resources.food).toBe(960); // 1000 - 2*10*2
    });

    it('vodka production is limited by available grain', () => {
      const store = getResourceEntity()!;
      store.resources.food = 10; // only enough for 5 vodka
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'vodka-distillery');
      powerSystem();
      productionSystem();
      expect(store.resources.vodka).toBe(5); // 10 food / 2 = 5 vodka
      expect(store.resources.food).toBe(0);
    });

    it('no vodka produced when no grain available', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'vodka-distillery');
      powerSystem();
      productionSystem();
      const store = getResourceEntity()!;
      expect(store.resources.vodka).toBe(0);
      expect(store.resources.food).toBe(0);
    });
  });

  // ── Production requires power ─────────────────────────────

  describe('production requires power', () => {
    it('farm that loses power stops producing', () => {
      const plant = createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'collective-farm-hq');
      powerSystem();
      productionSystem();
      const store = getResourceEntity()!;
      expect(store.resources.food).toBe(20);

      // Remove power
      world.remove(plant);
      powerSystem();
      productionSystem();
      // Food should stay at 20 — no new production
      expect(store.resources.food).toBe(20);
    });

    it('distillery that loses power stops producing', () => {
      const store = getResourceEntity()!;
      store.resources.food = 1000;
      const plant = createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'vodka-distillery');
      powerSystem();
      productionSystem();
      expect(store.resources.vodka).toBe(10);

      world.remove(plant);
      powerSystem();
      productionSystem();
      expect(store.resources.vodka).toBe(10);
    });

    it('partially powered: some producers work, some do not', () => {
      const store = getResourceEntity()!;
      store.resources.food = 10000; // enough grain for all vodka
      createBuilding(0, 0, 'power-station'); // 100 output
      // 20 distilleries * 5 powerReq = 100, plus 1 extra = 105 > 100
      for (let i = 0; i < 21; i++) {
        createBuilding(i + 1, 0, 'vodka-distillery');
      }
      powerSystem();
      productionSystem();

      // 20 powered * 10 vodka = 200 (the 21st is unpowered)
      expect(store.resources.vodka).toBe(200);
    });
  });

  // ── Multiple producers stack correctly ────────────────────

  describe('multiple producers stack correctly', () => {
    it('farms and distilleries both produce in the same tick', () => {
      const store = getResourceEntity()!;
      store.resources.food = 1000; // grain for vodka
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'collective-farm-hq');
      createBuilding(2, 2, 'vodka-distillery');
      powerSystem();
      productionSystem();
      // Farm produces 20 food, distillery consumes 20 grain (10 vodka * 2)
      expect(store.resources.food).toBe(1000 + 20 - 20); // net 0 food change
      expect(store.resources.vodka).toBe(10);
    });

    it('production adds to existing resources', () => {
      const store = getResourceEntity()!;
      store.resources.food = 100;
      store.resources.vodka = 50;

      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'collective-farm-hq');
      createBuilding(2, 2, 'vodka-distillery');
      powerSystem();
      productionSystem();

      // Farm +20 food, distillery -20 food (grain cost), +10 vodka
      expect(store.resources.food).toBe(100); // 100 + 20 - 20
      expect(store.resources.vodka).toBe(60);
    });
  });

  // ── Weather modifier (farmModifier) ─────────────────────

  describe('farmModifier parameter', () => {
    it('farmModifier=0 yields zero food from farms', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'collective-farm-hq');
      powerSystem();
      productionSystem(0.0);
      const store = getResourceEntity()!;
      expect(store.resources.food).toBe(0);
    });

    it('farmModifier=0.5 halves food production', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'collective-farm-hq');
      powerSystem();
      productionSystem(0.5);
      const store = getResourceEntity()!;
      expect(store.resources.food).toBe(10); // 20 * 0.5
    });

    it('farmModifier=2.0 doubles food production', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'collective-farm-hq');
      powerSystem();
      productionSystem(2.0);
      const store = getResourceEntity()!;
      expect(store.resources.food).toBe(40); // 20 * 2.0
    });

    it('farmModifier does not affect vodka production', () => {
      const store = getResourceEntity()!;
      store.resources.food = 1000;
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'vodka-distillery');
      powerSystem();
      productionSystem(0.0); // zero farmModifier
      expect(store.resources.vodka).toBe(10); // unaffected
    });
  });

  // ── Vodka modifier (vodkaModifier) ──────────────────────

  describe('vodkaModifier parameter', () => {
    it('vodkaModifier=0.5 halves vodka production', () => {
      const store = getResourceEntity()!;
      store.resources.food = 1000;
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'vodka-distillery');
      powerSystem();
      productionSystem(1.0, 0.5);
      expect(store.resources.vodka).toBe(5); // 10 * 0.5
    });

    it('vodkaModifier=2.0 doubles vodka production', () => {
      const store = getResourceEntity()!;
      store.resources.food = 1000;
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'vodka-distillery');
      powerSystem();
      productionSystem(1.0, 2.0);
      expect(store.resources.vodka).toBe(20); // 10 * 2.0
    });

    it('vodkaModifier does not affect food production', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'collective-farm-hq');
      powerSystem();
      productionSystem(1.0, 0.0); // zero vodkaModifier
      const store = getResourceEntity()!;
      expect(store.resources.food).toBe(20); // unaffected
    });

    it('both modifiers apply independently', () => {
      const store = getResourceEntity()!;
      store.resources.food = 1000;
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'collective-farm-hq');
      createBuilding(2, 2, 'vodka-distillery');
      powerSystem();
      productionSystem(0.5, 1.5);
      // Farm: 20 * 0.5 = 10 food added; Distillery: 10 * 1.5 = 15 vodka, costs 30 food
      expect(store.resources.food).toBe(1000 + 10 - 30); // 980
      expect(store.resources.vodka).toBe(15); // 10 * 1.5
    });
  });

  // ── Edge: no resource store ───────────────────────────────

  describe('edge: no resource store', () => {
    it('does not throw when resource store is missing', () => {
      world.clear();
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'collective-farm-hq');
      expect(() => productionSystem()).not.toThrow();
    });
  });

  // ── Non-producer buildings ────────────────────────────────

  describe('non-producer buildings', () => {
    it('housing does not produce any resources', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'apartment-tower-a');
      powerSystem();
      productionSystem();
      const store = getResourceEntity()!;
      expect(store.resources.food).toBe(0);
      expect(store.resources.vodka).toBe(0);
    });
  });
});

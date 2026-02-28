/**
 * Tests for the constructionSystem (Iterations 7-8).
 *
 * Verifies that buildings progress through construction phases,
 * consume materials, apply era multipliers, and transition to
 * operational when complete.
 */
import {
  getResourceEntity,
  housing,
  operationalBuildings,
  producers,
  underConstruction,
} from '../../src/ecs/archetypes';
import {
  createBuilding,
  createResourceStore,
  isOperational,
  placeNewBuilding,
} from '../../src/ecs/factories';
import {
  constructionSystem,
  DEFAULT_BASE_TICKS,
  DEFAULT_MATERIAL_COST,
} from '../../src/ecs/systems/constructionSystem';
import { productionSystem } from '../../src/ecs/systems/productionSystem';
import { world } from '../../src/ecs/world';

describe('constructionSystem', () => {
  beforeEach(() => {
    world.clear();
    // Provide abundant default resources so basic tests don't fail on material checks
    createResourceStore({ timber: 5000, steel: 5000, cement: 5000 });
  });

  afterEach(() => {
    world.clear();
  });

  // ── Progress ──────────────────────────────────────────────

  describe('progress', () => {
    it('advances constructionProgress each tick', () => {
      const entity = placeNewBuilding(5, 5, 'collective-farm-hq');
      expect(entity.building!.constructionProgress).toBe(0);

      constructionSystem();
      expect(entity.building!.constructionProgress!).toBeGreaterThan(0);
    });

    it('progress rate is 1/baseTicks per tick', () => {
      const entity = placeNewBuilding(5, 5, 'collective-farm-hq');
      constructionSystem();

      const expected = 1 / DEFAULT_BASE_TICKS;
      expect(entity.building!.constructionProgress).toBeCloseTo(expected, 6);
    });

    it('does not affect operational buildings', () => {
      const entity = createBuilding(5, 5, 'collective-farm-hq');
      constructionSystem();

      // No constructionPhase means operational — should be untouched
      expect(entity.building!.constructionPhase).toBeUndefined();
      expect(entity.building!.constructionProgress).toBeUndefined();
    });

    it('does not affect already-completed buildings', () => {
      const entity = placeNewBuilding(5, 5, 'collective-farm-hq');
      entity.building!.constructionPhase = 'complete';
      entity.building!.constructionProgress = 1;
      world.reindex(entity);

      constructionSystem();
      expect(entity.building!.constructionProgress).toBe(1);
    });
  });

  // ── Phase transitions ─────────────────────────────────────

  describe('phase transitions', () => {
    it('transitions from foundation to building at 50%', () => {
      const entity = placeNewBuilding(5, 5, 'collective-farm-hq');
      // Run enough ticks to reach 50%
      const ticksToHalf = Math.ceil(DEFAULT_BASE_TICKS * 0.5);
      for (let i = 0; i < ticksToHalf; i++) constructionSystem();

      expect(entity.building!.constructionPhase).toBe('building');
    });

    it('transitions from building to complete at 100%', () => {
      const entity = placeNewBuilding(5, 5, 'collective-farm-hq');
      // Run enough ticks to reach 100%
      for (let i = 0; i < DEFAULT_BASE_TICKS; i++) constructionSystem();

      expect(entity.building!.constructionPhase).toBe('complete');
      expect(entity.building!.constructionProgress).toBe(1);
    });

    it('completed building joins operationalBuildings archetype', () => {
      placeNewBuilding(5, 5, 'collective-farm-hq');
      expect(operationalBuildings.entities.length).toBe(0);
      expect(underConstruction.entities.length).toBe(1);

      for (let i = 0; i < DEFAULT_BASE_TICKS; i++) constructionSystem();

      expect(operationalBuildings.entities.length).toBe(1);
      expect(underConstruction.entities.length).toBe(0);
    });

    it('completed producer building joins producers archetype', () => {
      placeNewBuilding(5, 5, 'collective-farm-hq'); // has produces field
      expect(producers.entities.length).toBe(0);

      for (let i = 0; i < DEFAULT_BASE_TICKS; i++) constructionSystem();

      expect(producers.entities.length).toBe(1);
    });
  });

  // ── Multiple buildings ────────────────────────────────────

  describe('multiple buildings', () => {
    it('progresses all under-construction buildings independently', () => {
      const a = placeNewBuilding(0, 0, 'collective-farm-hq');
      const b = placeNewBuilding(3, 3, 'apartment-tower-a');

      constructionSystem();

      expect(a.building!.constructionProgress!).toBeGreaterThan(0);
      expect(b.building!.constructionProgress!).toBeGreaterThan(0);
    });

    it('does not progress operational buildings mixed with construction', () => {
      const operational = createBuilding(0, 0, 'power-station');
      placeNewBuilding(5, 5, 'collective-farm-hq');

      constructionSystem();

      expect(operational.building!.constructionPhase).toBeUndefined();
      expect(underConstruction.entities.length).toBe(1);
      expect(operationalBuildings.entities.length).toBe(1);
    });
  });

  // ── Construction cost data ────────────────────────────────

  describe('construction cost integration', () => {
    it('uses baseTicks from building def when available', () => {
      // Buildings without constructionCost use DEFAULT_BASE_TICKS
      const entity = placeNewBuilding(5, 5, 'collective-farm-hq');
      constructionSystem();

      // Progress should be 1/DEFAULT_BASE_TICKS since no constructionCost in def
      const expected = 1 / DEFAULT_BASE_TICKS;
      expect(entity.building!.constructionProgress).toBeCloseTo(expected, 6);
    });
  });

  // ── Material deduction (Iteration 8) ───────────────────

  describe('material deduction', () => {
    it('deducts materials from resources each construction tick', () => {
      placeNewBuilding(5, 5, 'collective-farm-hq');

      const res = getResourceEntity()!.resources;
      const timberBefore = res.timber;

      constructionSystem();

      // Should have deducted some timber (default material cost / baseTicks per tick)
      expect(res.timber).toBeLessThan(timberBefore);
    });

    it('deducts timber, steel, and cement proportionally per tick', () => {
      placeNewBuilding(5, 5, 'collective-farm-hq');

      const res = getResourceEntity()!.resources;
      const timberBefore = res.timber;
      const steelBefore = res.steel;
      const cementBefore = res.cement;

      constructionSystem();

      // Per-tick deduction = total / baseTicks (rounded up, min 1 if total > 0)
      const perTickTimber = Math.max(
        1,
        Math.ceil(DEFAULT_MATERIAL_COST.timber / DEFAULT_BASE_TICKS)
      );
      const perTickSteel = Math.max(1, Math.ceil(DEFAULT_MATERIAL_COST.steel / DEFAULT_BASE_TICKS));
      const perTickCement = Math.max(
        1,
        Math.ceil(DEFAULT_MATERIAL_COST.cement / DEFAULT_BASE_TICKS)
      );

      expect(timberBefore - res.timber).toBe(perTickTimber);
      expect(steelBefore - res.steel).toBe(perTickSteel);
      expect(cementBefore - res.cement).toBe(perTickCement);
    });

    it('pauses construction when timber is insufficient', () => {
      const res = getResourceEntity()!.resources;
      res.timber = 0;
      const entity = placeNewBuilding(5, 5, 'collective-farm-hq');

      constructionSystem();

      // Should NOT advance — no timber
      expect(entity.building!.constructionTicks).toBe(0);
      expect(entity.building!.constructionProgress).toBe(0);
    });

    it('pauses construction when steel is insufficient', () => {
      const res = getResourceEntity()!.resources;
      res.steel = 0;
      const entity = placeNewBuilding(5, 5, 'collective-farm-hq');

      constructionSystem();

      expect(entity.building!.constructionTicks).toBe(0);
      expect(entity.building!.constructionProgress).toBe(0);
    });

    it('pauses construction when cement is insufficient', () => {
      const res = getResourceEntity()!.resources;
      res.cement = 0;
      const entity = placeNewBuilding(5, 5, 'collective-farm-hq');

      constructionSystem();

      expect(entity.building!.constructionTicks).toBe(0);
      expect(entity.building!.constructionProgress).toBe(0);
    });

    it('resumes construction when materials become available', () => {
      const res = getResourceEntity()!.resources;
      res.timber = 0;
      const entity = placeNewBuilding(5, 5, 'collective-farm-hq');

      // Tick 1: paused (no timber)
      constructionSystem();
      expect(entity.building!.constructionTicks).toBe(0);

      // Restore timber
      res.timber = 500;

      // Tick 2: should advance
      constructionSystem();
      expect(entity.building!.constructionTicks).toBe(1);
      expect(entity.building!.constructionProgress!).toBeGreaterThan(0);
    });

    it('total materials consumed across full construction match total cost', () => {
      placeNewBuilding(5, 5, 'collective-farm-hq');

      const res = getResourceEntity()!.resources;
      const timberBefore = res.timber;
      const steelBefore = res.steel;
      const cementBefore = res.cement;

      // Run to completion
      for (let i = 0; i < DEFAULT_BASE_TICKS; i++) constructionSystem();

      // Total consumed should equal the material cost
      expect(timberBefore - res.timber).toBe(DEFAULT_MATERIAL_COST.timber);
      expect(steelBefore - res.steel).toBe(DEFAULT_MATERIAL_COST.steel);
      expect(cementBefore - res.cement).toBe(DEFAULT_MATERIAL_COST.cement);
    });
  });

  // ── Era construction time multiplier (Iteration 8) ─────

  describe('era construction time multiplier', () => {
    it('applies era multiplier to effective construction time', () => {
      const entity = placeNewBuilding(5, 5, 'collective-farm-hq');

      // 2.0x multiplier = takes twice as long
      const mult = 2.0;
      const effectiveTicks = Math.ceil(DEFAULT_BASE_TICKS * mult);

      // After DEFAULT_BASE_TICKS ticks at 2x, should NOT be complete
      for (let i = 0; i < DEFAULT_BASE_TICKS; i++) constructionSystem(mult);
      expect(entity.building!.constructionPhase).not.toBe('complete');

      // After effectiveTicks total, should be complete
      for (let i = DEFAULT_BASE_TICKS; i < effectiveTicks; i++) constructionSystem(mult);
      expect(entity.building!.constructionPhase).toBe('complete');
    });

    it('0.6x multiplier speeds up construction', () => {
      const entity = placeNewBuilding(5, 5, 'collective-farm-hq');

      const mult = 0.6;
      const effectiveTicks = Math.ceil(DEFAULT_BASE_TICKS * mult);

      for (let i = 0; i < effectiveTicks; i++) constructionSystem(mult);
      expect(entity.building!.constructionPhase).toBe('complete');
    });

    it('defaults to 1.0x multiplier when no argument given', () => {
      const entity = placeNewBuilding(5, 5, 'collective-farm-hq');

      for (let i = 0; i < DEFAULT_BASE_TICKS; i++) constructionSystem();
      expect(entity.building!.constructionPhase).toBe('complete');
    });
  });

  // ── Full lifecycle: foundation → building → complete ─────────

  describe('full construction lifecycle', () => {
    it('placeNewBuilding creates entity in foundation phase with zero progress', () => {
      const entity = placeNewBuilding(5, 5, 'collective-farm-hq');
      expect(entity.building!.constructionPhase).toBe('foundation');
      expect(entity.building!.constructionProgress).toBe(0);
      expect(entity.building!.constructionTicks).toBe(0);
      expect(isOperational(entity as { building: typeof entity.building & {} })).toBe(false);
    });

    it('progresses through all three phases: foundation → building → complete', () => {
      const entity = placeNewBuilding(5, 5, 'collective-farm-hq');

      // Starts at foundation
      expect(entity.building!.constructionPhase).toBe('foundation');

      // Run until just before 50% — should still be foundation
      const ticksToHalf = Math.ceil(DEFAULT_BASE_TICKS * 0.5);
      for (let i = 0; i < ticksToHalf - 1; i++) constructionSystem();
      expect(entity.building!.constructionPhase).toBe('foundation');

      // One more tick pushes to building phase
      constructionSystem();
      expect(entity.building!.constructionPhase).toBe('building');

      // Run remaining ticks to completion
      const remaining = DEFAULT_BASE_TICKS - ticksToHalf;
      for (let i = 0; i < remaining; i++) constructionSystem();
      expect(entity.building!.constructionPhase).toBe('complete');
      expect(entity.building!.constructionProgress).toBe(1);
      expect(isOperational(entity as { building: typeof entity.building & {} })).toBe(true);
    });

    it('under-construction building is NOT in operationalBuildings archetype', () => {
      placeNewBuilding(5, 5, 'collective-farm-hq');

      expect(underConstruction.entities.length).toBe(1);
      expect(operationalBuildings.entities.length).toBe(0);

      // Advance partway
      constructionSystem();
      expect(underConstruction.entities.length).toBe(1);
      expect(operationalBuildings.entities.length).toBe(0);
    });

    it('under-construction producer is NOT in producers archetype', () => {
      placeNewBuilding(5, 5, 'collective-farm-hq'); // has produces field
      expect(producers.entities.length).toBe(0);

      // Advance partway but don't complete
      for (let i = 0; i < DEFAULT_BASE_TICKS - 1; i++) constructionSystem();
      expect(producers.entities.length).toBe(0);
    });

    it('completed building transitions from underConstruction to operationalBuildings', () => {
      placeNewBuilding(5, 5, 'collective-farm-hq');
      expect(underConstruction.entities.length).toBe(1);
      expect(operationalBuildings.entities.length).toBe(0);

      for (let i = 0; i < DEFAULT_BASE_TICKS; i++) constructionSystem();

      expect(underConstruction.entities.length).toBe(0);
      expect(operationalBuildings.entities.length).toBe(1);
    });
  });

  // ── Production integration after construction ───────────────

  describe('production after construction', () => {
    it('completed powered producer generates resources via productionSystem', () => {
      const entity = placeNewBuilding(5, 5, 'collective-farm-hq');

      // Complete construction
      for (let i = 0; i < DEFAULT_BASE_TICKS; i++) constructionSystem();
      expect(entity.building!.constructionPhase).toBe('complete');

      // Power the building
      entity.building!.powered = true;
      world.reindex(entity);

      const res = getResourceEntity()!.resources;
      const foodBefore = res.food;

      // Run production — completed powered producer should produce food
      productionSystem();

      // collective-farm-hq produces food, so food should increase
      if (entity.building!.produces?.resource === 'food') {
        expect(res.food).toBeGreaterThan(foodBefore);
      }
    });

    it('under-construction powered building does NOT produce resources', () => {
      const entity = placeNewBuilding(5, 5, 'collective-farm-hq');

      // Power it while still under construction
      entity.building!.powered = true;
      world.reindex(entity);

      const res = getResourceEntity()!.resources;
      const foodBefore = res.food;

      productionSystem();

      // Should NOT produce — still under construction
      expect(res.food).toBe(foodBefore);
    });

    it('completed housing building joins housing archetype', () => {
      const entity = placeNewBuilding(5, 5, 'apartment-tower-a');
      expect(housing.entities.length).toBe(0);

      for (let i = 0; i < DEFAULT_BASE_TICKS; i++) constructionSystem();

      // apartment-tower-a has housingCap > 0, should join housing archetype
      if (entity.building!.housingCap > 0) {
        expect(housing.entities.length).toBe(1);
      }
    });
  });

  // ── Weather multiplier ──────────────────────────────────────

  describe('weather construction time multiplier', () => {
    it('applies weather multiplier stacked with era multiplier', () => {
      const entity = placeNewBuilding(5, 5, 'collective-farm-hq');

      // era=1.5 * weather=2.0 = effective 3.0x
      const eraMult = 1.5;
      const weatherMult = 2.0;
      const effectiveTicks = Math.ceil(DEFAULT_BASE_TICKS * eraMult * weatherMult);

      for (let i = 0; i < effectiveTicks; i++) constructionSystem(eraMult, weatherMult);
      expect(entity.building!.constructionPhase).toBe('complete');
    });

    it('weather multiplier < 1 speeds up construction', () => {
      const entity = placeNewBuilding(5, 5, 'collective-farm-hq');

      // Good weather = 0.5x
      const weatherMult = 0.5;
      const effectiveTicks = Math.ceil(DEFAULT_BASE_TICKS * 1.0 * weatherMult);

      for (let i = 0; i < effectiveTicks; i++) constructionSystem(1.0, weatherMult);
      expect(entity.building!.constructionPhase).toBe('complete');
    });
  });
});

/**
 * Tests for construction phases (Iteration 6 — ECS schema).
 *
 * Verifies that:
 * - placeNewBuilding() creates entities in 'foundation' phase
 * - createBuilding() creates operational entities (backward compat)
 * - completeConstruction() transitions to 'complete'
 * - Archetypes correctly distinguish operational vs under-construction
 */
import {
  buildingsLogic,
  housing,
  operationalBuildings,
  producers,
  underConstruction,
} from '../../src/ecs/archetypes';
import {
  completeConstruction,
  createBuilding,
  isOperational,
  placeNewBuilding,
} from '../../src/ecs/factories';
import { world } from '../../src/ecs/world';

describe('Construction Phases — ECS Schema', () => {
  beforeEach(() => {
    world.clear();
  });

  afterEach(() => {
    world.clear();
  });

  // ── placeNewBuilding ──────────────────────────────────────

  describe('placeNewBuilding', () => {
    it('creates entity with constructionPhase: foundation', () => {
      const entity = placeNewBuilding(5, 5, 'collective-farm-hq');
      expect(entity.building!.constructionPhase).toBe('foundation');
    });

    it('creates entity with constructionProgress: 0', () => {
      const entity = placeNewBuilding(5, 5, 'collective-farm-hq');
      expect(entity.building!.constructionProgress).toBe(0);
    });

    it('entity is added to the world', () => {
      placeNewBuilding(5, 5, 'collective-farm-hq');
      expect(buildingsLogic.entities.length).toBe(1);
    });

    it('entity appears in underConstruction archetype', () => {
      placeNewBuilding(5, 5, 'collective-farm-hq');
      expect(underConstruction.entities.length).toBe(1);
    });

    it('entity does NOT appear in operationalBuildings archetype', () => {
      placeNewBuilding(5, 5, 'collective-farm-hq');
      expect(operationalBuildings.entities.length).toBe(0);
    });

    it('entity does NOT appear in producers (even if it has produces)', () => {
      // collective-farm-hq has produces: { resource: 'food', amount: 8 }
      placeNewBuilding(5, 5, 'collective-farm-hq');
      expect(producers.entities.length).toBe(0);
    });

    it('entity does NOT appear in housing (even if it has housingCap)', () => {
      // apartment-tower-a has housingCap: 8
      placeNewBuilding(5, 5, 'apartment-tower-a');
      expect(housing.entities.length).toBe(0);
    });
  });

  // ── createBuilding (backward compat) ─────────────────────

  describe('createBuilding (backward compat)', () => {
    it('creates entity without constructionPhase (operational)', () => {
      const entity = createBuilding(5, 5, 'collective-farm-hq');
      expect(entity.building!.constructionPhase).toBeUndefined();
    });

    it('entity appears in operationalBuildings archetype', () => {
      createBuilding(5, 5, 'collective-farm-hq');
      expect(operationalBuildings.entities.length).toBe(1);
    });

    it('entity does NOT appear in underConstruction', () => {
      createBuilding(5, 5, 'collective-farm-hq');
      expect(underConstruction.entities.length).toBe(0);
    });

    it('producer entity appears in producers', () => {
      createBuilding(5, 5, 'collective-farm-hq');
      expect(producers.entities.length).toBe(1);
    });

    it('housing entity appears in housing', () => {
      createBuilding(5, 5, 'apartment-tower-a');
      expect(housing.entities.length).toBe(1);
    });
  });

  // ── completeConstruction ──────────────────────────────────

  describe('completeConstruction', () => {
    it('transitions phase to complete', () => {
      const entity = placeNewBuilding(5, 5, 'collective-farm-hq');
      completeConstruction(entity);
      expect(entity.building!.constructionPhase).toBe('complete');
    });

    it('sets progress to 1', () => {
      const entity = placeNewBuilding(5, 5, 'collective-farm-hq');
      completeConstruction(entity);
      expect(entity.building!.constructionProgress).toBe(1);
    });

    it('after reindex, entity moves to operationalBuildings', () => {
      const entity = placeNewBuilding(5, 5, 'collective-farm-hq');
      expect(operationalBuildings.entities.length).toBe(0);
      completeConstruction(entity);
      world.reindex(entity);
      expect(operationalBuildings.entities.length).toBe(1);
      expect(underConstruction.entities.length).toBe(0);
    });

    it('after reindex, producer becomes active', () => {
      const entity = placeNewBuilding(5, 5, 'collective-farm-hq');
      expect(producers.entities.length).toBe(0);
      completeConstruction(entity);
      world.reindex(entity);
      expect(producers.entities.length).toBe(1);
    });

    it('after reindex, housing becomes active', () => {
      const entity = placeNewBuilding(5, 5, 'apartment-tower-a');
      expect(housing.entities.length).toBe(0);
      completeConstruction(entity);
      world.reindex(entity);
      expect(housing.entities.length).toBe(1);
    });
  });

  // ── isOperational ──────────────────────────────────────────

  describe('isOperational', () => {
    it('returns true for buildings without constructionPhase', () => {
      const entity = createBuilding(5, 5, 'collective-farm-hq');
      expect(isOperational(entity as { building: NonNullable<typeof entity.building> })).toBe(true);
    });

    it('returns false for foundation buildings', () => {
      const entity = placeNewBuilding(5, 5, 'collective-farm-hq');
      expect(isOperational(entity as { building: NonNullable<typeof entity.building> })).toBe(
        false
      );
    });

    it('returns true for completed buildings', () => {
      const entity = placeNewBuilding(5, 5, 'collective-farm-hq');
      completeConstruction(entity);
      expect(isOperational(entity as { building: NonNullable<typeof entity.building> })).toBe(true);
    });
  });

  // ── Mixed states ──────────────────────────────────────────

  describe('mixed operational + under-construction', () => {
    it('correctly separates operational and construction buildings', () => {
      createBuilding(0, 0, 'power-station'); // operational
      createBuilding(1, 1, 'collective-farm-hq'); // operational
      placeNewBuilding(3, 3, 'apartment-tower-a'); // foundation
      placeNewBuilding(5, 5, 'vodka-distillery'); // foundation

      expect(buildingsLogic.entities.length).toBe(4);
      expect(operationalBuildings.entities.length).toBe(2);
      expect(underConstruction.entities.length).toBe(2);
    });
  });
});

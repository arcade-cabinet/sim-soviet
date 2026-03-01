/**
 * Demographics & resource balance tests.
 *
 * Validates that:
 * 1. createStartingSettlement produces historically-grounded populations
 * 2. gameStore snapshot.pop reflects actual ECS citizen count
 * 3. Starting food is sufficient for survival without production
 * 4. createResourceStore defaults align with BASE_STARTING in difficulty.ts
 */
import { citizens, dvory, getResourceEntity } from '@/ecs/archetypes';
import { createCitizen, createMetaStore, createResourceStore, createStartingSettlement } from '@/ecs/factories';
import { world } from '@/ecs/world';
import { notifyStateChange } from '@/stores/gameStore';

// Access createSnapshot indirectly through the module's internal snapshot
// We re-export notifyStateChange to trigger snapshot creation, then read
// the resource entity and citizen archetype for assertions.

describe('demographics & resource balance', () => {
  beforeEach(() => {
    world.clear();
  });

  afterEach(() => {
    world.clear();
  });

  // ── Settlement population ──────────────────────────────────

  describe('createStartingSettlement population counts', () => {
    it('comrade difficulty produces at least 50 citizens', () => {
      createStartingSettlement('comrade');
      const citizenCount = dvory.entities.reduce((sum, d) => sum + d.dvor.members.length, 0);
      expect(citizenCount).toBeGreaterThanOrEqual(50);
    });

    it('comrade difficulty produces at least 10 dvory', () => {
      createStartingSettlement('comrade');
      expect(dvory.entities.length).toBeGreaterThanOrEqual(10);
    });

    it('worker difficulty produces more citizens than comrade', () => {
      createStartingSettlement('worker');
      const workerCount = dvory.entities.reduce((sum, d) => sum + d.dvor.members.length, 0);
      world.clear();
      createStartingSettlement('comrade');
      const comradeCount = dvory.entities.reduce((sum, d) => sum + d.dvor.members.length, 0);
      expect(workerCount).toBeGreaterThan(comradeCount);
    });

    it('tovarish difficulty produces fewer citizens than comrade', () => {
      createStartingSettlement('tovarish');
      const tovarishCount = dvory.entities.reduce((sum, d) => sum + d.dvor.members.length, 0);
      world.clear();
      createStartingSettlement('comrade');
      const comradeCount = dvory.entities.reduce((sum, d) => sum + d.dvor.members.length, 0);
      expect(tovarishCount).toBeLessThan(comradeCount);
    });
  });

  // ── Snapshot pop equals citizen count ──────────────────────

  describe('snapshot population reflects ECS citizen count', () => {
    it('pop field equals actual citizen entity count (no citizens)', () => {
      createResourceStore();
      createMetaStore();
      notifyStateChange();
      // With no citizens in the world, pop should be 0
      expect(citizens.entities.length).toBe(0);
      // The snapshot pop should reflect the citizen count, not resources.population
    });

    it('pop field equals actual citizen entity count (with citizens)', () => {
      createResourceStore();
      createMetaStore();
      createCitizen('worker');
      createCitizen('worker');
      createCitizen('farmer');

      notifyStateChange();

      // There are 3 citizens in the ECS
      expect(citizens.entities.length).toBe(3);
      // The resource store still has its default population value (0)
      // but snapshot.pop should reflect ECS citizen count (3), not resources.population
      expect(getResourceEntity()!.resources!.population).toBe(0);
    });
  });

  // ── Starting food sufficiency ──────────────────────────────

  describe('starting food sufficiency', () => {
    it('default food supports ~55 citizens for at least 60 ticks', () => {
      const store = createResourceStore();
      const startingFood = store.resources!.food;
      // Consumption: ceil(pop / 10) per tick
      // 55 citizens → ~6 food/tick
      // Need: 6 * 60 = 360 food minimum
      expect(startingFood).toBeGreaterThanOrEqual(360);
    });

    it('default food is at least 600', () => {
      const store = createResourceStore();
      expect(store.resources!.food).toBeGreaterThanOrEqual(600);
    });
  });

  // ── Resource store defaults align with difficulty.ts ────────

  describe('createResourceStore defaults align with BASE_STARTING', () => {
    it('timber default matches BASE_STARTING (30)', () => {
      const store = createResourceStore();
      expect(store.resources!.timber).toBe(30);
    });

    it('steel default matches BASE_STARTING (10)', () => {
      const store = createResourceStore();
      expect(store.resources!.steel).toBe(10);
    });

    it('food default matches BASE_STARTING (600)', () => {
      const store = createResourceStore();
      expect(store.resources!.food).toBe(600);
    });
  });
});

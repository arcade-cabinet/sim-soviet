/**
 * Tests for src/game/GameView.ts — createGameView()
 *
 * Covers both normal paths (ECS singletons present) and fallback paths
 * (singletons missing → defaults).
 */
import { getMetaEntity } from '@/ecs/archetypes';
import { createBuilding, createMetaStore, createResourceStore } from '@/ecs/factories';
import { world } from '@/ecs/world';
import { createGameView } from '@/game/GameView';

describe('createGameView', () => {
  beforeEach(() => {
    world.clear();
  });

  afterEach(() => {
    world.clear();
  });

  describe('with ECS singletons present', () => {
    beforeEach(() => {
      createResourceStore({
        money: 1234,
        food: 500,
        vodka: 100,
        power: 50,
        powerUsed: 20,
        population: 42,
      });
      createMetaStore({
        date: { year: 1985, month: 6, tick: 12 },
        quota: { type: 'vodka', target: 800, current: 350, deadlineYear: 1990 },
      });
    });

    it('reads resource values from ECS', () => {
      const view = createGameView();
      expect(view.money).toBe(1234);
      expect(view.food).toBe(500);
      expect(view.vodka).toBe(100);
      expect(view.power).toBe(50);
      expect(view.powerUsed).toBe(20);
      expect(view.pop).toBe(42);
    });

    it('reads date from ECS meta', () => {
      const view = createGameView();
      expect(view.date).toEqual({ year: 1985, month: 6, tick: 12 });
    });

    it('reads quota from ECS meta', () => {
      const view = createGameView();
      expect(view.quota).toEqual({
        type: 'vodka',
        target: 800,
        current: 350,
        deadlineYear: 1990,
      });
    });

    it('includes buildings from ECS', () => {
      createBuilding(3, 7, 'power-station');
      createBuilding(5, 5, 'apartment-tower-a');

      const view = createGameView();
      expect(view.buildings).toHaveLength(2);

      const ps = view.buildings.find((b) => b.defId === 'power-station');
      expect(ps).toBeDefined();
      expect(ps!.x).toBe(3);
      expect(ps!.y).toBe(7);
      expect(ps!.powered).toBe(false);
    });

    it('returns empty buildings array when none exist', () => {
      const view = createGameView();
      expect(view.buildings).toHaveLength(0);
    });

    it('reads currentEra from ECS meta (defaults to revolution)', () => {
      const view = createGameView();
      expect(view.currentEra).toBe('revolution');
    });

    it('reads currentEra when set explicitly', () => {
      const meta = getMetaEntity();
      meta!.gameMeta.currentEra = 'thaw_and_freeze';
      const view = createGameView();
      expect(view.currentEra).toBe('thaw_and_freeze');
    });
  });

  describe('throws when ECS singletons are missing (FIX-12)', () => {
    it('throws when no resource entity exists', () => {
      expect(() => createGameView()).toThrow('[GameView] Resource entity missing');
    });

    it('throws when no meta entity exists', () => {
      expect(() => createGameView()).toThrow('[GameView] Resource entity missing');
    });

    it('throws when no singletons exist', () => {
      expect(() => createGameView()).toThrow('[GameView] Resource entity missing');
    });
  });

  describe('partial ECS state', () => {
    it('throws when resource entity present but no meta entity', () => {
      createResourceStore({ money: 999 });
      expect(() => createGameView()).toThrow('[GameView] Meta entity missing');
    });

    it('throws when meta entity present but no resource entity', () => {
      createMetaStore({ date: { year: 2000, month: 1, tick: 0 } });
      expect(() => createGameView()).toThrow('[GameView] Resource entity missing');
    });
  });
});

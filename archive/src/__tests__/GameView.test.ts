/**
 * Tests for src/game/GameView.ts — createGameView()
 *
 * Covers both normal paths (ECS singletons present) and fallback paths
 * (singletons missing → defaults).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

    it('reads currentEra from ECS meta (defaults to war_communism)', () => {
      const view = createGameView();
      expect(view.currentEra).toBe('war_communism');
    });

    it('reads currentEra when set explicitly', () => {
      const meta = getMetaEntity();
      meta!.gameMeta.currentEra = 'thaw';
      const view = createGameView();
      expect(view.currentEra).toBe('thaw');
    });
  });

  describe('fallback defaults when ECS singletons are missing', () => {
    it('returns default resource values when no resource entity', () => {
      const view = createGameView();
      expect(view.money).toBe(0);
      expect(view.food).toBe(0);
      expect(view.vodka).toBe(0);
      expect(view.power).toBe(0);
      expect(view.powerUsed).toBe(0);
      expect(view.pop).toBe(0);
    });

    it('returns default date when no meta entity', () => {
      const view = createGameView();
      expect(view.date).toEqual({ year: 1922, month: 10, tick: 0 });
    });

    it('returns default quota when no meta entity', () => {
      const view = createGameView();
      expect(view.quota).toEqual({
        type: 'food',
        target: 500,
        current: 0,
        deadlineYear: 1927,
      });
    });

    it('returns default currentEra when no meta entity', () => {
      const view = createGameView();
      expect(view.currentEra).toBe('war_communism');
    });

    it('returns empty buildings when no singletons exist', () => {
      const view = createGameView();
      expect(view.buildings).toHaveLength(0);
    });
  });

  describe('partial ECS state', () => {
    it('handles resource entity present but no meta entity', () => {
      createResourceStore({ money: 999 });
      const view = createGameView();
      expect(view.money).toBe(999);
      expect(view.date).toEqual({ year: 1922, month: 10, tick: 0 });
    });

    it('handles meta entity present but no resource entity', () => {
      createMetaStore({ date: { year: 2000, month: 1, tick: 0 } });
      const view = createGameView();
      expect(view.money).toBe(0);
      expect(view.date).toEqual({ year: 2000, month: 1, tick: 0 });
    });
  });
});

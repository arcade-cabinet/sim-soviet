import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getResourceEntity } from '../ecs/archetypes';
import { createResourceStore } from '../ecs/factories';
import type { QuotaState } from '../ecs/systems/quotaSystem';
import { createDefaultQuota, quotaSystem } from '../ecs/systems/quotaSystem';
import { world } from '../ecs/world';

describe('quotaSystem', () => {
  let quota: QuotaState;

  beforeEach(() => {
    world.clear();
    createResourceStore({ food: 0, vodka: 0 });
    quota = createDefaultQuota();
  });

  afterEach(() => {
    world.clear();
  });

  // ── Default quota ─────────────────────────────────────────

  describe('default quota', () => {
    it('starts with food type', () => {
      expect(quota.type).toBe('food');
    });

    it('starts with target of 500', () => {
      expect(quota.target).toBe(500);
    });

    it('starts with current of 0', () => {
      expect(quota.current).toBe(0);
    });

    it('starts with deadline year 1985', () => {
      expect(quota.deadlineYear).toBe(1985);
    });
  });

  // ── Quota progress tracking ───────────────────────────────

  describe('quota progress tracking', () => {
    it('updates quota.current to match food when type is food', () => {
      const store = getResourceEntity()!;
      store.resources.food = 350;
      quotaSystem(quota);
      expect(quota.current).toBe(350);
    });

    it('updates quota.current to match vodka when type is vodka', () => {
      quota.type = 'vodka';
      const store = getResourceEntity()!;
      store.resources.vodka = 75;
      quotaSystem(quota);
      expect(quota.current).toBe(75);
    });

    it('tracks food quota changes over multiple ticks', () => {
      const store = getResourceEntity()!;
      store.resources.food = 100;
      quotaSystem(quota);
      expect(quota.current).toBe(100);

      store.resources.food = 250;
      quotaSystem(quota);
      expect(quota.current).toBe(250);

      store.resources.food = 500;
      quotaSystem(quota);
      expect(quota.current).toBe(500);
    });

    it('tracks vodka quota changes over multiple ticks', () => {
      quota.type = 'vodka';
      const store = getResourceEntity()!;

      store.resources.vodka = 10;
      quotaSystem(quota);
      expect(quota.current).toBe(10);

      store.resources.vodka = 99;
      quotaSystem(quota);
      expect(quota.current).toBe(99);
    });

    it('quota.current can decrease if resources are consumed', () => {
      const store = getResourceEntity()!;
      store.resources.food = 500;
      quotaSystem(quota);
      expect(quota.current).toBe(500);

      store.resources.food = 300; // Citizens consumed food
      quotaSystem(quota);
      expect(quota.current).toBe(300);
    });

    it('quota.current can be 0', () => {
      const store = getResourceEntity()!;
      store.resources.food = 0;
      quotaSystem(quota);
      expect(quota.current).toBe(0);
    });

    it('quota.current tracks exact resource value', () => {
      const store = getResourceEntity()!;
      store.resources.food = 12345;
      quotaSystem(quota);
      expect(quota.current).toBe(12345);
    });
  });

  // ── Quota deadline and evaluation ─────────────────────────
  // NOTE: The quotaSystem itself only tracks progress.
  // Deadline checking and advancement is handled by SimulationEngine.checkQuota().
  // These tests verify the tracking aspect of quotaSystem.

  describe('quota does not modify target or deadline', () => {
    it('does not change target', () => {
      const store = getResourceEntity()!;
      store.resources.food = 600;
      quotaSystem(quota);
      expect(quota.target).toBe(500); // Unchanged
    });

    it('does not change deadlineYear', () => {
      const store = getResourceEntity()!;
      store.resources.food = 600;
      quotaSystem(quota);
      expect(quota.deadlineYear).toBe(1985); // Unchanged
    });

    it('does not change type', () => {
      const store = getResourceEntity()!;
      store.resources.food = 600;
      quotaSystem(quota);
      expect(quota.type).toBe('food'); // Unchanged
    });
  });

  // ── Meeting / failing quota (integration-style assertions) ─

  describe('quota met / failed (data-layer checks)', () => {
    it('quota is met when current >= target', () => {
      const store = getResourceEntity()!;
      store.resources.food = 500;
      quotaSystem(quota);
      expect(quota.current >= quota.target).toBe(true);
    });

    it('quota is met when current exceeds target', () => {
      const store = getResourceEntity()!;
      store.resources.food = 999;
      quotaSystem(quota);
      expect(quota.current >= quota.target).toBe(true);
    });

    it('quota is not met when current < target', () => {
      const store = getResourceEntity()!;
      store.resources.food = 499;
      quotaSystem(quota);
      expect(quota.current >= quota.target).toBe(false);
    });
  });

  // ── Advancing to next plan (manual mutation) ──────────────

  describe('manual quota advancement', () => {
    it('can be reset to a new plan type after meeting quota', () => {
      // Simulates what SimulationEngine.checkQuota() does
      const store = getResourceEntity()!;
      store.resources.food = 600;
      quotaSystem(quota);

      // Advance to vodka plan
      quota.type = 'vodka';
      quota.target = 500;
      quota.deadlineYear = 1990;
      quota.current = 0;

      store.resources.vodka = 123;
      quotaSystem(quota);
      expect(quota.current).toBe(123);
      expect(quota.type).toBe('vodka');
    });

    it('failure counter can be incremented', () => {
      // This is tracked in SimulationEngine, not quotaSystem
      let consecutiveFailures = 0;
      const store = getResourceEntity()!;
      store.resources.food = 100;
      quotaSystem(quota);

      if (quota.current < quota.target) {
        consecutiveFailures++;
      }
      expect(consecutiveFailures).toBe(1);
    });
  });

  // ── Edge: no resource store ───────────────────────────────

  describe('edge: no resource store', () => {
    it('does not throw when resource store is missing', () => {
      world.clear();
      expect(() => quotaSystem(quota)).not.toThrow();
    });

    it('quota.current is unchanged when resource store is missing', () => {
      world.clear();
      quota.current = 42;
      quotaSystem(quota);
      expect(quota.current).toBe(42);
    });
  });
});

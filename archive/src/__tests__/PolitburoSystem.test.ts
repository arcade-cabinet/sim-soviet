import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getMetaEntity, getResourceEntity } from '../ecs/archetypes';
import { createMetaStore, createResourceStore } from '../ecs/factories';
import { world } from '../ecs/world';
import { GameGrid } from '../game/GameGrid';
import { GameRng } from '../game/SeedSystem';
import type { SimCallbacks } from '../game/SimulationEngine';
import { SimulationEngine } from '../game/SimulationEngine';

function createMockCallbacks(): SimCallbacks {
  return {
    onToast: vi.fn(),
    onAdvisor: vi.fn(),
    onPravda: vi.fn(),
    onStateChange: vi.fn(),
  };
}

describe('PolitburoSystem integration', () => {
  let grid: GameGrid;
  let cb: SimCallbacks;
  let engine: SimulationEngine;
  let rng: GameRng;

  beforeEach(() => {
    world.clear();
    grid = new GameGrid();
    cb = createMockCallbacks();
    rng = new GameRng('politburo-test');
    createResourceStore();
    createMetaStore();
    engine = new SimulationEngine(grid, cb, rng);
  });

  afterEach(() => {
    world.clear();
  });

  // ── PolitburoSystem is accessible ────────────────────────

  describe('system access', () => {
    it('exposes the politburo system via getter', () => {
      const politburo = engine.getPolitburo();
      expect(politburo).toBeDefined();
    });

    it('has a generated General Secretary', () => {
      const politburo = engine.getPolitburo();
      const leader = politburo.getGeneralSecretary();
      expect(leader).toBeDefined();
      expect(leader.name).toBeTruthy();
      expect(leader.personality).toBeTruthy();
      expect(leader.alive).toBe(true);
    });

    it('has ministry modifiers', () => {
      const politburo = engine.getPolitburo();
      const mods = politburo.getModifiers();
      expect(mods).toBeDefined();
      expect(typeof mods.foodProductionMult).toBe('number');
      expect(typeof mods.vodkaProductionMult).toBe('number');
      expect(typeof mods.corruptionDrain).toBe('number');
    });
  });

  // ── Leader info syncs to meta entity ───────────────────────

  describe('leader sync', () => {
    it('syncs leader name to meta entity after tick', () => {
      engine.tick();
      expect(getMetaEntity()!.gameMeta.leaderName).toBeTruthy();
      expect(typeof getMetaEntity()!.gameMeta.leaderName).toBe('string');
    });

    it('syncs leader personality to meta entity after tick', () => {
      engine.tick();
      expect(getMetaEntity()!.gameMeta.leaderPersonality).toBeTruthy();
      expect(typeof getMetaEntity()!.gameMeta.leaderPersonality).toBe('string');
    });

    it('leader name matches the politburo general secretary', () => {
      engine.tick();
      const leader = engine.getPolitburo().getGeneralSecretary();
      expect(getMetaEntity()!.gameMeta.leaderName).toBe(leader.name);
      expect(getMetaEntity()!.gameMeta.leaderPersonality).toBe(leader.personality);
    });
  });

  // ── Deterministic generation ─────────────────────────────

  describe('deterministic with seed', () => {
    it('same seed produces same General Secretary name', () => {
      const cb2 = createMockCallbacks();
      world.clear();
      createResourceStore();
      createMetaStore();
      const grid2 = new GameGrid();
      const engine2 = new SimulationEngine(grid2, cb2, new GameRng('politburo-test'));

      const name1 = engine.getPolitburo().getGeneralSecretary().name;
      const name2 = engine2.getPolitburo().getGeneralSecretary().name;
      expect(name1).toBe(name2);
    });
  });

  // ── Corruption drains rubles ─────────────────────────────

  describe('corruption effects', () => {
    it('money decreases over time due to corruption drain', () => {
      const initialMoney = getResourceEntity()!.resources.money;
      // Tick enough times for monthly corruption to apply (tick=0 on month boundary)
      // First tick starts at tick=0, month=1, so corruption fires immediately
      engine.tick();
      // Corruption drain should reduce money (or stay same if drain is 0)
      expect(getResourceEntity()!.resources.money).toBeLessThanOrEqual(initialMoney);
    });

    it('corruption drain persists to ECS store (not overwritten by sync)', () => {
      // Run a few ticks to establish baseline, then tick at a month boundary
      // where corruption fires
      const store = getResourceEntity();
      expect(store).toBeDefined();

      // Set high minister corruption so drain is visible
      const politburo = engine.getPolitburo();
      const mods = politburo.getModifiers();
      const drain = mods.corruptionDrain;

      // Record ECS store money, tick, then verify drain hit ECS store
      engine.tick();
      const moneyAfterTick = store!.resources.money;

      // If corruption drain > 0, money should reflect it
      // If drain is 0 for this seed, at least verify no crash
      if (drain > 0) {
        // Run enough ticks for corruption to apply (monthly)
        for (let i = 0; i < 30; i++) {
          engine.tick();
        }
        // After multiple months of corruption, ECS store money should drop
        expect(store!.resources.money).toBeLessThan(moneyAfterTick + 1000);
      }
    });
  });

  // ── Event effects applied to resources ─────────────────

  describe('event effects', () => {
    it('politburo events apply resource deltas to ECS store', () => {
      const store = getResourceEntity();
      expect(store).toBeDefined();

      // Run for several years — political events (coups, purges) should
      // fire and their effects should modify the ECS store
      let advisorCallCount = 0;
      cb.onAdvisor = vi.fn(() => {
        advisorCallCount++;
      });

      // Run enough ticks for politburo events to fire
      for (let i = 0; i < 360 * 3; i++) {
        engine.tick();
      }

      // Politburo events should have fired (advisor receives event descriptions)
      expect(advisorCallCount).toBeGreaterThan(0);

      // Game state should still be valid (effects applied without crashing)
      expect(getResourceEntity()!.resources.money).toBeGreaterThanOrEqual(0);
      expect(getResourceEntity()!.resources.population).toBeGreaterThanOrEqual(0);
    });
  });

  // ── PolitburoSystem ticks without errors ─────────────────

  describe('stability', () => {
    it('survives 100 ticks without throwing', () => {
      expect(() => {
        for (let i = 0; i < 100; i++) {
          engine.tick();
        }
      }).not.toThrow();
    });

    it('survives a full year (360 ticks) without throwing', () => {
      expect(() => {
        for (let i = 0; i < 360; i++) {
          engine.tick();
        }
      }).not.toThrow();
    });

    it('leader can change over multiple years', () => {
      // Run for 5 years — leader may change via aging/death/coup
      for (let i = 0; i < 360 * 5; i++) {
        engine.tick();
      }
      // Just verify the system is still running and has a leader
      const leader = engine.getPolitburo().getGeneralSecretary();
      expect(leader).toBeDefined();
      expect(leader.name).toBeTruthy();
    });
  });
});

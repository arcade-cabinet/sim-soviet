import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type BuildingCollapsedCallback,
  decaySystem,
  setBuildingCollapsedCallback,
} from '@/ecs/systems/decaySystem';
import type { Entity } from '@/ecs/world';
import { world } from '@/ecs/world';

/**
 * Helper: create a building entity with durability for decay testing.
 */
function createDecayableBuilding(opts: {
  gridX?: number;
  gridY?: number;
  defId?: string;
  durability?: number;
  decayRate?: number;
  powered?: boolean;
}): Entity {
  const entity: Entity = {
    position: { gridX: opts.gridX ?? 0, gridY: opts.gridY ?? 0 },
    building: {
      defId: opts.defId ?? 'apartment-tower-a',
      powered: opts.powered ?? false,
      powerReq: 5,
      powerOutput: 0,
      housingCap: 50,
      pollution: 0,
      fear: 0,
    },
    durability: {
      current: opts.durability ?? 100,
      decayRate: opts.decayRate ?? 0.05,
    },
    isBuilding: true,
  };
  return world.add(entity);
}

describe('decaySystem', () => {
  beforeEach(() => {
    world.clear();
    setBuildingCollapsedCallback(undefined);
  });

  afterEach(() => {
    world.clear();
    setBuildingCollapsedCallback(undefined);
  });

  // ── Basic decay ────────────────────────────────────────────

  describe('basic decay', () => {
    it('reduces building durability by decayRate per tick', () => {
      const entity = createDecayableBuilding({ durability: 100, decayRate: 0.05 });
      decaySystem();
      expect(entity.durability!.current).toBeCloseTo(99.95, 5);
    });

    it('reduces durability by larger decayRate', () => {
      const entity = createDecayableBuilding({ durability: 100, decayRate: 5 });
      decaySystem();
      expect(entity.durability!.current).toBeCloseTo(95, 5);
    });

    it('accumulates decay over multiple ticks', () => {
      const entity = createDecayableBuilding({ durability: 100, decayRate: 1 });
      decaySystem();
      decaySystem();
      decaySystem();
      expect(entity.durability!.current).toBeCloseTo(97, 5);
    });

    it('decays with zero decay rate (no change)', () => {
      const entity = createDecayableBuilding({ durability: 100, decayRate: 0 });
      decaySystem();
      expect(entity.durability!.current).toBe(100);
    });
  });

  // ── Building collapse (durability reaches 0) ──────────────

  describe('building collapse', () => {
    it('clamps durability to 0 (not below)', () => {
      createDecayableBuilding({ durability: 2, decayRate: 5 });
      decaySystem();
      // 2 - 5 = -3, clamped to 0, entity removed from world
      expect(world.entities.length).toBe(0);
    });

    it('removes building from world when durability reaches 0', () => {
      createDecayableBuilding({ durability: 1, decayRate: 5 });
      expect(world.entities.length).toBe(1);
      decaySystem();
      expect(world.entities.length).toBe(0);
    });

    it('fires collapse callback when building is destroyed', () => {
      const callback = vi.fn<BuildingCollapsedCallback>();
      setBuildingCollapsedCallback(callback);

      createDecayableBuilding({
        gridX: 5,
        gridY: 10,
        defId: 'collective-farm-hq',
        durability: 1,
        decayRate: 5,
      });

      decaySystem();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(5, 10, 'collective-farm-hq', 1, 1);
    });

    it('fires collapse callback with correct position from entity', () => {
      const callback = vi.fn<BuildingCollapsedCallback>();
      setBuildingCollapsedCallback(callback);

      createDecayableBuilding({
        gridX: 15,
        gridY: 20,
        defId: 'power-station',
        durability: 0.01,
        decayRate: 1,
      });

      decaySystem();
      expect(callback).toHaveBeenCalledWith(15, 20, 'power-station', 1, 1);
    });

    it('fires collapse callback with -1,-1 when entity has no position', () => {
      const callback = vi.fn<BuildingCollapsedCallback>();
      setBuildingCollapsedCallback(callback);

      // Create entity without position component
      const entity: Entity = {
        building: {
          defId: 'mystery',
          powered: false,
          powerReq: 0,
          powerOutput: 0,
          housingCap: 0,
          pollution: 0,
          fear: 0,
        },
        durability: {
          current: 0.5,
          decayRate: 1,
        },
      };
      world.add(entity);

      decaySystem();
      expect(callback).toHaveBeenCalledWith(-1, -1, 'mystery', 1, 1);
    });

    it('does not fire callback when no callback is set', () => {
      // setBuildingCollapsedCallback(undefined) is already called in beforeEach
      createDecayableBuilding({ durability: 1, decayRate: 5 });
      // Should not throw
      expect(() => decaySystem()).not.toThrow();
      expect(world.entities.length).toBe(0);
    });

    it('does not fire callback when buildings survive', () => {
      const callback = vi.fn<BuildingCollapsedCallback>();
      setBuildingCollapsedCallback(callback);

      createDecayableBuilding({ durability: 100, decayRate: 0.01 });
      decaySystem();

      expect(callback).not.toHaveBeenCalled();
    });
  });

  // ── Multiple buildings decay independently ─────────────────

  describe('multiple buildings', () => {
    it('all buildings decay independently', () => {
      const b1 = createDecayableBuilding({ durability: 100, decayRate: 1 });
      const b2 = createDecayableBuilding({ durability: 50, decayRate: 2, gridX: 1 });
      const b3 = createDecayableBuilding({ durability: 80, decayRate: 0.5, gridX: 2 });

      decaySystem();

      expect(b1.durability!.current).toBeCloseTo(99, 5);
      expect(b2.durability!.current).toBeCloseTo(48, 5);
      expect(b3.durability!.current).toBeCloseTo(79.5, 5);
    });

    it('only collapses buildings that reach 0', () => {
      createDecayableBuilding({ durability: 100, decayRate: 0.01, gridX: 0 });
      createDecayableBuilding({ durability: 1, decayRate: 5, gridX: 1 });
      createDecayableBuilding({ durability: 100, decayRate: 0.01, gridX: 2 });

      expect(world.entities.length).toBe(3);
      decaySystem();
      expect(world.entities.length).toBe(2);
    });

    it('collapses multiple buildings in same tick', () => {
      const callback = vi.fn<BuildingCollapsedCallback>();
      setBuildingCollapsedCallback(callback);

      createDecayableBuilding({
        durability: 1,
        decayRate: 5,
        gridX: 0,
        gridY: 0,
        defId: 'collective-farm-hq',
      });
      createDecayableBuilding({
        durability: 1,
        decayRate: 5,
        gridX: 3,
        gridY: 3,
        defId: 'power-station',
      });

      decaySystem();

      expect(callback).toHaveBeenCalledTimes(2);
      expect(world.entities.length).toBe(0);
    });

    it('surviving buildings continue to decay after collapse of others', () => {
      const survivor = createDecayableBuilding({ durability: 100, decayRate: 1, gridX: 0 });
      createDecayableBuilding({ durability: 0.5, decayRate: 1, gridX: 1 });

      decaySystem(); // Second building collapses
      expect(world.entities.length).toBe(1);
      expect(survivor.durability!.current).toBeCloseTo(99, 5);

      decaySystem(); // Survivor continues
      expect(survivor.durability!.current).toBeCloseTo(98, 5);
    });
  });

  // ── Edge cases ─────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles no buildings in world', () => {
      expect(() => decaySystem()).not.toThrow();
    });

    it('building with durability exactly 0 before tick is removed', () => {
      // durability.current = 0, decayRate = 1
      // After tick: current = 0 - 1 = -1, clamped to 0, removed
      createDecayableBuilding({ durability: 0, decayRate: 1 });
      decaySystem();
      expect(world.entities.length).toBe(0);
    });

    it('building with very small durability collapses', () => {
      createDecayableBuilding({ durability: 0.001, decayRate: 0.01 });
      decaySystem();
      expect(world.entities.length).toBe(0);
    });

    it('building with very small decay rate still decays', () => {
      const entity = createDecayableBuilding({ durability: 100, decayRate: 0.0001 });
      decaySystem();
      expect(entity.durability!.current).toBeLessThan(100);
      expect(entity.durability!.current).toBeCloseTo(99.9999, 4);
    });

    it('setBuildingCollapsedCallback can be cleared', () => {
      const callback = vi.fn<BuildingCollapsedCallback>();
      setBuildingCollapsedCallback(callback);
      setBuildingCollapsedCallback(undefined);

      createDecayableBuilding({ durability: 1, decayRate: 5 });
      decaySystem();

      expect(callback).not.toHaveBeenCalled();
    });

    it('setBuildingCollapsedCallback can be replaced', () => {
      const callback1 = vi.fn<BuildingCollapsedCallback>();
      const callback2 = vi.fn<BuildingCollapsedCallback>();

      setBuildingCollapsedCallback(callback1);
      setBuildingCollapsedCallback(callback2);

      createDecayableBuilding({ durability: 1, decayRate: 5, defId: 'gulag-admin' });
      decaySystem();

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('entities without position report -1,-1 on collapse', () => {
      const callback = vi.fn<BuildingCollapsedCallback>();
      setBuildingCollapsedCallback(callback);

      const entity: Entity = {
        building: {
          defId: 'ghost-building',
          powered: false,
          powerReq: 0,
          powerOutput: 0,
          housingCap: 0,
          pollution: 0,
          fear: 0,
        },
        durability: { current: 0.1, decayRate: 1 },
      };
      world.add(entity);

      decaySystem();
      expect(callback).toHaveBeenCalledWith(-1, -1, 'ghost-building', 1, 1);
    });
  });

  // ── Durability never goes below 0 ─────────────────────────

  describe('durability floor', () => {
    it('durability is clamped to 0 on collapse', () => {
      // We can verify via the callback — the entity is removed,
      // but before removal the code sets current = 0
      const callback = vi.fn<BuildingCollapsedCallback>();
      setBuildingCollapsedCallback(callback);

      createDecayableBuilding({ durability: 3, decayRate: 10 });
      // Before tick: current = 3
      // After subtract: current = 3 - 10 = -7 → clamped to 0
      decaySystem();

      // Entity was removed from world
      expect(world.entities.length).toBe(0);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
});

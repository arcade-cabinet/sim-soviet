import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAP_OPTIONS,
  MAP_SIZES,
  type MapGenerationOptions,
  MapSystem,
  type TerrainType,
} from '@/game/map';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeMap(overrides: Partial<MapGenerationOptions> = {}): MapSystem {
  const map = new MapSystem({ ...DEFAULT_MAP_OPTIONS, ...overrides });
  map.generate();
  return map;
}

function countType(map: MapSystem, type: TerrainType): number {
  return map.getCellsOfType(type).length;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('MapSystem', () => {
  describe('deterministic generation', () => {
    it('produces identical terrain for the same seed', () => {
      const a = makeMap({ seed: 'glorious-frozen-tractor' });
      const b = makeMap({ seed: 'glorious-frozen-tractor' });

      const size = a.getSize();
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const cellA = a.getCell(x, y)!;
          const cellB = b.getCell(x, y)!;
          expect(cellA.type).toBe(cellB.type);
          expect(cellA.elevation).toBe(cellB.elevation);
          expect(cellA.movementCost).toBe(cellB.movementCost);
          expect(cellA.buildable).toBe(cellB.buildable);
        }
      }
    });

    it('produces different terrain for different seeds', () => {
      const a = makeMap({ seed: 'glorious-frozen-tractor' });
      const b = makeMap({ seed: 'dialectical-muddy-potato' });

      const size = a.getSize();
      let differences = 0;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (a.getCell(x, y)!.type !== b.getCell(x, y)!.type) {
            differences++;
          }
        }
      }
      // Maps with different seeds should differ in at least some cells
      expect(differences).toBeGreaterThan(0);
    });
  });

  describe('center 5x5 protection', () => {
    it('always has grass in the center 5x5 area', () => {
      const map = makeMap({
        seed: 'iron-siberian-gulag',
        forestDensity: 0.5,
        mountainDensity: 0.1,
        marshDensity: 0.2,
        riverCount: 2,
      });

      const center = Math.floor(map.getSize() / 2);
      for (let y = center - 2; y <= center + 2; y++) {
        for (let x = center - 2; x <= center + 2; x++) {
          const cell = map.getCell(x, y);
          expect(cell).not.toBeNull();
          expect(cell!.type).toBe('grass');
          expect(cell!.buildable).toBe(true);
        }
      }
    });

    it('center is grass even with extreme densities', () => {
      const map = makeMap({
        seed: 'extreme-test-seed',
        forestDensity: 0.5,
        mountainDensity: 0.1,
        marshDensity: 0.2,
        riverCount: 2,
        size: 'small',
      });

      const center = Math.floor(map.getSize() / 2);
      for (let y = center - 2; y <= center + 2; y++) {
        for (let x = center - 2; x <= center + 2; x++) {
          expect(map.getCell(x, y)!.type).toBe('grass');
        }
      }
    });
  });

  describe('rivers', () => {
    it('generates river cells when riverCount > 0', () => {
      const map = makeMap({ seed: 'river-test', riverCount: 1 });
      const riverCells = countType(map, 'river');
      expect(riverCells).toBeGreaterThan(0);
    });

    it('generates no rivers when riverCount is 0', () => {
      const map = makeMap({ seed: 'no-rivers', riverCount: 0 });
      const riverCells = countType(map, 'river');
      expect(riverCells).toBe(0);
    });

    it('river cells connect opposite edges', () => {
      const map = makeMap({ seed: 'river-connect', riverCount: 1 });
      const cells = map.getCellsOfType('river');

      if (cells.length === 0) return; // Skip if no river (shouldn't happen but be safe)

      const size = map.getSize();
      const touchesTop = cells.some((c) => c.y === 0);
      const touchesBottom = cells.some((c) => c.y === size - 1);
      const touchesLeft = cells.some((c) => c.x === 0);
      const touchesRight = cells.some((c) => c.x === size - 1);

      // River should connect opposite edges (either top-bottom or left-right)
      const connectsVertically = touchesTop && touchesBottom;
      const connectsHorizontally = touchesLeft && touchesRight;
      expect(connectsVertically || connectsHorizontally).toBe(true);
    });

    it('river cells are impassable', () => {
      const map = makeMap({ seed: 'river-impassable', riverCount: 1 });
      const cells = map.getCellsOfType('river');
      for (const { x, y } of cells) {
        expect(map.getMovementCost(x, y)).toBe(Infinity);
        expect(map.getCell(x, y)!.buildable).toBe(false);
      }
    });
  });

  describe('terrain placement', () => {
    it('generates mountains when mountainDensity > 0', () => {
      const map = makeMap({ seed: 'mountains', mountainDensity: 0.08 });
      expect(countType(map, 'mountain')).toBeGreaterThan(0);
    });

    it('generates forests when forestDensity > 0', () => {
      const map = makeMap({ seed: 'forests', forestDensity: 0.2 });
      expect(countType(map, 'forest')).toBeGreaterThan(0);
    });

    it('generates marsh when marshDensity > 0', () => {
      const map = makeMap({ seed: 'marshes', marshDensity: 0.1, riverCount: 1 });
      expect(countType(map, 'marsh')).toBeGreaterThan(0);
    });

    it('generates no mountains when density is 0', () => {
      const map = makeMap({ seed: 'flat', mountainDensity: 0 });
      expect(countType(map, 'mountain')).toBe(0);
    });

    it('generates no forests when density is 0', () => {
      const map = makeMap({ seed: 'barren', forestDensity: 0 });
      expect(countType(map, 'forest')).toBe(0);
    });
  });

  describe('isBuildable', () => {
    it('returns true for grass cells', () => {
      const map = makeMap({ seed: 'buildable' });
      const center = Math.floor(map.getSize() / 2);
      // Center is always grass
      expect(map.isBuildable(center, center)).toBe(true);
    });

    it('returns false for mountain cells', () => {
      const map = makeMap({ seed: 'unbuildable', mountainDensity: 0.08 });
      const mountains = map.getCellsOfType('mountain');
      if (mountains.length > 0) {
        const m = mountains[0]!;
        expect(map.isBuildable(m.x, m.y)).toBe(false);
      }
    });

    it('returns false for river cells', () => {
      const map = makeMap({ seed: 'river-build', riverCount: 1 });
      const rivers = map.getCellsOfType('river');
      if (rivers.length > 0) {
        const r = rivers[0]!;
        expect(map.isBuildable(r.x, r.y)).toBe(false);
      }
    });

    it('returns false for forest cells', () => {
      const map = makeMap({ seed: 'forest-build', forestDensity: 0.2 });
      const forests = map.getCellsOfType('forest');
      if (forests.length > 0) {
        const f = forests[0]!;
        expect(map.isBuildable(f.x, f.y)).toBe(false);
      }
    });

    it('returns true for marsh cells (but slow)', () => {
      const map = makeMap({ seed: 'marsh-build', marshDensity: 0.1, riverCount: 1 });
      const marshes = map.getCellsOfType('marsh');
      if (marshes.length > 0) {
        const m = marshes[0]!;
        expect(map.isBuildable(m.x, m.y)).toBe(true);
        expect(map.getCell(m.x, m.y)!.movementCost).toBe(1.5);
      }
    });

    it('checks full footprint for multi-tile buildings', () => {
      const map = makeMap({
        seed: 'footprint-test',
        riverCount: 0,
        mountainDensity: 0,
        forestDensity: 0,
        marshDensity: 0,
      });
      const center = Math.floor(map.getSize() / 2);
      // All grass, 3x3 should fit
      expect(map.isBuildable(center, center, 3, 3)).toBe(true);
    });

    it('returns false for out-of-bounds positions', () => {
      const map = makeMap({ seed: 'oob' });
      expect(map.isBuildable(-1, 0)).toBe(false);
      expect(map.isBuildable(0, -1)).toBe(false);
      expect(map.isBuildable(map.getSize(), 0)).toBe(false);
    });

    it('returns false if footprint extends out of bounds', () => {
      const map = makeMap({ seed: 'edge' });
      const last = map.getSize() - 1;
      // 2x2 footprint at last cell would go out of bounds
      expect(map.isBuildable(last, last, 2, 2)).toBe(false);
    });
  });

  describe('clearForest', () => {
    it('converts forest to grass and returns timber', () => {
      const map = makeMap({ seed: 'clear-forest', forestDensity: 0.3 });
      const forests = map.getCellsOfType('forest');
      expect(forests.length).toBeGreaterThan(0);

      const f = forests[0]!;
      const timber = map.clearForest(f.x, f.y);
      expect(timber).toBeGreaterThan(0);
      expect(map.getCell(f.x, f.y)!.type).toBe('grass');
      expect(map.getCell(f.x, f.y)!.buildable).toBe(true);
    });

    it('returns 0 for non-forest cells', () => {
      const map = makeMap({ seed: 'clear-grass' });
      const center = Math.floor(map.getSize() / 2);
      expect(map.clearForest(center, center)).toBe(0);
    });

    it('returns 0 for out-of-bounds', () => {
      const map = makeMap({ seed: 'oob-clear' });
      expect(map.clearForest(-1, -1)).toBe(0);
    });
  });

  describe('buildBridge', () => {
    it('converts river to road and returns true', () => {
      const map = makeMap({ seed: 'bridge', riverCount: 1 });
      const rivers = map.getCellsOfType('river');
      expect(rivers.length).toBeGreaterThan(0);

      const r = rivers[0]!;
      const result = map.buildBridge(r.x, r.y);
      expect(result).toBe(true);
      expect(map.getCell(r.x, r.y)!.type).toBe('road');
      expect(map.getMovementCost(r.x, r.y)).toBe(0.7);
    });

    it('returns false for non-river cells', () => {
      const map = makeMap({ seed: 'no-bridge' });
      const center = Math.floor(map.getSize() / 2);
      expect(map.buildBridge(center, center)).toBe(false);
    });

    it('returns false for out-of-bounds', () => {
      const map = makeMap({ seed: 'oob-bridge' });
      expect(map.buildBridge(-1, -1)).toBe(false);
    });
  });

  describe('map sizes', () => {
    it('creates a small map (20x20)', () => {
      const map = makeMap({ seed: 'small', size: 'small' });
      expect(map.getSize()).toBe(MAP_SIZES.small);
      expect(map.getCell(0, 0)).not.toBeNull();
      expect(map.getCell(19, 19)).not.toBeNull();
      expect(map.getCell(20, 20)).toBeNull();
    });

    it('creates a medium map (30x30)', () => {
      const map = makeMap({ seed: 'medium', size: 'medium' });
      expect(map.getSize()).toBe(MAP_SIZES.medium);
    });

    it('creates a large map (50x50)', () => {
      const map = makeMap({ seed: 'large', size: 'large' });
      expect(map.getSize()).toBe(MAP_SIZES.large);
      expect(map.getCell(49, 49)).not.toBeNull();
      expect(map.getCell(50, 50)).toBeNull();
    });
  });

  describe('getMovementCost', () => {
    it('returns correct costs per terrain type', () => {
      const map = makeMap({
        seed: 'costs',
        riverCount: 1,
        mountainDensity: 0.05,
        forestDensity: 0.1,
        marshDensity: 0.05,
      });

      // grass
      const center = Math.floor(map.getSize() / 2);
      expect(map.getMovementCost(center, center)).toBe(1.0);

      // Verify specific types if they exist
      const mountains = map.getCellsOfType('mountain');
      if (mountains.length > 0) {
        expect(map.getMovementCost(mountains[0]!.x, mountains[0]!.y)).toBe(Infinity);
      }

      const rivers = map.getCellsOfType('river');
      if (rivers.length > 0) {
        expect(map.getMovementCost(rivers[0]!.x, rivers[0]!.y)).toBe(Infinity);
      }

      const marshes = map.getCellsOfType('marsh');
      if (marshes.length > 0) {
        expect(map.getMovementCost(marshes[0]!.x, marshes[0]!.y)).toBe(1.5);
      }

      const forests = map.getCellsOfType('forest');
      if (forests.length > 0) {
        expect(map.getMovementCost(forests[0]!.x, forests[0]!.y)).toBe(1.3);
      }
    });

    it('returns Infinity for out-of-bounds', () => {
      const map = makeMap({ seed: 'oob-cost' });
      expect(map.getMovementCost(-1, 0)).toBe(Infinity);
    });
  });

  describe('getCellsOfType', () => {
    it('returns all cells of the requested type', () => {
      const map = makeMap({ seed: 'cells-query', forestDensity: 0.2 });
      const forests = map.getCellsOfType('forest');
      for (const { x, y } of forests) {
        expect(map.getCell(x, y)!.type).toBe('forest');
      }
    });

    it('returns empty array for absent type', () => {
      const map = makeMap({
        seed: 'no-water',
        riverCount: 0,
        mountainDensity: 0,
        forestDensity: 0,
        marshDensity: 0,
      });
      expect(map.getCellsOfType('water')).toEqual([]);
      expect(map.getCellsOfType('river')).toEqual([]);
    });
  });

  describe('serialization', () => {
    it('roundtrips correctly', () => {
      const original = makeMap({
        seed: 'serialize-test',
        riverCount: 1,
        forestDensity: 0.15,
        mountainDensity: 0.05,
      });

      const serialized = original.serialize();
      const restored = MapSystem.deserialize(serialized);

      expect(restored.getSize()).toBe(original.getSize());

      const size = original.getSize();
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const a = original.getCell(x, y)!;
          const b = restored.getCell(x, y)!;
          expect(b.type).toBe(a.type);
          expect(b.elevation).toBe(a.elevation);
          expect(b.buildable).toBe(a.buildable);
          expect(b.movementCost).toBe(a.movementCost);
          expect(b.timberYield).toBe(a.timberYield);
          expect(b.features).toEqual(a.features);
        }
      }
    });

    it('preserves options through serialization', () => {
      const opts: MapGenerationOptions = {
        size: 'small',
        seed: 'opts-test',
        riverCount: 2,
        forestDensity: 0.3,
        marshDensity: 0.1,
        mountainDensity: 0.08,
      };
      const original = new MapSystem(opts);
      original.generate();

      const restored = MapSystem.deserialize(original.serialize());
      expect(restored.getOptions()).toEqual(opts);
    });

    it('throws on invalid data', () => {
      expect(() => MapSystem.deserialize(null)).toThrow();
      expect(() => MapSystem.deserialize({})).toThrow();
      expect(() => MapSystem.deserialize({ version: 2 })).toThrow();
    });
  });

  describe('getCell', () => {
    it('returns null for out-of-bounds', () => {
      const map = makeMap({ seed: 'bounds' });
      expect(map.getCell(-1, 0)).toBeNull();
      expect(map.getCell(0, -1)).toBeNull();
      expect(map.getCell(map.getSize(), 0)).toBeNull();
      expect(map.getCell(0, map.getSize())).toBeNull();
    });

    it('returns a valid cell for in-bounds', () => {
      const map = makeMap({ seed: 'in-bounds' });
      const cell = map.getCell(5, 5);
      expect(cell).not.toBeNull();
      expect(cell!.type).toBeDefined();
      expect(cell!.elevation).toBeDefined();
      expect(cell!.buildable).toBeDefined();
      expect(cell!.movementCost).toBeDefined();
    });
  });

  describe('terrain properties', () => {
    it('forest cells have timberYield', () => {
      const map = makeMap({ seed: 'timber', forestDensity: 0.3 });
      const forests = map.getCellsOfType('forest');
      for (const { x, y } of forests) {
        const cell = map.getCell(x, y)!;
        expect(cell.timberYield).toBeGreaterThanOrEqual(5);
        expect(cell.timberYield).toBeLessThanOrEqual(15);
      }
    });

    it('forest cells have feature IDs', () => {
      const map = makeMap({ seed: 'features', forestDensity: 0.3 });
      const forests = map.getCellsOfType('forest');
      for (const { x, y } of forests) {
        const cell = map.getCell(x, y)!;
        expect(cell.features.length).toBeGreaterThan(0);
      }
    });

    it('mountain cells have elevation > 0', () => {
      const map = makeMap({ seed: 'elevation', mountainDensity: 0.08 });
      const mountains = map.getCellsOfType('mountain');
      for (const { x, y } of mountains) {
        expect(map.getCell(x, y)!.elevation).toBeGreaterThan(0);
      }
    });
  });
});

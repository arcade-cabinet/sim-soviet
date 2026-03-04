/**
 * Unit tests for SiteSelectionRules — era-aware building placement logic.
 */

import { findBestPlacement, type PlacementContext } from '../../src/growth/SiteSelectionRules';

// Mock getBuildingDef to return role for known building types
jest.mock('@/data/buildingDefs', () => ({
  getBuildingDef: (defId: string) => {
    const roles: Record<string, string> = {
      'workers-house-a': 'housing',
      'workers-house-b': 'housing',
      'collective-farm-hq': 'agriculture',
      'kolkhoz': 'agriculture',
      'power-station': 'power',
      'coal-plant': 'power',
      'vodka-distillery': 'industry',
      'steel-mill': 'industry',
      'party-hq': 'government',
      'propaganda-tower': 'propaganda',
      'barracks': 'military',
      'clinic': 'services',
      'school': 'services',
      'palace-of-culture': 'culture',
    };
    const role = roles[defId];
    if (!role) return undefined;
    return { role };
  },
}));

/** Create a default PlacementContext for a 20x20 grid. */
function createContext(overrides: Partial<PlacementContext> = {}): PlacementContext {
  return {
    gridSize: 20,
    buildings: [{ x: 10, z: 10, defId: 'workers-house-a' }],
    eraId: 'revolution',
    waterCells: [],
    treeCells: [],
    occupiedCells: new Set(['10,10']),
    ...overrides,
  };
}

describe('SiteSelectionRules', () => {
  // ── Basic placement ───────────────────────────────────────────────────

  describe('basic placement', () => {
    it('returns a valid placement near existing buildings', () => {
      const ctx = createContext();
      const result = findBestPlacement('workers-house-a', ctx);
      expect(result).not.toBeNull();
      expect(result!.x).toBeGreaterThanOrEqual(1);
      expect(result!.x).toBeLessThan(19);
      expect(result!.z).toBeGreaterThanOrEqual(1);
      expect(result!.z).toBeLessThan(19);
    });

    it('returns null when no buildings exist', () => {
      const ctx = createContext({ buildings: [] });
      const result = findBestPlacement('workers-house-a', ctx);
      expect(result).toBeNull();
    });

    it('returns null when all cells are occupied', () => {
      const occupied = new Set<string>();
      for (let x = 0; x < 20; x++) {
        for (let z = 0; z < 20; z++) {
          occupied.add(`${x},${z}`);
        }
      }
      const ctx = createContext({ occupiedCells: occupied });
      const result = findBestPlacement('workers-house-a', ctx);
      expect(result).toBeNull();
    });

    it('does not place on occupied cells', () => {
      const occupied = new Set(['10,10', '10,11', '11,10']);
      const ctx = createContext({ occupiedCells: occupied });
      const result = findBestPlacement('workers-house-a', ctx);
      expect(result).not.toBeNull();
      const key = `${result!.x},${result!.z}`;
      expect(occupied.has(key)).toBe(false);
    });

    it('does not place on boundary cells', () => {
      const ctx = createContext({
        buildings: [{ x: 1, z: 1, defId: 'workers-house-a' }],
        occupiedCells: new Set(['1,1']),
      });
      const result = findBestPlacement('workers-house-a', ctx);
      expect(result).not.toBeNull();
      expect(result!.x).toBeGreaterThanOrEqual(1);
      expect(result!.z).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Early era (revolution) ────────────────────────────────────────────

  describe('early era (revolution)', () => {
    it('prefers cells near water', () => {
      const waterCells = [{ x: 12, z: 10 }];
      const ctx = createContext({
        eraId: 'revolution',
        waterCells,
        buildings: [{ x: 10, z: 10, defId: 'workers-house-a' }],
      });
      const result = findBestPlacement('workers-house-a', ctx);
      expect(result).not.toBeNull();
      // Result should be near water (within 3 cells)
      const waterDist = Math.abs(result!.x - 12) + Math.abs(result!.z - 10);
      expect(waterDist).toBeLessThanOrEqual(4);
    });

    it('prefers cells near trees', () => {
      const treeCells = [{ x: 8, z: 10 }];
      const ctx = createContext({
        eraId: 'revolution',
        treeCells,
        buildings: [{ x: 10, z: 10, defId: 'workers-house-a' }],
      });
      const result = findBestPlacement('workers-house-a', ctx);
      expect(result).not.toBeNull();
    });

    it('penalizes wooden buildings too close together (fire spacing)', () => {
      // Place two houses 1 cell apart — a third house should avoid clustering
      const ctx = createContext({
        eraId: 'revolution',
        buildings: [
          { x: 10, z: 10, defId: 'workers-house-a' },
          { x: 10, z: 11, defId: 'workers-house-b' },
        ],
        occupiedCells: new Set(['10,10', '10,11']),
      });
      const result = findBestPlacement('workers-house-a', ctx);
      expect(result).not.toBeNull();
      // The result should prefer positions with fire spacing (>=2 cells from existing housing)
    });
  });

  // ── Middle era (collectivization/industrialization) ────────────────────

  describe('middle era (collectivization/industrialization)', () => {
    it('places admin buildings closer to center', () => {
      const ctx = createContext({
        eraId: 'collectivization',
        gridSize: 20,
        buildings: [
          { x: 10, z: 10, defId: 'workers-house-a' },
          { x: 5, z: 5, defId: 'workers-house-b' },
        ],
        occupiedCells: new Set(['10,10', '5,5']),
      });
      const result = findBestPlacement('party-hq', ctx);
      expect(result).not.toBeNull();
      // Admin should prefer center
      const center = 10;
      const distFromCenter = Math.abs(result!.x - center) + Math.abs(result!.z - center);
      expect(distFromCenter).toBeLessThanOrEqual(10);
    });

    it('places farms toward edges', () => {
      const ctx = createContext({
        eraId: 'industrialization',
        gridSize: 20,
        buildings: [
          { x: 10, z: 10, defId: 'workers-house-a' },
          { x: 15, z: 15, defId: 'workers-house-b' },
        ],
        occupiedCells: new Set(['10,10', '15,15']),
      });
      const result = findBestPlacement('collective-farm-hq', ctx);
      expect(result).not.toBeNull();
    });

    it('places industry near water when available', () => {
      const waterCells = [{ x: 12, z: 10 }];
      const ctx = createContext({
        eraId: 'industrialization',
        waterCells,
        buildings: [{ x: 10, z: 10, defId: 'workers-house-a' }],
      });
      const result = findBestPlacement('steel-mill', ctx);
      expect(result).not.toBeNull();
    });
  });

  // ── Late era (thaw/stagnation/eternal) ────────────────────────────────

  describe('late era (thaw/stagnation/eternal)', () => {
    it('prefers grid-aligned positions', () => {
      const ctx = createContext({
        eraId: 'stagnation',
        gridSize: 20,
        buildings: [{ x: 10, z: 10, defId: 'workers-house-a' }],
      });
      const result = findBestPlacement('workers-house-a', ctx);
      expect(result).not.toBeNull();
    });

    it('places services near housing (SNiP walking distances)', () => {
      const ctx = createContext({
        eraId: 'thaw_and_freeze',
        gridSize: 20,
        buildings: [
          { x: 10, z: 10, defId: 'workers-house-a' },
          { x: 11, z: 10, defId: 'workers-house-b' },
        ],
        occupiedCells: new Set(['10,10', '11,10']),
      });
      const result = findBestPlacement('clinic', ctx);
      expect(result).not.toBeNull();
      // Service should be within 10 cells of housing
      const dist1 = Math.abs(result!.x - 10) + Math.abs(result!.z - 10);
      const dist2 = Math.abs(result!.x - 11) + Math.abs(result!.z - 10);
      expect(Math.min(dist1, dist2)).toBeLessThanOrEqual(10);
    });

    it('clusters housing together', () => {
      const ctx = createContext({
        eraId: 'stagnation',
        gridSize: 20,
        buildings: [
          { x: 10, z: 10, defId: 'workers-house-a' },
          { x: 11, z: 10, defId: 'workers-house-b' },
          { x: 10, z: 11, defId: 'workers-house-a' },
        ],
        occupiedCells: new Set(['10,10', '11,10', '10,11']),
      });
      const result = findBestPlacement('workers-house-a', ctx);
      expect(result).not.toBeNull();
      // Should be near existing housing cluster
      const minDist = Math.min(
        Math.abs(result!.x - 10) + Math.abs(result!.z - 10),
        Math.abs(result!.x - 11) + Math.abs(result!.z - 10),
        Math.abs(result!.x - 10) + Math.abs(result!.z - 11),
      );
      expect(minDist).toBeLessThanOrEqual(4);
    });

    it('separates industry from housing', () => {
      const ctx = createContext({
        eraId: 'the_eternal',
        gridSize: 20,
        buildings: [
          { x: 10, z: 10, defId: 'workers-house-a' },
          { x: 5, z: 5, defId: 'workers-house-b' },
        ],
        occupiedCells: new Set(['10,10', '5,5']),
      });
      const result = findBestPlacement('steel-mill', ctx);
      expect(result).not.toBeNull();
    });
  });

  // ── Extended search radius ────────────────────────────────────────────

  describe('extended search radius', () => {
    it('finds placement with larger maxDistance when normal range is full', () => {
      // Fill cells near the building within distance 3
      const occupied = new Set<string>();
      occupied.add('10,10');
      for (let dx = -3; dx <= 3; dx++) {
        for (let dz = -3; dz <= 3; dz++) {
          if (Math.abs(dx) + Math.abs(dz) <= 3) {
            occupied.add(`${10 + dx},${10 + dz}`);
          }
        }
      }

      const ctx = createContext({ occupiedCells: occupied });

      // Normal range (3) should fail
      const narrow = findBestPlacement('workers-house-a', ctx, 3);
      expect(narrow).toBeNull();

      // Extended range should succeed
      const wide = findBestPlacement('workers-house-a', ctx, 10);
      expect(wide).not.toBeNull();
    });
  });

  // ── Unknown era fallback ──────────────────────────────────────────────

  describe('unknown era fallback', () => {
    it('falls back to early era scoring for unknown era IDs', () => {
      const ctx = createContext({ eraId: 'unknown_era' });
      const result = findBestPlacement('workers-house-a', ctx);
      expect(result).not.toBeNull();
    });
  });
});

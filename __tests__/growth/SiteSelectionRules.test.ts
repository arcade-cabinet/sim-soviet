/**
 * Unit tests for SiteSelectionRules — brutalist building placement logic.
 */

import { findBestPlacement, type PlacementContext } from '../../src/growth/SiteSelectionRules';

// Mock getBuildingDef to return role for known building types
jest.mock('@/data/buildingDefs', () => ({
  getBuildingDef: (defId: string) => {
    const roles: Record<string, string> = {
      'workers-house-a': 'housing',
      'workers-house-b': 'housing',
      'collective-farm-hq': 'agriculture',
      kolkhoz: 'agriculture',
      'power-station': 'power',
      'coal-plant': 'power',
      'vodka-distillery': 'industry',
      'steel-mill': 'industry',
      'government-hq': 'government',
      'party-hq': 'government',
      'propaganda-tower': 'propaganda',
      clinic: 'services',
      school: 'services',
      'culture-center': 'culture',
      'local-store': 'services',
    };
    return roles[defId] ? { role: roles[defId] } : undefined;
  },
}));

function createContext(overrides: Partial<PlacementContext> = {}): PlacementContext {
  return {
    gridSize: 20,
    buildings: [{ x: 10, z: 10, defId: 'workers-house-a' }],
    eraId: 'revolution',
    waterCells: [],
    treeCells: [],
    marshCells: [],
    mountainCells: [],
    occupiedCells: new Set(['10,10']),
    ...overrides,
  };
}

describe('SiteSelectionRules (Brutalist)', () => {
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

    it('returns the center when no buildings exist (e.g. for HQ bootstrap)', () => {
      const ctx = createContext({ buildings: [], occupiedCells: new Set() });
      const result = findBestPlacement('government-hq', ctx);
      expect(result).not.toBeNull();
      expect(result!.x).toBe(10);
      expect(result!.z).toBe(10);
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
  });

  describe('The State (HQ)', () => {
    it('aggressively prefers the center of the map', () => {
      const ctx = createContext({
        gridSize: 20,
        buildings: [
          { x: 10, z: 10, defId: 'workers-house-a' },
          { x: 5, z: 5, defId: 'workers-house-b' },
        ],
        occupiedCells: new Set(['10,10', '5,5']),
      });
      const result = findBestPlacement('government-hq', ctx);
      expect(result).not.toBeNull();

      // Center is 10,10 (occupied). It should pick something right next to it.
      const distFromCenter = Math.abs(result!.x - 10) + Math.abs(result!.z - 10);
      expect(distFromCenter).toBe(1);
    });
  });

  describe('Production', () => {
    it('industry seeks out resource tiles (like water)', () => {
      const waterCells = [{ x: 12, z: 10 }];
      const ctx = createContext({
        waterCells,
        buildings: [{ x: 10, z: 10, defId: 'workers-house-a' }],
      });
      const result = findBestPlacement('steel-mill', ctx);
      expect(result).not.toBeNull();
      const waterDist = Math.abs(result!.x - 12) + Math.abs(result!.z - 10);
      // It should snuggle right up to the water if possible
      expect(waterDist).toBeLessThanOrEqual(2);
    });
  });

  describe('Housing', () => {
    it('housing avoids wasting resource tiles', () => {
      const treeCells = [{ x: 11, z: 10 }];
      const ctx = createContext({
        treeCells,
        buildings: [{ x: 10, z: 10, defId: 'workers-house-a' }],
        occupiedCells: new Set(['10,10']),
      });

      const result = findBestPlacement('workers-house-a', ctx);
      expect(result).not.toBeNull();

      // Housing should actively avoid placing itself AT 11,10 (the tree cell)
      expect(result!.x === 11 && result!.z === 10).toBe(false);
    });
  });

  describe('extended search radius', () => {
    it('finds placement with larger maxDistance when normal range is full', () => {
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

      const narrow = findBestPlacement('workers-house-a', ctx, 3);
      expect(narrow).toBeNull();

      const wide = findBestPlacement('workers-house-a', ctx, 10);
      expect(wide).not.toBeNull();
    });
  });
});

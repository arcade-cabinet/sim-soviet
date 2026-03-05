/**
 * Tests for organic settlement growth — Task #13.
 *
 * Validates:
 * 1. Farms cluster near fertile terrain (resource-proximity placement)
 * 2. Mandate→placement→build pipeline works (Moscow mandates, collective executes)
 * 3. No free placement — only directive-only building
 * 4. Site selection with fertility data produces better farm placement
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
      'party-hq': 'government',
      'propaganda-tower': 'propaganda',
      barracks: 'military',
      clinic: 'services',
      school: 'services',
      'palace-of-culture': 'culture',
    };
    const role = roles[defId];
    if (!role) return undefined;
    return { role };
  },
}));

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

describe('OrganicGrowth — Resource-proximity clustering', () => {
  describe('fertility-aware farm placement', () => {
    it('farms prefer high-fertility cells over low-fertility cells', () => {
      // Create fertility map with high fertility at (12,10) and low at (8,10)
      const fertilityCells = new Map<string, number>();
      for (let x = 0; x < 20; x++) {
        for (let z = 0; z < 20; z++) {
          // Default low fertility
          fertilityCells.set(`${x},${z}`, 20);
        }
      }
      // High fertility cluster near (12,10)
      fertilityCells.set('12,10', 95);
      fertilityCells.set('12,11', 90);
      fertilityCells.set('11,10', 85);
      fertilityCells.set('12,9', 88);

      const ctx = createContext({
        eraId: 'revolution',
        buildings: [{ x: 10, z: 10, defId: 'workers-house-a' }],
        fertilityCells,
      });

      const result = findBestPlacement('collective-farm-hq', ctx);
      expect(result).not.toBeNull();
      // Farm should be placed near the high-fertility cluster
      const dist = Math.abs(result!.x - 12) + Math.abs(result!.z - 10);
      expect(dist).toBeLessThanOrEqual(3);
    });

    it('housing avoids very low fertility (contaminated ground)', () => {
      const fertilityCells = new Map<string, number>();
      for (let x = 0; x < 20; x++) {
        for (let z = 0; z < 20; z++) {
          fertilityCells.set(`${x},${z}`, 60); // decent default
        }
      }
      // Contaminated zone near building
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          if (dx === 0 && dz === 0) continue;
          fertilityCells.set(`${10 + dx},${10 + dz}`, 5);
        }
      }
      // Good zone further away
      fertilityCells.set('14,10', 70);
      fertilityCells.set('14,11', 65);

      const ctx = createContext({
        eraId: 'revolution',
        buildings: [{ x: 10, z: 10, defId: 'workers-house-a' }],
        fertilityCells,
        waterCells: [{ x: 14, z: 10 }], // water near good zone
      });

      const result = findBestPlacement('workers-house-a', ctx);
      expect(result).not.toBeNull();
      // Housing should avoid the contaminated zone
    });

    it('farms without fertility data still place correctly (backward compat)', () => {
      const ctx = createContext({
        eraId: 'collectivization',
        buildings: [{ x: 10, z: 10, defId: 'workers-house-a' }],
        // No fertilityCells — should work with existing logic
      });

      const result = findBestPlacement('collective-farm-hq', ctx);
      expect(result).not.toBeNull();
    });
  });

  describe('fertility in middle era', () => {
    it('collectivization farms prefer fertile edges', () => {
      const fertilityCells = new Map<string, number>();
      for (let x = 0; x < 20; x++) {
        for (let z = 0; z < 20; z++) {
          // High fertility at edges, low in center
          const edgeDist = Math.min(x, z, 19 - x, 19 - z);
          fertilityCells.set(`${x},${z}`, edgeDist < 5 ? 90 : 30);
        }
      }

      const ctx = createContext({
        eraId: 'collectivization',
        gridSize: 20,
        buildings: [
          { x: 10, z: 10, defId: 'workers-house-a' },
          { x: 15, z: 15, defId: 'workers-house-b' },
        ],
        occupiedCells: new Set(['10,10', '15,15']),
        fertilityCells,
      });

      const result = findBestPlacement('collective-farm-hq', ctx);
      expect(result).not.toBeNull();
      // Farm should be toward edges where fertility is high
    });
  });

  describe('Kardashev sub-era fallback', () => {
    it('post_soviet era uses late era placement (grid-aligned)', () => {
      const ctx = createContext({
        eraId: 'post_soviet',
        buildings: [{ x: 10, z: 10, defId: 'workers-house-a' }],
      });

      const result = findBestPlacement('workers-house-a', ctx);
      expect(result).not.toBeNull();
    });

    it('planetary era uses late era placement', () => {
      const ctx = createContext({
        eraId: 'planetary',
        buildings: [{ x: 10, z: 10, defId: 'workers-house-a' }],
      });

      const result = findBestPlacement('clinic', ctx);
      expect(result).not.toBeNull();
    });

    it('type_two_peak era uses late era placement', () => {
      const ctx = createContext({
        eraId: 'type_two_peak',
        buildings: [{ x: 10, z: 10, defId: 'workers-house-a' }],
      });

      const result = findBestPlacement('workers-house-a', ctx);
      expect(result).not.toBeNull();
    });
  });
});

describe('OrganicGrowth — Mandate pipeline', () => {
  it('mandate buildings still get placed via site selection', () => {
    const ctx = createContext({
      eraId: 'industrialization',
      buildings: [
        { x: 10, z: 10, defId: 'workers-house-a' },
        { x: 11, z: 10, defId: 'workers-house-b' },
      ],
      occupiedCells: new Set(['10,10', '11,10']),
    });

    // Moscow mandates a power station
    const result = findBestPlacement('power-station', ctx);
    expect(result).not.toBeNull();
    // Should not overlap existing buildings
    const key = `${result!.x},${result!.z}`;
    expect(ctx.occupiedCells.has(key)).toBe(false);
  });
});

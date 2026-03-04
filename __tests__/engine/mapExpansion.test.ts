/**
 * TDD tests for dynamic map expansion via settlement tier land grants.
 */
import {
  getCurrentTier,
  checkExpansionTrigger,
  expandGrid,
  initializeNewTiles,
} from '../../src/game/engine/mapExpansion';
import type { SettlementTier } from '../../src/ai/agents/infrastructure/SettlementSystem';
import type { TerrainTileState } from '../../src/ai/agents/core/terrainTick';

describe('mapExpansion', () => {
  // ─── getCurrentTier ───────────────────────────────────────

  describe('getCurrentTier', () => {
    it('returns selo for population 0', () => {
      expect(getCurrentTier(0)).toBe('selo');
    });

    it('returns selo for population 49', () => {
      expect(getCurrentTier(49)).toBe('selo');
    });

    it('returns posyolok for population 50', () => {
      expect(getCurrentTier(50)).toBe('posyolok');
    });

    it('returns posyolok for population 149', () => {
      expect(getCurrentTier(149)).toBe('posyolok');
    });

    it('returns pgt for population 150', () => {
      expect(getCurrentTier(150)).toBe('pgt');
    });

    it('returns pgt for population 399', () => {
      expect(getCurrentTier(399)).toBe('pgt');
    });

    it('returns gorod for population 400', () => {
      expect(getCurrentTier(400)).toBe('gorod');
    });

    it('returns gorod for population 10000', () => {
      expect(getCurrentTier(10000)).toBe('gorod');
    });

    it('returns selo for negative population', () => {
      expect(getCurrentTier(-1)).toBe('selo');
    });
  });

  // ─── checkExpansionTrigger ────────────────────────────────

  describe('checkExpansionTrigger', () => {
    it('returns false when current radius matches tier radius (selo)', () => {
      expect(checkExpansionTrigger(10, 15)).toBe(false);
    });

    it('returns true when population crosses into posyolok and radius is still selo', () => {
      expect(checkExpansionTrigger(50, 15)).toBe(true);
    });

    it('returns false when already at posyolok radius', () => {
      expect(checkExpansionTrigger(50, 30)).toBe(false);
    });

    it('returns true when population crosses into pgt and radius is posyolok', () => {
      expect(checkExpansionTrigger(150, 30)).toBe(true);
    });

    it('returns true when population crosses into gorod and radius is pgt', () => {
      expect(checkExpansionTrigger(400, 60)).toBe(true);
    });

    it('returns false when already at gorod radius', () => {
      expect(checkExpansionTrigger(400, 120)).toBe(false);
    });

    it('returns false when current radius exceeds tier radius', () => {
      expect(checkExpansionTrigger(50, 50)).toBe(false);
    });

    it('handles multiple tier jumps (selo radius with gorod population)', () => {
      expect(checkExpansionTrigger(500, 15)).toBe(true);
    });
  });

  // ─── expandGrid ───────────────────────────────────────────

  describe('expandGrid', () => {
    it('returns new tiles in the expanded ring', () => {
      const result = expandGrid(2, 3);
      expect(result.newRadius).toBe(3);
      expect(result.newTiles.length).toBeGreaterThan(0);
    });

    it('new tiles are outside old radius but within new radius', () => {
      const result = expandGrid(2, 4);
      for (const tile of result.newTiles) {
        // All tiles should be in the ring: outside old square, inside new square
        const inOldSquare = Math.abs(tile.x) <= 2 && Math.abs(tile.y) <= 2;
        const inNewSquare = Math.abs(tile.x) <= 4 && Math.abs(tile.y) <= 4;
        expect(inOldSquare).toBe(false);
        expect(inNewSquare).toBe(true);
      }
    });

    it('returns correct count for expansion from radius 1 to 2', () => {
      // Old square: (2*1+1)^2 = 9 tiles
      // New square: (2*2+1)^2 = 25 tiles
      // Ring: 25 - 9 = 16 tiles
      const result = expandGrid(1, 2);
      expect(result.newTiles).toHaveLength(16);
    });

    it('returns correct count for expansion from radius 2 to 3', () => {
      // Old: (2*2+1)^2 = 25, New: (2*3+1)^2 = 49, Ring: 24
      const result = expandGrid(2, 3);
      expect(result.newTiles).toHaveLength(24);
    });

    it('returns empty array when newRadius <= currentRadius', () => {
      const result = expandGrid(5, 5);
      expect(result.newTiles).toHaveLength(0);
      expect(result.newRadius).toBe(5);
    });

    it('returns empty array when newRadius < currentRadius', () => {
      const result = expandGrid(5, 3);
      expect(result.newTiles).toHaveLength(0);
      expect(result.newRadius).toBe(5);
    });

    it('tiles are sorted by x then y', () => {
      const result = expandGrid(1, 2);
      for (let i = 1; i < result.newTiles.length; i++) {
        const prev = result.newTiles[i - 1];
        const curr = result.newTiles[i];
        const sorted = prev.x < curr.x || (prev.x === curr.x && prev.y <= curr.y);
        expect(sorted).toBe(true);
      }
    });

    it('no duplicate tiles', () => {
      const result = expandGrid(5, 10);
      const keys = new Set(result.newTiles.map((t) => `${t.x},${t.y}`));
      expect(keys.size).toBe(result.newTiles.length);
    });
  });

  // ─── initializeNewTiles ───────────────────────────────────

  describe('initializeNewTiles', () => {
    it('creates TerrainTileState for each tile coordinate', () => {
      const tiles = [
        { x: 3, y: 0 },
        { x: 3, y: 1 },
      ];
      const result = initializeNewTiles(tiles, 'grass');
      expect(result).toHaveLength(2);
    });

    it('uses the provided default terrain type', () => {
      const tiles = [{ x: 0, y: 5 }];
      const result = initializeNewTiles(tiles, 'snow');
      expect(result[0].type).toBe('snow');
    });

    it('sets default fertility and moisture values', () => {
      const tiles = [{ x: 1, y: 1 }];
      const result = initializeNewTiles(tiles, 'grass');
      expect(result[0].fertility).toBeGreaterThan(0);
      expect(result[0].moisture).toBeGreaterThan(0);
    });

    it('sets contamination, erosion, and forestAge to 0', () => {
      const tiles = [{ x: 2, y: 2 }];
      const result = initializeNewTiles(tiles, 'grass');
      expect(result[0].contamination).toBe(0);
      expect(result[0].erosionLevel).toBe(0);
      expect(result[0].forestAge).toBe(0);
    });

    it('sets elevation to 0', () => {
      const tiles = [{ x: 2, y: 2 }];
      const result = initializeNewTiles(tiles, 'tundra');
      expect(result[0].elevation).toBe(0);
    });

    it('returns empty array for empty input', () => {
      expect(initializeNewTiles([], 'grass')).toHaveLength(0);
    });
  });
});

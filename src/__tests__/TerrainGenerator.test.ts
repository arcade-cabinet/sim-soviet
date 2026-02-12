import { describe, expect, it } from 'vitest';
import { GameRng } from '../game/SeedSystem';
import { BORDER_DEPTH, generateTerrain, getTerrainSpriteNames } from '../game/TerrainGenerator';

/** Low-profile terrain that belongs on the border ring. */
const BORDER_TERRAIN = new Set([
  'grass-mountain',
  'snow-mountain',
  'water-deep',
  'grass-forest',
  'snow-forest',
]);

describe('TerrainGenerator', () => {
  const GRID = 32;

  describe('generateTerrain', () => {
    it('generates features within grid bounds', () => {
      const features = generateTerrain(GRID, new GameRng('test-seed'));
      for (const f of features) {
        expect(f.gridX).toBeGreaterThan(0); // 0 is border
        expect(f.gridX).toBeLessThan(GRID);
        expect(f.gridY).toBeGreaterThan(0);
        expect(f.gridY).toBeLessThan(GRID);
      }
    });

    it('generates border terrain at edges', () => {
      const features = generateTerrain(GRID, new GameRng('border-check'));
      const borderFeatures = features.filter((f) => {
        const distFromEdge = Math.min(f.gridX, f.gridY, GRID - 1 - f.gridX, GRID - 1 - f.gridY);
        return distFromEdge < BORDER_DEPTH;
      });

      // Border should be populated
      expect(borderFeatures.length).toBeGreaterThan(0);

      // And consist of "blocking" terrain
      for (const f of borderFeatures) {
        expect(BORDER_TERRAIN.has(f.type)).toBe(true);
      }
    });

    it('interior contains features (no longer empty deep interior)', () => {
      const features = generateTerrain(GRID, new GameRng('interior-check'));
      const interiorFeatures = features.filter((f) => {
        const distFromEdge = Math.min(f.gridX, f.gridY, GRID - 1 - f.gridX, GRID - 1 - f.gridY);
        return distFromEdge >= BORDER_DEPTH + 3; // "Deep" interior
      });

      // Just ensure we are generating *something* inside
      expect(interiorFeatures.length).toBeGreaterThan(0);
    });
  });

  describe('getTerrainSpriteNames', () => {
    it('returns sprite names for valid types', () => {
      expect(getTerrainSpriteNames('grass-mountain').length).toBeGreaterThan(0);
      expect(getTerrainSpriteNames('water')[0]).toContain('water');
    });

    it('returns fallback for unknown types', () => {
      // @ts-expect-error
      const names = getTerrainSpriteNames('unknown-type');
      expect(names).toEqual(['grass_1']);
    });
  });
});

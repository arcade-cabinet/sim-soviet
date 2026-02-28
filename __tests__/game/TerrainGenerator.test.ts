import { GameRng } from '../../src/game/SeedSystem';
import { BORDER_DEPTH, generateTerrain, getTerrainSpriteNames, INTERIOR_FRINGE } from '../../src/game/TerrainGenerator';

/** Low-profile terrain that belongs on the border ring. */
const BORDER_TERRAIN = new Set(['sand-rocks', 'sand-desert', 'stone-rocks', 'dirt-lumber', 'water-rocks']);

/** Prominent terrain that belongs in the interior fringe. */
const INTERIOR_TERRAIN = new Set([
  'grass-forest',
  'grass-hill',
  'stone-hill',
  'stone-mountain',
  'stone-rocks',
  'water-rocks',
  'water-island',
]);

describe('TerrainGenerator', () => {
  const GRID = 30;

  // ── Deterministic output ─────────────────────────────────

  describe('deterministic generation', () => {
    it('same seed produces identical features', () => {
      const a = generateTerrain(GRID, new GameRng('test-seed'));
      const b = generateTerrain(GRID, new GameRng('test-seed'));
      expect(a).toEqual(b);
    });

    it('different seeds produce different features', () => {
      const a = generateTerrain(GRID, new GameRng('seed-alpha'));
      const b = generateTerrain(GRID, new GameRng('seed-beta'));
      // Could theoretically match, but with 30x30 grid and RNG it's essentially impossible
      const aPositions = a.map((f) => `${f.gridX},${f.gridY}`).join(';');
      const bPositions = b.map((f) => `${f.gridX},${f.gridY}`).join(';');
      expect(aPositions).not.toBe(bPositions);
    });
  });

  // ── Zone-based placement ───────────────────────────────

  describe('zone placement', () => {
    it('generates at least some terrain features', () => {
      const features = generateTerrain(GRID, new GameRng('border-test'));
      expect(features.length).toBeGreaterThan(0);
    });

    it('all features are within grid bounds', () => {
      const features = generateTerrain(GRID, new GameRng('bounds'));
      for (const f of features) {
        expect(f.gridX).toBeGreaterThanOrEqual(0);
        expect(f.gridX).toBeLessThan(GRID);
        expect(f.gridY).toBeGreaterThanOrEqual(0);
        expect(f.gridY).toBeLessThan(GRID);
      }
    });

    it('no features in the deep interior (beyond border + fringe)', () => {
      const features = generateTerrain(GRID, new GameRng('interior'));
      const totalDepth = BORDER_DEPTH + INTERIOR_FRINGE;
      for (const f of features) {
        const distFromEdge = Math.min(f.gridX, f.gridY, GRID - 1 - f.gridX, GRID - 1 - f.gridY);
        expect(distFromEdge).toBeLessThan(totalDepth);
      }
    });

    it('border ring (dist < BORDER_DEPTH) uses only low-profile terrain', () => {
      // Run multiple seeds for coverage
      for (let s = 0; s < 10; s++) {
        const features = generateTerrain(GRID, new GameRng(`border-type-${s}`));
        const borderFeatures = features.filter((f) => {
          const dist = Math.min(f.gridX, f.gridY, GRID - 1 - f.gridX, GRID - 1 - f.gridY);
          return dist < BORDER_DEPTH;
        });
        for (const f of borderFeatures) {
          expect(BORDER_TERRAIN.has(f.spriteName)).toBe(true);
        }
      }
    });

    it('interior fringe contains prominent terrain types', () => {
      // Run multiple seeds and collect interior fringe sprite names
      const fringeNames = new Set<string>();
      for (let s = 0; s < 20; s++) {
        const features = generateTerrain(GRID, new GameRng(`fringe-${s}`));
        for (const f of features) {
          const dist = Math.min(f.gridX, f.gridY, GRID - 1 - f.gridX, GRID - 1 - f.gridY);
          if (dist >= BORDER_DEPTH) {
            fringeNames.add(f.spriteName);
          }
        }
      }
      // Should include at least some prominent types
      expect(fringeNames.has('grass-forest') || fringeNames.has('stone-mountain')).toBe(true);
      // All fringe terrain must be from the interior palette
      for (const name of fringeNames) {
        expect(INTERIOR_TERRAIN.has(name)).toBe(true);
      }
    });

    it('edge cells are more likely to have features than inner border cells', () => {
      // Run multiple seeds and count features by distance from edge
      const edgeCounts = [0, 0, 0]; // distance 0, 1, 2
      for (let s = 0; s < 10; s++) {
        const features = generateTerrain(GRID, new GameRng(`density-${s}`));
        for (const f of features) {
          const dist = Math.min(f.gridX, f.gridY, GRID - 1 - f.gridX, GRID - 1 - f.gridY);
          if (dist < 3) edgeCounts[dist]!++;
        }
      }
      // Edge (dist=0) should have more features than dist=2
      expect(edgeCounts[0]).toBeGreaterThan(edgeCounts[2]!);
    });

    it('interior fringe density decreases inward', () => {
      const fringeCounts: number[] = Array.from({ length: INTERIOR_FRINGE }, () => 0);
      for (let s = 0; s < 20; s++) {
        const features = generateTerrain(GRID, new GameRng(`fringe-density-${s}`));
        for (const f of features) {
          const dist = Math.min(f.gridX, f.gridY, GRID - 1 - f.gridX, GRID - 1 - f.gridY);
          const fringeIdx = dist - BORDER_DEPTH;
          if (fringeIdx >= 0 && fringeIdx < INTERIOR_FRINGE) {
            fringeCounts[fringeIdx]!++;
          }
        }
      }
      // Closest fringe ring should have more features than the farthest
      expect(fringeCounts[0]).toBeGreaterThan(fringeCounts[INTERIOR_FRINGE - 1]!);
    });
  });

  // ── Sprite names ─────────────────────────────────────────

  describe('sprite names', () => {
    it('all features have non-empty sprite names', () => {
      const features = generateTerrain(GRID, new GameRng('sprites'));
      for (const f of features) {
        expect(f.spriteName).toBeTruthy();
        expect(f.spriteName.length).toBeGreaterThan(0);
      }
    });

    it('getTerrainSpriteNames returns unique names', () => {
      const features = generateTerrain(GRID, new GameRng('unique'));
      const names = getTerrainSpriteNames(features);
      const unique = new Set(names);
      expect(names.length).toBe(unique.size);
    });

    it('getTerrainSpriteNames covers all feature types used', () => {
      const features = generateTerrain(GRID, new GameRng('coverage'));
      const names = getTerrainSpriteNames(features);
      const nameSet = new Set(names);
      for (const f of features) {
        expect(nameSet.has(f.spriteName)).toBe(true);
      }
    });
  });

  // ── Small grid edge case ─────────────────────────────────

  describe('edge cases', () => {
    it('works with a tiny grid (size 6)', () => {
      const features = generateTerrain(6, new GameRng('tiny'));
      // With a 6x6 grid, the entire grid is within both zones
      expect(features.length).toBeGreaterThan(0);
      for (const f of features) {
        expect(f.gridX).toBeGreaterThanOrEqual(0);
        expect(f.gridX).toBeLessThan(6);
      }
    });

    it('returns empty array for zero grid', () => {
      const features = generateTerrain(0, new GameRng('empty'));
      expect(features).toEqual([]);
    });
  });
});

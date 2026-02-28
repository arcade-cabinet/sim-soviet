/**
 * @module game/TerrainGenerator
 *
 * Procedural terrain placement using seeded RNG.
 *
 * Two placement zones:
 * 1. **Border ring** (0 to BORDER_DEPTH-1 from edge): low-profile terrain
 *    only (rocks, sand, dirt) so the map edge looks like barren ground.
 * 2. **Interior fringe** (BORDER_DEPTH to BORDER_DEPTH+INTERIOR_FRINGE-1):
 *    forests, hills, and mountains that frame the playable area.
 * 3. **Deep interior** (beyond both zones): clear for building placement.
 *
 * Deterministic per seed.
 */

import type { TerrainFeature } from '@/rendering/FeatureTileRenderer';
import type { GameRng } from './SeedSystem';

/** Low-profile terrain for the border ring — no tall sprites. */
const BORDER_TERRAIN = ['sand-rocks', 'sand-desert', 'stone-rocks', 'dirt-lumber', 'water-rocks'] as const;

/** Prominent terrain for the interior fringe — forests, hills, mountains. */
const INTERIOR_TERRAIN = [
  'grass-forest',
  'grass-hill',
  'stone-hill',
  'stone-mountain',
  'stone-rocks',
  'water-rocks',
  'water-island',
] as const;

/** How many cells deep the border ring extends (low-profile terrain only). */
export const BORDER_DEPTH = 3;

/** How many additional cells inward the interior fringe extends. */
export const INTERIOR_FRINGE = 3;

/** Probability of placing a feature on an eligible border cell. */
const BORDER_FILL_CHANCE = 0.3;

/** Probability of placing a feature in the interior fringe. */
const INTERIOR_FILL_CHANCE = 0.2;

/**
 * Generate deterministic terrain features in two zones around the map.
 *
 * @param gridSize  Width/height of the square grid.
 * @param rng       Seeded RNG for reproducibility.
 * @returns Array of terrain features to render.
 */
export function generateTerrain(gridSize: number, rng: GameRng): TerrainFeature[] {
  const features: TerrainFeature[] = [];
  const totalDepth = BORDER_DEPTH + INTERIOR_FRINGE;

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const distFromEdge = Math.min(x, y, gridSize - 1 - x, gridSize - 1 - y);

      if (distFromEdge < BORDER_DEPTH) {
        // ── Border ring: low-profile terrain only ──────────────
        const edgeFactor = 1 - distFromEdge / BORDER_DEPTH;
        if (rng.random() > BORDER_FILL_CHANCE * edgeFactor) continue;

        features.push({
          gridX: x,
          gridY: y,
          spriteName: rng.pick([...BORDER_TERRAIN]),
        });
      } else if (distFromEdge < totalDepth) {
        // ── Interior fringe: forests, mountains, hills ─────────
        const fringeDist = distFromEdge - BORDER_DEPTH;
        const fringeFactor = 1 - fringeDist / INTERIOR_FRINGE;
        if (rng.random() > INTERIOR_FILL_CHANCE * fringeFactor) continue;

        features.push({
          gridX: x,
          gridY: y,
          spriteName: pickInteriorTerrain(x, y, gridSize, rng),
        });
      }
      // Deep interior: no features — reserved for building placement
    }
  }

  return features;
}

/**
 * Pick an interior fringe terrain type appropriate for the cell position.
 * Corner cells tend toward mountains; edges toward forests/hills.
 */
function pickInteriorTerrain(x: number, y: number, gridSize: number, rng: GameRng): string {
  const totalDepth = BORDER_DEPTH + INTERIOR_FRINGE;
  const isCorner =
    (x < totalDepth && y < totalDepth) ||
    (x < totalDepth && y >= gridSize - totalDepth) ||
    (x >= gridSize - totalDepth && y < totalDepth) ||
    (x >= gridSize - totalDepth && y >= gridSize - totalDepth);

  if (isCorner && rng.random() > 0.4) {
    // Corners lean toward rocky/mountainous terrain
    return rng.pick(['stone-mountain', 'stone-rocks', 'stone-hill']);
  }

  return rng.pick([...INTERIOR_TERRAIN]);
}

/** Returns the unique set of sprite names for preloading. */
export function getTerrainSpriteNames(features: TerrainFeature[]): string[] {
  return [...new Set(features.map((f) => f.spriteName))];
}

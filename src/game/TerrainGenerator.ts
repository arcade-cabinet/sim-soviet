/**
 * @module game/TerrainGenerator
 *
 * Procedural terrain placement using seeded RNG.
 *
 * Places terrain features (forests, mountains, rocks) around the map border
 * so the interior remains buildable. Deterministic per seed.
 */

import type { TerrainFeature } from '@/rendering/FeatureTileRenderer';
import type { GameRng } from './SeedSystem';

/** Available decorative terrain tile types. */
const TERRAIN_TYPES = [
  'grass-forest',
  'grass-hill',
  'stone-hill',
  'stone-mountain',
  'stone-rocks',
  'water-rocks',
  'water-island',
  'dirt-lumber',
  'sand-rocks',
  'sand-desert',
] as const;

/** How many cells deep the border ring extends. */
const BORDER_DEPTH = 3;

/** Probability of placing a feature on an eligible border cell. */
const FILL_CHANCE = 0.35;

/**
 * Generate deterministic terrain features around the map border.
 *
 * @param gridSize  Width/height of the square grid.
 * @param rng       Seeded RNG for reproducibility.
 * @returns Array of terrain features to render.
 */
export function generateTerrain(gridSize: number, rng: GameRng): TerrainFeature[] {
  const features: TerrainFeature[] = [];

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      // Only place on border cells
      const distFromEdge = Math.min(x, y, gridSize - 1 - x, gridSize - 1 - y);
      if (distFromEdge >= BORDER_DEPTH) continue;

      // Higher placement chance closer to the edge
      const edgeFactor = 1 - distFromEdge / BORDER_DEPTH;
      if (rng.random() > FILL_CHANCE * edgeFactor) continue;

      // Pick a terrain type — weight by position for natural clustering
      const terrainType = pickTerrainForPosition(x, y, gridSize, rng);

      features.push({
        gridX: x,
        gridY: y,
        spriteName: terrainType,
      });
    }
  }

  return features;
}

/**
 * Pick a terrain type appropriate for the cell position.
 * Corner cells tend toward mountains, edges toward forests/hills.
 */
function pickTerrainForPosition(x: number, y: number, gridSize: number, rng: GameRng): string {
  const isCorner =
    (x < BORDER_DEPTH && y < BORDER_DEPTH) ||
    (x < BORDER_DEPTH && y >= gridSize - BORDER_DEPTH) ||
    (x >= gridSize - BORDER_DEPTH && y < BORDER_DEPTH) ||
    (x >= gridSize - BORDER_DEPTH && y >= gridSize - BORDER_DEPTH);

  if (isCorner && rng.random() > 0.4) {
    // Corners lean toward rocky/mountainous terrain
    return rng.pick(['stone-mountain', 'stone-rocks', 'stone-hill']);
  }

  return rng.pick([...TERRAIN_TYPES]);
}

/** Returns the unique set of sprite names for preloading. */
export function getTerrainSpriteNames(features: TerrainFeature[]): string[] {
  return [...new Set(features.map((f) => f.spriteName))];
}

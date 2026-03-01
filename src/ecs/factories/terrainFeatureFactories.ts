/**
 * @module ecs/factories/terrainFeatureFactories
 *
 * Factory functions for creating terrain feature ECS entities.
 * Terrain features are mountains, forests, marshes, and rivers
 * that exist as first-class entities with seed-guided placement.
 */

import { terrainFeatures } from '../archetypes';
import type { TerrainFeatureType } from '../world';
import { world } from '../world';

/** Terrain type → default sprite name mapping. */
const FEATURE_SPRITES: Record<TerrainFeatureType, string> = {
  mountain: 'stone-mountain',
  forest: 'grass-forest',
  marsh: 'sand',
  river: 'river-straight',
  water: 'water',
};

/**
 * Creates a mountain terrain feature entity (impassable, non-harvestable).
 *
 * @param gridX     - Column index on the grid
 * @param gridY     - Row index on the grid
 * @param elevation - Mountain elevation level (default 2)
 */
export function createMountain(gridX: number, gridY: number, elevation = 2): void {
  world.add({
    position: { gridX, gridY },
    terrainFeature: {
      featureType: 'mountain',
      elevation,
      harvestable: false,
      passable: false,
      spriteName: FEATURE_SPRITES.mountain,
    },
    isTerrainFeature: true,
  });
}

/**
 * Creates a forest terrain feature entity (passable, harvestable for timber).
 *
 * @param gridX - Column index on the grid
 * @param gridY - Row index on the grid
 */
export function createForest(gridX: number, gridY: number): void {
  world.add({
    position: { gridX, gridY },
    terrainFeature: {
      featureType: 'forest',
      elevation: 0,
      harvestable: true,
      passable: true,
      spriteName: FEATURE_SPRITES.forest,
    },
    isTerrainFeature: true,
  });
}

/**
 * Creates a marsh terrain feature entity (passable, non-harvestable).
 *
 * @param gridX - Column index on the grid
 * @param gridY - Row index on the grid
 */
export function createMarsh(gridX: number, gridY: number): void {
  world.add({
    position: { gridX, gridY },
    terrainFeature: {
      featureType: 'marsh',
      elevation: 0,
      harvestable: false,
      passable: true,
      spriteName: FEATURE_SPRITES.marsh,
    },
    isTerrainFeature: true,
  });
}

/**
 * Creates a river terrain feature entity (impassable, non-harvestable).
 *
 * @param gridX - Column index on the grid
 * @param gridY - Row index on the grid
 */
export function createRiver(gridX: number, gridY: number): void {
  world.add({
    position: { gridX, gridY },
    terrainFeature: {
      featureType: 'river',
      elevation: 0,
      harvestable: false,
      passable: false,
      spriteName: FEATURE_SPRITES.river,
    },
    isTerrainFeature: true,
  });
}

/** Removes all terrain feature entities from the ECS world. */
export function clearTerrainFeatures(): void {
  for (const entity of [...terrainFeatures]) {
    world.remove(entity);
  }
}

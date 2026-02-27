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

/** Create a mountain terrain feature entity. */
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

/** Create a forest terrain feature entity. */
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

/** Create a marsh terrain feature entity. */
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

/** Create a river terrain feature entity. */
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

/** Remove all terrain feature entities from the world. */
export function clearTerrainFeatures(): void {
  for (const entity of [...terrainFeatures]) {
    world.remove(entity);
  }
}

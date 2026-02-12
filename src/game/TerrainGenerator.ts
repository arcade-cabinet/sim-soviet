import { GameRng } from './SeedSystem';

export type TerrainType =
  | 'grass'
  | 'grass-forest'
  | 'grass-hill'
  | 'grass-mountain'
  | 'snow'
  | 'snow-forest'
  | 'snow-hill'
  | 'snow-mountain'
  | 'water'
  | 'water-deep';

export interface TerrainFeature {
  type: TerrainType;
  gridX: number;
  gridY: number;
}

/**
 * Depth of the "border" zone from the edge of the map.
 * Features in this zone are purely cosmetic/boundary.
 */
export const BORDER_DEPTH = 4;

function generateFeature(x: number, y: number, gridSize: number, rng: GameRng): TerrainFeature | null {
  // Determine if border
  const distToEdge = Math.min(x, y, gridSize - 1 - x, gridSize - 1 - y);
  const isBorder = distToEdge < BORDER_DEPTH;
  const noiseVal = rng.next();

  if (isBorder) {
    // Border is always mountains or deep water to block movement
    return {
      type: noiseVal > 0.6 ? 'grass-mountain' : 'grass-forest',
      gridX: x,
      gridY: y
    };
  }

  // Interior generation
  if (noiseVal > 0.96) {
    return { type: 'grass-mountain', gridX: x, gridY: y };
  } else if (noiseVal > 0.85) {
    return { type: 'grass-hill', gridX: x, gridY: y };
  } else if (noiseVal > 0.75) {
    return { type: 'grass-forest', gridX: x, gridY: y };
  } else if (noiseVal < 0.02) {
    return { type: 'water', gridX: x, gridY: y };
  }

  return null;
}

export function generateTerrain(gridSize: number, rng: GameRng): TerrainFeature[] {
  const features: TerrainFeature[] = [];

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const feature = generateFeature(x, y, gridSize, rng);
      if (feature) {
        features.push(feature);
      }
    }
  }

  return features;
}

/**
 * Helper to map TerrainType to the sprite name in the atlas.
 */
export function getTerrainSpriteNames(type: TerrainType): string[] {
  const map: Record<TerrainType, string[]> = {
    'grass': ['grass_1', 'grass_2', 'grass_3'],
    'grass-forest': ['forest_1', 'forest_2'],
    'grass-hill': ['hill_1', 'hill_2'],
    'grass-mountain': ['mountain_1', 'mountain_2'],
    'snow': ['snow_1', 'snow_2'],
    'snow-forest': ['forest_snow_1', 'forest_snow_2'],
    'snow-hill': ['hill_snow_1'],
    'snow-mountain': ['mountain_snow_1'],
    'water': ['water_1'],
    'water-deep': ['water_deep_1'],
  };

  return map[type] || ['grass_1'];
}

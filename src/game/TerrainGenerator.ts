import { GameRng } from './SeedSystem';

/**
 * Terrain types for the game world.
 */
export type TerrainType =
  | 'grass'
  | 'grass-forest'
  | 'grass-hill'
  | 'water'
  | 'water-deep'
  | 'mountain';

export interface TerrainFeature {
  gridX: number;
  gridY: number;
  type: TerrainType;
}

export const TERRAIN_TYPES: TerrainType[] = [
  'grass',
  'grass-forest',
  'grass-hill',
  'water',
  'water-deep',
  'mountain',
];

/**
 * Returns the sprite name for a given terrain type.
 * Currently maps 1:1, but allows future flexibility.
 */
export function getTerrainSpriteNames(type: TerrainType): string[] {
  switch (type) {
    case 'grass': return ['grass_1', 'grass_2', 'grass_3'];
    case 'grass-forest': return ['forest_1', 'forest_2'];
    case 'grass-hill': return ['hill_1'];
    case 'water': return ['water_1'];
    case 'water-deep': return ['water_deep_1'];
    case 'mountain': return ['mountain_1', 'mountain_2'];
    default: return ['grass_1'];
  }
}

/** Width of the border ring (cells) */
export const BORDER_DEPTH = 4;

/**
 * Generates terrain features for the map.
 * Enforces a border ring of mountains/water.
 */
export function generateTerrain(gridSize: number, rng: GameRng): TerrainFeature[] {
  const features: TerrainFeature[] = [];
  const center = gridSize / 2;
  const radius = gridSize / 2;

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const dist = Math.sqrt((x - center) ** 2 + (y - center) ** 2);
      const isBorder = dist >= radius - BORDER_DEPTH;

      // Base terrain is grass (implicitly, where no feature exists)
      // We only generate features for non-grass tiles to save entities/rendering

      let type: TerrainType | null = null;

      if (isBorder) {
        // Border generation: mostly mountains/deep water
        const noise = rng.next();
        if (noise > 0.6) {
          type = 'mountain';
        } else if (noise > 0.4) {
          type = 'water-deep';
        } else if (noise > 0.3) {
          type = 'grass-hill'; // Transition
        }
      } else {
        // Interior generation
        const noise = rng.next();
        if (noise > 0.85) {
          type = 'grass-forest';
        } else if (noise > 0.92) {
          type = 'grass-hill';
        } else if (noise > 0.96) {
          type = 'water';
        }
      }

      if (type) {
        features.push({ gridX: x, gridY: y, type });
      }
    }
  }

  return features;
}

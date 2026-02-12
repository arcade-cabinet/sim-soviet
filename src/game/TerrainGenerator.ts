/**
 * @module game/TerrainGenerator
 *
 * Procedural terrain placement using seeded RNG.
 *
 * Two placement zones:
 * 1. **Border ring** (0 to BORDER_DEPTH-1 from edge): low-profile terrain
 *    only (rocks, sand, dirt) so the map edge looks like barren ground.
 * 2. **Interior terrain**: Mountains, forests, and hills scattered organically
 *    using noise-based clustering logic.
 *
 * Deterministic per seed.
 */

import type { TerrainFeature } from '@/rendering/FeatureTileRenderer';
import type { GameRng } from './SeedSystem';

/** Low-profile terrain for the border ring — no tall sprites. */
const BORDER_TERRAIN = [
  'sand-rocks',
  'sand-desert',
  'stone-rocks',
  'dirt-lumber',
  'water-rocks',
] as const;

/** All available interior terrain types. */
type InteriorTerrain =
  | 'grass-forest'
  | 'grass-hill'
  | 'stone-hill'
  | 'stone-mountain'
  | 'stone-rocks'
  | 'water-rocks'
  | 'water-island';

/** Map themes dictating feature probabilities. */
interface MapTheme {
  name: string;
  mountainClusterChance: number; // Chance of a mountain cluster center
  mountainDensity: number; // Density within a mountain cluster
  forestWeight: number; // Weight for forest in scatter
  hillWeight: number; // Weight for hills in scatter
  waterWeight: number; // Weight for water/rocks in scatter
  allowMountains: boolean; // Can produce stone-mountain at all?
}

const THEMES: Record<string, MapTheme> = {
  balanced: {
    name: 'Balanced',
    mountainClusterChance: 0.02,
    mountainDensity: 0.7,
    forestWeight: 60,
    hillWeight: 30,
    waterWeight: 10,
    allowMountains: true,
  },
  forest: {
    name: 'Deep Forest',
    mountainClusterChance: 0.005, // Rare mountains
    mountainDensity: 0.4,
    forestWeight: 80,
    hillWeight: 15,
    waterWeight: 5,
    allowMountains: true,
  },
  plains: {
    name: 'Steppe Plains',
    mountainClusterChance: 0.0, // No mountains
    mountainDensity: 0,
    forestWeight: 20,
    hillWeight: 60,
    waterWeight: 20,
    allowMountains: false,
  },
  lakes: {
    name: 'Marshlands',
    mountainClusterChance: 0.0, // No mountains
    mountainDensity: 0,
    forestWeight: 30,
    hillWeight: 10,
    waterWeight: 60, // Mostly water features
    allowMountains: false,
  },
  mountainous: {
    name: 'Ural Highlands',
    mountainClusterChance: 0.04, // Frequent clusters
    mountainDensity: 0.85,
    forestWeight: 30,
    hillWeight: 50,
    waterWeight: 20,
    allowMountains: true,
  },
};

/** How many cells deep the border ring extends (low-profile terrain only). */
export const BORDER_DEPTH = 3;

/** Probability of placing a feature on an eligible border cell. */
const BORDER_FILL_CHANCE = 0.3;

/** Probability of placing a feature in the interior. */
const INTERIOR_FILL_CHANCE = 0.15;

/**
 * Generate deterministic terrain features.
 *
 * @param gridSize  Width/height of the square grid.
 * @param rng       Seeded RNG for reproducibility.
 * @returns Array of terrain features to render.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: terrain generation branches on zones and clustering logic
export function generateTerrain(gridSize: number, rng: GameRng): TerrainFeature[] {
  const features: TerrainFeature[] = [];

  // Pick a theme based on the seed
  const themeKeys = Object.keys(THEMES);
  const themeKey = rng.pick(themeKeys);
  const theme = THEMES[themeKey]!;

  console.log(`TerrainGenerator: Using theme "${theme.name}"`);

  const mountainCenters: { x: number; y: number }[] = [];

  // 1. Pick random centers for mountain clusters in the interior (if allowed)
  if (theme.allowMountains) {
    for (let y = BORDER_DEPTH; y < gridSize - BORDER_DEPTH; y++) {
      for (let x = BORDER_DEPTH; x < gridSize - BORDER_DEPTH; x++) {
        if (rng.random() < theme.mountainClusterChance) {
          mountainCenters.push({ x, y });
        }
      }
    }
  }

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
      } else {
        // ── Interior: Scattering and Clustering ────────────────

        // Check distance to nearest mountain cluster center
        let distToMountain = Number.MAX_VALUE;
        for (const center of mountainCenters) {
          const d = Math.sqrt((x - center.x) ** 2 + (y - center.y) ** 2);
          if (d < distToMountain) distToMountain = d;
        }

        // Mountain cluster logic: high chance near centers
        if (distToMountain <= 2.5 && theme.allowMountains) {
          if (rng.random() < theme.mountainDensity) {
            // Core of cluster: mountains and rocks
            const type =
              distToMountain <= 1.0
                ? 'stone-mountain'
                : rng.pick(['stone-mountain', 'stone-rocks', 'stone-hill']);
            features.push({ gridX: x, gridY: y, spriteName: type });
            continue; // Skip general scatter
          }
        }

        // General scatter logic
        if (rng.random() < INTERIOR_FILL_CHANCE) {
          features.push({
            gridX: x,
            gridY: y,
            spriteName: pickInteriorTerrain(theme, rng),
          });
        }
      }
    }
  }

  return features;
}

/**
 * Pick an interior terrain type appropriate for scattered placement based on theme weights.
 */
function pickInteriorTerrain(theme: MapTheme, rng: GameRng): string {
  const totalWeight = theme.forestWeight + theme.hillWeight + theme.waterWeight;
  const roll = rng.random() * totalWeight;

  if (roll < theme.forestWeight) return 'grass-forest';
  if (roll < theme.forestWeight + theme.hillWeight) return rng.pick(['grass-hill', 'stone-hill']);
  return rng.pick(['stone-rocks', 'water-rocks', 'water-island']);
}

/** Returns the unique set of sprite names for preloading. */
export function getTerrainSpriteNames(features: TerrainFeature[]): string[] {
  return [...new Set(features.map((f) => f.spriteName))];
}

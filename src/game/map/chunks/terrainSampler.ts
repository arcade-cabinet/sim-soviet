import { classifyBiome, sampleHeight, type PlanetConfig } from '../../../scene/celestial/planetGenerator';
import { getCurrentGridSize } from '../../../engine/GridTypes';
import type { TerrainType } from '../types';

/**
 * Maps a local 2D grid coordinate (x, z) to a 3D unit sphere coordinate
 * that perfectly aligns with the CelestialBody shader's flat projection.
 *
 * @param gx Grid X coordinate
 * @param gz Grid Z coordinate
 * @param bodyRadius The radius of the procedural planet (default 10)
 * @returns [x, y, z] on the unit sphere
 */
export function gridToUnitSphere(gx: number, gz: number, bodyRadius: number = 10): [number, number, number] {
  const width = 2.0 * Math.PI * bodyRadius;
  const height = Math.PI * bodyRadius;

  // The center of the initial grid (e.g. 20x20 -> center at 10,10)
  // maps to the very center of the unrolled map (uv 0.5, 0.5)
  // For infinite expansion, we just assume the origin (0,0) of the settlement
  // was initially offset by the initial center. Since we don't track the "initial"
  // center natively if it changes, we just assume the settlement center is at (10, 10)
  // in world coords when it was founded.
  const initialCenter = 10;

  const local_x = gx - initialCenter;
  const local_y = initialCenter - gz;

  const uv_x = (local_x / width) + 0.5;
  const uv_y = (local_y / height) + 0.5;

  const phi = uv_y * Math.PI;
  const theta = uv_x * 2 * Math.PI;

  const sx = Math.sin(phi) * Math.cos(theta);
  const sy = Math.cos(phi);
  const sz = Math.sin(phi) * Math.sin(theta);

  return [sx, sy, sz];
}

/**
 * Procedurally samples the planet generator to determine the terrain type
 * and elevation for a specific grid cell.
 */
export function sampleTerrainAtGridPos(gx: number, gz: number, config: PlanetConfig): { terrain: TerrainType; elevation: number } {
  const [sx, sy, sz] = gridToUnitSphere(gx, gz);
  const height = sampleHeight(sx, sy, sz, config);
  const biome = classifyBiome(height, sy, config.seaLevel, 'terran');

  let terrain: TerrainType = 'grass';
  let elevation = 0;

  switch (biome) {
    case 'ocean':
      terrain = 'water';
      elevation = -1; // Lowered for water
      break;
    case 'shore':
      terrain = 'grass'; // Or sand if we add it
      elevation = 0;
      break;
    case 'mountain':
    case 'snow':
    case 'ice':
      terrain = 'mountain';
      elevation = 2; // High elevation
      break;
    case 'land':
      // Land can be grass, forest, or marsh based on secondary noise
      terrain = 'grass';
      elevation = 0;
      
      // Simple deterministic secondary roll based on grid coords to scatter forests
      // This perfectly aligns with the chunking idea (no drunkard's walk required)
      const noiseValue = Math.sin(gx * 12.9898 + gz * 78.233) * 43758.5453;
      const frac = noiseValue - Math.floor(noiseValue);
      
      if (frac < 0.15) {
        terrain = 'forest';
      } else if (frac < 0.20 && height < config.seaLevel + 0.05) {
        // Low land near water has a chance to be marsh
        terrain = 'marsh';
      }
      break;
  }

  // To maintain visual variety, we can map 'grass' randomly to 'tree' occasionally if needed
  // But 'forest' handles trees.

  return { terrain, elevation };
}

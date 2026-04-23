import type { TerrainType } from '../types';

export interface PlanetConfig {
  seed: number;
  seaLevel: number;
  mountainAmplitude: number;
  noiseOctaves: number;
  noiseScale: number;
  continentBias: number;
  craterDensity: number;
}

type LocalBiome = 'ocean' | 'shore' | 'land' | 'mountain' | 'snow' | 'ice';

function hashNoise(x: number, y: number, z: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 0.001) * 43758.5453;
  return n - Math.floor(n);
}

function sampleHeight(x: number, y: number, z: number, config: PlanetConfig): number {
  let amplitude = 0.5;
  let frequency = config.noiseScale;
  let total = config.continentBias;
  let amplitudeTotal = 0;

  for (let octave = 0; octave < config.noiseOctaves; octave++) {
    const n = hashNoise(x * frequency, y * frequency, z * frequency, config.seed + octave * 1013);
    total += (n * 2 - 1) * amplitude;
    amplitudeTotal += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  const normalized = amplitudeTotal > 0 ? total / amplitudeTotal : total;
  return normalized + Math.max(0, config.mountainAmplitude) * 0.2;
}

function classifyBiome(height: number, latitudeY: number, seaLevel: number): LocalBiome {
  const polar = Math.abs(latitudeY) > 0.86;
  if (height < seaLevel) return polar ? 'ice' : 'ocean';
  if (height < seaLevel + 0.04) return 'shore';
  if (polar && height > seaLevel + 0.08) return 'snow';
  if (height > seaLevel + 0.5) return 'mountain';
  return 'land';
}

/**
 * Maps a local 2D grid coordinate (x, z) to a 3D unit sphere coordinate
 * that aligns with the flat settlement terrain projection.
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

  const uv_x = local_x / width + 0.5;
  const uv_y = local_y / height + 0.5;

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
export function sampleTerrainAtGridPos(
  gx: number,
  gz: number,
  config: PlanetConfig,
): { terrain: TerrainType; elevation: number } {
  const [sx, sy, sz] = gridToUnitSphere(gx, gz);
  const height = sampleHeight(sx, sy, sz, config);
  const biome = classifyBiome(height, sy, config.seaLevel);

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
    case 'land': {
      // Land can be grass, forest, or marsh based on secondary noise
      terrain = 'grass';
      elevation = 0;

      // Simple deterministic secondary roll based on grid coords to scatter forests
      // This perfectly aligns with the chunking idea (no drunkard's walk required)
      const noiseValue = Math.sin(gx * 12.9898 + gz * 78.233) * 43758.5453;
      const frac = noiseValue - Math.floor(noiseValue);

      if (frac < 0.15) {
        terrain = 'forest';
      } else if (frac < 0.2 && height < config.seaLevel + 0.05) {
        // Low land near water has a chance to be marsh
        terrain = 'marsh';
      }
      break;
    }
  }

  // To maintain visual variety, we can map 'grass' randomly to 'tree' occasionally if needed
  // But 'forest' handles trees.

  return { terrain, elevation };
}

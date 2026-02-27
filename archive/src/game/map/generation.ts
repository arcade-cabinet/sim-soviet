/**
 * @module game/map/generation
 *
 * Noise generation, feature assignment, and connectivity validation
 * for procedural terrain maps.
 */

import type { GameRng } from '../SeedSystem';
import { CARDINAL_DIRS, FOREST_FEATURES, MARSH_FEATURES, MOUNTAIN_FEATURES } from './constants';
import type { TerrainCell, TerrainType } from './types';

// ─── Noise Utilities ────────────────────────────────────────────────────────

/**
 * Generate a 2D value noise map using seeded RNG.
 *
 * Creates a coarse grid of random values, then bilinearly interpolates
 * to produce smooth noise at arbitrary resolution.
 */
export function generateNoiseMap(
  width: number,
  height: number,
  scale: number,
  rng: GameRng
): number[][] {
  // Coarse grid dimensions
  const coarseW = Math.ceil(width / scale) + 2;
  const coarseH = Math.ceil(height / scale) + 2;

  // Fill coarse grid with random values
  const coarse: number[][] = [];
  for (let y = 0; y < coarseH; y++) {
    const row: number[] = [];
    for (let x = 0; x < coarseW; x++) {
      row.push(rng.random());
    }
    coarse.push(row);
  }

  // Interpolate to full resolution
  const result: number[][] = [];
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      const cx = x / scale;
      const cy = y / scale;
      const x0 = Math.floor(cx);
      const y0 = Math.floor(cy);
      const fx = cx - x0;
      const fy = cy - y0;

      // Bilinear interpolation
      const v00 = coarse[y0]![x0]!;
      const v10 = coarse[y0]![x0 + 1]!;
      const v01 = coarse[y0 + 1]![x0]!;
      const v11 = coarse[y0 + 1]![x0 + 1]!;

      // Smoothstep for less blocky appearance
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);

      const top = v00 + (v10 - v00) * sx;
      const bot = v01 + (v11 - v01) * sx;
      row.push(top + (bot - top) * sy);
    }
    result.push(row);
  }

  return result;
}

/**
 * Multi-octave noise combining multiple scales for natural-looking terrain.
 */
export function fractalNoise(width: number, height: number, rng: GameRng, octaves = 3): number[][] {
  const result: number[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => 0)
  );

  let amplitude = 1;
  let totalAmp = 0;

  for (let o = 0; o < octaves; o++) {
    const scale = Math.max(2, Math.floor(8 / (o + 1)));
    const noise = generateNoiseMap(width, height, scale, rng);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        result[y]![x]! += noise[y]![x]! * amplitude;
      }
    }
    totalAmp += amplitude;
    amplitude *= 0.5;
  }

  // Normalize to [0, 1]
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      result[y]![x]! /= totalAmp;
    }
  }

  return result;
}

// ─── Feature Assignment ─────────────────────────────────────────────────────

/** Assign visual features to a cell based on its terrain type. */
export function assignFeatures(type: TerrainType, rng: GameRng): string[] {
  switch (type) {
    case 'forest':
      return [rng.pick(FOREST_FEATURES)];
    case 'mountain':
      return [rng.pick(MOUNTAIN_FEATURES)];
    case 'marsh':
      return [rng.pick(MARSH_FEATURES)];
    default:
      return [];
  }
}

// ─── Connectivity Check ─────────────────────────────────────────────────────

/** Track which map edges have been reached by a flood-fill. */
interface EdgeReach {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

/** Update edge reach flags for a visited cell. */
function updateEdgeReach(x: number, y: number, size: number, reach: EdgeReach): void {
  if (y === 0) reach.top = true;
  if (y === size - 1) reach.bottom = true;
  if (x === 0) reach.left = true;
  if (x === size - 1) reach.right = true;
}

/** Check if all four edges have been reached. */
function allEdgesReached(reach: EdgeReach): boolean {
  return reach.top && reach.bottom && reach.left && reach.right;
}

/**
 * BFS flood-fill from the center to verify that passable terrain connects
 * to at least one cell on each map edge.
 */
export function checkConnectivity(terrain: TerrainCell[][], size: number): boolean {
  const center = Math.floor(size / 2);
  const visited = new Set<string>();
  const queue: [number, number][] = [[center, center]];
  visited.add(`${center},${center}`);
  const reach: EdgeReach = { top: false, bottom: false, left: false, right: false };

  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    updateEdgeReach(x, y, size, reach);
    if (allEdgesReached(reach)) return true;

    for (const [dx, dy] of CARDINAL_DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      if (terrain[ny]![nx]!.movementCost < Infinity) {
        visited.add(key);
        queue.push([nx, ny]);
      }
    }
  }

  return allEdgesReached(reach);
}

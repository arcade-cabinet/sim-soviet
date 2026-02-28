/**
 * @module game/map/rivers
 *
 * River generation using midpoint displacement, Bresenham rasterization,
 * and variable-width expansion.
 */

import type { GameRng } from '../SeedSystem';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RiverPoint {
  x: number;
  y: number;
}

// ─── Path Generation ────────────────────────────────────────────────────────

/**
 * Generate a winding river path from one edge to the opposite using
 * midpoint displacement.
 */
export function generateRiverPath(size: number, rng: GameRng): RiverPoint[] {
  // Pick a random axis (0 = horizontal, 1 = vertical)
  const axis = rng.coinFlip() ? 0 : 1;

  let start: RiverPoint;
  let end: RiverPoint;

  if (axis === 0) {
    // Left edge → right edge
    start = { x: 0, y: rng.int(Math.floor(size * 0.2), Math.floor(size * 0.8)) };
    end = { x: size - 1, y: rng.int(Math.floor(size * 0.2), Math.floor(size * 0.8)) };
  } else {
    // Top edge → bottom edge
    start = { x: rng.int(Math.floor(size * 0.2), Math.floor(size * 0.8)), y: 0 };
    end = { x: rng.int(Math.floor(size * 0.2), Math.floor(size * 0.8)), y: size - 1 };
  }

  // Midpoint displacement to create winding path
  const points = midpointDisplace([start, end], size, rng, 5);

  // Clamp and deduplicate
  const seen = new Set<string>();
  const path: RiverPoint[] = [];
  for (const p of points) {
    const cx = Math.max(0, Math.min(size - 1, Math.round(p.x)));
    const cy = Math.max(0, Math.min(size - 1, Math.round(p.y)));
    const key = `${cx},${cy}`;
    if (!seen.has(key)) {
      seen.add(key);
      path.push({ x: cx, y: cy });
    }
  }

  return path;
}

/**
 * Recursive midpoint displacement for natural-looking river curves.
 */
function midpointDisplace(points: RiverPoint[], size: number, rng: GameRng, depth: number): RiverPoint[] {
  if (depth <= 0 || points.length < 2) return points;

  const result: RiverPoint[] = [points[0]!];

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const mid: RiverPoint = {
      x: (a.x + b.x) / 2 + (rng.random() - 0.5) * size * 0.15 * (depth / 5),
      y: (a.y + b.y) / 2 + (rng.random() - 0.5) * size * 0.15 * (depth / 5),
    };
    result.push(mid, b);
  }

  return midpointDisplace(result, size, rng, depth - 1);
}

// ─── Rasterization ──────────────────────────────────────────────────────────

/** Check if a point is within grid bounds. */
function inBounds(x: number, y: number, size: number): boolean {
  return x >= 0 && x < size && y >= 0 && y < size;
}

/** Widen a single river point by randomly offsetting a neighbor cell. */
function widenRiverAt(p: RiverPoint, size: number, rng: GameRng): string | null {
  const dx = rng.coinFlip() ? 1 : -1;
  const dy = rng.coinFlip() ? 1 : -1;
  const nx = p.x + (rng.coinFlip() ? dx : 0);
  const ny = p.y + (rng.coinFlip() ? 0 : dy);
  return inBounds(nx, ny, size) ? `${nx},${ny}` : null;
}

/** Fill gaps between consecutive river points using Bresenham. */
function fillRiverGaps(path: RiverPoint[], size: number, cells: Set<string>): void {
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    for (const p of bresenham(a.x, a.y, b.x, b.y)) {
      if (inBounds(p.x, p.y, size)) {
        cells.add(`${p.x},${p.y}`);
      }
    }
  }
}

/**
 * Rasterize a river path into grid cells, expanding to 1-2 cell width.
 */
export function rasterizeRiver(path: RiverPoint[], size: number, rng: GameRng): Set<string> {
  const cells = new Set<string>();

  for (const p of path) {
    cells.add(`${p.x},${p.y}`);
    if (rng.coinFlip(0.4)) {
      const widened = widenRiverAt(p, size, rng);
      if (widened) cells.add(widened);
    }
  }

  fillRiverGaps(path, size, cells);
  return cells;
}

/** Bresenham's line algorithm for gap-free rasterization. */
function bresenham(x0: number, y0: number, x1: number, y1: number): RiverPoint[] {
  const points: RiverPoint[] = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let cx = x0;
  let cy = y0;

  while (true) {
    points.push({ x: cx, y: cy });
    if (cx === x1 && cy === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
  }

  return points;
}

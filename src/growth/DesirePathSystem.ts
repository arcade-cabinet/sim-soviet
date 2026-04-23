/**
 * @module growth/DesirePathSystem
 *
 * Desire-path road formation: roads emerge from repeated worker movement
 * patterns, not from explicit player placement.
 *
 * Each tick, workers move between home and workplace. The path between
 * each (home, work) pair is traced as a Manhattan route, incrementing
 * traffic counters on intermediate cells. When a cell's traffic exceeds
 * the formation threshold, a dirt path forms. Higher traffic upgrades
 * the path to gravel, then paved road.
 *
 * This is the organic road system — no player placement of roads.
 */

// ── Types ───────────────────────────────────────────────────────────────────

/** Traffic counter per grid cell. */
export interface TrafficGrid {
  /** Traffic count per "x,z" key. Higher = more walked. */
  cells: Map<string, number>;
}

/** Road segment formed from a desire path. */
export interface DesirePathRoad {
  gridX: number;
  gridY: number;
  /** Road tier: 1=dirt, 2=gravel, 3=paved. */
  tier: number;
}

/** Thresholds for road formation from traffic counts. */
export const ROAD_THRESHOLDS = {
  /** Traffic count to form a dirt path. */
  dirt: 50,
  /** Traffic count to upgrade to gravel. */
  gravel: 200,
  /** Traffic count to upgrade to paved. */
  paved: 500,
} as const;

/** Per-tick traffic decay rate (0-1). Prevents ancient paths from persisting forever. */
export const TRAFFIC_DECAY_RATE = 0.995;

// ── Core Functions ──────────────────────────────────────────────────────────

/** Create an empty traffic grid. */
export function createTrafficGrid(): TrafficGrid {
  return { cells: new Map() };
}

/**
 * Record a worker commute between two grid positions.
 * Traces a Manhattan path (horizontal then vertical) and increments
 * traffic on each intermediate cell.
 */
export function recordCommute(grid: TrafficGrid, fromX: number, fromZ: number, toX: number, toZ: number): void {
  // Manhattan path: walk horizontal first, then vertical
  const dx = toX > fromX ? 1 : toX < fromX ? -1 : 0;
  const dz = toZ > fromZ ? 1 : toZ < fromZ ? -1 : 0;

  let x = fromX;
  let z = fromZ;

  // Horizontal segment
  while (x !== toX) {
    x += dx;
    const key = `${x},${z}`;
    grid.cells.set(key, (grid.cells.get(key) ?? 0) + 1);
  }

  // Vertical segment
  while (z !== toZ) {
    z += dz;
    const key = `${x},${z}`;
    grid.cells.set(key, (grid.cells.get(key) ?? 0) + 1);
  }
}

/**
 * Apply per-tick decay to all traffic cells.
 * Removes cells that decay below 1 to keep the map clean.
 */
export function decayTraffic(grid: TrafficGrid): void {
  for (const [key, value] of grid.cells) {
    const decayed = value * TRAFFIC_DECAY_RATE;
    if (decayed < 1) {
      grid.cells.delete(key);
    } else {
      grid.cells.set(key, decayed);
    }
  }
}

/**
 * Extract formed roads from the traffic grid.
 * Returns all cells that have exceeded the dirt threshold.
 */
export function extractDesirePaths(grid: TrafficGrid, occupiedCells: Set<string>): DesirePathRoad[] {
  const roads: DesirePathRoad[] = [];

  for (const [key, traffic] of grid.cells) {
    if (traffic < ROAD_THRESHOLDS.dirt) continue;
    if (occupiedCells.has(key)) continue; // don't place roads on buildings

    const [xStr, zStr] = key.split(',');
    const gridX = parseInt(xStr!, 10);
    const gridY = parseInt(zStr!, 10);

    let tier: number;
    if (traffic >= ROAD_THRESHOLDS.paved) {
      tier = 3;
    } else if (traffic >= ROAD_THRESHOLDS.gravel) {
      tier = 2;
    } else {
      tier = 1;
    }

    roads.push({ gridX, gridY, tier });
  }

  return roads;
}

// ── Serialization ───────────────────────────────────────────────────────────

export interface TrafficGridSaveData {
  cells: Array<[string, number]>;
}

export function serializeTrafficGrid(grid: TrafficGrid): TrafficGridSaveData {
  return { cells: Array.from(grid.cells.entries()) };
}

export function restoreTrafficGrid(data: TrafficGridSaveData): TrafficGrid {
  return { cells: new Map(data.cells) };
}

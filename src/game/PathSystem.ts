/**
 * PathSystem — generates organic dirt paths between buildings.
 *
 * After a building is placed or demolished, recalculates which grass tiles
 * should become 'road' terrain (rendered as packed-earth paths by the
 * TerrainGrid via ECSBridge's 'road' -> 'path' mapping).
 *
 * Algorithm (simple adjacency + BFS connector):
 *   1. Mark all empty cells directly adjacent to buildings as "entrance" candidates.
 *   2. For each pair of nearby buildings (within MAX_PATH_DISTANCE),
 *      BFS the shortest path between their entrance cells over grass/road cells.
 *   3. Mark traversed cells as 'road' on the ECS tile entities.
 *   4. Clear stale 'road' cells that no longer connect buildings.
 *
 * Constraints:
 *   - Never overwrite water, mountain, marsh, river, or forest terrain.
 *   - Never overwrite cells occupied by buildings (type !== null in GameGrid).
 *   - Performance budget: < 16 ms on a 30x30 grid.
 */

import { GRID_SIZE } from '@/config';
import { buildings, tiles } from '@/ecs/archetypes';

/** Maximum BFS distance between two buildings to create a connecting path. */
const MAX_PATH_DISTANCE = 10;

/** Terrain types on tile entities that paths must NOT overwrite. */
const IMPASSABLE_TILE_TERRAINS = new Set(['water', 'foundation']);

/** Terrain feature types (from terrainFeatures archetype) that block paths. */
const IMPASSABLE_FEATURES = new Set(['mountain', 'river', 'water', 'forest', 'marsh']);

// ── 4-directional neighbors ─────────────────────────────────────────────────

const DIRS: readonly [number, number][] = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

// ── Internal helpers ────────────────────────────────────────────────────────

interface TileInfo {
  terrain: string;
  hasBuilding: boolean;
  hasFeature: boolean;
  featureType: string;
}

/**
 * Build a fast lookup grid from ECS entities.
 * Returns a 2D array indexed [y][x].
 */
function buildLookup(): TileInfo[][] {
  const grid: TileInfo[][] = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    const row: TileInfo[] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      row.push({ terrain: 'grass', hasBuilding: false, hasFeature: false, featureType: '' });
    }
    grid.push(row);
  }

  // Populate tile terrain
  for (const entity of tiles.entities) {
    const { gridX, gridY } = entity.position;
    if (gridY >= 0 && gridY < GRID_SIZE && gridX >= 0 && gridX < GRID_SIZE) {
      grid[gridY]![gridX]!.terrain = entity.tile.terrain;
    }
  }

  // Mark building cells
  for (const entity of buildings.entities) {
    const { gridX, gridY } = entity.position;
    if (gridY >= 0 && gridY < GRID_SIZE && gridX >= 0 && gridX < GRID_SIZE) {
      grid[gridY]![gridX]!.hasBuilding = true;
    }
  }

  // Mark terrain features (mountains, forests, etc.)
  // Import lazily to avoid circular deps
  const { terrainFeatures } = require('@/ecs/archetypes');
  for (const entity of terrainFeatures.entities) {
    const { gridX, gridY } = entity.position;
    if (gridY >= 0 && gridY < GRID_SIZE && gridX >= 0 && gridX < GRID_SIZE) {
      grid[gridY]![gridX]!.hasFeature = true;
      grid[gridY]![gridX]!.featureType = entity.terrainFeature.featureType;
    }
  }

  return grid;
}

/** Check if a cell is passable for path placement. */
function isPathable(info: TileInfo): boolean {
  if (info.hasBuilding) return false;
  if (IMPASSABLE_TILE_TERRAINS.has(info.terrain)) return false;
  if (info.hasFeature && IMPASSABLE_FEATURES.has(info.featureType)) return false;
  return true;
}

/** Check if a cell is walkable (existing path or pathable grass). */
function isWalkable(info: TileInfo): boolean {
  if (info.terrain === 'road') return true;
  return isPathable(info);
}

/**
 * Find entrance cells for a building at (bx, by) — empty adjacent cells.
 */
function findEntrances(bx: number, by: number, lookup: TileInfo[][]): { x: number; y: number }[] {
  const entrances: { x: number; y: number }[] = [];
  for (const [dx, dy] of DIRS) {
    const nx = bx + dx;
    const ny = by + dy;
    if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) continue;
    const info = lookup[ny]![nx]!;
    if (isPathable(info) || info.terrain === 'road') {
      entrances.push({ x: nx, y: ny });
    }
  }
  return entrances;
}

/**
 * BFS from a set of source cells to a set of target cells.
 * Returns the path cells (excluding source/target buildings) or null if unreachable.
 * Stops at MAX_PATH_DISTANCE steps.
 */
function bfsPath(
  sources: { x: number; y: number }[],
  targetSet: Set<string>,
  lookup: TileInfo[][],
): { x: number; y: number }[] | null {
  if (sources.length === 0 || targetSet.size === 0) return null;

  // Check if any source is already a target
  for (const s of sources) {
    if (targetSet.has(`${s.x},${s.y}`)) return [];
  }

  const visited = new Map<string, string | null>(); // key -> parent key
  const queue: { x: number; y: number; dist: number }[] = [];

  for (const s of sources) {
    const key = `${s.x},${s.y}`;
    visited.set(key, null);
    queue.push({ x: s.x, y: s.y, dist: 0 });
  }

  let head = 0;
  while (head < queue.length) {
    const { x, y, dist } = queue[head++]!;
    if (dist >= MAX_PATH_DISTANCE) continue;

    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) continue;

      const nKey = `${nx},${ny}`;
      if (visited.has(nKey)) continue;

      const info = lookup[ny]![nx]!;
      if (!isWalkable(info)) continue;

      const parentKey = `${x},${y}`;
      visited.set(nKey, parentKey);

      if (targetSet.has(nKey)) {
        // Reconstruct path
        const path: { x: number; y: number }[] = [];
        let cur: string | null = nKey;
        while (cur !== null) {
          const [px, py] = cur.split(',').map(Number) as [number, number];
          path.push({ x: px, y: py });
          cur = visited.get(cur) ?? null;
        }
        return path;
      }

      queue.push({ x: nx, y: ny, dist: dist + 1 });
    }
  }

  return null; // No path found within distance limit
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Recalculate dirt paths between all buildings.
 *
 * Steps:
 *   1. Clear all existing 'road' tiles back to 'grass'.
 *   2. Find entrance cells for every building.
 *   3. For each nearby pair, BFS a path and mark cells as 'road'.
 *
 * Modifies ECS tile entities in place.
 */
export function recalculatePaths(): void {
  const lookup = buildLookup();

  // Step 1: Clear existing road tiles back to grass (only tiles, not features)
  for (const entity of tiles.entities) {
    if (entity.tile.terrain === 'road') {
      entity.tile.terrain = 'grass';
    }
  }

  // Also update lookup to reflect cleared roads
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (lookup[y]![x]!.terrain === 'road') {
        lookup[y]![x]!.terrain = 'grass';
      }
    }
  }

  // Step 2: Collect building positions and their entrance cells
  const buildingPositions: { bx: number; by: number; entrances: { x: number; y: number }[] }[] = [];
  for (const entity of buildings.entities) {
    const { gridX, gridY } = entity.position;
    const entrances = findEntrances(gridX, gridY, lookup);
    if (entrances.length > 0) {
      buildingPositions.push({ bx: gridX, by: gridY, entrances });
    }
  }

  // Step 3: For each pair of nearby buildings, find and mark paths
  const pathCells = new Set<string>();

  for (let i = 0; i < buildingPositions.length; i++) {
    const a = buildingPositions[i]!;

    // Find nearest neighbors within MAX_PATH_DISTANCE
    for (let j = i + 1; j < buildingPositions.length; j++) {
      const b = buildingPositions[j]!;
      const dist = Math.abs(a.bx - b.bx) + Math.abs(a.by - b.by);
      if (dist > MAX_PATH_DISTANCE + 2) continue; // +2 for entrance offset

      // Build target set from b's entrances
      const targetSet = new Set<string>();
      for (const e of b.entrances) {
        targetSet.add(`${e.x},${e.y}`);
      }

      const path = bfsPath(a.entrances, targetSet, lookup);
      if (path) {
        for (const cell of path) {
          const key = `${cell.x},${cell.y}`;
          pathCells.add(key);
          // Update lookup so subsequent BFS can reuse this path
          lookup[cell.y]![cell.x]!.terrain = 'road';
        }
      }
    }
  }

  // Step 4: Apply path cells to ECS tile entities
  if (pathCells.size === 0) return;

  for (const entity of tiles.entities) {
    const { gridX, gridY } = entity.position;
    const key = `${gridX},${gridY}`;
    if (pathCells.has(key) && entity.tile.terrain !== 'road') {
      entity.tile.terrain = 'road';
    }
  }
}

/**
 * @module game/workers/autoBuilder
 *
 * Autonomous building placement for the Collective Planner.
 *
 * When the CollectivePlanner decides a building is needed, this module finds
 * a valid grid cell near existing buildings and places new construction
 * foundations autonomously.
 *
 * Placement strategy:
 * 1. Scan cells within Manhattan distance of existing buildings
 * 2. Exclude occupied cells (buildings + impassable terrain features)
 * 3. Exclude edge cells (stay within [1, GRID_SIZE-1))
 * 4. Deduplicate candidates, sort by distance, pick randomly from top N
 */

import { GRID_SIZE } from '@/config';
import { buildings, terrainFeatures } from '@/ecs/archetypes';
import { placeNewBuilding } from '@/ecs/factories/buildingFactories';
import type { Entity } from '@/ecs/world';
import type { GameRng } from '../SeedSystem';

// ── Constants ────────────────────────────────────────────────────────────────

/** Maximum Manhattan distance from an existing building to consider for placement. */
const MAX_PLACEMENT_DISTANCE = 4;

/** Maximum number of candidates to keep before random selection. */
const CANDIDATE_LIMIT = 20;

/** Terrain feature types that block building placement. */
const IMPASSABLE_FEATURES = new Set(['mountain', 'river', 'forest']);

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a set of coordinate keys that are occupied and cannot be built upon.
 * Includes existing building positions and impassable terrain features.
 */
function buildOccupiedSet(): Set<string> {
  const occupied = new Set<string>();

  // Existing building positions
  for (const entity of buildings) {
    occupied.add(`${entity.position.gridX},${entity.position.gridY}`);
  }

  // Impassable terrain features (mountain, river, forest)
  for (const entity of terrainFeatures) {
    if (IMPASSABLE_FEATURES.has(entity.terrainFeature.featureType)) {
      occupied.add(`${entity.position.gridX},${entity.position.gridY}`);
    }
  }

  return occupied;
}

/**
 * Returns true if the given grid cell is within the playable area
 * (excluding edge cells).
 */
function isInBounds(gridX: number, gridY: number): boolean {
  return gridX >= 1 && gridX < GRID_SIZE - 1 && gridY >= 1 && gridY < GRID_SIZE - 1;
}

// ── Public API ───────────────────────────────────────────────────────────────

interface CandidateCell {
  gridX: number;
  gridY: number;
  distance: number;
}

/**
 * Finds a valid grid cell near existing buildings for autonomous placement.
 *
 * Algorithm:
 * 1. Gather all existing building positions
 * 2. If no buildings exist, return null (need a reference point)
 * 3. Build a set of occupied cells (buildings + impassable terrain)
 * 4. For each building, scan cells within MAX_PLACEMENT_DISTANCE Manhattan distance
 * 5. Deduplicate candidates by position (keep closest distance)
 * 6. Sort by distance ascending, pick randomly from top CANDIDATE_LIMIT
 * 7. Return the chosen cell, or null if no candidates
 *
 * @param rng - Seeded random number generator
 * @returns Grid coordinates for placement, or null if no valid cell found
 */
export function findPlacementCell(rng: GameRng): { gridX: number; gridY: number } | null {
  const buildingEntities = buildings.entities;

  // Step 1-2: Need at least one existing building as reference
  if (buildingEntities.length === 0) {
    return null;
  }

  // Step 3: Build occupied set
  const occupied = buildOccupiedSet();

  // Step 4-5: Scan candidates around each building, deduplicate by position
  const candidateMap = new Map<string, CandidateCell>();

  for (const entity of buildingEntities) {
    const bx = entity.position.gridX;
    const by = entity.position.gridY;

    for (let dx = -MAX_PLACEMENT_DISTANCE; dx <= MAX_PLACEMENT_DISTANCE; dx++) {
      for (let dy = -MAX_PLACEMENT_DISTANCE; dy <= MAX_PLACEMENT_DISTANCE; dy++) {
        if (dx === 0 && dy === 0) continue;

        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist > MAX_PLACEMENT_DISTANCE) continue;

        const cx = bx + dx;
        const cy = by + dy;

        if (!isInBounds(cx, cy)) continue;

        const key = `${cx},${cy}`;
        if (occupied.has(key)) continue;

        const existing = candidateMap.get(key);
        if (!existing || dist < existing.distance) {
          candidateMap.set(key, { gridX: cx, gridY: cy, distance: dist });
        }
      }
    }
  }

  // Step 6: Sort by distance ascending, take top N
  const candidates = Array.from(candidateMap.values());
  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => a.distance - b.distance);
  const topCandidates = candidates.slice(0, CANDIDATE_LIMIT);

  // Step 7: Pick randomly from top candidates
  const chosen = topCandidates[rng.pickIndex(topCandidates.length)]!;
  return { gridX: chosen.gridX, gridY: chosen.gridY };
}

/**
 * Autonomously places a building near existing buildings.
 *
 * 1. Finds a valid placement cell using findPlacementCell
 * 2. Places a new building in 'foundation' phase via placeNewBuilding
 * 3. Returns the entity, or null if placement fails
 *
 * @param defId - Building definition ID to place
 * @param rng - Seeded random number generator
 * @returns The placed entity (in 'foundation' phase), or null
 */
export function autoPlaceBuilding(defId: string, rng: GameRng): Entity | null {
  const cell = findPlacementCell(rng);
  if (!cell) {
    return null;
  }

  try {
    return placeNewBuilding(cell.gridX, cell.gridY, defId);
  } catch (e) {
    console.warn(`[autoBuilder] Failed to place ${defId} at (${cell.gridX}, ${cell.gridY}):`, e);
    return null;
  }
}

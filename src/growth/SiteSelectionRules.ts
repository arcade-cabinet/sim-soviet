/**
 * @module growth/SiteSelectionRules
 *
 * Era-aware building placement logic for the CollectiveAgent.
 *
 * Scores candidate cells based on era-specific rules:
 * - Pre-1928 (revolution): Near water, near trees, fire spacing
 * - 1928-1941 (collectivization/industrialization): Cluster admin centrally, farms at edges
 * - 1955+ (thaw/stagnation/eternal): Grid-aligned, services near housing (SNiP walking distances)
 */

import arcologyConfig from '../config/arcology.json';
import { getBuildingDef } from '../data/buildingDefs';
import type { EraId } from '../game/era/types';

// ── Types ───────────────────────────────────────────────────────────────────

export interface PlacementContext {
  gridSize: number;
  buildings: Array<{ x: number; z: number; defId: string }>;
  eraId: string; // Kept for interface compatibility, but largely ignored by brutalist logic
  waterCells: Array<{ x: number; z: number }>;
  treeCells: Array<{ x: number; z: number }>;
  marshCells: Array<{ x: number; z: number }>;
  mountainCells: Array<{ x: number; z: number }>;
  occupiedCells: Set<string>;
  /** Optional fertility data per cell ("x,z" → 0-100). Used for resource-proximity clustering. */
  fertilityCells?: Map<string, number>;
  /** Optional traffic data per cell ("x,z" → count). Used for desire-path awareness. */
  trafficCells?: Map<string, number>;
  /** Optional arcology footprint cells ("x,z" → mergeGroup). Buildings prefer adjacency to matching arcologies. */
  arcologyCells?: Map<string, string>;
}

// ── Arcology merge group lookup (for adjacency-aware placement) ──────────────

const DEF_TO_MERGE_GROUP: Map<string, string> = new Map();
for (const [group, defIds] of Object.entries(arcologyConfig.mergeGroups as Record<string, string[]>)) {
  for (const defId of defIds) {
    DEF_TO_MERGE_GROUP.set(defId, group);
  }
}

// ── Role classification helpers ─────────────────────────────────────────────

function getRole(defId: string): string | undefined {
  return getBuildingDef(defId)?.role;
}

function isAdminOrGov(defId: string): boolean {
  const role = getRole(defId);
  return role === 'government' || role === 'propaganda' || role === 'military';
}

function isFarmOrAgriculture(defId: string): boolean {
  const role = getRole(defId);
  return role === 'agriculture';
}

function isServiceOrCulture(defId: string): boolean {
  const role = getRole(defId);
  return role === 'services' || role === 'culture';
}

function isHousing(defId: string): boolean {
  const role = getRole(defId);
  return role === 'housing';
}

function isIndustry(defId: string): boolean {
  const role = getRole(defId);
  return role === 'industry';
}

// ── Distance helpers ────────────────────────────────────────────────────────

function manhattan(ax: number, az: number, bx: number, bz: number): number {
  return Math.abs(ax - bx) + Math.abs(az - bz);
}

function minDistTo(x: number, z: number, cells: Array<{ x: number; z: number }>): number {
  if (cells.length === 0) return Infinity;
  let min = Infinity;
  for (const c of cells) {
    const d = manhattan(x, z, c.x, c.z);
    if (d < min) min = d;
  }
  return min;
}

function distToCenter(x: number, z: number, gridSize: number): number {
  const center = Math.floor(gridSize / 2);
  return manhattan(x, z, center, center);
}

// ── Fertility scoring ────────────────────────────────────────────────────────

/**
 * Score bonus/penalty based on soil fertility data.
 * Farms strongly prefer high-fertility cells; housing avoids contaminated ground.
 */
function scoreFertility(x: number, z: number, defId: string, ctx: PlacementContext): number {
  if (!ctx.fertilityCells) return 0;
  const fertility = ctx.fertilityCells.get(`${x},${z}`) ?? 50;
  if (isFarmOrAgriculture(defId)) {
    // 0-4 score bonus based on fertility (0-100 mapped to 0-4)
    return (fertility / 100) * 4;
  }
  if (isHousing(defId) && fertility < 20) {
    // Housing avoids contaminated/infertile ground
    return -1;
  }
  return 0;
}

// ── Scoring function ────────────────────────────────────────────────────────

/**
 * Brutalist Practicality Scoring:
 * - State gets the absolute center.
 * - Production snaps to the closest applicable raw resource, polluting/destroying it eventually.
 * - Housing just tries to be near production without sitting on top of valuable resources.
 */
function scoreBrutalist(x: number, z: number, defId: string, ctx: PlacementContext): number {
  let score = 0;
  const centerDist = distToCenter(x, z, ctx.gridSize);

  if (isAdminOrGov(defId)) {
    // The State claims the exact center. Highest priority.
    score += Math.max(0, 20 - centerDist * 2);
  } else if (isFarmOrAgriculture(defId)) {
    // Farms aggressively seek high fertility.
    score += scoreFertility(x, z, defId, ctx);
  } else if (isIndustry(defId)) {
    // Industry seeks raw resources. 
    // For simplicity, we just reward proximity to ANY natural resource tile.
    const waterDist = minDistTo(x, z, ctx.waterCells);
    const treeDist = minDistTo(x, z, ctx.treeCells);
    const marshDist = minDistTo(x, z, ctx.marshCells);
    const mountainDist = minDistTo(x, z, ctx.mountainCells);

    const bestResourceDist = Math.min(waterDist, treeDist, marshDist, mountainDist);
    if (bestResourceDist <= 2) {
      score += 10 - bestResourceDist * 2; // Strong pull to resources
    }
  } else if (isHousing(defId)) {
    // Housing wants to be near existing buildings (workplaces)
    const existingDist = minDistTo(x, z, ctx.buildings);
    if (existingDist <= 3) score += 5;

    // But it SHOULD NOT sit on top of valuable resources if it can help it
    const waterDist = minDistTo(x, z, ctx.waterCells);
    const treeDist = minDistTo(x, z, ctx.treeCells);
    const marshDist = minDistTo(x, z, ctx.marshCells);
    const mountainDist = minDistTo(x, z, ctx.mountainCells);

    if (waterDist === 0 || treeDist === 0 || marshDist === 0 || mountainDist === 0) {
      score -= 10; // Don't waste resource tiles on housing
    }
  } else {
    // Services / everything else just want to be near existing buildings
    const existingDist = minDistTo(x, z, ctx.buildings);
    if (existingDist <= 2) score += 3;
  }

  // Arcology adjacency bonus: prefer cells next to matching arcology footprints
  if (ctx.arcologyCells && ctx.arcologyCells.size > 0) {
    const mergeGroup = DEF_TO_MERGE_GROUP.get(defId);
    if (mergeGroup) {
      for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
        const nKey = `${x + dx},${z + dz}`;
        if (ctx.arcologyCells.get(nKey) === mergeGroup) {
          score += 15; // massive preference to grow arcologies
          break;
        }
      }
    }
  }

  return score;
}

interface ScoredCandidate {
  x: number;
  z: number;
  score: number;
}

// ── Main placement function ─────────────────────────────────────────────────

/**
 * Find the best placement cell for a building based on brutalist practicality.
 *
 * Scores all unoccupied, in-bounds candidates within range of existing buildings,
 * then returns the highest-scoring one. Falls back to null if no valid spot exists.
 *
 * @param defId - Building definition ID to place
 * @param ctx - Placement context with grid state
 * @param maxDistance - Maximum Manhattan distance from existing buildings to search
 * @returns Best placement coordinates, or null if no valid spot found
 */
export function findBestPlacement(
  defId: string,
  ctx: PlacementContext,
  maxDistance = 8,
): { x: number; z: number } | null {
  // If this is the absolute first building (should be HQ), allow placement anywhere by spoofing a center building
  const searchOriginBuildings = ctx.buildings.length > 0 
    ? ctx.buildings 
    : [{ x: Math.floor(ctx.gridSize / 2), z: Math.floor(ctx.gridSize / 2), defId: 'center' }];

  const scored: ScoredCandidate[] = [];
  const candidateSet = new Set<string>();

  for (const b of searchOriginBuildings) {
    for (let dx = -maxDistance; dx <= maxDistance; dx++) {
      for (let dz = -maxDistance; dz <= maxDistance; dz++) {
        // We allow dx=0, dz=0 now in case the only search origin is the fake center
        if (ctx.buildings.length > 0 && dx === 0 && dz === 0) continue;
        if (Math.abs(dx) + Math.abs(dz) > maxDistance) continue;

        const cx = b.x + dx;
        const cz = b.z + dz;

        if (cx < 1 || cx >= ctx.gridSize - 1 || cz < 1 || cz >= ctx.gridSize - 1) continue;

        const key = `${cx},${cz}`;
        if (ctx.occupiedCells.has(key)) continue;
        if (candidateSet.has(key)) continue;
        candidateSet.add(key);

        const score = scoreBrutalist(cx, cz, defId, ctx);
        scored.push({ x: cx, z: cz, score });
      }
    }
  }

  if (scored.length === 0) return null;

  // Sort descending by score, pick the best
  scored.sort((a, b) => b.score - a.score);
  return { x: scored[0]!.x, z: scored[0]!.z };
}

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

import { getBuildingDef } from '../data/buildingDefs';
import type { EraId } from '../game/era/types';

// ── Types ───────────────────────────────────────────────────────────────────

export interface PlacementContext {
  gridSize: number;
  buildings: Array<{ x: number; z: number; defId: string }>;
  eraId: string;
  waterCells: Array<{ x: number; z: number }>;
  treeCells: Array<{ x: number; z: number }>;
  occupiedCells: Set<string>;
}

interface ScoredCandidate {
  x: number;
  z: number;
  score: number;
}

// ── Era grouping ────────────────────────────────────────────────────────────

type EraGroup = 'early' | 'middle' | 'late';

const ERA_GROUP: Record<EraId, EraGroup> = {
  revolution: 'early',
  collectivization: 'middle',
  industrialization: 'middle',
  great_patriotic: 'middle',
  reconstruction: 'middle',
  thaw_and_freeze: 'late',
  stagnation: 'late',
  the_eternal: 'late',
};

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

// ── Scoring functions by era group ──────────────────────────────────────────

function scoreEarly(x: number, z: number, defId: string, ctx: PlacementContext): number {
  let score = 0;

  // Prefer near water (within 3 cells)
  const waterDist = minDistTo(x, z, ctx.waterCells);
  if (waterDist <= 3) score += 3 - waterDist;

  // Prefer near trees (within 2 cells) — timber access
  const treeDist = minDistTo(x, z, ctx.treeCells);
  if (treeDist <= 2) score += 2 - treeDist;

  // Fire spacing: wooden buildings should be 2+ cells apart
  if (isHousing(defId) || isFarmOrAgriculture(defId)) {
    let tooClose = false;
    for (const b of ctx.buildings) {
      if ((isHousing(b.defId) || isFarmOrAgriculture(b.defId)) && manhattan(x, z, b.x, b.z) < 2) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) score -= 5;
  }

  // Slight preference for proximity to existing buildings
  const existingDist = minDistTo(x, z, ctx.buildings);
  if (existingDist <= 4) score += 1;

  return score;
}

function scoreMiddle(x: number, z: number, defId: string, ctx: PlacementContext): number {
  let score = 0;
  const centerDist = distToCenter(x, z, ctx.gridSize);
  const maxDist = ctx.gridSize / 2;

  if (isAdminOrGov(defId)) {
    // Admin buildings cluster centrally
    score += Math.max(0, 5 - centerDist);
  } else if (isFarmOrAgriculture(defId)) {
    // Farms at edges
    score += Math.min(5, centerDist / 2);
  } else if (isIndustry(defId)) {
    // Factories near resources (water) but not dead center
    const waterDist = minDistTo(x, z, ctx.waterCells);
    if (waterDist <= 4) score += 2;
    if (centerDist > 3 && centerDist < maxDist * 0.7) score += 2;
  } else {
    // Housing: moderate distance from center, near existing buildings
    const existingDist = minDistTo(x, z, ctx.buildings);
    if (existingDist <= 3) score += 2;
  }

  return score;
}

function scoreLate(x: number, z: number, defId: string, ctx: PlacementContext): number {
  let score = 0;

  // Grid alignment bonus (even coordinates preferred for SNiP regularity)
  if (x % 2 === 0 && z % 2 === 0) score += 1;

  if (isServiceOrCulture(defId)) {
    // Services within 10 cells of housing (SNiP walking distances)
    let nearHousing = false;
    for (const b of ctx.buildings) {
      if (isHousing(b.defId) && manhattan(x, z, b.x, b.z) <= 10) {
        nearHousing = true;
        break;
      }
    }
    if (nearHousing) score += 4;
    else score -= 2;
  } else if (isHousing(defId)) {
    // Housing clusters together
    let housingNeighbors = 0;
    for (const b of ctx.buildings) {
      if (isHousing(b.defId) && manhattan(x, z, b.x, b.z) <= 4) {
        housingNeighbors++;
      }
    }
    score += Math.min(3, housingNeighbors);
  } else if (isIndustry(defId)) {
    // Industry away from housing
    let nearHousing = false;
    for (const b of ctx.buildings) {
      if (isHousing(b.defId) && manhattan(x, z, b.x, b.z) <= 3) {
        nearHousing = true;
        break;
      }
    }
    if (nearHousing) score -= 2;
    else score += 2;
  }

  // General proximity to existing buildings
  const existingDist = minDistTo(x, z, ctx.buildings);
  if (existingDist <= 3) score += 1;

  return score;
}

// ── Main placement function ─────────────────────────────────────────────────

/**
 * Find the best placement cell for a building based on era-specific rules.
 *
 * Scores all unoccupied, in-bounds candidates within range of existing buildings,
 * then returns the highest-scoring one. Falls back to null if no valid spot exists.
 *
 * @param defId - Building definition ID to place
 * @param ctx - Placement context with grid state and era info
 * @param maxDistance - Maximum Manhattan distance from existing buildings to search
 * @returns Best placement coordinates, or null if no valid spot found
 */
export function findBestPlacement(
  defId: string,
  ctx: PlacementContext,
  maxDistance = 8,
): { x: number; z: number } | null {
  if (ctx.buildings.length === 0) return null;

  const eraGroup = ERA_GROUP[ctx.eraId as EraId] ?? 'early';
  const scored: ScoredCandidate[] = [];

  // Collect candidate cells within maxDistance of any existing building
  const candidateSet = new Set<string>();
  for (const b of ctx.buildings) {
    for (let dx = -maxDistance; dx <= maxDistance; dx++) {
      for (let dz = -maxDistance; dz <= maxDistance; dz++) {
        if (dx === 0 && dz === 0) continue;
        if (Math.abs(dx) + Math.abs(dz) > maxDistance) continue;

        const cx = b.x + dx;
        const cz = b.z + dz;

        if (cx < 1 || cx >= ctx.gridSize - 1 || cz < 1 || cz >= ctx.gridSize - 1) continue;

        const key = `${cx},${cz}`;
        if (ctx.occupiedCells.has(key)) continue;
        if (candidateSet.has(key)) continue;
        candidateSet.add(key);

        let score: number;
        switch (eraGroup) {
          case 'early':
            score = scoreEarly(cx, cz, defId, ctx);
            break;
          case 'middle':
            score = scoreMiddle(cx, cz, defId, ctx);
            break;
          case 'late':
            score = scoreLate(cx, cz, defId, ctx);
            break;
        }

        scored.push({ x: cx, z: cz, score });
      }
    }
  }

  if (scored.length === 0) return null;

  // Sort descending by score, pick the best
  scored.sort((a, b) => b.score - a.score);
  return { x: scored[0]!.x, z: scored[0]!.z };
}

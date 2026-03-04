/**
 * @module ai/agents/infrastructure/displacementSystem
 *
 * Protected covenant demolition cascade: when a protected building needs space,
 * expendable buildings are demolished and residents ejected as displaced dvory.
 *
 * Uses DEMOLITION_PRIORITY from protectedClasses.ts to determine which
 * buildings can be demolished. Lower priority number = demolished first.
 * Protected classes (government, military) are never demolished.
 */

import { classifyBuilding } from '@/config/buildingClassification';
import type { BuildingProtectionClass } from '@/config/protectedClasses';
import { getDemolitionPriority, isProtected } from '@/config/protectedClasses';
import type { Entity } from '@/ecs/world';
import { world } from '@/ecs/world';

// ── Result Types ─────────────────────────────────────────────────────────────

/** Result of demolishing a single building. */
export interface DisplacementResult {
  /** Building definition ID that was demolished */
  demolishedDefId: string;
  /** Grid tile freed by demolition */
  freedTile: { gridX: number; gridY: number };
  /** Number of residents ejected (0 for non-housing) */
  ejectedResidents: number;
  /** Number of households ejected (0 for non-housing) */
  ejectedHouseholds: number;
}

/** Result of a full displacement cascade. */
export interface CascadeResult {
  /** Whether a building was successfully displaced */
  success: boolean;
  /** Displacement details (undefined if success=false) */
  demolished?: DisplacementResult;
}

// ── Core Functions ───────────────────────────────────────────────────────────

/**
 * Finds the lowest-priority building that can be demolished to make room
 * for a building of the given demand class.
 *
 * Only operational buildings with strictly lower priority than the demand
 * class are candidates. Protected buildings are never returned.
 *
 * @param buildings - candidate building entities to consider
 * @param demandClass - protection class of the building that needs space
 * @returns the best candidate for demolition, or null if none qualifies
 */
export function findDisplaceable(buildings: readonly Entity[], demandClass: BuildingProtectionClass): Entity | null {
  const demandPriority = getDemolitionPriority(demandClass);

  let best: Entity | null = null;
  let bestPriority = Number.POSITIVE_INFINITY;

  for (const entity of buildings) {
    if (!entity.building || !entity.position) continue;

    // Skip buildings under construction
    const phase = entity.building.constructionPhase;
    if (phase != null && phase !== 'complete') continue;

    const cls = classifyBuilding(entity.building.defId);

    // Never demolish protected buildings
    if (isProtected(cls)) continue;

    const priority = getDemolitionPriority(cls);

    // Only consider buildings with strictly lower priority than demand
    if (priority >= demandPriority) continue;

    if (priority < bestPriority) {
      bestPriority = priority;
      best = entity;
    }
  }

  return best;
}

/**
 * Demolishes a building entity and returns the displacement result.
 *
 * Removes the entity from the ECS world and reports freed tile coordinates
 * and ejected residents.
 *
 * @param building - the building entity to demolish
 * @returns displacement result with freed tile and ejected residents
 */
export function executeDisplacement(building: Entity): DisplacementResult {
  const defId = building.building!.defId;
  const gridX = building.position!.gridX;
  const gridY = building.position!.gridY;
  const ejectedResidents = building.building!.residentCount;
  const ejectedHouseholds = building.building!.householdCount;

  // Remove from ECS world
  world.remove(building);

  return {
    demolishedDefId: defId,
    freedTile: { gridX, gridY },
    ejectedResidents,
    ejectedHouseholds,
  };
}

/**
 * Orchestrates the full displacement cascade: finds the lowest-priority
 * building below the demand class and demolishes it.
 *
 * @param demandClass - protection class of the building that needs space
 * @param buildings - candidate building entities to consider
 * @returns cascade result indicating success and displacement details
 */
export function cascadeDisplacement(demandClass: BuildingProtectionClass, buildings: readonly Entity[]): CascadeResult {
  const target = findDisplaceable(buildings, demandClass);

  if (!target) {
    return { success: false };
  }

  const demolished = executeDisplacement(target);
  return { success: true, demolished };
}

/**
 * @module ecs/factories/buildingFactories
 *
 * Building entity factory functions: creation, placement, construction lifecycle.
 */

import { getBuildingDef } from '@/data/buildingDefs';
import type { BuildingComponent, Entity, Renderable } from '../world';
import { world } from '../world';

// ── Building Factory ────────────────────────────────────────────────────────

/**
 * Creates a building entity at the given grid position.
 *
 * Reads configuration from buildingDefs.generated.json to populate the
 * building component with correct stats and the renderable with sprite data.
 *
 * @param gridX - Column index on the grid (0-based)
 * @param gridY - Row index on the grid (0-based)
 * @param defId - Building definition ID (sprite ID key into BUILDING_DEFS)
 * @returns The created entity, already added to the world
 */
export function createBuilding(gridX: number, gridY: number, defId: string): Entity {
  const def = getBuildingDef(defId);
  if (!def) throw new Error(`[buildingFactories] Unknown building defId: "${defId}"`);

  // Derive building component from generated defs
  const building: BuildingComponent = {
    defId,
    level: 0,
    powered: false,
    powerReq: def.stats.powerReq,
    powerOutput: def.stats.powerOutput,
    produces: def.stats.produces,
    housingCap: def.stats.housingCap,
    pollution: def.stats.pollution,
    fear: def.stats.fear,
  };

  // Derive renderable from sprite data
  const renderable: Renderable = {
    spriteId: defId,
    spritePath: def.sprite.path,
    footprintX: def.footprint.tilesX,
    footprintY: def.footprint.tilesY,
    visible: true,
  };

  const entity: Entity = {
    position: { gridX, gridY },
    building,
    renderable,
    durability: { current: 100, decayRate: def.stats.decayRate },
    isBuilding: true,
  };

  return world.add(entity);
}

// ── New Building Placement (starts construction) ─────────────────────────────

/**
 * Places a new building on the grid that starts in the 'foundation' phase.
 *
 * Unlike `createBuilding()` (which produces operational buildings for
 * deserialization and tests), this is the function the UI calls when a
 * player places a building. The building must progress through construction
 * phases before it becomes operational.
 *
 * @param gridX - Column index on the grid (0-based)
 * @param gridY - Row index on the grid (0-based)
 * @param defId - Building definition ID
 * @returns The created entity (in 'foundation' phase)
 */
export function placeNewBuilding(gridX: number, gridY: number, defId: string): Entity {
  const def = getBuildingDef(defId);
  if (!def) throw new Error(`[buildingFactories] Unknown building defId: "${defId}"`);

  const building: BuildingComponent = {
    defId,
    level: 0,
    powered: false,
    powerReq: def.stats.powerReq,
    powerOutput: def.stats.powerOutput,
    produces: def.stats.produces,
    housingCap: def.stats.housingCap,
    pollution: def.stats.pollution,
    fear: def.stats.fear,
    constructionPhase: 'foundation',
    constructionProgress: 0,
    constructionTicks: 0,
  };

  const renderable: Renderable = {
    spriteId: defId,
    spritePath: def.sprite.path,
    footprintX: def.footprint.tilesX,
    footprintY: def.footprint.tilesY,
    visible: true,
  };

  const entity: Entity = {
    position: { gridX, gridY },
    building,
    renderable,
    durability: { current: 100, decayRate: def.stats.decayRate },
    isBuilding: true,
  };

  return world.add(entity);
}

/**
 * Marks a building entity as fully constructed (operational).
 *
 * After calling this, the building participates in power/production/housing.
 * You MUST call `world.reindex(entity)` after this for archetype queries
 * to pick up the change.
 */
export function completeConstruction(entity: Entity): void {
  if (entity.building) {
    entity.building.constructionPhase = 'complete';
    entity.building.constructionProgress = 1;
  }
}

/**
 * Returns true if a building entity is operational (not under construction).
 * Buildings without a constructionPhase are treated as operational (backward compat).
 */
export function isOperational(entity: { building: BuildingComponent }): boolean {
  const phase = entity.building.constructionPhase;
  return phase == null || phase === 'complete';
}

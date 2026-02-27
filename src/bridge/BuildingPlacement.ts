/**
 * BuildingPlacement — bridges building placement from UI to ECS.
 *
 * Maps old BUILDING_TYPES tool keys (used by Toolbar) to ECS defIds
 * (used by placeNewBuilding), validates placement, deducts ECS resources,
 * creates ECS entity, and updates the spatial grid.
 */

import { placeNewBuilding } from '@/ecs/factories/buildingFactories';
import { getResourceEntity, tiles } from '@/ecs/archetypes';
import { world } from '@/ecs/world';
import { getBuildingDef } from '@/data/buildingDefs';
import { BUILDING_TYPES } from '../engine/BuildingTypes';
import { getGameGrid } from './GameInit';
import { notifyStateChange } from '@/stores/gameStore';
import { GRID_SIZE } from '@/config';

/**
 * Map from old Toolbar tool keys → ECS building defIds.
 *
 * Zone tools directly place the cheapest building of their category
 * (the 2D game auto-grew buildings on zones; in 3D we place immediately).
 */
const TOOL_TO_DEF_ID: Record<string, string> = {
  // Zone tools → place basic building of that category
  'zone-res': 'workers-house-a',       // Cheapest housing (80₽)
  'zone-ind': 'factory-office',        // Basic industry (180₽)
  'zone-farm': 'collective-farm-hq',   // Agriculture (150₽)

  // Infrastructure
  power: 'power-station',
  nuke: 'power-station',         // No reactor model yet — use power station
  station: 'train-station',
  pump: 'warehouse',             // Water pump → warehouse (closest utility)

  // State buildings
  tower: 'radio-station',        // Propaganda tower → radio station
  gulag: 'gulag-admin',
  mast: 'fire-station',          // Aero-mast → fire station (closest match)
  space: 'government-hq',        // Cosmodrome → govt HQ placeholder
};

/**
 * Attempt to place a building via ECS.
 *
 * Returns true if the building was placed, false if placement was invalid
 * or the tool doesn't map to an ECS building.
 */
export function placeECSBuilding(
  toolKey: string,
  gridX: number,
  gridZ: number,
): boolean {
  // Skip non-building tools
  if (
    toolKey === 'none' ||
    toolKey === 'bulldoze' ||
    toolKey === 'pipe' ||
    toolKey === 'road'
  ) {
    return false;
  }

  // Map tool key to ECS defId
  const defId = TOOL_TO_DEF_ID[toolKey];
  if (!defId) {
    console.warn(`[BuildingPlacement] No ECS defId mapping for tool "${toolKey}"`);
    return false;
  }

  // Validate grid bounds
  if (gridX < 0 || gridZ < 0 || gridX >= GRID_SIZE || gridZ >= GRID_SIZE) {
    return false;
  }

  // Check spatial grid occupancy
  const grid = getGameGrid();
  if (grid) {
    const cell = grid.getCell(gridX, gridZ);
    if (cell?.type) return false; // Already occupied
  }

  // Check affordability from ECS resources
  const res = getResourceEntity();
  if (!res) return false;

  const def = getBuildingDef(defId);
  const cost = def?.presentation.cost ?? BUILDING_TYPES[toolKey]?.cost ?? 0;
  if (res.resources.money < cost) return false;

  // Deduct cost from ECS resources
  res.resources.money -= cost;

  // Create ECS building entity (starts construction)
  const entity = placeNewBuilding(gridX, gridZ, defId);

  // Update spatial grid
  if (grid) {
    grid.setCell(gridX, gridZ, defId);
  }

  // Reindex so archetypes pick up the new entity immediately
  world.reindex(entity);

  // Notify React
  notifyStateChange();

  return true;
}

/**
 * Remove a building from ECS at the given grid position.
 * Returns true if a building was found and removed.
 */
export function bulldozeECSBuilding(gridX: number, gridZ: number): boolean {
  const { buildings } = require('@/ecs/archetypes');
  for (const entity of buildings.entities) {
    if (entity.position.gridX === gridX && entity.position.gridY === gridZ) {
      world.remove(entity);

      // Clear spatial grid
      const grid = getGameGrid();
      if (grid) {
        grid.setCell(gridX, gridZ, null);
      }

      notifyStateChange();
      return true;
    }
  }
  return false;
}

/**
 * BuildingPlacement — bridges building placement from UI to ECS.
 *
 * Maps old Toolbar tool keys to ECS defIds (used by placeNewBuilding),
 * validates placement and material affordability, creates ECS entity,
 * and updates the spatial grid.
 *
 * Also handles building upgrades via upgradeECSBuilding().
 */

import { placeNewBuilding } from '@/ecs/factories/buildingFactories';
import { buildings as buildingsArchetype, getResourceEntity, tiles } from '@/ecs/archetypes';
import { world } from '@/ecs/world';
import { getBuildingDef } from '@/data/buildingDefs';
import { DEFAULT_MATERIAL_COST } from '@/ecs/systems/constructionSystem';
import { getEngine, getGameGrid } from './GameInit';
import { notifyStateChange } from '@/stores/gameStore';
import { GRID_SIZE } from '@/config';
import { gameState } from '../engine/GameState';
import SFXManager from '../audio/SFXManager';

// ── Upgrade Chains ───────────────────────────────────────────────────────────

/**
 * Upgrade chains: maps a base defId to the ordered list of defIds in
 * that upgrade path. Level = index in the array.
 *
 * Only buildings listed here can be upgraded. All others are max level.
 */
const UPGRADE_CHAINS: readonly (readonly string[])[] = [
  // Housing: workers-house-a → apartment-tower-a → apartment-tower-c
  ['workers-house-a', 'apartment-tower-a', 'apartment-tower-c'],
  // Industry: warehouse → factory-office → bread-factory
  ['warehouse', 'factory-office', 'bread-factory'],
  // Government: ministry-office → government-hq → kgb-office
  ['ministry-office', 'government-hq', 'kgb-office'],
] as const;

/** Reverse lookup: defId → { chain, level } */
const UPGRADE_LOOKUP = new Map<string, { chain: readonly string[]; level: number }>();
for (const chain of UPGRADE_CHAINS) {
  for (let i = 0; i < chain.length; i++) {
    UPGRADE_LOOKUP.set(chain[i], { chain, level: i });
  }
}

/** Cost multiplier by target level (level 1 = 1.5×, level 2 = 2.5× base cost). */
const UPGRADE_COST_MULTIPLIER: Record<number, number> = {
  1: 1.5,
  2: 2.5,
};

/**
 * Get upgrade info for a building at the given defId.
 * Returns null if the building cannot be upgraded (not in a chain or already max level).
 */
export function getUpgradeInfo(defId: string): {
  nextDefId: string;
  currentLevel: number;
  nextLevel: number;
  maxLevel: number;
  cost: number;
} | null {
  const entry = UPGRADE_LOOKUP.get(defId);
  if (!entry) return null;

  const { chain, level } = entry;
  const nextLevel = level + 1;
  if (nextLevel >= chain.length) return null; // Already at max

  const nextDefId = chain[nextLevel];
  const nextDef = getBuildingDef(nextDefId);
  if (!nextDef) {
    console.error(`[BuildingPlacement] getUpgradeInfo: unknown defId "${nextDefId}" in upgrade chain`);
    return null;
  }
  const baseCost = nextDef.presentation.cost;
  const multiplier = UPGRADE_COST_MULTIPLIER[nextLevel] ?? 1;
  const cost = Math.ceil(baseCost * multiplier);

  return {
    nextDefId,
    currentLevel: level,
    nextLevel,
    maxLevel: chain.length - 1,
    cost,
  };
}

/**
 * Check if a building defId is part of an upgrade chain.
 */
export function isUpgradeable(defId: string): boolean {
  const entry = UPGRADE_LOOKUP.get(defId);
  if (!entry) return false;
  return entry.level < entry.chain.length - 1;
}

/**
 * Get the current upgrade level for a defId (0-based).
 * Returns 0 if the defId is not in any upgrade chain.
 */
export function getUpgradeLevel(defId: string): number {
  return UPGRADE_LOOKUP.get(defId)?.level ?? 0;
}

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
  nuke: 'cooling-tower',          // Reactor → cooling tower (bpy-scripted model)
  station: 'train-station',
  pump: 'warehouse',             // Water pump → warehouse (closest utility)

  // State buildings
  tower: 'radio-station',        // Propaganda tower → radio station
  gulag: 'gulag-admin',
  mast: 'fire-station',          // Aero-mast → fire station (closest match)
  space: 'government-hq',        // Cosmodrome → govt HQ placeholder
};

/**
 * Check if the player has enough materials to start construction.
 * Uses building's constructionCost or fallback defaults.
 * Note: materials are NOT deducted here — constructionSystem
 * handles per-tick deduction during the build process.
 */
function canAffordMaterials(
  resources: { timber: number; steel: number; cement: number; prefab: number },
  defId: string
): boolean {
  const def = getBuildingDef(defId);
  const cc = def?.stats.constructionCost;
  const timber = cc?.timber ?? DEFAULT_MATERIAL_COST.timber;
  const steel = cc?.steel ?? DEFAULT_MATERIAL_COST.steel;
  const cement = cc?.cement ?? DEFAULT_MATERIAL_COST.cement;
  const prefab = cc?.prefab ?? 0;
  return (
    resources.timber >= timber &&
    resources.steel >= steel &&
    resources.cement >= cement &&
    resources.prefab >= prefab
  );
}

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

  // Validate material affordability (constructionSystem deducts per-tick)
  if (!canAffordMaterials(res.resources, defId)) return false;

  // Create ECS building entity (starts construction)
  const entity = placeNewBuilding(gridX, gridZ, defId);

  // Update spatial grid
  if (grid) {
    grid.setCell(gridX, gridZ, defId);
  }

  // Sync old gameState so legacy scene components see the building
  const oldCell = gameState.grid[gridZ]?.[gridX];
  if (oldCell) {
    oldCell.type = defId;
  }
  gameState.buildings.push({
    x: gridX,
    y: gridZ,
    type: defId,
    powered: false,
    level: 0,
  });

  // Track building placement for Five-Year Plan mandate fulfillment
  const engine = getEngine();
  if (engine) {
    engine.recordBuildingForMandates(defId);
  }

  // Reindex so archetypes pick up the new entity immediately
  world.reindex(entity);

  // Play building placement sound effect
  SFXManager.getInstance().play('building_place');

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

      // Sync old gameState so legacy scene components see the removal
      const oldCell = gameState.grid[gridZ]?.[gridX];
      if (oldCell) {
        oldCell.type = null;
      }
      const bIdx = gameState.buildings.findIndex(
        (b) => b.x === gridX && b.y === gridZ,
      );
      if (bIdx !== -1) gameState.buildings.splice(bIdx, 1);

      // Play demolition sound effect
      SFXManager.getInstance().play('building_demolish');

      notifyStateChange();
      return true;
    }
  }
  return false;
}

// ── Building Upgrade ──────────────────────────────────────────────────────────

/**
 * Attempt to upgrade a building at the given grid position.
 *
 * Returns an object with `success` and a human-readable `reason` on failure.
 * On success, the ECS entity's defId and level are updated, the model will
 * automatically swap because BuildingRenderer detects type changes.
 */
export function upgradeECSBuilding(
  gridX: number,
  gridZ: number,
): { success: boolean; reason?: string } {
  // Find the ECS building entity at this position
  const entity = buildingsArchetype.entities.find(
    (e) => e.position.gridX === gridX && e.position.gridY === gridZ,
  );
  if (!entity) {
    return { success: false, reason: 'No building at this position' };
  }

  // Must be operational (not under construction)
  const phase = entity.building.constructionPhase;
  if (phase && phase !== 'complete') {
    return { success: false, reason: 'Building is under construction' };
  }

  // Check upgrade availability
  const upgradeInfo = getUpgradeInfo(entity.building.defId);
  if (!upgradeInfo) {
    return { success: false, reason: 'Building is already at maximum level' };
  }

  // Check affordability
  const res = getResourceEntity();
  if (!res) {
    return { success: false, reason: 'Resource store not found' };
  }

  // FIX-03: Validate upgrade def BEFORE charging the player
  const newDef = getBuildingDef(upgradeInfo.nextDefId);
  if (!newDef) {
    return { success: false, reason: `Unknown upgrade target: "${upgradeInfo.nextDefId}"` };
  }

  if (res.resources.money < upgradeInfo.cost) {
    return { success: false, reason: `Insufficient funds (need ${upgradeInfo.cost} rubles)` };
  }

  // Deduct cost (only after all validation passes)
  res.resources.money -= upgradeInfo.cost;

  // Update ECS building component — newDef guaranteed non-null
  entity.building.defId = upgradeInfo.nextDefId;
  entity.building.level = upgradeInfo.nextLevel;
  entity.building.powerReq = newDef.stats.powerReq;
  entity.building.powerOutput = newDef.stats.powerOutput;
  entity.building.housingCap = newDef.stats.housingCap;
  entity.building.pollution = newDef.stats.pollution;
  entity.building.fear = newDef.stats.fear;
  entity.building.produces = newDef.stats.produces;

  // Update renderable sprite info
  if (entity.renderable) {
    entity.renderable.spriteId = upgradeInfo.nextDefId;
    entity.renderable.spritePath = newDef.sprite.path;
    entity.renderable.footprintX = newDef.footprint.tilesX;
    entity.renderable.footprintY = newDef.footprint.tilesY;
  }

  // Update spatial grid
  const grid = getGameGrid();
  if (grid) {
    grid.setCell(gridX, gridZ, upgradeInfo.nextDefId);
  }

  // Sync legacy GameState
  const oldCell = gameState.grid[gridZ]?.[gridX];
  if (oldCell) {
    oldCell.type = upgradeInfo.nextDefId;
  }
  const legacyBuilding = gameState.buildings.find(
    (b) => b.x === gridX && b.y === gridZ,
  );
  if (legacyBuilding) {
    legacyBuilding.type = upgradeInfo.nextDefId;
    legacyBuilding.level = upgradeInfo.nextLevel;
  }

  // Reindex so archetypes reflect the change
  world.reindex(entity);

  // Notify React to re-render
  notifyStateChange();

  return { success: true };
}

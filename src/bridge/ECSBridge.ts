/**
 * ECSBridge — reads ECS archetypes and produces data structures
 * for the BabylonJS 3D rendering layer.
 *
 * The 3D renderers (BuildingRenderer, TerrainGrid, etc.) expect flat arrays.
 * This module reads from Miniplex ECS entities and converts them to the
 * shapes the 3D components understand.
 */

import { buildings, tiles, terrainFeatures } from '@/ecs/archetypes';
import type { BuildingState } from '../scene/BuildingRenderer';
import type { GridCell, TerrainType } from '../engine/GridTypes';
import { GRID_SIZE } from '@/config';

/**
 * Read ECS building entities and produce BuildingState[] for the 3D renderer.
 *
 * The archive's building defIds (e.g. "apartment-tower-a", "vodka-distillery")
 * match the GLB model names directly, so `type` is the defId.
 */
export function getBuildingStates(): BuildingState[] {
  // Build a quick elevation lookup from terrain features
  const elevationMap = new Map<string, number>();
  for (const entity of terrainFeatures.entities) {
    const { gridX, gridY } = entity.position;
    elevationMap.set(`${gridX}_${gridY}`, entity.terrainFeature.elevation);
  }
  for (const entity of tiles.entities) {
    const { gridX, gridY } = entity.position;
    if (entity.tile.elevation > 0) {
      elevationMap.set(`${gridX}_${gridY}`, entity.tile.elevation);
    }
  }

  return buildings.entities.map((entity) => {
    const { position, building } = entity;
    const key = `${position.gridX}_${position.gridY}`;
    return {
      id: key,
      type: building.defId,
      level: building.level ?? 0,
      gridX: position.gridX,
      gridY: position.gridY,
      elevation: elevationMap.get(key) ?? 0,
      powered: building.powered,
      onFire: false, // ECS doesn't track fire state yet
    };
  });
}

/**
 * Read ECS tile entities and produce a 2D GridCell[][] for the terrain renderer.
 *
 * The 3D TerrainGrid expects the flat-array grid format from the old GameState.
 * This bridges ECS tiles to that format.
 */
export function getGridCells(): GridCell[][] {
  const grid: GridCell[][] = [];

  // Initialize empty grid
  for (let y = 0; y < GRID_SIZE; y++) {
    const row: GridCell[] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      row.push({
        type: null,
        zone: null,
        z: 0,
        terrain: 'grass' as TerrainType,
        isRail: false,
        bridge: false,
        smog: 0,
        onFire: 0,
        hasPipe: false,
        watered: false,
      });
    }
    grid.push(row);
  }

  // Populate from ECS tile entities
  for (const entity of tiles.entities) {
    const { position, tile } = entity;
    const { gridX, gridY } = position;
    if (gridY >= 0 && gridY < GRID_SIZE && gridX >= 0 && gridX < GRID_SIZE) {
      const cell = grid[gridY][gridX];
      // Map ECS terrain type to 3D terrain type
      cell.terrain = mapTerrain(tile.terrain);
      cell.z = tile.elevation;
    }
  }

  // Overlay terrain features (mountains, forests, marshes, rivers)
  // These are separate ECS entities from tiles — MapSystem creates them
  for (const entity of terrainFeatures.entities) {
    const { position, terrainFeature } = entity;
    const { gridX, gridY } = position;
    if (gridY >= 0 && gridY < GRID_SIZE && gridX >= 0 && gridX < GRID_SIZE) {
      const cell = grid[gridY][gridX];
      cell.terrain = mapTerrain(terrainFeature.featureType);
      cell.z = terrainFeature.elevation;
    }
  }

  // Mark building cells
  for (const entity of buildings.entities) {
    const { position, building } = entity;
    const { gridX, gridY } = position;
    if (gridY >= 0 && gridY < GRID_SIZE && gridX >= 0 && gridX < GRID_SIZE) {
      grid[gridY][gridX].type = building.defId;
    }
  }

  return grid;
}

/** Map ECS terrain names to the 3D renderer's TerrainType. */
function mapTerrain(ecsTerrain: string): TerrainType {
  switch (ecsTerrain) {
    case 'water':
    case 'river':
      return 'water';
    case 'mountain':
      return 'mountain';
    case 'forest':
      return 'tree';
    case 'marsh':
      return 'marsh';
    case 'road':
    case 'foundation':
    default:
      return 'grass';
  }
}

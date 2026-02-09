/**
 * @module ecs/factories
 *
 * Entity factory functions for SimSoviet 2000.
 *
 * Each factory creates a pre-configured entity with the correct components
 * and adds it to the world. Building stats are sourced from the generated
 * buildingDefs.generated.json (via the Zod-validated data layer).
 */

import { GRID_SIZE } from '@/config';
import { getBuildingDef } from '@/data/buildingDefs';
import type {
  BuildingComponent,
  CitizenComponent,
  Entity,
  Renderable,
  TileComponent,
} from './world';
import { world } from './world';

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

  // Derive building component from generated defs
  const building: BuildingComponent = {
    defId,
    powered: false,
    powerReq: def?.stats.powerReq ?? 0,
    powerOutput: def?.stats.powerOutput ?? 0,
    produces: def?.stats.produces,
    housingCap: def?.stats.housingCap ?? 0,
    pollution: def?.stats.pollution ?? 0,
    fear: def?.stats.fear ?? 0,
  };

  // Derive renderable from sprite data
  const renderable: Renderable = {
    spriteId: defId,
    spritePath: def?.sprite.path ?? '',
    footprintX: def?.footprint.tilesX ?? 1,
    footprintY: def?.footprint.tilesY ?? 1,
    visible: true,
  };

  const entity: Entity = {
    position: { gridX, gridY },
    building,
    renderable,
    durability: { current: 100, decayRate: def?.stats.decayRate ?? 0.05 },
    isBuilding: true,
  };

  return world.add(entity);
}

// ── Citizen Factory ─────────────────────────────────────────────────────────

/**
 * Creates a citizen entity.
 *
 * New citizens start at the center of the grid if no home is assigned.
 *
 * @param citizenClass - Occupation / social class
 * @param homeX        - Optional grid X of housing assignment
 * @param homeY        - Optional grid Y of housing assignment
 * @returns The created entity, already added to the world
 */
export function createCitizen(
  citizenClass: CitizenComponent['class'],
  homeX?: number,
  homeY?: number
): Entity {
  const citizen: CitizenComponent = {
    class: citizenClass,
    happiness: 50,
    hunger: 0,
    home: homeX != null && homeY != null ? { gridX: homeX, gridY: homeY } : undefined,
  };

  const entity: Entity = {
    position: {
      gridX: homeX ?? Math.floor(GRID_SIZE / 2),
      gridY: homeY ?? Math.floor(GRID_SIZE / 2),
    },
    citizen,
    isCitizen: true,
  };

  return world.add(entity);
}

// ── Tile Factory ────────────────────────────────────────────────────────────

/**
 * Creates a single tile entity.
 *
 * @param gridX   - Column index on the grid
 * @param gridY   - Row index on the grid
 * @param terrain - Terrain type for this tile
 * @returns The created entity, already added to the world
 */
export function createTile(
  gridX: number,
  gridY: number,
  terrain: TileComponent['terrain'] = 'grass'
): Entity {
  const tile: TileComponent = {
    terrain,
    elevation: 0,
  };

  const entity: Entity = {
    position: { gridX, gridY },
    tile,
    isTile: true,
  };

  return world.add(entity);
}

// ── Resource Store Factory ──────────────────────────────────────────────────

/**
 * Creates the singleton resource store entity.
 *
 * If a resource store already exists in the world, this is a no-op and
 * returns the existing entity.
 *
 * @param initialValues - Optional partial override of starting resources
 * @returns The resource store entity
 */
export function createResourceStore(
  initialValues?: Partial<{
    money: number;
    food: number;
    vodka: number;
    power: number;
    powerUsed: number;
    population: number;
  }>
): Entity {
  // Check for existing store
  const existing = world.with('resources', 'isResourceStore');
  if (existing.entities.length > 0) {
    return existing.entities[0]!;
  }

  const entity: Entity = {
    resources: {
      money: initialValues?.money ?? 2000,
      food: initialValues?.food ?? 200,
      vodka: initialValues?.vodka ?? 50,
      power: initialValues?.power ?? 0,
      powerUsed: initialValues?.powerUsed ?? 0,
      population: initialValues?.population ?? 0,
    },
    isResourceStore: true,
  };

  return world.add(entity);
}

// ── Grid Factory ────────────────────────────────────────────────────────────

/**
 * Initializes the full grid as tile entities.
 *
 * Creates `size * size` tile entities, all starting as 'grass'.
 * Existing tiles are NOT removed — call this only once during
 * world initialization.
 *
 * @param size - Grid dimension (default: GRID_SIZE from config)
 */
export function createGrid(size: number = GRID_SIZE): void {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      createTile(x, y, 'grass');
    }
  }
}

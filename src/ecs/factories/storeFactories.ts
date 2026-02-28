/**
 * @module ecs/factories/storeFactories
 *
 * Singleton store factories (resource store, meta store) and
 * tile/grid factories.
 */

import { GRID_SIZE } from '@/config';
import type { Entity, GameMeta, TileComponent } from '../world';
import { world } from '../world';

// ── Tile Factory ────────────────────────────────────────────────────────────

/**
 * Creates a single tile entity.
 *
 * @param gridX   - Column index on the grid
 * @param gridY   - Row index on the grid
 * @param terrain - Terrain type for this tile
 * @returns The created entity, already added to the world
 */
export function createTile(gridX: number, gridY: number, terrain: TileComponent['terrain'] = 'grass'): Entity {
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
    trudodni: number;
    blat: number;
    timber: number;
    steel: number;
    cement: number;
    prefab: number;
    seedFund: number;
    emergencyReserve: number;
    storageCapacity: number;
  }>,
): Entity {
  // Check for existing store
  const existing = world.with('resources', 'isResourceStore');
  if (existing.entities.length > 0) {
    return existing.entities[0]!;
  }

  const entity: Entity = {
    resources: {
      money: initialValues?.money ?? 2000,
      food: initialValues?.food ?? 600,
      vodka: initialValues?.vodka ?? 50,
      power: initialValues?.power ?? 0,
      powerUsed: initialValues?.powerUsed ?? 0,
      population: initialValues?.population ?? 12,
      trudodni: initialValues?.trudodni ?? 0,
      blat: initialValues?.blat ?? 10,
      timber: initialValues?.timber ?? 30,
      steel: initialValues?.steel ?? 10,
      cement: initialValues?.cement ?? 0,
      prefab: initialValues?.prefab ?? 0,
      seedFund: initialValues?.seedFund ?? 1.0,
      emergencyReserve: initialValues?.emergencyReserve ?? 0,
      storageCapacity: initialValues?.storageCapacity ?? 200,
    },
    isResourceStore: true,
  };

  return world.add(entity);
}

// ── Meta Store Factory ────────────────────────────────────────────────────

/**
 * Creates the singleton game metadata entity.
 *
 * If a meta store already exists in the world, this is a no-op and
 * returns the existing entity.
 *
 * @param initialValues - Optional partial override of starting metadata
 * @returns The meta store entity
 */
export function createMetaStore(initialValues?: Partial<GameMeta>): Entity {
  const existing = world.with('gameMeta', 'isMetaStore');
  if (existing.entities.length > 0) {
    return existing.entities[0]!;
  }

  const entity: Entity = {
    gameMeta: {
      seed: initialValues?.seed ?? '',
      date: initialValues?.date ?? { year: 1922, month: 10, tick: 0 },
      quota: initialValues?.quota ?? {
        type: 'food',
        target: 500,
        current: 0,
        deadlineYear: 1927,
      },
      selectedTool: initialValues?.selectedTool ?? 'none',
      gameOver: initialValues?.gameOver ?? null,
      leaderName: initialValues?.leaderName,
      leaderPersonality: initialValues?.leaderPersonality,
      settlementTier: initialValues?.settlementTier ?? 'selo',
      blackMarks: initialValues?.blackMarks ?? 0,
      commendations: initialValues?.commendations ?? 0,
      threatLevel: initialValues?.threatLevel ?? 'safe',
      currentEra: initialValues?.currentEra ?? 'revolution',
      roadQuality: initialValues?.roadQuality ?? 'none',
      roadCondition: initialValues?.roadCondition ?? 100,
    },
    isMetaStore: true,
  };

  return world.add(entity);
}

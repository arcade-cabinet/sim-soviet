import { world } from '../world';
import type { Entity, GameMeta, Resources, TileComponent } from '../world';
import * as h3 from 'h3-js';
import { RES_SETTLEMENT } from '../../game/map/global/GlobalHexManager';

// ── Resource Store Factory ──────────────────────────────────────────────────

/**
 * Creates the singleton resource stockpile entity.
 */
export function createResourceStore(initialValues?: Partial<Resources>): Entity {
  const existing = world.with('resources', 'isResourceStore');
  if (existing.entities.length > 0) {
    return existing.entities[0]!;
  }

  const entity: Entity = {
    resources: {
      money: initialValues?.money ?? 0,
      food: initialValues?.food ?? 500,
      timber: initialValues?.timber ?? 200,
      steel: initialValues?.steel ?? 0,
      cement: initialValues?.cement ?? 0,
      vodka: initialValues?.vodka ?? 100,
      power: initialValues?.power ?? 0,
      powerUsed: initialValues?.powerUsed ?? 0,
      population: initialValues?.population ?? 0,
      trudodni: initialValues?.trudodni ?? 0,
      blat: initialValues?.blat ?? 0,
      prefab: initialValues?.prefab ?? 0,
      seedFund: initialValues?.seedFund ?? 0,
      emergencyReserve: initialValues?.emergencyReserve ?? 0,
      storageCapacity: initialValues?.storageCapacity ?? 0,
      oxygen: initialValues?.oxygen ?? 100,
      oxygenProduction: initialValues?.oxygenProduction ?? 0,
      hydrogen: initialValues?.hydrogen ?? 0,
      water: initialValues?.water ?? 100,
      waterRecycling: initialValues?.waterRecycling ?? 0,
      rareEarths: initialValues?.rareEarths ?? 0,
      uranium: initialValues?.uranium ?? 0,
      rocketFuel: initialValues?.rocketFuel ?? 0,
      raion: initialValues?.raion,
    },
    isResourceStore: true,
  };

  return world.add(entity);
}

// ── Meta Store Factory ────────────────────────────────────────────────────

/**
 * Creates the singleton game metadata entity.
 */
export function createMetaStore(initialValues?: Partial<GameMeta>): Entity {
  const existing = world.with('gameMeta', 'isMetaStore');
  if (existing.entities.length > 0) {
    return existing.entities[0]!;
  }

  const seedStr = initialValues?.seed ?? 'sim-soviet';
  const startHex = h3.latLngToCell(55.75, 37.61, RES_SETTLEMENT);

  const entity: Entity = {
    gameMeta: {
      seed: seedStr,
      date: initialValues?.date ?? { year: 1917, month: 10, tick: 0 },
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
      currentHex: initialValues?.currentHex ?? startHex,
      currentEra: initialValues?.currentEra ?? 'revolution',
      roadQuality: initialValues?.roadQuality ?? 'none',
      roadCondition: initialValues?.roadCondition ?? 100,
    },
    isMetaStore: true,
  };

  return world.add(entity);
}

// ── Grid / Tile Factories ──────────────────────────────────────────────────

/**
 * Creates an individual tile entity with resource components.
 */
export function createTile(x: number, y: number, initialValues?: Partial<TileComponent>): Entity {
  const entity: Entity = {
    position: { gridX: x, gridY: y },
    tile: {
      terrain: initialValues?.terrain ?? 'grass',
      elevation: initialValues?.elevation ?? 0,
      timber: initialValues?.timber ?? 0,
      minerals: initialValues?.minerals ?? 0,
      waterTable: initialValues?.waterTable ?? 50,
      soilFertility: initialValues?.soilFertility ?? 50,
      peat: initialValues?.peat ?? 0,
      permafrost: initialValues?.permafrost ?? 0,
      pollution: 0,
      erosion: 0,
    },
    isTile: true,
  };

  return world.add(entity);
}

/**
 * Creates a full grid of tile entities.
 */
export function createGrid(size: number): Entity[] {
  const tiles: Entity[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      tiles.push(createTile(x, y));
    }
  }
  return tiles;
}

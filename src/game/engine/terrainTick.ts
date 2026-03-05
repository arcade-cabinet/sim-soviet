/**
 * terrainTick — per-tile terrain resource tick for ECS TileComponent entities.
 *
 * Processes resource depletion from adjacent buildings, natural regeneration,
 * pollution spread, erosion, permafrost thaw, and health/infrastructure impacts.
 *
 * Runs every tick (12/year). Annual regeneration only fires on year boundaries.
 * All mutations are direct on TileComponent fields (ECS is mutable).
 */

import type { With } from 'miniplex';
import type { Entity, TileComponent } from '@/ecs/world';
import terrainConfig from '@/config/terrain-resources.json';
import ecologyConfig from '@/config/ecology.json';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TerrainTickContext {
  /** Miniplex world (provides .with() queries) */
  world: {
    with: (...components: string[]) => { entities: Entity[] };
  };
  /** Current simulation year */
  year: number;
  /** Ticks per year (normally 12) */
  ticksPerYear: number;
  /** Climate trend from WorldAgent, -1 (cooling) to +1 (warming) */
  climateTrend: number;
  /** True on the first tick of each year (annual regeneration fires here) */
  isYearBoundary: boolean;
}

export interface TerrainTickResult {
  /** Tiles where pollution exceeds health threshold (50). */
  pollutedTiles: number;
  /** Tiles where erosion is active (erosion > 0). */
  erodingTiles: number;
  /** Tiles where permafrost is thawing (year >= 2050, permafrost defined). */
  thawingTiles: number;
  /** Average soil fertility across all tiles. */
  avgSoilFertility: number;
  /** Average timber across all tiles. */
  avgTimber: number;
}

// ── Config references ─────────────────────────────────────────────────────────

const depletion = terrainConfig.depletionRates;
const pollutionRules = terrainConfig.pollutionRules;
const erosionRules = terrainConfig.erosionRules;
const permafrostThaw = ecologyConfig.ecologicalCollapse.permafrostThaw;

// ── Building type classification ──────────────────────────────────────────────

/** Building defIds that act as farms (deplete soil, draw water). */
const FARM_IDS = new Set(['collective-farm-hq']);

/** Building defIds that act as factories (pollution + water contamination). */
const FACTORY_IDS = new Set(['factory-office', 'bread-factory', 'vodka-distillery']);

/** Building defIds that act as power stations (pollution). */
const POWER_IDS = new Set(['power-station', 'cooling-tower']);

/** All building defIds that produce pollution (for neighbor lookup). */
const POLLUTION_SOURCES = new Set([...FACTORY_IDS, ...POWER_IDS]);

// ── Helpers ───────────────────────────────────────────────────────────────────

type TileEntity = With<Entity, 'position' | 'tile'>;
type BuildingEntity = With<Entity, 'position' | 'building'>;

/**
 * Build a spatial index of tile entities keyed by "gridX,gridY".
 */
function buildTileIndex(tileEntities: TileEntity[]): Map<string, TileEntity> {
  const map = new Map<string, TileEntity>();
  for (const entity of tileEntities) {
    map.set(`${entity.position.gridX},${entity.position.gridY}`, entity);
  }
  return map;
}

/**
 * Build a spatial index of building entities keyed by "gridX,gridY".
 * Multiple buildings can occupy the same tile (rare, but handle it).
 */
function buildBuildingIndex(buildingEntities: BuildingEntity[]): Map<string, BuildingEntity[]> {
  const map = new Map<string, BuildingEntity[]>();
  for (const entity of buildingEntities) {
    const key = `${entity.position.gridX},${entity.position.gridY}`;
    const list = map.get(key);
    if (list) {
      list.push(entity);
    } else {
      map.set(key, [entity]);
    }
  }
  return map;
}

/**
 * Get the 4 cardinal neighbor keys for a grid position.
 */
function getNeighborKeys(gridX: number, gridY: number): string[] {
  return [
    `${gridX - 1},${gridY}`,
    `${gridX + 1},${gridY}`,
    `${gridX},${gridY - 1}`,
    `${gridX},${gridY + 1}`,
  ];
}

/**
 * Check if a tile is adjacent to a water tile.
 */
function isRiverAdjacent(gridX: number, gridY: number, tileIndex: Map<string, TileEntity>): boolean {
  for (const key of getNeighborKeys(gridX, gridY)) {
    const neighbor = tileIndex.get(key);
    if (neighbor && neighbor.tile.terrain === 'water') {
      return true;
    }
  }
  return false;
}

/**
 * Check if this tile has a building of a given type on it.
 */
function hasBuildingOfType(
  gridX: number,
  gridY: number,
  typeSet: Set<string>,
  buildingIndex: Map<string, BuildingEntity[]>,
): boolean {
  const buildings = buildingIndex.get(`${gridX},${gridY}`);
  if (!buildings) return false;
  return buildings.some((b) => typeSet.has(b.building.defId));
}

/**
 * Check if this tile is adjacent to any building (for timber depletion).
 */
function isAdjacentToBuilding(
  gridX: number,
  gridY: number,
  buildingIndex: Map<string, BuildingEntity[]>,
): boolean {
  for (const key of getNeighborKeys(gridX, gridY)) {
    if (buildingIndex.has(key)) return true;
  }
  // Also check the tile itself
  return buildingIndex.has(`${gridX},${gridY}`);
}

/**
 * Check if any neighboring tile has a building that is a mine (has minerals on tile).
 * For simplicity: a "mine" is any building on a tile with minerals > 0.
 */
function hasMiningActivity(
  gridX: number,
  gridY: number,
  buildingIndex: Map<string, BuildingEntity[]>,
  tile: TileComponent,
): boolean {
  // Mining happens when there's a building on a tile with minerals
  const buildings = buildingIndex.get(`${gridX},${gridY}`);
  if (!buildings) return false;
  return (tile.minerals ?? 0) > 0;
}

// ── Main tick function ────────────────────────────────────────────────────────

/**
 * Process per-tile terrain resource changes each tick.
 *
 * Mutates TileComponent fields directly (ECS convention).
 * Returns summary statistics for the pressure system.
 */
export function terrainTick(ctx: TerrainTickContext): TerrainTickResult {
  const tileEntities = ctx.world.with('position', 'tile').entities as TileEntity[];
  const buildingEntities = ctx.world.with('position', 'building').entities as BuildingEntity[];

  if (tileEntities.length === 0) {
    return {
      pollutedTiles: 0,
      erodingTiles: 0,
      thawingTiles: 0,
      avgSoilFertility: 0,
      avgTimber: 0,
    };
  }

  const tileIndex = buildTileIndex(tileEntities);
  const buildingIndex = buildBuildingIndex(buildingEntities);
  const perTickFactor = 1 / ctx.ticksPerYear;

  // ── Pass 1: Resource depletion and pollution generation ──
  for (const entity of tileEntities) {
    const tile = entity.tile;
    const gx = entity.position.gridX;
    const gy = entity.position.gridY;

    // 1a. Farm depletion: soil fertility + water table
    if (hasBuildingOfType(gx, gy, FARM_IDS, buildingIndex)) {
      if (tile.soilFertility !== undefined) {
        tile.soilFertility = Math.max(0, tile.soilFertility - depletion.soilFertility.perFarmingTick);
      }
      if (tile.waterTable !== undefined) {
        tile.waterTable = Math.max(0, tile.waterTable - depletion.waterTable.perIrrigationTick);
      }
    }

    // 1b. Factory pollution + water contamination
    if (hasBuildingOfType(gx, gy, FACTORY_IDS, buildingIndex)) {
      tile.pollution = (tile.pollution ?? 0) + pollutionRules.perFactoryTick;
      if (tile.waterTable !== undefined) {
        tile.waterTable = Math.max(0, tile.waterTable - depletion.waterTable.perIndustrialTick);
      }
    }

    // 1c. Power station pollution
    if (hasBuildingOfType(gx, gy, POWER_IDS, buildingIndex)) {
      tile.pollution = (tile.pollution ?? 0) + pollutionRules.perPowerStationTick;
    }

    // 1d. Mining: mineral depletion + pollution
    if (hasMiningActivity(gx, gy, buildingIndex, tile)) {
      tile.minerals = Math.max(0, (tile.minerals ?? 0) - depletion.minerals.perMiningTick);
      tile.pollution = (tile.pollution ?? 0) + pollutionRules.perMiningTick;
    }

    // 1e. Timber depletion: tiles adjacent to any building lose timber
    if ((tile.timber ?? 0) > 0 && isAdjacentToBuilding(gx, gy, buildingIndex)) {
      tile.timber = Math.max(0, (tile.timber ?? 0) - depletion.timber.perLoggingTick);
    }
  }

  // ── Pass 2: Pollution diffusion ──
  // Collect pollution values before diffusion to avoid order-dependent spreading
  const preDiffusionPollution = new Map<string, number>();
  for (const entity of tileEntities) {
    const key = `${entity.position.gridX},${entity.position.gridY}`;
    preDiffusionPollution.set(key, entity.tile.pollution ?? 0);
  }

  for (const entity of tileEntities) {
    const gx = entity.position.gridX;
    const gy = entity.position.gridY;
    const myPollution = preDiffusionPollution.get(`${gx},${gy}`) ?? 0;

    if (myPollution <= 0) continue;

    // Spread pollution to cardinal neighbors
    for (const neighborKey of getNeighborKeys(gx, gy)) {
      const neighbor = tileIndex.get(neighborKey);
      if (!neighbor) continue;
      // Water tiles do not absorb pollution spread
      if (neighbor.tile.terrain === 'water') continue;
      const diffusion = myPollution * pollutionRules.diffusionRatePerTick;
      neighbor.tile.pollution = (neighbor.tile.pollution ?? 0) + diffusion;
    }
  }

  // ── Pass 3: Erosion ──
  for (const entity of tileEntities) {
    const tile = entity.tile;

    // Erosion triggers when timber drops below threshold
    if ((tile.timber ?? 100) < erosionRules.triggerWhenTimberBelow) {
      // Erosion increases proportional to how depleted timber is
      const timberDeficit = erosionRules.triggerWhenTimberBelow - (tile.timber ?? 0);
      const erosionIncrease = (timberDeficit / erosionRules.triggerWhenTimberBelow) * 0.1;
      tile.erosion = Math.min(100, (tile.erosion ?? 0) + erosionIncrease);

      // Erosion damages soil fertility
      if (tile.soilFertility !== undefined && (tile.erosion ?? 0) > 0) {
        tile.soilFertility = Math.max(
          0,
          tile.soilFertility - erosionRules.soilFertilityDamageRate,
        );
      }
    }
  }

  // ── Pass 4: Permafrost thaw ──
  let thawingCount = 0;
  if (ctx.year >= permafrostThaw.startYear) {
    // Thaw rate accelerates with climate trend and years past 2050
    const yearsPast = ctx.year - permafrostThaw.startYear;
    const baseThawRate = depletion.permafrost.perWarmingDegreePerYear * perTickFactor;
    // Climate trend amplifies thaw: positive trend = more warming
    const trendAmplifier = 1 + Math.max(0, ctx.climateTrend);
    const thawRate = baseThawRate * trendAmplifier * (1 + yearsPast * 0.01);

    for (const entity of tileEntities) {
      const tile = entity.tile;
      if (tile.permafrost !== undefined && tile.permafrost > 0) {
        tile.permafrost = Math.max(0, tile.permafrost - thawRate);
        thawingCount++;
      }
    }
  }

  // ── Pass 5: Annual regeneration (only on year boundary) ──
  if (ctx.isYearBoundary) {
    for (const entity of tileEntities) {
      const tile = entity.tile;
      const gx = entity.position.gridX;
      const gy = entity.position.gridY;

      // Timber regeneration (up to max)
      if (tile.timber !== undefined && tile.timber < depletion.timber.maxRegenLevel) {
        tile.timber = Math.min(
          depletion.timber.maxRegenLevel,
          tile.timber + depletion.timber.naturalRegenPerYear,
        );
      }

      // Soil fertility regeneration (up to max)
      if (tile.soilFertility !== undefined && tile.soilFertility < depletion.soilFertility.maxRegenLevel) {
        tile.soilFertility = Math.min(
          depletion.soilFertility.maxRegenLevel,
          tile.soilFertility + depletion.soilFertility.naturalRegenPerYear,
        );
      }

      // Peat regeneration (up to max)
      if (tile.peat !== undefined && tile.peat < depletion.peat.maxRegenLevel) {
        tile.peat = Math.min(
          depletion.peat.maxRegenLevel,
          tile.peat + depletion.peat.naturalRegenPerYear,
        );
      }

      // Water table recharge — river-adjacent tiles recharge faster
      if (tile.waterTable !== undefined && tile.waterTable < 100) {
        const rechargeRate = isRiverAdjacent(gx, gy, tileIndex)
          ? depletion.waterTable.riverRechargePerYear
          : depletion.waterTable.noRiverRechargePerYear;
        tile.waterTable = Math.min(100, tile.waterTable + rechargeRate);
      }

      // Pollution natural decay
      if (tile.pollution !== undefined && tile.pollution > 0) {
        tile.pollution = Math.max(0, tile.pollution - pollutionRules.naturalDecayPerYear);
      }

      // Minerals: NO regeneration (non-renewable)
    }
  }

  // ── Pass 6: Compute summary stats + threshold flags ──
  let pollutedCount = 0;
  let erodingCount = 0;
  let totalSoilFertility = 0;
  let soilCount = 0;
  let totalTimber = 0;
  let timberCount = 0;

  for (const entity of tileEntities) {
    const tile = entity.tile;

    // Clamp pollution to 0-100
    if (tile.pollution !== undefined) {
      tile.pollution = Math.min(100, Math.max(0, tile.pollution));
    }

    // Health/infrastructure impact flags via pollution thresholds
    if ((tile.pollution ?? 0) >= pollutionRules.healthImpactThreshold) {
      pollutedCount++;
    }

    // Erosion tracking
    if ((tile.erosion ?? 0) > 0) {
      erodingCount++;
    }

    // Soil fertility average
    if (tile.soilFertility !== undefined) {
      totalSoilFertility += tile.soilFertility;
      soilCount++;
    }

    // Timber average
    if (tile.timber !== undefined) {
      totalTimber += tile.timber;
      timberCount++;
    }
  }

  return {
    pollutedTiles: pollutedCount,
    erodingTiles: erodingCount,
    thawingTiles: thawingCount,
    avgSoilFertility: soilCount > 0 ? totalSoilFertility / soilCount : 0,
    avgTimber: timberCount > 0 ? totalTimber / timberCount : 0,
  };
}

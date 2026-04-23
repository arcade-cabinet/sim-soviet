/**
 * Tests for src/game/engine/terrainTick.ts — ECS-based per-tile terrain resource tick.
 *
 * Covers: timber depletion, soil fertility depletion, mineral depletion,
 * pollution generation/spread, natural regeneration, erosion triggering,
 * permafrost thaw, and threshold flagging.
 */

import type { BuildingComponent, Entity, TileComponent } from '@/ecs/world';
import { type TerrainTickContext, terrainTick } from '../../src/game/engine/terrainTick';

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeTile(gridX: number, gridY: number, overrides: Partial<TileComponent> = {}): Entity {
  return {
    position: { gridX, gridY },
    tile: {
      terrain: 'grass',
      elevation: 0,
      timber: 50,
      minerals: 0,
      waterTable: 60,
      soilFertility: 70,
      peat: 0,
      permafrost: 0,
      pollution: 0,
      erosion: 0,
      ...overrides,
    },
  };
}

function makeBuilding(gridX: number, gridY: number, defId: string, overrides: Partial<BuildingComponent> = {}): Entity {
  return {
    position: { gridX, gridY },
    building: {
      defId,
      level: 0,
      powered: true,
      powerReq: 0,
      powerOutput: 0,
      housingCap: 0,
      pollution: 0,
      fear: 0,
      workerCount: 10,
      residentCount: 0,
      avgMorale: 50,
      avgSkill: 50,
      avgLoyalty: 50,
      avgVodkaDep: 10,
      trudodniAccrued: 0,
      householdCount: 0,
      ...overrides,
    },
  };
}

/**
 * Create a mock world object that returns entities based on component queries.
 */
function makeWorld(entities: Entity[]) {
  return {
    with: (...components: string[]) => {
      const filtered = entities.filter((e) => {
        for (const c of components) {
          if (!(c in e) || (e as any)[c] === undefined) return false;
        }
        return true;
      });
      return { entities: filtered };
    },
  };
}

function makeCtx(entities: Entity[], overrides: Partial<Omit<TerrainTickContext, 'world'>> = {}): TerrainTickContext {
  return {
    world: makeWorld(entities),
    year: 1950,
    ticksPerYear: 12,
    climateTrend: 0,
    isYearBoundary: false,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('terrainTick', () => {
  describe('empty world', () => {
    it('returns zeroed result with no tiles', () => {
      const result = terrainTick(makeCtx([]));
      expect(result.pollutedTiles).toBe(0);
      expect(result.erodingTiles).toBe(0);
      expect(result.thawingTiles).toBe(0);
      expect(result.avgSoilFertility).toBe(0);
      expect(result.avgTimber).toBe(0);
    });

    it('returns correct averages with tiles but no buildings', () => {
      const entities = [
        makeTile(0, 0, { soilFertility: 60, timber: 40 }),
        makeTile(1, 0, { soilFertility: 80, timber: 60 }),
      ];
      const result = terrainTick(makeCtx(entities));
      expect(result.avgSoilFertility).toBe(70);
      expect(result.avgTimber).toBe(50);
    });
  });

  describe('timber depletion near buildings', () => {
    it('depletes timber on tiles adjacent to buildings', () => {
      const tile = makeTile(1, 0, { timber: 50 });
      const building = makeBuilding(0, 0, 'workers-house-a');
      const ctx = makeCtx([tile, building]);

      terrainTick(ctx);

      // perLoggingTick = 0.5
      expect(tile.tile!.timber).toBe(49.5);
    });

    it('depletes timber on the building tile itself', () => {
      const tile = makeTile(0, 0, { timber: 50 });
      const building = makeBuilding(0, 0, 'workers-house-a');
      const ctx = makeCtx([tile, building]);

      terrainTick(ctx);

      expect(tile.tile!.timber).toBe(49.5);
    });

    it('does not deplete timber on tiles not adjacent to any building', () => {
      const tile = makeTile(5, 5, { timber: 50 });
      const building = makeBuilding(0, 0, 'workers-house-a');
      const ctx = makeCtx([tile, building]);

      terrainTick(ctx);

      expect(tile.tile!.timber).toBe(50);
    });

    it('does not go below 0', () => {
      const tile = makeTile(1, 0, { timber: 0.1 });
      const building = makeBuilding(0, 0, 'workers-house-a');
      const ctx = makeCtx([tile, building]);

      terrainTick(ctx);

      expect(tile.tile!.timber).toBe(0);
    });

    it('does not deplete timber when timber is already 0', () => {
      const tile = makeTile(1, 0, { timber: 0 });
      const building = makeBuilding(0, 0, 'workers-house-a');
      const ctx = makeCtx([tile, building]);

      terrainTick(ctx);

      expect(tile.tile!.timber).toBe(0);
    });
  });

  describe('soil fertility depletion near farms', () => {
    it('depletes soil fertility on farm tile', () => {
      const tile = makeTile(0, 0, { soilFertility: 70 });
      const building = makeBuilding(0, 0, 'collective-farm-hq');
      const ctx = makeCtx([tile, building]);

      terrainTick(ctx);

      // perFarmingTick = 0.05
      expect(tile.tile!.soilFertility).toBeCloseTo(70 - 0.05, 5);
    });

    it('depletes water table on farm tile', () => {
      const tile = makeTile(0, 0, { waterTable: 60 });
      const building = makeBuilding(0, 0, 'collective-farm-hq');
      const ctx = makeCtx([tile, building]);

      terrainTick(ctx);

      // perIrrigationTick = 0.1
      expect(tile.tile!.waterTable).toBeCloseTo(60 - 0.1, 5);
    });

    it('does not deplete soil below 0', () => {
      const tile = makeTile(0, 0, { soilFertility: 0.01 });
      const building = makeBuilding(0, 0, 'collective-farm-hq');
      const ctx = makeCtx([tile, building]);

      terrainTick(ctx);

      expect(tile.tile!.soilFertility).toBe(0);
    });

    it('does not deplete soil on non-farm buildings', () => {
      const tile = makeTile(0, 0, { soilFertility: 70 });
      const building = makeBuilding(0, 0, 'factory-office');
      const ctx = makeCtx([tile, building]);

      terrainTick(ctx);

      // Factory does not cause soil depletion
      expect(tile.tile!.soilFertility).toBe(70);
    });
  });

  describe('mineral depletion (non-renewable)', () => {
    it('depletes minerals when a building exists on a tile with minerals', () => {
      const tile = makeTile(0, 0, { minerals: 60 });
      const building = makeBuilding(0, 0, 'factory-office');
      const ctx = makeCtx([tile, building]);

      terrainTick(ctx);

      // perMiningTick = 0.3
      expect(tile.tile!.minerals).toBeCloseTo(60 - 0.3, 5);
    });

    it('does not deplete minerals when no building present', () => {
      const tile = makeTile(0, 0, { minerals: 60 });
      const ctx = makeCtx([tile]);

      terrainTick(ctx);

      expect(tile.tile!.minerals).toBe(60);
    });

    it('does not go below 0', () => {
      const tile = makeTile(0, 0, { minerals: 0.1 });
      const building = makeBuilding(0, 0, 'factory-office');
      const ctx = makeCtx([tile, building]);

      terrainTick(ctx);

      expect(tile.tile!.minerals).toBe(0);
    });

    it('minerals have NO natural regeneration on year boundary', () => {
      const tile = makeTile(0, 0, { minerals: 30 });
      const ctx = makeCtx([tile], { isYearBoundary: true });

      terrainTick(ctx);

      // minerals maxRegenLevel = 0, naturalRegenPerYear = 0
      expect(tile.tile!.minerals).toBe(30);
    });
  });

  describe('pollution generation', () => {
    it('factories generate pollution', () => {
      const tile = makeTile(0, 0, { pollution: 0 });
      const building = makeBuilding(0, 0, 'factory-office');
      const ctx = makeCtx([tile, building]);

      terrainTick(ctx);

      // perFactoryTick = 0.3
      expect(tile.tile!.pollution).toBeCloseTo(0.3, 5);
    });

    it('power stations generate pollution', () => {
      const tile = makeTile(0, 0, { pollution: 0 });
      const building = makeBuilding(0, 0, 'power-station');
      const ctx = makeCtx([tile, building]);

      terrainTick(ctx);

      // perPowerStationTick = 0.2
      expect(tile.tile!.pollution).toBeCloseTo(0.2, 5);
    });

    it('mining generates pollution', () => {
      const tile = makeTile(0, 0, { pollution: 0, minerals: 50 });
      const building = makeBuilding(0, 0, 'factory-office');
      const ctx = makeCtx([tile, building]);

      terrainTick(ctx);

      // Factory pollution (0.3) + mining pollution (0.4) = 0.7
      expect(tile.tile!.pollution).toBeCloseTo(0.7, 5);
    });

    it('vodka distillery generates factory-level pollution', () => {
      const tile = makeTile(0, 0, { pollution: 0 });
      const building = makeBuilding(0, 0, 'vodka-distillery');
      const ctx = makeCtx([tile, building]);

      terrainTick(ctx);

      expect(tile.tile!.pollution).toBeCloseTo(0.3, 5);
    });

    it('pollution is clamped to 100', () => {
      const tile = makeTile(0, 0, { pollution: 99.9 });
      const building = makeBuilding(0, 0, 'factory-office');
      const ctx = makeCtx([tile, building]);

      terrainTick(ctx);

      expect(tile.tile!.pollution).toBeLessThanOrEqual(100);
    });
  });

  describe('pollution spread (diffusion)', () => {
    it('spreads pollution to cardinal neighbors', () => {
      const center = makeTile(1, 1, { pollution: 50 });
      const north = makeTile(1, 0, { pollution: 0 });
      const south = makeTile(1, 2, { pollution: 0 });
      const east = makeTile(2, 1, { pollution: 0 });
      const west = makeTile(0, 1, { pollution: 0 });
      const ctx = makeCtx([center, north, south, east, west]);

      terrainTick(ctx);

      // diffusionRatePerTick = 0.02, so each neighbor gets 50 * 0.02 = 1.0
      expect(north.tile!.pollution).toBeCloseTo(1.0, 5);
      expect(south.tile!.pollution).toBeCloseTo(1.0, 5);
      expect(east.tile!.pollution).toBeCloseTo(1.0, 5);
      expect(west.tile!.pollution).toBeCloseTo(1.0, 5);
    });

    it('does not spread pollution to water tiles', () => {
      const center = makeTile(1, 1, { pollution: 50 });
      const waterTile = makeTile(1, 0, { terrain: 'water', pollution: 0 });
      const ctx = makeCtx([center, waterTile]);

      terrainTick(ctx);

      expect(waterTile.tile!.pollution).toBe(0);
    });

    it('does not spread to diagonal neighbors', () => {
      const center = makeTile(1, 1, { pollution: 50 });
      const diagonal = makeTile(2, 2, { pollution: 0 });
      const ctx = makeCtx([center, diagonal]);

      terrainTick(ctx);

      expect(diagonal.tile!.pollution).toBe(0);
    });
  });

  describe('natural regeneration (annual)', () => {
    it('timber regenerates on year boundary', () => {
      const tile = makeTile(0, 0, { timber: 30 });
      const ctx = makeCtx([tile], { isYearBoundary: true });

      terrainTick(ctx);

      // naturalRegenPerYear = 2.0
      expect(tile.tile!.timber).toBe(32);
    });

    it('timber does not exceed maxRegenLevel (80)', () => {
      const tile = makeTile(0, 0, { timber: 79.5 });
      const ctx = makeCtx([tile], { isYearBoundary: true });

      terrainTick(ctx);

      expect(tile.tile!.timber).toBe(80);
    });

    it('timber does not regenerate above maxRegenLevel', () => {
      const tile = makeTile(0, 0, { timber: 85 });
      const ctx = makeCtx([tile], { isYearBoundary: true });

      terrainTick(ctx);

      // Already above max regen level — no change
      expect(tile.tile!.timber).toBe(85);
    });

    it('soil fertility regenerates on year boundary', () => {
      const tile = makeTile(0, 0, { soilFertility: 40 });
      const ctx = makeCtx([tile], { isYearBoundary: true });

      terrainTick(ctx);

      // naturalRegenPerYear = 1.0
      expect(tile.tile!.soilFertility).toBe(41);
    });

    it('soil does not exceed maxRegenLevel (60)', () => {
      const tile = makeTile(0, 0, { soilFertility: 59.5 });
      const ctx = makeCtx([tile], { isYearBoundary: true });

      terrainTick(ctx);

      expect(tile.tile!.soilFertility).toBe(60);
    });

    it('peat regenerates slowly on year boundary', () => {
      const tile = makeTile(0, 0, { peat: 15 });
      const ctx = makeCtx([tile], { isYearBoundary: true });

      terrainTick(ctx);

      // naturalRegenPerYear = 0.1
      expect(tile.tile!.peat).toBeCloseTo(15.1, 5);
    });

    it('water table recharges from river adjacency', () => {
      const tile = makeTile(0, 0, { waterTable: 50 });
      const waterTile = makeTile(1, 0, { terrain: 'water' });
      const ctx = makeCtx([tile, waterTile], { isYearBoundary: true });

      terrainTick(ctx);

      // riverRechargePerYear = 5.0
      expect(tile.tile!.waterTable).toBe(55);
    });

    it('water table recharges slowly without river', () => {
      const tile = makeTile(0, 0, { waterTable: 50 });
      const ctx = makeCtx([tile], { isYearBoundary: true });

      terrainTick(ctx);

      // noRiverRechargePerYear = 0.5
      expect(tile.tile!.waterTable).toBe(50.5);
    });

    it('water table does not exceed 100', () => {
      const tile = makeTile(0, 0, { waterTable: 99 });
      const waterTile = makeTile(1, 0, { terrain: 'water' });
      const ctx = makeCtx([tile, waterTile], { isYearBoundary: true });

      terrainTick(ctx);

      expect(tile.tile!.waterTable).toBe(100);
    });

    it('pollution decays annually', () => {
      const tile = makeTile(0, 0, { pollution: 30 });
      const ctx = makeCtx([tile], { isYearBoundary: true });

      terrainTick(ctx);

      // naturalDecayPerYear = 1.0
      expect(tile.tile!.pollution).toBe(29);
    });

    it('pollution does not go below 0 from annual decay', () => {
      const tile = makeTile(0, 0, { pollution: 0.5 });
      const ctx = makeCtx([tile], { isYearBoundary: true });

      terrainTick(ctx);

      expect(tile.tile!.pollution).toBe(0);
    });

    it('does not regenerate on non-year-boundary ticks', () => {
      const tile = makeTile(0, 0, { timber: 30, soilFertility: 40, waterTable: 50, pollution: 10 });
      const ctx = makeCtx([tile], { isYearBoundary: false });

      terrainTick(ctx);

      expect(tile.tile!.timber).toBe(30);
      expect(tile.tile!.soilFertility).toBe(40);
      expect(tile.tile!.waterTable).toBe(50);
      // Pollution unchanged because no sources or year boundary
      expect(tile.tile!.pollution).toBe(10);
    });
  });

  describe('erosion triggering', () => {
    it('triggers erosion when timber drops below 20', () => {
      const tile = makeTile(0, 0, { timber: 10, erosion: 0, soilFertility: 70 });
      const ctx = makeCtx([tile]);

      terrainTick(ctx);

      expect(tile.tile!.erosion).toBeGreaterThan(0);
    });

    it('does not trigger erosion when timber is above 20', () => {
      const tile = makeTile(0, 0, { timber: 25, erosion: 0 });
      const ctx = makeCtx([tile]);

      terrainTick(ctx);

      expect(tile.tile!.erosion).toBe(0);
    });

    it('erosion damages soil fertility', () => {
      const tile = makeTile(0, 0, { timber: 5, erosion: 0, soilFertility: 70 });
      const ctx = makeCtx([tile]);

      terrainTick(ctx);

      // soilFertilityDamageRate = 0.1
      expect(tile.tile!.soilFertility).toBeLessThan(70);
    });

    it('erosion does not exceed 100', () => {
      const tile = makeTile(0, 0, { timber: 0, erosion: 99.99 });
      const ctx = makeCtx([tile]);

      terrainTick(ctx);

      expect(tile.tile!.erosion).toBeLessThanOrEqual(100);
    });

    it('erosion increases more when timber is 0 vs 10', () => {
      const tile0 = makeTile(0, 0, { timber: 0, erosion: 0 });
      const tile10 = makeTile(1, 0, { timber: 10, erosion: 0 });
      const ctx = makeCtx([tile0, tile10]);

      terrainTick(ctx);

      expect(tile0.tile!.erosion).toBeGreaterThan(tile10.tile!.erosion!);
    });

    it('counts eroding tiles in result', () => {
      const erodingTile = makeTile(0, 0, { timber: 5, erosion: 0, soilFertility: 70 });
      const stableTile = makeTile(1, 0, { timber: 50, erosion: 0 });
      const ctx = makeCtx([erodingTile, stableTile]);

      const result = terrainTick(ctx);

      expect(result.erodingTiles).toBe(1);
    });
  });

  describe('permafrost thaw', () => {
    it('does not thaw before grounded post-campaign free play', () => {
      const tile = makeTile(0, 0, { permafrost: 80 });
      const ctx = makeCtx([tile], { year: 1991 });

      terrainTick(ctx);

      expect(tile.tile!.permafrost).toBe(80);
    });

    it('thaws after the 1991 campaign endpoint', () => {
      const tile = makeTile(0, 0, { permafrost: 80 });
      const ctx = makeCtx([tile], { year: 1995 });

      terrainTick(ctx);

      expect(tile.tile!.permafrost).toBeLessThan(80);
    });

    it('thaws faster with positive climate trend', () => {
      const tile1 = makeTile(0, 0, { permafrost: 80 });
      const tile2 = makeTile(1, 0, { permafrost: 80 });

      const ctx1 = makeCtx([tile1], { year: 1995, climateTrend: 0 });
      terrainTick(ctx1);

      const ctx2 = makeCtx([tile2], { year: 1995, climateTrend: 1.0 });
      terrainTick(ctx2);

      expect(tile2.tile!.permafrost).toBeLessThan(tile1.tile!.permafrost!);
    });

    it('thaws faster in later years', () => {
      const tile1 = makeTile(0, 0, { permafrost: 80 });
      const tile2 = makeTile(1, 0, { permafrost: 80 });

      const ctx1 = makeCtx([tile1], { year: 1992 });
      terrainTick(ctx1);

      const ctx2 = makeCtx([tile2], { year: 1999 });
      terrainTick(ctx2);

      expect(tile2.tile!.permafrost).toBeLessThan(tile1.tile!.permafrost!);
    });

    it('permafrost does not go below 0', () => {
      const tile = makeTile(0, 0, { permafrost: 0.001 });
      const ctx = makeCtx([tile], { year: 1999, climateTrend: 1.0 });

      terrainTick(ctx);

      expect(tile.tile!.permafrost).toBe(0);
    });

    it('counts thawing tiles in result', () => {
      const thawing = makeTile(0, 0, { permafrost: 50 });
      const noPermafrost = makeTile(1, 0, { permafrost: 0 });
      const undefinedPermafrost = makeTile(2, 0);
      // Remove permafrost from the third tile
      delete undefinedPermafrost.tile!.permafrost;
      const ctx = makeCtx([thawing, noPermafrost, undefinedPermafrost], { year: 1995 });

      const result = terrainTick(ctx);

      // Only the tile with permafrost > 0 is thawing
      expect(result.thawingTiles).toBe(1);
    });

    it('does not thaw tiles with undefined permafrost', () => {
      const tile = makeTile(0, 0);
      delete tile.tile!.permafrost;
      const ctx = makeCtx([tile], { year: 1995 });

      const result = terrainTick(ctx);

      expect(result.thawingTiles).toBe(0);
    });
  });

  describe('threshold flagging', () => {
    it('flags tiles with pollution >= 50 as polluted', () => {
      // Place tiles far apart so diffusion does not cross-contaminate
      const clean = makeTile(0, 0, { pollution: 10 });
      const polluted = makeTile(10, 10, { pollution: 50 });
      const veryPolluted = makeTile(20, 20, { pollution: 80 });
      const ctx = makeCtx([clean, polluted, veryPolluted]);

      const result = terrainTick(ctx);

      expect(result.pollutedTiles).toBe(2);
    });

    it('returns 0 polluted tiles when none exceed threshold', () => {
      const tile = makeTile(0, 0, { pollution: 30 });
      const ctx = makeCtx([tile]);

      const result = terrainTick(ctx);

      expect(result.pollutedTiles).toBe(0);
    });
  });

  describe('combined scenarios', () => {
    it('farm depletes soil AND water table simultaneously', () => {
      const tile = makeTile(0, 0, { soilFertility: 70, waterTable: 60 });
      const farm = makeBuilding(0, 0, 'collective-farm-hq');
      const ctx = makeCtx([tile, farm]);

      terrainTick(ctx);

      expect(tile.tile!.soilFertility).toBeLessThan(70);
      expect(tile.tile!.waterTable).toBeLessThan(60);
    });

    it('factory creates pollution AND depletes water table', () => {
      const tile = makeTile(0, 0, { pollution: 0, waterTable: 60 });
      const factory = makeBuilding(0, 0, 'factory-office');
      const ctx = makeCtx([tile, factory]);

      terrainTick(ctx);

      expect(tile.tile!.pollution).toBeGreaterThan(0);
      expect(tile.tile!.waterTable).toBeLessThan(60);
    });

    it('depletion and regeneration compete on year boundary', () => {
      const tile = makeTile(0, 0, { timber: 30 });
      const building = makeBuilding(0, 0, 'workers-house-a');
      const ctx = makeCtx([tile, building], { isYearBoundary: true });

      terrainTick(ctx);

      // Timber: -0.5 (depletion) + 2.0 (regen) = net +1.5
      expect(tile.tile!.timber).toBeCloseTo(31.5, 5);
    });

    it('multi-tick simulation accumulates effects', () => {
      const tile = makeTile(0, 0, { soilFertility: 70 });
      const farm = makeBuilding(0, 0, 'collective-farm-hq');

      // Simulate 12 ticks (1 year)
      for (let i = 0; i < 12; i++) {
        const ctx = makeCtx([tile, farm], { isYearBoundary: i === 11 });
        terrainTick(ctx);
      }

      // 12 ticks of depletion at 0.05 each = 0.6 depletion
      // Plus 1 year boundary regen of 1.0 (if below 60)
      // Net: 70 - 0.6 = 69.4 (above 60, so no regen applies)
      expect(tile.tile!.soilFertility).toBeLessThan(70);
      expect(tile.tile!.soilFertility).toBeGreaterThan(69);
    });

    it('handles a realistic settlement layout', () => {
      const entities: Entity[] = [];

      // 3x3 grid of tiles
      for (let x = 0; x < 3; x++) {
        for (let y = 0; y < 3; y++) {
          entities.push(
            makeTile(x, y, {
              timber: 40,
              soilFertility: 60,
              waterTable: 70,
              pollution: 0,
            }),
          );
        }
      }

      // Farm at center, factory at top-left
      entities.push(makeBuilding(1, 1, 'collective-farm-hq'));
      entities.push(makeBuilding(0, 0, 'factory-office'));

      const ctx = makeCtx(entities);
      const result = terrainTick(ctx);

      // Average stats should be reasonable
      expect(result.avgSoilFertility).toBeGreaterThan(50);
      expect(result.avgTimber).toBeGreaterThan(30);
      expect(result.pollutedTiles).toBe(0); // pollution too low for threshold
    });
  });

  describe('water factory contamination', () => {
    it('factory depletes water table via industrial tick', () => {
      const tile = makeTile(0, 0, { waterTable: 60 });
      const factory = makeBuilding(0, 0, 'bread-factory');
      const ctx = makeCtx([tile, factory]);

      terrainTick(ctx);

      // perIndustrialTick = 0.2
      expect(tile.tile!.waterTable).toBeCloseTo(60 - 0.2, 5);
    });
  });

  describe('edge cases', () => {
    it('handles tiles with undefined optional fields', () => {
      const tile: Entity = {
        position: { gridX: 0, gridY: 0 },
        tile: { terrain: 'grass', elevation: 0 },
      };
      const ctx = makeCtx([tile]);

      // Should not throw
      const result = terrainTick(ctx);
      expect(result.avgSoilFertility).toBe(0);
      expect(result.avgTimber).toBe(0);
    });

    it('handles multiple buildings on same tile', () => {
      const tile = makeTile(0, 0, { pollution: 0, soilFertility: 70, waterTable: 60 });
      const farm = makeBuilding(0, 0, 'collective-farm-hq');
      const factory = makeBuilding(0, 0, 'factory-office');
      const ctx = makeCtx([tile, farm, factory]);

      terrainTick(ctx);

      // Both farm depletion AND factory pollution should apply
      expect(tile.tile!.soilFertility).toBeLessThan(70);
      expect(tile.tile!.pollution).toBeGreaterThan(0);
      expect(tile.tile!.waterTable).toBeLessThan(60);
    });

    it('cooling tower generates pollution like power station', () => {
      const tile = makeTile(0, 0, { pollution: 0 });
      const coolingTower = makeBuilding(0, 0, 'cooling-tower');
      const ctx = makeCtx([tile, coolingTower]);

      terrainTick(ctx);

      // perPowerStationTick = 0.2
      expect(tile.tile!.pollution).toBeCloseTo(0.2, 5);
    });
  });
});

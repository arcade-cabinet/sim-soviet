/**
 * @module game/relocation/RelocationEngine
 *
 * Handles settlement creation from relocation events (cold branches),
 * resource transfer between settlements, and transit mortality.
 *
 * The same system architecture handles:
 * 1. Historical forced transfers (Stalin-era, political pressure)
 * 2. Climate relocation (permafrost collapse, flooding)
 * 3. Multiple settlements ("rewarded" for success with MORE responsibility)
 * 4. Planetary colonies (Moon, Mars — different terrain/parameters)
 * 5. Interstellar colonies (Alpha Centauri+ — extreme version)
 */

import type { TerrainProfile } from '../../ai/agents/core/worldBranches';
import type { GameRng } from '../SeedSystem';
import type { CelestialBody, Settlement } from './Settlement';
import { SettlementRegistry } from './Settlement';
import { SURVIVAL_COST_MULTIPLIER } from './terrainProfiles';

// ─── Relocation Event ───────────────────────────────────────────────────────

export type RelocationType = 'forced_transfer' | 'climate_exodus' | 'colonial_expansion' | 'interstellar';

export interface RelocationEvent {
  /** Type of relocation. */
  type: RelocationType;
  /** Target terrain for the new settlement. */
  targetTerrain: TerrainProfile;
  /** Name for the new settlement. */
  settlementName: string;
  /** Which body it's on (inferred from terrain if not specified). */
  celestialBody?: CelestialBody;
  /** Population to transfer (fraction of current, 0-1). */
  transferFraction: number;
  /** Resources to transfer (fraction of current, 0-1). */
  resourceFraction: number;
}

// ─── Transit Result ─────────────────────────────────────────────────────────

export interface TransitResult {
  /** New settlement created. */
  settlement: Settlement;
  /** Population that arrived (after transit mortality). */
  arrivedPopulation: number;
  /** Population lost in transit. */
  transitDeaths: number;
  /** Food transferred. */
  foodTransferred: number;
  /** Money transferred. */
  moneyTransferred: number;
}

// ─── Transfer Request ───────────────────────────────────────────────────────

export interface ResourceTransfer {
  /** Source settlement ID. */
  fromId: string;
  /** Target settlement ID. */
  toId: string;
  /** Food to transfer. */
  food: number;
  /** Money to transfer. */
  money: number;
  /** Workers to transfer. */
  workers: number;
}

// ─── Transit Mortality Rates ────────────────────────────────────────────────

/** Base mortality rate during transit, by relocation type. */
const TRANSIT_MORTALITY: Readonly<Record<RelocationType, number>> = Object.freeze({
  forced_transfer: 0.15, // Historical: 10-40% mortality in deportations
  climate_exodus: 0.05, // Planned evacuation, lower mortality
  colonial_expansion: 0.10, // Space travel risks
  interstellar: 0.20, // Generation ship, decades in transit
});

/** Distance factor: additional mortality per unit of distance. */
const DISTANCE_MORTALITY_FACTOR = 0.001;

// ─── Celestial Body Inference ───────────────────────────────────────────────

/** Infer celestial body from terrain profile. */
function inferCelestialBody(terrain: TerrainProfile): CelestialBody {
  if (terrain.atmosphere === 'none') return 'moon';
  if (terrain.atmosphere === 'thin_co2') return 'mars';
  if (terrain.atmosphere === 'thick_n2_ch4') return 'titan';
  if (terrain.atmosphere === 'variable') return 'exoplanet';
  return 'earth';
}

/** Compute distance based on celestial body. */
function computeDistance(body: CelestialBody): number {
  switch (body) {
    case 'earth': return 1000; // km, different region
    case 'moon': return 384_400;
    case 'mars': return 225_000_000;
    case 'titan': return 1_200_000_000;
    case 'exoplanet': return 40_000_000_000_000; // ~4.2 light years
  }
}

// ─── RelocationEngine ───────────────────────────────────────────────────────

/**
 * Manages settlement creation, relocation events, and resource transfers.
 */
export class RelocationEngine {
  private registry: SettlementRegistry;

  constructor(registry?: SettlementRegistry) {
    this.registry = registry ?? new SettlementRegistry();
  }

  /** Get the settlement registry. */
  getRegistry(): SettlementRegistry {
    return this.registry;
  }

  /**
   * Execute a relocation event — create a new settlement, transfer
   * population and resources, compute transit mortality.
   *
   * @param event - Relocation event details
   * @param currentPopulation - Current settlement population
   * @param currentFood - Current food stockpile
   * @param currentMoney - Current money
   * @param year - Current game year
   * @param rng - Seeded RNG
   * @returns Transit result with new settlement and transfer details
   */
  executeRelocation(
    event: RelocationEvent,
    currentPopulation: number,
    currentFood: number,
    currentMoney: number,
    year: number,
    rng: GameRng,
  ): TransitResult {
    const celestialBody = event.celestialBody ?? inferCelestialBody(event.targetTerrain);
    const distance = computeDistance(celestialBody);

    // Create new settlement
    const settlement = this.registry.addSettlement(
      event.settlementName,
      event.targetTerrain,
      celestialBody,
      distance,
      year,
    );

    // Calculate transfer amounts
    const transferPop = Math.floor(currentPopulation * event.transferFraction);
    const transferFood = Math.floor(currentFood * event.resourceFraction);
    const transferMoney = Math.floor(currentMoney * event.resourceFraction);

    // Compute transit mortality
    const baseMortality = TRANSIT_MORTALITY[event.type];
    const distanceMortality = Math.min(0.3, distance * DISTANCE_MORTALITY_FACTOR);
    const survivalCostPenalty = (SURVIVAL_COST_MULTIPLIER[event.targetTerrain.baseSurvivalCost] - 1) * 0.05;

    // Add RNG variance (±20% of base rate)
    const variance = (rng.random() - 0.5) * 0.4 * baseMortality;
    const totalMortality = Math.min(0.5, Math.max(0, baseMortality + distanceMortality + survivalCostPenalty + variance));

    const transitDeaths = Math.floor(transferPop * totalMortality);
    const arrivedPopulation = transferPop - transitDeaths;

    // Update settlement population
    settlement.population = arrivedPopulation;

    // Food loss in transit (proportional to mortality + spoilage)
    const foodLoss = Math.floor(transferFood * (totalMortality * 0.5 + 0.1));
    const foodArrived = Math.max(0, transferFood - foodLoss);

    return {
      settlement,
      arrivedPopulation,
      transitDeaths,
      foodTransferred: foodArrived,
      moneyTransferred: transferMoney,
    };
  }

  /**
   * Transfer resources between existing settlements.
   * Logistics cost is proportional to distance.
   *
   * @param transfer - Transfer request
   * @returns Actual amounts that arrived (after logistics loss)
   */
  transferResources(transfer: ResourceTransfer): { food: number; money: number; workers: number } {
    const from = this.registry.getById(transfer.fromId);
    const to = this.registry.getById(transfer.toId);
    if (!from || !to) return { food: 0, money: 0, workers: 0 };

    // Logistics loss: 5% base + distance factor
    const distanceFactor = Math.min(0.3, (to.distance - from.distance) * 0.0001);
    const lossRate = Math.min(0.5, 0.05 + Math.abs(distanceFactor));

    return {
      food: Math.floor(transfer.food * (1 - lossRate)),
      money: Math.floor(transfer.money * (1 - lossRate * 0.5)), // money loses less
      workers: Math.floor(transfer.workers * (1 - lossRate * 0.3)), // people are hardier
    };
  }

  /**
   * Generate a settlement name based on relocation type and terrain.
   */
  static generateSettlementName(type: RelocationType, rng: GameRng): string {
    const earthNames = [
      'Novosibirsk-2', 'Magadan Settlement', 'Vorkuta Extension',
      'Karaganda Colony', 'Norilsk Outpost', 'Yakutsk Forward Base',
      'Bratsk Settlement', 'Krasnoyarsk-2', 'Irkutsk Colony',
    ];

    const lunarNames = [
      'Luna-1', 'Tsiolkovsky Base', 'Mare Imbrium Colony',
      'Gagarin Station', 'Korolev Crater Base',
    ];

    const marsNames = [
      'Mars-1', 'Utopia Planitia Colony', 'Olympus Station',
      'Valles Marineris Base', 'Ares Settlement',
    ];

    const interstellarNames = [
      'Ark Alpha', 'Centauri Colony', 'Generation Ship Vostok',
      'New Earth Forward Base', 'Proxima Settlement',
    ];

    let names: string[];
    switch (type) {
      case 'forced_transfer':
      case 'climate_exodus':
        names = earthNames;
        break;
      case 'colonial_expansion':
        names = [...lunarNames, ...marsNames];
        break;
      case 'interstellar':
        names = interstellarNames;
        break;
    }

    return names[Math.floor(rng.random() * names.length)]!;
  }

  // ── Serialization ──────────────────────────────────────────────────────────

  serialize(): { settlements: ReturnType<SettlementRegistry['serialize']> } {
    return { settlements: this.registry.serialize() };
  }

  restore(data: { settlements: Parameters<SettlementRegistry['restore']>[0] }): void {
    this.registry.restore(data.settlements);
  }
}

/**
 * @fileoverview FoodAgent — Food production, consumption, and starvation manager.
 *
 * Absorbs logic from:
 *   - consumptionSystem.ts (food/vodka consumption, starvation counter, grace period)
 *   - productionSystem.ts  (farm food output with modifiers, vodka grain diversion)
 *   - PrivatePlotSystem.ts (per-dvor private plot + livestock food)
 *
 * Tracks a food state machine: Surplus → Stable → Rationing → Starvation
 * Emits FOOD_SHORTAGE, STARVATION_WARNING, and FOOD_SURPLUS telegrams.
 *
 * Telegrams emitted: FOOD_SHORTAGE, STARVATION_WARNING, FOOD_SURPLUS
 */

import { Vehicle } from 'yuka';
import { economy } from '@/config';
import { getBuildingDef } from '@/data/buildingDefs';
import { citizens, dvory, getResourceEntity, producers } from '@/ecs/archetypes';
import { RETIREMENT_AGE } from '@/ecs/factories/demographics';
import type { EraId } from '@/game/era/types';
import type { AgentParameterProfile } from '@/game/engine/agentParameterMatrix';
import { MSG } from '../../telegrams';

// ---------------------------------------------------------------------------
// Constants (sourced from config/economy.json)
// ---------------------------------------------------------------------------

/** Consecutive starvation ticks before deaths begin (~1 season at 1x speed). */
const STARVATION_GRACE_TICKS = economy.consumption.starvationGraceTicks;

/** Maximum starvation deaths applied per tick. */
const MAX_STARVATION_DEATHS_PER_TICK = economy.consumption.maxStarvationDeathsPerTick;

/** Food consumed per citizen per tick = 1 / FOOD_PER_POP_DIVISOR. */
const FOOD_PER_POP_DIVISOR = economy.consumption.foodPerPopDivisor;

/** Minimum overstaffing contribution before truncating decay series. */
const OVERSTAFFING_MIN_CONTRIBUTION = economy.production.overstaffingMinContribution;

/** Base food production per hectare per year from private plots. */
const BASE_FOOD_PER_HECTARE_PER_YEAR = economy.privatePlots.baseFoodPerHectarePerYear;

/** Months per year for converting annual plot output to monthly ticks. */
const MONTHS_PER_YEAR = economy.privatePlots.monthsPerYear;

/** Monthly food bonus per livestock type. */
const LIVESTOCK_FOOD: Record<string, number> = economy.privatePlots.livestockFood;

/** Grain-to-vodka conversion ratio (food units per vodka unit). */
const GRAIN_TO_VODKA_RATIO = economy.production.grainToVodkaRatio;

/** Era-specific multipliers for private plot production. */
const ERA_PLOT_MULTIPLIER: Partial<Record<EraId, number>> = economy.privatePlots.eraMultiplier as Partial<
  Record<EraId, number>
>;

// ---------------------------------------------------------------------------
// Food state machine
// ---------------------------------------------------------------------------

/** Four-tier food security state. */
export type FoodState = 'surplus' | 'stable' | 'rationing' | 'starvation';

// ---------------------------------------------------------------------------
// Serialization interface
// ---------------------------------------------------------------------------

/** Serializable FoodAgent state for save/load. */
export interface FoodAgentSaveData {
  starvationCounter: number;
  foodState: FoodState;
}

// ---------------------------------------------------------------------------
// FoodAgent
// ---------------------------------------------------------------------------

/**
 * Manages food production, consumption, and starvation for the simulation.
 * Extends Yuka Vehicle for compatibility with EntityManager.
 *
 * @example
 * const food = new FoodAgent();
 * const result = food.update(1.0, { farmModifier: 1.2, consumptionMult: 1.0, eraId: 'revolution' });
 * console.log(result.starvationDeaths, food.getFoodState());
 */
export class FoodAgent extends Vehicle {
  /** Consecutive ticks with insufficient food (resets when food is available). */
  private starvationCounter = 0;

  /** Current four-tier food security state. */
  private foodState: FoodState = 'stable';

  /** Active terrain profile — controls farming method, yield, and private plot availability. */
  private profile: Readonly<AgentParameterProfile> | null = null;

  /** Exported message constants (tests can reference). */
  static readonly MSG = MSG;

  constructor() {
    super();
    this.name = 'FoodAgent';
  }

  /**
   * Set the active agent parameter profile.
   * When set, production is modified by farmYieldMultiplier and farming method.
   */
  setProfile(profile: Readonly<AgentParameterProfile>): void {
    this.profile = profile;
  }

  // -------------------------------------------------------------------------
  // Core update
  // -------------------------------------------------------------------------

  /**
   * Run one simulation tick: produce food from farms and private plots,
   * then consume food and vodka. Returns starvation deaths to apply.
   *
   * @param _delta - Yuka delta (unused; tick-based)
   * @param opts   - Modifiers and era context for this tick
   * @returns Number of starvation deaths the caller should route through WorkerSystem
   */
  update(
    _delta: number,
    opts: {
      farmModifier?: number;
      vodkaModifier?: number;
      consumptionMult?: number;
      eraId?: string;
      skillFactor?: number;
      conditionFactor?: number;
      stakhanoviteBoosts?: ReadonlyMap<string, number>;
    } = {},
  ): { starvationDeaths: number } {
    const farmModifier = opts.farmModifier ?? 1.0;
    const vodkaModifier = opts.vodkaModifier ?? 1.0;
    const consumptionMult = opts.consumptionMult ?? 1.0;
    const eraId = opts.eraId ?? 'revolution';

    this._runProduction(farmModifier, vodkaModifier, {
      skillFactor: opts.skillFactor,
      conditionFactor: opts.conditionFactor,
      stakhanoviteBoosts: opts.stakhanoviteBoosts,
    });

    this._runPrivatePlots(eraId);

    const starvationDeaths = this._runConsumption(consumptionMult);
    return { starvationDeaths };
  }

  // -------------------------------------------------------------------------
  // Public production/consumption split — allows SimulationEngine to insert
  // CompulsoryDeliveries between production and consumption steps.
  // -------------------------------------------------------------------------

  /**
   * Run the production phase only (farms + optional private plots).
   * Does NOT consume. Call `consume()` separately after any interleaved logic.
   *
   * @param opts - Production modifiers and era context
   * @param opts.includePrivatePlots - Whether to run private plot production (default true; set false for non-monthly ticks)
   */
  produce(
    opts: {
      farmModifier?: number;
      vodkaModifier?: number;
      eraId?: string;
      skillFactor?: number;
      conditionFactor?: number;
      stakhanoviteBoosts?: ReadonlyMap<string, number>;
      includePrivatePlots?: boolean;
    } = {},
  ): void {
    const farmModifier = opts.farmModifier ?? 1.0;
    const vodkaModifier = opts.vodkaModifier ?? 1.0;
    const eraId = opts.eraId ?? 'revolution';

    this._runProduction(farmModifier, vodkaModifier, {
      skillFactor: opts.skillFactor,
      conditionFactor: opts.conditionFactor,
      stakhanoviteBoosts: opts.stakhanoviteBoosts,
    });

    if (opts.includePrivatePlots !== false) {
      this._runPrivatePlots(eraId);
    }
  }

  /**
   * Run the consumption phase only (food + vodka consumption + starvation).
   * Call after `produce()` and any interleaved logic (e.g. CompulsoryDeliveries).
   *
   * @param consumptionMult - Era/difficulty multiplier on consumption rates
   * @returns Number of starvation deaths the caller should route through WorkerSystem
   */
  consume(consumptionMult = 1.0): { starvationDeaths: number } {
    const starvationDeaths = this._runConsumption(consumptionMult);
    return { starvationDeaths };
  }

  // -------------------------------------------------------------------------
  // Production (absorbed from productionSystem.ts — food paths only)
  // -------------------------------------------------------------------------

  /**
   * Run producer buildings for food and vodka output.
   * Only powered buildings contribute. Overstaffing applies diminishing returns.
   */
  private _runProduction(
    farmModifier: number,
    vodkaModifier: number,
    mods: {
      skillFactor?: number;
      conditionFactor?: number;
      stakhanoviteBoosts?: ReadonlyMap<string, number>;
    },
  ): void {
    const store = getResourceEntity();
    if (!store) return;

    // Count workers per building defId
    const workerCounts = new Map<string, number>();
    for (const entity of citizens) {
      const assignment = entity.citizen.assignment;
      if (assignment) {
        workerCounts.set(assignment, (workerCounts.get(assignment) ?? 0) + 1);
      }
    }

    // Count buildings per defId to spread workers evenly across instances
    const buildingCounts = new Map<string, number>();
    for (const entity of producers) {
      const defId = entity.building.defId;
      buildingCounts.set(defId, (buildingCounts.get(defId) ?? 0) + 1);
    }

    const skillFactor = mods.skillFactor ?? 1.0;
    const conditionFactor = mods.conditionFactor ?? 1.0;

    // Profile-aware: if farming is impossible, skip all food production
    if (this.profile?.farmingMethod === 'impossible') return;
    const yieldMult = this.profile?.farmYieldMultiplier ?? 1.0;

    for (const entity of producers) {
      if (!entity.building.powered) continue;

      const prod = entity.building.produces;
      if (!prod) continue;

      const defId = entity.building.defId;
      const def = getBuildingDef(defId);
      const staffCap = def?.stats.staffCap;

      let workerMult = 1.0;
      if (staffCap && staffCap > 0) {
        const totalWorkers = workerCounts.get(defId) ?? 0;
        const numBuildings = buildingCounts.get(defId) ?? 1;
        const avgWorkers = totalWorkers / numBuildings;
        if (avgWorkers > staffCap) {
          workerMult = this._effectiveWorkers(avgWorkers, staffCap) / avgWorkers;
        }
      }

      const stakhanoviteBoost = mods.stakhanoviteBoosts?.get(defId) ?? 1.0;
      const expandedMult = workerMult * skillFactor * conditionFactor * stakhanoviteBoost;

      switch (prod.resource) {
        case 'food':
          store.resources.food += prod.amount * farmModifier * yieldMult * expandedMult;
          break;
        case 'vodka': {
          const vodkaOutput = prod.amount * vodkaModifier * expandedMult;
          const grainCost = vodkaOutput * GRAIN_TO_VODKA_RATIO;
          if (store.resources.food >= grainCost) {
            store.resources.food -= grainCost;
            store.resources.vodka += vodkaOutput;
          } else {
            // Insufficient grain — produce proportionally to available grain
            const affordable = store.resources.food / 2;
            if (affordable > 0) {
              store.resources.food -= affordable * 2;
              store.resources.vodka += affordable;
            }
          }
          break;
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Private plots (absorbed from PrivatePlotSystem.ts)
  // -------------------------------------------------------------------------

  /**
   * Calculate and apply monthly food production from all dvor private plots.
   * Only dvory with at least one working-age member contribute.
   *
   * @param eraId - Current era identifier for plot multiplier lookup
   */
  private _runPrivatePlots(eraId: string): void {
    // Profile-aware: private plots not available off-Earth
    if (this.profile && !this.profile.privatePlotsAvailable) return;

    const store = getResourceEntity();
    if (!store) return;

    const eraMult = ERA_PLOT_MULTIPLIER[eraId as EraId] ?? 1.0;
    if (eraMult === 0) return;

    let totalFood = 0;

    for (const entity of dvory) {
      const dvor = entity.dvor;

      const hasWorker = dvor.members.some((m) => m.age >= 16 && m.age < RETIREMENT_AGE[m.gender]);
      if (!hasWorker) continue;

      const plotFood = (dvor.privatePlotSize * BASE_FOOD_PER_HECTARE_PER_YEAR) / MONTHS_PER_YEAR;

      let livestockFood = 0;
      const ls = dvor.privateLivestock;
      livestockFood += ls.cow * LIVESTOCK_FOOD.cow!;
      livestockFood += ls.pig * LIVESTOCK_FOOD.pig!;
      livestockFood += ls.sheep * LIVESTOCK_FOOD.sheep!;
      livestockFood += ls.poultry * LIVESTOCK_FOOD.poultry!;

      totalFood += (plotFood + livestockFood) * eraMult;
    }

    store.resources.food += totalFood;
  }

  // -------------------------------------------------------------------------
  // Consumption (absorbed from consumptionSystem.ts)
  // -------------------------------------------------------------------------

  /**
   * Consume food and vodka for the current tick population.
   * Updates the food state machine and returns starvation deaths.
   *
   * @param consumptionMult - Era/difficulty multiplier on consumption rates
   * @returns Number of citizens that should die from starvation this tick
   */
  private _runConsumption(consumptionMult: number): number {
    const store = getResourceEntity();
    if (!store) return 0;

    const pop = store.resources.population;
    if (pop <= 0) return 0;

    const foodNeed = Math.ceil((pop / FOOD_PER_POP_DIVISOR) * consumptionMult);
    let starvationDeaths = 0;

    if (store.resources.food >= foodNeed) {
      store.resources.food -= foodNeed;
      this.starvationCounter = 0;
    } else {
      store.resources.food = 0;
      this.starvationCounter++;

      if (this.starvationCounter > STARVATION_GRACE_TICKS) {
        starvationDeaths = Math.min(MAX_STARVATION_DEATHS_PER_TICK, pop);
      }
    }

    // Vodka consumption — no lethal penalty
    const vodkaDrink = Math.ceil((pop / 20) * consumptionMult);
    if (store.resources.vodka >= vodkaDrink) {
      store.resources.vodka -= vodkaDrink;
    }

    this._updateFoodState(store.resources.food, foodNeed, pop);
    return starvationDeaths;
  }

  // -------------------------------------------------------------------------
  // State machine
  // -------------------------------------------------------------------------

  /**
   * Transition food state based on current food level, need, and starvation depth.
   *
   * Transitions:
   *   food > need * 2              → surplus
   *   food >= need                 → stable
   *   starvationCounter > 0        → rationing
   *   starvationCounter > grace    → starvation
   */
  private _updateFoodState(currentFood: number, foodNeed: number, population: number): void {
    const prevState = this.foodState;

    if (this.starvationCounter > STARVATION_GRACE_TICKS) {
      this.foodState = 'starvation';
    } else if (this.starvationCounter > 0) {
      this.foodState = 'rationing';
    } else if (population > 0 && currentFood >= foodNeed * 2) {
      this.foodState = 'surplus';
    } else {
      this.foodState = 'stable';
    }

    // State change logging is handled by telegram emission callers
    void prevState; // suppress unused-variable warning
  }

  // -------------------------------------------------------------------------
  // Telegram emission decisions
  // -------------------------------------------------------------------------

  /**
   * Whether a FOOD_SHORTAGE telegram should be emitted this tick.
   * True when in rationing or starvation state.
   */
  shouldEmitFoodShortage(): boolean {
    return this.foodState === 'rationing' || this.foodState === 'starvation';
  }

  /**
   * Whether a STARVATION_WARNING telegram should be emitted this tick.
   * True only when deaths are imminent (counter past grace period).
   */
  shouldEmitStarvationWarning(): boolean {
    return this.starvationCounter > STARVATION_GRACE_TICKS;
  }

  /**
   * Whether a FOOD_SURPLUS telegram should be emitted this tick.
   * True when in surplus state.
   */
  shouldEmitFoodSurplus(): boolean {
    return this.foodState === 'surplus';
  }

  // -------------------------------------------------------------------------
  // Accessors
  // -------------------------------------------------------------------------

  /** Current four-tier food security state. */
  getFoodState(): FoodState {
    return this.foodState;
  }

  /** Consecutive ticks without food (resets to 0 when food is available). */
  getStarvationCounter(): number {
    return this.starvationCounter;
  }

  /** Ticks remaining in the grace period before deaths begin (0 when already in starvation). */
  getTicksUntilStarvation(): number {
    return Math.max(0, STARVATION_GRACE_TICKS - this.starvationCounter);
  }

  /**
   * Calculate food need for the current population without mutating state.
   *
   * @param population     - Current citizen count
   * @param consumptionMult - Era/difficulty multiplier
   * @returns Food units needed this tick
   */
  calculateFoodNeed(population: number, consumptionMult = 1): number {
    return Math.ceil((population / FOOD_PER_POP_DIVISOR) * consumptionMult);
  }

  /**
   * Calculate private plot food output for a given era without mutating state.
   * Useful for UI projections.
   *
   * @param eraId - Era identifier
   * @returns Total food from private plots this tick
   */
  calculatePrivatePlotProduction(eraId: string): number {
    const eraMult = ERA_PLOT_MULTIPLIER[eraId as EraId] ?? 1.0;
    if (eraMult === 0) return 0;

    let total = 0;
    for (const entity of dvory) {
      const dvor = entity.dvor;
      const hasWorker = dvor.members.some((m) => m.age >= 16 && m.age < RETIREMENT_AGE[m.gender]);
      if (!hasWorker) continue;

      const plotFood = (dvor.privatePlotSize * BASE_FOOD_PER_HECTARE_PER_YEAR) / MONTHS_PER_YEAR;
      let livestockFood = 0;
      const ls = dvor.privateLivestock;
      livestockFood += ls.cow * LIVESTOCK_FOOD.cow!;
      livestockFood += ls.pig * LIVESTOCK_FOOD.pig!;
      livestockFood += ls.sheep * LIVESTOCK_FOOD.sheep!;
      livestockFood += ls.poultry * LIVESTOCK_FOOD.poultry!;
      total += (plotFood + livestockFood) * eraMult;
    }
    return total;
  }

  // -------------------------------------------------------------------------
  // Serialization
  // -------------------------------------------------------------------------

  /**
   * Serialize agent state for save/load.
   *
   * @returns Plain object snapshot of starvation counter and food state
   */
  toJSON(): FoodAgentSaveData {
    return {
      starvationCounter: this.starvationCounter,
      foodState: this.foodState,
    };
  }

  /**
   * Restore agent state from a saved snapshot.
   *
   * @param data - Previously serialized FoodAgentSaveData
   */
  fromJSON(data: FoodAgentSaveData): void {
    this.starvationCounter = data.starvationCounter;
    this.foodState = data.foodState;
  }

  /**
   * Reset starvation counter (called on new game).
   */
  reset(): void {
    this.starvationCounter = 0;
    this.foodState = 'stable';
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Calculates effective worker count with overstaffing diminishing returns.
   * First staffCap workers contribute 100% each; each extra contributes 50% less.
   */
  private _effectiveWorkers(workers: number, staffCap: number): number {
    if (staffCap <= 0 || workers <= staffCap) return workers;

    let effective = staffCap;
    const extra = workers - staffCap;
    let contribution = 0.5;

    for (let i = 0; i < extra; i++) {
      if (contribution < OVERSTAFFING_MIN_CONTRIBUTION) break;
      effective += contribution;
      contribution *= 0.5;
    }

    return effective;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Standalone function exports (backward-compat with deprecated files)
// ─────────────────────────────────────────────────────────────────────────────

const _sharedFoodAgent = new FoodAgent();

/**
 * Calculate private plot food output for a given era.
 * Standalone wrapper (was in PrivatePlotSystem.ts).
 */
export function calculatePrivatePlotProduction(eraId: string): number {
  return _sharedFoodAgent.calculatePrivatePlotProduction(eraId);
}

/**
 * Effective workers with overstaffing diminishing returns.
 * Standalone export (was in productionSystem.ts).
 */
export function effectiveWorkers(workers: number, staffCap: number): number {
  if (staffCap <= 0 || workers <= staffCap) return workers;
  let effective = staffCap;
  const extra = workers - staffCap;
  let contribution = 0.5;
  for (let i = 0; i < extra; i++) {
    if (contribution < OVERSTAFFING_MIN_CONTRIBUTION) break;
    effective += contribution;
    contribution *= 0.5;
  }
  return effective;
}

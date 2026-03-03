/**
 * @module ai/agents/economy/consumptionSystem
 *
 * Citizen consumption of food and vodka each tick.
 *
 * Implements the Dual-Layer Distribution Model:
 * - Layer 1 (Uniform): Bulk per-capita consumption. This is what the raikom
 *   report shows and what quotas measure against.
 * - Layer 2 (Weighted): Actual consumption biased by role. KGB takes 2x,
 *   military 1.5x, dependents 0.7x, prisoners 0.3x. The gap between
 *   uniform and weighted IS the game's tension.
 *
 * When the privileged fraction exceeds 15%, workers notice and resentment
 * triggers a morale penalty.
 *
 * Core consumption is handled by FoodAgent.consume(). This module retains
 * the starvation callback + counter utilities used by SimulationEngine and Reset.
 */

import type { PoliticalRole } from '@/ai/agents/political/types';
import { economy } from '@/config';
import { getResourceEntity } from '@/ecs/archetypes';
import type { DistributionResult } from '@/ecs/systems/distributionWeights';
import { computeDistribution, computeRoleBuckets, RESENTMENT_MORALE_PENALTY } from '@/ecs/systems/distributionWeights';

/** Starvation notification callback type */
export type StarvationCallback = () => void;

/** Resentment notification callback type */
export type ResentmentCallback = (moralePenalty: number, privilegedFraction: number) => void;

/** Stored callback for starvation events */
let _onStarvation: StarvationCallback | undefined;

/** Stored callback for resentment events */
let _onResentment: ResentmentCallback | undefined;

/**
 * Registers a callback that fires when starvation occurs.
 * Used by the game store to bridge ECS events to the UI layer.
 *
 * @param cb - Callback to invoke on starvation, or undefined to clear
 */
export function setStarvationCallback(cb: StarvationCallback | undefined): void {
  _onStarvation = cb;
}

/**
 * Registers a callback that fires when resentment triggers.
 * Used to bridge distribution inequality events to the UI layer
 * (e.g., Pravda ticker: "Some comrades are more equal than others").
 *
 * @param cb - Callback to invoke on resentment, or undefined to clear
 */
export function setResentmentCallback(cb: ResentmentCallback | undefined): void {
  _onResentment = cb;
}

/** Result of the consumption system tick. */
export interface ConsumptionResult {
  /** Number of citizens that should die from starvation (caller removes via WorkerSystem). */
  starvationDeaths: number;
  /** Distribution analysis from the dual-layer model (undefined if pop is 0 or no store). */
  distribution?: DistributionResult;
  /** Whether resentment was triggered this tick. */
  resentmentTriggered: boolean;
}

/** Number of consecutive starvation ticks before deaths begin (~1 season at 1x speed). */
const STARVATION_GRACE_TICKS = economy.consumption.starvationGraceTicks;

/** Food consumed per citizen per tick = 1 / FOOD_PER_POP_DIVISOR. */
const FOOD_PER_POP_DIVISOR = economy.consumption.foodPerPopDivisor;

/** Maximum starvation deaths per tick. */
const MAX_STARVATION_DEATHS = economy.consumption.maxStarvationDeathsPerTick;

/** Tracks consecutive ticks without food. Resets when food is available. */
let _starvationCounter = 0;

/** Reset starvation counter (called on new game). */
export function resetStarvationCounter(): void {
  _starvationCounter = 0;
}

/**
 * Runs the consumption system for one simulation tick.
 *
 * Uses the Dual-Layer Distribution Model:
 * - Uniform consumption: ceil(pop/divisor) (for reporting).
 * - Weighted consumption: accounts for role-based bias (actual resource drain).
 *
 * If insufficient food for the WEIGHTED need, starvation counter increments.
 * After a grace period of continuous starvation, deaths begin.
 * If privileged consumption exceeds 15%, triggers resentment penalty.
 *
 * NOTE: Starvation deaths are RETURNED, not applied here.
 * The caller (SimulationEngine) routes them through WorkerSystem.
 *
 * @param consumptionMult - Era/difficulty multiplier on consumption rates (default 1)
 * @param politicalCounts - Optional counts of political entities by role (for weighted calc)
 * @returns Result containing starvation deaths, distribution analysis, and resentment status
 */
export function consumptionSystem(
  consumptionMult = 1,
  politicalCounts?: Partial<Record<PoliticalRole, number>>,
): ConsumptionResult {
  const result: ConsumptionResult = { starvationDeaths: 0, resentmentTriggered: false };
  const store = getResourceEntity();
  if (!store) return result;

  const pop = store.resources.population;
  if (pop <= 0) return result;

  // Compute role buckets from ECS world state
  const buckets = computeRoleBuckets(pop, politicalCounts);

  // Compute dual-layer distribution
  const distribution = computeDistribution(pop, consumptionMult, buckets);
  result.distribution = distribution;

  // Use WEIGHTED food need for actual consumption (the reality)
  // Fall back to uniform formula if distribution returned 0 (edge case)
  const foodNeed =
    distribution.weightedFoodNeed > 0
      ? distribution.weightedFoodNeed
      : Math.ceil((pop / FOOD_PER_POP_DIVISOR) * consumptionMult);

  if (store.resources.food >= foodNeed) {
    store.resources.food -= foodNeed;
    _starvationCounter = 0;
  } else {
    // Consume whatever food is available
    store.resources.food = 0;
    _starvationCounter++;
    _onStarvation?.();

    // Grace period: deaths only after sustained starvation
    if (_starvationCounter > STARVATION_GRACE_TICKS) {
      result.starvationDeaths = Math.min(MAX_STARVATION_DEATHS, pop);
    }
  }

  // Use WEIGHTED vodka need for actual consumption
  const vodkaDrink =
    distribution.weightedVodkaNeed > 0 ? distribution.weightedVodkaNeed : Math.ceil((pop / 20) * consumptionMult);
  if (store.resources.vodka >= vodkaDrink) {
    store.resources.vodka -= vodkaDrink;
  }
  // No penalty for vodka shortage — citizens merely suffer in silence

  // Resentment check: when privileged roles take too much, workers notice
  if (distribution.resentmentActive) {
    result.resentmentTriggered = true;
    _onResentment?.(RESENTMENT_MORALE_PENALTY, distribution.privilegedFraction);
  }

  return result;
}

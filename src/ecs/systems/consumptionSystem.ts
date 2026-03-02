/**
 * @module ecs/systems/consumptionSystem
 *
 * Handles citizen consumption of food and vodka each tick.
 *
 * Citizens collectively consume food based on population size.
 * If food runs out, starvation deaths are returned (caller handles removal).
 * Vodka consumption is aspirational but not lethal if unmet.
 *
 * DEPRECATED: logic moved to FoodAgent (src/ai/agents/FoodAgent.ts).
 * This file is retained for SimulationEngine compatibility until Phase 4 migration.
 */

import { getResourceEntity } from '@/ecs/archetypes';

/** Starvation notification callback type */
export type StarvationCallback = () => void;

/** Stored callback for starvation events */
let _onStarvation: StarvationCallback | undefined;

/**
 * Registers a callback that fires when starvation occurs.
 * Used by the game store to bridge ECS events to the UI layer.
 *
 * @param cb - Callback to invoke on starvation, or undefined to clear
 */
export function setStarvationCallback(cb: StarvationCallback | undefined): void {
  _onStarvation = cb;
}

/** Result of the consumption system tick. */
export interface ConsumptionResult {
  /** Number of citizens that should die from starvation (caller removes via WorkerSystem). */
  starvationDeaths: number;
}

/**
 * Runs the consumption system for one simulation tick.
 *
 * - Food consumption: 1 unit per 10 citizens (rounded up).
 *   If insufficient food, starvation counter increments. After a grace
 *   period of continuous starvation (STARVATION_GRACE_TICKS), deaths begin.
 * - Vodka consumption: 1 unit per 20 citizens (rounded up).
 *   If insufficient vodka, citizens are merely unhappy (no death).
 *
 * NOTE: Starvation deaths are RETURNED, not applied here.
 * The caller (SimulationEngine) routes them through WorkerSystem.
 *
 * @param consumptionMult - Era/difficulty multiplier on consumption rates (default 1)
 * @returns Result containing the number of starvation deaths to process
 */

/** Number of consecutive starvation ticks before deaths begin (~1 season at 1x speed). */
const STARVATION_GRACE_TICKS = 90;

/** Tracks consecutive ticks without food. Resets when food is available. */
let _starvationCounter = 0;

/** Reset starvation counter (called on new game). */
export function resetStarvationCounter(): void {
  _starvationCounter = 0;
}

export function consumptionSystem(consumptionMult = 1): ConsumptionResult {
  const result: ConsumptionResult = { starvationDeaths: 0 };
  const store = getResourceEntity();
  if (!store) return result;

  const pop = store.resources.population;
  if (pop <= 0) return result;

  // Food consumption (scaled by era/difficulty multiplier)
  const foodNeed = Math.ceil((pop / 10) * consumptionMult);
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
      result.starvationDeaths = Math.min(5, pop);
    }
  }

  // DEPRECATED: vodka logic moved to VodkaAgent
  // VodkaAgent.update() now handles vodka consumption and morale.
  // This block is retained for builds that have not yet wired VodkaAgent into the tick.
  const vodkaDrink = Math.ceil((pop / 20) * consumptionMult);
  if (store.resources.vodka >= vodkaDrink) {
    store.resources.vodka -= vodkaDrink;
  }
  // No penalty for vodka shortage — citizens merely suffer in silence

  return result;
}

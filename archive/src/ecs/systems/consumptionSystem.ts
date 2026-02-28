/**
 * @module ecs/systems/consumptionSystem
 *
 * Handles citizen consumption of food and vodka each tick.
 *
 * Citizens collectively consume food based on population size.
 * If food runs out, population drops (starvation).
 * Vodka consumption is aspirational but not lethal if unmet.
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

/**
 * Runs the consumption system for one simulation tick.
 *
 * - Food consumption: 1 unit per 10 citizens (rounded up).
 *   If insufficient food, 5 citizens die.
 * - Vodka consumption: 1 unit per 20 citizens (rounded up).
 *   If insufficient vodka, citizens are merely unhappy (no death).
 */
export function consumptionSystem(consumptionMult = 1): void {
  const store = getResourceEntity();
  if (!store) return;

  const pop = store.resources.population;
  if (pop <= 0) return;

  // Food consumption (scaled by era/difficulty multiplier)
  const foodNeed = Math.ceil((pop / 10) * consumptionMult);
  if (store.resources.food >= foodNeed) {
    store.resources.food -= foodNeed;
  } else {
    // Starvation
    store.resources.population = Math.max(0, pop - 5);
    _onStarvation?.();
  }

  // Vodka consumption (scaled by era/difficulty multiplier)
  const vodkaDrink = Math.ceil((pop / 20) * consumptionMult);
  if (store.resources.vodka >= vodkaDrink) {
    store.resources.vodka -= vodkaDrink;
  }
  // No penalty for vodka shortage — citizens merely suffer in silence
}

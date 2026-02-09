/**
 * @module ecs/systems/populationSystem
 *
 * Manages population growth based on available housing and food.
 *
 * Population increases when:
 * - There is available housing capacity (powered housing buildings)
 * - There is sufficient food (> 10 units)
 *
 * Growth is stochastic: 0-2 new citizens per eligible tick.
 */

import { getResourceEntity, housing as housingArchetype } from '@/ecs/archetypes';
import type { GameRng } from '@/game/SeedSystem';

/**
 * Runs the population system for one simulation tick.
 *
 * 1. Sums housing capacity from all powered housing buildings.
 * 2. If population is below capacity and food is available, grows population.
 */
export function populationSystem(rng?: GameRng): void {
  const store = getResourceEntity();
  if (!store) return;

  // Calculate total housing capacity from powered buildings
  let housingCap = 0;
  for (const entity of housingArchetype) {
    if (entity.building.powered) {
      housingCap += entity.building.housingCap;
    }
  }

  // Grow population if there is room and food
  if (store.resources.population < housingCap && store.resources.food > 10) {
    store.resources.population += rng ? rng.int(0, 2) : Math.floor(Math.random() * 3);
  }
}

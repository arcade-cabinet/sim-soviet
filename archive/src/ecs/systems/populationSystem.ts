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

/** Base disease chance per tick. */
const BASE_DISEASE_CHANCE = 0.005;

/** Disease chance multiplier when overcrowded (pop > housing cap). */
const OVERCROWDING_DISEASE_MULT = 3.0;

/** Disease chance multiplier in winter months (Nov-Mar). */
const WINTER_DISEASE_MULT = 2.0;

/**
 * Runs the population system for one simulation tick.
 *
 * 1. Sums housing capacity from all powered housing buildings.
 * 2. If population is below capacity and food is available, grows population.
 * 3. Disease check: random chance of deaths, worse in winter and with overcrowding.
 *
 * @param rng        Seeded RNG for deterministic behavior.
 * @param growthMult Multiplier on population growth rate.
 * @param month      Current game month (1-12) for winter disease modifier.
 */
export function populationSystem(rng?: GameRng, growthMult = 1.0, month = 1): void {
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
    const baseGrowth = rng ? rng.int(0, 2) : Math.floor(Math.random() * 3);
    store.resources.population += Math.round(baseGrowth * Math.max(0, growthMult));
  }

  // Disease system: random chance of deaths, worse in winter and overcrowding
  if (store.resources.population > 0) {
    let diseaseChance = BASE_DISEASE_CHANCE;

    // Winter modifier (Nov-Mar)
    const isWinter = month >= 11 || month <= 3;
    if (isWinter) diseaseChance *= WINTER_DISEASE_MULT;

    // Overcrowding modifier
    if (housingCap > 0 && store.resources.population > housingCap) {
      diseaseChance *= OVERCROWDING_DISEASE_MULT;
    }

    const rand = rng ? rng.random() : Math.random();
    if (rand < diseaseChance) {
      // Disease outbreak — kills 1-3 citizens
      const deaths = rng ? rng.int(1, 3) : 1 + Math.floor(Math.random() * 3);
      store.resources.population = Math.max(0, store.resources.population - deaths);
    }
  }
}

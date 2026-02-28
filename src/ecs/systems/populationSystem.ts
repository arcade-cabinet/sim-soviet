/**
 * @module ecs/systems/populationSystem
 *
 * Housing-based population growth gate.
 *
 * IMPORTANT: WorkerSystem is the authoritative population source.
 * This system only checks housing capacity and signals whether growth
 * is possible. It no longer modifies resources.population directly —
 * WorkerSystem.tick() syncs the authoritative count at the end of each tick.
 *
 * The system now returns a growth hint that SimulationEngine uses to
 * decide whether to spawn new workers via WorkerSystem.
 */

import { getResourceEntity, housing as housingArchetype } from '@/ecs/archetypes';
import type { GameRng } from '@/game/SeedSystem';

/** Result of the population growth check. */
export interface PopulationGrowthResult {
  /** Number of new workers that should be spawned (0 if no room or food). */
  growthCount: number;
  /** Current total housing capacity. */
  housingCapacity: number;
  /** Whether population exceeds housing (overcrowded). */
  overcrowded: boolean;
}

/**
 * Checks whether population growth is possible based on housing + food.
 *
 * Returns a growth hint — the caller (SimulationEngine) decides whether
 * to actually spawn workers via WorkerSystem.
 *
 * @param rng        Seeded RNG for deterministic behavior.
 * @param growthMult Multiplier on population growth rate.
 */
export function populationSystem(rng?: GameRng, growthMult = 1.0, _month = 1): PopulationGrowthResult {
  const store = getResourceEntity();
  const result: PopulationGrowthResult = {
    growthCount: 0,
    housingCapacity: 0,
    overcrowded: false,
  };
  if (!store) return result;

  // Calculate total housing capacity from powered buildings
  let housingCap = 0;
  for (const entity of housingArchetype) {
    if (entity.building.powered) {
      housingCap += entity.building.housingCap;
    }
  }
  result.housingCapacity = housingCap;
  result.overcrowded = store.resources.population > housingCap;

  // Grow population if there is room and food
  if (store.resources.population < housingCap && store.resources.food > 10) {
    const baseGrowth = rng ? rng.int(0, 2) : Math.floor(Math.random() * 3);
    result.growthCount = Math.round(baseGrowth * Math.max(0, growthMult));
  }

  return result;
}

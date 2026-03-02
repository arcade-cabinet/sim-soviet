/**
 * @module ecs/systems/populationSystem
 *
 * Yearly immigration gate — controls population inflow once per year.
 *
 * IMPORTANT: WorkerSystem is the authoritative population source.
 * This system only checks housing capacity and signals whether growth
 * is possible. It no longer modifies resources.population directly —
 * WorkerSystem.tick() syncs the authoritative count at the end of each tick.
 *
 * Called once per year (gated by tickResult.newYear in SimulationEngine).
 * Immigration cap: max(1, floor(housingCap * 0.03)) — 3% of housing capacity.
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
 * Checks whether yearly immigration is possible based on housing + food.
 *
 * Returns a growth hint — the caller (SimulationEngine) decides whether
 * to actually spawn workers via WorkerSystem.
 *
 * Immigration cap: max(1, floor(housingCap * 0.03)) per year (3% of housing).
 *
 * @param rng        - Seeded RNG for deterministic growth rolls (required)
 * @param growthMult - Multiplier on population growth rate (default 1.0)
 * @param _month     - Current month (reserved for future seasonal modifiers)
 * @returns Growth hint with spawn count, housing capacity, and overcrowding flag
 */
export function populationSystem(rng: GameRng, growthMult = 1.0, _month = 1): PopulationGrowthResult {
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

  // Yearly immigration: cap at 3% of housing capacity (min 1)
  if (store.resources.population < housingCap && store.resources.food > 10) {
    const immigrationCap = Math.max(1, Math.floor(housingCap * 0.03));
    const baseGrowth = rng.int(0, immigrationCap);
    result.growthCount = Math.round(baseGrowth * Math.max(0, growthMult));
  }

  return result;
}

/**
 * @module game/engine/resourceTracking
 *
 * Pure functions for resource gating and carrying capacity computation.
 *
 * `isResourceTracked()` determines whether a resource is actively tracked
 * for a given terrain/dome configuration. On open-air Earth, oxygen is
 * infinite and not tracked. Off-Earth or in domes, it becomes critical.
 *
 * `computeCarryingCapacity()` returns the mathematical population ceiling
 * for a settlement — the minimum across housing, food, water, oxygen,
 * power, and terrain limits.
 */

import type { TerrainProfile } from '../../ai/agents/core/worldBranches';
import type { Resources } from '../../ecs/world';
import ecologyConfig from '../../config/ecology.json';

// ─── Resource Gating ────────────────────────────────────────────────────────

/** Resource types that can be gated by terrain/dome. */
export type GatedResource =
  | 'oxygen'
  | 'water'
  | 'hydrogen'
  | 'rareEarths'
  | 'uranium'
  | 'rocketFuel';

/**
 * Determines whether a resource is actively tracked for a given
 * terrain and dome configuration.
 *
 * On open-air Earth with rivers, oxygen and water are infinite (not tracked).
 * Off-Earth or inside domes, they become critical resources.
 * Hydrogen, rareEarths, uranium, rocketFuel are always tracked once unlocked.
 *
 * @param resource - The resource to check
 * @param terrain - The settlement's terrain profile
 * @param hasDome - Whether the settlement has a dome
 * @returns true if the resource should be actively tracked/consumed
 */
export function isResourceTracked(
  resource: GatedResource,
  terrain: TerrainProfile,
  hasDome: boolean,
): boolean {
  switch (resource) {
    case 'oxygen':
      // On Earth: only tracked inside domes (ecological collapse scenario)
      // Off-Earth: always tracked (no breathable atmosphere)
      return terrain.atmosphere !== 'breathable' || hasDome;
    case 'water':
      // On Earth with rivers: auto-replenished (not tracked as depletable)
      // Off-Earth or non-river water: must be extracted/recycled
      return terrain.water !== 'rivers';
    case 'hydrogen':
    case 'rareEarths':
    case 'uranium':
    case 'rocketFuel':
      // Always tracked once the resource exists in the economy
      return true;
  }
}

// ─── Carrying Capacity ──────────────────────────────────────────────────────

/** Input parameters for carrying capacity computation. */
export interface CarryingCapacityInput {
  /** Total housing capacity across all buildings. */
  housingCapacity: number;
  /** Total food production per tick. */
  foodProductionPerTick: number;
  /** Food consumption per capita per tick. */
  foodConsumptionPerCapita: number;
  /** Whether water is a tracked (limiting) resource. */
  waterTracked: boolean;
  /** Current water stockpile + recycling capacity. */
  waterCapacity: number;
  /** Water consumption per capita per tick. */
  waterPerCapita: number;
  /** Whether oxygen is a tracked (limiting) resource. */
  oxygenTracked: boolean;
  /** Oxygen production capacity per tick. */
  oxygenCapacity: number;
  /** Oxygen consumption per capita per tick. */
  oxygenPerCapita: number;
  /** Total power generation capacity. */
  powerCapacity: number;
  /** Power consumption per capita (derived from buildings). */
  powerPerCapita: number;
  /** Terrain-based maximum population (geology, space, waste). */
  terrainLimit: number;
}

/**
 * Compute the carrying capacity (K) for a settlement.
 *
 * K = min(housing, food/consumption, water/consumption, oxygen/consumption,
 *         power/consumption, terrainLimit)
 *
 * Resources that are not tracked (e.g. oxygen on open-air Earth) use
 * Infinity so they don't constrain K.
 *
 * @returns The carrying capacity (population ceiling), minimum 1
 */
export function computeCarryingCapacity(input: CarryingCapacityInput): number {
  const capacities: number[] = [
    // Housing is always a constraint
    input.housingCapacity,
    // Food: production / per-capita consumption
    input.foodConsumptionPerCapita > 0
      ? input.foodProductionPerTick / input.foodConsumptionPerCapita
      : Infinity,
    // Terrain limit is always a constraint
    input.terrainLimit,
  ];

  // Water — only constrains if tracked
  if (input.waterTracked && input.waterPerCapita > 0) {
    capacities.push(input.waterCapacity / input.waterPerCapita);
  }

  // Oxygen — only constrains if tracked
  if (input.oxygenTracked && input.oxygenPerCapita > 0) {
    capacities.push(input.oxygenCapacity / input.oxygenPerCapita);
  }

  // Power — only constrains if there's per-capita demand
  if (input.powerPerCapita > 0) {
    capacities.push(input.powerCapacity / input.powerPerCapita);
  }

  const K = Math.min(...capacities);
  return Math.max(1, Math.floor(K));
}

/**
 * Convenience: compute carrying capacity from a Resources store + terrain.
 *
 * Uses ecology.json config for per-capita rates and terrain limits.
 * This is the function called from the tick pipeline.
 */
export function computeCarryingCapacityFromResources(
  resources: Resources,
  terrain: TerrainProfile,
  hasDome: boolean,
  housingCapacity: number,
  foodProductionPerTick: number,
): number {
  const cfg = ecologyConfig.carryingCapacity;
  const resCfg = ecologyConfig.resourceTracking;

  const terrainLimit =
    cfg.baseTerrainLimit[terrain.baseSurvivalCost as keyof typeof cfg.baseTerrainLimit] ??
    cfg.baseTerrainLimit.variable;

  return computeCarryingCapacity({
    housingCapacity,
    foodProductionPerTick,
    foodConsumptionPerCapita: 1.0, // 1 food unit per capita per tick (standard)
    waterTracked: isResourceTracked('water', terrain, hasDome),
    waterCapacity: resources.water + resources.waterRecycling,
    waterPerCapita: resCfg.water.perCapitaPerTick,
    oxygenTracked: isResourceTracked('oxygen', terrain, hasDome),
    oxygenCapacity: resources.oxygenProduction,
    oxygenPerCapita: resCfg.oxygen.perCapitaPerTick,
    powerCapacity: resources.power,
    powerPerCapita: resources.population > 0 ? resources.powerUsed / resources.population : 0,
    terrainLimit,
  });
}

/**
 * @module game/workers/demandSystem
 *
 * Construction Demand System — detects when worker needs exceed building
 * capacity and generates ConstructionDemand entries for the collective planner.
 *
 * The governor currently assigns workers to existing buildings but cannot
 * detect that NEW buildings are needed. This module fills that gap:
 * when housing, food, or power capacity is insufficient, it generates
 * demand entries with priority levels and suggested building defIds.
 */

import { buildingsLogic } from '@/ecs/archetypes';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DemandCategory = 'housing' | 'food_production' | 'power' | 'vodka_production';
export type DemandPriority = 'critical' | 'urgent' | 'normal';

export interface ConstructionDemand {
  category: DemandCategory;
  priority: DemandPriority;
  suggestedDefIds: string[];
  reason: string;
}

export interface ResourceSnapshot {
  food: number;
  vodka: number;
  power: number;
}

// ── Thresholds ────────────────────────────────────────────────────────────────

/** Food per capita below this is a critical shortage. */
export const FOOD_CRITICAL_THRESHOLD = 1.5;

/** Food per capita below this triggers urgent farm demand. */
export const FOOD_DEMAND_THRESHOLD = 3.0;

/** Housing occupancy ratio at or above this triggers urgent demand. */
export const HOUSING_OCCUPANCY_THRESHOLD = 0.8;

// ── Suggested Building DefIds ─────────────────────────────────────────────────

const HOUSING_SUGGESTIONS = ['workers-house-a', 'workers-house-b'];
const FOOD_SUGGESTIONS = ['collective-farm-hq'];
const POWER_SUGGESTIONS = ['power-station'];

// ── Detection ─────────────────────────────────────────────────────────────────

/**
 * Scans current game state for shortages and returns construction demands.
 *
 * @param population     - Current total population
 * @param housingCapacity - Total housing capacity across all operational buildings
 * @param resources      - Current resource snapshot (food, vodka, power)
 * @returns Array of ConstructionDemand entries (may be empty if no shortages)
 */
export function detectConstructionDemands(
  population: number,
  housingCapacity: number,
  resources: ResourceSnapshot,
): ConstructionDemand[] {
  const demands: ConstructionDemand[] = [];

  // ── Housing demand ──────────────────────────────────────────────────────
  const housingDemand = detectHousingDemand(population, housingCapacity);
  if (housingDemand) demands.push(housingDemand);

  // ── Food production demand ──────────────────────────────────────────────
  const foodDemand = detectFoodDemand(population, resources.food);
  if (foodDemand) demands.push(foodDemand);

  // ── Power demand ────────────────────────────────────────────────────────
  const powerDemand = detectPowerDemand();
  if (powerDemand) demands.push(powerDemand);

  return demands;
}

// ── Internal Helpers ──────────────────────────────────────────────────────────

function detectHousingDemand(
  population: number,
  housingCapacity: number,
): ConstructionDemand | null {
  if (population <= 0) return null;

  if (population > housingCapacity) {
    return {
      category: 'housing',
      priority: 'critical',
      suggestedDefIds: HOUSING_SUGGESTIONS,
      reason: `Population (${population}) exceeds housing capacity (${housingCapacity}) — workers are homeless`,
    };
  }

  const occupancyRatio = population / housingCapacity;
  if (occupancyRatio >= HOUSING_OCCUPANCY_THRESHOLD) {
    return {
      category: 'housing',
      priority: 'urgent',
      suggestedDefIds: HOUSING_SUGGESTIONS,
      reason: `Housing at ${Math.round(occupancyRatio * 100)}% capacity — approaching overcrowding`,
    };
  }

  return null;
}

function detectFoodDemand(
  population: number,
  food: number,
): ConstructionDemand | null {
  if (population <= 0) return null;

  const foodPerCapita = food / population;

  if (foodPerCapita < FOOD_CRITICAL_THRESHOLD) {
    return {
      category: 'food_production',
      priority: 'critical',
      suggestedDefIds: FOOD_SUGGESTIONS,
      reason: `Food per capita (${foodPerCapita.toFixed(1)}) is critically low — starvation imminent`,
    };
  }

  if (foodPerCapita < FOOD_DEMAND_THRESHOLD) {
    return {
      category: 'food_production',
      priority: 'urgent',
      suggestedDefIds: FOOD_SUGGESTIONS,
      reason: `Food per capita (${foodPerCapita.toFixed(1)}) is below safe levels — build more farms`,
    };
  }

  return null;
}

function detectPowerDemand(): ConstructionDemand | null {
  let unpoweredCount = 0;

  for (const entity of buildingsLogic) {
    if (entity.building.powerReq > 0 && !entity.building.powered) {
      unpoweredCount++;
    }
  }

  if (unpoweredCount === 0) return null;

  const priority: DemandPriority = unpoweredCount > 3 ? 'critical' : 'urgent';

  return {
    category: 'power',
    priority,
    suggestedDefIds: POWER_SUGGESTIONS,
    reason: `${unpoweredCount} building${unpoweredCount > 1 ? 's' : ''} without power — construct a power station`,
  };
}

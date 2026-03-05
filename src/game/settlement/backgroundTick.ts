/**
 * Lightweight tick for background (non-active) settlements.
 *
 * Does NOT use the ECS world. Instead, updates the settlement's
 * aggregate resource snapshot and pressure state using simple math.
 *
 * Called by SimulationEngine.tick() for all inactive settlements.
 */

import type { PressureReadContext } from '../../ai/agents/crisis/pressure/PressureDomains';
import type { GameRng } from '../SeedSystem';
import type { SettlementRuntime } from './SettlementRuntime';

/** Base per-capita food consumption per tick. */
const FOOD_PER_CAPITA_TICK = 0.1;

/** Background tick: update resources and pressure for an inactive settlement. */
export function backgroundSettlementTick(
  runtime: SettlementRuntime,
  _rng: GameRng,
): void {
  const { resources } = runtime;
  const pop = resources.population;
  if (pop <= 0) {
    runtime.settlement.population = 0;
    return;
  }

  // ── Food consumption ──
  const foodConsumed = Math.min(resources.food, pop * FOOD_PER_CAPITA_TICK);
  resources.food -= foodConsumed;

  // ── Starvation deaths (if food ran out) ──
  if (resources.food <= 0) {
    const starvationDeaths = Math.max(1, Math.floor(pop * 0.01));
    resources.population = Math.max(0, resources.population - starvationDeaths);
  }

  // ── Simple population growth (capped at housing) ──
  if (
    resources.food > resources.population * FOOD_PER_CAPITA_TICK * 10 &&
    resources.population < runtime.housingCapacity
  ) {
    const growth = Math.max(0, Math.floor(resources.population * 0.001));
    resources.population = Math.min(
      runtime.housingCapacity,
      resources.population + growth,
    );
  }

  // ── Determine food state for pressure context ──
  const foodRatio =
    pop > 0 ? resources.food / (pop * FOOD_PER_CAPITA_TICK * 30) : 1;
  let foodState: PressureReadContext['foodState'] = 'stable';
  if (foodRatio < 0.1) foodState = 'starvation';
  else if (foodRatio < 0.5) foodState = 'rationing';
  else if (foodRatio > 2) foodState = 'surplus';

  // ── Pressure accumulation ──
  const pressureCtx: PressureReadContext = {
    foodState,
    starvationCounter: foodState === 'starvation' ? 10 : 0,
    starvationGraceTicks: 90,
    averageMorale: 50,
    averageLoyalty: 50,
    sabotageCount: 0,
    flightCount: 0,
    population: resources.population,
    housingCapacity: runtime.housingCapacity,
    suspicionLevel: 0,
    blackMarks: 0,
    blat: 0,
    powerShortage: resources.power <= 0,
    unpoweredCount: 0,
    totalBuildings: runtime.buildingCount,
    averageDurability: 80,
    growthRate: 0,
    laborRatio: 0.6,
    sickCount: 0,
    quotaDeficit: 0,
    productionTrend: 0.5,
    carryingCapacity: runtime.housingCapacity,
    season: 'summer',
    weather: 'clear',
  };
  runtime.pressureSystem.tick(pressureCtx);

  // ── Sync back to settlement metadata ──
  runtime.settlement.population = resources.population;
}

/**
 * @fileoverview Pure building production function for aggregate mode.
 *
 * Given a BuildingComponent (with aggregate workforce fields), a building
 * definition, and a ProductionContext, computes the output for one tick.
 *
 * Deterministic when the same GameRng state is provided — stochastic events
 * (accidents, stakhanovites) use Poisson sampling, not per-worker rolls.
 */

import type { BuildingComponent } from '@/ecs/world';
import type { GameRng } from '@/game/SeedSystem';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Context needed for production calculation. */
export interface ProductionContext {
  /** Current era ID for era-specific modifiers */
  eraId: string;
  /** Whether the building has power */
  powered: boolean;
  /** Building durability 0-100 */
  durability: number;
  /** Season for food production ('spring'|'summer'|'autumn'|'winter') */
  season?: string;
  /** Seeded RNG for stochastic events */
  rng: GameRng;
  /** Era-specific production modifier (from doctrine/policy) */
  eraProductionMod?: number;
  /** Weather impact modifier (0-1, 1 = no impact) */
  weatherMod?: number;
}

/** Result of production calculation. */
export interface BuildingProductionResult {
  /** Resource type produced (if any) */
  resource?: 'food' | 'vodka';
  /** Amount produced */
  amount: number;
  /** Power generated (power plants only) */
  powerGenerated: number;
  /** Trudodni accrued by workers */
  trudodniAccrued: number;
  /** Number of accidents this tick (Poisson sampled) */
  accidents: number;
  /** Number of stakhanovite events (Poisson sampled) */
  stakhanovites: number;
  /** Effective worker utilization ratio 0-1 */
  utilization: number;
}

/** Minimal building definition shape needed by the production function. */
export interface BuildingDefForProduction {
  stats: {
    staffCap?: number;
    housingCap?: number;
    produces?: { resource: string; amount: number };
  };
}

// ─── Poisson Sampling ────────────────────────────────────────────────────────

/**
 * Sample from a Poisson distribution with the given lambda.
 * Uses the Knuth algorithm for small lambda, normal approximation for large.
 *
 * @param lambda - Expected number of events (rate parameter)
 * @param rng - Seeded RNG instance
 * @returns Non-negative integer sample
 */
export function poissonSample(lambda: number, rng: GameRng): number {
  if (lambda <= 0) return 0;
  if (lambda < 30) {
    // Knuth algorithm
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= rng.random();
    } while (p > L);
    return k - 1;
  }
  // Normal approximation for large lambda
  const u1 = rng.random();
  const u2 = rng.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * z));
}

// ─── Core Production Function ────────────────────────────────────────────────

/**
 * Compute a building's production output for one simulation tick.
 *
 * @param bldg - BuildingComponent with aggregate workforce fields
 * @param def - Building definition (stats.staffCap, stats.produces, etc.)
 * @param ctx - Production context (era, power, durability, RNG, modifiers)
 * @returns Production result with resource output, power, trudodni, events
 */
export function computeBuildingProduction(
  bldg: BuildingComponent,
  def: BuildingDefForProduction,
  ctx: ProductionContext,
): BuildingProductionResult {
  const result: BuildingProductionResult = {
    resource: undefined,
    amount: 0,
    powerGenerated: 0,
    trudodniAccrued: 0,
    accidents: 0,
    stakhanovites: 0,
    utilization: 0,
  };

  // No workers = no output
  if (bldg.workerCount === 0) {
    return result;
  }

  const staffCap = def.stats.staffCap ?? def.stats.housingCap ?? 10;
  const utilization = Math.min(1, bldg.workerCount / staffCap);
  result.utilization = utilization;

  const effectiveWorkers = bldg.workerCount * utilization; // diminishing returns above staffCap

  // ── Factor calculations ──
  const skillFactor = 0.5 + (bldg.avgSkill / 100) * 1.0; // 0.5 – 1.5
  const moraleFactor = 0.3 + (bldg.avgMorale / 100) * 1.0; // 0.3 – 1.3
  const conditionFactor = ctx.durability / 100; // 0.0 – 1.0
  const powerFactor = ctx.powered ? 1.0 : 0.3; // unpowered = 30%
  const eraMod = ctx.eraProductionMod ?? 1.0;
  const weatherFactor = ctx.weatherMod ?? 1.0;

  // ── Stochastic events (Poisson) ──
  const accidentLambda = bldg.workerCount * 0.001;
  result.accidents = poissonSample(accidentLambda, ctx.rng);

  const stakhanoviteLambda = bldg.workerCount * 0.0005 * (bldg.avgMorale / 100);
  result.stakhanovites = poissonSample(stakhanoviteLambda, ctx.rng);

  // ── Resource production ──
  if (def.stats.produces) {
    const baseRate = def.stats.produces.amount / staffCap; // per-worker base rate
    let output =
      baseRate *
      effectiveWorkers *
      skillFactor *
      moraleFactor *
      conditionFactor *
      powerFactor *
      eraMod *
      weatherFactor;

    // Stakhanovite bonus: each adds 10%
    output *= 1 + result.stakhanovites * 0.1;
    // Accident penalty: each reduces 5%, floor at 50%
    output *= Math.max(0.5, 1 - result.accidents * 0.05);

    result.amount = output;
    result.resource = def.stats.produces.resource as 'food' | 'vodka';
  }

  // ── Power generation ──
  if (bldg.powerOutput > 0) {
    result.powerGenerated = bldg.powerOutput * conditionFactor;
  }

  // ── Trudodni accrual ──
  result.trudodniAccrued = bldg.workerCount * utilization * (bldg.avgSkill / 100);

  return result;
}

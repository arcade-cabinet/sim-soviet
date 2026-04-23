/**
 * @module ai/agents/crisis/pressure/pressureNormalization
 *
 * Pure functions that normalize existing game metrics into 0-1 pressure readings.
 *
 * Each domain has its own formula based on thresholds that map game state
 * to "how stressed is this subsystem?" The normalization functions are
 * deliberately simple — they read from PressureReadContext (assembled from
 * existing agent APIs) and produce a single number.
 *
 * Convention: 0 = no stress, 1 = maximum stress.
 */

import type { PressureDomain, PressureReadContext } from './PressureDomains';

// ─── Utility ─────────────────────────────────────────────────────────────────

/** Clamp a value to [0, 1]. */
function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// ─── Per-Domain Normalization ────────────────────────────────────────────────

/**
 * Food pressure: surplus=0, stable=0.2, rationing=0.5,
 * starvation ramps from 0.8 to 1.0 based on counter progress.
 */
export function normalizeFood(ctx: PressureReadContext): number {
  switch (ctx.foodState) {
    case 'surplus':
      return 0;
    case 'stable':
      return 0.2;
    case 'rationing':
      return 0.5;
    case 'starvation': {
      const grace = ctx.starvationGraceTicks > 0 ? ctx.starvationGraceTicks : 90;
      const progress = clamp01(ctx.starvationCounter / grace);
      return 0.8 + progress * 0.2;
    }
  }
}

/**
 * Morale pressure: inverse of 0-100 morale scale.
 * 100 morale → 0 pressure, 0 morale → 1 pressure.
 */
export function normalizeMorale(ctx: PressureReadContext): number {
  return clamp01(1 - ctx.averageMorale / 100);
}

/**
 * Loyalty pressure: weighted combination of loyalty level and
 * sabotage/flight incident rate.
 *
 * - 70% weight: inverse loyalty (lower loyalty = more pressure)
 * - 30% weight: incident rate (sabotage + flight events, capped at 10)
 */
export function normalizeLoyalty(ctx: PressureReadContext): number {
  const loyaltyPressure = clamp01(1 - ctx.averageLoyalty / 100);
  const incidentPressure = clamp01((ctx.sabotageCount + ctx.flightCount) / 10);
  return loyaltyPressure * 0.7 + incidentPressure * 0.3;
}

/**
 * Housing pressure: population-to-capacity ratio.
 * Under 80% occupancy → 0, scales linearly to 1 at 150% occupancy.
 */
export function normalizeHousing(ctx: PressureReadContext): number {
  if (ctx.housingCapacity <= 0) {
    return ctx.population > 0 ? 1 : 0;
  }
  const ratio = ctx.population / ctx.housingCapacity;
  return clamp01((ratio - 0.8) / 0.7);
}

/**
 * Political pressure: max of suspicion, marks rate, blat exposure, and crime rate.
 * - Suspicion level (0-1 from KGBAgent)
 * - Marks severity (7 marks = max)
 * - Blat exposure (30 blat = max)
 * - Crime rate (0-1 from LawEnforcementSystem)
 */
export function normalizePolitical(ctx: PressureReadContext): number {
  const crimeComponent = ctx.crimeRate ?? 0;
  return clamp01(Math.max(ctx.suspicionLevel, ctx.blackMarks / 7, ctx.blat / 30, crimeComponent));
}

/**
 * Power pressure: zero when grid is stable, ramps based on unpowered ratio.
 * Shortage adds a base 0.3 floor.
 */
export function normalizePower(ctx: PressureReadContext): number {
  if (!ctx.powerShortage) return 0;
  const total = ctx.totalBuildings > 0 ? ctx.totalBuildings : 1;
  return clamp01(ctx.unpoweredCount / total + 0.3);
}

/**
 * Infrastructure pressure: inverse of average building durability.
 * 100% durability → 0 pressure, 0% → 1 pressure.
 */
export function normalizeInfrastructure(ctx: PressureReadContext): number {
  return clamp01(1 - ctx.averageDurability / 100);
}

/**
 * Demographic pressure: combination of negative growth, labor shortage,
 * and carrying capacity proximity.
 *
 * - 40% weight: inverse growth rate (negative growth → pressure)
 * - 30% weight: inverse labor ratio (low labor = more pressure)
 * - 30% weight: carrying capacity pressure (pop/K ratio above 0.85 → pressure)
 *
 * The carrying capacity component pushes local demographic pressure during
 * grounded free play without unlocking new settlements.
 */
export function normalizeDemographic(ctx: PressureReadContext): number {
  // Growth component: negative growth mapped to pressure via ×20 scale
  const growthPressure = clamp01(-ctx.growthRate * 20);
  // Labor component: ideal ratio ~0.5-0.6, below that = pressure
  const laborPressure = clamp01(1 - ctx.laborRatio);
  // Carrying capacity component: accelerates past 85% of K
  let capacityPressure = 0;
  if (ctx.carryingCapacity > 0) {
    const ratio = ctx.population / ctx.carryingCapacity;
    if (ratio > 0.85) {
      // Linear ramp from 0 at 85% to 1 at 100% of K
      capacityPressure = clamp01((ratio - 0.85) / 0.15);
    }
  }
  return growthPressure * 0.4 + laborPressure * 0.3 + capacityPressure * 0.3;
}

/**
 * Health pressure: ratio of sick citizens to population, ×5 amplification.
 * 20%+ sick → max pressure.
 */
export function normalizeHealth(ctx: PressureReadContext): number {
  if (ctx.population <= 0) return 0;
  const sickRatio = ctx.sickCount / ctx.population;
  return clamp01(sickRatio * 5);
}

/**
 * Economic pressure: quota performance + production trend.
 * - 60% weight: quota deficit (0 = met, 1 = completely missed)
 * - 40% weight: inverse production trend (declining = more pressure)
 */
export function normalizeEconomic(ctx: PressureReadContext): number {
  const quotaPressure = clamp01(ctx.quotaDeficit);
  const trendPressure = clamp01(1 - ctx.productionTrend);
  return quotaPressure * 0.6 + trendPressure * 0.4;
}

// ─── Dispatch ────────────────────────────────────────────────────────────────

/** Map of domain → normalization function. */
const NORMALIZERS: Record<PressureDomain, (ctx: PressureReadContext) => number> = {
  food: normalizeFood,
  morale: normalizeMorale,
  loyalty: normalizeLoyalty,
  housing: normalizeHousing,
  political: normalizePolitical,
  power: normalizePower,
  infrastructure: normalizeInfrastructure,
  demographic: normalizeDemographic,
  health: normalizeHealth,
  economic: normalizeEconomic,
};

/**
 * Compute raw pressure reading for a single domain.
 * Returns 0-1 (0 = no stress, 1 = maximum stress).
 */
export function normalizeDomain(domain: PressureDomain, ctx: PressureReadContext): number {
  return NORMALIZERS[domain](ctx);
}

/**
 * Compute raw pressure readings for ALL classical domains.
 * Returns a Record of domain → 0-1 reading.
 */
export function normalizeAllDomains(ctx: PressureReadContext): Record<PressureDomain, number> {
  const result = {} as Record<PressureDomain, number>;
  for (const [domain, fn] of Object.entries(NORMALIZERS)) {
    result[domain as PressureDomain] = fn(ctx);
  }
  return result;
}

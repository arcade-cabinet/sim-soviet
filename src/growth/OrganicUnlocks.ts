/**
 * @module growth/OrganicUnlocks
 *
 * Milestone-based era transitions for Freeform mode.
 *
 * In Historical mode, eras transition at fixed calendar years (1922, 1932, etc.).
 * In Freeform mode, eras transition when gameplay conditions are met:
 *   - Collectivization: population > 100 AND state has issued collectivization directive
 *   - Industrialization: settlement has 3+ factory/industrial buildings
 *   - War: a war crisis event is active (from ChaosEngine probability)
 *   - Reconstruction: war ended (no active war crises) AND was previously in war era
 *   - Thaw: population > 500 AND years since war > 5
 *   - Stagnation: growth rate < 2% for 3+ consecutive years
 *   - Eternal: simulation running for 50+ years
 *
 * Each unlock enables the same gameplay changes as the historical era transition.
 */

import type { EraId } from '../game/era/types';

// ─── Unlock Context ──────────────────────────────────────────────────────────

/** Snapshot of game state used to evaluate organic unlock conditions. */
export interface UnlockContext {
  /** Current total population. */
  population: number;
  /** Number of factory/industrial buildings (factory-office, power-station, vodka-distillery, bread-factory). */
  industrialBuildingCount: number;
  /** Whether any war crisis is currently active. */
  hasActiveWar: boolean;
  /** Whether a war was previously active (ever experienced). */
  hasExperiencedWar: boolean;
  /** Years since last war ended (Infinity if no war ever). */
  yearsSinceLastWar: number;
  /** Population growth rate over last 3 years (e.g. 0.02 = 2%). */
  recentGrowthRate: number;
  /** How many consecutive years growth rate has been below 2%. */
  lowGrowthYears: number;
  /** Total simulation years elapsed since game start. */
  simulationYearsElapsed: number;
  /** Current era ID (to prevent backward transitions). */
  currentEraId: EraId;
  /** Technology level from WorldAgent (0-1), used for Kardashev sub-era transitions. */
  techLevel?: number;
}

// ─── Era Index Map ───────────────────────────────────────────────────────────

const ERA_INDEX: Record<EraId, number> = {
  revolution: 0,
  collectivization: 1,
  industrialization: 2,
  great_patriotic: 3,
  reconstruction: 4,
  thaw_and_freeze: 5,
  stagnation: 6,
  the_eternal: 7,
  // Kardashev sub-eras (freeform only)
  post_soviet: 8,
  planetary: 9,
  solar_engineering: 10,
  type_one: 11,
  deconstruction: 12,
  dyson_swarm: 13,
  megaearth: 14,
  type_two_peak: 15,
};

// ─── Unlock Conditions ───────────────────────────────────────────────────────

interface OrganicUnlockRule {
  /** Target era this unlock transitions to. */
  targetEra: EraId;
  /** Evaluate whether conditions are met for this transition. */
  check(ctx: UnlockContext): boolean;
}

/**
 * Ordered list of organic unlock rules.
 * Rules are evaluated in order; the first matching rule whose target era
 * is strictly after the current era wins.
 */
const ORGANIC_UNLOCK_RULES: readonly OrganicUnlockRule[] = [
  // Revolution → Collectivization: population growth triggers collectivization push
  {
    targetEra: 'collectivization',
    check: (ctx) => ctx.population >= 100,
  },

  // Collectivization → Industrialization: build 3+ industrial buildings
  {
    targetEra: 'industrialization',
    check: (ctx) => ctx.industrialBuildingCount >= 3,
  },

  // Any pre-war era → Great Patriotic: a war crisis fires
  {
    targetEra: 'great_patriotic',
    check: (ctx) => ctx.hasActiveWar,
  },

  // Great Patriotic → Reconstruction: war ends
  {
    targetEra: 'reconstruction',
    check: (ctx) => !ctx.hasActiveWar && ctx.hasExperiencedWar && ctx.yearsSinceLastWar >= 1,
  },

  // Reconstruction → Thaw: population recovery + peace
  {
    targetEra: 'thaw_and_freeze',
    check: (ctx) => ctx.population >= 500 && ctx.yearsSinceLastWar > 5,
  },

  // Thaw → Stagnation: growth stalls
  {
    targetEra: 'stagnation',
    check: (ctx) => ctx.lowGrowthYears >= 3,
  },

  // Stagnation → Eternal: long-running simulation
  {
    targetEra: 'the_eternal',
    check: (ctx) => ctx.simulationYearsElapsed >= 50,
  },

  // ── Kardashev sub-era transitions (freeform only) ────────────────────────

  // the_eternal → post_soviet: techLevel > 0.72 OR 100+ simulation years
  {
    targetEra: 'post_soviet',
    check: (ctx) => (ctx.techLevel ?? 0) > 0.72 || ctx.simulationYearsElapsed >= 100,
  },

  // post_soviet → planetary: techLevel > 0.80 AND population > 10,000
  {
    targetEra: 'planetary',
    check: (ctx) => (ctx.techLevel ?? 0) > 0.8 && ctx.population > 10_000,
  },

  // planetary → solar_engineering: techLevel > 0.90 AND 200+ simulation years
  {
    targetEra: 'solar_engineering',
    check: (ctx) => (ctx.techLevel ?? 0) > 0.9 && ctx.simulationYearsElapsed >= 200,
  },

  // solar_engineering → type_one: techLevel >= 0.99 AND population > 100,000
  {
    targetEra: 'type_one',
    check: (ctx) => (ctx.techLevel ?? 0) >= 0.99 && ctx.population > 100_000,
  },

  // type_one → deconstruction: 500+ simulation years
  {
    targetEra: 'deconstruction',
    check: (ctx) => ctx.simulationYearsElapsed >= 500,
  },

  // deconstruction → dyson_swarm: 2,000+ simulation years
  {
    targetEra: 'dyson_swarm',
    check: (ctx) => ctx.simulationYearsElapsed >= 2_000,
  },

  // dyson_swarm → megaearth: 5,000+ simulation years
  {
    targetEra: 'megaearth',
    check: (ctx) => ctx.simulationYearsElapsed >= 5_000,
  },

  // megaearth → type_two_peak: 10,000+ simulation years
  {
    targetEra: 'type_two_peak',
    check: (ctx) => ctx.simulationYearsElapsed >= 10_000,
  },
];

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Evaluate organic unlock conditions and return the next era to transition to,
 * or null if no transition should occur.
 *
 * Only returns transitions that move forward (never backward).
 */
export function evaluateOrganicUnlocks(ctx: UnlockContext): EraId | null {
  const currentIndex = ERA_INDEX[ctx.currentEraId] ?? 0;

  for (const rule of ORGANIC_UNLOCK_RULES) {
    const targetIndex = ERA_INDEX[rule.targetEra] ?? 0;

    // Only allow forward transitions
    if (targetIndex <= currentIndex) continue;

    // Only allow transitions to the immediately next era
    // (skip rules that would jump multiple eras)
    if (targetIndex !== currentIndex + 1) continue;

    if (rule.check(ctx)) {
      return rule.targetEra;
    }
  }

  return null;
}

/**
 * List of building defIds considered "industrial" for the industrialization milestone.
 */
export const INDUSTRIAL_BUILDING_IDS: readonly string[] = [
  'factory-office',
  'power-station',
  'vodka-distillery',
  'bread-factory',
  'rail-depot',
  'warehouse',
];

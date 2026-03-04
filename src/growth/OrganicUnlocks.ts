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

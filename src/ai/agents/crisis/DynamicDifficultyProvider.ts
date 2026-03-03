/**
 * @module ai/agents/crisis/DynamicDifficultyProvider
 *
 * Pure functions that compute a DifficultyConfig from era modifiers layered
 * with crisis impacts.  This is the canonical way to derive difficulty
 * parameters when a Governor is active.
 *
 * Without active crises the output roughly matches the "comrade" (medium)
 * difficulty preset.
 */

import type { DifficultyConfig } from '@/ai/agents/political/ScoringSystem';
import type { DynamicModifiers } from './Governor';
import { DEFAULT_MODIFIERS } from './Governor';
import type { CrisisImpact } from './types';

/**
 * Compute a DifficultyConfig from era modifiers layered with crisis impacts.
 *
 * This is the canonical way to derive difficulty parameters when a Governor
 * is active. Without active crises, returns values roughly equivalent to
 * the "comrade" (medium) difficulty preset.
 *
 * @param baseModifiers - Era-derived base modifiers (default: DEFAULT_MODIFIERS)
 * @param crisisImpacts - Active crisis impacts to layer on top
 * @returns A DifficultyConfig compatible with existing system consumers
 */
export function computeDynamicDifficulty(
  baseModifiers?: Partial<DynamicModifiers>,
  crisisImpacts?: CrisisImpact[],
): DifficultyConfig {
  // Start from defaults
  const base: DynamicModifiers = { ...DEFAULT_MODIFIERS, ...baseModifiers };

  // Layer crisis impacts multiplicatively
  let quotaMult = 1.0;
  let growthMult = 1.0;
  let decayMult = 1.0;
  const consumptionMult = 1.0;
  let maxKgbMult = 1.0;

  if (crisisImpacts) {
    for (const impact of crisisImpacts) {
      if (impact.political?.quotaMult !== undefined) {
        quotaMult *= impact.political.quotaMult;
      }
      if (impact.social?.growthMult !== undefined) {
        growthMult *= impact.social.growthMult;
      }
      if (impact.infrastructure?.decayMult !== undefined) {
        decayMult *= impact.infrastructure.decayMult;
      }
      if (impact.political?.kgbAggressionMult !== undefined) {
        maxKgbMult = Math.max(maxKgbMult, impact.political.kgbAggressionMult);
      }
    }
  }

  // Map KGB aggression multiplier to level
  let kgbAggression: 'low' | 'medium' | 'high' = base.kgbAggression;
  if (maxKgbMult >= 2.0) kgbAggression = 'high';
  else if (maxKgbMult >= 1.3) kgbAggression = 'medium';

  return {
    label: 'Dynamic', // Distinguishes from static presets
    quotaMultiplier: base.quotaMultiplier * quotaMult,
    markDecayTicks: base.markDecayTicks,
    politrukRatio: base.politrukRatio,
    kgbAggression,
    growthMultiplier: base.growthMultiplier * growthMult,
    winterModifier: base.winterModifier,
    decayMultiplier: base.decayMultiplier * decayMult,
    resourceMultiplier: base.resourceMultiplier,
    consumptionMultiplier: base.consumptionMultiplier * consumptionMult,
  };
}

/**
 * Convert DynamicModifiers to DifficultyConfig.
 * This is a simple adapter for systems that expect DifficultyConfig.
 *
 * @param modifiers - The dynamic modifiers to convert
 * @returns A DifficultyConfig with label 'Dynamic'
 */
export function modifiersToDifficultyConfig(modifiers: DynamicModifiers): DifficultyConfig {
  return {
    label: 'Dynamic',
    ...modifiers,
  };
}

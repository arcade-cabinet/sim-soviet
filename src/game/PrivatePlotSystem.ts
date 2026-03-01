/**
 * PrivatePlotSystem — calculates food production from dvor private plots.
 *
 * Historical: Under the 1935 Model Charter, private plots (0.25-0.5 hectares)
 * produced 25-50% of total agricultural output on just 1-3% of the land.
 * Each household could keep a cow, pigs, sheep, and poultry.
 */

import { dvory } from '@/ecs/archetypes';
import type { EraId } from './era';

/** Base food per hectare per year from private plot cultivation. */
const BASE_FOOD_PER_HECTARE_PER_YEAR = 200;
/** Months per year for converting annual to monthly production. */
const MONTHS_PER_YEAR = 12;

/** Monthly food bonus per livestock type. */
const LIVESTOCK_FOOD: Record<string, number> = {
  cow: 4,
  pig: 2,
  sheep: 0.4,
  poultry: 0.2,
};

/** Era-specific multipliers for private plot production. */
const ERA_PLOT_MULTIPLIER: Partial<Record<EraId, number>> = {
  thaw_and_freeze: 1.5, // Larger plots allowed under Khrushchev
  great_patriotic: 0.0, // Plots confiscated for war effort
  stagnation: 0.8, // Declining rural investment
};

const DEFAULT_ERA_MULTIPLIER = 1.0;

/**
 * Calculate total monthly food production from all private plots.
 *
 * Only dvory with at least one working-age member (16-60) produce food.
 * Production scales with plot size, livestock counts, and era modifiers.
 */
export function calculatePrivatePlotProduction(eraId: string): number {
  const eraMult = ERA_PLOT_MULTIPLIER[eraId as EraId] ?? DEFAULT_ERA_MULTIPLIER;
  if (eraMult === 0) return 0;

  let totalFood = 0;

  for (const entity of dvory) {
    const dvor = entity.dvor;

    // Check for at least one working-age member (16-60)
    const hasWorker = dvor.members.some((m) => m.age >= 16 && m.age <= 60);
    if (!hasWorker) continue;

    // Base plot food production (annual → monthly)
    const plotFood = (dvor.privatePlotSize * BASE_FOOD_PER_HECTARE_PER_YEAR) / MONTHS_PER_YEAR;

    // Livestock bonus
    let livestockFood = 0;
    const ls = dvor.privateLivestock;
    livestockFood += ls.cow * LIVESTOCK_FOOD.cow!;
    livestockFood += ls.pig * LIVESTOCK_FOOD.pig!;
    livestockFood += ls.sheep * LIVESTOCK_FOOD.sheep!;
    livestockFood += ls.poultry * LIVESTOCK_FOOD.poultry!;

    totalFood += (plotFood + livestockFood) * eraMult;
  }

  return totalFood;
}

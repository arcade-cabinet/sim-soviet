/**
 * LoyaltySystem — adjusts dvor loyalty to the collective based on conditions.
 *
 * Historical: Resistance to collectivization was widespread — 14 million
 * peasant protests in 1930. Loyalty determines sabotage and flight risk.
 */

import { dvory } from '@/ecs/archetypes';

/** Result of a monthly loyalty tick. */
export interface LoyaltyResult {
  /** Number of dvory that committed sabotage this month. */
  sabotageCount: number;
  /** Number of dvory whose members fled this month. */
  flightCount: number;
  /** Average loyalty across all dvory. */
  avgLoyalty: number;
}

/** Monthly loyalty gain when food supply is good (foodLevel > 0.7). */
const LOYALTY_GAIN_GOOD_FOOD = 0.15;
/** Monthly loyalty loss during starvation (foodLevel <= 0). */
const LOYALTY_LOSS_STARVATION = -0.8;
/** Sabotage chance per dvor per month when loyalty < 20. */
const SABOTAGE_CHANCE = 0.1;
/** Flight chance per dvor per month when loyalty < 10. */
const FLIGHT_CHANCE = 0.05;

/**
 * Tick loyalty for all dvory based on food supply.
 *
 * @param _eraId - Current era (reserved for future era-specific modifiers)
 * @param foodLevel - Normalized food level (0 = starving, 1 = well-fed)
 * @param _quotaMet - Whether the current quota is met (reserved for event-driven adjustments)
 * @param rng - Optional random number generator (falls back to Math.random)
 */
export function tickLoyalty(
  _eraId: string,
  foodLevel: number,
  _quotaMet: boolean,
  rng?: { random(): number },
): LoyaltyResult {
  let sabotageCount = 0;
  let flightCount = 0;
  let loyaltySum = 0;
  let dvorCount = 0;

  for (const entity of dvory) {
    const dvor = entity.dvor;
    dvorCount++;

    // Adjust loyalty based on food supply
    if (foodLevel > 0.7) {
      dvor.loyaltyToCollective = Math.min(100, dvor.loyaltyToCollective + LOYALTY_GAIN_GOOD_FOOD);
    } else if (foodLevel <= 0) {
      dvor.loyaltyToCollective = Math.max(0, dvor.loyaltyToCollective + LOYALTY_LOSS_STARVATION);
    }

    const roll = rng ? rng.random() : Math.random;

    // Sabotage check — disloyal dvory damage production
    if (dvor.loyaltyToCollective < 20) {
      const r = typeof roll === 'function' ? roll() : roll;
      if (r < SABOTAGE_CHANCE) {
        sabotageCount++;
      }
    }

    // Flight check — extremely disloyal members flee
    if (dvor.loyaltyToCollective < 10) {
      const r = typeof roll === 'function' ? roll() : roll;
      if (r < FLIGHT_CHANCE) {
        flightCount++;
      }
    }

    loyaltySum += dvor.loyaltyToCollective;
  }

  return {
    sabotageCount,
    flightCount,
    avgLoyalty: dvorCount > 0 ? loyaltySum / dvorCount : 50,
  };
}

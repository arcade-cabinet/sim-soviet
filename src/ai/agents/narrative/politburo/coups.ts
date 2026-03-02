/**
 * @module game/politburo/coups
 *
 * Coup and purge probability calculations.
 */

import type { GeneralSecretary, Minister } from './types';
import { Ministry } from './types';

/**
 * Calculates coup probability for a minister per year.
 *
 * Formula: coupChance = (ambition * (100 - loyalty)) / 10000
 *          + KGB chairman bonus (0.15 if KGB)
 *          + faction bonus (0.05 per faction member)
 *          - GS paranoia penalty (paranoia / 200)
 *
 * ┌──────────────────┬──────────┬──────────┬──────────────────┐
 * │ Ambition/Loyalty │ Low Loy  │ Mid Loy  │ High Loy         │
 * │                  │ (0-30)   │ (31-60)  │ (61-100)         │
 * ├──────────────────┼──────────┼──────────┼──────────────────┤
 * │ Low Amb (0-30)   │ 0.21     │ 0.12     │ 0.00             │
 * │ Mid Amb (31-60)  │ 0.42     │ 0.24     │ 0.06             │
 * │ High Amb (61-100)│ 0.70     │ 0.40     │ 0.10             │
 * └──────────────────┴──────────┴──────────┴──────────────────┘
 * (Base rates before KGB/faction/paranoia adjustments)
 */
export function calculateCoupChance(minister: Minister, gs: GeneralSecretary, factionSize: number): number {
  const base = (minister.ambition * (100 - minister.loyalty)) / 10000;
  const kgbBonus = minister.ministry === Ministry.KGB ? 0.15 : 0;
  const factionBonus = Math.max(0, factionSize - 1) * 0.05;
  const paranoiaPenalty = gs.paranoia / 200;

  return Math.max(0, Math.min(1, base + kgbBonus + factionBonus - paranoiaPenalty));
}

/**
 * Calculates purge probability for a minister per year.
 *
 * Formula: purgeChance = (GS.paranoia / 100) * (1 - minister.loyalty/100)
 *          + competence penalty (if competence < 30: +0.1)
 *          + corruption risk (corruption / 200)
 *          - KGB protection (if KGB: -0.2, "they know too much")
 *
 * ┌─────────────────────┬──────────┬──────────┬──────────────────┐
 * │ Paranoia / Loyalty   │ Low Loy  │ Mid Loy  │ High Loy         │
 * │                      │ (0-30)   │ (31-60)  │ (61-100)         │
 * ├─────────────────────┼──────────┼──────────┼──────────────────┤
 * │ Low Para (0-30)      │ 0.21     │ 0.12     │ 0.00             │
 * │ Mid Para (31-60)     │ 0.42     │ 0.24     │ 0.06             │
 * │ High Para (61-100)   │ 0.70     │ 0.40     │ 0.10             │
 * └─────────────────────┴──────────┴──────────┴──────────────────┘
 * (Base rates before competence/corruption/KGB adjustments)
 */
export function calculatePurgeChance(minister: Minister, gs: GeneralSecretary): number {
  const base = (gs.paranoia / 100) * (1 - minister.loyalty / 100);
  const competencePenalty = minister.competence < 30 ? 0.1 : 0;
  const corruptionRisk = minister.corruption / 200;
  const kgbProtection = minister.ministry === Ministry.KGB ? 0.2 : 0;

  return Math.max(0, Math.min(1, base + competencePenalty + corruptionRisk - kgbProtection));
}

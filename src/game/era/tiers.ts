/**
 * @module game/era/tiers
 *
 * Settlement tier requirements for buildings. Buildings are gated
 * behind both eras (historical progression) and settlement tiers
 * (selo -> posyolok -> pgt -> gorod).
 *
 * Buildings not listed in BUILDING_TIER_REQUIREMENTS default to 'selo'
 * (always available once era-unlocked).
 */

import type { SettlementTier } from '../SettlementSystem';

/**
 * Ordered list of settlement tiers from lowest to highest.
 * Used for comparison: a building is available if the player's
 * current tier index >= the building's required tier index.
 */
export const SETTLEMENT_TIER_ORDER: readonly SettlementTier[] = ['selo', 'posyolok', 'pgt', 'gorod'];

/**
 * Maps building defIds to the minimum settlement tier required to build them.
 * Buildings NOT listed here default to 'selo' (always available once era-unlocked).
 *
 * Design intent:
 * - selo: basic survival (housing, farm, power, fences, guard post)
 * - posyolok: basic industry + education (factories, warehouse, school, barracks)
 * - pgt: full infrastructure (hospitals, government, transport, culture)
 * - gorod: prestige buildings (KGB, high-rises, megablock)
 */
export const BUILDING_TIER_REQUIREMENTS: Readonly<Record<string, SettlementTier>> = {
  // ── selo (tier 0) — basic survival ────────────────────────
  // workers-house-a: default (selo)
  // workers-house-b: default (selo)
  // collective-farm-hq: default (selo)
  // power-station: default (selo)
  // guard-post: default (selo)
  // fence: default (selo)
  // fence-low: default (selo)
  // concrete-block: default (selo)

  // ── posyolok (tier 1) — basic industry + education ────────
  'workers-house-c': 'posyolok',
  'bread-factory': 'posyolok',
  warehouse: 'posyolok',
  'factory-office': 'posyolok',
  school: 'posyolok',
  barracks: 'posyolok',
  'gulag-admin': 'posyolok',
  'road-depot': 'posyolok',
  'motor-pool': 'posyolok',

  // ── pgt (tier 2) — full infrastructure ────────────────────
  'apartment-tower-a': 'pgt',
  hospital: 'pgt',
  'government-hq': 'pgt',
  'ministry-office': 'pgt',
  'train-station': 'pgt',
  'rail-depot': 'pgt',
  polyclinic: 'pgt',
  'workers-club': 'pgt',
  'cultural-palace': 'pgt',
  'post-office': 'pgt',
  'fire-station': 'pgt',
  'vodka-distillery': 'pgt',
  'radio-station': 'pgt',

  // ── gorod (tier 3) — prestige buildings ───────────────────
  'apartment-tower-b': 'gorod',
  'apartment-tower-c': 'gorod',
  'apartment-tower-d': 'gorod',
  'kgb-office': 'gorod',
};

/**
 * Get the minimum settlement tier required for a building.
 * Returns 'selo' for buildings not listed in BUILDING_TIER_REQUIREMENTS.
 */
export function getBuildingTierRequirement(defId: string): SettlementTier {
  return BUILDING_TIER_REQUIREMENTS[defId] ?? 'selo';
}

/**
 * Check if a settlement tier meets the requirement for a building.
 * Returns true if `currentTier` >= the building's required tier.
 */
export function tierMeetsRequirement(currentTier: SettlementTier, requiredTier: SettlementTier): boolean {
  return SETTLEMENT_TIER_ORDER.indexOf(currentTier) >= SETTLEMENT_TIER_ORDER.indexOf(requiredTier);
}

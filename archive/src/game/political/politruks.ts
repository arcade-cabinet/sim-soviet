/**
 * @module game/political/politruks
 *
 * Politruk-specific constants and tick logic.
 */

import type { PoliticalEntityStats, PoliticalTickResult, PolitrukEffect } from './types';

// ─── Constants ──────────────────────────────────────────────────────────────

/** How often politruks rotate to a new building (ticks). */
export const POLITRUK_ROTATION_INTERVAL = 120;

/** Politruk morale boost (through fear). */
export const POLITRUK_MORALE_BOOST = 10;

/** Politruk production penalty (fraction, 0.15 = 15%). */
export const POLITRUK_PRODUCTION_PENALTY = 0.15;

// ─── Logic ──────────────────────────────────────────────────────────────────

/** Create the effect a politruk has on its stationed building. */
export function createPolitrukEffect(entity: PoliticalEntityStats): PolitrukEffect | null {
  if (!entity.targetBuilding) return null;

  return {
    buildingGridX: entity.stationedAt.gridX,
    buildingGridY: entity.stationedAt.gridY,
    moraleBoost: POLITRUK_MORALE_BOOST,
    productionPenalty: POLITRUK_PRODUCTION_PENALTY,
    workerSlotConsumed: 1,
  };
}

/** Apply a politruk's effect to the tick result. */
export function applyPolitrukTick(entity: PoliticalEntityStats, result: PoliticalTickResult): void {
  const effect = createPolitrukEffect(entity);
  if (effect) {
    result.politrukEffects.push(effect);
  }
}

/**
 * @module ai/agents/infrastructure/megaScalingSystem
 *
 * Building tier mega-scaling system. When demand exceeds capacity and
 * the current era permits, buildings scale UP in tier — same GLB model,
 * brutalist-scaled to represent Soviet mega-infrastructure.
 *
 * Trigger: demand > capacity * 1.5 AND currentTier < maxTier(era)
 */

import { getMaxBuildingTier, getScaleFactor } from '@/config/megaScaling';

/** Result returned after a successful scale-up operation. */
export interface ScaleUpResult {
  /** Previous tier before scale-up */
  previousTier: number;
  /** New tier after scale-up */
  newTier: number;
  /** New effective capacity after scale-up */
  newCapacity: number;
  /** Scale factor applied at the new tier */
  scaleFactor: number;
}

/**
 * Returns the maximum building tier permitted by the given era.
 *
 * @param era - Era identifier string (maps to ERA_MAX_TIER in megaScaling config)
 * @returns Maximum tier number for the era
 */
export function getMaxTier(era: string): number {
  return getMaxBuildingTier(era);
}

/**
 * Returns the effective capacity of a building at a given tier.
 *
 * @param baseCapacity - The building's base (tier 0) capacity
 * @param tier - Current tier level
 * @returns Scaled capacity (baseCapacity * tierScaleFactor)
 */
export function getScaledCapacity(baseCapacity: number, tier: number): number {
  return baseCapacity * getScaleFactor(tier);
}

/**
 * Checks whether a building should scale up based on demand pressure.
 *
 * Trigger condition: demand > capacity * 1.5 AND currentTier < maxTier(era)
 *
 * @param buildingCapacity - Current effective capacity of the building
 * @param demand - Current demand on the building
 * @param era - Current era identifier string
 * @param currentTier - Building's current tier (default 0)
 * @returns true if the building should scale up
 */
export function checkScaleUpTrigger(
  buildingCapacity: number,
  demand: number,
  era: string,
  currentTier = 0,
): boolean {
  if (demand <= buildingCapacity * 1.5) return false;
  if (currentTier >= getMaxTier(era)) return false;
  return true;
}

/**
 * Scales a building up by one tier, returning the result.
 *
 * Does NOT mutate the building entity — caller is responsible for
 * applying the returned values to the ECS component.
 *
 * @param baseCapacity - The building's base (tier 0) capacity
 * @param currentTier - The building's current tier
 * @returns ScaleUpResult with new tier and capacity, or null if already at max possible tier (5)
 */
export function scaleUpBuilding(baseCapacity: number, currentTier: number): ScaleUpResult | null {
  const newTier = currentTier + 1;
  const factor = getScaleFactor(newTier);
  // If the new tier has no defined scale factor (beyond tier 5), reject
  if (newTier > 5) return null;

  return {
    previousTier: currentTier,
    newTier,
    newCapacity: baseCapacity * factor,
    scaleFactor: factor,
  };
}

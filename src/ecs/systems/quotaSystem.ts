/**
 * @module ecs/systems/quotaSystem
 *
 * Tracks 5-year plan progress based on the current quota target.
 *
 * The quota system reads the current food or vodka stockpile from
 * the resource store and updates the quota's `current` value
 * each tick. Quota deadline checking and advancement is handled
 * by the SimulationEngine (which manages the date).
 */

import { getResourceEntity } from '@/ecs/archetypes';

/**
 * Quota state — tracks the current 5-year plan goals.
 * Kept as a plain mutable object for simplicity.
 */
export interface QuotaState {
  /** Resource type being tracked */
  type: 'food' | 'vodka';
  /** Target amount to reach */
  target: number;
  /** Current progress */
  current: number;
  /** Year the quota must be met by */
  deadlineYear: number;
}

/**
 * Creates a default QuotaState for tracking a 5-year plan quota.
 *
 * @returns A QuotaState with `type` = 'food', `target` = 500, `current` = 0, and `deadlineYear` = 1927.
 */
export function createDefaultQuota(): QuotaState {
  return {
    type: 'food',
    target: 500,
    current: 0,
    deadlineYear: 1927,
  };
}

/**
 * Runs the quota tracking system for one simulation tick.
 *
 * Updates `quota.current` based on the corresponding resource
 * value in the resource store.
 *
 * @param quota - Mutable quota state to update
 */
export function quotaSystem(quota: QuotaState): void {
  const store = getResourceEntity();
  if (!store) return;

  switch (quota.type) {
    case 'food':
      quota.current = store.resources.food;
      break;
    case 'vodka':
      quota.current = store.resources.vodka;
      break;
  }
}
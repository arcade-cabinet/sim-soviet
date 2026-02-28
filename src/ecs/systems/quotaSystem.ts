/**
 * @module ecs/systems/quotaSystem
 *
 * Tracks 5-year plan progress based on the current quota target.
 *
 * FIX-08: Expanded to support multi-resource quotas.
 * The primary quota tracks a single resource (food or vodka) for backwards
 * compatibility. The optional `resourceQuotas` field tracks per-resource
 * targets for the full 5-year plan.
 *
 * Quota deadline checking and advancement is handled
 * by the SimulationEngine (which manages the date).
 */

import { getResourceEntity } from '@/ecs/archetypes';

/** Trackable resource types for the multi-resource quota system. */
export type QuotaResourceType = 'food' | 'vodka' | 'steel' | 'timber' | 'power';

/** Per-resource quota target and current progress. */
export interface ResourceQuota {
  target: number;
  current: number;
}

/**
 * Quota state — tracks the current 5-year plan goals.
 * Kept as a plain mutable object for simplicity.
 */
export interface QuotaState {
  /** Primary resource type being tracked (legacy single-resource quota) */
  type: 'food' | 'vodka';
  /** Primary target amount to reach */
  target: number;
  /** Primary current progress */
  current: number;
  /** Year the quota must be met by */
  deadlineYear: number;
  /** FIX-08: Multi-resource quota targets. If present, all must be met. */
  resourceQuotas?: Partial<Record<QuotaResourceType, ResourceQuota>>;
}

/**
 * Default initial quota state.
 */
export function createDefaultQuota(): QuotaState {
  return {
    type: 'food',
    target: 500,
    current: 0,
    deadlineYear: 1927,
    // FIX-08: Multi-resource quotas — initial targets for the first plan
    resourceQuotas: {
      food: { target: 500, current: 0 },
      vodka: { target: 100, current: 0 },
      steel: { target: 50, current: 0 },
      timber: { target: 100, current: 0 },
      power: { target: 20, current: 0 },
    },
  };
}

/**
 * Runs the quota tracking system for one simulation tick.
 *
 * Updates `quota.current` based on the corresponding resource
 * value in the resource store. Also updates multi-resource quotas.
 *
 * @param quota - Mutable quota state to update
 */
export function quotaSystem(quota: QuotaState): void {
  const store = getResourceEntity();
  if (!store) return;

  // Legacy single-resource quota
  switch (quota.type) {
    case 'food':
      quota.current = store.resources.food;
      break;
    case 'vodka':
      quota.current = store.resources.vodka;
      break;
  }

  // FIX-08: Update multi-resource quotas
  if (quota.resourceQuotas) {
    const r = store.resources;
    const rq = quota.resourceQuotas;
    if (rq.food) rq.food.current = r.food;
    if (rq.vodka) rq.vodka.current = r.vodka;
    if (rq.steel) rq.steel.current = r.steel;
    if (rq.timber) rq.timber.current = r.timber;
    if (rq.power) rq.power.current = r.power;
  }
}

/**
 * Check if all multi-resource quotas are met.
 * Returns true if resourceQuotas is undefined (legacy mode — use primary quota).
 */
export function areAllQuotasMet(quota: QuotaState): boolean {
  if (!quota.resourceQuotas) return quota.current >= quota.target;
  for (const rq of Object.values(quota.resourceQuotas)) {
    if (rq && rq.current < rq.target) return false;
  }
  return true;
}

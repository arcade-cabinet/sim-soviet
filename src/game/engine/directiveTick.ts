/**
 * directiveTick — applies Central Committee directive effects each tick.
 *
 * Reads the active directive from gameStore, checks lock-in expiration,
 * applies per-tick effects (morale shifts, production modifiers),
 * and handles one-shot actions (emergency rations distribution).
 */

import {
  canIssueDirective,
  type Directive,
  getDirectiveById,
} from '../../ui/hq-tabs/CentralCommitteeTab';
import { getActiveDirective, setActiveDirective } from '../../stores/gameStore';
import { buildingsLogic } from '../../ecs/archetypes';
import type { RaionPool } from '../../ecs/world';
import type { WorkerSystem } from '../../ai/agents/workforce/WorkerSystem';
import type { SimCallbacks } from './types';

/** Result of directive tick processing, consumed by phaseProduction for modifier application. */
export interface DirectiveTickResult {
  /** Production multiplier from active directive (1.0 = no effect). */
  productionMult: number;
  /** Whether the labor_holiday directive is active this tick (skip production). */
  laborHoliday: boolean;
}

/** Default result when no directive is active. */
const NO_DIRECTIVE: DirectiveTickResult = { productionMult: 1.0, laborHoliday: false };

/**
 * Process the active Central Committee directive for this tick.
 *
 * Called once per tick, before production. Handles:
 * - Lock-in expiration (clears directive when timer runs out)
 * - One-shot effects on issuance tick (emergency rations, morale/loyalty shifts)
 * - Per-tick production modifiers
 *
 * @param currentTick - Current total tick count
 * @param workerSystem - WorkerSystem for morale adjustments
 * @param storeResources - Resource store for emergency rations
 * @param raion - RaionPool for aggregate-mode morale/loyalty shifts (may be undefined)
 * @param callbacks - SimCallbacks for toast/advisor messages
 * @returns Production modifiers to apply during phaseProduction
 */
export function tickDirective(
  currentTick: number,
  workerSystem: WorkerSystem,
  storeResources: Record<string, any> & { food: number; emergencyReserve: number },
  raion: RaionPool | undefined,
  callbacks: SimCallbacks,
): DirectiveTickResult {
  const active = getActiveDirective();
  if (!active) return NO_DIRECTIVE;

  // Check if lock-in has expired
  if (canIssueDirective(active, currentTick)) {
    setActiveDirective(null);
    callbacks.onToast('DIRECTIVE EXPIRED — Central Committee decree concluded.', 'warning');
    return NO_DIRECTIVE;
  }

  const directive = getDirectiveById(active.directiveId);
  if (!directive) return NO_DIRECTIVE;

  // One-shot effects: apply only on the tick the directive was issued
  if (currentTick === active.issuedAtTick) {
    applyIssuanceEffects(directive, workerSystem, storeResources, raion, callbacks);
  }

  // Per-tick production modifiers
  return getProductionModifiers(directive);
}

/**
 * Apply one-shot effects when a directive is first issued.
 */
function applyIssuanceEffects(
  directive: Directive,
  workerSystem: WorkerSystem,
  storeResources: Record<string, any> & { food: number; emergencyReserve: number },
  raion: RaionPool | undefined,
  callbacks: SimCallbacks,
): void {
  switch (directive.id) {
    case 'increase_production':
      // Morale -10 applied once on issuance
      applyMoraleDelta(-10, workerSystem, raion);
      callbacks.onToast('DECREE: Production quotas raised 20%. Workers grumble.', 'warning');
      break;

    case 'labor_holiday':
      // Morale +15 applied once on issuance
      applyMoraleDelta(15, workerSystem, raion);
      callbacks.onToast('DECREE: Labor holiday declared. The collective rests.', 'warning');
      break;

    case 'emergency_rations':
      // Distribute emergency reserves to food supply
      if (storeResources.emergencyReserve > 0) {
        const distributed = storeResources.emergencyReserve;
        storeResources.food += distributed;
        storeResources.emergencyReserve = 0;
        callbacks.onToast(`DECREE: ${Math.round(distributed)} emergency rations distributed.`, 'warning');
      } else {
        callbacks.onToast('DECREE: No emergency reserves available to distribute.', 'warning');
      }
      break;

    case 'mandatory_overtime':
      // Morale -20 applied once on issuance
      applyMoraleDelta(-20, workerSystem, raion);
      callbacks.onToast('DECREE: Mandatory overtime imposed. Workers suffer.', 'warning');
      break;

    case 'patriotic_campaign':
      // Loyalty +10 applied once on issuance
      applyLoyaltyDelta(10, workerSystem, raion);
      callbacks.onToast('DECREE: Patriotic campaign launched. For the motherland!', 'warning');
      break;
  }
}

/**
 * Get per-tick production modifiers for the given directive.
 */
function getProductionModifiers(directive: Directive): DirectiveTickResult {
  switch (directive.id) {
    case 'increase_production':
      return { productionMult: 1.2, laborHoliday: false };

    case 'labor_holiday':
      return { productionMult: 0.0, laborHoliday: true };

    case 'mandatory_overtime':
      return { productionMult: 1.3, laborHoliday: false };

    default:
      return NO_DIRECTIVE;
  }
}

/**
 * Apply a global morale delta across all workers (entity and aggregate modes).
 */
function applyMoraleDelta(
  delta: number,
  workerSystem: WorkerSystem,
  raion: RaionPool | undefined,
): void {
  // Entity mode: WorkerSystem handles individual stats
  workerSystem.applyGlobalMoraleDelta(delta);

  // Aggregate mode: also shift building-level avgMorale and raion
  if (raion) {
    raion.avgMorale = Math.max(0, Math.min(100, raion.avgMorale + delta));
    for (const entity of buildingsLogic) {
      const bld = entity.building;
      if (bld.workerCount > 0) {
        bld.avgMorale = Math.max(0, Math.min(100, bld.avgMorale + delta));
      }
    }
  }
}

/**
 * Apply a global loyalty delta across all workers (entity and aggregate modes).
 */
function applyLoyaltyDelta(
  delta: number,
  workerSystem: WorkerSystem,
  raion: RaionPool | undefined,
): void {
  // Entity mode: shift loyalty on dvor entities via the worker stats
  // WorkerSystem doesn't expose applyGlobalLoyaltyDelta, so we use the
  // same pattern but work through buildings in aggregate mode.
  // For entity mode, loyalty is tracked on dvors, not individual workers.

  // Aggregate mode: shift building-level avgLoyalty and raion
  if (raion) {
    raion.avgLoyalty = Math.max(0, Math.min(100, raion.avgLoyalty + delta));
    for (const entity of buildingsLogic) {
      const bld = entity.building;
      if (bld.workerCount > 0) {
        bld.avgLoyalty = Math.max(0, Math.min(100, bld.avgLoyalty + delta));
      }
    }
  }
}

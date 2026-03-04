/**
 * Condition-based crisis state machine.
 * Transitions on CONDITIONS, not tick counters.
 * A famine peaks when food drops below threshold, wanes when food recovers.
 */

export type CrisisPhaseCondition = 'dormant' | 'building' | 'peak' | 'waning';

export interface ConditionContext {
  food: number;
  population: number;
  morale: number;
  [key: string]: number; // extensible
}

export interface CrisisConditionState {
  phase: CrisisPhaseCondition;
  activationCondition: (ctx: ConditionContext) => boolean;
  peakCondition: (ctx: ConditionContext) => boolean;
  reliefCondition: (ctx: ConditionContext) => boolean;
}

/**
 * Evaluate crisis phase transition. Pure function.
 */
export function transitionCrisis(crisis: CrisisConditionState, ctx: ConditionContext): CrisisPhaseCondition {
  switch (crisis.phase) {
    case 'dormant':
      return crisis.activationCondition(ctx) ? 'building' : 'dormant';
    case 'building':
      return crisis.peakCondition(ctx) ? 'peak' : 'building';
    case 'peak':
      return crisis.reliefCondition(ctx) ? 'waning' : 'peak';
    case 'waning':
      // Waning exits when activation conditions no longer apply
      return crisis.activationCondition(ctx) ? 'waning' : 'dormant';
  }
}

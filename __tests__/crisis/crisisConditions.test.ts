import {
  transitionCrisis,
  type CrisisConditionState,
  type ConditionContext,
} from '../../src/ai/agents/crisis/crisisConditions';

describe('Crisis condition-based transitions', () => {
  it('dormant → building when activation conditions met', () => {
    const crisis: CrisisConditionState = {
      phase: 'dormant',
      activationCondition: (ctx) => ctx.food < ctx.population * 2,
      peakCondition: (ctx) => ctx.food < ctx.population,
      reliefCondition: (ctx) => ctx.food > ctx.population * 3,
    };
    const ctx: ConditionContext = { food: 50, population: 100, morale: 50 };
    expect(transitionCrisis(crisis, ctx)).toBe('building');
  });

  it('stays dormant when conditions not met', () => {
    const crisis: CrisisConditionState = {
      phase: 'dormant',
      activationCondition: (ctx) => ctx.food < ctx.population * 2,
      peakCondition: () => false,
      reliefCondition: () => false,
    };
    const ctx: ConditionContext = { food: 500, population: 100, morale: 50 };
    expect(transitionCrisis(crisis, ctx)).toBe('dormant');
  });

  it('building → peak when peak conditions met', () => {
    const crisis: CrisisConditionState = {
      phase: 'building',
      activationCondition: () => true,
      peakCondition: (ctx) => ctx.food < ctx.population,
      reliefCondition: () => false,
    };
    const ctx: ConditionContext = { food: 10, population: 100, morale: 30 };
    expect(transitionCrisis(crisis, ctx)).toBe('peak');
  });

  it('peak → waning when relief conditions met', () => {
    const crisis: CrisisConditionState = {
      phase: 'peak',
      activationCondition: () => true,
      peakCondition: () => true,
      reliefCondition: (ctx) => ctx.food > ctx.population * 3,
    };
    const ctx: ConditionContext = { food: 500, population: 100, morale: 50 };
    expect(transitionCrisis(crisis, ctx)).toBe('waning');
  });
});

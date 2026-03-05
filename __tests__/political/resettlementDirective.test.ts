/**
 * @fileoverview Tests for the Resettlement Directive system.
 *
 * Validates:
 *   - Risk calculation (political pressure, Moscow attention, ethnic deportation)
 *   - Warning period timing (12 ticks)
 *   - Preparation affecting mortality (well-prepared 5% vs unprepared 30%)
 *   - Disassembly policy (resource salvage)
 *   - Bribe mechanics (high cost, high detection chance)
 *   - Edge cases: already executed, not yet issued
 */

import {
  type ResettlementDirectiveState,
  type ResettlementPoliticalContext,
  type ResettlementPressureContext,
  type ResettlementWorldContext,
  RESETTLEMENT_CONSTANTS,
  attemptResettlementBribe,
  calculateResettlementOutcome,
  createResettlementState,
  enactDisassembly,
  evaluateResettlementRisk,
  tickResettlementYearly,
  tickWarningPeriod,
} from '@/ai/agents/political/resettlementDirective';

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makePressure(overrides?: Partial<ResettlementPressureContext>): ResettlementPressureContext {
  return {
    politicalPressure: 0.5,
    loyaltyPressure: 0.4,
    ...overrides,
  };
}

function makePolitical(overrides?: Partial<ResettlementPoliticalContext>): ResettlementPoliticalContext {
  return {
    moscowAttention: 0.5,
    suspicionLevel: 0.3,
    blat: 15,
    ...overrides,
  };
}

function makeWorld(overrides?: Partial<ResettlementWorldContext>): ResettlementWorldContext {
  return {
    ethnicDeportationActive: false,
    ...overrides,
  };
}

// ─── Risk Calculation ───────────────────────────────────────────────────────

describe('evaluateResettlementRisk', () => {
  it('returns 1.0 when ethnic deportation cold branch is active', () => {
    const risk = evaluateResettlementRisk(
      makePressure(),
      makePolitical(),
      makeWorld({ ethnicDeportationActive: true }),
    );
    expect(risk).toBe(1.0);
  });

  it('returns 0 when all pressures are low', () => {
    const risk = evaluateResettlementRisk(
      makePressure({ politicalPressure: 0.2, loyaltyPressure: 0.2 }),
      makePolitical({ moscowAttention: 0.3, suspicionLevel: 0.0 }),
      makeWorld(),
    );
    expect(risk).toBe(0);
  });

  it('increases with political pressure above 0.7', () => {
    const low = evaluateResettlementRisk(
      makePressure({ politicalPressure: 0.6 }),
      makePolitical({ moscowAttention: 0.5, suspicionLevel: 0.0 }),
      makeWorld(),
    );
    const high = evaluateResettlementRisk(
      makePressure({ politicalPressure: 0.9 }),
      makePolitical({ moscowAttention: 0.5, suspicionLevel: 0.0 }),
      makeWorld(),
    );
    expect(high).toBeGreaterThan(low);
  });

  it('increases with Moscow attention above 0.8', () => {
    const low = evaluateResettlementRisk(
      makePressure({ politicalPressure: 0.3 }),
      makePolitical({ moscowAttention: 0.7, suspicionLevel: 0.0 }),
      makeWorld(),
    );
    const high = evaluateResettlementRisk(
      makePressure({ politicalPressure: 0.3 }),
      makePolitical({ moscowAttention: 0.95, suspicionLevel: 0.0 }),
      makeWorld(),
    );
    expect(high).toBeGreaterThan(low);
  });

  it('suspicion compounds risk', () => {
    const noSuspicion = evaluateResettlementRisk(
      makePressure({ politicalPressure: 0.8 }),
      makePolitical({ suspicionLevel: 0.0 }),
      makeWorld(),
    );
    const highSuspicion = evaluateResettlementRisk(
      makePressure({ politicalPressure: 0.8 }),
      makePolitical({ suspicionLevel: 0.9 }),
      makeWorld(),
    );
    expect(highSuspicion).toBeGreaterThan(noSuspicion);
  });

  it('loyalty pressure above 0.6 adds risk', () => {
    const lowLoyalty = evaluateResettlementRisk(
      makePressure({ politicalPressure: 0.8, loyaltyPressure: 0.3 }),
      makePolitical({ suspicionLevel: 0.0 }),
      makeWorld(),
    );
    const highLoyalty = evaluateResettlementRisk(
      makePressure({ politicalPressure: 0.8, loyaltyPressure: 0.9 }),
      makePolitical({ suspicionLevel: 0.0 }),
      makeWorld(),
    );
    expect(highLoyalty).toBeGreaterThan(lowLoyalty);
  });

  it('returns value between 0 and 1', () => {
    const risk = evaluateResettlementRisk(
      makePressure({ politicalPressure: 1.0, loyaltyPressure: 1.0 }),
      makePolitical({ moscowAttention: 1.0, suspicionLevel: 1.0 }),
      makeWorld(),
    );
    expect(risk).toBeGreaterThanOrEqual(0);
    expect(risk).toBeLessThanOrEqual(1);
  });
});

// ─── Yearly Tick ────────────────────────────────────────────────────────────

describe('tickResettlementYearly', () => {
  it('accumulates sustained pressure years', () => {
    const state = createResettlementState();
    tickResettlementYearly(state, 0.6);
    expect(state.sustainedPressureYears).toBe(1);
    tickResettlementYearly(state, 0.7);
    expect(state.sustainedPressureYears).toBe(2);
  });

  it('decrements sustained years when risk drops', () => {
    const state = createResettlementState();
    state.sustainedPressureYears = 2;
    tickResettlementYearly(state, 0.3); // Below 0.5 threshold
    expect(state.sustainedPressureYears).toBe(1);
  });

  it('issues directive after 3 sustained years', () => {
    const state = createResettlementState();
    tickResettlementYearly(state, 0.6);
    tickResettlementYearly(state, 0.6);
    const issued = tickResettlementYearly(state, 0.6);
    expect(issued).toBe(true);
    expect(state.directiveIssued).toBe(true);
    expect(state.warningTicksRemaining).toBe(RESETTLEMENT_CONSTANTS.WARNING_PERIOD_TICKS);
  });

  it('issues directive immediately at risk 1.0 (ethnic deportation)', () => {
    const state = createResettlementState();
    const issued = tickResettlementYearly(state, 1.0);
    expect(issued).toBe(true);
    expect(state.directiveIssued).toBe(true);
  });

  it('does not re-issue if already issued', () => {
    const state = createResettlementState();
    state.directiveIssued = true;
    const issued = tickResettlementYearly(state, 0.9);
    expect(issued).toBe(false);
  });

  it('does not issue if already executed', () => {
    const state = createResettlementState();
    state.executed = true;
    const issued = tickResettlementYearly(state, 0.9);
    expect(issued).toBe(false);
  });
});

// ─── Warning Period ─────────────────────────────────────────────────────────

describe('tickWarningPeriod', () => {
  it('counts down from 12 to 0', () => {
    const state = createResettlementState();
    state.directiveIssued = true;
    state.warningTicksRemaining = RESETTLEMENT_CONSTANTS.WARNING_PERIOD_TICKS;

    for (let i = 0; i < RESETTLEMENT_CONSTANTS.WARNING_PERIOD_TICKS - 1; i++) {
      expect(tickWarningPeriod(state)).toBe(false);
    }
    // Final tick triggers execution
    expect(tickWarningPeriod(state)).toBe(true);
    expect(state.executed).toBe(true);
    expect(state.warningTicksRemaining).toBe(0);
  });

  it('accumulates base preparation each tick', () => {
    const state = createResettlementState();
    state.directiveIssued = true;
    state.warningTicksRemaining = 12;

    tickWarningPeriod(state);
    expect(state.preparationLevel).toBeCloseTo(RESETTLEMENT_CONSTANTS.BASE_PREP_PER_TICK);
  });

  it('accumulates faster preparation with disassembly active', () => {
    const state = createResettlementState();
    state.directiveIssued = true;
    state.warningTicksRemaining = 12;
    state.disassemblyActive = true;

    tickWarningPeriod(state);
    const expected = RESETTLEMENT_CONSTANTS.BASE_PREP_PER_TICK + RESETTLEMENT_CONSTANTS.DISASSEMBLY_PREP_PER_TICK;
    expect(state.preparationLevel).toBeCloseTo(expected);
  });

  it('caps preparation at 1.0', () => {
    const state = createResettlementState();
    state.directiveIssued = true;
    state.warningTicksRemaining = 100;
    state.disassemblyActive = true;
    state.preparationLevel = 0.99;

    tickWarningPeriod(state);
    expect(state.preparationLevel).toBe(1.0);
  });

  it('does nothing if not issued', () => {
    const state = createResettlementState();
    expect(tickWarningPeriod(state)).toBe(false);
  });

  it('does nothing if already executed', () => {
    const state = createResettlementState();
    state.executed = true;
    expect(tickWarningPeriod(state)).toBe(false);
  });
});

// ─── Disassembly ────────────────────────────────────────────────────────────

describe('enactDisassembly', () => {
  it('sets disassembly active when directive issued', () => {
    const state = createResettlementState();
    state.directiveIssued = true;
    state.warningTicksRemaining = 10;
    expect(enactDisassembly(state)).toBe(true);
    expect(state.disassemblyActive).toBe(true);
  });

  it('fails if no directive issued', () => {
    const state = createResettlementState();
    expect(enactDisassembly(state)).toBe(false);
  });

  it('fails if already enacted', () => {
    const state = createResettlementState();
    state.directiveIssued = true;
    state.disassemblyActive = true;
    expect(enactDisassembly(state)).toBe(false);
  });

  it('fails if already executed', () => {
    const state = createResettlementState();
    state.directiveIssued = true;
    state.executed = true;
    expect(enactDisassembly(state)).toBe(false);
  });
});

// ─── Bribe ──────────────────────────────────────────────────────────────────

describe('attemptResettlementBribe', () => {
  it('costs 10 blat when affordable', () => {
    const state = createResettlementState();
    state.directiveIssued = true;
    state.warningTicksRemaining = 10;
    const result = attemptResettlementBribe(state, 0.5, 15);
    expect(result.success).toBe(true);
    expect(result.blatCost).toBe(RESETTLEMENT_CONSTANTS.BRIBE_BLAT_COST);
  });

  it('fails when blat insufficient', () => {
    const state = createResettlementState();
    state.directiveIssued = true;
    const result = attemptResettlementBribe(state, 0.5, 3);
    expect(result.success).toBe(false);
    expect(result.blatCost).toBe(0);
  });

  it('has 35% detection chance', () => {
    const state1 = createResettlementState();
    state1.directiveIssued = true;
    const detected = attemptResettlementBribe(state1, 0.2, 15);
    expect(detected.detected).toBe(true);

    const state2 = createResettlementState();
    state2.directiveIssued = true;
    const notDetected = attemptResettlementBribe(state2, 0.5, 15);
    expect(notDetected.detected).toBe(false);
  });

  it('cancels directive on success', () => {
    const state = createResettlementState();
    state.directiveIssued = true;
    state.warningTicksRemaining = 8;
    state.disassemblyActive = true;
    state.sustainedPressureYears = 4;
    attemptResettlementBribe(state, 0.5, 15);
    expect(state.directiveIssued).toBe(false);
    expect(state.warningTicksRemaining).toBe(0);
    expect(state.disassemblyActive).toBe(false);
    expect(state.sustainedPressureYears).toBe(0);
  });

  it('returns failure if not issued', () => {
    const state = createResettlementState();
    const result = attemptResettlementBribe(state, 0.5, 15);
    expect(result.success).toBe(false);
  });

  it('returns failure if already executed', () => {
    const state = createResettlementState();
    state.executed = true;
    const result = attemptResettlementBribe(state, 0.5, 15);
    expect(result.success).toBe(false);
  });
});

// ─── Outcome Calculation ────────────────────────────────────────────────────

describe('calculateResettlementOutcome', () => {
  it('unprepared: ~30% mortality', () => {
    const state = createResettlementState();
    state.preparationLevel = 0;
    const outcome = calculateResettlementOutcome(state, 1000);
    expect(outcome.mortalityRate).toBeCloseTo(RESETTLEMENT_CONSTANTS.UNPREPARED_MORTALITY);
    expect(outcome.populationLost).toBe(300);
  });

  it('well-prepared: ~5% mortality', () => {
    const state = createResettlementState();
    state.preparationLevel = 1.0;
    state.disassemblyActive = true;
    const outcome = calculateResettlementOutcome(state, 1000);
    expect(outcome.mortalityRate).toBeCloseTo(RESETTLEMENT_CONSTANTS.WELL_PREPARED_MORTALITY);
    expect(outcome.populationLost).toBeLessThanOrEqual(50);
  });

  it('partial preparation interpolates mortality', () => {
    const state = createResettlementState();
    state.preparationLevel = 0.5;
    const outcome = calculateResettlementOutcome(state, 1000);
    expect(outcome.mortalityRate).toBeGreaterThan(RESETTLEMENT_CONSTANTS.WELL_PREPARED_MORTALITY);
    expect(outcome.mortalityRate).toBeLessThan(RESETTLEMENT_CONSTANTS.UNPREPARED_MORTALITY);
  });

  it('disassembly boosts salvage rate', () => {
    const withDisassembly = createResettlementState();
    withDisassembly.preparationLevel = 0.8;
    withDisassembly.disassemblyActive = true;
    const outcome1 = calculateResettlementOutcome(withDisassembly, 1000);

    const withoutDisassembly = createResettlementState();
    withoutDisassembly.preparationLevel = 0.8;
    withoutDisassembly.disassemblyActive = false;
    const outcome2 = calculateResettlementOutcome(withoutDisassembly, 1000);

    expect(outcome1.resourcesSalvaged).toBeGreaterThan(outcome2.resourcesSalvaged);
  });

  it('max salvage with full preparation and disassembly', () => {
    const state = createResettlementState();
    state.preparationLevel = 1.0;
    state.disassemblyActive = true;
    const outcome = calculateResettlementOutcome(state, 500);
    expect(outcome.resourcesSalvaged).toBeCloseTo(RESETTLEMENT_CONSTANTS.MAX_SALVAGE_RATE);
  });

  it('clamps preparation to 0-1', () => {
    const state = createResettlementState();
    state.preparationLevel = 2.0; // Over 1
    const outcome = calculateResettlementOutcome(state, 100);
    expect(outcome.mortalityRate).toBeCloseTo(RESETTLEMENT_CONSTANTS.WELL_PREPARED_MORTALITY);
  });
});

// ─── Integration ────────────────────────────────────────────────────────────

describe('resettlement integration', () => {
  it('full lifecycle: sustained pressure → directive → warning → disassembly → execution', () => {
    const state = createResettlementState();

    // 3 years of high risk
    tickResettlementYearly(state, 0.7);
    tickResettlementYearly(state, 0.7);
    const issued = tickResettlementYearly(state, 0.7);
    expect(issued).toBe(true);

    // Enact disassembly
    expect(enactDisassembly(state)).toBe(true);

    // Tick through 11 of 12 warning ticks
    for (let i = 0; i < 11; i++) {
      expect(tickWarningPeriod(state)).toBe(false);
    }

    // Final tick: execution
    expect(tickWarningPeriod(state)).toBe(true);
    expect(state.executed).toBe(true);

    // Outcome: should be well-prepared due to disassembly over 12 ticks
    const outcome = calculateResettlementOutcome(state, 1000);
    expect(outcome.mortalityRate).toBeLessThan(0.15); // Much better than 30%
    expect(outcome.resourcesSalvaged).toBeGreaterThan(0.3); // Good salvage
  });

  it('bribe cancels directive mid-warning', () => {
    const state = createResettlementState();
    state.directiveIssued = true;
    state.warningTicksRemaining = 10;

    // Tick a few warning ticks
    tickWarningPeriod(state);
    tickWarningPeriod(state);

    // Bribe
    const result = attemptResettlementBribe(state, 0.5, 15);
    expect(result.success).toBe(true);
    expect(state.directiveIssued).toBe(false);

    // Warning ticks no longer count down
    expect(tickWarningPeriod(state)).toBe(false);
  });
});

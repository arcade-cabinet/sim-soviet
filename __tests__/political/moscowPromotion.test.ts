/**
 * @fileoverview Tests for the Moscow Promotion system.
 *
 * Validates:
 *   - Risk calculation factors (population growth, quota, suspicion, crises)
 *   - Soviet paradox: competence attracts attention
 *   - 3-year sustained threshold for notification
 *   - Player responses: accept, bribe (cost, detection chance), delay (escalation)
 *   - Edge cases: under investigation blocks promotion, active crises block promotion
 */

import {
  createPromotionState,
  evaluatePromotionRisk,
  handlePromotionResponse,
  PROMOTION_CONSTANTS,
  type PromotionPoliticalContext,
  tickPromotionYearly,
} from '@/ai/agents/political/moscowPromotion';
import type { SettlementSummary } from '@/game/engine/SettlementSummary';

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makeSummary(overrides?: Partial<SettlementSummary>): SettlementSummary {
  return {
    year: 1930,
    month: 6,
    population: 500,
    buildingCount: 30,
    totalFood: 200,
    totalPower: 50,
    totalMorale: 70,
    activeCrisisCount: 0,
    activeCrisisTypes: new Set(),
    trendDeltas: { food: 5, population: 3, morale: 1, power: 2 },
    yearsSinceLastWar: 10,
    yearsSinceLastFamine: 5,
    yearsSinceLastDisaster: 8,
    ...overrides,
  };
}

function makePolitical(overrides?: Partial<PromotionPoliticalContext>): PromotionPoliticalContext {
  return {
    suspicionLevel: 0.1,
    threatLevel: 'safe',
    quotaProgress: 0.9,
    consecutiveGoodYears: 4,
    blat: 10,
    moscowAttention: 0.6,
    ...overrides,
  };
}

// ─── Risk Calculation ───────────────────────────────────────────────────────

describe('evaluatePromotionRisk', () => {
  it('returns 0 when under investigation', () => {
    const risk = evaluatePromotionRisk(makeSummary(), makePolitical({ threatLevel: 'investigated' }));
    expect(risk).toBe(0);
  });

  it('returns 0 when reviewed', () => {
    const risk = evaluatePromotionRisk(makeSummary(), makePolitical({ threatLevel: 'reviewed' }));
    expect(risk).toBe(0);
  });

  it('returns 0 when arrested', () => {
    const risk = evaluatePromotionRisk(makeSummary(), makePolitical({ threatLevel: 'arrested' }));
    expect(risk).toBe(0);
  });

  it('returns 0 when there are active crises', () => {
    const risk = evaluatePromotionRisk(makeSummary({ activeCrisisCount: 2 }), makePolitical());
    expect(risk).toBe(0);
  });

  it('increases with consecutive good years', () => {
    const risk1 = evaluatePromotionRisk(makeSummary(), makePolitical({ consecutiveGoodYears: 1 }));
    const risk4 = evaluatePromotionRisk(makeSummary(), makePolitical({ consecutiveGoodYears: 4 }));
    expect(risk4).toBeGreaterThan(risk1);
  });

  it('increases with population growth', () => {
    const noGrowth = evaluatePromotionRisk(
      makeSummary({ trendDeltas: { food: 0, population: 0, morale: 0, power: 0 } }),
      makePolitical(),
    );
    const withGrowth = evaluatePromotionRisk(
      makeSummary({ trendDeltas: { food: 0, population: 5, morale: 0, power: 0 } }),
      makePolitical(),
    );
    expect(withGrowth).toBeGreaterThan(noGrowth);
  });

  it('increases with quota overperformance', () => {
    const atThreshold = evaluatePromotionRisk(makeSummary(), makePolitical({ quotaProgress: 0.8 }));
    const overPerforming = evaluatePromotionRisk(makeSummary(), makePolitical({ quotaProgress: 1.0 }));
    expect(overPerforming).toBeGreaterThan(atThreshold);
  });

  it('low suspicion increases risk (Soviet paradox: reliable = promotable)', () => {
    const lowSuspicion = evaluatePromotionRisk(makeSummary(), makePolitical({ suspicionLevel: 0.0 }));
    const highSuspicion = evaluatePromotionRisk(makeSummary(), makePolitical({ suspicionLevel: 0.8 }));
    expect(lowSuspicion).toBeGreaterThan(highSuspicion);
  });

  it('Moscow attention amplifies risk', () => {
    const lowAttention = evaluatePromotionRisk(makeSummary(), makePolitical({ moscowAttention: 0.0 }));
    const highAttention = evaluatePromotionRisk(makeSummary(), makePolitical({ moscowAttention: 1.0 }));
    expect(highAttention).toBeGreaterThan(lowAttention);
  });

  it('returns value between 0 and 1', () => {
    const risk = evaluatePromotionRisk(
      makeSummary(),
      makePolitical({ consecutiveGoodYears: 10, moscowAttention: 1.0, quotaProgress: 1.5 }),
    );
    expect(risk).toBeGreaterThanOrEqual(0);
    expect(risk).toBeLessThanOrEqual(1);
  });

  it('returns 0 for terrible performance', () => {
    const risk = evaluatePromotionRisk(
      makeSummary({
        trendDeltas: { food: -5, population: -3, morale: -5, power: -2 },
      }),
      makePolitical({
        consecutiveGoodYears: 0,
        quotaProgress: 0.3,
        suspicionLevel: 0.9,
        moscowAttention: 0.0,
      }),
    );
    expect(risk).toBeCloseTo(0, 1);
  });
});

// ─── Yearly Tick ────────────────────────────────────────────────────────────

describe('tickPromotionYearly', () => {
  it('accumulates consecutive high-risk years', () => {
    const state = createPromotionState();
    tickPromotionYearly(state, 0.5, 1930);
    expect(state.consecutiveHighRiskYears).toBe(1);
    tickPromotionYearly(state, 0.5, 1931);
    expect(state.consecutiveHighRiskYears).toBe(2);
  });

  it('resets consecutive years when risk drops', () => {
    const state = createPromotionState();
    tickPromotionYearly(state, 0.5, 1930);
    tickPromotionYearly(state, 0.5, 1931);
    tickPromotionYearly(state, 0.1, 1932); // Risk drops below threshold
    expect(state.consecutiveHighRiskYears).toBe(0);
  });

  it('emits notification after 3 sustained years', () => {
    const state = createPromotionState();
    expect(tickPromotionYearly(state, 0.5, 1930)).toBe(false);
    expect(tickPromotionYearly(state, 0.5, 1931)).toBe(false);
    expect(tickPromotionYearly(state, 0.5, 1932)).toBe(true); // 3rd year
    expect(state.notificationActive).toBe(true);
    expect(state.notificationIssuedYear).toBe(1932);
  });

  it('does not re-emit notification if already active', () => {
    const state = createPromotionState();
    tickPromotionYearly(state, 0.5, 1930);
    tickPromotionYearly(state, 0.5, 1931);
    tickPromotionYearly(state, 0.5, 1932); // notification fires
    expect(tickPromotionYearly(state, 0.5, 1933)).toBe(false); // already active
  });

  it('does not tick if already accepted', () => {
    const state = createPromotionState();
    state.accepted = true;
    expect(tickPromotionYearly(state, 0.9, 1930)).toBe(false);
    expect(state.consecutiveHighRiskYears).toBe(0);
  });

  it('delay escalation increases effective risk', () => {
    const state = createPromotionState();
    state.delayCount = 3;
    tickPromotionYearly(state, 0.15, 1930); // 0.15 + 3*0.1 = 0.45 > threshold
    expect(state.currentRisk).toBeCloseTo(0.45);
    expect(state.consecutiveHighRiskYears).toBe(1);
  });

  it('clears notification when risk drops below threshold', () => {
    const state = createPromotionState();
    state.notificationActive = true;
    state.delayCount = 2;
    tickPromotionYearly(state, 0.05, 1930); // Very low risk
    expect(state.notificationActive).toBe(false);
    expect(state.delayCount).toBe(0);
  });
});

// ─── Player Responses ───────────────────────────────────────────────────────

describe('handlePromotionResponse', () => {
  describe('accept', () => {
    it('marks promotion as accepted and clears notification', () => {
      const state = createPromotionState();
      state.notificationActive = true;
      const result = handlePromotionResponse(state, 'accept', 0.5, 10);
      expect(result).toBeNull();
      expect(state.accepted).toBe(true);
      expect(state.notificationActive).toBe(false);
    });
  });

  describe('bribe', () => {
    it('costs 5 blat when affordable', () => {
      const state = createPromotionState();
      state.notificationActive = true;
      const result = handlePromotionResponse(state, 'bribe', 0.5, 10);
      expect(result).not.toBeNull();
      expect(result!.success).toBe(true);
      expect(result!.blatCost).toBe(PROMOTION_CONSTANTS.BRIBE_BLAT_COST);
    });

    it('fails when blat is insufficient', () => {
      const state = createPromotionState();
      state.notificationActive = true;
      const result = handlePromotionResponse(state, 'bribe', 0.5, 2);
      expect(result!.success).toBe(false);
      expect(result!.blatCost).toBe(0);
    });

    it('has 20% chance of detection', () => {
      const state = createPromotionState();
      state.notificationActive = true;
      // rng < 0.2 → detected
      const detected = handlePromotionResponse(state, 'bribe', 0.1, 10);
      expect(detected!.detected).toBe(true);

      const state2 = createPromotionState();
      state2.notificationActive = true;
      // rng >= 0.2 → not detected
      const notDetected = handlePromotionResponse(state2, 'bribe', 0.5, 10);
      expect(notDetected!.detected).toBe(false);
    });

    it('clears notification and resets state on success', () => {
      const state = createPromotionState();
      state.notificationActive = true;
      state.consecutiveHighRiskYears = 5;
      state.delayCount = 2;
      handlePromotionResponse(state, 'bribe', 0.5, 10);
      expect(state.notificationActive).toBe(false);
      expect(state.consecutiveHighRiskYears).toBe(0);
      expect(state.delayCount).toBe(0);
    });
  });

  describe('delay', () => {
    it('clears notification and increments delay count', () => {
      const state = createPromotionState();
      state.notificationActive = true;
      const result = handlePromotionResponse(state, 'delay', 0.5, 10);
      expect(result).toBeNull();
      expect(state.notificationActive).toBe(false);
      expect(state.delayCount).toBe(1);
    });

    it('delay count accumulates across multiple delays', () => {
      const state = createPromotionState();
      state.notificationActive = true;
      handlePromotionResponse(state, 'delay', 0.5, 10);
      state.notificationActive = true;
      handlePromotionResponse(state, 'delay', 0.5, 10);
      expect(state.delayCount).toBe(2);
    });
  });
});

// ─── Integration ────────────────────────────────────────────────────────────

describe('promotion integration', () => {
  it('full lifecycle: 3 good years → notification → delay → higher pressure → accept', () => {
    const state = createPromotionState();

    // 3 years of high risk
    tickPromotionYearly(state, 0.5, 1930);
    tickPromotionYearly(state, 0.5, 1931);
    const notified = tickPromotionYearly(state, 0.5, 1932);
    expect(notified).toBe(true);

    // Player delays
    handlePromotionResponse(state, 'delay', 0.5, 10);
    expect(state.delayCount).toBe(1);

    // Consecutive high risk years were NOT reset by delay (only notification cleared)
    // So they continue accumulating from the already-high counter
    // Reset the counter for cleaner test flow
    state.consecutiveHighRiskYears = 0;

    // Next year: risk now escalated by delay
    tickPromotionYearly(state, 0.25, 1933); // 0.25 + 0.1 = 0.35 > threshold
    expect(state.consecutiveHighRiskYears).toBe(1);

    // Eventually re-triggers after 3 more years
    tickPromotionYearly(state, 0.25, 1934);
    const reNotified = tickPromotionYearly(state, 0.25, 1935);
    expect(reNotified).toBe(true);

    // Player accepts
    handlePromotionResponse(state, 'accept', 0.5, 10);
    expect(state.accepted).toBe(true);

    // No more ticks do anything
    expect(tickPromotionYearly(state, 0.9, 1936)).toBe(false);
  });
});

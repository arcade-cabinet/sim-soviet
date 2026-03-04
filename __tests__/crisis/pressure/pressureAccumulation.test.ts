/**
 * Tests for pressure accumulation model.
 * Dual-spread: uniform baseline + spiked proportional allocation.
 */

import {
  createGauge,
  createPressureState,
  PRESSURE_DOMAINS,
  type PressureDomain,
  type PressureGauge,
} from '../../../src/ai/agents/crisis/pressure/PressureDomains';
import {
  BASELINE,
  BUDGET,
  computeSpikedDistribution,
  computeVent,
  DECAY,
  RAW_WEIGHT,
  tickGauge,
  tickPressure,
} from '../../../src/ai/agents/crisis/pressure/pressureAccumulation';

// ─── computeSpikedDistribution ───────────────────────────────────────────────

describe('computeSpikedDistribution', () => {
  it('distributes uniformly when all pressures are zero', () => {
    const state = createPressureState();
    const spiked = computeSpikedDistribution(state);
    const expected = BUDGET / PRESSURE_DOMAINS.length;
    for (const domain of PRESSURE_DOMAINS) {
      expect(spiked[domain]).toBeCloseTo(expected, 6);
    }
  });

  it('allocates proportionally to existing pressure', () => {
    const state = createPressureState();
    state.food.level = 0.8;
    state.morale.level = 0.2;
    // All other domains at 0 → totalPressure = 1.0
    const spiked = computeSpikedDistribution(state);
    expect(spiked.food).toBeCloseTo(0.8 * BUDGET, 6);
    expect(spiked.morale).toBeCloseTo(0.2 * BUDGET, 6);
    expect(spiked.loyalty).toBeCloseTo(0, 6);
  });

  it('sums to BUDGET', () => {
    const state = createPressureState();
    state.food.level = 0.5;
    state.power.level = 0.3;
    state.health.level = 0.2;
    const spiked = computeSpikedDistribution(state);
    const total = PRESSURE_DOMAINS.reduce((sum, d) => sum + spiked[d], 0);
    expect(total).toBeCloseTo(BUDGET, 6);
  });
});

// ─── computeVent ─────────────────────────────────────────────────────────────

describe('computeVent', () => {
  it('returns 0 when raw reading has not improved', () => {
    const gauge: PressureGauge = { ...createGauge(), lastRawReading: 0.5 };
    expect(computeVent(gauge, 0.5)).toBe(0);
    expect(computeVent(gauge, 0.6)).toBe(0);
  });

  it('returns 0 for small improvements below threshold', () => {
    const gauge: PressureGauge = { ...createGauge(), lastRawReading: 0.5 };
    expect(computeVent(gauge, 0.46)).toBe(0); // 0.04 < 0.05 threshold
  });

  it('vents proportionally for significant improvements', () => {
    const gauge: PressureGauge = { ...createGauge(), lastRawReading: 0.8 };
    const vent = computeVent(gauge, 0.3);
    expect(vent).toBeGreaterThan(0);
    expect(vent).toBeLessThanOrEqual(0.05); // MAX_VENT_PER_TICK
  });

  it('caps vent at MAX_VENT_PER_TICK', () => {
    const gauge: PressureGauge = { ...createGauge(), lastRawReading: 1.0 };
    const vent = computeVent(gauge, 0.0);
    expect(vent).toBe(0.05);
  });
});

// ─── tickGauge ───────────────────────────────────────────────────────────────

describe('tickGauge', () => {
  it('increases pressure when raw reading is high', () => {
    const gauge = createGauge();
    const next = tickGauge(gauge, 0.8, 0.001, 1.0);
    expect(next.level).toBeGreaterThan(0);
  });

  it('decays pressure naturally', () => {
    const gauge: PressureGauge = { ...createGauge(), level: 0.5, lastRawReading: 0 };
    // Feed it a zero raw reading — pressure should decay
    const next = tickGauge(gauge, 0, 0, 1.0);
    expect(next.level).toBeLessThan(0.5);
    // 0.5 * DECAY + 0 + BASELINE = 0.5 * 0.95 + 0.002 = 0.477
    expect(next.level).toBeCloseTo(0.5 * DECAY + BASELINE, 3);
  });

  it('respects world modifier amplification', () => {
    const gauge = createGauge();
    const normal = tickGauge(gauge, 0.5, 0.001, 1.0);
    const amplified = tickGauge(gauge, 0.5, 0.001, 2.0);
    expect(amplified.level).toBeGreaterThan(normal.level);
  });

  it('tracks warning ticks when above threshold', () => {
    // Start with high level
    const gauge: PressureGauge = { ...createGauge(), level: 0.6, lastRawReading: 0.6 };
    const next = tickGauge(gauge, 0.7, 0.002, 1.0);
    // Level should stay above 0.5 (warning threshold)
    if (next.level >= 0.5) {
      expect(next.warningTicks).toBe(1);
    }
  });

  it('resets warning ticks when pressure drops below threshold', () => {
    const gauge: PressureGauge = { ...createGauge(), level: 0.1, warningTicks: 5, lastRawReading: 0 };
    const next = tickGauge(gauge, 0, 0, 1.0);
    // Level: 0.1 * 0.95 + 0 + 0.002 = 0.097 < 0.5
    expect(next.warningTicks).toBe(0);
  });

  it('updates EMA trend', () => {
    const gauge: PressureGauge = { ...createGauge(), trend: 0.3 };
    const next = tickGauge(gauge, 0.8, 0, 1.0);
    // EMA: 0.3 * 0.85 + 0.8 * 0.15 = 0.375
    expect(next.trend).toBeCloseTo(0.375, 3);
  });

  it('stores raw reading for next tick venting', () => {
    const gauge = createGauge();
    const next = tickGauge(gauge, 0.65, 0, 1.0);
    expect(next.lastRawReading).toBe(0.65);
  });

  it('clamps level to [0, 1]', () => {
    const gauge: PressureGauge = { ...createGauge(), level: 0.99, lastRawReading: 0.99 };
    const next = tickGauge(gauge, 1.0, 0.01, 3.0);
    expect(next.level).toBeLessThanOrEqual(1);
  });
});

// ─── tickPressure ────────────────────────────────────────────────────────────

describe('tickPressure', () => {
  it('returns a new state with all 10 domains', () => {
    const state = createPressureState();
    const readings = {} as Record<PressureDomain, number>;
    for (const d of PRESSURE_DOMAINS) readings[d] = 0;
    const next = tickPressure(state, readings, {});
    expect(Object.keys(next)).toHaveLength(10);
  });

  it('stressed domains accumulate faster than unstressed', () => {
    const state = createPressureState();
    state.food.level = 0.5;
    // Feed high food reading, low everything else
    const readings = {} as Record<PressureDomain, number>;
    for (const d of PRESSURE_DOMAINS) readings[d] = 0;
    readings.food = 0.8;

    const next = tickPressure(state, readings, {});
    // Food should have gained more than any other domain
    for (const d of PRESSURE_DOMAINS) {
      if (d !== 'food') {
        expect(next.food.level).toBeGreaterThan(next[d].level);
      }
    }
  });

  it('converges toward zero with zero readings and no world modifiers', () => {
    let state = createPressureState();
    state.food.level = 0.5;

    const readings = {} as Record<PressureDomain, number>;
    for (const d of PRESSURE_DOMAINS) readings[d] = 0;

    // Run 100 ticks with zero readings
    for (let i = 0; i < 100; i++) {
      state = tickPressure(state, readings, {});
    }

    // Should have decayed significantly (baseline adds a little)
    expect(state.food.level).toBeLessThan(0.1);
  });
});

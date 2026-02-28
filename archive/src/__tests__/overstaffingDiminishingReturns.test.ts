import { describe, expect, it } from 'vitest';
import { effectiveWorkers } from '@/ecs/systems/productionSystem';

// ─────────────────────────────────────────────────────────────────────────────
//  OVERSTAFFING DIMINISHING RETURNS
//
//  Workers beyond a building's staffCap contribute geometrically less:
//    extra worker 1 → +0.50 (50%)
//    extra worker 2 → +0.25 (25%)
//    extra worker 3 → +0.125 (12.5%)
//    extra worker 4 → +0.0625 (6.25%)
//    extra worker 5 → +0.03125 (3.125%)
//    extra worker 6 → +0.015625 (1.5625%) — minimum, no further benefit
// ─────────────────────────────────────────────────────────────────────────────

describe('effectiveWorkers — at or below staffCap', () => {
  it('returns workers unchanged when equal to staffCap', () => {
    expect(effectiveWorkers(3, 3)).toBe(3);
  });

  it('returns workers unchanged when below staffCap', () => {
    expect(effectiveWorkers(1, 5)).toBe(1);
    expect(effectiveWorkers(0, 5)).toBe(0);
  });

  it('handles staffCap of 0 or negative', () => {
    // staffCap <= 0 means no cap, return workers as-is
    expect(effectiveWorkers(5, 0)).toBe(5);
    expect(effectiveWorkers(5, -1)).toBe(5);
  });

  it('returns 0 for 0 workers', () => {
    expect(effectiveWorkers(0, 3)).toBe(0);
  });
});

describe('effectiveWorkers — overstaffing diminishing returns', () => {
  it('1 extra worker adds 50% of a full worker', () => {
    // staffCap=3, workers=4: 3 + 0.5 = 3.5
    expect(effectiveWorkers(4, 3)).toBeCloseTo(3.5);
  });

  it('2 extra workers add 50% + 25% = 0.75', () => {
    // staffCap=3, workers=5: 3 + 0.5 + 0.25 = 3.75
    expect(effectiveWorkers(5, 3)).toBeCloseTo(3.75);
  });

  it('3 extra workers add 50% + 25% + 12.5% = 0.875', () => {
    // staffCap=3, workers=6: 3 + 0.5 + 0.25 + 0.125 = 3.875
    expect(effectiveWorkers(6, 3)).toBeCloseTo(3.875);
  });

  it('4 extra workers add geometric series sum', () => {
    // staffCap=3, workers=7: 3 + 0.5 + 0.25 + 0.125 + 0.0625 = 3.9375
    expect(effectiveWorkers(7, 3)).toBeCloseTo(3.9375);
  });

  it('5 extra workers add geometric series sum', () => {
    // staffCap=3, workers=8: 3 + 0.5 + 0.25 + 0.125 + 0.0625 + 0.03125 = 3.96875
    expect(effectiveWorkers(8, 3)).toBeCloseTo(3.96875);
  });

  it('6 extra workers — last one that contributes (at minimum threshold)', () => {
    // staffCap=3, workers=9: 3 + 0.5+0.25+0.125+0.0625+0.03125+0.015625 = 3.984375
    expect(effectiveWorkers(9, 3)).toBeCloseTo(3.984375);
  });

  it('caps at ~6 extra workers — 7th extra adds nothing', () => {
    // Workers 10 (7 extra) should equal workers 9 (6 extra)
    // because 0.5^7 = 0.0078125 < minimum threshold 0.015625
    const sixExtra = effectiveWorkers(9, 3);
    const sevenExtra = effectiveWorkers(10, 3);
    expect(sevenExtra).toBe(sixExtra);
  });

  it('massive overstaffing converges to same cap', () => {
    // 100 extra workers should produce the same as 6 extra
    const sixExtra = effectiveWorkers(9, 3);
    const hundredExtra = effectiveWorkers(103, 3);
    expect(hundredExtra).toBe(sixExtra);
  });
});

describe('effectiveWorkers — different staffCap values', () => {
  it('works correctly with staffCap=1', () => {
    // 1 worker at cap, +1 extra = 1 + 0.5 = 1.5
    expect(effectiveWorkers(2, 1)).toBeCloseTo(1.5);
    // 2 extra = 1 + 0.5 + 0.25 = 1.75
    expect(effectiveWorkers(3, 1)).toBeCloseTo(1.75);
  });

  it('works correctly with large staffCap', () => {
    // staffCap=10, workers=11: 10 + 0.5 = 10.5
    expect(effectiveWorkers(11, 10)).toBeCloseTo(10.5);
    // staffCap=10, workers=13: 10 + 0.5 + 0.25 + 0.125 = 10.875
    expect(effectiveWorkers(13, 10)).toBeCloseTo(10.875);
  });
});

describe('effectiveWorkers — production multiplier behavior', () => {
  it('multiplier decreases as overstaffing increases', () => {
    const staffCap = 3;
    const multipliers: number[] = [];

    for (let workers = 3; workers <= 10; workers++) {
      const eff = effectiveWorkers(workers, staffCap);
      multipliers.push(eff / workers);
    }

    // Each multiplier should be <= the previous one
    for (let i = 1; i < multipliers.length; i++) {
      expect(multipliers[i]!).toBeLessThanOrEqual(multipliers[i - 1]!);
    }
  });

  it('at optimal staffing, multiplier is 1.0 (100%)', () => {
    expect(effectiveWorkers(5, 5) / 5).toBe(1.0);
  });

  it('at 2x staffCap, multiplier is significantly below 1.0', () => {
    const staffCap = 3;
    const workers = 6; // 2x staffCap
    const multiplier = effectiveWorkers(workers, staffCap) / workers;
    // 3.875 / 6 ≈ 0.646
    expect(multiplier).toBeLessThan(0.7);
    expect(multiplier).toBeGreaterThan(0.5);
  });
});

describe('effectiveWorkers — geometric decay properties', () => {
  it('total extra contribution approaches but never reaches 1.0', () => {
    // Geometric series: 0.5 + 0.25 + 0.125 + ... = 1.0 (limit)
    // But we cap at 6 terms, so sum = 0.984375
    const staffCap = 1;
    const effective = effectiveWorkers(100, staffCap);
    const extraContribution = effective - staffCap;
    expect(extraContribution).toBeLessThan(1.0);
    expect(extraContribution).toBeCloseTo(0.984375);
  });

  it('each extra worker contributes exactly half of the previous extra', () => {
    const staffCap = 5;
    const contributions: number[] = [];

    for (let i = 1; i <= 6; i++) {
      const withPrev = effectiveWorkers(staffCap + i - 1, staffCap);
      const withCurr = effectiveWorkers(staffCap + i, staffCap);
      contributions.push(withCurr - withPrev);
    }

    // Each contribution should be half the previous
    for (let i = 1; i < contributions.length; i++) {
      expect(contributions[i]!).toBeCloseTo(contributions[i - 1]! * 0.5);
    }
  });

  it('first extra worker always adds exactly 0.5', () => {
    for (const cap of [1, 3, 5, 10, 20]) {
      const atCap = effectiveWorkers(cap, cap);
      const oneBeyond = effectiveWorkers(cap + 1, cap);
      expect(oneBeyond - atCap).toBeCloseTo(0.5);
    }
  });
});

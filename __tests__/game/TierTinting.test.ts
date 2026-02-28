/**
 * TierTinting — unit tests for settlement tier visual tinting configuration.
 *
 * These tests validate the tier tint definitions and their relationships,
 * ensuring the visual progression from selo to gorod is correctly configured.
 * The actual BabylonJS material manipulation is tested via integration tests.
 */

import { TIER_TINTS, type TierTint } from '../../src/scene/TierTinting';
import { TIER_ORDER, type SettlementTier } from '../../src/game/SettlementSystem';

describe('TierTinting', () => {
  // ── 1. All tiers have tint definitions ─────────────────────

  it('defines tints for all settlement tiers', () => {
    for (const tier of TIER_ORDER) {
      expect(TIER_TINTS[tier]).toBeDefined();
      expect(TIER_TINTS[tier].colorFactor).toBeDefined();
      expect(TIER_TINTS[tier].label).toBeTruthy();
    }
  });

  // ── 2. Posyolok is neutral (no tint) ──────────────────────

  it('posyolok has neutral tint (1.0, 1.0, 1.0)', () => {
    const tint = TIER_TINTS.posyolok;
    expect(tint.colorFactor.r).toBe(1.0);
    expect(tint.colorFactor.g).toBe(1.0);
    expect(tint.colorFactor.b).toBe(1.0);
  });

  // ── 3. Selo has warm brown tint ───────────────────────────

  it('selo has warm brown tint (darker than neutral)', () => {
    const tint = TIER_TINTS.selo;
    // Red channel highest (warm), blue lowest (brown)
    expect(tint.colorFactor.r).toBeGreaterThan(tint.colorFactor.b);
    expect(tint.colorFactor.g).toBeGreaterThan(tint.colorFactor.b);
    // All channels below 1.0 (tinted, not neutral)
    expect(tint.colorFactor.r).toBeLessThan(1.0);
    expect(tint.colorFactor.g).toBeLessThan(1.0);
    expect(tint.colorFactor.b).toBeLessThan(1.0);
  });

  // ── 4. Pgt has slight grey tint ──────────────────────────

  it('pgt has slight grey tint (blue channel slightly higher)', () => {
    const tint = TIER_TINTS.pgt;
    // Blue channel >= red and green (cool tint)
    expect(tint.colorFactor.b).toBeGreaterThanOrEqual(tint.colorFactor.r);
    expect(tint.colorFactor.b).toBeGreaterThanOrEqual(tint.colorFactor.g);
    // All channels below 1.0
    expect(tint.colorFactor.r).toBeLessThan(1.0);
  });

  // ── 5. Gorod has cool grey-blue tint ──────────────────────

  it('gorod has cool grey-blue tint (most desaturated)', () => {
    const tint = TIER_TINTS.gorod;
    // Blue channel highest (cold/industrial)
    expect(tint.colorFactor.b).toBeGreaterThanOrEqual(tint.colorFactor.r);
    expect(tint.colorFactor.b).toBeGreaterThanOrEqual(tint.colorFactor.g);
    // Darker than pgt
    expect(tint.colorFactor.r).toBeLessThanOrEqual(TIER_TINTS.pgt.colorFactor.r);
  });

  // ── 6. Tint factors are in valid range ─────────────────────

  it('all tint factors are between 0 and 1', () => {
    for (const tier of TIER_ORDER) {
      const { colorFactor } = TIER_TINTS[tier];
      expect(colorFactor.r).toBeGreaterThanOrEqual(0);
      expect(colorFactor.r).toBeLessThanOrEqual(1);
      expect(colorFactor.g).toBeGreaterThanOrEqual(0);
      expect(colorFactor.g).toBeLessThanOrEqual(1);
      expect(colorFactor.b).toBeGreaterThanOrEqual(0);
      expect(colorFactor.b).toBeLessThanOrEqual(1);
    }
  });

  // ── 7. Visual progression — gorod is coldest, selo is warmest ──

  it('visual progression: selo warmest → gorod coldest', () => {
    // "Warmth" = red channel minus blue channel
    const warmth = (tier: SettlementTier) => {
      const f = TIER_TINTS[tier].colorFactor;
      return f.r - f.b;
    };

    // Selo should be warmest (highest R-B difference)
    expect(warmth('selo')).toBeGreaterThan(warmth('posyolok'));
    // Gorod should be coldest (most negative or lowest R-B difference)
    expect(warmth('gorod')).toBeLessThan(warmth('posyolok'));
    // PGT should be between posyolok and gorod
    expect(warmth('pgt')).toBeLessThan(warmth('posyolok'));
    expect(warmth('pgt')).toBeGreaterThan(warmth('gorod'));
  });

  // ── 8. Each tier's tint is distinct ───────────────────────

  it('each tier has a distinct tint', () => {
    const tints = TIER_ORDER.map((tier) => {
      const f = TIER_TINTS[tier].colorFactor;
      return `${f.r},${f.g},${f.b}`;
    });
    const uniqueTints = new Set(tints);
    expect(uniqueTints.size).toBe(TIER_ORDER.length);
  });

  // ── 9. Labels are descriptive ─────────────────────────────

  it('all tints have descriptive labels', () => {
    for (const tier of TIER_ORDER) {
      expect(TIER_TINTS[tier].label.length).toBeGreaterThan(5);
    }
  });

  // ── 10. Exact tint values match specification ─────────────

  it('selo tint is (0.85, 0.7, 0.5)', () => {
    const f = TIER_TINTS.selo.colorFactor;
    expect(f.r).toBeCloseTo(0.85);
    expect(f.g).toBeCloseTo(0.7);
    expect(f.b).toBeCloseTo(0.5);
  });

  it('pgt tint is (0.8, 0.8, 0.85)', () => {
    const f = TIER_TINTS.pgt.colorFactor;
    expect(f.r).toBeCloseTo(0.8);
    expect(f.g).toBeCloseTo(0.8);
    expect(f.b).toBeCloseTo(0.85);
  });

  it('gorod tint is (0.7, 0.75, 0.8)', () => {
    const f = TIER_TINTS.gorod.colorFactor;
    expect(f.r).toBeCloseTo(0.7);
    expect(f.g).toBeCloseTo(0.75);
    expect(f.b).toBeCloseTo(0.8);
  });
});

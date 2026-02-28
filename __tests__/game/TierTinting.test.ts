/**
 * TierTinting — unit tests for settlement tier visual tinting configuration.
 *
 * These tests validate the tier tint definitions and their relationships,
 * ensuring the visual progression from selo to gorod is correctly configured.
 * The actual Three.js material manipulation is tested via integration tests.
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
    const [r, g, b] = TIER_TINTS.posyolok.colorFactor;
    expect(r).toBe(1.0);
    expect(g).toBe(1.0);
    expect(b).toBe(1.0);
  });

  // ── 3. Selo has warm brown tint ───────────────────────────

  it('selo has warm brown tint (darker than neutral)', () => {
    const [r, g, b] = TIER_TINTS.selo.colorFactor;
    // Red channel highest (warm), blue lowest (brown)
    expect(r).toBeGreaterThan(b);
    expect(g).toBeGreaterThan(b);
    // All channels below 1.0 (tinted, not neutral)
    expect(r).toBeLessThan(1.0);
    expect(g).toBeLessThan(1.0);
    expect(b).toBeLessThan(1.0);
  });

  // ── 4. Pgt has slight grey tint ──────────────────────────

  it('pgt has slight grey tint (blue channel slightly higher)', () => {
    const [r, g, b] = TIER_TINTS.pgt.colorFactor;
    // Blue channel >= red and green (cool tint)
    expect(b).toBeGreaterThanOrEqual(r);
    expect(b).toBeGreaterThanOrEqual(g);
    // All channels below 1.0
    expect(r).toBeLessThan(1.0);
  });

  // ── 5. Gorod has cool grey-blue tint ──────────────────────

  it('gorod has cool grey-blue tint (most desaturated)', () => {
    const [r, g, b] = TIER_TINTS.gorod.colorFactor;
    const [pgtR] = TIER_TINTS.pgt.colorFactor;
    // Blue channel highest (cold/industrial)
    expect(b).toBeGreaterThanOrEqual(r);
    expect(b).toBeGreaterThanOrEqual(g);
    // Darker than pgt
    expect(r).toBeLessThanOrEqual(pgtR);
  });

  // ── 6. Tint factors are in valid range ─────────────────────

  it('all tint factors are between 0 and 1', () => {
    for (const tier of TIER_ORDER) {
      const [r, g, b] = TIER_TINTS[tier].colorFactor;
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(1);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(1);
    }
  });

  // ── 7. Visual progression — gorod is coldest, selo is warmest ──

  it('visual progression: selo warmest → gorod coldest', () => {
    // "Warmth" = red channel minus blue channel
    const warmth = (tier: SettlementTier) => {
      const [r, , b] = TIER_TINTS[tier].colorFactor;
      return r - b;
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
      const [r, g, b] = TIER_TINTS[tier].colorFactor;
      return `${r},${g},${b}`;
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
    const [r, g, b] = TIER_TINTS.selo.colorFactor;
    expect(r).toBeCloseTo(0.85);
    expect(g).toBeCloseTo(0.7);
    expect(b).toBeCloseTo(0.5);
  });

  it('pgt tint is (0.8, 0.8, 0.85)', () => {
    const [r, g, b] = TIER_TINTS.pgt.colorFactor;
    expect(r).toBeCloseTo(0.8);
    expect(g).toBeCloseTo(0.8);
    expect(b).toBeCloseTo(0.85);
  });

  it('gorod tint is (0.7, 0.75, 0.8)', () => {
    const [r, g, b] = TIER_TINTS.gorod.colorFactor;
    expect(r).toBeCloseTo(0.7);
    expect(g).toBeCloseTo(0.75);
    expect(b).toBeCloseTo(0.8);
  });
});

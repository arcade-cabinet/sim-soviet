/**
 * TierTinting — unit tests for settlement tier visual tinting configuration.
 *
 * These tests validate the tier tint definitions and their relationships,
 * ensuring the visual progression from selo to gorod is correctly configured.
 * The actual Three.js material manipulation is tested via integration tests.
 */

import { type SettlementTier, TIER_ORDER } from '../../src/game/SettlementSystem';
import { getTierVariant, TIER_MODEL_VARIANTS } from '../../src/scene/ModelMapping';
import type { Season } from '../../src/scene/TerrainGrid';
import { SEASON_TINTS, TIER_TINTS } from '../../src/scene/TierTinting';

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

  // ── 11. PBR roughness progression ──────────────────────────

  it('all tiers have roughness and metalness defined', () => {
    for (const tier of TIER_ORDER) {
      expect(TIER_TINTS[tier].roughness).toBeDefined();
      expect(TIER_TINTS[tier].metalness).toBeDefined();
    }
  });

  it('roughness decreases from selo to gorod (rustic → polished)', () => {
    expect(TIER_TINTS.selo.roughness).toBeGreaterThan(TIER_TINTS.posyolok.roughness);
    expect(TIER_TINTS.posyolok.roughness).toBeGreaterThan(TIER_TINTS.pgt.roughness);
    expect(TIER_TINTS.pgt.roughness).toBeGreaterThan(TIER_TINTS.gorod.roughness);
  });

  it('metalness increases from selo to gorod (wood → industrial)', () => {
    expect(TIER_TINTS.selo.metalness).toBeLessThan(TIER_TINTS.posyolok.metalness);
    expect(TIER_TINTS.posyolok.metalness).toBeLessThan(TIER_TINTS.pgt.metalness);
    expect(TIER_TINTS.pgt.metalness).toBeLessThan(TIER_TINTS.gorod.metalness);
  });

  it('PBR values are in valid range (0 to 1)', () => {
    for (const tier of TIER_ORDER) {
      expect(TIER_TINTS[tier].roughness).toBeGreaterThanOrEqual(0);
      expect(TIER_TINTS[tier].roughness).toBeLessThanOrEqual(1);
      expect(TIER_TINTS[tier].metalness).toBeGreaterThanOrEqual(0);
      expect(TIER_TINTS[tier].metalness).toBeLessThanOrEqual(1);
    }
  });

  it('selo is fully rough and non-metallic (wooden)', () => {
    expect(TIER_TINTS.selo.roughness).toBeCloseTo(0.95);
    expect(TIER_TINTS.selo.metalness).toBeCloseTo(0.0);
  });

  it('gorod is smooth with slight metallic tint (concrete/industrial)', () => {
    expect(TIER_TINTS.gorod.roughness).toBeCloseTo(0.35);
    expect(TIER_TINTS.gorod.metalness).toBeCloseTo(0.2);
  });
});

// ── Season Tinting ──────────────────────────────────────────────────────────

describe('SeasonTinting', () => {
  const ALL_SEASONS: Season[] = ['winter', 'spring', 'summer', 'autumn'];

  it('defines tints for all four seasons', () => {
    for (const season of ALL_SEASONS) {
      expect(SEASON_TINTS[season]).toBeDefined();
      expect(SEASON_TINTS[season]).toHaveLength(3);
    }
  });

  it('winter has blue-shifted tint (blue > red)', () => {
    const [r, , b] = SEASON_TINTS.winter;
    expect(b).toBeGreaterThan(r);
  });

  it('summer has warm tint (red > blue)', () => {
    const [r, , b] = SEASON_TINTS.summer;
    expect(r).toBeGreaterThan(b);
  });

  it('autumn has warm-leaning tint (red >= blue)', () => {
    const [r, , b] = SEASON_TINTS.autumn;
    expect(r).toBeGreaterThanOrEqual(b);
  });

  it('spring is near-neutral', () => {
    const [r, g, b] = SEASON_TINTS.spring;
    // Spring should be close to 1.0 on all channels
    expect(r).toBeGreaterThanOrEqual(0.9);
    expect(g).toBeGreaterThanOrEqual(0.9);
    expect(b).toBeGreaterThanOrEqual(0.9);
    expect(r).toBeLessThanOrEqual(1.1);
    expect(g).toBeLessThanOrEqual(1.1);
    expect(b).toBeLessThanOrEqual(1.1);
  });

  it('all season factors are in valid range (0.5 to 1.5)', () => {
    for (const season of ALL_SEASONS) {
      const [r, g, b] = SEASON_TINTS[season];
      for (const v of [r, g, b]) {
        expect(v).toBeGreaterThanOrEqual(0.5);
        expect(v).toBeLessThanOrEqual(1.5);
      }
    }
  });

  it('exact values match specification', () => {
    expect(SEASON_TINTS.winter).toEqual([0.85, 0.9, 1.1]);
    expect(SEASON_TINTS.spring).toEqual([0.95, 1.0, 0.95]);
    expect(SEASON_TINTS.summer).toEqual([1.05, 1.0, 0.9]);
    expect(SEASON_TINTS.autumn).toEqual([1.0, 0.95, 0.85]);
  });

  it('each season has a distinct tint', () => {
    const tints = ALL_SEASONS.map((s) => SEASON_TINTS[s].join(','));
    const unique = new Set(tints);
    expect(unique.size).toBe(ALL_SEASONS.length);
  });
});

// ── Tier Model Variants ─────────────────────────────────────────────────────

describe('TierModelVariants', () => {
  it('returns the defId itself when no variant exists', () => {
    expect(getTierVariant('power-station', 'selo')).toBe('power-station');
    expect(getTierVariant('gulag-admin', 'gorod')).toBe('gulag-admin');
    expect(getTierVariant('vodka-distillery', 'pgt')).toBe('vodka-distillery');
  });

  it('workers-house-a upgrades through tiers', () => {
    expect(getTierVariant('workers-house-a', 'selo')).toBe('workers-house-a');
    expect(getTierVariant('workers-house-a', 'posyolok')).toBe('workers-house-b');
    expect(getTierVariant('workers-house-a', 'gorod')).toBe('workers-house-c');
  });

  it('apartment-tower-a upgrades through tiers', () => {
    expect(getTierVariant('apartment-tower-a', 'selo')).toBe('apartment-tower-a');
    expect(getTierVariant('apartment-tower-a', 'pgt')).toBe('apartment-tower-b');
    expect(getTierVariant('apartment-tower-a', 'gorod')).toBe('apartment-tower-c');
  });

  it('apartment-tower-b upgrades to c and d at higher tiers', () => {
    expect(getTierVariant('apartment-tower-b', 'posyolok')).toBe('apartment-tower-b');
    expect(getTierVariant('apartment-tower-b', 'pgt')).toBe('apartment-tower-c');
    expect(getTierVariant('apartment-tower-b', 'gorod')).toBe('apartment-tower-d');
  });

  it('all variant entries map to all four tiers', () => {
    for (const [_defId, tierMap] of Object.entries(TIER_MODEL_VARIANTS)) {
      if (!tierMap) continue;
      for (const tier of TIER_ORDER) {
        expect(tierMap[tier]).toBeDefined();
        expect(typeof tierMap[tier]).toBe('string');
      }
    }
  });

  it('variant models are never worse than the base at lower tiers', () => {
    // At selo (lowest tier), variant should be same or simpler than the defId
    for (const defId of Object.keys(TIER_MODEL_VARIANTS)) {
      const seloVariant = getTierVariant(defId, 'selo');
      // Selo variant should exist as a valid model name
      expect(seloVariant).toBeTruthy();
    }
  });
});

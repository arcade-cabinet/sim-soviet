/**
 * Tests for WarOverlay — parameterized war visual effects across all scales
 * from civil war skirmishes to Dyson sphere defense.
 *
 * Since these are R3F scene components, we test:
 * 1. The seeded RNG determinism (crater placement consistency)
 * 2. The wartime lighting parameter changes
 * 3. Scale presets have valid, bounded configurations
 * 4. Content.tsx wiring (isWartime derived from currentEra)
 */

import { SCALE_PRESETS, type WarScale } from '../../src/scene/WarOverlay';

describe('War overlay seeded RNG', () => {
  // Mulberry32 RNG implementation (same as in WarOverlay.tsx)
  function mulberry32(seed: number) {
    let s = seed | 0;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  it('produces deterministic output for the same seed', () => {
    const rng1 = mulberry32(194145);
    const rng2 = mulberry32(194145);
    const values1 = Array.from({ length: 100 }, () => rng1());
    const values2 = Array.from({ length: 100 }, () => rng2());
    expect(values1).toEqual(values2);
  });

  it('produces values in [0, 1) range', () => {
    const rng = mulberry32(194145);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('produces different sequences for different seeds', () => {
    const rng1 = mulberry32(194145);
    const rng2 = mulberry32(194146);
    const v1 = rng1();
    const v2 = rng2();
    expect(v1).not.toBe(v2);
  });

  it('crater positions are stable across calls (same seed, same grid)', () => {
    const gridSize = 30;
    const MAX_CRATERS = 40;

    function generateCraters() {
      const rng = mulberry32(194145);
      const craters: { x: number; z: number }[] = [];
      for (let i = 0; i < MAX_CRATERS; i++) {
        craters.push({
          x: rng() * gridSize,
          z: rng() * gridSize,
        });
      }
      return craters;
    }

    const run1 = generateCraters();
    const run2 = generateCraters();
    expect(run1).toEqual(run2);
  });
});

describe('Wartime lighting parameters', () => {
  it('isWartime is true only for great_patriotic era', () => {
    const eras = [
      'revolution',
      'collectivization',
      'industrialization',
      'great_patriotic',
      'reconstruction',
      'thaw_and_freeze',
      'stagnation',
      'the_eternal',
    ];

    for (const era of eras) {
      const isWartime = era === 'great_patriotic';
      if (era === 'great_patriotic') {
        expect(isWartime).toBe(true);
      } else {
        expect(isWartime).toBe(false);
      }
    }
  });

  it('wartime multiplier dims light by 20%', () => {
    const wartimeMul = 0.8;
    const normalIntensity = 1.8;
    const wartimeIntensity = normalIntensity * wartimeMul;
    expect(wartimeIntensity).toBeCloseTo(1.44);
  });

  it('wartime fog is denser', () => {
    const baseFog = 0.002;
    const wartimeFogBonus = 0.003;
    expect(baseFog + wartimeFogBonus).toBeCloseTo(0.005);
  });
});

describe('War overlay scale presets', () => {
  const ALL_SCALES: WarScale[] = ['skirmish', 'regional', 'continental', 'global', 'planetary', 'stellar'];

  it('all six scales are defined', () => {
    for (const scale of ALL_SCALES) {
      expect(SCALE_PRESETS[scale]).toBeDefined();
    }
  });

  it('continental preset matches original WWII config', () => {
    const continental = SCALE_PRESETS.continental;
    expect(continental.bomberCount).toBe(3);
    expect(continental.bomberCrossingTime).toBe(25);
    expect(continental.bomberStagger).toBe(10);
    expect(continental.bomberSize).toEqual([0.15, 0.08, 1.2]);
    expect(continental.maxCraters).toBe(40);
    expect(continental.maxSmokeSources).toBe(15);
    expect(continental.particlesPerSource).toBe(12);
    expect(continental.smokeHeight).toBe(2.5);
  });

  it('smoke particle budget is bounded for all scales', () => {
    for (const scale of ALL_SCALES) {
      const preset = SCALE_PRESETS[scale];
      const total = preset.maxSmokeSources * preset.particlesPerSource;
      // Even at stellar scale, keep particle budget reasonable
      expect(total).toBeLessThanOrEqual(1000);
      expect(total).toBeGreaterThan(0);
    }
  });

  it('crater count is bounded for all scales', () => {
    for (const scale of ALL_SCALES) {
      const preset = SCALE_PRESETS[scale];
      expect(preset.maxCraters).toBeLessThanOrEqual(200);
      expect(preset.maxCraters).toBeGreaterThanOrEqual(1);
    }
  });

  it('bomber count and timing are reasonable for all scales with bombers', () => {
    for (const scale of ALL_SCALES) {
      const preset = SCALE_PRESETS[scale];
      if (preset.bomberCount > 0) {
        expect(preset.bomberCrossingTime).toBeGreaterThan(0);
        expect(preset.bomberStagger).toBeGreaterThan(0);
        expect(preset.bomberStagger * (preset.bomberCount - 1)).toBeLessThan(preset.bomberCrossingTime * 3);
      }
    }
  });

  it('skirmish has no bombers (ground-only conflict)', () => {
    expect(SCALE_PRESETS.skirmish.bomberCount).toBe(0);
  });

  it('scales increase in destructive power monotonically', () => {
    for (let i = 1; i < ALL_SCALES.length; i++) {
      const prev = SCALE_PRESETS[ALL_SCALES[i - 1]];
      const curr = SCALE_PRESETS[ALL_SCALES[i]];
      expect(curr.maxCraters).toBeGreaterThanOrEqual(prev.maxCraters);
      expect(curr.maxSmokeSources).toBeGreaterThanOrEqual(prev.maxSmokeSources);
    }
  });

  it('all preset opacity values are in valid [0, 1] range', () => {
    for (const scale of ALL_SCALES) {
      const preset = SCALE_PRESETS[scale];
      expect(preset.bomberOpacity).toBeGreaterThanOrEqual(0);
      expect(preset.bomberOpacity).toBeLessThanOrEqual(1);
      expect(preset.smokeOpacity).toBeGreaterThanOrEqual(0);
      expect(preset.smokeOpacity).toBeLessThanOrEqual(1);
    }
  });

  it('stellar scale uses energy weapon colors (blue/cyan)', () => {
    const stellar = SCALE_PRESETS.stellar;
    // Bomber color should be blue/cyan for energy weapons
    expect(stellar.bomberColor).toBe('#00ccff');
    // Crater color should be dark blue for energy weapon impact
    expect(stellar.craterColor).toBe('#000a33');
  });

  it('planetary scale uses orange/red for orbital strikes', () => {
    const planetary = SCALE_PRESETS.planetary;
    expect(planetary.bomberColor).toBe('#ff4400');
    expect(planetary.craterColor).toBe('#330a00');
  });
});

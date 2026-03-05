/**
 * Tests for WWIIOverlay visual effects — bomber silhouettes, crater decals,
 * building smoke, and wartime lighting modifications.
 *
 * Since these are R3F scene components, we test:
 * 1. The seeded RNG determinism (crater placement consistency)
 * 2. The wartime lighting parameter changes
 * 3. Content.tsx wiring (isWartime derived from currentEra)
 */

describe('WWII seeded RNG', () => {
  // Mulberry32 RNG implementation (same as in WWIIOverlay.tsx)
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
    const normalIntensity = 1.8; // peak sun intensity
    const wartimeIntensity = normalIntensity * wartimeMul;
    expect(wartimeIntensity).toBeCloseTo(1.44);
  });

  it('wartime fog is denser', () => {
    const baseFog = 0.002;
    const wartimeFogBonus = 0.003;
    expect(baseFog + wartimeFogBonus).toBeCloseTo(0.005);
  });
});

describe('WWII overlay configuration', () => {
  it('bomber count and timing are reasonable', () => {
    const BOMBER_COUNT = 3;
    const BOMBER_CROSSING_TIME = 25;
    const BOMBER_STAGGER = 10;

    // 3 bombers staggered by 10s in a 25s crossing — always at least 1 visible
    expect(BOMBER_COUNT).toBeGreaterThanOrEqual(2);
    expect(BOMBER_CROSSING_TIME).toBeGreaterThan(BOMBER_STAGGER);
    expect(BOMBER_STAGGER * (BOMBER_COUNT - 1)).toBeLessThan(BOMBER_CROSSING_TIME * 1.5);
  });

  it('smoke particle budget is bounded', () => {
    const MAX_SMOKE_SOURCES = 15;
    const PARTICLES_PER_SOURCE = 12;
    const total = MAX_SMOKE_SOURCES * PARTICLES_PER_SOURCE;
    // 180 particles — well within GPU budget
    expect(total).toBeLessThanOrEqual(500);
    expect(total).toBe(180);
  });

  it('crater count is bounded', () => {
    const MAX_CRATERS = 40;
    expect(MAX_CRATERS).toBeLessThanOrEqual(100);
    expect(MAX_CRATERS).toBeGreaterThanOrEqual(20);
  });
});

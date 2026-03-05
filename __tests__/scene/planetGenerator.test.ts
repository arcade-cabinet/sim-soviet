/**
 * Procedural planet generation — unit tests.
 *
 * Verifies: determinism (same seed → same output), seed independence
 * (different seeds → different output), biome classification, FBM properties.
 */

import {
  sampleHeight,
  classifyBiome,
  _fbm,
  _valueNoise3D,
  _hash3,
  type PlanetConfig,
} from '@/scene/celestial/planetGenerator';

// ── Test configs ────────────────────────────────────────────────────────────

const EARTH_CONFIG: PlanetConfig = {
  seed: 42,
  seaLevel: 0.4,
  mountainAmplitude: 1.0,
  noiseOctaves: 6,
  noiseScale: 1.5,
  continentBias: 0.3,
};

const MARS_CONFIG: PlanetConfig = {
  seed: 42,
  seaLevel: -0.5,
  mountainAmplitude: 1.5,
  noiseOctaves: 5,
  noiseScale: 2.0,
  continentBias: 0.0,
  craterDensity: 0.4,
};

const MOON_CONFIG: PlanetConfig = {
  seed: 42,
  seaLevel: -1.0,
  mountainAmplitude: 0.3,
  noiseOctaves: 4,
  noiseScale: 2.0,
  continentBias: 0.0,
  craterDensity: 0.6,
};

// ── Hash primitives ─────────────────────────────────────────────────────────

describe('hash3', () => {
  it('returns values in [0, 1)', () => {
    for (let i = 0; i < 100; i++) {
      const v = _hash3(i * 1.3, i * 2.7, i * 0.5, 42);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is deterministic', () => {
    const a = _hash3(1, 2, 3, 42);
    const b = _hash3(1, 2, 3, 42);
    expect(a).toBe(b);
  });

  it('varies with seed', () => {
    const a = _hash3(1, 2, 3, 42);
    const b = _hash3(1, 2, 3, 99);
    expect(a).not.toBe(b);
  });
});

// ── Value noise ─────────────────────────────────────────────────────────────

describe('valueNoise3D', () => {
  it('returns values in [-1, 1]', () => {
    for (let i = 0; i < 200; i++) {
      const x = (i * 0.37) % 10 - 5;
      const y = (i * 0.73) % 10 - 5;
      const z = (i * 0.11) % 10 - 5;
      const v = _valueNoise3D(x, y, z, 42);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic', () => {
    const a = _valueNoise3D(1.5, 2.7, 3.1, 42);
    const b = _valueNoise3D(1.5, 2.7, 3.1, 42);
    expect(a).toBe(b);
  });

  it('varies with seed', () => {
    const a = _valueNoise3D(1.5, 2.7, 3.1, 42);
    const b = _valueNoise3D(1.5, 2.7, 3.1, 99);
    expect(a).not.toBe(b);
  });
});

// ── FBM ─────────────────────────────────────────────────────────────────────

describe('fbm', () => {
  it('returns a finite number', () => {
    const v = _fbm(1, 2, 3, 42, 6);
    expect(Number.isFinite(v)).toBe(true);
  });

  it('is deterministic', () => {
    const a = _fbm(1.5, 2.7, 3.1, 42, 6);
    const b = _fbm(1.5, 2.7, 3.1, 42, 6);
    expect(a).toBe(b);
  });

  it('varies with seed', () => {
    const a = _fbm(1.5, 2.7, 3.1, 42, 6);
    const b = _fbm(1.5, 2.7, 3.1, 99, 6);
    expect(a).not.toBe(b);
  });

  it('more octaves add detail (output differs)', () => {
    const a = _fbm(1.5, 2.7, 3.1, 42, 2);
    const b = _fbm(1.5, 2.7, 3.1, 42, 6);
    expect(a).not.toBe(b);
  });
});

// ── sampleHeight ────────────────────────────────────────────────────────────

describe('sampleHeight', () => {
  it('same seed produces identical displacement', () => {
    // Sample multiple points on the unit sphere
    const points = [
      [0, 1, 0],
      [1, 0, 0],
      [0, 0, 1],
      [0.577, 0.577, 0.577],
    ] as const;

    for (const [x, y, z] of points) {
      const a = sampleHeight(x, y, z, EARTH_CONFIG);
      const b = sampleHeight(x, y, z, EARTH_CONFIG);
      expect(a).toBe(b);
    }
  });

  it('different seeds produce different terrain', () => {
    const configA = { ...EARTH_CONFIG, seed: 42 };
    const configB = { ...EARTH_CONFIG, seed: 999 };

    // Check that at least some sample points differ
    let anyDifferent = false;
    const points = [
      [0, 1, 0],
      [1, 0, 0],
      [0, 0, 1],
      [0.577, 0.577, 0.577],
      [-1, 0, 0],
      [0, -1, 0],
    ] as const;

    for (const [x, y, z] of points) {
      const a = sampleHeight(x, y, z, configA);
      const b = sampleHeight(x, y, z, configB);
      if (a !== b) anyDifferent = true;
    }
    expect(anyDifferent).toBe(true);
  });

  it('returns values in [0, 1]', () => {
    for (let i = 0; i < 500; i++) {
      const theta = (i / 500) * Math.PI * 2;
      const phi = Math.acos(2 * ((i * 0.618) % 1) - 1);
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.cos(phi);
      const z = Math.sin(phi) * Math.sin(theta);
      const h = sampleHeight(x, y, z, EARTH_CONFIG);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(1);
    }
  });

  it('Earth-like config produces ocean + land (heights span sea level)', () => {
    let hasOcean = false;
    let hasLand = false;
    for (let i = 0; i < 500; i++) {
      const theta = (i / 500) * Math.PI * 2;
      const phi = Math.acos(2 * ((i * 0.618) % 1) - 1);
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.cos(phi);
      const z = Math.sin(phi) * Math.sin(theta);
      const h = sampleHeight(x, y, z, EARTH_CONFIG);
      if (h < EARTH_CONFIG.seaLevel) hasOcean = true;
      if (h > EARTH_CONFIG.seaLevel) hasLand = true;
    }
    expect(hasOcean).toBe(true);
    expect(hasLand).toBe(true);
  });

  it('Mars config produces varied terrain', () => {
    const heights = new Set<number>();
    for (let i = 0; i < 100; i++) {
      const theta = (i / 100) * Math.PI * 2;
      const phi = Math.acos(2 * ((i * 0.618) % 1) - 1);
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.cos(phi);
      const z = Math.sin(phi) * Math.sin(theta);
      heights.add(Math.round(sampleHeight(x, y, z, MARS_CONFIG) * 100));
    }
    // Should have at least some height variation
    expect(heights.size).toBeGreaterThan(5);
  });

  it('Moon config with craters produces depressions', () => {
    // Crater depressions create low values — at least some should be below 0.3
    let hasLowPoint = false;
    for (let i = 0; i < 500; i++) {
      const theta = (i / 500) * Math.PI * 2;
      const phi = Math.acos(2 * ((i * 0.618) % 1) - 1);
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.cos(phi);
      const z = Math.sin(phi) * Math.sin(theta);
      const h = sampleHeight(x, y, z, MOON_CONFIG);
      if (h < 0.3) hasLowPoint = true;
    }
    expect(hasLowPoint).toBe(true);
  });
});

// ── Biome classification ────────────────────────────────────────────────────

describe('classifyBiome', () => {
  describe('terran profile', () => {
    const sl = 0.4;

    it('deep water → ocean', () => {
      expect(classifyBiome(0.2, 0.0, sl, 'terran')).toBe('ocean');
    });

    it('near sea level → shore', () => {
      expect(classifyBiome(0.38, 0.0, sl, 'terran')).toBe('shore');
    });

    it('low altitude above sea → land', () => {
      expect(classifyBiome(0.55, 0.0, sl, 'terran')).toBe('land');
    });

    it('high altitude → mountain', () => {
      expect(classifyBiome(0.75, 0.0, sl, 'terran')).toBe('mountain');
    });

    it('very high altitude → snow', () => {
      expect(classifyBiome(0.95, 0.0, sl, 'terran')).toBe('snow');
    });

    it('high latitude → ice regardless of height', () => {
      expect(classifyBiome(0.55, 0.8, sl, 'terran')).toBe('ice');
      expect(classifyBiome(0.2, 0.75, sl, 'terran')).toBe('ice');
      expect(classifyBiome(0.9, -0.9, sl, 'terran')).toBe('ice');
    });
  });

  describe('martian profile', () => {
    it('low terrain → dust', () => {
      expect(classifyBiome(0.3, 0.0, -0.5, 'martian')).toBe('dust');
    });

    it('mid terrain → rock', () => {
      expect(classifyBiome(0.6, 0.0, -0.5, 'martian')).toBe('rock');
    });

    it('high terrain → canyon', () => {
      expect(classifyBiome(0.8, 0.0, -0.5, 'martian')).toBe('canyon');
    });

    it('polar → polar_ice', () => {
      expect(classifyBiome(0.3, 0.9, -0.5, 'martian')).toBe('polar_ice');
    });
  });

  describe('lunar profile', () => {
    it('low → mare', () => {
      expect(classifyBiome(0.2, 0.0, -1, 'lunar')).toBe('mare');
    });

    it('mid → regolith', () => {
      expect(classifyBiome(0.5, 0.0, -1, 'lunar')).toBe('regolith');
    });

    it('high → highland', () => {
      expect(classifyBiome(0.8, 0.0, -1, 'lunar')).toBe('highland');
    });
  });
});

// ── Shader integration ──────────────────────────────────────────────────────

describe('shader source integrity (new uniforms)', () => {
  it('body vertex shader contains uSeed uniform', () => {
    const { bodyVertexShader } = require('@/scene/celestial/shaders');
    expect(bodyVertexShader).toContain('uniform float uSeed');
  });

  it('body vertex shader contains uSeaLevel uniform', () => {
    const { bodyVertexShader } = require('@/scene/celestial/shaders');
    expect(bodyVertexShader).toContain('uniform float uSeaLevel');
  });

  it('body vertex shader contains seededFbm function', () => {
    const { bodyVertexShader } = require('@/scene/celestial/shaders');
    expect(bodyVertexShader).toContain('seededFbm');
  });

  it('body vertex shader contains uMountainAmplitude', () => {
    const { bodyVertexShader } = require('@/scene/celestial/shaders');
    expect(bodyVertexShader).toContain('uniform float uMountainAmplitude');
  });

  it('body vertex shader contains uNoiseScale', () => {
    const { bodyVertexShader } = require('@/scene/celestial/shaders');
    expect(bodyVertexShader).toContain('uniform float uNoiseScale');
  });

  it('body vertex shader contains uContinentBias', () => {
    const { bodyVertexShader } = require('@/scene/celestial/shaders');
    expect(bodyVertexShader).toContain('uniform float uContinentBias');
  });

  it('body vertex shader outputs vHeight varying', () => {
    const { bodyVertexShader } = require('@/scene/celestial/shaders');
    expect(bodyVertexShader).toContain('varying float vHeight');
  });

  it('body fragment shader reads vHeight varying', () => {
    const { bodyFragmentShader } = require('@/scene/celestial/shaders');
    expect(bodyFragmentShader).toContain('varying float vHeight');
  });

  it('body fragment shader has polar ice classification', () => {
    const { bodyFragmentShader } = require('@/scene/celestial/shaders');
    expect(bodyFragmentShader).toContain('lat > 0.7');
  });

  it('body fragment shader uses uSeaLevel for ocean/land split', () => {
    const { bodyFragmentShader } = require('@/scene/celestial/shaders');
    expect(bodyFragmentShader).toContain('uSeaLevel');
  });

  it('body fragment shader has Martian polar ice caps', () => {
    const { bodyFragmentShader } = require('@/scene/celestial/shaders');
    expect(bodyFragmentShader).toContain('polarIce');
  });
});

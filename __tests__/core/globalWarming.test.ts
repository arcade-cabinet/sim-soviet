import {
  computeWarmingLevel,
  applyWarmingToTerrain,
  getFloodRisk,
  isWarmingActive,
} from '@/ai/agents/core/globalWarming';
import type { TerrainTileState } from '@/ai/agents/core/terrainTick';

/**
 * Helper: create a default tile with overrides.
 */
function makeTile(overrides: Partial<TerrainTileState> = {}): TerrainTileState {
  return {
    type: 'grassland',
    fertility: 60,
    contamination: 0,
    moisture: 50,
    forestAge: 0,
    erosionLevel: 0,
    elevation: 100,
    ...overrides,
  };
}

// ── computeWarmingLevel ──────────────────────────────────────

describe('computeWarmingLevel', () => {
  it('returns 0 at year 1917', () => {
    expect(computeWarmingLevel(1917)).toBe(0);
  });

  it('returns 0 for years before 1917', () => {
    expect(computeWarmingLevel(1900)).toBe(0);
  });

  it('increases logarithmically over time', () => {
    const w2017 = computeWarmingLevel(2017);
    const w2117 = computeWarmingLevel(2117);
    const w2217 = computeWarmingLevel(2217);
    expect(w2017).toBeGreaterThan(0);
    expect(w2117).toBeGreaterThan(w2017);
    expect(w2217).toBeGreaterThan(w2117);
    // Logarithmic: increments should decrease
    expect(w2117 - w2017).toBeGreaterThan(w2217 - w2117);
  });

  it('is capped at 2.0', () => {
    // Very far future year
    expect(computeWarmingLevel(100000)).toBe(2.0);
  });

  it('returns expected value at year 2017 (100 years after start)', () => {
    // log10((2017-1917)/100 + 1) = log10(2) ≈ 0.301
    expect(computeWarmingLevel(2017)).toBeCloseTo(0.301, 2);
  });

  it('returns expected value at year 2117 (200 years after start)', () => {
    // log10((2117-1917)/100 + 1) = log10(3) ≈ 0.477
    expect(computeWarmingLevel(2117)).toBeCloseTo(0.477, 2);
  });
});

// ── isWarmingActive ──────────────────────────────────────────

describe('isWarmingActive', () => {
  it('returns false for historical mode regardless of year', () => {
    expect(isWarmingActive('historical', 2100)).toBe(false);
    expect(isWarmingActive('historical', 3000)).toBe(false);
  });

  it('returns false for freeform mode before 2050', () => {
    expect(isWarmingActive('freeform', 2049)).toBe(false);
    expect(isWarmingActive('freeform', 1917)).toBe(false);
  });

  it('returns true for freeform mode at year 2050', () => {
    expect(isWarmingActive('freeform', 2050)).toBe(true);
  });

  it('returns true for freeform mode after 2050', () => {
    expect(isWarmingActive('freeform', 2100)).toBe(true);
    expect(isWarmingActive('freeform', 3000)).toBe(true);
  });
});

// ── applyWarmingToTerrain ────────────────────────────────────

describe('applyWarmingToTerrain', () => {
  it('returns tile unchanged when warming is 0', () => {
    const tile = makeTile({ type: 'tundra', fertility: 20 });
    const result = applyWarmingToTerrain(tile, 0);
    expect(result).toEqual(tile);
  });

  it('returns tile unchanged when warming is below 0.3', () => {
    const tile = makeTile({ type: 'tundra', fertility: 20 });
    const result = applyWarmingToTerrain(tile, 0.2);
    expect(result).toEqual(tile);
  });

  // warming > 0.3: tundra fertility +5%
  it('increases tundra fertility by 5% when warming > 0.3', () => {
    const tile = makeTile({ type: 'tundra', fertility: 20 });
    const result = applyWarmingToTerrain(tile, 0.4);
    expect(result.fertility).toBeCloseTo(21, 1); // 20 * 1.05 = 21
  });

  it('does not increase non-tundra fertility at warming 0.4', () => {
    const tile = makeTile({ type: 'grassland', fertility: 60 });
    const result = applyWarmingToTerrain(tile, 0.4);
    expect(result.fertility).toBe(60);
  });

  // warming > 0.5: tundra → grassland conversion
  it('converts tundra to grassland when warming > 0.5', () => {
    const tile = makeTile({ type: 'tundra', fertility: 20 });
    const result = applyWarmingToTerrain(tile, 0.6);
    expect(result.type).toBe('grassland');
    // Also gets the fertility boost
    expect(result.fertility).toBeGreaterThan(20);
  });

  it('does not convert non-tundra tiles at warming 0.6', () => {
    const tile = makeTile({ type: 'forest', fertility: 70, forestAge: 30 });
    const result = applyWarmingToTerrain(tile, 0.6);
    expect(result.type).toBe('forest');
  });

  // warming > 0.7: flood risk on low-elevation tiles, southern forest die-off
  it('does not change type of low-elevation tiles at warming 0.7 (flood risk is separate)', () => {
    const tile = makeTile({ type: 'grassland', elevation: 20 });
    const result = applyWarmingToTerrain(tile, 0.8);
    // Tile type unchanged; flood risk is queried via getFloodRisk
    expect(result.type).toBe('grassland');
  });

  it('reduces forestAge by 2 on forest tiles when warming > 0.7 (southern die-off)', () => {
    const tile = makeTile({ type: 'forest', forestAge: 30 });
    const result = applyWarmingToTerrain(tile, 0.8);
    expect(result.forestAge).toBe(28);
  });

  it('does not reduce forestAge below 0 from die-off', () => {
    const tile = makeTile({ type: 'forest', forestAge: 1 });
    const result = applyWarmingToTerrain(tile, 0.8);
    expect(result.forestAge).toBe(0);
  });

  it('converts forest to cleared when forestAge reaches 0 from die-off', () => {
    const tile = makeTile({ type: 'forest', forestAge: 1 });
    const result = applyWarmingToTerrain(tile, 0.8);
    expect(result.forestAge).toBe(0);
    expect(result.type).toBe('cleared');
  });

  it('does not apply forest die-off to non-forest tiles', () => {
    const tile = makeTile({ type: 'grassland', forestAge: 0 });
    const result = applyWarmingToTerrain(tile, 0.8);
    expect(result.forestAge).toBe(0);
  });

  // warming > 1.0: permafrost becomes farmable
  it('converts permafrost to grassland when warming > 1.0', () => {
    const tile = makeTile({ type: 'permafrost', fertility: 0 });
    const result = applyWarmingToTerrain(tile, 1.1);
    expect(result.type).toBe('grassland');
    expect(result.fertility).toBeGreaterThan(0);
  });

  it('does not convert non-permafrost tiles at warming > 1.0', () => {
    const tile = makeTile({ type: 'grassland' });
    const result = applyWarmingToTerrain(tile, 1.1);
    expect(result.type).toBe('grassland');
  });

  // Combined effects: tundra at high warming gets converted then permafrost rules don't apply
  it('applies effects cumulatively at high warming levels', () => {
    const tile = makeTile({ type: 'tundra', fertility: 20 });
    const result = applyWarmingToTerrain(tile, 1.5);
    // warming > 0.3: fertility +5% (20 → 21)
    // warming > 0.5: tundra → grassland
    expect(result.type).toBe('grassland');
    expect(result.fertility).toBeCloseTo(21, 1);
  });

  it('does not mutate the input tile', () => {
    const tile = makeTile({ type: 'tundra', fertility: 20 });
    applyWarmingToTerrain(tile, 0.6);
    expect(tile.type).toBe('tundra');
    expect(tile.fertility).toBe(20);
  });

  it('preserves other tile fields', () => {
    const tile = makeTile({
      type: 'tundra',
      fertility: 20,
      contamination: 3,
      moisture: 40,
      erosionLevel: 5,
      elevation: 150,
    });
    const result = applyWarmingToTerrain(tile, 0.6);
    expect(result.contamination).toBe(3);
    expect(result.moisture).toBe(40);
    expect(result.erosionLevel).toBe(5);
    expect(result.elevation).toBe(150);
  });
});

// ── getFloodRisk ─────────────────────────────────────────────

describe('getFloodRisk', () => {
  it('returns 0 when warming is 0', () => {
    expect(getFloodRisk(10, 0)).toBe(0);
  });

  it('returns 0 when warming is below 0.7', () => {
    expect(getFloodRisk(10, 0.5)).toBe(0);
  });

  it('returns higher risk for lower elevation at warming > 0.7', () => {
    const lowElev = getFloodRisk(10, 0.8);
    const highElev = getFloodRisk(200, 0.8);
    expect(lowElev).toBeGreaterThan(highElev);
  });

  it('returns higher risk for higher warming levels', () => {
    const lowWarm = getFloodRisk(20, 0.8);
    const highWarm = getFloodRisk(20, 1.5);
    expect(highWarm).toBeGreaterThan(lowWarm);
  });

  it('is clamped between 0 and 1', () => {
    expect(getFloodRisk(0, 2.0)).toBeLessThanOrEqual(1);
    expect(getFloodRisk(0, 2.0)).toBeGreaterThanOrEqual(0);
    expect(getFloodRisk(1000, 0.8)).toBeGreaterThanOrEqual(0);
  });

  it('returns 0 for very high elevation even at high warming', () => {
    expect(getFloodRisk(500, 2.0)).toBeCloseTo(0, 1);
  });

  it('returns significant risk for very low elevation at high warming', () => {
    const risk = getFloodRisk(5, 1.5);
    expect(risk).toBeGreaterThan(0.3);
  });
});

import { deforest, erode, recover } from '@/ai/agents/core/terrainProcesses';
import type { TerrainTileState } from '@/ai/agents/core/terrainTick';

/**
 * Helper: create a default tile with overrides.
 */
function makeTile(overrides: Partial<TerrainTileState> = {}): TerrainTileState {
  return {
    type: 'forest',
    fertility: 80,
    contamination: 0,
    moisture: 50,
    forestAge: 30,
    erosionLevel: 0,
    elevation: 100,
    ...overrides,
  };
}

// ── Deforestation ──────────────────────────────────────────

describe('deforest', () => {
  it('reduces forestAge by 1-3 based on nearby building count', () => {
    const tile = makeTile({ type: 'forest', forestAge: 30 });
    const result = deforest(tile, 2);
    // With 2 buildings: reduction = min(2, 3) = 2
    expect(result.forestAge).toBe(28);
  });

  it('reduces forestAge by 1 with 1 nearby building', () => {
    const tile = makeTile({ type: 'forest', forestAge: 20 });
    const result = deforest(tile, 1);
    expect(result.forestAge).toBe(19);
  });

  it('reduces forestAge by max 3 even with many buildings', () => {
    const tile = makeTile({ type: 'forest', forestAge: 50 });
    const result = deforest(tile, 10);
    expect(result.forestAge).toBe(47);
  });

  it('clears forest when forestAge reaches 0', () => {
    const tile = makeTile({ type: 'forest', forestAge: 1 });
    const result = deforest(tile, 3);
    expect(result.forestAge).toBe(0);
    expect(result.type).toBe('cleared');
  });

  it('does not reduce forestAge below 0', () => {
    const tile = makeTile({ type: 'forest', forestAge: 2 });
    const result = deforest(tile, 3);
    expect(result.forestAge).toBe(0);
    expect(result.type).toBe('cleared');
  });

  it('returns tile unchanged with 0 nearby buildings', () => {
    const tile = makeTile({ type: 'forest', forestAge: 30 });
    const result = deforest(tile, 0);
    expect(result.forestAge).toBe(30);
    expect(result.type).toBe('forest');
  });

  it('returns non-forest tiles unchanged', () => {
    const tile = makeTile({ type: 'grassland', forestAge: 0 });
    const result = deforest(tile, 5);
    expect(result.forestAge).toBe(0);
    expect(result.type).toBe('grassland');
  });

  it('returns water tiles unchanged', () => {
    const tile = makeTile({ type: 'water', forestAge: 0 });
    const result = deforest(tile, 3);
    expect(result.type).toBe('water');
  });

  it('preserves all other tile fields', () => {
    const tile = makeTile({
      type: 'forest',
      forestAge: 20,
      fertility: 75,
      contamination: 5,
      moisture: 60,
      erosionLevel: 3,
      elevation: 200,
    });
    const result = deforest(tile, 1);
    expect(result.fertility).toBe(75);
    expect(result.contamination).toBe(5);
    expect(result.moisture).toBe(60);
    expect(result.erosionLevel).toBe(3);
    expect(result.elevation).toBe(200);
  });

  it('does not mutate the input tile', () => {
    const tile = makeTile({ type: 'forest', forestAge: 30 });
    deforest(tile, 2);
    expect(tile.forestAge).toBe(30);
    expect(tile.type).toBe('forest');
  });
});

// ── Erosion ────────────────────────────────────────────────

describe('erode', () => {
  it('reduces fertility by 0.5-1% based on years farmed', () => {
    const tile = makeTile({ type: 'grassland', fertility: 80, forestAge: 0 });
    const result = erode(tile, 1);
    // 1 year farmed: reduction = min(0.5 + 1 * 0.05, 1.0) = 0.55 → fertility * 0.0055
    // fertility loss = 80 * 0.0055 = 0.44
    expect(result.fertility).toBeLessThan(80);
    expect(result.fertility).toBeGreaterThan(79);
  });

  it('increases erosion with more years farmed', () => {
    const tile = makeTile({ type: 'grassland', fertility: 80, forestAge: 0 });
    const result1 = erode(tile, 1);
    const result5 = erode(tile, 5);
    const result10 = erode(tile, 10);
    // More years = more fertility loss
    expect(result1.fertility).toBeGreaterThan(result5.fertility);
    expect(result5.fertility).toBeGreaterThan(result10.fertility);
  });

  it('caps fertility reduction at 1% per year', () => {
    const tile = makeTile({ type: 'grassland', fertility: 100, forestAge: 0 });
    const result = erode(tile, 100);
    // Max reduction is 1% of fertility = 1.0
    expect(result.fertility).toBeGreaterThanOrEqual(99);
  });

  it('does not reduce fertility below 0', () => {
    const tile = makeTile({ type: 'grassland', fertility: 0.1, forestAge: 0 });
    const result = erode(tile, 50);
    expect(result.fertility).toBeGreaterThanOrEqual(0);
  });

  it('returns tile unchanged with 0 years farmed', () => {
    const tile = makeTile({ type: 'grassland', fertility: 80, forestAge: 0 });
    const result = erode(tile, 0);
    expect(result.fertility).toBe(80);
  });

  it('returns forest tiles unchanged', () => {
    const tile = makeTile({ type: 'forest', fertility: 80, forestAge: 30 });
    const result = erode(tile, 10);
    expect(result.fertility).toBe(80);
  });

  it('returns water tiles unchanged', () => {
    const tile = makeTile({ type: 'water', fertility: 0 });
    const result = erode(tile, 10);
    expect(result.fertility).toBe(0);
    expect(result.type).toBe('water');
  });

  it('increases erosionLevel as side effect', () => {
    const tile = makeTile({ type: 'grassland', fertility: 80, erosionLevel: 0, forestAge: 0 });
    const result = erode(tile, 5);
    expect(result.erosionLevel).toBeGreaterThan(0);
  });

  it('preserves other tile fields', () => {
    const tile = makeTile({
      type: 'grassland',
      fertility: 80,
      contamination: 3,
      moisture: 40,
      forestAge: 0,
      elevation: 150,
    });
    const result = erode(tile, 5);
    expect(result.contamination).toBe(3);
    expect(result.moisture).toBe(40);
    expect(result.elevation).toBe(150);
    expect(result.type).toBe('grassland');
  });

  it('does not mutate the input tile', () => {
    const tile = makeTile({ type: 'grassland', fertility: 80, forestAge: 0 });
    erode(tile, 5);
    expect(tile.fertility).toBe(80);
  });
});

// ── Recovery ───────────────────────────────────────────────

describe('recover', () => {
  it('increases fertility by 0.3% per year abandoned', () => {
    const tile = makeTile({ type: 'grassland', fertility: 50, forestAge: 0 });
    const result = recover(tile, 1);
    // 1 year: +0.3% of max (100) = +0.3
    expect(result.fertility).toBeCloseTo(50.3, 1);
  });

  it('increases fertility more with more years abandoned', () => {
    const tile = makeTile({ type: 'grassland', fertility: 50, forestAge: 0 });
    const result = recover(tile, 5);
    // 5 years: +0.3 * 5 = +1.5
    expect(result.fertility).toBeCloseTo(51.5, 1);
  });

  it('does not increase fertility above 100', () => {
    const tile = makeTile({ type: 'grassland', fertility: 99.9, forestAge: 0 });
    const result = recover(tile, 10);
    expect(result.fertility).toBeLessThanOrEqual(100);
  });

  it('regrows forest at +1 forestAge per year', () => {
    const tile = makeTile({ type: 'cleared', forestAge: 0 });
    const result = recover(tile, 3);
    expect(result.forestAge).toBe(3);
  });

  it('converts cleared tile to forest when forestAge reaches threshold', () => {
    // After enough recovery, a cleared tile should become forest
    const tile = makeTile({ type: 'cleared', forestAge: 0 });
    const result = recover(tile, 5);
    expect(result.type).toBe('forest');
    expect(result.forestAge).toBe(5);
  });

  it('does not regrow forest on non-cleared tiles', () => {
    const tile = makeTile({ type: 'grassland', forestAge: 0 });
    const result = recover(tile, 10);
    expect(result.forestAge).toBe(0);
    expect(result.type).toBe('grassland');
  });

  it('does not regrow forest on water tiles', () => {
    const tile = makeTile({ type: 'water', forestAge: 0 });
    const result = recover(tile, 10);
    expect(result.forestAge).toBe(0);
    expect(result.type).toBe('water');
  });

  it('returns tile unchanged with 0 years abandoned', () => {
    const tile = makeTile({ type: 'grassland', fertility: 50, forestAge: 0 });
    const result = recover(tile, 0);
    expect(result.fertility).toBe(50);
    expect(result.forestAge).toBe(0);
  });

  it('reduces erosionLevel during recovery', () => {
    const tile = makeTile({ type: 'grassland', erosionLevel: 10, forestAge: 0 });
    const result = recover(tile, 5);
    expect(result.erosionLevel).toBeLessThan(10);
  });

  it('does not reduce erosionLevel below 0', () => {
    const tile = makeTile({ type: 'grassland', erosionLevel: 0.1, forestAge: 0 });
    const result = recover(tile, 100);
    expect(result.erosionLevel).toBeGreaterThanOrEqual(0);
  });

  it('preserves other tile fields', () => {
    const tile = makeTile({
      type: 'grassland',
      fertility: 50,
      contamination: 2,
      moisture: 45,
      forestAge: 0,
      elevation: 120,
    });
    const result = recover(tile, 3);
    expect(result.contamination).toBe(2);
    expect(result.moisture).toBe(45);
    expect(result.elevation).toBe(120);
  });

  it('does not mutate the input tile', () => {
    const tile = makeTile({ type: 'cleared', fertility: 50, forestAge: 0 });
    recover(tile, 5);
    expect(tile.fertility).toBe(50);
    expect(tile.forestAge).toBe(0);
    expect(tile.type).toBe('cleared');
  });
});

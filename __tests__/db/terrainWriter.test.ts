import type { TerrainTileState } from '../../src/ai/agents/core/terrainTick';
import { buildTerrainRow, type TerrainTileContext } from '../../src/db/terrainWriter';

function makeTile(overrides: Partial<TerrainTileState> = {}): TerrainTileState {
  return {
    type: 'forest',
    fertility: 72,
    contamination: 3.5,
    moisture: 60,
    forestAge: 15,
    erosionLevel: 1.2,
    elevation: 5,
    ...overrides,
  };
}

const defaultCtx: TerrainTileContext = {
  x: 10,
  y: 20,
  hasRoad: false,
  hasPipe: false,
  modifiedYear: 1941,
};

describe('buildTerrainRow', () => {
  it('maps all TerrainTileState fields to the correct row columns', () => {
    const tile = makeTile();
    const row = buildTerrainRow(tile, defaultCtx);

    expect(row.x).toBe(10);
    expect(row.y).toBe(20);
    expect(row.terrainType).toBe('forest');
    expect(row.fertility).toBe(72);
    expect(row.contamination).toBe(4);
    expect(row.moisture).toBe(60);
    expect(row.forestAge).toBe(15);
    expect(row.erosionLevel).toBe(1);
    expect(row.elevation).toBe(5);
    expect(row.hasRoad).toBe(false);
    expect(row.hasPipe).toBe(false);
    expect(row.modifiedYear).toBe(1941);
  });

  it('rounds fractional values to integers for DB integer columns', () => {
    const row = buildTerrainRow(makeTile({ fertility: 72.7, contamination: 3.2, erosionLevel: 1.8 }), defaultCtx);
    expect(row.fertility).toBe(73);
    expect(row.contamination).toBe(3);
    expect(row.erosionLevel).toBe(2);
  });

  it('uses context coordinates and infrastructure flags', () => {
    const row = buildTerrainRow(makeTile(), {
      x: 5,
      y: 99,
      hasRoad: true,
      hasPipe: true,
      modifiedYear: 1960,
    });
    expect(row.x).toBe(5);
    expect(row.y).toBe(99);
    expect(row.hasRoad).toBe(true);
    expect(row.hasPipe).toBe(true);
    expect(row.modifiedYear).toBe(1960);
  });

  it('clamps fertility to 0 when negative from tick output', () => {
    const row = buildTerrainRow(makeTile({ fertility: -5 }), defaultCtx);
    expect(row.fertility).toBe(0);
  });

  it('clamps contamination to 0 when negative', () => {
    const row = buildTerrainRow(makeTile({ contamination: -0.01 }), defaultCtx);
    expect(row.contamination).toBe(0);
  });

  it('handles zero values correctly', () => {
    const row = buildTerrainRow(
      makeTile({
        fertility: 0,
        contamination: 0,
        forestAge: 0,
        erosionLevel: 0,
      }),
      defaultCtx,
    );
    expect(row.fertility).toBe(0);
    expect(row.contamination).toBe(0);
    expect(row.forestAge).toBe(0);
    expect(row.erosionLevel).toBe(0);
  });

  it('maps tile type to terrainType', () => {
    const row = buildTerrainRow(makeTile({ type: 'marsh' }), defaultCtx);
    expect(row.terrainType).toBe('marsh');
  });

  it('returns a plain object with exactly 12 keys', () => {
    const row = buildTerrainRow(makeTile(), defaultCtx);
    expect(Object.keys(row)).toHaveLength(12);
  });

  it('does not include an id field (auto-incremented by DB)', () => {
    const row = buildTerrainRow(makeTile(), defaultCtx) as Record<string, unknown>;
    expect(row).not.toHaveProperty('id');
  });

  it('is a pure function — does not mutate inputs', () => {
    const tile = makeTile();
    const ctx = { ...defaultCtx };
    const tileBefore = JSON.stringify(tile);
    const ctxBefore = JSON.stringify(ctx);

    buildTerrainRow(tile, ctx);

    expect(JSON.stringify(tile)).toBe(tileBefore);
    expect(JSON.stringify(ctx)).toBe(ctxBefore);
  });
});

// __tests__/engine/terrainTick.test.ts
import { type TerrainTileState, tickTerrain, type YearlyTerrainContext } from '../../src/ai/agents/core/terrainTick';

describe('tickTerrain', () => {
  const baseTile: TerrainTileState = {
    type: 'grass',
    fertility: 80,
    contamination: 0,
    moisture: 50,
    forestAge: 0,
    erosionLevel: 0,
    elevation: 5,
  };

  const baseCtx: YearlyTerrainContext = {
    rainfall: 0.5,
    globalWarmingRate: 0,
  };

  it('stable tile has no change', () => {
    const result = tickTerrain(baseTile, baseCtx);
    expect(result.fertility).toBe(80);
    expect(result.erosionLevel).toBe(0);
  });

  it('deforested tile erodes', () => {
    const deforested: TerrainTileState = { ...baseTile, type: 'steppe', erosionLevel: 10 };
    const result = tickTerrain(deforested, baseCtx);
    expect(result.erosionLevel).toBeGreaterThan(10);
  });

  it('contamination reduces fertility', () => {
    const contaminated: TerrainTileState = { ...baseTile, contamination: 50 };
    const result = tickTerrain(contaminated, baseCtx);
    expect(result.fertility).toBeLessThan(80);
  });

  it('forest ages by 1 each year', () => {
    const forested: TerrainTileState = { ...baseTile, type: 'forest', forestAge: 5 };
    const result = tickTerrain(forested, baseCtx);
    expect(result.forestAge).toBe(6);
  });

  it('non-forest tile has forestAge 0', () => {
    const result = tickTerrain(baseTile, baseCtx);
    expect(result.forestAge).toBe(0);
  });

  it('pure function: no mutation', () => {
    const tile = { ...baseTile };
    tickTerrain(tile, baseCtx);
    expect(tile).toEqual(baseTile);
  });
});

import { terrainTiles } from '../../src/db/terrain';

describe('terrain_tiles schema', () => {
  it('exports a Drizzle table definition', () => {
    expect(terrainTiles).toBeDefined();
    expect(typeof terrainTiles).toBe('object');
  });
  it('has required columns', () => {
    const cols = Object.keys(terrainTiles);
    expect(cols).toContain('x');
    expect(cols).toContain('y');
    expect(cols).toContain('terrainType');
    expect(cols).toContain('fertility');
    expect(cols).toContain('contamination');
    expect(cols).toContain('moisture');
    expect(cols).toContain('forestAge');
    expect(cols).toContain('erosionLevel');
    expect(cols).toContain('elevation');
    expect(cols).toContain('hasRoad');
    expect(cols).toContain('hasPipe');
    expect(cols).toContain('modifiedYear');
  });
});

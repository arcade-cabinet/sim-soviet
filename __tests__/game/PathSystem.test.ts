import { GRID_SIZE } from '@/config';
import { buildings, tiles, terrainFeatures } from '@/ecs/archetypes';
import { createBuilding, createGrid } from '@/ecs/factories';
import { createForest, createMountain, createRiver } from '@/ecs/factories/terrainFeatureFactories';
import { world } from '@/ecs/world';
import { recalculatePaths } from '@/game/PathSystem';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Count how many tile entities have terrain === 'road'. */
function countRoadTiles(): number {
  let count = 0;
  for (const entity of tiles.entities) {
    if (entity.tile.terrain === 'road') count++;
  }
  return count;
}

/** Get the terrain type of the tile at (x, y). */
function getTileTerrain(x: number, y: number): string | undefined {
  for (const entity of tiles.entities) {
    if (entity.position.gridX === x && entity.position.gridY === y) {
      return entity.tile.terrain;
    }
  }
  return undefined;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('PathSystem', () => {
  beforeEach(() => {
    world.clear();
    createGrid(GRID_SIZE);
  });

  afterEach(() => {
    world.clear();
  });

  it('creates no paths when there are no buildings', () => {
    recalculatePaths();
    expect(countRoadTiles()).toBe(0);
  });

  it('creates no paths with a single isolated building', () => {
    createBuilding(15, 15, 'power-station');
    recalculatePaths();
    // A single building has no building to connect to — zero paths
    expect(countRoadTiles()).toBe(0);
  });

  it('creates path tiles between two adjacent buildings', () => {
    // Place two buildings 3 tiles apart (within MAX_PATH_DISTANCE)
    createBuilding(10, 10, 'power-station');
    createBuilding(10, 13, 'workers-house-a');
    recalculatePaths();

    const roads = countRoadTiles();
    // Should have at least 1 path tile connecting the two
    expect(roads).toBeGreaterThan(0);
    // Path should not be absurdly long for 3-tile gap
    expect(roads).toBeLessThanOrEqual(5);
  });

  it('creates paths between multiple nearby buildings', () => {
    createBuilding(5, 5, 'power-station');
    createBuilding(5, 8, 'workers-house-a');
    createBuilding(8, 5, 'factory-office');
    recalculatePaths();

    const roads = countRoadTiles();
    // With 3 buildings in a triangle, should have several path tiles
    expect(roads).toBeGreaterThan(0);
  });

  it('does not create paths between buildings too far apart', () => {
    // Place two buildings 20 tiles apart (beyond MAX_PATH_DISTANCE of 10)
    createBuilding(2, 2, 'power-station');
    createBuilding(25, 25, 'workers-house-a');
    recalculatePaths();

    expect(countRoadTiles()).toBe(0);
  });

  it('does not overwrite mountain terrain features', () => {
    createBuilding(10, 10, 'power-station');
    createBuilding(10, 14, 'workers-house-a');
    // Place mountain blocking the direct path
    createMountain(10, 12, 2);
    recalculatePaths();

    // The mountain cell should NOT be turned into road
    // (mountains are terrain features, tiles still exist underneath)
    // The path should route around or not connect
    const mountainTile = getTileTerrain(10, 12);
    expect(mountainTile).not.toBe('road');
  });

  it('does not overwrite river terrain features', () => {
    createBuilding(10, 10, 'power-station');
    createBuilding(10, 14, 'workers-house-a');
    createRiver(10, 12);
    recalculatePaths();

    const riverTile = getTileTerrain(10, 12);
    expect(riverTile).not.toBe('road');
  });

  it('does not overwrite forest terrain features', () => {
    createBuilding(10, 10, 'power-station');
    createBuilding(10, 14, 'workers-house-a');
    createForest(10, 12);
    recalculatePaths();

    const forestTile = getTileTerrain(10, 12);
    expect(forestTile).not.toBe('road');
  });

  it('clears old paths when a building is removed', () => {
    createBuilding(10, 10, 'power-station');
    createBuilding(10, 13, 'workers-house-a');
    recalculatePaths();

    const roadsBefore = countRoadTiles();
    expect(roadsBefore).toBeGreaterThan(0);

    // Remove one building and recalculate
    const toRemove = buildings.entities.find(
      (e) => e.position.gridX === 10 && e.position.gridY === 13,
    );
    if (toRemove) world.remove(toRemove);
    recalculatePaths();

    // Should have no paths left (single building, nothing to connect)
    expect(countRoadTiles()).toBe(0);
  });

  it('does not place paths on building cells', () => {
    createBuilding(10, 10, 'power-station');
    createBuilding(10, 12, 'workers-house-a');
    recalculatePaths();

    // The building cells themselves should NOT be road
    const b1 = getTileTerrain(10, 10);
    const b2 = getTileTerrain(10, 12);
    expect(b1).not.toBe('road');
    expect(b2).not.toBe('road');
  });

  it('runs within performance budget on 30x30 grid', () => {
    // Place a cluster of buildings
    for (let i = 0; i < 10; i++) {
      createBuilding(10 + (i % 5) * 2, 10 + Math.floor(i / 5) * 3, `power-station`);
    }

    const start = performance.now();
    recalculatePaths();
    const elapsed = performance.now() - start;

    // Should complete within 16ms (one frame budget)
    expect(elapsed).toBeLessThan(16);
  });
});

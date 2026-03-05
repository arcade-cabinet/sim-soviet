import {
  getVisibleBounds,
  queryVisibleBuildings,
  getLoadSet,
} from '../../src/game/engine/viewportQuery';

describe('getVisibleBounds', () => {
  it('returns axis-aligned bounding box centered on camera', () => {
    const bounds = getVisibleBounds(10, 20, 50);
    expect(bounds).toEqual({ minX: -40, maxX: 60, minZ: -30, maxZ: 70 });
  });

  it('works at origin', () => {
    const bounds = getVisibleBounds(0, 0, 25);
    expect(bounds).toEqual({ minX: -25, maxX: 25, minZ: -25, maxZ: 25 });
  });

  it('works with negative camera position', () => {
    const bounds = getVisibleBounds(-5, -10, 10);
    expect(bounds).toEqual({ minX: -15, maxX: 5, minZ: -20, maxZ: 0 });
  });

  it('handles zero viewDistance', () => {
    const bounds = getVisibleBounds(5, 5, 0);
    expect(bounds).toEqual({ minX: 5, maxX: 5, minZ: 5, maxZ: 5 });
  });
});

describe('queryVisibleBuildings', () => {
  const buildings = [
    { id: 'a', x: 0, z: 0 },
    { id: 'b', x: 10, z: 10 },
    { id: 'c', x: 50, z: 50 },
    { id: 'd', x: -20, z: -20 },
    { id: 'e', x: 5, z: 5 },
  ];

  it('returns buildings within bounds', () => {
    const bounds = { minX: -1, maxX: 11, minZ: -1, maxZ: 11 };
    const result = queryVisibleBuildings(bounds, buildings);
    expect(result).toEqual(['a', 'b', 'e']);
  });

  it('returns empty array when no buildings in bounds', () => {
    const bounds = { minX: 100, maxX: 200, minZ: 100, maxZ: 200 };
    const result = queryVisibleBuildings(bounds, buildings);
    expect(result).toEqual([]);
  });

  it('includes buildings exactly on the boundary', () => {
    const bounds = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
    const result = queryVisibleBuildings(bounds, buildings);
    expect(result).toEqual(['a']);
  });

  it('returns all buildings when bounds cover everything', () => {
    const bounds = { minX: -100, maxX: 100, minZ: -100, maxZ: 100 };
    const result = queryVisibleBuildings(bounds, buildings);
    expect(result).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('handles empty buildings array', () => {
    const bounds = { minX: 0, maxX: 10, minZ: 0, maxZ: 10 };
    const result = queryVisibleBuildings(bounds, []);
    expect(result).toEqual([]);
  });
});

describe('getLoadSet', () => {
  it('computes toLoad and toUnload from diff', () => {
    const newVisible = ['a', 'b', 'c'];
    const currentLoaded = ['b', 'd'];
    const result = getLoadSet(newVisible, currentLoaded);
    expect(result.toLoad.sort()).toEqual(['a', 'c']);
    expect(result.toUnload).toEqual(['d']);
  });

  it('returns empty arrays when sets are identical', () => {
    const ids = ['a', 'b'];
    const result = getLoadSet(ids, ids);
    expect(result).toEqual({ toLoad: [], toUnload: [] });
  });

  it('loads everything when currentLoaded is empty', () => {
    const result = getLoadSet(['a', 'b'], []);
    expect(result.toLoad.sort()).toEqual(['a', 'b']);
    expect(result.toUnload).toEqual([]);
  });

  it('unloads everything when newVisible is empty', () => {
    const result = getLoadSet([], ['a', 'b']);
    expect(result.toLoad).toEqual([]);
    expect(result.toUnload.sort()).toEqual(['a', 'b']);
  });

  it('handles both empty', () => {
    const result = getLoadSet([], []);
    expect(result).toEqual({ toLoad: [], toUnload: [] });
  });
});

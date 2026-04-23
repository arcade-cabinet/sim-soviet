/**
 * Tests for MassGraveCluster store and manifest integration.
 */

import manifest from '../../assets/models/soviet/manifest.json';
import {
  addMassGrave,
  clearMassGraves,
  getMassGraves,
  type MassGraveCluster,
  restoreMassGraves,
} from '../../src/stores/gameStore';

afterEach(() => {
  clearMassGraves();
});

describe('MassGrave store', () => {
  it('starts empty', () => {
    expect(getMassGraves()).toHaveLength(0);
  });

  it('adds a cluster', () => {
    addMassGrave({
      id: 'great_terror-1937',
      gridX: 0,
      gridY: 5,
      year: 1937,
      markerCount: 5,
      cause: 'purge',
    });
    const graves = getMassGraves();
    expect(graves).toHaveLength(1);
    expect(graves[0].cause).toBe('purge');
    expect(graves[0].year).toBe(1937);
  });

  it('accumulates multiple clusters', () => {
    addMassGrave({
      id: 'great_terror-1937',
      gridX: 0,
      gridY: 5,
      year: 1937,
      markerCount: 5,
      cause: 'purge',
    });
    addMassGrave({
      id: 'holodomor-1933',
      gridX: 10,
      gridY: 0,
      year: 1933,
      markerCount: 4,
      cause: 'famine',
    });
    expect(getMassGraves()).toHaveLength(2);
  });

  it('clears all graves', () => {
    addMassGrave({
      id: 'test-1',
      gridX: 0,
      gridY: 0,
      year: 1940,
      markerCount: 3,
      cause: 'war',
    });
    clearMassGraves();
    expect(getMassGraves()).toHaveLength(0);
  });

  it('restores graves from save data', () => {
    const saved: MassGraveCluster[] = [
      { id: 'a', gridX: 1, gridY: 2, year: 1937, markerCount: 3, cause: 'purge' },
      { id: 'b', gridX: 3, gridY: 4, year: 1933, markerCount: 4, cause: 'famine' },
    ];
    restoreMassGraves(saved);
    expect(getMassGraves()).toHaveLength(2);
    expect(getMassGraves()[0].id).toBe('a');
    expect(getMassGraves()[1].id).toBe('b');
  });
});

describe('Grave models in manifest', () => {
  const EXPECTED_MODELS = [
    'grave-cross-a',
    'grave-cross-b',
    'grave-cross-c',
    'grave-stone-a',
    'grave-stone-b',
    'grave-mound',
  ];

  it('all grave models exist in manifest', () => {
    const manifestNames = Object.keys(manifest.assets);
    for (const model of EXPECTED_MODELS) {
      expect(manifestNames).toContain(model);
    }
  });

  it('all grave models have mass_grave role', () => {
    for (const model of EXPECTED_MODELS) {
      const asset = (manifest.assets as Record<string, any>)[model];
      expect(asset.role).toBe('mass_grave');
    }
  });

  it('mass_grave role lists all 6 models', () => {
    const roles = manifest.roles as Record<string, string[]>;
    expect(roles.mass_grave).toBeDefined();
    expect(roles.mass_grave).toHaveLength(6);
    for (const model of EXPECTED_MODELS) {
      expect(roles.mass_grave).toContain(model);
    }
  });
});

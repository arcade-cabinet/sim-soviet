/**
 * Tests for ModelMapping era-aware model resolution.
 *
 * Verifies the resolution chain:
 *   ERA_MODEL_MAP[era][type] > MODEL_MAP[type] > null
 */

import { ERA_MODEL_MAP, getModelName, getTierVariant, BUILDING_TYPES } from '../../src/scene/ModelMapping';
import manifest from '../../assets/models/soviet/manifest.json';

describe('getModelName', () => {
  // ── Default (no era) ────────────────────────────────────────────────────

  it('returns base model for known building type without era', () => {
    expect(getModelName('housing', 0)).toBe('workers-house-a');
    expect(getModelName('factory', 1)).toBe('factory-office');
    expect(getModelName('housing', 2)).toBe('apartment-tower-c');
  });

  it('returns null for unknown building type', () => {
    expect(getModelName('nonexistent')).toBeNull();
  });

  it('clamps level to 0-2 range', () => {
    expect(getModelName('housing', -1)).toBe('workers-house-a');
    expect(getModelName('housing', 5)).toBe('apartment-tower-c');
    expect(getModelName('housing', 1.7)).toBe('apartment-tower-a');
  });

  // ── Era override ─────────────────────────────────────────────────────────

  it('returns era-specific model when era override exists', () => {
    // the_eternal housing: colony-dome (L0), colony-habitat-a (L1), colony-habitat-c (L2)
    const eternal = ERA_MODEL_MAP.the_eternal!;
    expect(getModelName('housing', 0, 'the_eternal')).toBe(eternal.housing![0]);
    expect(getModelName('housing', 1, 'the_eternal')).toBe(eternal.housing![1]);
    expect(getModelName('housing', 2, 'the_eternal')).toBe(eternal.housing![2]);
  });

  it('returns era-specific model for factory in the_eternal', () => {
    expect(getModelName('factory', 0, 'the_eternal')).toBe('colony-workshop');
    expect(getModelName('factory', 1, 'the_eternal')).toBe('spacestation-02');
    expect(getModelName('factory', 2, 'the_eternal')).toBe('spacestation-04');
  });

  it('falls back to default MODEL_MAP when era has no override for type', () => {
    // gulag is not in ERA_MODEL_MAP.the_eternal, should fall through
    expect(getModelName('gulag', 0, 'the_eternal')).toBe('gulag-admin');
  });

  it('falls back to default MODEL_MAP when era is unknown', () => {
    expect(getModelName('housing', 0, 'future_unknown')).toBe('workers-house-a');
  });

  it('falls back to default MODEL_MAP when era is undefined', () => {
    expect(getModelName('housing', 0, undefined)).toBe('workers-house-a');
  });

  it('returns null for unknown type even with valid era', () => {
    expect(getModelName('nonexistent', 0, 'the_eternal')).toBeNull();
  });

  // ── Soviet-era models are unchanged ────────────────────────────────────

  it('returns standard soviet models for revolution era', () => {
    // revolution is not in ERA_MODEL_MAP — should always fall through
    expect(getModelName('housing', 0, 'revolution')).toBe('workers-house-a');
    expect(getModelName('factory', 0, 'revolution')).toBe('warehouse');
    expect(getModelName('power', 0, 'revolution')).toBe('power-station');
  });

  it('returns standard soviet housing for all eras (housing never overridden)', () => {
    const allEras = [
      'revolution',
      'collectivization',
      'industrialization',
      'great_patriotic',
      'reconstruction',
      'thaw_and_freeze',
      'stagnation',
    ];
    for (const era of allEras) {
      expect(getModelName('housing', 0, era)).toBe('workers-house-a');
    }
  });

  // ── Industrialization-era overrides ───────────────────────────────────

  it('returns PSX industrial models for factory in industrialization era', () => {
    expect(getModelName('factory', 0, 'industrialization')).toBe('industrial-machinery');
    expect(getModelName('factory', 1, 'industrialization')).toBe('industrial-furnace');
    expect(getModelName('factory', 2, 'industrialization')).toBe('pipe-system');
  });

  it('returns PSX power model for power in industrialization era', () => {
    expect(getModelName('power', 0, 'industrialization')).toBe('power-equipment');
  });

  it('returns chimney for pump in industrialization era', () => {
    expect(getModelName('pump', 0, 'industrialization')).toBe('chimney-stack');
  });

  it('returns industrial warehouse for station in industrialization era', () => {
    expect(getModelName('station', 0, 'industrialization')).toBe('industrial-warehouse');
  });

  it('returns PSX factory models for great_patriotic era', () => {
    expect(getModelName('factory', 0, 'great_patriotic')).toBe('industrial-machinery');
    expect(getModelName('factory', 1, 'great_patriotic')).toBe('industrial-furnace');
  });

  it('returns PSX factory models for reconstruction era', () => {
    expect(getModelName('factory', 0, 'reconstruction')).toBe('industrial-machinery');
    expect(getModelName('station', 0, 'reconstruction')).toBe('industrial-warehouse');
  });

  it('falls back to default for building types not overridden in industrial eras', () => {
    // farm, gulag, tower, mast are not in industrialization ERA_MODEL_MAP
    expect(getModelName('farm', 0, 'industrialization')).toBe('collective-farm-hq');
    expect(getModelName('gulag', 0, 'industrialization')).toBe('gulag-admin');
    expect(getModelName('tower', 0, 'great_patriotic')).toBe('radio-station');
  });
});

describe('ERA_MODEL_MAP', () => {
  it('has the_eternal era with placeholder colony models', () => {
    expect(ERA_MODEL_MAP.the_eternal).toBeDefined();
    const eternal = ERA_MODEL_MAP.the_eternal!;
    expect(eternal.housing).toBeDefined();
    expect(eternal.factory).toBeDefined();
    expect(eternal.power).toBeDefined();
    expect(eternal.space).toBeDefined();
  });

  it('all the_eternal entries have 3-element tuples', () => {
    const eternal = ERA_MODEL_MAP.the_eternal!;
    for (const [type, models] of Object.entries(eternal)) {
      expect(models).toHaveLength(3);
      for (const model of models) {
        expect(typeof model).toBe('string');
        expect(model.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('getTierVariant', () => {
  it('returns tier-specific variant for housing models', () => {
    expect(getTierVariant('workers-house-a', 'gorod')).toBe('workers-house-c');
    expect(getTierVariant('workers-house-a', 'selo')).toBe('workers-house-a');
  });

  it('returns defId for models without tier variants', () => {
    // colony-habitat-a has no tier variant entry — should return itself
    expect(getTierVariant('colony-habitat-a', 'selo')).toBe('colony-habitat-a');
    expect(getTierVariant('colony-habitat-a', 'gorod')).toBe('colony-habitat-a');
  });
});

describe('BUILDING_TYPES', () => {
  it('includes all expected building types', () => {
    expect(BUILDING_TYPES).toContain('housing');
    expect(BUILDING_TYPES).toContain('factory');
    expect(BUILDING_TYPES).toContain('space');
    expect(BUILDING_TYPES).toContain('nuke');
  });
});

describe('Colony models in manifest', () => {
  it('all ERA_MODEL_MAP the_eternal models exist in manifest.json', () => {
    const eternal = ERA_MODEL_MAP.the_eternal!;
    const manifestNames = Object.keys(manifest.assets);

    for (const [type, models] of Object.entries(eternal)) {
      for (const modelName of models) {
        expect(manifestNames).toContain(modelName);
      }
    }
  });

  it('colony manifest entries have era field set to the_eternal', () => {
    const colonyAssets = Object.entries(manifest.assets).filter(
      ([name]) => name.startsWith('colony-'),
    );
    expect(colonyAssets.length).toBeGreaterThanOrEqual(12);

    for (const [name, asset] of colonyAssets) {
      expect((asset as any).era).toBe('the_eternal');
    }
  });

  it('colony roles are listed in manifest roles section', () => {
    const roles = manifest.roles as Record<string, string[]>;
    expect(roles.colony_housing).toBeDefined();
    expect(roles.colony_housing.length).toBe(5);
    expect(roles.colony_industry).toBeDefined();
    expect(roles.colony_power).toBeDefined();
    expect(roles.colony_government).toBeDefined();
  });
});

describe('Industrial models in manifest', () => {
  it('all ERA_MODEL_MAP industrialization models exist in manifest.json', () => {
    const industrial = ERA_MODEL_MAP.industrialization!;
    const manifestNames = Object.keys(manifest.assets);

    for (const [_type, models] of Object.entries(industrial)) {
      for (const modelName of models) {
        expect(manifestNames).toContain(modelName);
      }
    }
  });

  it('industrial manifest entries have era field set to industrialization', () => {
    const industrialAssets = Object.entries(manifest.assets).filter(
      ([name]) => name.startsWith('industrial-') || name === 'pipe-system' || name === 'power-equipment' || name === 'chimney-stack' || name === 'storage-tank' || name === 'water-tower',
    );
    expect(industrialAssets.length).toBe(8);

    for (const [_name, asset] of industrialAssets) {
      expect((asset as any).era).toBe('industrialization');
    }
  });

  it('industrial roles are listed in manifest roles section', () => {
    const roles = manifest.roles as Record<string, string[]>;
    expect(roles.industrial_heavy).toBeDefined();
    expect(roles.industrial_heavy.length).toBe(4);
    expect(roles.industrial_power).toBeDefined();
    expect(roles.industrial_storage).toBeDefined();
    expect(roles.industrial_infrastructure).toBeDefined();
  });

  it('great_patriotic and reconstruction eras share industrial factory models', () => {
    const gp = ERA_MODEL_MAP.great_patriotic!;
    const recon = ERA_MODEL_MAP.reconstruction!;
    // Both use the same factory models
    expect(gp.factory).toEqual(ERA_MODEL_MAP.industrialization!.factory);
    expect(recon.factory).toEqual(ERA_MODEL_MAP.industrialization!.factory);
  });
});

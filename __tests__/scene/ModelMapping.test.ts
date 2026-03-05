/**
 * Tests for ModelMapping era-aware model resolution.
 *
 * Verifies the resolution chain:
 *   ERA_MODEL_MAP[era][type] > MODEL_MAP[type] > null
 */

import { ERA_MODEL_MAP, getModelName, getTierVariant, BUILDING_TYPES } from '../../src/scene/ModelMapping';

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
    expect(getModelName('housing', 0, 'the_eternal')).toBe('colony-habitat-a');
    expect(getModelName('housing', 1, 'the_eternal')).toBe('colony-habitat-b');
    expect(getModelName('housing', 2, 'the_eternal')).toBe('colony-habitat-c');
  });

  it('returns era-specific model for factory in the_eternal', () => {
    expect(getModelName('factory', 0, 'the_eternal')).toBe('colony-workshop');
    expect(getModelName('factory', 1, 'the_eternal')).toBe('colony-factory');
    expect(getModelName('factory', 2, 'the_eternal')).toBe('colony-megafactory');
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

  it('returns standard soviet models for all non-eternal eras', () => {
    const sovietEras = [
      'revolution',
      'collectivization',
      'industrialization',
      'great_patriotic',
      'reconstruction',
      'thaw_and_freeze',
      'stagnation',
    ];
    for (const era of sovietEras) {
      expect(getModelName('housing', 0, era)).toBe('workers-house-a');
    }
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

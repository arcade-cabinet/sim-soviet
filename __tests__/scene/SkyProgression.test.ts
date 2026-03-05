/**
 * Unit tests for getSpaceSkyState() — pure milestone-to-tier mapping.
 *
 * Verifies all 6 SkyState tiers and that higher tiers override lower ones.
 */

import { getSpaceSkyState, type SkyState } from '../../src/scene/SkyProgression';

describe('getSpaceSkyState', () => {
  it('returns pre_space when no milestones are activated', () => {
    expect(getSpaceSkyState([])).toBe('pre_space');
  });

  it('returns pre_space for unrecognized milestone IDs', () => {
    expect(getSpaceSkyState(['unknown_milestone', 'another_thing'])).toBe('pre_space');
  });

  // ─── Orbital tier ────────────────────────────────────────────────────────────

  it('returns orbital for sputnik', () => {
    expect(getSpaceSkyState(['sputnik'])).toBe('orbital');
  });

  it('returns orbital for vostok_gagarin', () => {
    expect(getSpaceSkyState(['vostok_gagarin'])).toBe('orbital');
  });

  it('returns orbital for salyut_station', () => {
    expect(getSpaceSkyState(['salyut_station'])).toBe('orbital');
  });

  it('returns orbital for mir_station', () => {
    expect(getSpaceSkyState(['mir_station'])).toBe('orbital');
  });

  // ─── Lunar tier ──────────────────────────────────────────────────────────────

  it('returns lunar for permanent_lunar_base', () => {
    expect(getSpaceSkyState(['permanent_lunar_base'])).toBe('lunar');
  });

  it('returns lunar for lunokhod', () => {
    expect(getSpaceSkyState(['lunokhod'])).toBe('lunar');
  });

  // ─── Interplanetary tier ─────────────────────────────────────────────────────

  it('returns interplanetary for mars_colony', () => {
    expect(getSpaceSkyState(['mars_colony'])).toBe('interplanetary');
  });

  it('returns interplanetary for ceres_mining_station', () => {
    expect(getSpaceSkyState(['ceres_mining_station'])).toBe('interplanetary');
  });

  it('returns interplanetary for asteroid_mining', () => {
    expect(getSpaceSkyState(['asteroid_mining'])).toBe('interplanetary');
  });

  // ─── Megastructure tier ──────────────────────────────────────────────────────

  it('returns megastructure for oneill_cylinder', () => {
    expect(getSpaceSkyState(['oneill_cylinder'])).toBe('megastructure');
  });

  it('returns megastructure for dyson_swarm_start', () => {
    expect(getSpaceSkyState(['dyson_swarm_start'])).toBe('megastructure');
  });

  it('returns megastructure for kardashev_one', () => {
    expect(getSpaceSkyState(['kardashev_one'])).toBe('megastructure');
  });

  // ─── Interstellar tier ───────────────────────────────────────────────────────

  it('returns interstellar for generation_ship', () => {
    expect(getSpaceSkyState(['generation_ship'])).toBe('interstellar');
  });

  it('returns interstellar for exoplanet_colony', () => {
    expect(getSpaceSkyState(['exoplanet_colony'])).toBe('interstellar');
  });

  it('returns interstellar for kardashev_two', () => {
    expect(getSpaceSkyState(['kardashev_two'])).toBe('interstellar');
  });

  // ─── Higher tier overrides lower ─────────────────────────────────────────────

  it('interstellar overrides all lower tiers', () => {
    expect(
      getSpaceSkyState([
        'sputnik',
        'permanent_lunar_base',
        'mars_colony',
        'dyson_swarm_start',
        'generation_ship',
      ]),
    ).toBe('interstellar');
  });

  it('megastructure overrides interplanetary and below', () => {
    expect(
      getSpaceSkyState(['sputnik', 'lunokhod', 'asteroid_mining', 'oneill_cylinder']),
    ).toBe('megastructure');
  });

  it('interplanetary overrides lunar and below', () => {
    expect(
      getSpaceSkyState(['sputnik', 'permanent_lunar_base', 'mars_colony']),
    ).toBe('interplanetary');
  });

  it('lunar overrides orbital', () => {
    expect(getSpaceSkyState(['sputnik', 'salyut_station', 'lunokhod'])).toBe('lunar');
  });
});

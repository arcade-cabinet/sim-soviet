/**
 * @module tests/game/terrainEraMapping
 *
 * Unit tests for era → terrain visual state mapping.
 * Verifies all 7 historical eras map to the correct 5 terrain states
 * and that all utility functions return expected values.
 */

import type { EraId } from '../../src/game/era/types';
import {
  eraToTerrainState,
  getTerrainTextureFiles,
  TERRAIN_HILL_COLORS,
  TERRAIN_STATE_COLORS,
  TERRAIN_STATE_ORDER,
  TERRAIN_TEXTURE_PREFIX,
  terrainStateIndex,
} from '../../src/scene/terrainEraMapping';

/** All 7 historical game eras for exhaustive coverage. */
const ALL_ERAS: EraId[] = [
  'revolution',
  'collectivization',
  'industrialization',
  'great_patriotic',
  'reconstruction',
  'thaw_and_freeze',
  'stagnation',
];

describe('terrainEraMapping', () => {
  describe('eraToTerrainState', () => {
    it('maps revolution to snowy_taiga', () => {
      expect(eraToTerrainState('revolution')).toBe('snowy_taiga');
    });

    it('maps collectivization to snowy_taiga (shared with revolution)', () => {
      expect(eraToTerrainState('collectivization')).toBe('snowy_taiga');
    });

    it('maps industrialization to muddy_earth', () => {
      expect(eraToTerrainState('industrialization')).toBe('muddy_earth');
    });

    it('maps great_patriotic to scorched_ash', () => {
      expect(eraToTerrainState('great_patriotic')).toBe('scorched_ash');
    });

    it('maps reconstruction to recovering_green', () => {
      expect(eraToTerrainState('reconstruction')).toBe('recovering_green');
    });

    it('maps thaw_and_freeze to recovering_green (shared with reconstruction)', () => {
      expect(eraToTerrainState('thaw_and_freeze')).toBe('recovering_green');
    });

    it('maps stagnation to concrete_dust', () => {
      expect(eraToTerrainState('stagnation')).toBe('concrete_dust');
    });

    it('covers all 7 historical eras without throwing', () => {
      for (const era of ALL_ERAS) {
        expect(() => eraToTerrainState(era)).not.toThrow();
      }
    });

    it('produces exactly 5 unique terrain states from 7 eras', () => {
      const states = new Set(ALL_ERAS.map(eraToTerrainState));
      expect(states.size).toBe(5);
    });
  });

  describe('TERRAIN_STATE_ORDER', () => {
    it('contains exactly 5 states', () => {
      expect(TERRAIN_STATE_ORDER).toHaveLength(5);
    });

    it('starts with snowy_taiga and ends with concrete_dust', () => {
      expect(TERRAIN_STATE_ORDER[0]).toBe('snowy_taiga');
      expect(TERRAIN_STATE_ORDER[4]).toBe('concrete_dust');
    });

    it('contains all unique terrain states from era mapping', () => {
      const states = new Set(ALL_ERAS.map(eraToTerrainState));
      for (const state of states) {
        expect(TERRAIN_STATE_ORDER).toContain(state);
      }
    });
  });

  describe('TERRAIN_STATE_COLORS', () => {
    it('has a color for every terrain state', () => {
      for (const state of TERRAIN_STATE_ORDER) {
        expect(TERRAIN_STATE_COLORS[state]).toBeDefined();
        expect(TERRAIN_STATE_COLORS[state]).toMatch(/^#[0-9a-f]{6}$/i);
      }
    });
  });

  describe('TERRAIN_HILL_COLORS', () => {
    it('has a hill color for every terrain state', () => {
      for (const state of TERRAIN_STATE_ORDER) {
        expect(TERRAIN_HILL_COLORS[state]).toBeDefined();
        expect(TERRAIN_HILL_COLORS[state]).toMatch(/^#[0-9a-f]{6}$/i);
      }
    });
  });

  describe('TERRAIN_TEXTURE_PREFIX', () => {
    it('has a texture prefix for every terrain state', () => {
      for (const state of TERRAIN_STATE_ORDER) {
        expect(TERRAIN_TEXTURE_PREFIX[state]).toBeDefined();
        expect(typeof TERRAIN_TEXTURE_PREFIX[state]).toBe('string');
        expect(TERRAIN_TEXTURE_PREFIX[state].length).toBeGreaterThan(0);
      }
    });
  });

  describe('getTerrainTextureFiles', () => {
    it('returns correct file paths for snowy_taiga', () => {
      const files = getTerrainTextureFiles('snowy_taiga');
      expect(files.color).toBe('assets/textures/terrain/Snow003/Snow003_1K-JPG_Color.jpg');
      expect(files.normal).toBe('assets/textures/terrain/Snow003/Snow003_1K-JPG_NormalGL.jpg');
      expect(files.roughness).toBe('assets/textures/terrain/Snow003/Snow003_1K-JPG_Roughness.jpg');
    });

    it('returns correct file paths for all 5 states', () => {
      for (const state of TERRAIN_STATE_ORDER) {
        const files = getTerrainTextureFiles(state);
        expect(files.color).toContain('_Color.jpg');
        expect(files.normal).toContain('_NormalGL.jpg');
        expect(files.roughness).toContain('_Roughness.jpg');
        // All paths should be under terrain directory
        expect(files.color).toMatch(/^assets\/textures\/terrain\//);
      }
    });
  });

  describe('terrainStateIndex', () => {
    it('returns 0 for snowy_taiga', () => {
      expect(terrainStateIndex('snowy_taiga')).toBe(0);
    });

    it('returns 4 for concrete_dust', () => {
      expect(terrainStateIndex('concrete_dust')).toBe(4);
    });

    it('returns sequential indices for all states', () => {
      for (let i = 0; i < TERRAIN_STATE_ORDER.length; i++) {
        expect(terrainStateIndex(TERRAIN_STATE_ORDER[i])).toBe(i);
      }
    });
  });
});

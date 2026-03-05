/**
 * Celestial Body Factory — unit tests for shader constants and type mappings.
 */

import { BODY_TYPE_VALUE, type CelestialBodyType } from '@/scene/celestial/shaders';

describe('Celestial Body Factory', () => {
  describe('BODY_TYPE_VALUE', () => {
    it('maps all 4 body types to unique shader values', () => {
      const values = Object.values(BODY_TYPE_VALUE);
      expect(values).toHaveLength(4);
      expect(new Set(values).size).toBe(4);
    });

    it('sun = 0, terran = 1, martian = 2, jovian = 3', () => {
      expect(BODY_TYPE_VALUE.sun).toBe(0);
      expect(BODY_TYPE_VALUE.terran).toBe(1);
      expect(BODY_TYPE_VALUE.martian).toBe(2);
      expect(BODY_TYPE_VALUE.jovian).toBe(3);
    });

    it('all values are non-negative integers', () => {
      for (const v of Object.values(BODY_TYPE_VALUE)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(v)).toBe(true);
      }
    });
  });

  describe('CelestialBodyType', () => {
    it('type covers all body categories', () => {
      const types: CelestialBodyType[] = ['sun', 'terran', 'martian', 'jovian'];
      for (const t of types) {
        expect(BODY_TYPE_VALUE[t]).toBeDefined();
      }
    });
  });

  describe('shader source integrity', () => {
    it('body vertex shader contains uFlatten uniform', () => {
      const { bodyVertexShader } = require('@/scene/celestial/shaders');
      expect(bodyVertexShader).toContain('uniform float uFlatten');
    });

    it('body vertex shader contains morph mix()', () => {
      const { bodyVertexShader } = require('@/scene/celestial/shaders');
      expect(bodyVertexShader).toContain('mix(sphericalPos, flatPos, uFlatten)');
    });

    it('body fragment shader handles all 4 body types', () => {
      const { bodyFragmentShader } = require('@/scene/celestial/shaders');
      expect(bodyFragmentShader).toContain('SUN');
      expect(bodyFragmentShader).toContain('TERRAN');
      expect(bodyFragmentShader).toContain('MARTIAN');
      expect(bodyFragmentShader).toContain('JOVIAN');
    });

    it('shell fragment shader has hex panel grid', () => {
      const { shellFragmentShader } = require('@/scene/celestial/shaders');
      expect(shellFragmentShader).toContain('hexCoords');
      expect(shellFragmentShader).toContain('uProgress');
    });

    it('shell fragment shader has build progress discard', () => {
      const { shellFragmentShader } = require('@/scene/celestial/shaders');
      expect(shellFragmentShader).toContain('discard');
    });

    it('all shaders contain noise function', () => {
      const { noiseChunks } = require('@/scene/celestial/shaders');
      expect(noiseChunks).toContain('snoise');
      expect(noiseChunks).toContain('fbm');
    });
  });
});

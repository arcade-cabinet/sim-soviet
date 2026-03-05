/**
 * CelestialViewport integration tests — verifies the viewport replaces TerrainGrid
 * in Content.tsx and that the flatten math works correctly.
 */

import { BODY_TYPE_VALUE, type CelestialBodyType } from '@/scene/celestial/shaders';
import { getLoadZone } from '@/scene/loadZones';

describe('CelestialViewport as default viewport', () => {
  describe('Content.tsx integration', () => {
    // Read Content.tsx source to verify CelestialViewport is used instead of TerrainGrid
    const contentSource = require('fs').readFileSync(
      require('path').resolve(__dirname, '../../src/Content.tsx'),
      'utf8',
    );

    it('imports CelestialViewport from celestial module', () => {
      expect(contentSource).toContain("from './scene/celestial'");
      expect(contentSource).toContain('CelestialViewport');
    });

    it('does NOT render TerrainGrid component', () => {
      // TerrainGrid should not appear as a JSX element in the render
      expect(contentSource).not.toMatch(/<TerrainGrid[\s/>]/);
    });

    it('renders CelestialViewport with dynamic bodyType from zoneProps', () => {
      expect(contentSource).toContain('bodyType={zoneProps.bodyType}');
    });

    it('positions celestial body at grid center offset by bodyRadius', () => {
      // The group wrapping CelestialViewport must offset Y by -bodyRadius
      expect(contentSource).toContain('-bodyRadius');
      expect(contentSource).toContain('position={[center, -bodyRadius, center]}');
    });

    it('rotates celestial body -PI/2 on X so flat surface aligns with XZ plane', () => {
      expect(contentSource).toContain('rotation={[-Math.PI / 2, 0, 0]}');
    });

    it('passes loadZoneHdri, loadZoneShader, marsPhase to Environment', () => {
      expect(contentSource).toContain('loadZoneHdri={zoneProps.loadZoneHdri}');
      expect(contentSource).toContain('loadZoneShader={zoneProps.loadZoneShader}');
      expect(contentSource).toContain('marsPhase={zoneProps.marsPhase}');
    });

    it('passes shellVisible to CelestialViewport', () => {
      expect(contentSource).toContain('shellVisible={zoneProps.shellVisible}');
    });

    it('uses useActiveSettlement + useMemo to derive zone props', () => {
      expect(contentSource).toContain('useActiveSettlement');
      expect(contentSource).toContain('useMemo');
    });

    it('toCelestialBodyType maps celestial bodies correctly', () => {
      expect(contentSource).toContain("case 'mars': return 'martian'");
      expect(contentSource).toContain("case 'orbital':");
      expect(contentSource).toContain("case 'dyson': return 'sun'");
      expect(contentSource).toContain("default: return 'terran'");
    });
  });

  describe('CelestialViewport props', () => {
    it('bodyType prop maps to valid shader values', () => {
      const types: CelestialBodyType[] = ['sun', 'terran', 'martian', 'jovian'];
      for (const t of types) {
        expect(BODY_TYPE_VALUE[t]).toBeDefined();
        expect(typeof BODY_TYPE_VALUE[t]).toBe('number');
      }
    });

    it('terran body type maps to shader value 1', () => {
      expect(BODY_TYPE_VALUE.terran).toBe(1);
    });
  });

  describe('flatten math', () => {
    /** Replicate the flatten formula from CelestialViewport.useFrame */
    function computeFlatten(
      cameraDist: number,
      flattenNear: number,
      flattenFar: number,
    ): number {
      const t = Math.max(0, Math.min(1, (cameraDist - flattenNear) / (flattenFar - flattenNear)));
      return 1 - t;
    }

    it('returns 1 (fully flat) when camera is closer than flattenNear', () => {
      expect(computeFlatten(10, 25, 50)).toBe(1);
      expect(computeFlatten(25, 25, 50)).toBe(1);
    });

    it('returns 0 (full sphere) when camera is farther than flattenFar', () => {
      expect(computeFlatten(50, 25, 50)).toBe(0);
      expect(computeFlatten(100, 25, 50)).toBe(0);
    });

    it('returns intermediate value in the transition zone', () => {
      const f = computeFlatten(37.5, 25, 50);
      expect(f).toBe(0.5);
    });

    it('default camera position at (center+8, 12, center+8) is fully flat', () => {
      // Grid size 30, center=15, bodyRadius=7
      // Camera: (23, 12, 23), Group: (15, -7, 15)
      const dx = 23 - 15;
      const dy = 12 - (-7);
      const dz = 23 - 15;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      // dist ≈ 22.1, flattenNear=25 → fully flat
      const f = computeFlatten(dist, 25, 50);
      expect(f).toBe(1);
      expect(dist).toBeLessThan(25); // confirm within flatten zone
    });

    it('camera at maxDistance (50 from target) reaches full sphere', () => {
      // Camera at maxDistance 50 from orbit target (15, 0, 15)
      // e.g. camera at (15, 50, 15), group at (15, -7, 15)
      const dy = 50 - (-7);
      const dist = dy; // dx=dz=0 in this case
      // dist = 57, flattenFar=50 → full sphere
      const f = computeFlatten(dist, 25, 50);
      expect(f).toBe(0);
    });
  });

  describe('getLoadZone returns correct zone for each celestial body', () => {
    it('earth defaults to earth_winter zone', () => {
      const zone = getLoadZone('earth');
      expect(zone.id).toBe('earth_winter');
    });

    it('mars returns mars_red by default', () => {
      const zone = getLoadZone('mars');
      expect(zone.id).toBe('mars_red');
      expect(zone.shader).toBe('MarsAtmosphere');
      expect(zone.marsPhase).toBe(0);
    });

    it('moon returns moon zone', () => {
      const zone = getLoadZone('moon');
      expect(zone.id).toBe('moon');
    });

    it('orbital returns orbital zone with ONeillInterior shader', () => {
      const zone = getLoadZone('orbital');
      expect(zone.id).toBe('orbital');
      expect(zone.shader).toBe('ONeillInterior');
    });

    it('dyson returns dyson zone with DysonSphereBackdrop shader', () => {
      const zone = getLoadZone('dyson');
      expect(zone.id).toBe('dyson');
      expect(zone.shader).toBe('DysonSphereBackdrop');
    });

    it('earth + post_soviet era returns earth_warm zone', () => {
      const zone = getLoadZone('earth', 'post_soviet');
      expect(zone.id).toBe('earth_warm');
    });

    it('earth + megaearth era returns megaearth zone', () => {
      const zone = getLoadZone('earth', 'megaearth');
      expect(zone.id).toBe('megaearth');
    });
  });

  describe('CameraController maxDistance', () => {
    const cameraSource = require('fs').readFileSync(
      require('path').resolve(__dirname, '../../src/scene/CameraController.tsx'),
      'utf8',
    );

    it('maxDistance is set to 50 for orbital view', () => {
      expect(cameraSource).toContain('maxDistance={50}');
    });
  });
});

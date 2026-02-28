/**
 * Environment — Procedural sky, HDRI-lit PBR ground, and diorama hills.
 *
 * R3F migration:
 * - drei <Sky> component (Preetham model — same as old BabylonJS SkyMaterial)
 * - drei <Environment> for HDRI image-based lighting
 * - <mesh> with <planeGeometry> + <meshStandardMaterial> for PBR ground
 * - useTexture from drei for loading snow/grass textures
 * - <mesh> with <sphereGeometry> for perimeter hills
 *
 * HDRI credits: Poly Haven (CC0) — snowy_field, winter_sky, snowy_park_01
 */

import { Environment as DreiEnvironment, Sky, useTexture } from '@react-three/drei';
import type React from 'react';
import { useMemo } from 'react';
import * as THREE from 'three';
import { GRID_SIZE } from '../engine/GridTypes';
import { assetUrl } from '../utils/assetPath';
import type { Season } from './TerrainGrid';

const GROUND_SIZE = 400;
const GROUND_Y = -0.05;

/** Map season to HDRI for image-based lighting */
function getHdriFile(season: Season): string {
  switch (season) {
    case 'winter':
      return assetUrl('assets/hdri/snowy_field_1k.hdr');
    case 'autumn':
      return assetUrl('assets/hdri/snowy_park_01_1k.hdr');
    default:
      return assetUrl('assets/hdri/winter_sky_1k.hdr');
  }
}

/** Sky parameters per season (Preetham model) */
function getSkyParams(season: Season) {
  switch (season) {
    case 'winter':
      return {
        turbidity: 20,
        rayleigh: 1,
        mieCoefficient: 0.01,
        mieDirectionalG: 0.8,
        inclination: 0.42,
        azimuth: 0.25,
      };
    case 'autumn':
      return {
        turbidity: 15,
        rayleigh: 2,
        mieCoefficient: 0.008,
        mieDirectionalG: 0.8,
        inclination: 0.45,
        azimuth: 0.25,
      };
    default:
      return {
        turbidity: 10,
        rayleigh: 2,
        mieCoefficient: 0.005,
        mieDirectionalG: 0.8,
        inclination: 0.49,
        azimuth: 0.25,
      };
  }
}

/** Ground tint per season */
function getGroundColor(season: Season): string {
  switch (season) {
    case 'winter':
      return '#e6ebf2'; // cold white (0.9, 0.92, 0.95)
    case 'autumn':
      return '#a69980'; // muddy brown-gray (0.65, 0.60, 0.50)
    case 'spring':
      return '#8ca673'; // muted fresh green (0.55, 0.65, 0.45)
    default: // summer
      return '#809466'; // subdued green (0.50, 0.58, 0.40)
  }
}

/** Hill color per season */
function getHillColor(season: Season): string {
  switch (season) {
    case 'winter':
      return '#d1d6e0'; // (0.82, 0.84, 0.88)
    case 'autumn':
      return '#736647'; // (0.45, 0.40, 0.28)
    default:
      return '#526b38'; // (0.32, 0.42, 0.22)
  }
}

/** Hill definitions — positions and scales for perimeter framing */
const HILLS = [
  { x: -15, z: -25, sx: 20, sy: 4, sz: 12 },
  { x: 10, z: -30, sx: 25, sy: 5, sz: 15 },
  { x: 35, z: -20, sx: 18, sy: 3.5, sz: 10 },
  { x: -10, z: 55, sx: 22, sy: 4.5, sz: 13 },
  { x: 20, z: 60, sx: 28, sy: 6, sz: 16 },
  { x: 55, z: 5, sx: 15, sy: 4, sz: 20 },
  { x: 60, z: 30, sx: 20, sy: 5, sz: 18 },
  { x: -25, z: 15, sx: 18, sy: 3.5, sz: 22 },
  { x: -30, z: 35, sx: 22, sy: 4.5, sz: 15 },
  { x: -20, z: -20, sx: 15, sy: 3, sz: 15 },
  { x: 50, z: 50, sx: 18, sy: 4, sz: 18 },
  { x: 55, z: -15, sx: 16, sy: 3.5, sz: 14 },
  { x: -15, z: 45, sx: 14, sy: 3, sz: 16 },
];

/** PBR Ground plane with tiled snow/grass textures */
const Ground: React.FC<{ season: Season }> = ({ season }) => {
  const center = GRID_SIZE / 2;
  const useSnow = season === 'winter' || season === 'autumn';

  const colorFile = useSnow
    ? assetUrl('assets/textures/snow/Snow003_1K-JPG_Color.jpg')
    : assetUrl('assets/textures/grass/Grass001_1K-JPG_Color.jpg');
  const normalFile = useSnow
    ? assetUrl('assets/textures/snow/Snow003_1K-JPG_NormalGL.jpg')
    : assetUrl('assets/textures/grass/Grass001_1K-JPG_NormalGL.jpg');
  const roughFile = useSnow
    ? assetUrl('assets/textures/snow/Snow003_1K-JPG_Roughness.jpg')
    : assetUrl('assets/textures/grass/Grass001_1K-JPG_Roughness.jpg');

  const [colorMap, normalMap, roughnessMap] = useTexture([colorFile, normalFile, roughFile]);

  // Configure texture tiling
  useMemo(() => {
    const tileScale = 20;
    for (const tex of [colorMap, normalMap, roughnessMap]) {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(tileScale, tileScale);
    }
  }, [colorMap, normalMap, roughnessMap]);

  return (
    <mesh position={[center, GROUND_Y, center]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[GROUND_SIZE, GROUND_SIZE, 4, 4]} />
      <meshStandardMaterial
        map={colorMap}
        normalMap={normalMap}
        roughnessMap={roughnessMap}
        color={getGroundColor(season)}
        metalness={0}
        roughness={1}
      />
    </mesh>
  );
};

interface EnvironmentProps {
  season?: Season;
}

const Environment: React.FC<EnvironmentProps> = ({ season = 'winter' }) => {
  const center = GRID_SIZE / 2;
  const skyParams = getSkyParams(season);
  const hdriFile = getHdriFile(season);
  const hillColor = getHillColor(season);

  // Compute sun position from inclination/azimuth (same model as BabylonJS SkyMaterial)
  const sunPosition = useMemo((): [number, number, number] => {
    const { inclination, azimuth } = skyParams;
    const dist = 100;
    return [
      Math.cos(azimuth * 2 * Math.PI) * Math.cos(inclination * Math.PI) * dist,
      Math.sin(inclination * Math.PI) * dist,
      Math.sin(azimuth * 2 * Math.PI) * Math.cos(inclination * Math.PI) * dist,
    ];
  }, [skyParams.inclination, skyParams.azimuth, skyParams]);

  // Pre-compute hill positions (offset by grid center)
  const hillsData = useMemo(
    () =>
      HILLS.map((h) => ({
        position: [h.x + center, h.sy * 0.3, h.z + center] as [number, number, number],
        scale: [h.sx, h.sy, h.sz] as [number, number, number],
      })),
    [center],
  );

  return (
    <>
      {/* Procedural sky (Preetham model) */}
      <Sky
        turbidity={skyParams.turbidity}
        rayleigh={skyParams.rayleigh}
        mieCoefficient={skyParams.mieCoefficient}
        mieDirectionalG={skyParams.mieDirectionalG}
        sunPosition={sunPosition}
      />

      {/* HDRI for image-based lighting (IBL) */}
      <DreiEnvironment files={hdriFile} />

      {/* PBR ground plane */}
      <Ground season={season} />

      {/* Perimeter hills */}
      {hillsData.map((hill, i) => (
        <mesh key={i} position={hill.position} scale={hill.scale}>
          <sphereGeometry args={[0.5, 8, 8]} />
          <meshStandardMaterial color={hillColor} roughness={1} metalness={0} />
        </mesh>
      ))}
    </>
  );
};

export default Environment;

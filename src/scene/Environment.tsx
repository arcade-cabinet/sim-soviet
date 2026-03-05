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
 * Era-driven terrain: Ground textures swap based on the current historical era,
 * providing 6 distinct visual states across the 8 game eras.
 *
 * HDRI credits: Poly Haven (CC0) — snowy_field, winter_sky, snowy_park_01
 * Terrain textures: AmbientCG (CC0)
 */

import { Environment as DreiEnvironment, Sky, useTexture } from '@react-three/drei';
import type React from 'react';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { EraId } from '../game/era/types';
import { getCurrentGridSize } from '../engine/GridTypes';
import { assetUrl } from '../utils/assetPath';
import type { Season } from './TerrainGrid';
import {
  TERRAIN_HILL_COLORS,
  TERRAIN_STATE_COLORS,
  eraToTerrainState,
  getTerrainTextureFiles,
} from './terrainEraMapping';

const GROUND_SIZE = 400;
const GROUND_Y = -0.05;

/** Map season to HDRI for image-based lighting */
function getHdriFile(season: Season): string {
  switch (season) {
    case 'winter':
      return assetUrl('assets/hdri/snowy_field_1k.hdr');
    case 'autumn':
      return assetUrl('assets/hdri/snowy_park_01_1k.hdr');
    case 'spring':
    case 'summer':
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

/** PBR Ground plane with era-driven tiled textures. */
const Ground: React.FC<{ season: Season; era: EraId }> = ({ season, era }) => {
  const center = getCurrentGridSize() / 2;
  const terrainState = eraToTerrainState(era);
  const textureFiles = getTerrainTextureFiles(terrainState);

  // Era-driven PBR textures from AmbientCG terrain packs
  const colorFile = assetUrl(textureFiles.color);
  const normalFile = assetUrl(textureFiles.normal);
  const roughFile = assetUrl(textureFiles.roughness);

  const [colorMap, normalMap, roughnessMap] = useTexture([colorFile, normalFile, roughFile]);

  // Configure texture tiling
  useMemo(() => {
    const tileScale = 20;
    for (const tex of [colorMap, normalMap, roughnessMap]) {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(tileScale, tileScale);
    }
  }, [colorMap, normalMap, roughnessMap]);

  // Blend era color tint with season color for visual coherence
  const groundColor = TERRAIN_STATE_COLORS[terrainState];

  return (
    <mesh position={[center, GROUND_Y, center]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[GROUND_SIZE, GROUND_SIZE, 4, 4]} />
      <meshStandardMaterial
        map={colorMap}
        normalMap={normalMap}
        roughnessMap={roughnessMap}
        color={groundColor}
        metalness={0}
        roughness={1}
      />
    </mesh>
  );
};

interface EnvironmentProps {
  season?: Season;
  /** Current historical era — drives terrain texture selection. */
  era?: EraId;
}

/** Renders the procedural sky, HDRI image-based lighting, PBR ground plane, and perimeter hills. */
const Environment: React.FC<EnvironmentProps> = ({ season = 'winter', era = 'revolution' }) => {
  const center = getCurrentGridSize() / 2;
  const skyParams = getSkyParams(season);
  const hdriFile = getHdriFile(season);
  const terrainState = eraToTerrainState(era);
  const hillColor = TERRAIN_HILL_COLORS[terrainState];

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
      {/* Procedural sky (Preetham model via drei Sky — GLSL ShaderMaterial) */}
      <Sky
        turbidity={skyParams.turbidity}
        rayleigh={skyParams.rayleigh}
        mieCoefficient={skyParams.mieCoefficient}
        mieDirectionalG={skyParams.mieDirectionalG}
        inclination={skyParams.inclination}
        azimuth={skyParams.azimuth}
      />

      {/* HDRI for image-based lighting (IBL) */}
      <DreiEnvironment files={hdriFile} />

      {/* PBR ground plane — era-driven textures */}
      <Ground season={season} era={era} />

      {/* Perimeter hills — era-driven colors */}
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

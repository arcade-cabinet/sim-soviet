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
import DysonSphereBackdrop from './shaders/DysonSphereBackdrop';
import MarsAtmosphere from './shaders/MarsAtmosphere';
import ONeillInterior from './shaders/ONeillInterior';
import type React from 'react';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { EraId } from '../game/era/types';
import { getCurrentGridSize } from '../engine/GridTypes';
import { assetUrl } from '../utils/assetPath';
import type { Season } from '../engine/WeatherSystem';
import {
  DECAY_OVERLAYS,
  TERRAIN_DECAY_OVERLAYS,
  TERRAIN_HILL_COLORS,
  TERRAIN_STATE_COLORS,
  eraToTerrainState,
  getDecayOverlayFiles,
  getTerrainTextureFiles,
  type DecayOverlayId,
} from './terrainEraMapping';

const GROUND_SIZE = 400;
const GROUND_Y = -0.05;

/** Map season + load zone to HDRI for image-based lighting.
 * Load zone takes priority — if the active settlement has a specific HDRI, use it.
 * Falls back to season-based selection for Earth settlements. */
function getHdriFile(season: Season, loadZoneHdri?: string): string {
  // If a load zone specifies an HDRI, use it (non-Earth settlements, advanced eras)
  if (loadZoneHdri) {
    return assetUrl(`assets/hdri/${loadZoneHdri}`);
  }
  // Default: season-based for Earth historical eras
  switch (season) {
    case 'winter':
      return assetUrl('assets/hdri/snowy_field_1k.hdr');
    case 'autumn':
      return assetUrl('assets/hdri/snowy_park_01_1k.hdr');
    case 'spring':
    case 'summer':
    default:
      return assetUrl('assets/hdri/winter_sky_1k.hdr');
  }
}

/**
 * Sky parameters per season (Preetham model).
 * When techLevel > 0, gradually shifts toward deeper, clearer skies
 * (lower turbidity = less atmospheric scattering = more stars visible).
 */
function getSkyParams(season: Season, techLevel = 0) {
  let params: { turbidity: number; rayleigh: number; mieCoefficient: number; mieDirectionalG: number; inclination: number; azimuth: number };
  switch (season) {
    case 'winter':
      params = {
        turbidity: 20,
        rayleigh: 1,
        mieCoefficient: 0.01,
        mieDirectionalG: 0.8,
        inclination: 0.42,
        azimuth: 0.25,
      };
      break;
    case 'autumn':
      params = {
        turbidity: 15,
        rayleigh: 2,
        mieCoefficient: 0.008,
        mieDirectionalG: 0.8,
        inclination: 0.45,
        azimuth: 0.25,
      };
      break;
    default:
      params = {
        turbidity: 10,
        rayleigh: 2,
        mieCoefficient: 0.005,
        mieDirectionalG: 0.8,
        inclination: 0.49,
        azimuth: 0.25,
      };
  }

  // Tech-driven sky shift: clearer atmosphere as civilization advances
  if (techLevel > 0.1) {
    const t = Math.min(1, (techLevel - 0.1) / 0.9);
    params.turbidity = params.turbidity * (1 - t * 0.4); // up to 40% reduction
    params.rayleigh = params.rayleigh + t * 1.5; // deeper blue-violet
    params.mieCoefficient = params.mieCoefficient * (1 - t * 0.3);
  }

  return params;
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

/** Single decay overlay plane — transparent textured layer above the ground. */
const DecayOverlayPlane: React.FC<{ overlayId: DecayOverlayId }> = ({ overlayId }) => {
  const center = getCurrentGridSize() / 2;
  const config = DECAY_OVERLAYS[overlayId];
  const files = getDecayOverlayFiles(config);

  const colorFile = assetUrl(files.color);
  const normalFile = assetUrl(files.normal);
  const roughFile = assetUrl(files.roughness);

  const [colorMap, normalMap, roughnessMap] = useTexture([colorFile, normalFile, roughFile]);

  useMemo(() => {
    const tileScale = 20;
    for (const tex of [colorMap, normalMap, roughnessMap]) {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(tileScale, tileScale);
    }
  }, [colorMap, normalMap, roughnessMap]);

  const emissiveColor = config.emissiveTint ?? '#000000';

  return (
    <mesh
      position={[center, GROUND_Y + 0.01, center]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[GROUND_SIZE, GROUND_SIZE, 4, 4]} />
      <meshStandardMaterial
        map={colorMap}
        normalMap={normalMap}
        roughnessMap={roughnessMap}
        transparent
        opacity={config.opacity}
        depthWrite={false}
        metalness={0}
        roughness={1}
        emissive={emissiveColor}
        emissiveIntensity={config.emissiveIntensity ?? 0}
      />
    </mesh>
  );
};

interface EnvironmentProps {
  season?: Season;
  /** Current historical era — drives terrain texture selection. */
  era?: EraId;
  /** Tech level (0-1) — drives sky clarity shift for space progression. */
  techLevel?: number;
  /** HDRI filename override from load zone (for non-Earth settlements). */
  loadZoneHdri?: string;
  /** Procedural sky shader override from load zone. */
  loadZoneShader?: 'DysonSphereBackdrop' | 'MarsAtmosphere' | 'ONeillInterior';
  /** Mars terraforming progress for MarsAtmosphere shader (0-1). */
  marsPhase?: number;
}

/** Renders the procedural sky, HDRI image-based lighting, PBR ground plane, and perimeter hills. */
const Environment: React.FC<EnvironmentProps> = ({ season = 'winter', era = 'revolution', techLevel = 0, loadZoneHdri, loadZoneShader, marsPhase = 0 }) => {
  const center = getCurrentGridSize() / 2;
  const skyParams = getSkyParams(season, techLevel);
  const hdriFile = getHdriFile(season, loadZoneHdri);
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
      {/* Sky: procedural shader override for non-Earth, or Preetham model for Earth */}
      {loadZoneShader === 'MarsAtmosphere' ? (
        <MarsAtmosphere terraformingProgress={marsPhase} />
      ) : loadZoneShader === 'ONeillInterior' ? (
        <ONeillInterior />
      ) : loadZoneShader === 'DysonSphereBackdrop' ? (
        <DysonSphereBackdrop />
      ) : (
        <Sky
          turbidity={skyParams.turbidity}
          rayleigh={skyParams.rayleigh}
          mieCoefficient={skyParams.mieCoefficient}
          mieDirectionalG={skyParams.mieDirectionalG}
          inclination={skyParams.inclination}
          azimuth={skyParams.azimuth}
        />
      )}

      {/* HDRI for image-based lighting (IBL) — always active for PBR materials */}
      <DreiEnvironment files={hdriFile} />
    </>
  );
};

export default Environment;

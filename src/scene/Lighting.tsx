/**
 * Lighting — bright, inviting scene lighting with day/night cycle.
 *
 * R3F migration:
 * - <directionalLight> with castShadow for sun
 * - <hemisphereLight> for ambient fill
 * - <fog> for distance depth cueing
 * - Day/night cycle: sun position orbits based on timeOfDay (0-1)
 * - Season-dependent ambient and fog
 */

import { useFrame, useThree } from '@react-three/fiber';
import type React from 'react';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Season } from './TerrainGrid';

interface LightingProps {
  /** 0-1: 0=midnight, 0.25=dawn, 0.5=noon, 0.75=dusk */
  timeOfDay?: number;
  season?: Season;
  isStorm?: boolean;
}

/** Season multiplier for hemisphere light intensity */
function seasonBrightness(season: Season): number {
  switch (season) {
    case 'summer':
      return 1.15;
    case 'winter':
      return 0.85;
    case 'autumn':
      return 0.95;
    default:
      return 1.0;
  }
}

/** Sun intensity over 24h cycle. Peak at noon (timeOfDay=0.5), off at night. */
function sunIntensity(t: number): number {
  const angle = t * Math.PI * 2;
  const raw = Math.sin(angle - Math.PI / 2);
  return Math.max(0, raw) * 1.8;
}

/** Sun direction vector based on time. Rotates around the scene. */
function sunDirection(t: number): [number, number, number] {
  const angle = t * Math.PI * 2;
  const x = Math.cos(angle);
  const y = -Math.abs(Math.sin(angle)) - 0.3;
  const z = 0.3;
  const len = Math.sqrt(x * x + y * y + z * z);
  return [x / len, y / len, z / len];
}

/** Sun position for shadow casting (offset from origin along sun direction) */
function sunPosition(t: number): [number, number, number] {
  const dir = sunDirection(t);
  // Position the light source away from origin along the inverse direction
  return [-dir[0] * 40, -dir[1] * 40, -dir[2] * 40];
}

const FOG_COLOR = '#a6b8d1'; // (0.65, 0.72, 0.82)
const SHADOW_MAP_SIZE = 1024;
const SHADOW_CAMERA_SIZE = 50;

const Lighting: React.FC<LightingProps> = ({ timeOfDay = 0.5, season = 'summer', isStorm = false }) => {
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const { scene } = useThree();

  // Compute sun values
  const intensity = sunIntensity(timeOfDay);
  const position = sunPosition(timeOfDay);
  const _dir = sunDirection(timeOfDay);
  const hemiIntensity = 1.0 * seasonBrightness(season);

  // Storm dimming
  const stormMul = isStorm ? 0.5 : 1.0;

  // Fog density: very light by default, heavier at night and during storms
  const fogDensity = useMemo(() => {
    let density = 0.002;
    const nightFactor = 1 - sunIntensity(timeOfDay);
    density += nightFactor * 0.005;
    if (isStorm) density += 0.01;
    return density;
  }, [timeOfDay, isStorm]);

  // Update fog on the scene each frame (fog density is not easily animated via JSX)
  useFrame(() => {
    if (scene.fog && scene.fog instanceof THREE.FogExp2) {
      scene.fog.density = fogDensity;
    }
  });

  return (
    <>
      {/* Exponential fog for depth cueing */}
      <fogExp2 attach="fog" args={[FOG_COLOR, fogDensity]} />

      {/* Directional light (sun) — main light source with shadows */}
      <directionalLight
        ref={sunRef}
        position={position}
        intensity={intensity * stormMul}
        color="#fff5e0"
        castShadow
        shadow-mapSize-width={SHADOW_MAP_SIZE}
        shadow-mapSize-height={SHADOW_MAP_SIZE}
        shadow-camera-left={-SHADOW_CAMERA_SIZE}
        shadow-camera-right={SHADOW_CAMERA_SIZE}
        shadow-camera-top={SHADOW_CAMERA_SIZE}
        shadow-camera-bottom={-SHADOW_CAMERA_SIZE}
        shadow-camera-near={0.5}
        shadow-camera-far={200}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
      >
        {/* Point the directional light at origin */}
        <primitive object={new THREE.Object3D()} attach="target" position={[0, 0, 0]} />
      </directionalLight>

      {/* Hemispheric light — warm ambient fill */}
      <hemisphereLight ref={hemiRef} args={['#b3bfd9', '#594f47', hemiIntensity * stormMul]} position={[0, 50, 0]} />
    </>
  );
};

export default Lighting;

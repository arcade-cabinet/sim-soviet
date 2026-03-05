/**
 * Lighting — bright, inviting scene lighting with day/night cycle.
 *
 * R3F migration:
 * - <directionalLight> with castShadow for sun
 * - <hemisphereLight> for ambient fill
 * - <fog> for distance depth cueing
 * - Day/night cycle: sun position orbits based on timeOfDay (0-1)
 * - Season-dependent ambient and fog
 *
 * Shadow optimization: shadow camera tracks the main camera's target point
 * and covers a 25-unit radius around it at 2048px resolution. This gives
 * 4x higher shadow density where the player is actually looking.
 */

import { useFrame, useThree } from '@react-three/fiber';
import type React from 'react';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Season } from '../engine/WeatherSystem';

interface LightingProps {
  /** 0-1: 0=midnight, 0.25=dawn, 0.5=noon, 0.75=dusk */
  timeOfDay?: number;
  season?: Season;
  isStorm?: boolean;
  /** When true, dims lighting with an orange/grey wartime tint (great_patriotic era). */
  isWartime?: boolean;
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

const FOG_COLOR = '#a6b8d1'; // (0.65, 0.72, 0.82)
const SHADOW_MAP_SIZE = 2048;
const SHADOW_CAMERA_SIZE = 25;
const SUN_DISTANCE = 40;

/** Renders directional sun light with day/night cycle, hemispheric ambient fill, and distance fog. */
const Lighting: React.FC<LightingProps> = ({ timeOfDay = 0.5, season = 'summer', isStorm = false, isWartime = false }) => {
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const targetRef = useRef<THREE.Object3D>(null);
  const { scene, camera } = useThree();

  // Compute sun values
  const intensity = sunIntensity(timeOfDay);
  const dir = sunDirection(timeOfDay);
  const hemiIntensity = 1.0 * seasonBrightness(season);

  // Storm dimming
  const stormMul = isStorm ? 0.5 : 1.0;

  // Wartime dimming — 20% reduction, shifts sun color towards orange/grey
  const wartimeMul = isWartime ? 0.8 : 1.0;

  // Fog density: very light by default, heavier at night and during storms
  const fogDensity = useMemo(() => {
    let density = 0.002;
    const nightFactor = 1 - sunIntensity(timeOfDay);
    density += nightFactor * 0.005;
    if (isStorm) density += 0.01;
    if (isWartime) density += 0.003;
    return density;
  }, [timeOfDay, isStorm, isWartime]);

  // Track camera target with the shadow camera for high-resolution shadows
  useFrame(() => {
    if (scene.fog && scene.fog instanceof THREE.FogExp2) {
      scene.fog.density = fogDensity;
    }

    const sun = sunRef.current;
    const target = targetRef.current;
    if (!sun || !target) return;

    // Extract the camera's look-at point (where MapControls target is).
    // For a perspective camera, project a ray from camera center to the XZ ground plane.
    const cameraDir = new THREE.Vector3();
    camera.getWorldDirection(cameraDir);

    // Intersect camera ray with Y=0 plane to find ground focus point
    let focusX = camera.position.x;
    let focusZ = camera.position.z;
    if (cameraDir.y < -0.01) {
      const t = -camera.position.y / cameraDir.y;
      focusX = camera.position.x + cameraDir.x * t;
      focusZ = camera.position.z + cameraDir.z * t;
    }

    // Position directional light relative to focus point along sun direction
    sun.position.set(focusX - dir[0] * SUN_DISTANCE, -dir[1] * SUN_DISTANCE, focusZ - dir[2] * SUN_DISTANCE);

    // Point the light target at the focus point on the ground
    target.position.set(focusX, 0, focusZ);
    target.updateMatrixWorld();
  });

  return (
    <>
      {/* Exponential fog for depth cueing */}
      <fogExp2 attach="fog" args={[FOG_COLOR, fogDensity]} />

      {/* Directional light (sun) — shadows track camera focus */}
      <directionalLight
        ref={sunRef}
        intensity={intensity * stormMul * wartimeMul}
        color={isWartime ? '#e8c090' : '#fff5e0'}
        castShadow
        shadow-mapSize-width={SHADOW_MAP_SIZE}
        shadow-mapSize-height={SHADOW_MAP_SIZE}
        shadow-camera-left={-SHADOW_CAMERA_SIZE}
        shadow-camera-right={SHADOW_CAMERA_SIZE}
        shadow-camera-top={SHADOW_CAMERA_SIZE}
        shadow-camera-bottom={-SHADOW_CAMERA_SIZE}
        shadow-camera-near={0.5}
        shadow-camera-far={150}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
      >
        <primitive ref={targetRef} object={new THREE.Object3D()} attach="target" />
      </directionalLight>

      {/* Hemispheric light — warm ambient fill */}
      <hemisphereLight
        ref={hemiRef}
        args={[isWartime ? '#9a8a78' : '#b3bfd9', '#594f47', hemiIntensity * stormMul * wartimeMul]}
        position={[0, 50, 0]}
      />
    </>
  );
};

export default Lighting;

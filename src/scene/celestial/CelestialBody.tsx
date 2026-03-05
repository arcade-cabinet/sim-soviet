/**
 * CelestialBody — Procedural celestial body with sphere↔flat morphing.
 *
 * Renders Sun, Terran, Martian, or Jovian body types with terrain displacement.
 * The `flatten` prop (0–1) morphs between 3D sphere and UV-unrolled flat surface.
 */

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { bodyVertexShader, bodyFragmentShader, BODY_TYPE_VALUE, type CelestialBodyType } from './shaders';

/** Default ground tint (neutral white — no color shift). */
const DEFAULT_GROUND_TINT = new THREE.Color(1, 1, 1);

/** Terrain generation config from celestialBodies.json. */
export interface TerrainConfig {
  seed?: number;
  seaLevel?: number;
  mountainAmplitude?: number;
  noiseOctaves?: number;
  noiseScale?: number;
  continentBias?: number;
}

interface CelestialBodyProps {
  /** Which body type to render. */
  bodyType: CelestialBodyType;
  /** Morph factor: 0 = full sphere, 1 = flat UV-unrolled surface. */
  flatten: number;
  /** Body radius. Default 10. */
  radius?: number;
  /** Shell radius (for flat projection alignment). Default 12. */
  shellRadius?: number;
  /** Geometry detail. Default 128 segments. */
  segments?: number;
  /** Era-based ground tint color (hex string). Applied when flattened for close-up realism. */
  groundTint?: string;
  /** Terrain generation parameters. */
  terrain?: TerrainConfig;
}

const CelestialBody: React.FC<CelestialBodyProps> = ({
  bodyType,
  flatten,
  radius = 10,
  shellRadius = 12,
  segments = 128,
  groundTint,
  terrain,
}) => {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const tintColor = useMemo(
    () => (groundTint ? new THREE.Color(groundTint) : DEFAULT_GROUND_TINT),
    [groundTint],
  );

  // Extract terrain config with sensible defaults per body type
  const seed = terrain?.seed ?? 0;
  const seaLevel = terrain?.seaLevel ?? 0.4;
  const mountainAmplitude = terrain?.mountainAmplitude ?? 1.0;
  const noiseScale = terrain?.noiseScale ?? 1.5;
  const noiseOctaves = terrain?.noiseOctaves ?? 6;
  const continentBias = terrain?.continentBias ?? 0.0;

  const uniforms = useMemo(
    () => ({
      time: { value: 0 },
      uFlatten: { value: flatten },
      uBodyType: { value: BODY_TYPE_VALUE[bodyType] },
      uBodyRadius: { value: radius },
      uShellRadius: { value: shellRadius },
      uGroundTint: { value: tintColor.clone() },
      uSeed: { value: seed },
      uSeaLevel: { value: seaLevel },
      uMountainAmplitude: { value: mountainAmplitude },
      uNoiseScale: { value: noiseScale },
      uNoiseOctaves: { value: noiseOctaves },
      uContinentBias: { value: continentBias },
    }),
    // Intentionally static — uniforms updated in useFrame
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame((_, delta) => {
    if (!matRef.current) return;
    matRef.current.uniforms.time.value += delta;
    matRef.current.uniforms.uFlatten.value = flatten;
    matRef.current.uniforms.uBodyType.value = BODY_TYPE_VALUE[bodyType];
    matRef.current.uniforms.uBodyRadius.value = radius;
    matRef.current.uniforms.uShellRadius.value = shellRadius;
    matRef.current.uniforms.uGroundTint.value.copy(tintColor);
    matRef.current.uniforms.uSeed.value = seed;
    matRef.current.uniforms.uSeaLevel.value = seaLevel;
    matRef.current.uniforms.uMountainAmplitude.value = mountainAmplitude;
    matRef.current.uniforms.uNoiseScale.value = noiseScale;
    matRef.current.uniforms.uNoiseOctaves.value = noiseOctaves;
    matRef.current.uniforms.uContinentBias.value = continentBias;
  });

  return (
    <mesh>
      <sphereGeometry args={[radius, segments * 2, segments]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={bodyVertexShader}
        fragmentShader={bodyFragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
};

export default CelestialBody;

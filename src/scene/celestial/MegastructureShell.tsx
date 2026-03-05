/**
 * MegastructureShell — Hex-panel Dyson shell with build progress + sphere↔flat morph.
 *
 * Wraps around a CelestialBody. Build progress (0–1) reveals panels incrementally
 * with welding glow effects. 15% of panels are gaps showing the body underneath.
 */

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { shellVertexShader, shellFragmentShader } from './shaders';

interface MegastructureShellProps {
  /** Build progress: 0 = empty, 1 = fully constructed. */
  progress: number;
  /** Morph factor: 0 = sphere, 1 = flat. Must match CelestialBody.flatten. */
  flatten: number;
  /** Shell radius. Default 8.5 (larger than body radius of 7). */
  radius?: number;
  /** Whether shell is visible. */
  visible?: boolean;
  /** Geometry detail. Default 128 segments. */
  segments?: number;
}

const MegastructureShell: React.FC<MegastructureShellProps> = ({
  progress,
  flatten,
  radius = 8.5,
  visible = true,
  segments = 128,
}) => {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      time: { value: 0 },
      uProgress: { value: progress },
      uFlatten: { value: flatten },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame((_, delta) => {
    if (!matRef.current) return;
    matRef.current.uniforms.time.value += delta;
    matRef.current.uniforms.uProgress.value = progress;
    matRef.current.uniforms.uFlatten.value = flatten;
  });

  if (!visible) return null;

  return (
    <mesh>
      <sphereGeometry args={[radius, segments * 2, segments]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={shellVertexShader}
        fragmentShader={shellFragmentShader}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

export default MegastructureShell;

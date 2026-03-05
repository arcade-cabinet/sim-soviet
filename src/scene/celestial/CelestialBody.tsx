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

interface CelestialBodyProps {
  /** Which body type to render. */
  bodyType: CelestialBodyType;
  /** Morph factor: 0 = full sphere, 1 = flat UV-unrolled surface. */
  flatten: number;
  /** Body radius. Default 7. */
  radius?: number;
  /** Shell radius (for flat projection alignment). Default 8.5. */
  shellRadius?: number;
  /** Geometry detail. Default 128 segments. */
  segments?: number;
}

const CelestialBody: React.FC<CelestialBodyProps> = ({
  bodyType,
  flatten,
  radius = 7,
  shellRadius = 8.5,
  segments = 128,
}) => {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      time: { value: 0 },
      uFlatten: { value: flatten },
      uBodyType: { value: BODY_TYPE_VALUE[bodyType] },
      uShellRadius: { value: shellRadius },
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
    matRef.current.uniforms.uShellRadius.value = shellRadius;
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

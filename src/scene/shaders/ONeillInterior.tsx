/**
 * ONeillInterior — Procedural environment for O'Neill cylinder habitat interior.
 *
 * Renders the inside of a rotating cylinder habitat:
 * - Artificial sun stripe running along the central axis
 * - Curved landscape wrapping overhead (you can see the "ground" above you)
 * - Alternating land strips and window panels
 * - Atmospheric haze increasing with distance
 *
 * Based on the Stanford Torus / O'Neill cylinder concepts.
 * Used for solar_engineering sub-era settlements.
 */

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = `
  varying vec3 vDirection;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vDirection = normalize(position);
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform float uCylinderRadius;
  uniform float uSunStripeWidth;
  uniform vec3 uLandColor;
  uniform vec3 uWindowColor;
  uniform int uNumStrips;

  varying vec3 vDirection;

  #define PI 3.14159265359

  void main() {
    // Convert direction to cylindrical coordinates
    // The cylinder axis is along Z (looking down the length of the habitat)
    float angle = atan(vDirection.y, vDirection.x); // -PI to PI
    float elevation = vDirection.y;
    float azimuth = atan(vDirection.x, vDirection.z);

    // Normalized angle (0-1 around the cylinder)
    float normalizedAngle = (angle + PI) / (2.0 * PI);

    // Sun stripe — bright line along the central axis (top of sky dome)
    float sunDist = abs(elevation - 1.0);
    float sunStripe = smoothstep(uSunStripeWidth + 0.05, uSunStripeWidth, sunDist);
    vec3 sunColor = vec3(1.0, 0.98, 0.9) * sunStripe * 2.0;

    // Alternating land and window strips
    float stripIndex = normalizedAngle * float(uNumStrips);
    float stripFrac = fract(stripIndex);
    bool isLand = mod(floor(stripIndex), 2.0) < 1.0;

    // Land strips: green-brown terrain visible curving overhead
    // Window strips: transparent panels showing stars (dark)
    vec3 stripColor;
    if (isLand) {
      // Variation within land strips
      float terrainNoise = fract(sin(stripIndex * 43.7) * 1753.0);
      stripColor = mix(uLandColor, uLandColor * 0.7, terrainNoise);
      // Add tiny building silhouettes on the overhead land
      float buildingLine = step(0.48, stripFrac) * step(stripFrac, 0.52);
      stripColor = mix(stripColor, stripColor * 0.5, buildingLine);
    } else {
      // Window panels — dark with star points
      stripColor = uWindowColor;
      // Sparse star field through windows
      float starHash = fract(sin(dot(vec2(normalizedAngle * 100.0, azimuth * 50.0), vec2(12.9898, 78.233))) * 43758.5453);
      if (starHash > 0.998) {
        stripColor += vec3(0.8) * (starHash - 0.998) * 500.0;
      }
    }

    // Edge transition between strips
    float edgeSoftness = smoothstep(0.0, 0.05, stripFrac) * smoothstep(1.0, 0.95, stripFrac);
    stripColor *= edgeSoftness;

    // Atmospheric haze — increases toward "horizon" (side of cylinder)
    float haze = (1.0 - abs(elevation)) * 0.3;
    vec3 hazeColor = vec3(0.6, 0.7, 0.85);

    // Combine: sun stripe + land/window strips + haze
    vec3 finalColor = stripColor * (1.0 - haze) + hazeColor * haze + sunColor;

    // Subtle rotation hint (the world is spinning)
    float spin = sin(uTime * 0.02 + normalizedAngle * PI * 2.0) * 0.02;
    finalColor += vec3(spin);

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

interface ONeillInteriorProps {
  /** Number of alternating land/window strips. Default 6 (3 land, 3 window). */
  numStrips?: number;
  /** Land color. Default green-brown. */
  landColor?: string;
}

const ONeillInterior: React.FC<ONeillInteriorProps> = ({
  numStrips = 6,
  landColor = '#3a5a2a',
}) => {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uCylinderRadius: { value: 100 },
      uSunStripeWidth: { value: 0.15 },
      uLandColor: { value: new THREE.Color(landColor) },
      uWindowColor: { value: new THREE.Color('#050510') },
      uNumStrips: { value: numStrips },
    }),
    [numStrips, landColor],
  );

  useFrame((_, delta) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value += delta;
    }
  });

  return (
    <mesh>
      <sphereGeometry args={[500, 64, 32]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
};

export default ONeillInterior;

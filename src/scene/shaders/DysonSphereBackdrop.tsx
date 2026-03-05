/**
 * DysonSphereBackdrop — Procedural environment for settlements on a Dyson swarm.
 *
 * Renders a curved metal panel surface stretching to the horizon with the Sun
 * visible through gaps between panels. Used as sky/environment when the active
 * settlement is on a Dyson swarm or megastructure.
 *
 * Visual concept:
 * - Ground plane: tiled hexagonal metal panels with seam lines
 * - Horizon: panels curve upward (concave interior of sphere)
 * - Sky: dark void with bright Sun glow at zenith
 * - Gaps between panels: Sun light bleeds through, creating god-ray strips
 * - Floating building clusters visible in middle distance
 */

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying float vDistFromCenter;

  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vDistFromCenter = length(position.xz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform vec3 uSunColor;
  uniform float uPanelScale;
  uniform float uGapWidth;

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying float vDistFromCenter;

  // Hexagonal grid distance
  float hexDist(vec2 p) {
    p = abs(p);
    return max(dot(p, normalize(vec2(1.0, 1.73))), p.x);
  }

  vec4 hexCoords(vec2 uv) {
    vec2 r = vec2(1.0, 1.73);
    vec2 h = r * 0.5;
    vec2 a = mod(uv, r) - h;
    vec2 b = mod(uv - h, r) - h;
    vec2 gv = length(a) < length(b) ? a : b;
    float edge = 0.5 - hexDist(gv);
    return vec4(gv, edge, 0.0);
  }

  void main() {
    // Hex panel grid
    vec2 panelUV = vWorldPos.xz * uPanelScale;
    vec4 hex = hexCoords(panelUV);

    // Panel edge glow (seam lines between panels)
    float seamLine = smoothstep(uGapWidth + 0.02, uGapWidth, hex.z);

    // Base panel color — dark gunmetal with subtle variation
    float panelNoise = fract(sin(dot(floor(panelUV), vec2(12.9898, 78.233))) * 43758.5453);
    vec3 panelColor = mix(vec3(0.12, 0.13, 0.15), vec3(0.18, 0.19, 0.21), panelNoise);

    // Sun bleed through gaps
    vec3 gapGlow = uSunColor * seamLine * 0.8;

    // Distance fade — panels curve away into darkness at horizon
    float horizonFade = smoothstep(80.0, 20.0, vDistFromCenter);

    // Combine
    vec3 color = mix(vec3(0.02, 0.02, 0.03), panelColor + gapGlow, horizonFade);

    // Subtle pulsing from solar energy collection
    float pulse = 0.95 + 0.05 * sin(uTime * 0.3 + panelNoise * 6.28);
    color *= pulse;

    gl_FragColor = vec4(color, 1.0);
  }
`;

interface DysonSphereBackdropProps {
  /** Sun color tint. Default warm white. */
  sunColor?: THREE.Color | string;
  /** Scale of hex panel grid. Smaller = bigger panels. */
  panelScale?: number;
}

const DysonSphereBackdrop: React.FC<DysonSphereBackdropProps> = ({
  sunColor = '#ffe8b0',
  panelScale = 0.15,
}) => {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSunColor: { value: new THREE.Color(sunColor) },
      uPanelScale: { value: panelScale },
      uGapWidth: { value: 0.03 },
    }),
    [sunColor, panelScale],
  );

  useFrame((_, delta) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value += delta;
    }
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
      <planeGeometry args={[200, 200, 1, 1]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

export default DysonSphereBackdrop;

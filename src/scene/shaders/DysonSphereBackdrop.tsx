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
  precision highp float;

  uniform float uTime;
  uniform vec3 uSunColor;
  uniform float uPanelScale;
  uniform float uGapWidth;

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying float vDistFromCenter;

  // ── Noise functions (from 21st.dev CelestialSphere pattern) ──────────────
  float hash(vec2 p) {
    p = fract(p * vec2(443.897, 441.423));
    p += dot(p, p.yx + 19.19);
    return fract((p.x + p.y) * p.x);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0, amp = 0.5;
    for (int i = 0; i < 5; i++) {
      v += amp * noise(p);
      p *= 2.0;
      amp *= 0.5;
    }
    return v;
  }

  // ── Hexagonal grid ───────────────────────────────────────────────────────
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
    vec2 panelUV = vWorldPos.xz * uPanelScale;
    vec4 hex = hexCoords(panelUV);

    // Panel edge glow — energy seams between panels
    float seamLine = smoothstep(uGapWidth + 0.02, uGapWidth, hex.z);

    // Base panel color — dark gunmetal with FBM-driven microvariation
    float panelId = hash(floor(panelUV));
    float microDetail = fbm(panelUV * 8.0 + panelId * 100.0) * 0.08;
    vec3 panelColor = mix(
      vec3(0.10, 0.11, 0.13),
      vec3(0.16, 0.17, 0.20),
      panelId
    ) + microDetail;

    // Energy flow — FBM-driven luminous veins pulsing through panel seams
    float energyFlow = fbm(panelUV * 3.0 + vec2(uTime * 0.15, uTime * 0.08));
    float energyVeins = smoothstep(0.45, 0.55, energyFlow) * seamLine;
    vec3 energyColor = uSunColor * energyVeins * 1.5;

    // Sun bleed through panel gaps
    vec3 gapGlow = uSunColor * seamLine * 0.6;

    // Starfield visible through gaps (sparse, bright)
    float starHash = hash(panelUV * 200.0);
    float starPoint = step(0.9985, starHash) * seamLine;
    vec3 stars = vec3(starPoint * 2.0);

    // Distance fade — panels curve into darkness at horizon
    float horizonFade = smoothstep(90.0, 15.0, vDistFromCenter);

    // Atmospheric haze at distance (Dyson interior has thin captured atmosphere)
    float haze = (1.0 - horizonFade) * 0.15;
    vec3 hazeColor = uSunColor * 0.3;

    // Combine all layers
    vec3 color = panelColor + gapGlow + energyColor + stars;
    color = mix(hazeColor, color, horizonFade);

    // Solar collection pulse — panels brighten rhythmically as they harvest
    float pulse = 0.93 + 0.07 * sin(uTime * 0.2 + panelId * 6.28);
    color *= pulse;

    // Vignette — subtle darkening at edges of view
    float vig = 1.0 - smoothstep(50.0, 95.0, vDistFromCenter) * 0.4;
    color *= vig;

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

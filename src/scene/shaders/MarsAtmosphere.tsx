/**
 * MarsAtmosphere — Procedural Martian sky shader.
 *
 * Renders the butterscotch/salmon sky of Mars based on Rayleigh scattering
 * in a thin CO2 atmosphere. Transitions from red (thin atmosphere, early Mars)
 * to blue (thick atmosphere, fully terraformed Blue Mars) based on
 * terraformingProgress (0-1).
 *
 * Based on real Mars sky colors from Curiosity/Perseverance imagery:
 * - Red Mars: butterscotch overhead, pink-white at horizon
 * - Green Mars: salmon overhead, pale blue at horizon
 * - Blue Mars: Earth-like blue with warmer sunset tones
 */

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = `
  varying vec3 vWorldPosition;
  varying vec3 vDirection;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vDirection = normalize(position);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = `
  uniform float uTerraformProgress; // 0=Red Mars, 0.5=Green Mars, 1.0=Blue Mars
  uniform float uTime;
  uniform vec3 uSunDirection;

  varying vec3 vDirection;

  // Mars sky colors at different terraforming stages
  vec3 redMarsZenith   = vec3(0.76, 0.55, 0.35); // butterscotch
  vec3 redMarsHorizon  = vec3(0.85, 0.75, 0.65); // pale pink-white
  vec3 greenMarsZenith = vec3(0.65, 0.50, 0.40); // salmon
  vec3 greenMarsHorizon = vec3(0.55, 0.65, 0.75); // pale blue
  vec3 blueMarsZenith  = vec3(0.35, 0.55, 0.80); // Earth-like blue
  vec3 blueMarsHorizon = vec3(0.70, 0.60, 0.50); // warm horizon

  void main() {
    float elevation = vDirection.y; // -1 to 1 (horizon to zenith)
    float t = clamp(elevation * 0.5 + 0.5, 0.0, 1.0); // 0=horizon, 1=zenith

    // Interpolate sky colors based on terraforming progress
    vec3 zenithColor, horizonColor;
    if (uTerraformProgress < 0.5) {
      float p = uTerraformProgress * 2.0;
      zenithColor = mix(redMarsZenith, greenMarsZenith, p);
      horizonColor = mix(redMarsHorizon, greenMarsHorizon, p);
    } else {
      float p = (uTerraformProgress - 0.5) * 2.0;
      zenithColor = mix(greenMarsZenith, blueMarsZenith, p);
      horizonColor = mix(greenMarsHorizon, blueMarsHorizon, p);
    }

    vec3 skyColor = mix(horizonColor, zenithColor, t);

    // Sun disc (smaller than Earth — Mars is 1.5 AU)
    float sunAngle = dot(vDirection, uSunDirection);
    float sunDisc = smoothstep(0.9995, 0.9999, sunAngle);
    float sunGlow = pow(max(0.0, sunAngle), 128.0) * 0.3;

    // Sun is white-blue on Mars (less atmospheric reddening than Earth)
    vec3 sunColor = mix(vec3(1.0, 0.95, 0.9), vec3(1.0, 1.0, 1.0), uTerraformProgress);

    // Dust haze at horizon (less as terraforming progresses)
    float dustHaze = (1.0 - uTerraformProgress) * 0.3 * (1.0 - t);
    skyColor += vec3(0.8, 0.6, 0.4) * dustHaze;

    // Combine
    vec3 finalColor = skyColor + sunColor * (sunDisc + sunGlow);

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

interface MarsAtmosphereProps {
  /** 0 = Red Mars, 0.5 = Green Mars, 1.0 = Blue Mars */
  terraformingProgress?: number;
  /** Sun direction vector. Default: overhead. */
  sunDirection?: [number, number, number];
}

const MarsAtmosphere: React.FC<MarsAtmosphereProps> = ({
  terraformingProgress = 0,
  sunDirection = [0.3, 0.8, 0.2],
}) => {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTerraformProgress: { value: terraformingProgress },
      uTime: { value: 0 },
      uSunDirection: { value: new THREE.Vector3(...sunDirection).normalize() },
    }),
    [terraformingProgress, sunDirection],
  );

  useFrame((_, delta) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value += delta;
      matRef.current.uniforms.uTerraformProgress.value = terraformingProgress;
    }
  });

  return (
    <mesh>
      <sphereGeometry args={[500, 32, 32]} />
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

export default MarsAtmosphere;

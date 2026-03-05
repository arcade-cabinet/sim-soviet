/**
 * CelestialViewport — Unified viewport for any celestial body with zoom-to-surface morphing.
 *
 * Composes CelestialBody + MegastructureShell into a single viewport that:
 * 1. Shows the full 3D sphere when zoomed out (orbital view)
 * 2. Morphs to flat surface as camera zooms in (settlement view)
 * 3. Optionally shows Dyson shell with build progress
 *
 * The flatten value is driven by camera distance — as the user zooms in,
 * the sphere smoothly unrolls into a flat plane for settlement gameplay.
 *
 * Zoom levels:
 * - distance > 20: full sphere (flatten = 0)
 * - 20 > distance > 12: morphing zone (flatten interpolated)
 * - distance < 12: fully flat (flatten = 1) — settlement placement mode
 */

import React, { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import CelestialBody from './CelestialBody';
import MegastructureShell from './MegastructureShell';
import type { CelestialBodyType } from './shaders';

interface CelestialViewportProps {
  /** Which celestial body to render. */
  bodyType: CelestialBodyType;
  /** Dyson shell build progress (0–1). Set to 0 or omit to hide shell. */
  shellProgress?: number;
  /** Whether the Dyson shell is visible. */
  shellVisible?: boolean;
  /** Override flatten value (0–1). If omitted, auto-computed from camera distance. */
  flattenOverride?: number;
  /** Body radius. Default 7. */
  bodyRadius?: number;
  /** Shell radius. Default 8.5. */
  shellRadius?: number;
  /** Auto-rotate speed (radians/sec). Set to 0 to disable. */
  rotateSpeed?: number;
  /** Zoom distance thresholds for auto-flatten. */
  flattenNear?: number;
  flattenFar?: number;
  /** Callback when flatten state changes (for UI updates). */
  onFlattenChange?: (flatten: number) => void;
}

const CelestialViewport: React.FC<CelestialViewportProps> = ({
  bodyType,
  shellProgress = 0,
  shellVisible = false,
  flattenOverride,
  bodyRadius = 7,
  shellRadius = 8.5,
  rotateSpeed = 0.015,
  flattenNear = 12,
  flattenFar = 20,
  onFlattenChange,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const [flatten, setFlatten] = useState(0);
  const { camera } = useThree();

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Auto-flatten based on camera distance
    let f: number;
    if (flattenOverride !== undefined) {
      f = flattenOverride;
    } else {
      const dist = camera.position.length();
      f = 1 - THREE.MathUtils.clamp((dist - flattenNear) / (flattenFar - flattenNear), 0, 1);
    }

    if (f !== flatten) {
      setFlatten(f);
      onFlattenChange?.(f);
    }

    // Auto-rotate (slows as flattening increases)
    const rotMult = 1 - f;
    groupRef.current.rotation.y += rotateSpeed * rotMult * delta * 60;
    groupRef.current.rotation.z += rotateSpeed * 0.3 * rotMult * delta * 60;
  });

  return (
    <group ref={groupRef}>
      <CelestialBody
        bodyType={bodyType}
        flatten={flatten}
        radius={bodyRadius}
        shellRadius={shellRadius}
      />
      <MegastructureShell
        progress={shellProgress}
        flatten={flatten}
        radius={shellRadius}
        visible={shellVisible && shellProgress > 0}
      />
    </group>
  );
};

export default CelestialViewport;
export type { CelestialViewportProps };

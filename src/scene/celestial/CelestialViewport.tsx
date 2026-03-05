/**
 * CelestialViewport — Unified viewport for any celestial body with zoom-to-surface morphing.
 *
 * Composes CelestialBody + MegastructureShell into a single viewport that:
 * 1. Shows the full 3D sphere when zoomed out (orbital view)
 * 2. Morphs to flat surface as camera zooms in (settlement view)
 * 3. Optionally shows Dyson shell with build progress
 *
 * The flatten value is driven by camera distance to the group's world position —
 * as the user zooms in, the sphere smoothly unrolls into a flat plane for
 * settlement gameplay. When used as the primary ground surface, the group should
 * be positioned at the grid center and rotated so the flat projection aligns
 * with the XZ ground plane.
 *
 * Zoom levels (default thresholds):
 * - distance > flattenFar: full sphere (flatten = 0)
 * - flattenFar > distance > flattenNear: morphing zone (flatten interpolated)
 * - distance < flattenNear: fully flat (flatten = 1) — settlement placement mode
 */

import React, { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import CelestialBody from './CelestialBody';
import MegastructureShell from './MegastructureShell';
import type { CelestialBodyType } from './shaders';

/** Reusable vector for distance calculation (avoids per-frame allocation). */
const _groupWorldPos = new THREE.Vector3();

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
  /** Zoom distance thresholds for auto-flatten (camera-to-group distance). */
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
  flattenFar = 25,
  onFlattenChange,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const [flatten, setFlatten] = useState(0);
  const { camera } = useThree();

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Auto-flatten based on camera distance to the group's world position
    // (not distance from origin — the group may be offset to grid center)
    let f: number;
    if (flattenOverride !== undefined) {
      f = flattenOverride;
    } else {
      groupRef.current.getWorldPosition(_groupWorldPos);
      const dist = camera.position.distanceTo(_groupWorldPos);
      f = 1 - THREE.MathUtils.clamp((dist - flattenNear) / (flattenFar - flattenNear), 0, 1);
    }

    if (f !== flatten) {
      setFlatten(f);
      onFlattenChange?.(f);
    }

    // Auto-rotate (slows as flattening increases — fully stopped when flat)
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

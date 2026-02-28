import { useXRHitTest } from '@react-three/xr';
import type React from 'react';
import { useRef } from 'react';
import * as THREE from 'three/webgpu';

const matrixHelper = new THREE.Matrix4();

/**
 * AR Tabletop — places the 30x30 city grid as a ~60cm physical model.
 * Uses hit-testing to anchor on a detected surface.
 *
 * Works on: Android Chrome (WebXR AR), Quest 3 passthrough.
 * Does NOT work on: iOS Safari (no WebXR support).
 */
const ARTabletop: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const groupRef = useRef<THREE.Group>(null);
  const placed = useRef(false);

  useXRHitTest((results, getWorldMatrix) => {
    if (groupRef.current && !placed.current && results.length > 0) {
      getWorldMatrix(matrixHelper, results[0]);
      groupRef.current.position.setFromMatrixPosition(matrixHelper);
      // Scale 30-unit grid to ~0.6m (2cm per tile)
      groupRef.current.scale.setScalar(0.02);
      placed.current = true;
    }
  }, 'viewer');

  return <group ref={groupRef}>{children}</group>;
};

export default ARTabletop;

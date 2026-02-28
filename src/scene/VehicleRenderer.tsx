/**
 * VehicleRenderer -- Cars on roads using instancedMesh.
 *
 * Reads gameState.traffic[] array. Each vehicle = small colored box (0.3 x 0.15 x 0.2)
 * positioned at (v.x, 0.1, v.y). Color from vehicle.color property.
 * Uses <instancedMesh> for GPU-batched rendering.
 *
 * R3F migration: uses <instancedMesh> with useFrame to update instance
 * matrices and colors each frame.
 */

import { useFrame } from '@react-three/fiber';
import type React from 'react';
import { useMemo, useRef } from 'react';
import * as THREE from 'three/webgpu';

import { gameState } from '../engine/GameState';

/** Max number of vehicle instances to allocate */
const MAX_VEHICLES = 200;

/** Parse a hex color string to THREE.Color */
function _hexToColor(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

const VehicleRenderer: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // Shared geometry and material
  const geometry = useMemo(() => new THREE.BoxGeometry(0.3, 0.15, 0.2), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4d4d4d' }), []);

  // Temp objects for matrix composition (avoid GC pressure)
  const tmpMatrix = useMemo(() => new THREE.Matrix4(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const traffic = gameState.traffic;
    if (traffic.length === 0) {
      mesh.count = 0;
      return;
    }

    const count = Math.min(traffic.length, MAX_VEHICLES);
    mesh.count = count;

    for (let i = 0; i < count; i++) {
      const v = traffic[i];

      // Set transform matrix (position only, no rotation/scale for perf)
      tmpMatrix.makeTranslation(v.x, 0.1, v.y);
      mesh.setMatrixAt(i, tmpMatrix);

      // Set per-instance color
      tmpColor.set(v.color);
      mesh.setColorAt(i, tmpColor);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return <instancedMesh ref={meshRef} args={[geometry, material, MAX_VEHICLES]} frustumCulled={false} />;
};

export default VehicleRenderer;

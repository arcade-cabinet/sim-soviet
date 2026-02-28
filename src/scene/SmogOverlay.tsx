/**
 * SmogOverlay — Per-tile smog visualization using instancedMesh.
 *
 * For each grid cell with smog > threshold: renders a semi-transparent
 * green-amber box. Color transitions from muted green (low smog) to
 * warm amber (high smog). Alpha scales with smog intensity (quadratic).
 *
 * R3F migration: uses <instancedMesh> for GPU-batched smog tiles.
 * Instance matrices and colors are updated via useEffect when smog data changes.
 */

import { useFrame } from '@react-three/fiber';
import type React from 'react';
import { useMemo, useRef } from 'react';
import * as THREE from 'three/webgpu';

import { gameState } from '../engine/GameState';
import { GRID_SIZE } from '../engine/GridTypes';

/** Minimum smog value to render (skip nearly-clean cells) */
const SMOG_THRESHOLD = 8;

/** Max possible smog tiles (GRID_SIZE * GRID_SIZE) */
const MAX_INSTANCES = GRID_SIZE * GRID_SIZE;

/** Lerp between muted green and warm amber based on smog ratio */
function smogColor(ratio: number): [number, number, number] {
  // Muted green (0.2,0.4,0.1) -> Warm yellow (0.6,0.5,0.1) -> Amber (0.7,0.3,0.05)
  if (ratio < 0.5) {
    const t = ratio * 2;
    return [0.2 + t * 0.4, 0.4 + t * 0.1, 0.1];
  }
  const t = (ratio - 0.5) * 2;
  return [0.6 + t * 0.1, 0.5 - t * 0.2, 0.1 - t * 0.05];
}

const SmogOverlay: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const prevCountRef = useRef(0);

  // Shared geometry and material
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 0.5, 1), []);
  const material = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    return mat;
  }, []);

  // Temp objects for matrix composition
  const tmpMatrix = useMemo(() => new THREE.Matrix4(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);
  const tmpPos = useMemo(() => new THREE.Vector3(), []);
  const tmpScale = useMemo(() => new THREE.Vector3(), []);
  const tmpQuat = useMemo(() => new THREE.Quaternion(), []);

  // Update instances each frame by scanning the grid
  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const grid = gameState.grid;
    if (!grid.length) {
      mesh.count = 0;
      return;
    }

    let instanceIdx = 0;

    for (let y = 0; y < GRID_SIZE; y++) {
      const row = grid[y];
      if (!row) continue;
      for (let x = 0; x < GRID_SIZE; x++) {
        const cell = row[x];
        if (!cell || cell.smog < SMOG_THRESHOLD) continue;

        const ratio = Math.min(1.0, cell.smog / 100);
        const intensity = ratio * ratio; // quadratic falloff
        const height = 0.2 + intensity * 0.8;
        const spread = 0.5 + ratio * 0.5;

        tmpPos.set(x + 0.5, (cell.z ?? 0) * 0.5 + height / 2, y + 0.5);
        tmpScale.set(spread, height, spread);
        tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
        mesh.setMatrixAt(instanceIdx, tmpMatrix);

        // Per-instance color
        const [cr, cg, cb] = smogColor(ratio);
        tmpColor.setRGB(cr, cg, cb);
        mesh.setColorAt(instanceIdx, tmpColor);

        instanceIdx++;
      }
    }

    mesh.count = instanceIdx;

    if (instanceIdx > 0) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
      }
    }

    prevCountRef.current = instanceIdx;
  });

  return <instancedMesh ref={meshRef} args={[geometry, material, MAX_INSTANCES]} frustumCulled={false} />;
};

export default SmogOverlay;

/**
 * PermafrostOverlay — visual effects for climate milestones.
 *
 * When the permafrost_collapse cold branch fires (year 2050+):
 * - Translucent blue puddle planes appear across the terrain
 * - Ground tint shifts to wet brown-grey (handled by terrainEraMapping)
 *
 * When the siberian_exodus cold branch fires (year 2100+):
 * - Dust particle system across the scene
 * - Vegetation fade (handled by reducing tree opacity upstream)
 *
 * Uses instanced meshes for performance (single draw call for all puddles).
 */

import { useFrame } from '@react-three/fiber';
import type React from 'react';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { GridCell } from '../engine/GridTypes';
import { getCurrentGridSize } from '../engine/GridTypes';
import { gameState } from '../engine/GameState';
import { useClimateMilestones } from '../stores/gameStore';

/** Seeded PRNG for deterministic puddle placement */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PUDDLE_GEOMETRY = new THREE.CircleGeometry(1, 8);
const DUST_COUNT = 200;

// Temp objects for instance matrix construction
const _tmpPos = new THREE.Vector3();
const _tmpQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
const _tmpScale = new THREE.Vector3();

/**
 * Build instanced puddle placement data from the grid.
 * Puddles appear on grass, path, and marsh tiles.
 */
function buildPuddleMatrices(grid: GridCell[][]): THREE.Matrix4[] {
  const matrices: THREE.Matrix4[] = [];
  const rng = mulberry32(0xde_ad_be_ef);
  const gridSize = grid.length;

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const cell = grid[row]?.[col];
      if (!cell) continue;

      const terrain = cell.terrain;
      if (terrain !== 'grass' && terrain !== 'path' && terrain !== 'marsh') continue;

      // ~15% chance per eligible tile
      if (rng() > 0.15) continue;

      const y = cell.z * 0.5 + 0.02; // slightly above ground
      const radius = 0.15 + rng() * 0.35;
      const ox = col + 0.2 + rng() * 0.6;
      const oz = row + 0.2 + rng() * 0.6;

      _tmpPos.set(ox, y, oz);
      _tmpScale.set(radius, radius, radius);
      const mat = new THREE.Matrix4();
      mat.compose(_tmpPos, _tmpQuat, _tmpScale);
      matrices.push(mat);
    }
  }

  return matrices;
}

/** Puddle water material — translucent blue-grey */
const PUDDLE_COLOR = new THREE.Color(0x4477aa);

/** Instanced puddle overlay — appears when permafrost collapses */
const PuddleOverlay: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const matrices = useMemo(() => {
    const grid = gameState.grid;
    if (!grid.length) return [];
    return buildPuddleMatrices(grid);
  }, []);

  // Apply matrices to instanced mesh
  useMemo(() => {
    const mesh = meshRef.current;
    if (!mesh || matrices.length === 0) return;

    for (let i = 0; i < matrices.length; i++) {
      mesh.setMatrixAt(i, matrices[i]);
      mesh.setColorAt(i, PUDDLE_COLOR);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [matrices]);

  if (matrices.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[PUDDLE_GEOMETRY, undefined, matrices.length]} frustumCulled={false}>
      <meshStandardMaterial
        color={PUDDLE_COLOR}
        transparent
        opacity={0.5}
        depthWrite={false}
        roughness={0.1}
        metalness={0.3}
      />
    </instancedMesh>
  );
};

/** Dust particle system — drifting particles for siberian exodus */
const DustParticles: React.FC = () => {
  const pointsRef = useRef<THREE.Points>(null);
  const gridSize = getCurrentGridSize();
  const center = gridSize / 2;

  // Create particle positions
  const positions = useMemo(() => {
    const rng = mulberry32(0xd0_57_ca_fe);
    const arr = new Float32Array(DUST_COUNT * 3);
    for (let i = 0; i < DUST_COUNT; i++) {
      arr[i * 3] = center + (rng() - 0.5) * gridSize * 1.5;
      arr[i * 3 + 1] = 0.5 + rng() * 5;
      arr[i * 3 + 2] = center + (rng() - 0.5) * gridSize * 1.5;
    }
    return arr;
  }, [center, gridSize]);

  // Animate particles — slow horizontal drift
  useFrame((_, delta) => {
    const points = pointsRef.current;
    if (!points) return;

    const posAttr = points.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    for (let i = 0; i < DUST_COUNT; i++) {
      // Drift horizontally
      arr[i * 3] += delta * 0.3;
      // Gentle vertical oscillation
      arr[i * 3 + 1] += Math.sin(arr[i * 3] * 0.5) * delta * 0.1;

      // Wrap around when out of bounds
      if (arr[i * 3] > center + gridSize) {
        arr[i * 3] = center - gridSize;
      }
    }

    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#8a7a60"
        size={0.15}
        transparent
        opacity={0.4}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
};

/**
 * Renders climate milestone visual effects.
 * - permafrost_collapse / ecological_permafrost_collapse: puddle overlay
 * - siberian_exodus: dust particles
 */
const PermafrostOverlay: React.FC = () => {
  const milestones = useClimateMilestones();

  const hasPermafrost = milestones.has('permafrost_collapse') || milestones.has('ecological_permafrost_collapse');
  const hasExodus = milestones.has('siberian_exodus');

  if (!hasPermafrost && !hasExodus) return null;

  return (
    <>
      {hasPermafrost && <PuddleOverlay />}
      {hasExodus && <DustParticles />}
    </>
  );
};

export default PermafrostOverlay;

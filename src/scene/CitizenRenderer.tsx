/**
 * CitizenRenderer — 3D visualization of citizens using instancedMesh.
 *
 * Reads renderable citizens from the ECS (position + citizen + renderSlot)
 * and renders each as a small colored sphere. Color is based on citizen class:
 *   worker = brown, farmer = green, miner/engineer = gray, party_official = red,
 *   soldier = dark brown, prisoner = gray.
 *
 * Uses instancedMesh for GPU-batched rendering (could be 100+ citizens).
 * Subtle idle bob animation via useFrame (sine wave on Y axis).
 */

import { useFrame } from '@react-three/fiber';
import type React from 'react';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

import { renderableCitizens } from '../ecs/archetypes';

/** Max citizen instances to allocate. */
const MAX_CITIZENS = 500;

/** Citizen class -> color for 3D rendering. */
const CLASS_COLORS: Record<string, string> = {
  worker: '#8d6e63',
  farmer: '#66bb6a',
  engineer: '#78909c',
  party_official: '#c62828',
  soldier: '#4e342e',
  prisoner: '#616161',
};

/** Renders citizens as GPU-batched colored spheres with idle bob animation. */
const CitizenRenderer: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const timeRef = useRef(0);

  const geometry = useMemo(() => new THREE.SphereGeometry(0.15, 8, 6), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.8 }), []);

  const tmpMatrix = useMemo(() => new THREE.Matrix4(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);
  const tmpPos = useMemo(() => new THREE.Vector3(), []);
  const tmpScale = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const tmpQuat = useMemo(() => new THREE.Quaternion(), []);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    timeRef.current += delta;

    const entities = renderableCitizens.entities;
    const count = Math.min(entities.length, MAX_CITIZENS);
    mesh.count = count;

    if (count === 0) return;

    for (let i = 0; i < count; i++) {
      const entity = entities[i];
      const { gridX, gridY } = entity.position;

      // Subtle idle bob: each citizen has a unique phase offset based on index
      const bob = Math.sin(timeRef.current * 2 + i * 0.7) * 0.05;

      tmpPos.set(gridX + 0.5, 0.2 + bob, gridY + 0.5);
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
      mesh.setMatrixAt(i, tmpMatrix);

      const colorHex = CLASS_COLORS[entity.citizen.class] ?? '#757575';
      tmpColor.set(colorHex);
      mesh.setColorAt(i, tmpColor);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  });

  return <instancedMesh ref={meshRef} args={[geometry, material, MAX_CITIZENS]} frustumCulled={false} castShadow />;
};

export default CitizenRenderer;

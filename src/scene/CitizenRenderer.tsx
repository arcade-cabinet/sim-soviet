/**
 * CitizenRenderer — 3D visualization of citizens using instancedMesh.
 *
 * Dual-mode rendering:
 *
 * **Entity mode** (raion undefined): Reads renderable citizens from the ECS
 * (position + citizen + renderSlot) and renders each as a small colored sphere.
 *
 * **Aggregate mode** (raion defined, totalPopulation > 200): Renders
 * min(raion.idleWorkers, 500) instances scattered near housing buildings.
 * Workers INSIDE buildings are invisible — only idle workers loiter outside.
 *
 * Uses instancedMesh for GPU-batched rendering (up to 500 citizens).
 * Subtle idle bob animation via useFrame (sine wave on Y axis).
 */

import { useFrame } from '@react-three/fiber';
import type React from 'react';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

import { buildingsLogic, getResourceEntity, renderableCitizens } from '../ecs/archetypes';
import { getCurrentGridSize } from '../engine/GridTypes';
import { getCaravanTarget } from '../stores/gameStore';

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

/** Default color for aggregate mode idle workers. */
const IDLE_WORKER_COLOR = '#8d6e63';

/** Color for caravan formation families. */
const CARAVAN_COLOR = '#a1887f';

/** Number of figures in the caravan formation. */
const CARAVAN_COUNT = 20;

/**
 * Simple deterministic hash from two integers.
 * Used to scatter aggregate-mode citizens near housing buildings
 * without needing a PRNG instance.
 */
function deterministicScatter(gridX: number, gridY: number, index: number): { dx: number; dz: number } {
  // Mix grid coords and index into a pseudo-random offset
  const seed = (gridX * 73856093 + gridY * 19349663 + index * 83492791) | 0;
  const dx = ((seed & 0xff) / 255) * 1.6 - 0.8; // range [-0.8, 0.8]
  const dz = (((seed >> 8) & 0xff) / 255) * 1.6 - 0.8;
  return { dx, dz };
}

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

    // Caravan formation takes priority during arrival
    const caravanTarget = getCaravanTarget();
    if (caravanTarget) {
      renderCaravan(mesh, caravanTarget, timeRef.current);
    } else {
      // Detect aggregate vs entity mode
      const resourceEntity = getResourceEntity();
      const raion = resourceEntity?.resources?.raion;
      const isAggregate = raion != null;

      if (isAggregate) {
        renderAggregate(mesh, raion, timeRef.current);
      } else {
        renderEntities(mesh, timeRef.current);
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  });

  /**
   * Entity mode: render from ECS citizen entities (existing behavior).
   */
  function renderEntities(mesh: THREE.InstancedMesh, time: number): void {
    const entities = renderableCitizens.entities;
    const count = Math.min(entities.length, MAX_CITIZENS);
    mesh.count = count;

    if (count === 0) return;

    for (let i = 0; i < count; i++) {
      const entity = entities[i];
      const { gridX, gridY } = entity.position;

      const bob = Math.sin(time * 2 + i * 0.7) * 0.05;

      tmpPos.set(gridX + 0.5, 0.2 + bob, gridY + 0.5);
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
      mesh.setMatrixAt(i, tmpMatrix);

      const colorHex = CLASS_COLORS[entity.citizen.class] ?? '#757575';
      tmpColor.set(colorHex);
      mesh.setColorAt(i, tmpColor);
    }
  }

  /**
   * Caravan mode: families walking in a staggered line from the map edge
   * toward the settlement center during the first ~30 ticks.
   */
  function renderCaravan(mesh: THREE.InstancedMesh, target: { x: number; z: number }, time: number): void {
    mesh.count = CARAVAN_COUNT;
    tmpColor.set(CARAVAN_COLOR);

    const gridSize = getCurrentGridSize();
    // Caravan starts from southwest edge
    const startX = -1;
    const startZ = gridSize + 1;
    const endX = target.x + 0.5;
    const endZ = target.z + 0.5;

    for (let i = 0; i < CARAVAN_COUNT; i++) {
      // Stagger each figure along the line — leader is furthest ahead
      const offset = i * 0.04; // spacing between figures
      const progress = Math.min(Math.max(time * 0.3 - offset, 0), 1);

      const x = startX + (endX - startX) * progress;
      const z = startZ + (endZ - startZ) * progress;
      // Slight lateral wobble for a natural look
      const wobbleX = Math.sin(time * 3 + i * 1.2) * 0.1;
      const bob = Math.sin(time * 4 + i * 0.9) * 0.04;

      tmpPos.set(x + wobbleX, 0.2 + bob, z);
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
      mesh.setMatrixAt(i, tmpMatrix);
      mesh.setColorAt(i, tmpColor);
    }
  }

  /**
   * Aggregate mode: scatter idle workers near housing buildings.
   * Workers inside buildings are invisible — only idle ones loiter outside.
   */
  function renderAggregate(mesh: THREE.InstancedMesh, raion: { idleWorkers: number }, time: number): void {
    const idleCount = Math.min(raion.idleWorkers, MAX_CITIZENS);
    mesh.count = idleCount;

    if (idleCount === 0) return;

    // Collect housing building positions
    const housingPositions: { gridX: number; gridY: number }[] = [];
    for (const entity of buildingsLogic.entities) {
      if (entity.building.housingCap > 0) {
        housingPositions.push({ gridX: entity.position.gridX, gridY: entity.position.gridY });
      }
    }

    if (housingPositions.length === 0) {
      mesh.count = 0;
      return;
    }

    tmpColor.set(IDLE_WORKER_COLOR);

    for (let i = 0; i < idleCount; i++) {
      // Round-robin housing assignment
      const housing = housingPositions[i % housingPositions.length];
      const { dx, dz } = deterministicScatter(housing.gridX, housing.gridY, i);

      const bob = Math.sin(time * 2 + i * 0.7) * 0.05;

      tmpPos.set(housing.gridX + 0.5 + dx, 0.2 + bob, housing.gridY + 0.5 + dz);
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
      mesh.setMatrixAt(i, tmpMatrix);
      mesh.setColorAt(i, tmpColor);
    }
  }

  return <instancedMesh ref={meshRef} args={[geometry, material, MAX_CITIZENS]} frustumCulled={false} castShadow />;
};

export default CitizenRenderer;

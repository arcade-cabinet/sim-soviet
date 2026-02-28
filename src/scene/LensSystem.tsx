/**
 * LensSystem — Visual lens mode overlays.
 *
 * 'default': normal rendering (no overrides).
 * 'water': dark overlay + blue highlight on watered tiles, gray on unwatered buildable cells.
 * 'power': green tiles on powered buildings, red on unpowered.
 * 'smog': handled by SmogOverlay component.
 * 'aura': handled by AuraRenderer component.
 *
 * Uses instancedMesh (same pattern as SmogOverlay) for GPU-batched per-tile
 * colored overlays. A semi-transparent dark plane dims the scene when any
 * lens is active to make colored tiles stand out.
 */

import { useFrame } from '@react-three/fiber';
import type React from 'react';
import { useMemo, useRef } from 'react';
import * as THREE from 'three/webgpu';

import { buildingsLogic } from '../ecs/archetypes';
import { gameState } from '../engine/GameState';
import { GRID_SIZE } from '../engine/GridTypes';

const MAX_INSTANCES = GRID_SIZE * GRID_SIZE;

// ── Colors ──────────────────────────────────────────────────────────────────

// Water lens
const COLOR_WATERED = new THREE.Color(0.1, 0.4, 0.9); // bright blue
const COLOR_PIPE = new THREE.Color(0.2, 0.6, 0.9); // cyan (pipe without water flow)
const COLOR_DRY = new THREE.Color(0.4, 0.4, 0.45); // gray — unwatered

// Power lens
const COLOR_POWERED = new THREE.Color(0.1, 0.7, 0.2); // green
const COLOR_UNPOWERED = new THREE.Color(0.8, 0.15, 0.1); // red

// ── Water Overlay ───────────────────────────────────────────────────────────

const WaterOverlay: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const geometry = useMemo(() => new THREE.BoxGeometry(1, 0.15, 1), []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  );

  const tmpMatrix = useMemo(() => new THREE.Matrix4(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);
  const tmpPos = useMemo(() => new THREE.Vector3(), []);
  const tmpScale = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const tmpQuat = useMemo(() => new THREE.Quaternion(), []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    if (gameState.activeLens !== 'water') {
      mesh.count = 0;
      return;
    }

    const grid = gameState.grid;
    if (!grid.length) {
      mesh.count = 0;
      return;
    }

    let idx = 0;

    for (let y = 0; y < GRID_SIZE; y++) {
      const row = grid[y];
      if (!row) continue;
      for (let x = 0; x < GRID_SIZE; x++) {
        const cell = row[x];
        if (!cell) continue;
        // Skip natural water tiles (rivers) — they don't need highlighting
        if (cell.terrain === 'water') continue;

        // Show watered, piped, and buildable-but-dry cells
        const hasBuilding = cell.type !== null;
        const showTile = cell.watered || cell.hasPipe || hasBuilding;
        if (!showTile) continue;

        const elevation = (cell.z ?? 0) * 0.5;
        tmpPos.set(x + 0.5, elevation + 0.08, y + 0.5);
        tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
        mesh.setMatrixAt(idx, tmpMatrix);

        if (cell.watered) {
          tmpColor.copy(COLOR_WATERED);
        } else if (cell.hasPipe) {
          tmpColor.copy(COLOR_PIPE);
        } else {
          tmpColor.copy(COLOR_DRY);
        }
        mesh.setColorAt(idx, tmpColor);
        idx++;
      }
    }

    mesh.count = idx;
    if (idx > 0) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  });

  return <instancedMesh ref={meshRef} args={[geometry, material, MAX_INSTANCES]} frustumCulled={false} />;
};

// ── Power Overlay ───────────────────────────────────────────────────────────

const PowerOverlay: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const geometry = useMemo(() => new THREE.BoxGeometry(1, 0.25, 1), []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  );

  const tmpMatrix = useMemo(() => new THREE.Matrix4(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);
  const tmpPos = useMemo(() => new THREE.Vector3(), []);
  const tmpScale = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const tmpQuat = useMemo(() => new THREE.Quaternion(), []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    if (gameState.activeLens !== 'power') {
      mesh.count = 0;
      return;
    }

    const grid = gameState.grid;
    let idx = 0;

    for (const entity of buildingsLogic.entities) {
      const { gridX, gridY } = entity.position;
      const bld = entity.building;

      // Power plants don't need overlay — they generate power
      if (bld.powerOutput > 0 && bld.powerReq === 0) continue;

      // Read elevation from the legacy grid if available
      const cell = grid[gridY]?.[gridX];
      const elevation = (cell?.z ?? 0) * 0.5;
      tmpPos.set(gridX + 0.5, elevation + 0.13, gridY + 0.5);
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
      mesh.setMatrixAt(idx, tmpMatrix);

      tmpColor.copy(bld.powered ? COLOR_POWERED : COLOR_UNPOWERED);
      mesh.setColorAt(idx, tmpColor);
      idx++;
    }

    mesh.count = idx;
    if (idx > 0) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  });

  // Max buildings is much less than grid cells, but MAX_INSTANCES is safe upper bound
  return <instancedMesh ref={meshRef} args={[geometry, material, MAX_INSTANCES]} frustumCulled={false} />;
};

// ── Dimming Plane ───────────────────────────────────────────────────────────

/** Large semi-transparent dark plane that sits just above the terrain to dim
 *  the scene when a lens is active. Makes colored overlay tiles pop. */
const DimmingPlane: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  );

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const lens = gameState.activeLens;
    const targetOpacity = lens === 'water' || lens === 'power' ? 0.35 : 0;

    // Smooth fade
    const current = material.opacity;
    const diff = targetOpacity - current;
    if (Math.abs(diff) > 0.005) {
      material.opacity = current + diff * 0.1;
      mesh.visible = true;
    } else {
      material.opacity = targetOpacity;
      mesh.visible = targetOpacity > 0;
    }
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[GRID_SIZE / 2, 0.02, GRID_SIZE / 2]} visible={false}>
      <planeGeometry args={[GRID_SIZE + 4, GRID_SIZE + 4]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
};

// ── Main LensSystem ─────────────────────────────────────────────────────────

const LensSystem: React.FC = () => {
  return (
    <>
      <DimmingPlane />
      <WaterOverlay />
      <PowerOverlay />
    </>
  );
};

export default LensSystem;

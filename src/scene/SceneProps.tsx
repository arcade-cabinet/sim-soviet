/**
 * SceneProps — Environmental detail scattering.
 *
 * Loads GLB prop models (rocks, bushes, grass, mushrooms, animals) and
 * scatters them around the map for visual richness. Props are placed:
 *   - Rocks: on perimeter, mountain, and empty tiles
 *   - Bushes/grass: on empty grass tiles
 *   - Mushrooms: near forests
 *   - Animals (cows, horses, donkeys): wander on grass tiles near farms
 *
 * Uses a seeded random for deterministic placement so props don't jump
 * on re-render. Animals get a simple wandering animation.
 */
import React, { useEffect, useRef } from 'react';
import {
  ImportMeshAsync,
  TransformNode,
  Vector3,
  type AbstractMesh,
  type Mesh,
  type Scene,
  type Nullable,
  type Observer,
} from '@babylonjs/core';
import '@babylonjs/loaders';
import { useScene } from 'reactylon';
import { GRID_SIZE } from '../engine/GridTypes';
import { gameState } from '../engine/GameState';
import type { Season } from './TerrainGrid';

/** Seeded PRNG (mulberry32) for deterministic scatter */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface PropTemplate {
  name: string;
  file: string;
  /** How many instances to scatter */
  count: number;
  /** Scale range [min, max] */
  scale: [number, number];
  /** Where this prop can be placed */
  placement: 'perimeter' | 'grass' | 'forest-edge' | 'farm-animal';
}

const PROP_DEFS: PropTemplate[] = [
  // Rocks — scattered on perimeter and empty tiles
  { name: 'Rock1', file: 'Rock_Medium_1.glb', count: 12, scale: [0.3, 0.8], placement: 'perimeter' },
  { name: 'Rock2', file: 'Rock_Medium_2.glb', count: 10, scale: [0.2, 0.6], placement: 'perimeter' },
  { name: 'Rock3', file: 'Rock_Medium_3.glb', count: 8, scale: [0.3, 0.7], placement: 'grass' },

  // Bushes — on empty grass tiles
  { name: 'Bush', file: 'Bush_Common.glb', count: 15, scale: [0.25, 0.5], placement: 'grass' },

  // Grass clumps — scattered on grass
  { name: 'GrassShort', file: 'Grass_Common_Short.glb', count: 25, scale: [0.3, 0.6], placement: 'grass' },
  { name: 'GrassWispy', file: 'Grass_Wispy_Short.glb', count: 20, scale: [0.3, 0.5], placement: 'grass' },

  // Mushrooms — near forest tiles
  { name: 'Mushroom', file: 'Mushroom_Common.glb', count: 8, scale: [0.15, 0.3], placement: 'forest-edge' },

  // Animals — near farm buildings
  { name: 'Cow', file: 'Cow.glb', count: 4, scale: [0.08, 0.1], placement: 'farm-animal' },
  { name: 'Horse', file: 'Horse_White.glb', count: 3, scale: [0.08, 0.1], placement: 'farm-animal' },
  { name: 'Donkey', file: 'Donkey.glb', count: 3, scale: [0.07, 0.09], placement: 'farm-animal' },
];

/** Get valid positions for each placement type */
function getPlacementPositions(
  placement: PropTemplate['placement'],
  rng: () => number,
): Array<{ x: number; z: number; y: number }> {
  const positions: Array<{ x: number; z: number; y: number }> = [];
  const grid = gameState.grid;
  const center = GRID_SIZE / 2;

  switch (placement) {
    case 'perimeter': {
      // Scatter rocks around the map edges and beyond
      for (let i = 0; i < 40; i++) {
        const angle = rng() * Math.PI * 2;
        const dist = GRID_SIZE * 0.5 + rng() * 30 + 5;
        positions.push({
          x: center + Math.cos(angle) * dist,
          z: center + Math.sin(angle) * dist,
          y: 0,
        });
      }
      // Also some rocks on mountain tiles inside the grid
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          const cell = grid[y]?.[x];
          if (cell?.terrain === 'mountain' && rng() < 0.3) {
            positions.push({
              x: x + rng(),
              z: y + rng(),
              y: (cell.z ?? 0) * 0.5,
            });
          }
        }
      }
      break;
    }
    case 'grass': {
      // Empty tiles without buildings or special terrain
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          const cell = grid[y]?.[x];
          if (cell && !cell.type && cell.terrain === 'grass' && rng() < 0.06) {
            positions.push({
              x: x + rng() * 0.8 + 0.1,
              z: y + rng() * 0.8 + 0.1,
              y: (cell.z ?? 0) * 0.5,
            });
          }
        }
      }
      break;
    }
    case 'forest-edge': {
      // Tiles adjacent to forest
      for (let y = 1; y < GRID_SIZE - 1; y++) {
        for (let x = 1; x < GRID_SIZE - 1; x++) {
          const cell = grid[y]?.[x];
          if (cell && !cell.type && cell.terrain !== 'tree') {
            // Check if any neighbor is forest
            const hasForestNeighbor =
              grid[y - 1]?.[x]?.terrain === 'tree' ||
              grid[y + 1]?.[x]?.terrain === 'tree' ||
              grid[y]?.[x - 1]?.terrain === 'tree' ||
              grid[y]?.[x + 1]?.terrain === 'tree';
            if (hasForestNeighbor && rng() < 0.2) {
              positions.push({
                x: x + rng() * 0.8 + 0.1,
                z: y + rng() * 0.8 + 0.1,
                y: (cell.z ?? 0) * 0.5,
              });
            }
          }
        }
      }
      break;
    }
    case 'farm-animal': {
      // Near collective farm buildings
      const farms = gameState.buildings.filter(
        (b) =>
          b.type === 'collective-farm-hq' ||
          b.type === 'zone-farm' ||
          b.type === 'farm',
      );
      for (const farm of farms) {
        // Scatter animals in a 3-tile radius around the farm
        for (let i = 0; i < 6; i++) {
          const ox = (rng() - 0.5) * 6;
          const oz = (rng() - 0.5) * 6;
          const px = farm.x + ox;
          const pz = farm.y + oz;
          if (px >= 0 && px < GRID_SIZE && pz >= 0 && pz < GRID_SIZE) {
            const cell = grid[Math.floor(pz)]?.[Math.floor(px)];
            if (cell && !cell.type && cell.terrain !== 'water' && cell.terrain !== 'mountain') {
              positions.push({
                x: px,
                z: pz,
                y: (cell.z ?? 0) * 0.5,
              });
            }
          }
        }
      }
      // If no farms yet, place a few animals on random grass tiles
      if (farms.length === 0) {
        for (let y = 0; y < GRID_SIZE; y++) {
          for (let x = 0; x < GRID_SIZE; x++) {
            const cell = grid[y]?.[x];
            if (cell && !cell.type && cell.terrain === 'grass' && rng() < 0.008) {
              positions.push({
                x: x + rng(),
                z: y + rng(),
                y: (cell.z ?? 0) * 0.5,
              });
            }
          }
        }
      }
      break;
    }
  }

  return positions;
}

interface AnimalInstance {
  mesh: TransformNode;
  baseX: number;
  baseZ: number;
  baseY: number;
  wanderAngle: number;
  wanderSpeed: number;
  wanderRadius: number;
  time: number;
}

interface ScenePropsProps {
  season?: Season;
}

const SceneProps: React.FC<ScenePropsProps> = ({ season = 'winter' }) => {
  const scene = useScene();
  const meshesRef = useRef<TransformNode[]>([]);
  const animalsRef = useRef<AnimalInstance[]>([]);
  const renderObsRef = useRef<Nullable<Observer<Scene>>>(null);

  useEffect(() => {
    // Dispose previous — child meshes first, then parent TransformNodes
    for (const node of meshesRef.current) {
      node.getChildMeshes().forEach((m) => m.dispose());
      node.dispose();
    }
    meshesRef.current = [];
    animalsRef.current = [];

    const rng = mulberry32(42 + (season === 'winter' ? 0 : season === 'spring' ? 1 : season === 'summer' ? 2 : 3));

    // Wait for grid to be initialized
    if (!gameState.grid.length) return;

    let disposed = false;

    async function loadProps() {
      for (const def of PROP_DEFS) {
        if (disposed) return;

        // Skip grass/bush props in winter (snow covers them)
        if (
          season === 'winter' &&
          (def.placement === 'grass' && def.name !== 'Rock3')
        ) {
          continue;
        }

        try {
          const result = await ImportMeshAsync(
            `assets/models/props/${def.file}`,
            scene,
          );

          if (disposed) {
            for (const m of result.meshes) m.dispose();
            return;
          }

          // Hide template meshes — they serve only as clone sources
          for (const m of result.meshes) {
            m.isVisible = false;
          }

          const positions = getPlacementPositions(def.placement, rng);
          const count = Math.min(def.count, positions.length);

          for (let i = 0; i < count; i++) {
            const pos = positions[i];

            // Clone individual meshes (BabylonJS 8: TransformNode.clone doesn't clone children)
            const parent = new TransformNode(`${def.name}_${i}`, scene);
            let clonedAny = false;
            for (const mesh of result.meshes) {
              if (mesh.getTotalVertices() === 0) continue;
              const cloned = (mesh as Mesh).clone(`${mesh.name}_${i}`, parent);
              if (cloned) {
                cloned.isVisible = true;
                cloned.setEnabled(true);
                cloned.isPickable = false;
                clonedAny = true;
              }
            }
            if (!clonedAny) {
              parent.dispose();
              continue;
            }

            const s = def.scale[0] + rng() * (def.scale[1] - def.scale[0]);
            parent.scaling = new Vector3(s, s, s);
            parent.position = new Vector3(pos.x, pos.y, pos.z);
            parent.rotation.y = rng() * Math.PI * 2;

            meshesRef.current.push(parent);

            // Track animals for wandering animation
            if (def.placement === 'farm-animal') {
              animalsRef.current.push({
                mesh: parent,
                baseX: pos.x,
                baseZ: pos.z,
                baseY: pos.y,
                wanderAngle: rng() * Math.PI * 2,
                wanderSpeed: 0.1 + rng() * 0.2,
                wanderRadius: 0.5 + rng() * 1.5,
                time: rng() * 100,
              });
            }
          }

          // Dispose template meshes after all clones are made
          for (const m of result.meshes) m.dispose();
          for (const tn of result.transformNodes) tn.dispose();
        } catch (err) {
          console.warn(`[SceneProps] Failed to load ${def.file}:`, err);
        }
      }
    }

    loadProps();

    // Simple wandering animation for animals
    renderObsRef.current = scene.onBeforeRenderObservable.add(() => {
      const dt = scene.getEngine().getDeltaTime() / 1000;
      for (const animal of animalsRef.current) {
        animal.time += dt * animal.wanderSpeed;
        const nx = animal.baseX + Math.sin(animal.time) * animal.wanderRadius;
        const nz = animal.baseZ + Math.cos(animal.time * 0.7) * animal.wanderRadius;

        // Face movement direction
        const dx = nx - animal.mesh.position.x;
        const dz = nz - animal.mesh.position.z;
        if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
          animal.mesh.rotation.y = Math.atan2(dx, dz);
        }

        animal.mesh.position.x = nx;
        animal.mesh.position.z = nz;
      }
    });

    return () => {
      disposed = true;
      for (const node of meshesRef.current) {
        node.getChildMeshes().forEach((m) => m.dispose());
        node.dispose();
      }
      meshesRef.current = [];
      animalsRef.current = [];
      if (renderObsRef.current) {
        scene.onBeforeRenderObservable.remove(renderObsRef.current);
        renderObsRef.current = null;
      }
    };
  }, [scene, season]);

  return null;
};

export default SceneProps;

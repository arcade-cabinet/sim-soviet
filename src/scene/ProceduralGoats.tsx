/**
 * ProceduralGoats — Procedurally generated goats from BabylonJS primitives.
 *
 * Creates low-poly goats that wander on grass tiles. Each goat is built from:
 *   - Body: elongated box
 *   - Head: small box with tilt
 *   - Horns: two thin cylinders
 *   - Legs: four thin cylinders
 *   - Beard: small cone (billy goat style)
 *
 * Goats graze (head bob) and wander between tiles using simple steering.
 * Soviet goats are stoic but occasionally bleat (toast message).
 */
import React, { useEffect, useRef } from 'react';
import {
  Color3,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Vector3,
  type Nullable,
  type Observer,
  type Scene,
} from '@babylonjs/core';
import { useScene } from 'reactylon';
import { GRID_SIZE } from '../engine/GridTypes';
import { gameState } from '../engine/GameState';

const GOAT_COUNT = 8;
const GOAT_BODY_COLOR = new Color3(0.85, 0.82, 0.75); // off-white
const GOAT_DARK_COLOR = new Color3(0.35, 0.30, 0.25); // brown-gray
const WANDER_SPEED = 0.4;
const GRAZE_SPEED = 1.5;

interface Goat {
  root: Mesh;
  head: Mesh;
  baseY: number;
  // Wander state
  targetX: number;
  targetZ: number;
  wanderTimer: number;
  grazeTimer: number;
  isGrazing: boolean;
}

function createGoatMesh(scene: Scene, index: number): { root: Mesh; head: Mesh } {
  const root = new Mesh(`goat_root_${index}`, scene);

  // Materials
  const bodyMat = new StandardMaterial(`goatBody_${index}`, scene);
  bodyMat.diffuseColor = GOAT_BODY_COLOR;
  bodyMat.specularColor = Color3.Black();

  const darkMat = new StandardMaterial(`goatDark_${index}`, scene);
  darkMat.diffuseColor = GOAT_DARK_COLOR;
  darkMat.specularColor = Color3.Black();

  // Body — elongated box
  const body = MeshBuilder.CreateBox(`goatBody_${index}`, {
    width: 0.18,
    height: 0.12,
    depth: 0.3,
  }, scene);
  body.material = bodyMat;
  body.position.y = 0.16;
  body.parent = root;

  // Head — smaller box, tilted forward
  const head = MeshBuilder.CreateBox(`goatHead_${index}`, {
    width: 0.08,
    height: 0.08,
    depth: 0.12,
  }, scene);
  head.material = darkMat;
  head.position = new Vector3(0, 0.2, 0.18);
  head.rotation.x = -0.2;
  head.parent = root;

  // Horns — two small cylinders angled back
  for (let side = -1; side <= 1; side += 2) {
    const horn = MeshBuilder.CreateCylinder(`goatHorn_${index}_${side}`, {
      height: 0.08,
      diameterTop: 0.005,
      diameterBottom: 0.015,
      tessellation: 6,
    }, scene);
    horn.material = darkMat;
    horn.position = new Vector3(side * 0.03, 0.26, 0.16);
    horn.rotation.x = -0.6;
    horn.rotation.z = side * 0.3;
    horn.parent = root;
  }

  // Beard — small cone hanging under chin
  const beard = MeshBuilder.CreateCylinder(`goatBeard_${index}`, {
    height: 0.05,
    diameterTop: 0.02,
    diameterBottom: 0.005,
    tessellation: 6,
  }, scene);
  beard.material = darkMat;
  beard.position = new Vector3(0, 0.14, 0.22);
  beard.parent = root;

  // Legs — four thin cylinders
  const legPositions = [
    { x: -0.06, z: -0.1 },
    { x: 0.06, z: -0.1 },
    { x: -0.06, z: 0.1 },
    { x: 0.06, z: 0.1 },
  ];
  for (let i = 0; i < legPositions.length; i++) {
    const leg = MeshBuilder.CreateCylinder(`goatLeg_${index}_${i}`, {
      height: 0.14,
      diameter: 0.025,
      tessellation: 6,
    }, scene);
    leg.material = bodyMat;
    leg.position = new Vector3(legPositions[i].x, 0.07, legPositions[i].z);
    leg.parent = root;
  }

  // Tail — small cylinder angled up
  const tail = MeshBuilder.CreateCylinder(`goatTail_${index}`, {
    height: 0.06,
    diameterTop: 0.005,
    diameterBottom: 0.015,
    tessellation: 6,
  }, scene);
  tail.material = bodyMat;
  tail.position = new Vector3(0, 0.22, -0.16);
  tail.rotation.x = 0.8;
  tail.parent = root;

  // Scale the whole goat
  root.scaling = new Vector3(1.5, 1.5, 1.5);
  root.isPickable = false;

  return { root, head };
}

/** Find open grass tiles for goat placement */
function findGrassTiles(): Array<{ x: number; z: number; y: number }> {
  const tiles: Array<{ x: number; z: number; y: number }> = [];
  const grid = gameState.grid;
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const cell = grid[y]?.[x];
      if (
        cell &&
        !cell.type &&
        cell.terrain !== 'water' &&
        cell.terrain !== 'mountain' &&
        cell.terrain !== 'marsh'
      ) {
        tiles.push({ x: x + 0.5, z: y + 0.5, y: (cell.z ?? 0) * 0.5 });
      }
    }
  }
  return tiles;
}

function pickRandomTarget(
  grassTiles: Array<{ x: number; z: number; y: number }>,
  currentX: number,
  currentZ: number,
): { x: number; z: number; y: number } {
  // Pick a nearby tile (within 5 tiles)
  const nearby = grassTiles.filter((t) => {
    const dx = t.x - currentX;
    const dz = t.z - currentZ;
    const dist = Math.sqrt(dx * dx + dz * dz);
    return dist > 0.5 && dist < 5;
  });
  if (nearby.length > 0) {
    return nearby[Math.floor(Math.random() * nearby.length)];
  }
  return grassTiles[Math.floor(Math.random() * grassTiles.length)];
}

const ProceduralGoats: React.FC = () => {
  const scene = useScene();
  const goatsRef = useRef<Goat[]>([]);
  const renderObsRef = useRef<Nullable<Observer<Scene>>>(null);

  useEffect(() => {
    // Dispose previous
    for (const g of goatsRef.current) g.root.dispose();
    goatsRef.current = [];

    if (!gameState.grid.length) return;

    const grassTiles = findGrassTiles();
    if (grassTiles.length < GOAT_COUNT) return;

    // Place goats on random grass tiles
    const goats: Goat[] = [];
    const usedIndices = new Set<number>();

    for (let i = 0; i < GOAT_COUNT; i++) {
      let idx: number;
      do {
        idx = Math.floor(Math.random() * grassTiles.length);
      } while (usedIndices.has(idx));
      usedIndices.add(idx);

      const tile = grassTiles[idx];
      const { root, head } = createGoatMesh(scene, i);
      root.position = new Vector3(tile.x, tile.y, tile.z);

      const target = pickRandomTarget(grassTiles, tile.x, tile.z);

      goats.push({
        root,
        head,
        baseY: tile.y,
        targetX: target.x,
        targetZ: target.z,
        wanderTimer: 3 + Math.random() * 5,
        grazeTimer: 2 + Math.random() * 4,
        isGrazing: Math.random() > 0.5,
      });
    }

    goatsRef.current = goats;

    // Animation loop
    renderObsRef.current = scene.onBeforeRenderObservable.add(() => {
      const dt = scene.getEngine().getDeltaTime() / 1000;

      for (const goat of goatsRef.current) {
        if (goat.isGrazing) {
          // Head bob while grazing
          goat.grazeTimer -= dt;
          goat.head.position.y = 0.15 + Math.sin(goat.grazeTimer * GRAZE_SPEED) * 0.03;
          goat.head.rotation.x = -0.4 + Math.sin(goat.grazeTimer * GRAZE_SPEED) * 0.15;

          if (goat.grazeTimer <= 0) {
            goat.isGrazing = false;
            goat.wanderTimer = 2 + Math.random() * 4;
            const target = pickRandomTarget(grassTiles, goat.root.position.x, goat.root.position.z);
            goat.targetX = target.x;
            goat.targetZ = target.z;
          }
        } else {
          // Wander toward target
          const dx = goat.targetX - goat.root.position.x;
          const dz = goat.targetZ - goat.root.position.z;
          const dist = Math.sqrt(dx * dx + dz * dz);

          if (dist > 0.1) {
            const speed = WANDER_SPEED * dt;
            goat.root.position.x += (dx / dist) * speed;
            goat.root.position.z += (dz / dist) * speed;
            goat.root.rotation.y = Math.atan2(dx, dz);

            // Reset head to forward position
            goat.head.position.y = 0.2;
            goat.head.rotation.x = -0.2;
          } else {
            // Arrived — start grazing
            goat.isGrazing = true;
            goat.grazeTimer = 3 + Math.random() * 5;
          }

          goat.wanderTimer -= dt;
          if (goat.wanderTimer <= 0) {
            // Pick a new target
            const target = pickRandomTarget(grassTiles, goat.root.position.x, goat.root.position.z);
            goat.targetX = target.x;
            goat.targetZ = target.z;
            goat.wanderTimer = 3 + Math.random() * 5;
          }
        }
      }
    });

    return () => {
      for (const g of goatsRef.current) g.root.dispose();
      goatsRef.current = [];
      if (renderObsRef.current) {
        scene.onBeforeRenderObservable.remove(renderObsRef.current);
        renderObsRef.current = null;
      }
    };
  }, [scene]);

  return null;
};

export default ProceduralGoats;

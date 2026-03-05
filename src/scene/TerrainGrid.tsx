/**
 * TerrainGrid — renders a terrain grid using a single BufferGeometry
 * with per-vertex colors, plus GPU-instanced procedural scatter.
 *
 * Terrain types: grass, water, rail, tree, crater, irradiated, mountain, marsh, path.
 * Supports elevation offsets, season-dependent colors, procedural scatter geometry.
 *
 * All scatter placement uses a seeded PRNG (mulberry32) for deterministic results
 * across reloads with the same game seed.
 *
 * Performance: scatter geometry (trees, mountains, marshes, rail markers) is rendered
 * via InstancedMesh — each shape type is a single draw call regardless of count.
 * Total scatter draw calls: ~8 (down from ~2600+ individual meshes).
 */
import { useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type React from 'react';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { GridCell, TerrainType } from '../engine/GridTypes';
import type { EraId } from '../game/era/types';
import { assetUrl } from '../utils/assetPath';
import { type TerrainVisualState, eraToTerrainState, getTerrainTextureFiles } from './terrainEraMapping';

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

/** Game season affecting terrain colors, tree canopy, and weather effects. */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

interface TerrainGridProps {
  grid: GridCell[][];
  season?: Season;
  /** Current historical era — shifts terrain color palette. */
  era?: EraId;
  /** 0 = completely hidden (sphere mode), 1 = fully visible (flat local grid) */
  flatten?: number;
}

// ── Instanced Scatter Data ─────────────────────────────────────────────────

/** Per-instance data: matrix + color for InstancedMesh */
interface InstanceBatch {
  matrices: THREE.Matrix4[];
  color: THREE.Color;
}

const _tmpPos = new THREE.Vector3();
const _tmpQuat = new THREE.Quaternion();
const _tmpScale = new THREE.Vector3();
const _tmpEuler = new THREE.Euler();

/**
 * Collect all tree scatter into 3 instance batches:
 * trunks (cylinders), lower cones, upper cones.
 */
function buildTreeInstances(
  grid: GridCell[][],
  trunkColor: THREE.Color,
  canopyColor: THREE.Color,
): { trunks: InstanceBatch; lowerCones: InstanceBatch; upperCones: InstanceBatch } {
  const trunks: THREE.Matrix4[] = [];
  const lowerCones: THREE.Matrix4[] = [];
  const upperCones: THREE.Matrix4[] = [];
  const rng = mulberry32(0xf0_be57);
  const gridSize = grid.length;

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const cell = grid[row]?.[col];
      if (!cell || cell.terrain !== 'tree') continue;

      const y = cell.z * 0.5;
      const treeCount = 1 + Math.floor(rng() * 3);

      for (let t = 0; t < treeCount; t++) {
        const ox = 0.15 + rng() * 0.7;
        const oz = 0.15 + rng() * 0.7;
        const s = 0.6 + rng() * 0.5;
        const yaw = rng() * Math.PI * 2;

        const tx = col + ox;
        const tz = row + oz;

        // Trunk: cylinder at (tx, y + 0.25*s, tz), scale (0.06, 0.5*s, 0.06)
        // Unit cylinder is height=1, radius=1 → scale by (0.06, 0.25*s, 0.06)
        _tmpPos.set(tx, y + 0.25 * s, tz);
        _tmpQuat.identity();
        _tmpScale.set(0.06, 0.25 * s, 0.06);
        const trunkMat = new THREE.Matrix4();
        trunkMat.compose(_tmpPos, _tmpQuat, _tmpScale);
        trunks.push(trunkMat);

        // Lower cone: at (tx, y + 0.55*s, tz), radius=0.325*s, height=0.6*s
        // Unit cone is height=1, radius=1 → scale by (0.325*s, 0.6*s, 0.325*s)
        _tmpPos.set(tx, y + 0.55 * s, tz);
        _tmpEuler.set(0, yaw, 0);
        _tmpQuat.setFromEuler(_tmpEuler);
        _tmpScale.set(0.325 * s, 0.6 * s, 0.325 * s);
        const lowerMat = new THREE.Matrix4();
        lowerMat.compose(_tmpPos, _tmpQuat, _tmpScale);
        lowerCones.push(lowerMat);

        // Upper cone: at (tx, y + 0.9*s, tz), radius=0.225*s, height=0.5*s
        _tmpPos.set(tx, y + 0.9 * s, tz);
        _tmpScale.set(0.225 * s, 0.5 * s, 0.225 * s);
        const upperMat = new THREE.Matrix4();
        upperMat.compose(_tmpPos, _tmpQuat, _tmpScale);
        upperCones.push(upperMat);
      }
    }
  }

  return {
    trunks: { matrices: trunks, color: trunkColor },
    lowerCones: { matrices: lowerCones, color: canopyColor },
    upperCones: { matrices: upperCones, color: canopyColor },
  };
}

/** Collect all mountain peaks into a single cone instance batch. */
function buildMountainInstances(grid: GridCell[][], rockColor: THREE.Color): InstanceBatch {
  const matrices: THREE.Matrix4[] = [];
  const rng = mulberry32(0xd0c4_a1b5);
  const gridSize = grid.length;

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const cell = grid[row]?.[col];
      if (!cell || cell.terrain !== 'mountain') continue;

      const y = cell.z * 0.5;
      const cx = col + 0.5;
      const cz = row + 0.5;
      const scale = 0.7 + rng() * 0.3;

      // Main peak
      _tmpPos.set(cx, y + 0.6 * scale, cz);
      _tmpQuat.identity();
      _tmpScale.set(0.35 * scale, 1.2 * scale, 0.35 * scale);
      const m1 = new THREE.Matrix4();
      m1.compose(_tmpPos, _tmpQuat, _tmpScale);
      matrices.push(m1);

      // Secondary peak
      const offsetX = (rng() - 0.5) * 0.4;
      const offsetZ = (rng() - 0.5) * 0.3;
      _tmpPos.set(cx + 0.25 + offsetX, y + 0.35 * scale, cz + 0.2 + offsetZ);
      _tmpScale.set(0.25 * scale, 0.7 * scale, 0.25 * scale);
      const m2 = new THREE.Matrix4();
      m2.compose(_tmpPos, _tmpQuat, _tmpScale);
      matrices.push(m2);

      // Optional third peak (30% chance)
      if (rng() < 0.3) {
        const ox3 = (rng() - 0.5) * 0.5;
        const oz3 = (rng() - 0.5) * 0.5;
        _tmpPos.set(cx - 0.2 + ox3, y + 0.25 * scale, cz - 0.15 + oz3);
        _tmpScale.set(0.175 * scale, 0.5 * scale, 0.175 * scale);
        const m3 = new THREE.Matrix4();
        m3.compose(_tmpPos, _tmpQuat, _tmpScale);
        matrices.push(m3);
      }
    }
  }

  return { matrices, color: rockColor };
}

/** Build marsh scatter: puddle discs, reed stalks, cattail tufts. */
function buildMarshInstances(
  grid: GridCell[][],
  puddleColor: THREE.Color,
  reedColor: THREE.Color,
  tuftColor: THREE.Color,
): { puddles: InstanceBatch; reeds: InstanceBatch; tufts: InstanceBatch } {
  const puddles: THREE.Matrix4[] = [];
  const reeds: THREE.Matrix4[] = [];
  const tufts: THREE.Matrix4[] = [];
  const rng = mulberry32(0xba_d5ea);
  const gridSize = grid.length;

  // Pre-compute puddle rotation (flat on XZ)
  const puddleQuat = new THREE.Quaternion();
  puddleQuat.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const cell = grid[row]?.[col];
      if (!cell || cell.terrain !== 'marsh') continue;

      const y = cell.z * 0.5;

      // Puddle disc
      const px = col + 0.3 + rng() * 0.4;
      const pz = row + 0.3 + rng() * 0.4;
      const pr = 0.2 + rng() * 0.15;
      _tmpPos.set(px, y + 0.01, pz);
      _tmpScale.set(pr, pr, pr);
      const pm = new THREE.Matrix4();
      pm.compose(_tmpPos, puddleQuat, _tmpScale);
      puddles.push(pm);

      // Reeds + tufts
      const reedCount = 2 + Math.floor(rng() * 3);
      for (let r = 0; r < reedCount; r++) {
        const rx = col + 0.1 + rng() * 0.8;
        const rz = row + 0.1 + rng() * 0.8;
        const height = 0.3 + rng() * 0.4;
        const tiltX = (rng() - 0.5) * 0.3;
        const tiltZ = (rng() - 0.5) * 0.3;
        const tuftRadius = 0.06 + rng() * 0.04;

        // Reed stalk
        _tmpPos.set(rx, y + height / 2, rz);
        _tmpEuler.set(tiltX, 0, tiltZ);
        _tmpQuat.setFromEuler(_tmpEuler);
        _tmpScale.set(0.015, height / 2, 0.015);
        const rm = new THREE.Matrix4();
        rm.compose(_tmpPos, _tmpQuat, _tmpScale);
        reeds.push(rm);

        // Cattail tuft
        _tmpPos.set(rx, y + height + 0.02, rz);
        _tmpScale.set(tuftRadius, 0.08, tuftRadius);
        const tm = new THREE.Matrix4();
        tm.compose(_tmpPos, _tmpQuat, _tmpScale);
        tufts.push(tm);
      }
    }
  }

  return {
    puddles: { matrices: puddles, color: puddleColor },
    reeds: { matrices: reeds, color: reedColor },
    tufts: { matrices: tufts, color: tuftColor },
  };
}

/** Build rail marker instances. */
function buildRailInstances(grid: GridCell[][]): InstanceBatch {
  const matrices: THREE.Matrix4[] = [];
  const gridSize = grid.length;

  _tmpQuat.identity();

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const cell = grid[row]?.[col];
      if (!cell || cell.terrain !== 'rail') continue;

      _tmpPos.set(col + 0.5, cell.z * 0.5 + 0.025, row + 0.5);
      _tmpScale.set(1, 1, 1); // box geometry is pre-sized
      const m = new THREE.Matrix4();
      m.compose(_tmpPos, _tmpQuat, _tmpScale);
      matrices.push(m);
    }
  }

  return { matrices, color: new THREE.Color('#4d4d52') };
}

// ── Season-dependent material colors ────────────────────────────────────────

function getCanopyColor(season: Season): string {
  switch (season) {
    case 'winter':
      return '#c0c7d1'; // snow-dusted
    case 'autumn':
      return '#405926'; // evergreen stays green
    default:
      return '#26591a'; // dark conifer green
  }
}

function getRockColor(season: Season): string {
  return season === 'winter' ? '#d1d6e0' : '#736659'; // snow-capped vs gray-brown
}

function getReedColor(season: Season): string {
  switch (season) {
    case 'winter':
      return '#8c806b'; // dried tan-brown
    case 'autumn':
      return '#806b40'; // golden-brown
    default:
      return '#40662e'; // dark marsh green
  }
}

function getTuftColor(season: Season): string {
  switch (season) {
    case 'winter':
      return '#999485'; // faded tan
    case 'autumn':
      return '#8c7a4d'; // dry golden
    default:
      return '#4d8038'; // marsh green
  }
}

function getPuddleColor(season: Season): string {
  return season === 'winter' ? '#a6b3bf' : '#264033'; // frozen vs dark murky
}

// ── Shared geometries (created once, reused across renders) ────────────────

const UNIT_CYLINDER = new THREE.CylinderGeometry(1, 1, 2, 5);
const UNIT_CONE = new THREE.ConeGeometry(1, 1, 6);
const UNIT_CIRCLE = new THREE.CircleGeometry(1, 8);
const UNIT_CONE_5 = new THREE.ConeGeometry(1, 1, 5);
const RAIL_BOX = new THREE.BoxGeometry(0.9, 0.05, 0.9);

// ── InstancedMesh helper component ─────────────────────────────────────────

interface ScatterInstanceProps {
  geometry: THREE.BufferGeometry;
  batch: InstanceBatch;
  roughness?: number;
  metalness?: number;
  transparent?: boolean;
  opacity?: number;
  depthWrite?: boolean;
}

/** GPU-instanced scatter mesh — single draw call for all instances of one shape. */
const ScatterInstance: React.FC<ScatterInstanceProps> = ({
  geometry,
  batch,
  roughness = 0.9,
  metalness = 0,
  transparent = false,
  opacity = 1,
  depthWrite = true,
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = batch.matrices.length;

  // Apply instance matrices and colors
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || count === 0) return;

    for (let i = 0; i < count; i++) {
      mesh.setMatrixAt(i, batch.matrices[i]);
      mesh.setColorAt(i, batch.color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [batch, count]);

  if (count === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, count]} frustumCulled={false}>
      <meshStandardMaterial
        roughness={roughness}
        metalness={metalness}
        transparent={transparent}
        opacity={opacity}
        depthWrite={depthWrite}
      />
    </instancedMesh>
  );
};

// ── Era PBR texture loading ─────────────────────────────────────────────────

/** Number of texture tiling repeats across the full terrain grid. */
const TERRAIN_TILE_REPEAT = 8;

/** Crossfade duration in frames (~60fps → ~1 second). */
const CROSSFADE_FRAMES = 60;

/**
 * Load and configure PBR textures for a terrain visual state.
 * Returns [colorMap, normalMap, roughnessMap] with tiling configured.
 */
function useTerrainTextures(state: TerrainVisualState): [THREE.Texture, THREE.Texture, THREE.Texture] {
  const files = getTerrainTextureFiles(state);
  const colorFile = assetUrl(files.color);
  const normalFile = assetUrl(files.normal);
  const roughFile = assetUrl(files.roughness);

  const [colorMap, normalMap, roughnessMap] = useTexture([colorFile, normalFile, roughFile]);

  useMemo(() => {
    for (const tex of [colorMap, normalMap, roughnessMap]) {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(TERRAIN_TILE_REPEAT, TERRAIN_TILE_REPEAT);
    }
  }, [colorMap, normalMap, roughnessMap]);

  return [colorMap, normalMap, roughnessMap];
}

/**
 * TerrainTextureMesh — applies PBR textures + vertex colors to the terrain.
 * Handles crossfade between era transitions by fading opacity over ~60 frames.
 */
const TerrainTextureMesh: React.FC<{
  geometry: THREE.BufferGeometry;
  era: EraId;
  flatten: number;
}> = ({ geometry, era, flatten }) => {
  const currentState = eraToTerrainState(era);
  const [colorMap, normalMap, roughnessMap] = useTerrainTextures(currentState);

  // Track crossfade state
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const prevStateRef = useRef<TerrainVisualState>(currentState);
  const fadeProgressRef = useRef(1); // 1 = fully visible, 0 = fading in

  // Detect era change → start crossfade
  useEffect(() => {
    if (prevStateRef.current !== currentState) {
      prevStateRef.current = currentState;
      fadeProgressRef.current = 0;
    }
  }, [currentState]);

  // Animate crossfade and apply flatten opacity
  useFrame(() => {
    const mat = matRef.current;
    if (!mat) return;

    if (fadeProgressRef.current < 1) {
      fadeProgressRef.current = Math.min(1, fadeProgressRef.current + 1 / CROSSFADE_FRAMES);
    }
    
    // Combine crossfade with flatten opacity
    const targetOpacity = fadeProgressRef.current * flatten;
    
    mat.opacity = targetOpacity;
    mat.transparent = targetOpacity < 1;
    mat.needsUpdate = true;
  });

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        ref={matRef}
        map={colorMap}
        normalMap={normalMap}
        roughnessMap={roughnessMap}
        vertexColors
        side={THREE.FrontSide}
        roughness={0.9}
        metalness={0}
      />
    </mesh>
  );
};

// ── Component ───────────────────────────────────────────────────────────────

/** Renders the GPU-instanced procedural scatter (trees, rocks, marshes, rail) ON TOP of the celestial shader. */
const TerrainGrid: React.FC<TerrainGridProps> = ({ grid, season = 'summer', flatten = 1 }) => {

  // Season-dependent colors as THREE.Color objects
  const canopyColor = useMemo(() => new THREE.Color(getCanopyColor(season)), [season]);
  const trunkColor = useMemo(() => new THREE.Color('#593f26'), []);
  const rockColor = useMemo(() => new THREE.Color(getRockColor(season)), [season]);
  const reedColor = useMemo(() => new THREE.Color(getReedColor(season)), [season]);
  const tuftColor = useMemo(() => new THREE.Color(getTuftColor(season)), [season]);
  const puddleColor = useMemo(() => new THREE.Color(getPuddleColor(season)), [season]);

  // Build instanced scatter data
  const treeInstances = useMemo(
    () => buildTreeInstances(grid, trunkColor, canopyColor),
    [grid, trunkColor, canopyColor],
  );
  const mountainInstances = useMemo(() => buildMountainInstances(grid, rockColor), [grid, rockColor]);
  const marshInstances = useMemo(
    () => buildMarshInstances(grid, puddleColor, reedColor, tuftColor),
    [grid, puddleColor, reedColor, tuftColor],
  );
  const railInstances = useMemo(() => buildRailInstances(grid), [grid]);

  if (flatten <= 0) return null;

  return (
    <group>
      {/* Trees — 3 instanced batches: trunks, lower cones, upper cones */}
      <ScatterInstance geometry={UNIT_CYLINDER} batch={treeInstances.trunks} transparent={flatten < 1} opacity={flatten} />
      <ScatterInstance geometry={UNIT_CONE} batch={treeInstances.lowerCones} roughness={0.85} transparent={flatten < 1} opacity={flatten} />
      <ScatterInstance geometry={UNIT_CONE} batch={treeInstances.upperCones} roughness={0.85} transparent={flatten < 1} opacity={flatten} />

      {/* Mountains — instanced cone peaks */}
      <ScatterInstance geometry={UNIT_CONE_5} batch={mountainInstances} roughness={0.95} transparent={flatten < 1} opacity={flatten} />

      {/* Marshes — puddles, reed stalks, cattail tufts */}
      <ScatterInstance
        geometry={UNIT_CIRCLE}
        batch={marshInstances.puddles}
        roughness={0.3}
        transparent
        opacity={0.7 * flatten}
        depthWrite={false}
      />
      <ScatterInstance geometry={UNIT_CYLINDER} batch={marshInstances.reeds} transparent={flatten < 1} opacity={flatten} />
      <ScatterInstance geometry={UNIT_CONE_5} batch={marshInstances.tufts} transparent={flatten < 1} opacity={flatten} />

      {/* Rail markers */}
      <ScatterInstance geometry={RAIL_BOX} batch={railInstances} roughness={0.7} metalness={0.3} transparent={flatten < 1} opacity={flatten} />
    </group>
  );
};

export default TerrainGrid;

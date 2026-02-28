/**
 * TerrainGrid — renders a 30x30 isometric terrain grid using a single merged mesh
 * with vertex colors for performance.
 *
 * Terrain types: grass, water, rail, tree, crater, irradiated, mountain, marsh.
 * Supports elevation offsets, season-dependent colors, procedural tree/mountain/marsh geometry.
 *
 * All scatter placement uses a seeded PRNG (mulberry32) for deterministic results
 * across reloads with the same game seed.
 */
import React, { useEffect, useRef } from 'react';
import {
  Color3,
  Color4,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  VertexData,
  Vector3,
  type Scene,
} from '@babylonjs/core';
import { useScene } from 'reactylon';
import { GRID_SIZE, type TerrainType, type GridCell } from '../engine/GridTypes';

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

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

interface TerrainGridProps {
  grid: GridCell[][];
  season?: Season;
}

/** Color palette per terrain type, varying by season */
function getTerrainColor(terrain: TerrainType, season: Season): Color4 {
  switch (terrain) {
    case 'grass':
      switch (season) {
        case 'winter':
          return new Color4(0.75, 0.78, 0.82, 1); // snow-covered
        case 'autumn':
          return new Color4(0.55, 0.50, 0.30, 1); // brown-yellow
        case 'spring':
          return new Color4(0.40, 0.55, 0.30, 1); // fresh green
        case 'summer':
        default:
          return new Color4(0.35, 0.50, 0.28, 1); // green-gray Soviet grass
      }
    case 'water':
      if (season === 'winter') return new Color4(0.65, 0.70, 0.75, 1); // frozen
      return new Color4(0.20, 0.35, 0.55, 1); // dark blue
    case 'rail':
      return new Color4(0.30, 0.30, 0.32, 1); // dark gray
    case 'tree':
      switch (season) {
        case 'winter':
          return new Color4(0.70, 0.73, 0.76, 1); // snow
        case 'autumn':
          return new Color4(0.60, 0.40, 0.20, 1); // orange-brown
        default:
          return new Color4(0.25, 0.42, 0.20, 1); // dark green
      }
    case 'crater':
      return new Color4(0.25, 0.10, 0.30, 1); // dark purple
    case 'irradiated':
      return new Color4(0.40, 0.55, 0.15, 1); // sickly green
    case 'mountain':
      switch (season) {
        case 'winter':
          return new Color4(0.80, 0.82, 0.85, 1); // snow-capped
        default:
          return new Color4(0.42, 0.38, 0.35, 1); // rocky gray-brown
      }
    case 'marsh':
      switch (season) {
        case 'winter':
          return new Color4(0.60, 0.65, 0.68, 1); // frozen mud
        default:
          return new Color4(0.30, 0.38, 0.25, 1); // dark boggy green
      }
    default:
      return new Color4(0.35, 0.50, 0.28, 1);
  }
}

/**
 * Build a single merged ground mesh with per-vertex colors.
 * Each tile is a 1x1 quad on the XZ plane, offset by cell elevation.
 */
function buildTerrainMesh(
  scene: Scene,
  grid: GridCell[][],
  season: Season,
): Mesh {
  const positions: number[] = [];
  const indices: number[] = [];
  const colors: number[] = [];
  const normals: number[] = [];

  let vertIdx = 0;

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const cell = grid[row]?.[col];
      if (!cell) continue;

      const y = cell.z * 0.5; // elevation
      const color = getTerrainColor(cell.terrain, season);

      // Quad corners (XZ plane, Y = elevation)
      // v0---v1
      // |  / |
      // v2---v3
      const x0 = col;
      const z0 = row;

      positions.push(
        x0, y, z0,           // v0
        x0 + 1, y, z0,       // v1
        x0, y, z0 + 1,       // v2
        x0 + 1, y, z0 + 1,   // v3
      );

      // Up-facing normals
      for (let i = 0; i < 4; i++) {
        normals.push(0, 1, 0);
        colors.push(color.r, color.g, color.b, color.a);
      }

      // Two triangles
      indices.push(
        vertIdx, vertIdx + 2, vertIdx + 1,
        vertIdx + 1, vertIdx + 2, vertIdx + 3,
      );

      vertIdx += 4;
    }
  }

  const mesh = new Mesh('terrain', scene);
  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.colors = colors;
  vertexData.applyToMesh(mesh);

  // Material that uses vertex colors
  const mat = new StandardMaterial('terrainMat', scene);
  mat.diffuseColor = Color3.White();
  mat.specularColor = Color3.Black();
  mat.backFaceCulling = true;
  mesh.material = mat;
  mesh.hasVertexAlpha = false;
  mesh.receiveShadows = true;

  return mesh;
}

/**
 * Build conical pine trees for tree tiles — the classic Russian/Soviet taiga look.
 * Each tree: cylinder trunk + two stacked cones (lower wider, upper narrower).
 * Scatters 1-3 trees per forest tile with slight random offset for natural look.
 * Uses seeded RNG for deterministic placement across reloads.
 * Returns array of all tree meshes for disposal tracking.
 */
function buildTrees(
  scene: Scene,
  grid: GridCell[][],
  season: Season,
): Mesh[] {
  const trees: Mesh[] = [];
  const rng = mulberry32(0xF0_BE57); // fixed seed for tree scatter

  const trunkMat = new StandardMaterial('trunkMat', scene);
  trunkMat.diffuseColor = new Color3(0.35, 0.25, 0.15);
  trunkMat.specularColor = Color3.Black();

  const canopyMat = new StandardMaterial('canopyMat', scene);
  canopyMat.specularColor = Color3.Black();
  switch (season) {
    case 'winter':
      canopyMat.diffuseColor = new Color3(0.75, 0.78, 0.82); // snow-dusted
      break;
    case 'autumn':
      canopyMat.diffuseColor = new Color3(0.25, 0.35, 0.15); // evergreen stays green
      break;
    default:
      canopyMat.diffuseColor = new Color3(0.15, 0.35, 0.10); // dark conifer green
  }

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const cell = grid[row]?.[col];
      if (!cell || cell.terrain !== 'tree') continue;

      const y = cell.z * 0.5;

      // Scatter 1-3 trees per forest tile for a natural clustered look
      const treeCount = 1 + Math.floor(rng() * 3); // 1, 2, or 3

      for (let t = 0; t < treeCount; t++) {
        // Random offset within the tile (keep 0.15 padding from edges)
        const ox = 0.15 + rng() * 0.7;
        const oz = 0.15 + rng() * 0.7;
        const cx = col + ox;
        const cz = row + oz;

        // Slight random variation in size so trees don't look uniform
        const scale = 0.6 + rng() * 0.5;
        const yaw = rng() * Math.PI * 2;

        // Trunk
        const trunk = MeshBuilder.CreateCylinder(
          `trunk_${row}_${col}_${t}`,
          { height: 0.5 * scale, diameter: 0.12, tessellation: 5 },
          scene,
        );
        trunk.position = new Vector3(cx, y + 0.25 * scale, cz);
        trunk.material = trunkMat;

        // Lower cone (wider)
        const lowerCone = MeshBuilder.CreateCylinder(
          `cone_lo_${row}_${col}_${t}`,
          { height: 0.6 * scale, diameterTop: 0.05, diameterBottom: 0.65 * scale, tessellation: 6 },
          scene,
        );
        lowerCone.position = new Vector3(cx, y + 0.55 * scale, cz);
        lowerCone.rotation.y = yaw;
        lowerCone.material = canopyMat;

        // Upper cone (narrower, overlapping)
        const upperCone = MeshBuilder.CreateCylinder(
          `cone_hi_${row}_${col}_${t}`,
          { height: 0.5 * scale, diameterTop: 0, diameterBottom: 0.45 * scale, tessellation: 6 },
          scene,
        );
        upperCone.position = new Vector3(cx, y + 0.9 * scale, cz);
        upperCone.rotation.y = yaw;
        upperCone.material = canopyMat;

        trees.push(trunk, lowerCone, upperCone);
      }
    }
  }

  return trees;
}

/**
 * Build rocky mountain peaks for mountain tiles.
 * Each mountain: 2-3 irregular cones to look like a craggy peak.
 * Uses seeded RNG for deterministic placement.
 */
function buildMountains(
  scene: Scene,
  grid: GridCell[][],
  season: Season,
): Mesh[] {
  const rocks: Mesh[] = [];
  const rng = mulberry32(0xD0C4_A1B5); // fixed seed for mountain scatter

  const rockMat = new StandardMaterial('rockMat', scene);
  rockMat.specularColor = Color3.Black();
  if (season === 'winter') {
    rockMat.diffuseColor = new Color3(0.82, 0.84, 0.88); // snow-capped rock
  } else {
    rockMat.diffuseColor = new Color3(0.45, 0.40, 0.35); // gray-brown rock
  }

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const cell = grid[row]?.[col];
      if (!cell || cell.terrain !== 'mountain') continue;

      const y = cell.z * 0.5;
      const cx = col + 0.5;
      const cz = row + 0.5;

      const scale = 0.7 + rng() * 0.3;

      // Main peak — tall narrow cone
      const peak = MeshBuilder.CreateCylinder(
        `peak_${row}_${col}`,
        {
          height: 1.2 * scale,
          diameterTop: 0.05,
          diameterBottom: 0.7 * scale,
          tessellation: 5,
        },
        scene,
      );
      peak.position = new Vector3(cx, y + 0.6 * scale, cz);
      peak.material = rockMat;

      // Secondary shorter peak, offset
      const offsetX = (rng() - 0.5) * 0.4;
      const offsetZ = (rng() - 0.5) * 0.3;
      const peak2 = MeshBuilder.CreateCylinder(
        `peak2_${row}_${col}`,
        {
          height: 0.7 * scale,
          diameterTop: 0.03,
          diameterBottom: 0.5 * scale,
          tessellation: 5,
        },
        scene,
      );
      peak2.position = new Vector3(cx + 0.25 + offsetX, y + 0.35 * scale, cz + 0.2 + offsetZ);
      peak2.material = rockMat;

      rocks.push(peak, peak2);

      // Optional third crag for visual variety (30% chance)
      if (rng() < 0.3) {
        const ox3 = (rng() - 0.5) * 0.5;
        const oz3 = (rng() - 0.5) * 0.5;
        const peak3 = MeshBuilder.CreateCylinder(
          `peak3_${row}_${col}`,
          {
            height: 0.5 * scale,
            diameterTop: 0.02,
            diameterBottom: 0.35 * scale,
            tessellation: 5,
          },
          scene,
        );
        peak3.position = new Vector3(cx - 0.2 + ox3, y + 0.25 * scale, cz - 0.15 + oz3);
        peak3.material = rockMat;
        rocks.push(peak3);
      }
    }
  }

  return rocks;
}

/**
 * Build marsh features for marsh tiles — reed-like thin cylinders + tufts.
 * Each marsh tile gets 2-4 reed clusters scattered for a boggy, overgrown look.
 * Uses seeded RNG for deterministic placement.
 */
function buildMarshes(
  scene: Scene,
  grid: GridCell[][],
  season: Season,
): Mesh[] {
  const meshes: Mesh[] = [];
  const rng = mulberry32(0xBA_D5EA); // fixed seed for marsh scatter

  // Reed material — dark green-brown stalks
  const reedMat = new StandardMaterial('reedMat', scene);
  reedMat.specularColor = Color3.Black();
  switch (season) {
    case 'winter':
      reedMat.diffuseColor = new Color3(0.55, 0.50, 0.42); // dried tan-brown
      break;
    case 'autumn':
      reedMat.diffuseColor = new Color3(0.50, 0.42, 0.25); // golden-brown
      break;
    default:
      reedMat.diffuseColor = new Color3(0.25, 0.40, 0.18); // dark marsh green
  }

  // Tuft material — lighter leafy tops
  const tuftMat = new StandardMaterial('tuftMat', scene);
  tuftMat.specularColor = Color3.Black();
  switch (season) {
    case 'winter':
      tuftMat.diffuseColor = new Color3(0.60, 0.58, 0.52); // faded tan
      break;
    case 'autumn':
      tuftMat.diffuseColor = new Color3(0.55, 0.48, 0.30); // dry golden
      break;
    default:
      tuftMat.diffuseColor = new Color3(0.30, 0.50, 0.22); // marsh green
  }

  // Water puddle material — small dark patches on marsh ground
  const puddleMat = new StandardMaterial('puddleMat', scene);
  puddleMat.specularColor = Color3.Black();
  puddleMat.alpha = 0.7;
  if (season === 'winter') {
    puddleMat.diffuseColor = new Color3(0.65, 0.70, 0.75); // frozen puddle
  } else {
    puddleMat.diffuseColor = new Color3(0.15, 0.25, 0.20); // dark murky water
  }

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const cell = grid[row]?.[col];
      if (!cell || cell.terrain !== 'marsh') continue;

      const y = cell.z * 0.5;

      // Small water puddle on the tile
      const puddle = MeshBuilder.CreateDisc(
        `puddle_${row}_${col}`,
        { radius: 0.2 + rng() * 0.15, tessellation: 8 },
        scene,
      );
      puddle.rotation.x = Math.PI / 2; // lay flat on XZ plane
      const px = col + 0.3 + rng() * 0.4;
      const pz = row + 0.3 + rng() * 0.4;
      puddle.position = new Vector3(px, y + 0.01, pz);
      puddle.material = puddleMat;
      meshes.push(puddle);

      // Scatter 2-4 reed clusters per marsh tile
      const reedCount = 2 + Math.floor(rng() * 3); // 2, 3, or 4

      for (let r = 0; r < reedCount; r++) {
        const ox = 0.1 + rng() * 0.8;
        const oz = 0.1 + rng() * 0.8;
        const cx = col + ox;
        const cz = row + oz;

        // Reed stalk — thin tall cylinder
        const height = 0.3 + rng() * 0.4;
        const reed = MeshBuilder.CreateCylinder(
          `reed_${row}_${col}_${r}`,
          { height, diameter: 0.03, tessellation: 4 },
          scene,
        );
        reed.position = new Vector3(cx, y + height / 2, cz);
        // Slight tilt for natural look
        reed.rotation.x = (rng() - 0.5) * 0.3;
        reed.rotation.z = (rng() - 0.5) * 0.3;
        reed.material = reedMat;
        meshes.push(reed);

        // Cattail / tuft on top — flattened sphere
        const tuft = MeshBuilder.CreateCylinder(
          `tuft_${row}_${col}_${r}`,
          {
            height: 0.08,
            diameterTop: 0.01,
            diameterBottom: 0.06 + rng() * 0.04,
            tessellation: 5,
          },
          scene,
        );
        tuft.position = new Vector3(cx, y + height + 0.02, cz);
        tuft.rotation.x = reed.rotation.x;
        tuft.rotation.z = reed.rotation.z;
        tuft.material = tuftMat;
        meshes.push(tuft);
      }
    }
  }

  return meshes;
}

const TerrainGrid: React.FC<TerrainGridProps> = ({ grid, season = 'summer' }) => {
  const scene = useScene();
  const terrainRef = useRef<Mesh | null>(null);
  const treesRef = useRef<Mesh[]>([]);
  const mountainsRef = useRef<Mesh[]>([]);
  const marshesRef = useRef<Mesh[]>([]);

  useEffect(() => {
    // Clean up previous terrain
    if (terrainRef.current) {
      terrainRef.current.dispose();
    }
    for (const tree of treesRef.current) {
      tree.dispose();
    }
    for (const rock of mountainsRef.current) {
      rock.dispose();
    }
    for (const marsh of marshesRef.current) {
      marsh.dispose();
    }

    // Build new terrain
    terrainRef.current = buildTerrainMesh(scene, grid, season);
    treesRef.current = buildTrees(scene, grid, season);
    mountainsRef.current = buildMountains(scene, grid, season);
    marshesRef.current = buildMarshes(scene, grid, season);

    return () => {
      terrainRef.current?.dispose();
      for (const tree of treesRef.current) {
        tree.dispose();
      }
      for (const rock of mountainsRef.current) {
        rock.dispose();
      }
      for (const marsh of marshesRef.current) {
        marsh.dispose();
      }
    };
  }, [scene, grid, season]);

  // Imperative mesh creation — no JSX children needed
  return null;
};

export default TerrainGrid;

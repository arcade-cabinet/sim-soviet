/**
 * TerrainGrid — renders a 30x30 terrain grid using a single BufferGeometry
 * with per-vertex colors, plus procedural tree/mountain/marsh scatter.
 *
 * Terrain types: grass, water, rail, tree, crater, irradiated, mountain, marsh, path.
 * Supports elevation offsets, season-dependent colors, procedural scatter geometry.
 *
 * All scatter placement uses a seeded PRNG (mulberry32) for deterministic results
 * across reloads with the same game seed.
 *
 * R3F migration: uses <mesh> with <bufferGeometry> + <meshStandardMaterial>
 * with vertexColors. Trees/mountains/marshes rendered as grouped JSX meshes.
 */
import type React from 'react';
import { useMemo } from 'react';
import * as THREE from 'three/webgpu';
import { GRID_SIZE, type GridCell, type TerrainType } from '../engine/GridTypes';

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
function getTerrainColor(terrain: TerrainType, season: Season): [number, number, number] {
  switch (terrain) {
    case 'grass':
      switch (season) {
        case 'winter':
          return [0.75, 0.78, 0.82]; // snow-covered
        case 'autumn':
          return [0.55, 0.5, 0.3]; // brown-yellow
        case 'spring':
          return [0.4, 0.55, 0.3]; // fresh green
        default:
          return [0.35, 0.5, 0.28]; // green-gray Soviet grass
      }
    case 'water':
      if (season === 'winter') return [0.65, 0.7, 0.75]; // frozen
      return [0.2, 0.35, 0.55]; // dark blue
    case 'rail':
      return [0.3, 0.3, 0.32]; // dark gray
    case 'tree':
      switch (season) {
        case 'winter':
          return [0.7, 0.73, 0.76]; // snow
        case 'autumn':
          return [0.6, 0.4, 0.2]; // orange-brown
        default:
          return [0.25, 0.42, 0.2]; // dark green
      }
    case 'crater':
      return [0.25, 0.1, 0.3]; // dark purple
    case 'irradiated':
      return [0.4, 0.55, 0.15]; // sickly green
    case 'mountain':
      switch (season) {
        case 'winter':
          return [0.8, 0.82, 0.85]; // snow-capped
        default:
          return [0.42, 0.38, 0.35]; // rocky gray-brown
      }
    case 'marsh':
      switch (season) {
        case 'winter':
          return [0.6, 0.65, 0.68]; // frozen mud
        default:
          return [0.3, 0.38, 0.25]; // dark boggy green
      }
    case 'path':
      switch (season) {
        case 'winter':
          return [0.58, 0.55, 0.5]; // snow-dusted dirt
        case 'autumn':
          return [0.42, 0.35, 0.25]; // muddy brown
        case 'spring':
          return [0.45, 0.38, 0.28]; // wet earth
        default:
          return [0.48, 0.4, 0.3]; // packed earth brown
      }
    default:
      return [0.35, 0.5, 0.28];
  }
}

// ── Terrain Mesh ────────────────────────────────────────────────────────────

/**
 * Build a PlaneGeometry with per-vertex colors and elevation from grid data.
 * Each tile is a 1x1 quad on the XZ plane, offset by cell elevation.
 */
function buildTerrainGeometry(grid: GridCell[][], season: Season): THREE.BufferGeometry {
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
      const [cr, cg, cb] = getTerrainColor(cell.terrain, season);

      // Quad corners (XZ plane, Y = elevation)
      // v0---v1
      // |  / |
      // v2---v3
      const x0 = col;
      const z0 = row;

      positions.push(
        x0,
        y,
        z0, // v0
        x0 + 1,
        y,
        z0, // v1
        x0,
        y,
        z0 + 1, // v2
        x0 + 1,
        y,
        z0 + 1, // v3
      );

      // Up-facing normals
      for (let i = 0; i < 4; i++) {
        normals.push(0, 1, 0);
        colors.push(cr, cg, cb);
      }

      // Two triangles (CCW winding for Three.js front face)
      indices.push(vertIdx, vertIdx + 2, vertIdx + 1, vertIdx + 1, vertIdx + 2, vertIdx + 3);

      vertIdx += 4;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);

  return geometry;
}

// ── Tree Data ───────────────────────────────────────────────────────────────

interface TreeData {
  position: [number, number, number];
  scale: number;
  yaw: number;
}

function collectTrees(grid: GridCell[][]): TreeData[] {
  const trees: TreeData[] = [];
  const rng = mulberry32(0xf0_be57);

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const cell = grid[row]?.[col];
      if (!cell || cell.terrain !== 'tree') continue;

      const y = cell.z * 0.5;
      const treeCount = 1 + Math.floor(rng() * 3);

      for (let t = 0; t < treeCount; t++) {
        const ox = 0.15 + rng() * 0.7;
        const oz = 0.15 + rng() * 0.7;
        const scale = 0.6 + rng() * 0.5;
        const yaw = rng() * Math.PI * 2;

        trees.push({
          position: [col + ox, y, row + oz],
          scale,
          yaw,
        });
      }
    }
  }

  return trees;
}

// ── Mountain Data ───────────────────────────────────────────────────────────

interface MountainPeak {
  position: [number, number, number];
  height: number;
  bottomRadius: number;
}

interface MountainData {
  peaks: MountainPeak[];
}

function collectMountains(grid: GridCell[][]): MountainData[] {
  const mountains: MountainData[] = [];
  const rng = mulberry32(0xd0c4_a1b5);

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const cell = grid[row]?.[col];
      if (!cell || cell.terrain !== 'mountain') continue;

      const y = cell.z * 0.5;
      const cx = col + 0.5;
      const cz = row + 0.5;
      const scale = 0.7 + rng() * 0.3;

      const peaks: MountainPeak[] = [];

      // Main peak
      peaks.push({
        position: [cx, y + 0.6 * scale, cz],
        height: 1.2 * scale,
        bottomRadius: 0.35 * scale,
      });

      // Secondary peak
      const offsetX = (rng() - 0.5) * 0.4;
      const offsetZ = (rng() - 0.5) * 0.3;
      peaks.push({
        position: [cx + 0.25 + offsetX, y + 0.35 * scale, cz + 0.2 + offsetZ],
        height: 0.7 * scale,
        bottomRadius: 0.25 * scale,
      });

      // Optional third peak (30% chance)
      if (rng() < 0.3) {
        const ox3 = (rng() - 0.5) * 0.5;
        const oz3 = (rng() - 0.5) * 0.5;
        peaks.push({
          position: [cx - 0.2 + ox3, y + 0.25 * scale, cz - 0.15 + oz3],
          height: 0.5 * scale,
          bottomRadius: 0.175 * scale,
        });
      }

      mountains.push({ peaks });
    }
  }

  return mountains;
}

// ── Marsh Data ──────────────────────────────────────────────────────────────

interface ReedData {
  position: [number, number, number];
  height: number;
  tiltX: number;
  tiltZ: number;
  tuftBottomRadius: number;
}

interface PuddleData {
  position: [number, number, number];
  radius: number;
}

interface MarshTileData {
  puddle: PuddleData;
  reeds: ReedData[];
}

function collectMarshes(grid: GridCell[][]): MarshTileData[] {
  const marshes: MarshTileData[] = [];
  const rng = mulberry32(0xba_d5ea);

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const cell = grid[row]?.[col];
      if (!cell || cell.terrain !== 'marsh') continue;

      const y = cell.z * 0.5;

      const puddle: PuddleData = {
        position: [col + 0.3 + rng() * 0.4, y + 0.01, row + 0.3 + rng() * 0.4],
        radius: 0.2 + rng() * 0.15,
      };

      const reeds: ReedData[] = [];
      const reedCount = 2 + Math.floor(rng() * 3);

      for (let r = 0; r < reedCount; r++) {
        const ox = 0.1 + rng() * 0.8;
        const oz = 0.1 + rng() * 0.8;
        const height = 0.3 + rng() * 0.4;
        const tiltX = (rng() - 0.5) * 0.3;
        const tiltZ = (rng() - 0.5) * 0.3;
        const tuftBottomRadius = 0.06 + rng() * 0.04;

        reeds.push({
          position: [col + ox, y, row + oz],
          height,
          tiltX,
          tiltZ,
          tuftBottomRadius,
        });
      }

      marshes.push({ puddle, reeds });
    }
  }

  return marshes;
}

// ── Rail Marker Data ────────────────────────────────────────────────────────

interface RailMarker {
  position: [number, number, number];
}

function collectRailMarkers(grid: GridCell[][]): RailMarker[] {
  const markers: RailMarker[] = [];

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const cell = grid[row]?.[col];
      if (!cell || cell.terrain !== 'rail') continue;

      markers.push({
        position: [col + 0.5, cell.z * 0.5 + 0.025, row + 0.5],
      });
    }
  }

  return markers;
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

// ── Component ───────────────────────────────────────────────────────────────

const TerrainGrid: React.FC<TerrainGridProps> = ({ grid, season = 'summer' }) => {
  // Build terrain geometry with per-vertex colors
  const terrainGeometry = useMemo(() => buildTerrainGeometry(grid, season), [grid, season]);

  // Collect scatter data
  const trees = useMemo(() => collectTrees(grid), [grid]);
  const mountains = useMemo(() => collectMountains(grid), [grid]);
  const marshes = useMemo(() => collectMarshes(grid), [grid]);
  const railMarkers = useMemo(() => collectRailMarkers(grid), [grid]);

  // Season-dependent colors
  const canopyColor = getCanopyColor(season);
  const rockColor = getRockColor(season);
  const reedColor = getReedColor(season);
  const tuftColor = getTuftColor(season);
  const puddleColor = getPuddleColor(season);

  return (
    <group>
      {/* Main terrain mesh with per-vertex colors */}
      <mesh geometry={terrainGeometry} receiveShadow>
        <meshStandardMaterial vertexColors side={THREE.FrontSide} roughness={0.9} metalness={0} />
      </mesh>

      {/* Trees — conical pines (trunk + two stacked cones) */}
      {trees.map((tree, i) => {
        const [tx, ty, tz] = tree.position;
        const s = tree.scale;
        return (
          <group key={`tree_${i}`} position={[tx, ty, tz]}>
            {/* Trunk */}
            <mesh position={[0, 0.25 * s, 0]}>
              <cylinderGeometry args={[0.06, 0.06, 0.5 * s, 5]} />
              <meshStandardMaterial color="#593f26" roughness={0.9} />
            </mesh>
            {/* Lower cone (wider) */}
            <mesh position={[0, 0.55 * s, 0]} rotation={[0, tree.yaw, 0]}>
              <coneGeometry args={[0.325 * s, 0.6 * s, 6]} />
              <meshStandardMaterial color={canopyColor} roughness={0.85} />
            </mesh>
            {/* Upper cone (narrower) */}
            <mesh position={[0, 0.9 * s, 0]} rotation={[0, tree.yaw, 0]}>
              <coneGeometry args={[0.225 * s, 0.5 * s, 6]} />
              <meshStandardMaterial color={canopyColor} roughness={0.85} />
            </mesh>
          </group>
        );
      })}

      {/* Mountains — craggy cone peaks */}
      {mountains.map((mountain, mi) =>
        mountain.peaks.map((peak, pi) => (
          <mesh key={`mtn_${mi}_${pi}`} position={peak.position}>
            <coneGeometry args={[peak.bottomRadius, peak.height, 5]} />
            <meshStandardMaterial color={rockColor} roughness={0.95} />
          </mesh>
        )),
      )}

      {/* Marshes — puddles + reeds + tufts */}
      {marshes.map((marsh, mi) => (
        <group key={`marsh_${mi}`}>
          {/* Puddle disc (flat circle on XZ plane) */}
          <mesh position={marsh.puddle.position} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[marsh.puddle.radius, 8]} />
            <meshStandardMaterial color={puddleColor} transparent opacity={0.7} roughness={0.3} />
          </mesh>

          {/* Reeds */}
          {marsh.reeds.map((reed, ri) => {
            const [rx, ry, rz] = reed.position;
            return (
              <group key={`reed_${mi}_${ri}`}>
                {/* Reed stalk */}
                <mesh position={[rx, ry + reed.height / 2, rz]} rotation={[reed.tiltX, 0, reed.tiltZ]}>
                  <cylinderGeometry args={[0.015, 0.015, reed.height, 4]} />
                  <meshStandardMaterial color={reedColor} roughness={0.9} />
                </mesh>
                {/* Cattail tuft on top */}
                <mesh position={[rx, ry + reed.height + 0.02, rz]} rotation={[reed.tiltX, 0, reed.tiltZ]}>
                  <coneGeometry args={[reed.tuftBottomRadius, 0.08, 5]} />
                  <meshStandardMaterial color={tuftColor} roughness={0.9} />
                </mesh>
              </group>
            );
          })}
        </group>
      ))}

      {/* Rail markers — small cubes on rail tiles */}
      {railMarkers.map((marker, i) => (
        <mesh key={`rail_${i}`} position={marker.position}>
          <boxGeometry args={[0.9, 0.05, 0.9]} />
          <meshStandardMaterial color="#4d4d52" roughness={0.7} metalness={0.3} />
        </mesh>
      ))}
    </group>
  );
};

export default TerrainGrid;

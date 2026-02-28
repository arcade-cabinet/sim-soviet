/**
 * SceneProps -- Environmental detail scattering.
 *
 * Loads GLB prop models (rocks, bushes, grass, mushrooms, animals) and
 * scatters them around the map for visual richness. Props are placed:
 *   - Rocks: on perimeter, mountain, and empty tiles
 *   - Bushes/grass: on empty grass tiles
 *   - Mushrooms: near forests
 *   - Animals (cows, horses, donkeys): wander on grass tiles near farms
 *
 * Uses a seeded random (mulberry32) for deterministic placement so props
 * don't jump on re-render. Animals get a simple wandering animation.
 *
 * R3F migration: uses drei useGLTF + Clone for model instancing.
 * Each prop wrapped in React.Suspense. Animal wandering via useFrame.
 */

import { Clone, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type React from 'react';
import { Suspense, useMemo, useRef } from 'react';
import type * as THREE from 'three';
import { gameState } from '../engine/GameState';
import { GRID_SIZE } from '../engine/GridTypes';
import { getPropUrl } from './ModelPreloader';
import type { Season } from './TerrainGrid';

// ── Seeded PRNG (mulberry32) for deterministic scatter ──────────────────────

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Prop definitions ────────────────────────────────────────────────────────

interface PropTemplate {
  name: string;
  file: string;
  count: number;
  scale: [number, number];
  placement: 'perimeter' | 'grass' | 'forest-edge' | 'farm-animal' | 'irradiated';
}

const PROP_DEFS: PropTemplate[] = [
  // Rocks
  { name: 'Rock1', file: 'Rock_Medium_1.glb', count: 12, scale: [0.3, 0.8], placement: 'perimeter' },
  { name: 'Rock2', file: 'Rock_Medium_2.glb', count: 10, scale: [0.2, 0.6], placement: 'perimeter' },
  { name: 'Rock3', file: 'Rock_Medium_3.glb', count: 8, scale: [0.3, 0.7], placement: 'grass' },

  // Bushes
  { name: 'Bush', file: 'Bush_Common.glb', count: 15, scale: [0.25, 0.5], placement: 'grass' },

  // Grass clumps
  { name: 'GrassShort', file: 'Grass_Common_Short.glb', count: 25, scale: [0.3, 0.6], placement: 'grass' },
  { name: 'GrassWispy', file: 'Grass_Wispy_Short.glb', count: 20, scale: [0.3, 0.5], placement: 'grass' },

  // Mushrooms
  { name: 'Mushroom', file: 'Mushroom_Common.glb', count: 8, scale: [0.15, 0.3], placement: 'forest-edge' },

  // Animals
  { name: 'Cow', file: 'Cow.glb', count: 4, scale: [0.08, 0.1], placement: 'farm-animal' },
  { name: 'Horse', file: 'Horse_White.glb', count: 3, scale: [0.08, 0.1], placement: 'farm-animal' },
  { name: 'Donkey', file: 'Donkey.glb', count: 3, scale: [0.07, 0.09], placement: 'farm-animal' },

  // Radiation
  { name: 'RadBarrel', file: 'rad_barrel.glb', count: 6, scale: [0.5, 0.8], placement: 'irradiated' },
  { name: 'RadSign', file: 'rad_sign.glb', count: 4, scale: [0.6, 0.9], placement: 'irradiated' },
  { name: 'RadDebris', file: 'rad_debris.glb', count: 5, scale: [0.4, 0.7], placement: 'irradiated' },
  { name: 'RadGlow', file: 'rad_glow.glb', count: 10, scale: [0.8, 1.5], placement: 'irradiated' },
];

// ── Placement position logic ────────────────────────────────────────────────

function getPlacementPositions(
  placement: PropTemplate['placement'],
  rng: () => number,
): Array<{ x: number; z: number; y: number }> {
  const positions: Array<{ x: number; z: number; y: number }> = [];
  const grid = gameState.grid;
  const center = GRID_SIZE / 2;

  switch (placement) {
    case 'perimeter': {
      for (let i = 0; i < 40; i++) {
        const angle = rng() * Math.PI * 2;
        const dist = GRID_SIZE * 0.5 + rng() * 30 + 5;
        positions.push({
          x: center + Math.cos(angle) * dist,
          z: center + Math.sin(angle) * dist,
          y: 0,
        });
      }
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
      for (let y = 1; y < GRID_SIZE - 1; y++) {
        for (let x = 1; x < GRID_SIZE - 1; x++) {
          const cell = grid[y]?.[x];
          if (cell && !cell.type && cell.terrain !== 'tree') {
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
      const farms = gameState.buildings.filter(
        (b) => b.type === 'collective-farm-hq' || b.type === 'zone-farm' || b.type === 'farm',
      );
      for (const farm of farms) {
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
    case 'irradiated': {
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          const cell = grid[y]?.[x];
          if (cell?.terrain === 'irradiated') {
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
  }

  return positions;
}

// ── Single prop model instance (loads GLB via useGLTF) ──────────────────────

interface PropInstanceProps {
  url: string;
  position: [number, number, number];
  scale: number;
  rotationY: number;
}

const PropInstance: React.FC<PropInstanceProps> = ({ url, position, scale, rotationY }) => {
  const { scene } = useGLTF(url);

  return <Clone object={scene} position={position} scale={[scale, scale, scale]} rotation={[0, rotationY, 0]} />;
};

// ── Animal instance with wandering animation ────────────────────────────────

interface AnimalInstanceProps {
  url: string;
  basePos: [number, number, number];
  scale: number;
  initialRotY: number;
  wanderSpeed: number;
  wanderRadius: number;
  timeOffset: number;
}

const AnimalInstance: React.FC<AnimalInstanceProps> = ({
  url,
  basePos,
  scale,
  initialRotY,
  wanderSpeed,
  wanderRadius,
  timeOffset,
}) => {
  const { scene } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(timeOffset);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    timeRef.current += delta * wanderSpeed;
    const nx = basePos[0] + Math.sin(timeRef.current) * wanderRadius;
    const nz = basePos[2] + Math.cos(timeRef.current * 0.7) * wanderRadius;

    // Face movement direction
    const dx = nx - group.position.x;
    const dz = nz - group.position.z;
    if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
      group.rotation.y = Math.atan2(dx, dz);
    }

    group.position.x = nx;
    group.position.z = nz;
  });

  return (
    <group ref={groupRef} position={basePos} scale={[scale, scale, scale]} rotation={[0, initialRotY, 0]}>
      <Clone object={scene} />
    </group>
  );
};

// ── Pre-computed placement data (avoids recalculating every render) ──────────

interface PlacedProp {
  url: string;
  position: [number, number, number];
  scale: number;
  rotationY: number;
  isAnimal: boolean;
  wanderSpeed: number;
  wanderRadius: number;
  timeOffset: number;
}

function computePlacements(season: Season): PlacedProp[] {
  if (!gameState.grid.length) return [];

  const rng = mulberry32(42 + (season === 'winter' ? 0 : season === 'spring' ? 1 : season === 'summer' ? 2 : 3));

  const placements: PlacedProp[] = [];

  for (const def of PROP_DEFS) {
    // Skip grass/bush props in winter (snow covers them)
    if (season === 'winter' && def.placement === 'grass' && def.name !== 'Rock3') {
      continue;
    }

    const url = getPropUrl(def.file);
    if (!url) continue;

    const positions = getPlacementPositions(def.placement, rng);
    const count = Math.min(def.count, positions.length);

    for (let i = 0; i < count; i++) {
      const pos = positions[i];
      const s = def.scale[0] + rng() * (def.scale[1] - def.scale[0]);
      const rotY = rng() * Math.PI * 2;

      const isAnimal = def.placement === 'farm-animal';

      placements.push({
        url,
        position: [pos.x, pos.y, pos.z],
        scale: s,
        rotationY: rotY,
        isAnimal,
        wanderSpeed: isAnimal ? 0.1 + rng() * 0.2 : 0,
        wanderRadius: isAnimal ? 0.5 + rng() * 1.5 : 0,
        timeOffset: isAnimal ? rng() * 100 : 0,
      });
    }
  }

  return placements;
}

// ── Main component ──────────────────────────────────────────────────────────

interface ScenePropsProps {
  season?: Season;
}

const SceneProps: React.FC<ScenePropsProps> = ({ season = 'winter' }) => {
  // Memoize placements based on season (deterministic via seeded RNG)
  const placements = useMemo(() => computePlacements(season), [season]);

  return (
    <>
      {placements.map((p, i) => (
        <Suspense key={`${season}-${i}`} fallback={null}>
          {p.isAnimal ? (
            <AnimalInstance
              url={p.url}
              basePos={p.position}
              scale={p.scale}
              initialRotY={p.rotationY}
              wanderSpeed={p.wanderSpeed}
              wanderRadius={p.wanderRadius}
              timeOffset={p.timeOffset}
            />
          ) : (
            <PropInstance url={p.url} position={p.position} scale={p.scale} rotationY={p.rotationY} />
          )}
        </Suspense>
      ))}
    </>
  );
};

export default SceneProps;

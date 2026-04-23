/**
 * WWIIOverlay — Visual effects active during the great_patriotic era (1941-1946).
 *
 * Three sub-systems:
 * 1. BomberSilhouettes — dark elongated meshes crossing the sky on slow arcs (~30s period)
 * 2. CraterDecals — circular dark terrain decals placed via seeded RNG
 * 3. BuildingSmoke — Points-based dark smoke particles rising from ~20% of buildings
 *
 * All effects activate when `active` prop is true and deactivate gracefully.
 */

import { useFrame } from '@react-three/fiber';
import type React from 'react';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { gameState } from '../engine/GameState';
import { getCurrentGridSize } from '../engine/GridTypes';

// ── Configuration ──────────────────────────────────────────────────────────

/** Number of bomber silhouettes visible at once */
const BOMBER_COUNT = 3;

/** Time in seconds for a bomber to cross the sky */
const BOMBER_CROSSING_TIME = 25;

/** Stagger interval between bombers (seconds) */
const BOMBER_STAGGER = 10;

/** Maximum crater decals on the terrain */
const MAX_CRATERS = 40;

/** Number of buildings that emit smoke */
const MAX_SMOKE_SOURCES = 15;

/** Particles per smoke source */
const PARTICLES_PER_SOURCE = 12;

/** Total smoke particles */
const MAX_SMOKE_PARTICLES = MAX_SMOKE_SOURCES * PARTICLES_PER_SOURCE;

/** Height of smoke column */
const SMOKE_HEIGHT = 2.5;

// ── Seeded RNG (simple mulberry32) ─────────────────────────────────────────

function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── BomberSilhouettes ──────────────────────────────────────────────────────

interface BomberState {
  /** Progress 0-1 across the sky */
  progress: number;
  /** Lateral offset (z-axis) */
  zOffset: number;
  /** Y altitude */
  altitude: number;
  /** Speed multiplier */
  speed: number;
}

/**
 * Renders dark bomber silhouettes crossing the sky on slow arcs.
 * Uses simple elongated box meshes — at altitude they read as distant aircraft.
 */
const BomberSilhouettes: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const elapsedRef = useRef(0);

  // Initialize bomber states with staggered start times
  const bombers = useMemo<BomberState[]>(() => {
    const rng = mulberry32(1941);
    return Array.from({ length: BOMBER_COUNT }, (_, i) => ({
      progress: -(i * BOMBER_STAGGER) / BOMBER_CROSSING_TIME,
      zOffset: (rng() - 0.5) * 20,
      altitude: 18 + rng() * 8,
      speed: 0.8 + rng() * 0.4,
    }));
  }, []);

  useFrame((_, delta) => {
    elapsedRef.current += delta;
    const gridSize = getCurrentGridSize();
    const span = gridSize * 1.5;

    for (let i = 0; i < BOMBER_COUNT; i++) {
      const bomber = bombers[i];
      const mesh = meshRefs.current[i];
      if (!mesh) continue;

      // Advance progress
      bomber.progress += (delta / BOMBER_CROSSING_TIME) * bomber.speed;

      // Reset when off-screen
      if (bomber.progress > 1.3) {
        bomber.progress = -0.3;
        const rng = mulberry32(elapsedRef.current * 1000 + i);
        bomber.zOffset = (rng() - 0.5) * 20;
        bomber.altitude = 18 + rng() * 8;
      }

      const x = (bomber.progress - 0.5) * span * 2;
      const y = bomber.altitude + Math.sin(bomber.progress * Math.PI) * 3;
      const z = gridSize / 2 + bomber.zOffset;

      mesh.position.set(x, y, z);
      // Slight banking rotation
      mesh.rotation.z = Math.sin(bomber.progress * Math.PI * 2) * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: BOMBER_COUNT }, (_, i) => (
        <mesh
          key={`bomber_${i}`}
          ref={(el) => {
            meshRefs.current[i] = el;
          }}
          rotation={[0, Math.PI / 2, 0]}
        >
          {/* Elongated fuselage silhouette */}
          <boxGeometry args={[0.15, 0.08, 1.2]} />
          <meshBasicMaterial color="#1a1a1a" transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  );
};

// ── CraterDecals ───────────────────────────────────────────────────────────

/**
 * Renders circular dark decals on the terrain, simulating bomb craters.
 * Positions are deterministic (seeded from grid size) so they persist across re-renders.
 */
const CraterDecals: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const geometry = useMemo(() => new THREE.CircleGeometry(0.4, 12), []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#2a1a0a',
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  );

  // Place craters using seeded RNG
  const tmpMatrix = useMemo(() => new THREE.Matrix4(), []);
  const tmpPos = useMemo(() => new THREE.Vector3(), []);
  const tmpScale = useMemo(() => new THREE.Vector3(), []);
  const tmpQuat = useMemo(() => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), []);

  const placedRef = useRef(false);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh || placedRef.current) return;
    placedRef.current = true;

    const gridSize = getCurrentGridSize();
    const rng = mulberry32(194145); // deterministic seed
    let count = 0;

    for (let i = 0; i < MAX_CRATERS; i++) {
      const x = rng() * gridSize;
      const z = rng() * gridSize;
      const scale = 0.5 + rng() * 1.0;

      // Place flat on ground, rotated to face up
      tmpPos.set(x, 0.02, z);
      tmpScale.set(scale, scale, 1);
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);

      mesh.setMatrixAt(count, tmpMatrix);
      count++;
    }

    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={meshRef} args={[geometry, material, MAX_CRATERS]} frustumCulled={false} />;
};

// ── BuildingSmoke ──────────────────────────────────────────────────────────

/**
 * Dark smoke particles rising from ~20% of buildings during wartime.
 * Uses a single Points buffer for GPU-batched rendering.
 */
const BuildingSmoke: React.FC = () => {
  const pointsRef = useRef<THREE.Points>(null);
  const prevSourceCount = useRef(0);

  const positions = useMemo(() => new Float32Array(MAX_SMOKE_PARTICLES * 3), []);
  const colors = useMemo(() => new Float32Array(MAX_SMOKE_PARTICLES * 3), []);

  // Initialize off-screen
  useMemo(() => {
    for (let i = 0; i < MAX_SMOKE_PARTICLES * 3; i += 3) {
      positions[i] = 0;
      positions[i + 1] = -100;
      positions[i + 2] = 0;
      colors[i] = 0.15;
      colors[i + 1] = 0.12;
      colors[i + 2] = 0.1;
    }
  }, [positions, colors]);

  // Cached smoke source positions
  const smokeSourcesRef = useRef<{ x: number; y: number; z: number }[]>([]);
  const sourceUpdateTimer = useRef(0);

  useFrame((_, delta) => {
    const pts = pointsRef.current;
    if (!pts) return;

    // Update smoke source list every 2 seconds (not every frame)
    sourceUpdateTimer.current += delta;
    if (sourceUpdateTimer.current > 2.0 || smokeSourcesRef.current.length === 0) {
      sourceUpdateTimer.current = 0;
      const buildings = gameState.buildings;
      if (buildings.length > 0) {
        // Deterministic: pick every 5th building starting from index 0
        const sources: { x: number; y: number; z: number }[] = [];
        for (let i = 0; i < buildings.length && sources.length < MAX_SMOKE_SOURCES; i += 5) {
          const b = buildings[i];
          sources.push({ x: b.x + 0.5, y: 1.0, z: b.y + 0.5 });
        }
        smokeSourcesRef.current = sources;
      }
    }

    const sources = smokeSourcesRef.current;
    const sourceCount = sources.length;
    const totalParticles = sourceCount * PARTICLES_PER_SOURCE;

    // Animate smoke particles
    for (let s = 0; s < sourceCount; s++) {
      const src = sources[s];
      const baseIdx = s * PARTICLES_PER_SOURCE;

      for (let p = 0; p < PARTICLES_PER_SOURCE; p++) {
        const idx = (baseIdx + p) * 3;

        // Reset particles that have risen too high or are below ground
        if (positions[idx + 1] < src.y - 0.1 || positions[idx + 1] > src.y + SMOKE_HEIGHT) {
          positions[idx] = src.x + (Math.random() - 0.5) * 0.4;
          positions[idx + 1] = src.y + Math.random() * 0.2;
          positions[idx + 2] = src.z + (Math.random() - 0.5) * 0.4;
        } else {
          // Rise slowly with drift
          positions[idx] += (Math.random() - 0.5) * 0.01;
          positions[idx + 1] += (0.15 + Math.random() * 0.25) * delta;
          positions[idx + 2] += (Math.random() - 0.5) * 0.01;
        }

        // Dark smoke color — slightly lighter as it rises
        const heightRatio = Math.min(1, (positions[idx + 1] - src.y) / SMOKE_HEIGHT);
        colors[idx] = 0.1 + heightRatio * 0.15;
        colors[idx + 1] = 0.08 + heightRatio * 0.12;
        colors[idx + 2] = 0.06 + heightRatio * 0.1;
      }
    }

    // Hide unused particles
    for (let i = totalParticles * 3; i < prevSourceCount.current * PARTICLES_PER_SOURCE * 3; i += 3) {
      positions[i + 1] = -100;
    }
    prevSourceCount.current = sourceCount;

    // Update buffer attributes
    const posAttr = pts.geometry.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = pts.geometry.getAttribute('color') as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    pts.geometry.drawRange.count = totalParticles;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial vertexColors size={0.08} transparent opacity={0.6} sizeAttenuation depthWrite={false} />
    </points>
  );
};

// ── Main component ─────────────────────────────────────────────────────────

interface WWIIOverlayProps {
  /** Whether the overlay is active (true during great_patriotic era) */
  active: boolean;
}

/**
 * Composites all WWII visual effects. Active only during the great_patriotic era.
 * The group is hidden when not active to avoid any per-frame cost.
 */
const WWIIOverlay: React.FC<WWIIOverlayProps> = ({ active }) => {
  if (!active) return null;

  return (
    <group>
      <BomberSilhouettes />
      <CraterDecals />
      <BuildingSmoke />
    </group>
  );
};

export default WWIIOverlay;

/**
 * AlienFaunaRenderer — Distant background alien creatures for the exoplanet era.
 *
 * Renders small, slow-moving alien fauna as atmospheric background entities
 * when the exoplanet_colony space milestone activates. Uses drei <Instances>
 * for efficient GPU-instanced rendering.
 *
 * Fauna types:
 *   - Flying aliens: slow sine-wave orbits at sky height
 *   - Ground aliens (scout, spider, tentacle): wander at terrain edges
 *   - Threat soldier: rare patrol, slightly larger
 *
 * All are placed far from the settlement center to feel distant and alien.
 */

import { useFrame } from '@react-three/fiber';
import type React from 'react';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSpaceVisualState } from '../stores/gameStore';

/** Maximum fauna instances across all types. */
const MAX_FAUNA = 12;

/** Distance from world center — keeps fauna at the visual periphery. */
const OUTER_RADIUS = 60;

/** Height range for flying fauna. */
const FLY_HEIGHT_MIN = 12;
const FLY_HEIGHT_MAX = 22;

/** Ground fauna hover height (just above terrain). */
const GROUND_Y = 0.4;

interface FaunaInstance {
  /** Orbit phase offset for varied motion. */
  phase: number;
  /** Orbit speed multiplier. */
  speed: number;
  /** Distance from center. */
  radius: number;
  /** Base Y position. */
  baseY: number;
  /** Y oscillation amplitude. */
  ampY: number;
  /** Scale factor. */
  scale: number;
  /** Color tint (HSL hue shift). */
  color: THREE.Color;
  /** Whether this is a flying creature. */
  flying: boolean;
}

/** Deterministic seed for fauna placement. */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generate fauna instance parameters. */
function generateFauna(): FaunaInstance[] {
  const rng = mulberry32(0xA11E4);
  const fauna: FaunaInstance[] = [];

  // 4 flying aliens
  for (let i = 0; i < 4; i++) {
    fauna.push({
      phase: rng() * Math.PI * 2,
      speed: 0.03 + rng() * 0.04,
      radius: OUTER_RADIUS * (0.7 + rng() * 0.3),
      baseY: FLY_HEIGHT_MIN + rng() * (FLY_HEIGHT_MAX - FLY_HEIGHT_MIN),
      ampY: 1.5 + rng() * 2.5,
      scale: 0.25 + rng() * 0.1,
      color: new THREE.Color().setHSL(0.45 + rng() * 0.15, 0.6, 0.5),
      flying: true,
    });
  }

  // 6 ground aliens (scouts, spiders, tentacles)
  for (let i = 0; i < 6; i++) {
    fauna.push({
      phase: rng() * Math.PI * 2,
      speed: 0.01 + rng() * 0.02,
      radius: OUTER_RADIUS * (0.6 + rng() * 0.4),
      baseY: GROUND_Y,
      ampY: 0,
      scale: 0.2 + rng() * 0.1,
      color: new THREE.Color().setHSL(0.3 + rng() * 0.2, 0.5, 0.4),
      flying: false,
    });
  }

  // 2 threat soldiers (larger, slower)
  for (let i = 0; i < 2; i++) {
    fauna.push({
      phase: rng() * Math.PI * 2,
      speed: 0.008 + rng() * 0.01,
      radius: OUTER_RADIUS * (0.8 + rng() * 0.2),
      baseY: GROUND_Y + 0.2,
      ampY: 0,
      scale: 0.35 + rng() * 0.1,
      color: new THREE.Color().setHSL(0.0 + rng() * 0.05, 0.7, 0.35),
      flying: false,
    });
  }

  return fauna;
}

/**
 * Renders distant alien fauna as instanced spheres on slow orbital paths.
 * Gated by the exoplanetColony flag from SpaceVisualState.
 */
const AlienFaunaRenderer: React.FC = () => {
  const spaceVisual = useSpaceVisualState();

  if (!spaceVisual.exoplanetColony) {
    return null;
  }

  return <AlienFaunaInstances />;
};

/** Inner component — only mounts when exoplanet colony is active. */
const AlienFaunaInstances: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const timeRef = useRef(0);

  const fauna = useMemo(() => generateFauna(), []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Set initial instance colors
  useMemo(() => {
    // Colors are set in useFrame on first pass
  }, []);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    timeRef.current += delta;
    const t = timeRef.current;

    for (let i = 0; i < fauna.length; i++) {
      const f = fauna[i];
      const angle = t * f.speed + f.phase;

      const x = Math.cos(angle) * f.radius;
      const z = Math.sin(angle) * f.radius;
      const y = f.baseY + Math.sin(t * f.speed * 3 + f.phase) * f.ampY;

      dummy.position.set(x, y, z);
      dummy.scale.setScalar(f.scale);

      // Face toward center (settlement) for visual interest
      dummy.lookAt(0, y, 0);

      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, f.color);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, MAX_FAUNA]}
      frustumCulled={false}
    >
      <sphereGeometry args={[1, 6, 6]} />
      <meshStandardMaterial
        transparent
        opacity={0.65}
        roughness={0.8}
        metalness={0.1}
      />
    </instancedMesh>
  );
};

export default AlienFaunaRenderer;

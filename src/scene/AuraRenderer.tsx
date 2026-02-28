/**
 * AuraRenderer — Propaganda tower pulsing rings + gulag rotating cones.
 *
 * Propaganda towers (powered): 3 pulsing red translucent torus rings
 * expanding outward (radius 5 tiles), cycling at different phases.
 * Gulags (powered): rotating translucent yellow cone (sweeping searchlight).
 * Only visible in 'aura' or 'default' lens mode.
 *
 * R3F migration: uses <mesh> with <torusGeometry>/<coneGeometry> and
 * useFrame for pulsing/rotation animation.
 */

import { useFrame } from '@react-three/fiber';
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';

import { gameState } from '../engine/GameState';

const TOWER_RADIUS = 5;
const GULAG_RADIUS = 7;
const RING_COUNT = 3;

// ── Propaganda Ring ─────────────────────────────────────────────────────────

interface PropagandaRingsProps {
  x: number;
  z: number;
}

const PropagandaRings: React.FC<PropagandaRingsProps> = ({ x, z }) => {
  const groupRef = useRef<THREE.Group>(null);
  const ringsRef = useRef<THREE.Mesh[]>([]);
  const materialsRef = useRef<THREE.MeshBasicMaterial[]>([]);

  // Create ring materials
  const materials = useMemo(() => {
    return Array.from(
      { length: RING_COUNT },
      () =>
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(1, 0.1, 0.1),
          transparent: true,
          opacity: 0.4,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
    );
  }, []);

  useEffect(() => {
    materialsRef.current = materials;
    return () => {
      materials.forEach((m) => {
        m.dispose();
      });
    };
  }, [materials]);

  const timeRef = useRef(0);

  // Animate rings: expand and fade
  useFrame((_, delta) => {
    timeRef.current += delta;
    const time = timeRef.current;
    const rings = ringsRef.current;
    const mats = materialsRef.current;

    for (let i = 0; i < RING_COUNT; i++) {
      const ring = rings[i];
      const mat = mats[i];
      if (!ring || !mat) continue;

      const t = (time / 2 + i * (1 / RING_COUNT)) % 1;
      const radius = t * TOWER_RADIUS;
      const alpha = (1 - t) * 0.6;

      ring.scale.set(radius * 2, 1, radius * 2);
      mat.opacity = alpha;
    }
  });

  return (
    <group ref={groupRef} position={[x, 0.1, z]}>
      {materials.map((mat, i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) ringsRef.current[i] = el;
          }}
          material={mat}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[0.5, 0.025, 8, 32]} />
        </mesh>
      ))}
    </group>
  );
};

// ── Gulag Cone ──────────────────────────────────────────────────────────────

interface GulagConeProps {
  x: number;
  z: number;
}

const GulagCone: React.FC<GulagConeProps> = ({ x, z }) => {
  const coneRef = useRef<THREE.Mesh>(null);

  const timeRef = useRef(0);

  // Rotate the cone like a sweeping searchlight
  useFrame((_, delta) => {
    timeRef.current += delta;
    const cone = coneRef.current;
    if (!cone) return;
    const angle = (timeRef.current * 0.8) % (Math.PI * 2);
    cone.rotation.y = angle;
    cone.rotation.z = 0.5; // lean to sweep
  });

  return (
    <mesh ref={coneRef} position={[x, 1.5, z]}>
      <coneGeometry args={[GULAG_RADIUS, 3, 16]} />
      <meshBasicMaterial color="#ffffe6" transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
};

// ── Main AuraRenderer ───────────────────────────────────────────────────────

// Need useEffect for cleanup
const { useEffect } = React;

const AuraRenderer: React.FC = () => {
  const [auras, setAuras] = React.useState<{
    towers: { key: string; x: number; z: number }[];
    gulags: { key: string; x: number; z: number }[];
  }>({ towers: [], gulags: [] });
  const [visible, setVisible] = React.useState(true);

  // Scan buildings for aura sources each frame
  useFrame(() => {
    const lens = gameState.activeLens;
    const shouldBeVisible = lens === 'default' || lens === 'aura';

    if (shouldBeVisible !== visible) {
      setVisible(shouldBeVisible);
    }

    if (!shouldBeVisible) return;

    const newTowers: { key: string; x: number; z: number }[] = [];
    const newGulags: { key: string; x: number; z: number }[] = [];

    for (const b of gameState.buildings) {
      if (!b.powered) continue;

      if (b.type === 'tower' || b.type === 'radio-station') {
        newTowers.push({ key: `tower_${b.x}_${b.y}`, x: b.x, z: b.y });
      } else if (b.type === 'gulag' || b.type === 'gulag-admin') {
        newGulags.push({ key: `gulag_${b.x}_${b.y}`, x: b.x, z: b.y });
      }
    }

    // Only update state if something changed
    setAuras((prev) => {
      if (
        prev.towers.length === newTowers.length &&
        prev.gulags.length === newGulags.length &&
        prev.towers.every((t, i) => t.key === newTowers[i]?.key) &&
        prev.gulags.every((g, i) => g.key === newGulags[i]?.key)
      ) {
        return prev;
      }
      return { towers: newTowers, gulags: newGulags };
    });
  });

  if (!visible) return null;

  return (
    <group>
      {auras.towers.map((tower) => (
        <PropagandaRings key={tower.key} x={tower.x} z={tower.z} />
      ))}
      {auras.gulags.map((gulag) => (
        <GulagCone key={gulag.key} x={gulag.x} z={gulag.z} />
      ))}
    </group>
  );
};

export default AuraRenderer;

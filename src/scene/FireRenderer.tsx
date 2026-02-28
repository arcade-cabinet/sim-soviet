/**
 * FireRenderer — Per-building fire particle effects + point lights.
 *
 * For each grid cell with onFire > 0: renders rising flame particles
 * (orange-red points) and a flickering orange PointLight. Particle count
 * and light intensity scale with fire intensity.
 *
 * R3F migration: uses <points> + useFrame for rising flame particles,
 * and <pointLight> for per-fire illumination.
 */

import { useFrame } from '@react-three/fiber';
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getBuildingHeight } from '../engine/BuildingTypes';
import { gameState } from '../engine/GameState';
import { GRID_SIZE } from '../engine/GridTypes';

// ── Types ───────────────────────────────────────────────────────────────────

interface FireData {
  key: string;
  x: number;
  z: number;
  y: number; // building top height
  intensity: number;
}

// ── Single fire effect ──────────────────────────────────────────────────────

const PARTICLE_COUNT = 300;

interface FireEffectProps {
  x: number;
  z: number;
  y: number;
  intensity: number;
}

const FireEffect: React.FC<FireEffectProps> = ({ x, z, y, intensity }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const frameRef = useRef(0);

  // Initialize particle positions clustered around fire origin
  const positions = useMemo(() => {
    const arr = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      arr[i * 3] = x + (Math.random() - 0.5) * 0.6; // X spread
      arr[i * 3 + 1] = y + Math.random() * 1.5; // Y rising
      arr[i * 3 + 2] = z + (Math.random() - 0.5) * 0.6; // Z spread
    }
    return arr;
  }, [x, z, y]);

  // Animate: particles rise, then reset
  useFrame((_, delta) => {
    frameRef.current++;
    const pts = pointsRef.current;
    if (!pts) return;

    const posAttr = pts.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const idx = i * 3;
      // Rise with random horizontal jitter
      arr[idx] += (Math.random() - 0.5) * 0.02;
      arr[idx + 1] += (0.5 + Math.random() * 1.0) * delta;
      arr[idx + 2] += (Math.random() - 0.5) * 0.02;

      // Reset when too high
      if (arr[idx + 1] > y + 2.0) {
        arr[idx] = x + (Math.random() - 0.5) * 0.6;
        arr[idx + 1] = y;
        arr[idx + 2] = z + (Math.random() - 0.5) * 0.6;
      }
    }

    posAttr.needsUpdate = true;
  });

  // Flickering light intensity
  const lightRef = useRef<THREE.PointLight>(null);
  useFrame(() => {
    if (!lightRef.current) return;
    const flicker = Math.sin(frameRef.current * 0.3) * 0.3 + Math.sin(frameRef.current * 0.7) * 0.2;
    lightRef.current.intensity = 0.5 + intensity * 0.1 + flicker;
  });

  const _emitRate = 50 + intensity * 20;
  const particleSize = 0.05 + intensity * 0.015;

  return (
    <group>
      {/* Fire particles */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#ff6600"
          size={particleSize}
          transparent
          opacity={0.8}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Flickering orange point light */}
      <pointLight
        ref={lightRef}
        position={[x, y + 0.5, z]}
        color="#ff8000"
        intensity={0.5 + intensity * 0.1}
        distance={3}
        decay={2}
      />
    </group>
  );
};

// ── Main FireRenderer ───────────────────────────────────────────────────────

const FireRenderer: React.FC = () => {
  const [fires, setFires] = React.useState<FireData[]>([]);

  // Scan grid for fires each frame
  useFrame(() => {
    const grid = gameState.grid;
    if (!grid.length) return;

    const newFires: FireData[] = [];

    for (let y = 0; y < GRID_SIZE; y++) {
      const row = grid[y];
      if (!row) continue;
      for (let x = 0; x < GRID_SIZE; x++) {
        const cell = row[x];
        if (!cell || cell.onFire <= 0 || !cell.type) continue;

        const bRef = gameState.buildings.find((b) => b.x === x && b.y === y);
        const level = bRef?.level ?? 0;
        const buildingH = getBuildingHeight(cell.type, level) * 0.02 + cell.z;
        const intensity = Math.min(cell.onFire, 15);

        newFires.push({
          key: `${x}_${y}`,
          x,
          z: y,
          y: buildingH,
          intensity,
        });
      }
    }

    // Only update state if fires changed
    setFires((prev) => {
      if (prev.length !== newFires.length) return newFires;
      // Check if any fire changed position/intensity
      for (let i = 0; i < prev.length; i++) {
        if (prev[i].key !== newFires[i]?.key || prev[i].intensity !== newFires[i]?.intensity) {
          return newFires;
        }
      }
      return prev;
    });
  });

  return (
    <group>
      {fires.map((fire) => (
        <FireEffect key={fire.key} x={fire.x} z={fire.z} y={fire.y} intensity={fire.intensity} />
      ))}
    </group>
  );
};

export default FireRenderer;

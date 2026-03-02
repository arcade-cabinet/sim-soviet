/**
 * FireRenderer — GPU-batched fire particle effects.
 *
 * All fire particles across the entire scene are rendered in a SINGLE draw call
 * using one shared Points buffer. Up to MAX_FIRES fires with PARTICLES_PER_FIRE
 * particles each. Point lights are limited to MAX_LIGHTS to avoid GPU overhead.
 *
 * Particles rise with random jitter and reset when they exceed their fire's
 * vertical range. Color varies from yellow (base) through orange to red (top)
 * based on particle height within the flame.
 */

import { useFrame } from '@react-three/fiber';
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getBuildingHeight } from '../engine/BuildingTypes';
import { gameState } from '../engine/GameState';
import { getCurrentGridSize } from '../engine/GridTypes';

// ── Configuration ──────────────────────────────────────────────────────────

const MAX_FIRES = 30;
const PARTICLES_PER_FIRE = 80;
const MAX_PARTICLES = MAX_FIRES * PARTICLES_PER_FIRE;
const MAX_LIGHTS = 4;
const FLAME_HEIGHT = 2.0;

// ── Types ──────────────────────────────────────────────────────────────────

interface ActiveFire {
  x: number;
  z: number;
  y: number;
  intensity: number;
}

// ── Component ──────────────────────────────────────────────────────────────

/** Renders all fire particles in a single draw call with limited point lights for illumination. */
const FireRenderer: React.FC = () => {
  const pointsRef = useRef<THREE.Points>(null);
  const lightRefs = useRef<(THREE.PointLight | null)[]>([]);
  const frameCount = useRef(0);
  const prevFireCountRef = useRef(0);

  // Pre-allocate particle buffers
  const positions = useMemo(() => new Float32Array(MAX_PARTICLES * 3), []);
  const colors = useMemo(() => new Float32Array(MAX_PARTICLES * 3), []);

  // Initialize all positions off-screen
  useMemo(() => {
    for (let i = 0; i < MAX_PARTICLES * 3; i += 3) {
      positions[i] = 0;
      positions[i + 1] = -100; // below ground — invisible
      positions[i + 2] = 0;
      colors[i] = 1;
      colors[i + 1] = 0.4;
      colors[i + 2] = 0;
    }
  }, [positions, colors]);

  // Active fires list (reused each frame to avoid allocation)
  const activeFires = useRef<ActiveFire[]>([]);

  useFrame((_, delta) => {
    const pts = pointsRef.current;
    if (!pts) return;
    frameCount.current++;

    const grid = gameState.grid;
    const gridSize = getCurrentGridSize();
    if (!grid.length) {
      if (prevFireCountRef.current > 0) {
        pts.geometry.drawRange.count = 0;
        prevFireCountRef.current = 0;
      }
      return;
    }

    // Scan grid for fires
    const fires = activeFires.current;
    fires.length = 0;

    const buildingIndex = new Map<string, (typeof gameState.buildings)[number]>();
    for (const b of gameState.buildings) {
      buildingIndex.set(`${b.x},${b.y}`, b);
    }

    for (let gy = 0; gy < gridSize; gy++) {
      const row = grid[gy];
      if (!row) continue;
      for (let gx = 0; gx < gridSize; gx++) {
        const cell = row[gx];
        if (!cell || cell.onFire <= 0 || !cell.type) continue;

        const bRef = buildingIndex.get(`${gx},${gy}`);
        const level = bRef?.level ?? 0;
        const buildingH = getBuildingHeight(cell.type, level) * 0.02 + cell.z;
        const intensity = Math.min(cell.onFire, 15);

        fires.push({ x: gx + 0.5, z: gy + 0.5, y: buildingH, intensity });
        if (fires.length >= MAX_FIRES) break;
      }
      if (fires.length >= MAX_FIRES) break;
    }

    const fireCount = fires.length;
    const totalParticles = fireCount * PARTICLES_PER_FIRE;
    const posArr = positions;
    const colArr = colors;

    // Animate existing particles and assign to fires
    for (let f = 0; f < fireCount; f++) {
      const fire = fires[f];
      const baseIdx = f * PARTICLES_PER_FIRE;

      for (let p = 0; p < PARTICLES_PER_FIRE; p++) {
        const idx = (baseIdx + p) * 3;

        // If this particle is below the fire base or way above, reset it
        if (posArr[idx + 1] < fire.y - 0.1 || posArr[idx + 1] > fire.y + FLAME_HEIGHT) {
          // Reset to fire base with random spread
          posArr[idx] = fire.x + (Math.random() - 0.5) * 0.6;
          posArr[idx + 1] = fire.y + Math.random() * 0.3;
          posArr[idx + 2] = fire.z + (Math.random() - 0.5) * 0.6;
        } else {
          // Rise with jitter
          posArr[idx] += (Math.random() - 0.5) * 0.02;
          posArr[idx + 1] += (0.5 + Math.random() * 1.0) * delta;
          posArr[idx + 2] += (Math.random() - 0.5) * 0.02;
        }

        // Color based on height within flame (yellow→orange→red)
        const heightRatio = Math.min(1, (posArr[idx + 1] - fire.y) / FLAME_HEIGHT);
        colArr[idx] = 1.0; // R stays full
        colArr[idx + 1] = 0.5 * (1 - heightRatio); // G fades out
        colArr[idx + 2] = 0.05 * (1 - heightRatio); // B minimal
      }
    }

    // Hide unused particles
    for (let i = totalParticles * 3; i < prevFireCountRef.current * PARTICLES_PER_FIRE * 3; i += 3) {
      posArr[i + 1] = -100;
    }

    prevFireCountRef.current = fireCount;

    // Update geometry attributes
    const posAttr = pts.geometry.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = pts.geometry.getAttribute('color') as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    pts.geometry.drawRange.count = totalParticles;

    // Update point lights — position at centroids of up to MAX_LIGHTS fires
    for (let i = 0; i < MAX_LIGHTS; i++) {
      const light = lightRefs.current[i];
      if (!light) continue;

      if (i < fireCount) {
        const fire = fires[i];
        light.position.set(fire.x, fire.y + 0.5, fire.z);
        const flicker = Math.sin(frameCount.current * 0.3 + i * 2) * 0.3 +
                        Math.sin(frameCount.current * 0.7 + i * 3) * 0.2;
        light.intensity = 0.5 + fire.intensity * 0.1 + flicker;
        light.visible = true;
      } else {
        light.visible = false;
      }
    }
  });

  return (
    <group>
      {/* Single batched particle system for all fires */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          vertexColors
          size={0.06}
          transparent
          opacity={0.8}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Limited point lights for fire illumination */}
      {Array.from({ length: MAX_LIGHTS }, (_, i) => (
        <pointLight
          key={`fire_light_${i}`}
          ref={(el) => { lightRefs.current[i] = el; }}
          color="#ff8000"
          intensity={0}
          distance={3}
          decay={2}
          visible={false}
        />
      ))}
    </group>
  );
};

export default FireRenderer;

/**
 * WeatherFX — Snow and rain particle effects using Three.js points.
 *
 * Snow (winter): 2000 white particles, slow fall, slight horizontal drift.
 * Rain (spring/fall): 1500-4000 blue-gray particles, fast diagonal fall.
 * Storm: heavy rain.
 * Clear: no particles.
 *
 * Reads currentWeather from gameState and swaps particle configs on change.
 *
 * R3F migration: uses <points> with <bufferGeometry> + <pointsMaterial>
 * and useFrame for per-frame animation (replaces scene.registerBeforeRender).
 */
import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

import { gameState, type WeatherType } from '../engine/GameState';
import { GRID_SIZE } from '../engine/GridTypes';

const EMITTER_WIDTH = GRID_SIZE * 2;
const EMITTER_DEPTH = GRID_SIZE * 2;
const EMITTER_Y = 30;
const CENTER_X = GRID_SIZE / 2;
const CENTER_Z = GRID_SIZE / 2;

// ── Particle configs ────────────────────────────────────────────────────────

interface ParticleConfig {
  count: number;
  color: string;
  size: number;
  gravity: [number, number, number]; // velocity per second
  opacity: number;
}

const SNOW_CONFIG: ParticleConfig = {
  count: 2000,
  color: '#ffffff',
  size: 0.08,
  gravity: [0.2, -0.5, 0.1], // slow fall + wind drift
  opacity: 0.85,
};

const RAIN_CONFIG: ParticleConfig = {
  count: 1500,
  color: '#8090b3',
  size: 0.03,
  gravity: [1.0, -5.0, 0.5], // fast diagonal fall
  opacity: 0.5,
};

const STORM_CONFIG: ParticleConfig = {
  count: 4000,
  color: '#6673a6',
  size: 0.03,
  gravity: [1.5, -7.0, 0.8], // heavier rain
  opacity: 0.6,
};

function getConfig(weather: WeatherType): ParticleConfig | null {
  switch (weather) {
    case 'snow':
      return SNOW_CONFIG;
    case 'rain':
      return RAIN_CONFIG;
    case 'storm':
      return STORM_CONFIG;
    case 'clear':
    default:
      return null;
  }
}

// ── Particle System Component ───────────────────────────────────────────────

interface ParticleSystemProps {
  config: ParticleConfig;
}

const ParticleSystem: React.FC<ParticleSystemProps> = ({ config }) => {
  const pointsRef = useRef<THREE.Points>(null);

  // Initialize particle positions spread across the emitter volume
  const positions = useMemo(() => {
    const arr = new Float32Array(config.count * 3);
    for (let i = 0; i < config.count; i++) {
      arr[i * 3] = CENTER_X + (Math.random() - 0.5) * EMITTER_WIDTH;
      arr[i * 3 + 1] = Math.random() * EMITTER_Y;
      arr[i * 3 + 2] = CENTER_Z + (Math.random() - 0.5) * EMITTER_DEPTH;
    }
    return arr;
  }, [config.count]);

  // Animate particles each frame
  useFrame((_, delta) => {
    const pts = pointsRef.current;
    if (!pts) return;

    const geom = pts.geometry;
    const posAttr = geom.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    const [gx, gy, gz] = config.gravity;

    for (let i = 0; i < config.count; i++) {
      const idx = i * 3;
      arr[idx] += gx * delta;       // X drift
      arr[idx + 1] += gy * delta;   // Y fall
      arr[idx + 2] += gz * delta;   // Z drift

      // Reset particle when it falls below ground
      if (arr[idx + 1] < 0) {
        arr[idx] = CENTER_X + (Math.random() - 0.5) * EMITTER_WIDTH;
        arr[idx + 1] = EMITTER_Y + Math.random() * 5;
        arr[idx + 2] = CENTER_Z + (Math.random() - 0.5) * EMITTER_DEPTH;
      }

      // Wrap X and Z to keep particles in the emitter volume
      if (arr[idx] < CENTER_X - EMITTER_WIDTH / 2) {
        arr[idx] += EMITTER_WIDTH;
      } else if (arr[idx] > CENTER_X + EMITTER_WIDTH / 2) {
        arr[idx] -= EMITTER_WIDTH;
      }
      if (arr[idx + 2] < CENTER_Z - EMITTER_DEPTH / 2) {
        arr[idx + 2] += EMITTER_DEPTH;
      } else if (arr[idx + 2] > CENTER_Z + EMITTER_DEPTH / 2) {
        arr[idx + 2] -= EMITTER_DEPTH;
      }
    }

    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={config.count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color={config.color}
        size={config.size}
        transparent
        opacity={config.opacity}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
};

// ── Main WeatherFX Component ────────────────────────────────────────────────

const WeatherFX: React.FC = () => {
  const weatherRef = useRef<WeatherType>(gameState.currentWeather);
  const [config, setConfig] = React.useState<ParticleConfig | null>(
    () => getConfig(gameState.currentWeather),
  );

  // Poll weather state each frame and update config when it changes
  useFrame(() => {
    const weather = gameState.currentWeather;
    if (weather !== weatherRef.current) {
      weatherRef.current = weather;
      setConfig(getConfig(weather));
    }
  });

  if (!config) return null;

  return <ParticleSystem key={config.count} config={config} />;
};

export default WeatherFX;

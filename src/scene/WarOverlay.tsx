/**
 * WarOverlay — Parameterized visual effects for any war from civil war skirmishes
 * to Dyson sphere defense arrays.
 *
 * Six scale tiers, each with distinct sub-systems:
 *   skirmish:     artillery flashes, small craters (Civil War, border conflicts)
 *   regional:     medium bombers, moderate smoke (Winter War, local wars)
 *   continental:  heavy bombers, dense craters, smoke columns (WWII)
 *   global:       missiles, massive destruction zones (WWIII cold branch)
 *   planetary:    orbital strikes, atmospheric effects (interplanetary war)
 *   stellar:      energy weapons, Dyson swarm defense arrays (Type II conflicts)
 *
 * Era determines aesthetic: 'great_patriotic' = prop planes, 'the_eternal' = energy weapons, etc.
 */

import { useFrame } from '@react-three/fiber';
import type React from 'react';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { gameState } from '../engine/GameState';
import { getCurrentGridSize } from '../engine/GridTypes';

// ── Types ─────────────────────────────────────────────────────────────────

export type WarScale = 'skirmish' | 'regional' | 'continental' | 'global' | 'planetary' | 'stellar';

export interface WarOverlayProps {
  active: boolean;
  scale: WarScale;
  era: string;
  intensity: number; // 0-1
  aggressors?: string[];
}

// ── Scale presets ─────────────────────────────────────────────────────────

interface ScalePreset {
  bomberCount: number;
  bomberCrossingTime: number;
  bomberStagger: number;
  bomberSize: [number, number, number]; // [width, height, length]
  bomberColor: string;
  bomberOpacity: number;
  maxCraters: number;
  craterRadius: number;
  craterColor: string;
  maxSmokeSources: number;
  particlesPerSource: number;
  smokeHeight: number;
  smokeSize: number;
  smokeOpacity: number;
}

const SCALE_PRESETS: Record<WarScale, ScalePreset> = {
  skirmish: {
    bomberCount: 0,
    bomberCrossingTime: 25,
    bomberStagger: 10,
    bomberSize: [0.1, 0.05, 0.6],
    bomberColor: '#1a1a1a',
    bomberOpacity: 0.5,
    maxCraters: 8,
    craterRadius: 0.25,
    craterColor: '#2a1a0a',
    maxSmokeSources: 4,
    particlesPerSource: 8,
    smokeHeight: 1.5,
    smokeSize: 0.05,
    smokeOpacity: 0.4,
  },
  regional: {
    bomberCount: 2,
    bomberCrossingTime: 28,
    bomberStagger: 12,
    bomberSize: [0.12, 0.06, 0.9],
    bomberColor: '#1a1a1a',
    bomberOpacity: 0.6,
    maxCraters: 20,
    craterRadius: 0.35,
    craterColor: '#2a1a0a',
    maxSmokeSources: 8,
    particlesPerSource: 10,
    smokeHeight: 2.0,
    smokeSize: 0.06,
    smokeOpacity: 0.5,
  },
  continental: {
    bomberCount: 3,
    bomberCrossingTime: 25,
    bomberStagger: 10,
    bomberSize: [0.15, 0.08, 1.2],
    bomberColor: '#1a1a1a',
    bomberOpacity: 0.7,
    maxCraters: 40,
    craterRadius: 0.4,
    craterColor: '#2a1a0a',
    maxSmokeSources: 15,
    particlesPerSource: 12,
    smokeHeight: 2.5,
    smokeSize: 0.08,
    smokeOpacity: 0.6,
  },
  global: {
    bomberCount: 5,
    bomberCrossingTime: 18,
    bomberStagger: 6,
    bomberSize: [0.2, 0.1, 1.8],
    bomberColor: '#0a0a0a',
    bomberOpacity: 0.8,
    maxCraters: 60,
    craterRadius: 0.6,
    craterColor: '#1a0a00',
    maxSmokeSources: 25,
    particlesPerSource: 14,
    smokeHeight: 4.0,
    smokeSize: 0.12,
    smokeOpacity: 0.7,
  },
  planetary: {
    bomberCount: 8,
    bomberCrossingTime: 12,
    bomberStagger: 3,
    bomberSize: [0.3, 0.15, 2.5],
    bomberColor: '#ff4400',
    bomberOpacity: 0.9,
    maxCraters: 80,
    craterRadius: 0.9,
    craterColor: '#330a00',
    maxSmokeSources: 35,
    particlesPerSource: 16,
    smokeHeight: 6.0,
    smokeSize: 0.15,
    smokeOpacity: 0.8,
  },
  stellar: {
    bomberCount: 12,
    bomberCrossingTime: 8,
    bomberStagger: 2,
    bomberSize: [0.5, 0.25, 4.0],
    bomberColor: '#00ccff',
    bomberOpacity: 0.95,
    maxCraters: 100,
    craterRadius: 1.2,
    craterColor: '#000a33',
    maxSmokeSources: 50,
    particlesPerSource: 18,
    smokeHeight: 10.0,
    smokeSize: 0.2,
    smokeOpacity: 0.9,
  },
};

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

// ── ArtilleryFlashes (skirmish scale) ─────────────────────────────────────

interface ArtilleryFlashesProps {
  intensity: number;
}

const ArtilleryFlashes: React.FC<ArtilleryFlashesProps> = ({ intensity }) => {
  const MAX_FLASHES = 6;
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const timers = useRef<number[]>(Array.from({ length: MAX_FLASHES }, (_, i) => i * 0.7));

  useFrame((_, delta) => {
    const gridSize = getCurrentGridSize();
    const rng = mulberry32(191700);

    for (let i = 0; i < MAX_FLASHES; i++) {
      const mesh = meshRefs.current[i];
      if (!mesh) continue;

      timers.current[i] += delta;

      // Flash every ~2-4 seconds
      const period = 2.0 + (rng() * 2.0) / Math.max(0.1, intensity);
      const flashPhase = (timers.current[i] % period) / period;
      const isFlashing = flashPhase < 0.05;

      mesh.visible = isFlashing;
      if (isFlashing) {
        const x = rng() * gridSize;
        const z = rng() * gridSize;
        mesh.position.set(x, 0.3, z);
        const s = 0.3 + rng() * 0.5 * intensity;
        mesh.scale.setScalar(s);
      } else {
        // Consume the rng values to keep determinism
        rng(); rng(); rng();
      }
    }
  });

  return (
    <group>
      {Array.from({ length: MAX_FLASHES }, (_, i) => (
        <mesh
          key={`flash_${i}`}
          ref={(el) => { meshRefs.current[i] = el; }}
          visible={false}
        >
          <sphereGeometry args={[0.5, 6, 6]} />
          <meshBasicMaterial color="#ff8800" transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  );
};

// ── BomberSilhouettes ──────────────────────────────────────────────────────

interface BomberState {
  progress: number;
  zOffset: number;
  altitude: number;
  speed: number;
}

interface BomberSilhouettesProps {
  preset: ScalePreset;
}

const BomberSilhouettes: React.FC<BomberSilhouettesProps> = ({ preset }) => {
  const groupRef = useRef<THREE.Group>(null);
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const elapsedRef = useRef(0);

  const bombers = useMemo<BomberState[]>(() => {
    const rng = mulberry32(1941);
    return Array.from({ length: preset.bomberCount }, (_, i) => ({
      progress: -(i * preset.bomberStagger) / preset.bomberCrossingTime,
      zOffset: (rng() - 0.5) * 20,
      altitude: 18 + rng() * 8,
      speed: 0.8 + rng() * 0.4,
    }));
  }, [preset.bomberCount, preset.bomberStagger, preset.bomberCrossingTime]);

  useFrame((_, delta) => {
    elapsedRef.current += delta;
    const gridSize = getCurrentGridSize();
    const span = gridSize * 1.5;

    for (let i = 0; i < preset.bomberCount; i++) {
      const bomber = bombers[i];
      const mesh = meshRefs.current[i];
      if (!mesh) continue;

      bomber.progress += (delta / preset.bomberCrossingTime) * bomber.speed;

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
      mesh.rotation.z = Math.sin(bomber.progress * Math.PI * 2) * 0.1;
    }
  });

  if (preset.bomberCount === 0) return null;

  return (
    <group ref={groupRef}>
      {Array.from({ length: preset.bomberCount }, (_, i) => (
        <mesh
          key={`bomber_${i}`}
          ref={(el) => { meshRefs.current[i] = el; }}
          rotation={[0, Math.PI / 2, 0]}
        >
          <boxGeometry args={preset.bomberSize} />
          <meshBasicMaterial color={preset.bomberColor} transparent opacity={preset.bomberOpacity} />
        </mesh>
      ))}
    </group>
  );
};

// ── CraterDecals ───────────────────────────────────────────────────────────

interface CraterDecalsProps {
  preset: ScalePreset;
}

const CraterDecals: React.FC<CraterDecalsProps> = ({ preset }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const geometry = useMemo(() => new THREE.CircleGeometry(preset.craterRadius, 12), [preset.craterRadius]);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: preset.craterColor,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [preset.craterColor],
  );

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
    const rng = mulberry32(194145);
    let count = 0;

    for (let i = 0; i < preset.maxCraters; i++) {
      const x = rng() * gridSize;
      const z = rng() * gridSize;
      const scale = 0.5 + rng() * 1.0;

      tmpPos.set(x, 0.02, z);
      tmpScale.set(scale, scale, 1);
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);

      mesh.setMatrixAt(count, tmpMatrix);
      count++;
    }

    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, preset.maxCraters]} frustumCulled={false} />
  );
};

// ── BuildingSmoke ──────────────────────────────────────────────────────────

interface BuildingSmokeProps {
  preset: ScalePreset;
}

const BuildingSmoke: React.FC<BuildingSmokeProps> = ({ preset }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const prevSourceCount = useRef(0);

  const maxParticles = preset.maxSmokeSources * preset.particlesPerSource;

  const positions = useMemo(() => new Float32Array(maxParticles * 3), [maxParticles]);
  const colors = useMemo(() => new Float32Array(maxParticles * 3), [maxParticles]);

  useMemo(() => {
    for (let i = 0; i < maxParticles * 3; i += 3) {
      positions[i] = 0;
      positions[i + 1] = -100;
      positions[i + 2] = 0;
      colors[i] = 0.15;
      colors[i + 1] = 0.12;
      colors[i + 2] = 0.1;
    }
  }, [positions, colors, maxParticles]);

  const smokeSourcesRef = useRef<{ x: number; y: number; z: number }[]>([]);
  const sourceUpdateTimer = useRef(0);

  useFrame((_, delta) => {
    const pts = pointsRef.current;
    if (!pts) return;

    sourceUpdateTimer.current += delta;
    if (sourceUpdateTimer.current > 2.0 || smokeSourcesRef.current.length === 0) {
      sourceUpdateTimer.current = 0;
      const buildings = gameState.buildings;
      if (buildings.length > 0) {
        const step = Math.max(1, Math.floor(buildings.length / preset.maxSmokeSources));
        const sources: { x: number; y: number; z: number }[] = [];
        for (let i = 0; i < buildings.length && sources.length < preset.maxSmokeSources; i += step) {
          const b = buildings[i];
          sources.push({ x: b.x + 0.5, y: 1.0, z: b.y + 0.5 });
        }
        smokeSourcesRef.current = sources;
      }
    }

    const sources = smokeSourcesRef.current;
    const sourceCount = sources.length;
    const totalParticles = sourceCount * preset.particlesPerSource;

    for (let s = 0; s < sourceCount; s++) {
      const src = sources[s];
      const baseIdx = s * preset.particlesPerSource;

      for (let p = 0; p < preset.particlesPerSource; p++) {
        const idx = (baseIdx + p) * 3;

        if (positions[idx + 1] < src.y - 0.1 || positions[idx + 1] > src.y + preset.smokeHeight) {
          positions[idx] = src.x + (Math.random() - 0.5) * 0.4;
          positions[idx + 1] = src.y + Math.random() * 0.2;
          positions[idx + 2] = src.z + (Math.random() - 0.5) * 0.4;
        } else {
          positions[idx] += (Math.random() - 0.5) * 0.01;
          positions[idx + 1] += (0.15 + Math.random() * 0.25) * delta;
          positions[idx + 2] += (Math.random() - 0.5) * 0.01;
        }

        const heightRatio = Math.min(1, (positions[idx + 1] - src.y) / preset.smokeHeight);
        colors[idx] = 0.1 + heightRatio * 0.15;
        colors[idx + 1] = 0.08 + heightRatio * 0.12;
        colors[idx + 2] = 0.06 + heightRatio * 0.1;
      }
    }

    for (let i = totalParticles * 3; i < prevSourceCount.current * preset.particlesPerSource * 3; i += 3) {
      positions[i + 1] = -100;
    }
    prevSourceCount.current = sourceCount;

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
      <pointsMaterial
        vertexColors
        size={preset.smokeSize}
        transparent
        opacity={preset.smokeOpacity}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
};

// ── OrbitalStrikes (planetary/stellar scales) ─────────────────────────────

interface OrbitalStrikesProps {
  intensity: number;
  isStellar: boolean;
}

const OrbitalStrikes: React.FC<OrbitalStrikesProps> = ({ intensity, isStellar }) => {
  const MAX_BEAMS = 4;
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const timers = useRef<number[]>(Array.from({ length: MAX_BEAMS }, (_, i) => i * 1.2));

  const beamColor = isStellar ? '#00ccff' : '#ff4400';
  const beamHeight = isStellar ? 40 : 25;

  useFrame((_, delta) => {
    const gridSize = getCurrentGridSize();
    const rng = mulberry32(200000);

    for (let i = 0; i < MAX_BEAMS; i++) {
      const mesh = meshRefs.current[i];
      if (!mesh) continue;

      timers.current[i] += delta;

      const period = 3.0 / Math.max(0.1, intensity);
      const phase = (timers.current[i] % period) / period;
      const isActive = phase < 0.08;

      mesh.visible = isActive;
      if (isActive) {
        const x = rng() * gridSize;
        const z = rng() * gridSize;
        mesh.position.set(x, beamHeight / 2, z);
        const s = 0.5 + intensity * 0.5;
        mesh.scale.set(s, 1, s);
      } else {
        rng(); rng();
      }
    }
  });

  return (
    <group>
      {Array.from({ length: MAX_BEAMS }, (_, i) => (
        <mesh
          key={`beam_${i}`}
          ref={(el) => { meshRefs.current[i] = el; }}
          visible={false}
        >
          <cylinderGeometry args={[0.02, 0.15, beamHeight, 6]} />
          <meshBasicMaterial color={beamColor} transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  );
};

// ── Main component ─────────────────────────────────────────────────────────

const WarOverlay: React.FC<WarOverlayProps> = ({ active, scale, era: _era, intensity }) => {
  if (!active) return null;

  const clampedIntensity = Math.max(0, Math.min(1, intensity));
  const preset = SCALE_PRESETS[scale];

  const showArtillery = scale === 'skirmish';
  const showBombers = preset.bomberCount > 0;
  const showOrbital = scale === 'planetary' || scale === 'stellar';

  return (
    <group>
      {showArtillery && <ArtilleryFlashes intensity={clampedIntensity} />}
      {showBombers && <BomberSilhouettes preset={preset} />}
      <CraterDecals preset={preset} />
      <BuildingSmoke preset={preset} />
      {showOrbital && <OrbitalStrikes intensity={clampedIntensity} isStellar={scale === 'stellar'} />}
    </group>
  );
};

export default WarOverlay;
export { SCALE_PRESETS };

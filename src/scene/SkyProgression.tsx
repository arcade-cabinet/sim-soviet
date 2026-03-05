/**
 * SkyProgression — Visual sky overlays driven by space timeline milestones.
 *
 * Renders celestial objects that appear as space milestones activate:
 *   - Sputnik orbit streak (thin arc line, brief flash)
 *   - Space station moving dot (ISS-like, slow orbit via useFrame)
 *   - Satellite constellation (5 dots on varied orbits)
 *   - Moon disc (grows slightly after lunar landing)
 *   - Mars point (reddish dot, interplanetary era)
 *   - Dyson ring arc (partial torus, megastructure era)
 *   - Starfield particles (intensifies with techLevel)
 *
 * All objects are placed on a large sky sphere above the scene.
 * Uses R3F primitives only — no external assets needed.
 */

import { useFrame } from '@react-three/fiber';
import type React from 'react';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

/** Discrete sky state tiers derived from space milestone progression. */
export type SkyState = 'pre_space' | 'orbital' | 'lunar' | 'interplanetary' | 'megastructure' | 'interstellar';

/** Which space milestones have been reached — drives visual elements. */
export interface SpaceVisualState {
  /** Sputnik launched — show orbit streak. */
  sputnik: boolean;
  /** Space station operational — show moving ISS dot. */
  spaceStation: boolean;
  /** Lunar base established — show moon disc. */
  lunarBase: boolean;
  /** Exoplanet colony established — show alien fauna. */
  exoplanetColony?: boolean;
  /** 0-1 tech level — drives starfield intensity. */
  techLevel: number;
  /** Current era ID — drives sky color shift for the_eternal. */
  era: string;
}

/**
 * Pure function: derive discrete SkyState tier from activated space milestone IDs.
 * Higher tiers override lower ones (interstellar > megastructure > ... > pre_space).
 */
export function getSpaceSkyState(activatedMilestones: string[]): SkyState {
  const set = new Set(activatedMilestones);

  if (set.has('generation_ship') || set.has('exoplanet_colony') || set.has('kardashev_two')) {
    return 'interstellar';
  }
  if (set.has('oneill_cylinder') || set.has('dyson_swarm_start') || set.has('kardashev_one')) {
    return 'megastructure';
  }
  if (set.has('mars_colony') || set.has('ceres_mining_station') || set.has('asteroid_mining')) {
    return 'interplanetary';
  }
  if (set.has('permanent_lunar_base') || set.has('lunokhod')) {
    return 'lunar';
  }
  if (set.has('salyut_station') || set.has('mir_station') || set.has('sputnik') || set.has('vostok_gagarin')) {
    return 'orbital';
  }

  return 'pre_space';
}

const SKY_RADIUS = 180;
const ORBIT_SEGMENTS = 128;

/** Sputnik orbit streak — a thin line mesh on a slow arc. */
const SputnikStreak: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  // Create a thin tube geometry for the orbit streak
  const geometry = useMemo(() => {
    const curve = new THREE.EllipseCurve(
      0, 0,
      SKY_RADIUS * 0.85, SKY_RADIUS * 0.8,
      0, Math.PI * 0.3,
      false, 0,
    );
    const points2D = curve.getPoints(ORBIT_SEGMENTS);
    const points3D = points2D.map(
      (p) => new THREE.Vector3(p.x, SKY_RADIUS * 0.6, p.y),
    );
    return new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points3D),
      ORBIT_SEGMENTS,
      0.15,
      4,
      false,
    );
  }, []);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    timeRef.current += delta * 0.15;
    meshRef.current.rotation.y = timeRef.current;
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshBasicMaterial color="#ffffff" transparent opacity={0.4} />
    </mesh>
  );
};

/** Space station moving dot — a small sphere on a slow orbit. */
const StationDot: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    timeRef.current += delta * 0.08;
    const t = timeRef.current;
    meshRef.current.position.set(
      Math.cos(t) * SKY_RADIUS * 0.75,
      SKY_RADIUS * 0.5 + Math.sin(t * 0.7) * 20,
      Math.sin(t) * SKY_RADIUS * 0.75,
    );
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.6, 8, 8]} />
      <meshBasicMaterial color="#ffffcc" />
    </mesh>
  );
};

/** Moon disc — a flat circle that appears after lunar landing milestone. */
const MoonDisc: React.FC = () => {
  return (
    <mesh position={[-SKY_RADIUS * 0.4, SKY_RADIUS * 0.7, -SKY_RADIUS * 0.5]}>
      <circleGeometry args={[8, 32]} />
      <meshBasicMaterial
        color="#e8e4d0"
        transparent
        opacity={0.85}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

/** Starfield — point cloud that intensifies with tech level. */
const Starfield: React.FC<{ intensity: number }> = ({ intensity }) => {
  const pointsRef = useRef<THREE.Points>(null);

  // Generate star positions on a sphere
  const { positions, colors } = useMemo(() => {
    const count = Math.floor(200 + intensity * 800);
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // Distribute on upper hemisphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.45 + 0.05; // upper hemisphere only
      const r = SKY_RADIUS * 0.95;

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      // Slightly warm white to cold blue variation
      const warmth = Math.random();
      col[i * 3] = 0.8 + warmth * 0.2;
      col[i * 3 + 1] = 0.8 + warmth * 0.15;
      col[i * 3 + 2] = 0.9 + warmth * 0.1;
    }

    return { positions: pos, colors: col };
  }, [intensity]);

  // Slow rotation for parallax feel
  useFrame((_, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.002;
    }
  });

  const baseOpacity = Math.min(1, 0.15 + intensity * 0.6);

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.8 + intensity * 0.6}
        transparent
        opacity={baseOpacity}
        vertexColors
        sizeAttenuation={false}
        depthWrite={false}
      />
    </points>
  );
};

/** Satellite constellation — 5 dots on varied orbits (orbital tier+). */
const SatelliteConstellation: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  // Pre-compute orbit parameters for 5 satellites
  const orbits = useMemo(() => [
    { speed: 0.12, radius: 0.78, inclination: 0.3, phase: 0 },
    { speed: 0.09, radius: 0.72, inclination: 0.5, phase: 1.2 },
    { speed: 0.15, radius: 0.82, inclination: 0.2, phase: 2.4 },
    { speed: 0.07, radius: 0.68, inclination: 0.6, phase: 3.6 },
    { speed: 0.11, radius: 0.76, inclination: 0.4, phase: 5.0 },
  ], []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    timeRef.current += delta;
    const children = groupRef.current.children;
    for (let i = 0; i < orbits.length && i < children.length; i++) {
      const o = orbits[i];
      const t = timeRef.current * o.speed + o.phase;
      const r = SKY_RADIUS * o.radius;
      children[i].position.set(
        Math.cos(t) * r,
        SKY_RADIUS * 0.45 + Math.sin(t * o.inclination) * 25,
        Math.sin(t) * r,
      );
    }
  });

  return (
    <group ref={groupRef}>
      {orbits.map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.4, 6, 6]} />
          <meshBasicMaterial color="#ccddff" transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  );
};

/** Mars point — reddish dot visible in interplanetary+ tiers. */
const MarsPoint: React.FC = () => {
  return (
    <mesh position={[SKY_RADIUS * 0.5, SKY_RADIUS * 0.55, SKY_RADIUS * 0.3]}>
      <sphereGeometry args={[2.5, 12, 12]} />
      <meshBasicMaterial color="#cc4422" transparent opacity={0.7} />
    </mesh>
  );
};

/** Dyson ring arc — partial torus visible in megastructure+ tiers. */
const DysonArc: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.z += delta * 0.005;
    }
  });

  const geometry = useMemo(() => {
    return new THREE.TorusGeometry(SKY_RADIUS * 0.6, 0.8, 8, 64, Math.PI * 0.7);
  }, []);

  return (
    <mesh ref={meshRef} geometry={geometry} rotation={[0.8, 0, 0]}>
      <meshBasicMaterial color="#ffdd88" transparent opacity={0.25} side={THREE.DoubleSide} />
    </mesh>
  );
};

/** Main sky progression component — conditionally renders celestial overlays. */
const SkyProgression: React.FC<{ state: SpaceVisualState }> = ({ state }) => {
  // Don't render anything if no space milestones reached and low tech
  if (!state.sputnik && !state.spaceStation && !state.lunarBase && state.techLevel < 0.1) {
    return null;
  }

  // Derive tier for conditional rendering of advanced layers
  const milestones: string[] = [];
  if (state.sputnik) milestones.push('sputnik');
  if (state.spaceStation) milestones.push('salyut_station');
  if (state.lunarBase) milestones.push('permanent_lunar_base');
  const tier = getSpaceSkyState(milestones);

  const isOrbitalPlus = tier !== 'pre_space';
  const isInterplanetaryPlus = tier === 'interplanetary' || tier === 'megastructure' || tier === 'interstellar';
  const isMegastructurePlus = tier === 'megastructure' || tier === 'interstellar';

  return (
    <group>
      {state.sputnik && <SputnikStreak />}
      {state.spaceStation && <StationDot />}
      {isOrbitalPlus && <SatelliteConstellation />}
      {state.lunarBase && <MoonDisc />}
      {isInterplanetaryPlus && <MarsPoint />}
      {isMegastructurePlus && <DysonArc />}
      {state.techLevel > 0.05 && <Starfield intensity={state.techLevel} />}
    </group>
  );
};

export default SkyProgression;

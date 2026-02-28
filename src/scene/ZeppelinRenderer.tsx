/**
 * ZeppelinRenderer -- Firefighting airships.
 *
 * Reads gameState.zeppelins[] array. Each = ellipsoid body (sphere with
 * non-uniform scale) + gondola (box) underneath + shadow disc on ground.
 * Smooth movement toward fire target via lerp. Position at y=8 (floating
 * above buildings).
 *
 * R3F migration: uses <mesh> primitives + useFrame for smooth movement.
 */

import { useFrame } from '@react-three/fiber';
import type React from 'react';
import { useMemo, useRef } from 'react';
import * as THREE from 'three/webgpu';

import { gameState } from '../engine/GameState';

const FLOAT_Y = 8;
const LERP_SPEED = 0.02;
const MAX_ZEPPELINS = 8;

// ── Single Zeppelin ─────────────────────────────────────────────────────────

interface ZepProps {
  index: number;
}

const Zep: React.FC<ZepProps> = ({ index }) => {
  const bodyRef = useRef<THREE.Mesh>(null);
  const gondolaRef = useRef<THREE.Mesh>(null);
  const shadowRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  // Smoothed position (tracks toward zeppelin target)
  const smoothPos = useRef({ x: 15, z: 15 });
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
    const zeppelins = gameState.zeppelins;
    const group = groupRef.current;
    if (!group) return;

    if (index >= zeppelins.length) {
      group.visible = false;
      return;
    }

    const z = zeppelins[index];
    group.visible = true;

    // Smooth movement toward target
    smoothPos.current.x += (z.x - smoothPos.current.x) * LERP_SPEED;
    smoothPos.current.z += (z.y - smoothPos.current.z) * LERP_SPEED;

    const posX = smoothPos.current.x;
    const posZ = smoothPos.current.z;
    const posY = FLOAT_Y + Math.sin(timeRef.current + index) * 0.2;

    // Body
    if (bodyRef.current) {
      bodyRef.current.position.set(posX, posY, posZ);
    }

    // Gondola underneath
    if (gondolaRef.current) {
      gondolaRef.current.position.set(posX, posY - 0.4, posZ);
    }

    // Shadow on ground
    if (shadowRef.current) {
      shadowRef.current.position.set(posX, 0.02, posZ);
    }
  });

  return (
    <group ref={groupRef}>
      {/* Ellipsoid body */}
      <mesh ref={bodyRef} scale={[1.5, 0.6, 0.7]}>
        <sphereGeometry args={[0.5, 8, 8]} />
        <meshStandardMaterial color="#808080" />
      </mesh>

      {/* Gondola */}
      <mesh ref={gondolaRef}>
        <boxGeometry args={[0.4, 0.15, 0.25]} />
        <meshStandardMaterial color="#40332e" />
      </mesh>

      {/* Shadow disc on ground */}
      <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.6, 16]} />
        <meshBasicMaterial color="black" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

// ── Main Renderer ───────────────────────────────────────────────────────────

const ZeppelinRenderer: React.FC = () => {
  // Pre-allocate a fixed pool of zeppelin slots
  const slots = useMemo(() => Array.from({ length: MAX_ZEPPELINS }, (_, i) => i), []);

  return (
    <>
      {slots.map((i) => (
        <Zep key={i} index={i} />
      ))}
    </>
  );
};

export default ZeppelinRenderer;

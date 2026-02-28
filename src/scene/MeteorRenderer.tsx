/**
 * MeteorRenderer -- Meteor impact visual effect.
 *
 * When meteor.active: glowing white sphere with orange pointLight descending
 * from sky. Position updates from gameState each frame.
 * Returns null if meteor not active.
 *
 * R3F migration: uses <mesh> + <pointLight> + useFrame for per-frame updates.
 */

import { useFrame } from '@react-three/fiber';
import type React from 'react';
import { useRef } from 'react';
import type * as THREE from 'three';

import { gameState } from '../engine/GameState';

const MeteorRenderer: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const sphereRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(() => {
    const meteor = gameState.meteor;
    const group = groupRef.current;
    if (!group) return;

    if (!meteor.active) {
      group.visible = false;
      return;
    }

    group.visible = true;

    // Scale z to world Y (same as old renderer)
    const worldY = meteor.z * 0.03;
    const px = meteor.x;
    const pz = meteor.y;

    if (sphereRef.current) {
      sphereRef.current.position.set(px, worldY, pz);
    }

    if (lightRef.current) {
      lightRef.current.position.set(px, worldY, pz);
      // Increase intensity as meteor descends
      lightRef.current.intensity = Math.max(0, 5 * (1 - worldY / 50));
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      {/* Glowing meteor sphere */}
      <mesh ref={sphereRef}>
        <sphereGeometry args={[0.3, 8, 8]} />
        <meshBasicMaterial color="white" />
      </mesh>

      {/* Orange glow light */}
      <pointLight ref={lightRef} color="#ff8800" intensity={5} distance={30} decay={2} />
    </group>
  );
};

export default MeteorRenderer;

/**
 * TrainRenderer -- Animated train on rail.
 *
 * Reads gameState.train for train state (active, x, y).
 * Locomotive body (box) + chimney (cylinder) + 4 trailing cars (boxes, spaced ~1.1 apart).
 * Smooth movement via useFrame + THREE.MathUtils.lerp.
 * Returns null if train not active.
 *
 * R3F migration: uses <mesh> primitives + useFrame for per-frame animation.
 */
import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

import { gameState } from '../engine/GameState';
import { GRID_SIZE } from '../engine/GridTypes';

const CAR_COUNT = 4;
const CAR_SPACING = 1.1;
const BASE_Y = 0.25;

// ── Single trailing car ─────────────────────────────────────────────────────

const TrainCar: React.FC<{ meshRef: React.RefObject<THREE.Mesh | null> }> = ({ meshRef }) => (
  <mesh ref={meshRef} visible={false}>
    <boxGeometry args={[0.7, 0.3, 0.45]} />
    <meshStandardMaterial color="#40332e" />
  </mesh>
);

// ── TrainRenderer ───────────────────────────────────────────────────────────

const TrainRenderer: React.FC = () => {
  const locoRef = useRef<THREE.Mesh>(null);
  const chimneyRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  // Create refs for trailing cars
  const carRefs = useMemo(
    () => Array.from({ length: CAR_COUNT }, () => React.createRef<THREE.Mesh>()),
    [],
  );

  // Smoothed position for lerp
  const smoothX = useRef(-5);

  useFrame(() => {
    const train = gameState.train;
    const loco = locoRef.current;
    const chimney = chimneyRef.current;
    if (!loco || !chimney) return;

    if (!train.active) {
      loco.visible = false;
      chimney.visible = false;
      for (const ref of carRefs) {
        if (ref.current) ref.current.visible = false;
      }
      return;
    }

    const railZ = train.y;

    // Smooth movement toward target X
    smoothX.current = THREE.MathUtils.lerp(smoothX.current, train.x, 0.1);
    const locoX = smoothX.current;

    // Position locomotive
    loco.position.set(locoX, BASE_Y, railZ);
    loco.visible = true;

    // Chimney on top
    chimney.position.set(locoX + 0.2, BASE_Y + 0.35, railZ);
    chimney.visible = true;

    // Trailing cars
    for (let i = 0; i < CAR_COUNT; i++) {
      const car = carRefs[i].current;
      if (!car) continue;
      const carX = locoX - (i + 1) * CAR_SPACING;
      car.position.set(carX, BASE_Y - 0.05, railZ);
      car.visible = carX >= -2 && carX < GRID_SIZE + 2;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Locomotive body */}
      <mesh ref={locoRef} visible={false}>
        <boxGeometry args={[0.8, 0.4, 0.5]} />
        <meshStandardMaterial color="#262626" />
      </mesh>

      {/* Chimney */}
      <mesh ref={chimneyRef} visible={false}>
        <cylinderGeometry args={[0.075, 0.075, 0.3, 8]} />
        <meshStandardMaterial color="#262626" />
      </mesh>

      {/* Trailing cars */}
      {carRefs.map((ref, i) => (
        <TrainCar key={i} meshRef={ref} />
      ))}
    </group>
  );
};

export default TrainRenderer;

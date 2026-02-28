/**
 * LightningRenderer -- Storm lightning bolt effect.
 *
 * Triggered by gameState.activeLightning. Jagged bolt from sky (y=50) to
 * strike point using drei <Line> component. 12 segments with random X/Z
 * offsets for jagged appearance. Bolt fades over ~15 frames then disappears.
 *
 * R3F migration: uses drei <Line> + useFrame for bolt animation and fade.
 */
import React, { useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';

import { gameState } from '../engine/GameState';

const BOLT_Y_START = 50;
const BOLT_SEGMENTS = 12;
const FADE_FRAMES = 15;

/** Generate jagged bolt points from sky to ground strike position */
function generateBoltPoints(targetX: number, targetZ: number): [number, number, number][] {
  const points: [number, number, number][] = [];
  const startX = targetX + (Math.random() - 0.5) * 3;
  const startZ = targetZ + (Math.random() - 0.5) * 3;

  for (let i = 0; i <= BOLT_SEGMENTS; i++) {
    const t = i / BOLT_SEGMENTS;
    let px = THREE.MathUtils.lerp(startX, targetX, t);
    let py = THREE.MathUtils.lerp(BOLT_Y_START, 0, t);
    let pz = THREE.MathUtils.lerp(startZ, targetZ, t);

    // Add jagged random offsets (not at start or end)
    if (i > 0 && i < BOLT_SEGMENTS) {
      px += (Math.random() - 0.5) * 2;
      py += (Math.random() - 0.5) * 3;
      pz += (Math.random() - 0.5) * 2;
    }

    points.push([px, py, pz]);
  }

  return points;
}

const LightningRenderer: React.FC = () => {
  const [boltPoints, setBoltPoints] = useState<[number, number, number][] | null>(null);
  const prevLightningRef = useRef<{ x: number; y: number } | null>(null);
  const framesLeftRef = useRef(0);
  const opacityRef = useRef(1);
  const lineRef = useRef<any>(null);

  useFrame(() => {
    const lightning = gameState.activeLightning;

    // Detect new lightning strike
    if (lightning) {
      const prev = prevLightningRef.current;
      const isNew = !prev || prev.x !== lightning.x || prev.y !== lightning.y;

      if (isNew) {
        const points = generateBoltPoints(lightning.x, lightning.y);
        setBoltPoints(points);
        framesLeftRef.current = FADE_FRAMES;
        opacityRef.current = 1;
        prevLightningRef.current = { x: lightning.x, y: lightning.y };
      }
    }

    // Animate active bolt fade
    if (framesLeftRef.current > 0) {
      framesLeftRef.current--;
      opacityRef.current = framesLeftRef.current / FADE_FRAMES;

      // Update line opacity if ref available
      if (lineRef.current?.material) {
        lineRef.current.material.opacity = opacityRef.current;
      }

      if (framesLeftRef.current <= 0) {
        setBoltPoints(null);
        prevLightningRef.current = null;
      }
    }
  });

  if (!boltPoints) return null;

  return (
    <Line
      ref={lineRef}
      points={boltPoints}
      color="white"
      lineWidth={3}
      transparent
      opacity={opacityRef.current}
    />
  );
};

export default LightningRenderer;

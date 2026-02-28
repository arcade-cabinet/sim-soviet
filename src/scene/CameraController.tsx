/**
 * CameraController — Orbit/pan/zoom camera for the Soviet city.
 *
 * R3F migration: uses drei <MapControls> for pan/zoom/tilt.
 *
 * Inspired by Cities Skylines: orbit/rotate/zoom/pan around the cityscape.
 * - Default view from southwest looking at grid area
 * - Mouse drag to orbit, scroll/pinch to zoom
 * - Right-click to pan
 * - Smooth damping for pleasant movement
 * - Zoom limits: minDistance 8, maxDistance 80
 * - Tilt limits: maxPolarAngle PI/2.2 (never go below ground)
 */

import { MapControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import type React from 'react';
import { useEffect, useRef } from 'react';
import { GRID_SIZE } from '../engine/GridTypes';

const CameraController: React.FC = () => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const center = GRID_SIZE / 2;

  // Set initial camera position on mount
  useEffect(() => {
    camera.position.set(center + 15, 25, center + 15);
    camera.lookAt(center, 0, center);
  }, [camera, center]);

  return (
    <MapControls
      ref={controlsRef}
      target={[center, 0, center]}
      minDistance={8}
      maxDistance={80}
      maxPolarAngle={Math.PI / 2.2}
      enableDamping
      dampingFactor={0.1}
      screenSpacePanning={false}
    />
  );
};

export default CameraController;

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
import { useFrame, useThree } from '@react-three/fiber';
import type React from 'react';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { getCurrentGridSize } from '../engine/GridTypes';
import { InputManager } from '../input/InputManager';

/** Speed constants for keyboard/gamepad-driven camera movement. */
const PAN_SPEED = 0.3;
const ROTATE_SPEED = 0.02;
const ZOOM_SPEED = 0.5;

/** Temp vector to avoid per-frame allocation. */
const _panOffset = new THREE.Vector3();

interface CameraControllerProps {
  /** When true, the camera controller is disabled (XR provides its own camera). */
  disabled?: boolean;
}

/** R3F camera controller using drei MapControls for orbit/pan/zoom around the Soviet city. */
const CameraController: React.FC<CameraControllerProps> = ({ disabled }) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const center = getCurrentGridSize() / 2;

  // Set initial camera position on mount
  useEffect(() => {
    if (disabled) return;
    camera.position.set(center + 15, 25, center + 15);
    camera.lookAt(center, 0, center);
  }, [camera, center, disabled]);

  // Apply continuous input axes as camera velocity each frame
  useFrame(() => {
    if (disabled) return;
    const controls = controlsRef.current;
    if (!controls) return;

    const { axes } = InputManager.getInstance().getState();
    const hasPan = axes.camera_pan_x !== 0 || axes.camera_pan_y !== 0;
    const hasRotate = axes.camera_rotate !== 0;
    const hasZoom = axes.camera_zoom !== 0;

    if (!hasPan && !hasRotate && !hasZoom) return;

    // Pan: translate target in camera-relative XZ plane
    if (hasPan) {
      // Get camera's forward direction projected onto XZ plane
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();

      // Right vector
      const right = new THREE.Vector3();
      right.crossVectors(forward, camera.up).normalize();

      _panOffset.set(0, 0, 0);
      _panOffset.addScaledVector(right, axes.camera_pan_x * PAN_SPEED);
      _panOffset.addScaledVector(forward, -axes.camera_pan_y * PAN_SPEED);

      controls.target.add(_panOffset);
      camera.position.add(_panOffset);
    }

    // Rotate: adjust azimuth angle around target
    if (hasRotate) {
      const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      spherical.theta -= axes.camera_rotate * ROTATE_SPEED;
      offset.setFromSpherical(spherical);
      camera.position.copy(controls.target).add(offset);
      camera.lookAt(controls.target);
    }

    // Zoom: move camera toward/away from target
    if (hasZoom) {
      const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
      const dist = offset.length();
      const newDist = THREE.MathUtils.clamp(dist + axes.camera_zoom * ZOOM_SPEED, 8, 80);
      offset.normalize().multiplyScalar(newDist);
      camera.position.copy(controls.target).add(offset);
    }

    controls.update();
  });

  if (disabled) return null;

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

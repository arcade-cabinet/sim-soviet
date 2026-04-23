/**
 * CameraController — Orbit/pan/zoom camera for the Soviet city.
 *
 * R3F migration: uses drei <MapControls> for pan/zoom/tilt.
 *
 * Inspired by Cities Skylines: orbit/rotate/zoom/pan around the cityscape.
 * - Default view from southwest looking at grid area (mid-zoom, not god-view)
 * - Mouse drag to orbit, scroll/pinch to zoom
 * - Right-click to pan
 * - Smooth damping for pleasant movement
 * - Zoom limits: minDistance 3, maxDistance 80
 * - Tilt limits: maxPolarAngle PI/2.2 (never go below ground)
 * - Click-to-zoom: animates to street level when a building panel opens
 * - Escape/close: smoothly returns camera to previous position
 */

import { MapControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import type React from 'react';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { getCurrentGridSize } from '../engine/GridTypes';
import { InputManager } from '../input/InputManager';
import { clearCameraTarget, getCameraTarget, getCaravanTarget, setCameraAnimating } from '../stores/gameStore';

/** Speed constants for keyboard/gamepad-driven camera movement. */
const PAN_SPEED = 0.3;
const ROTATE_SPEED = 0.02;
const ZOOM_SPEED = 0.5;

/** Duration (seconds) for zoom-in animation to street level. */
const ZOOM_IN_DURATION = 0.5;

/** Duration (seconds) for return animation back to saved position. */
const RETURN_DURATION = 0.3;

/** Duration (seconds) for caravan arrival camera pan. */
const CARAVAN_DURATION = 2.5;

/** Temp vector to avoid per-frame allocation. */
const _panOffset = new THREE.Vector3();

/** Reusable vectors for camera animation targets. */
const _targetPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();

interface CameraControllerProps {
  /** When true, the camera controller is disabled (XR provides its own camera). */
  disabled?: boolean;
}

/** R3F camera controller using drei MapControls for orbit/pan/zoom around the Soviet city. */
const CameraController: React.FC<CameraControllerProps> = ({ disabled }) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const center = getCurrentGridSize() / 2;

  // Saved camera position/target for return animation
  const returnPosRef = useRef<THREE.Vector3 | null>(null);
  const returnTargetRef = useRef<THREE.Vector3 | null>(null);
  // Track whether we are currently animating (zoom-in, return, or caravan)
  const animatingRef = useRef<'zoom' | 'return' | 'caravan' | null>(null);
  // Track whether the caravan animation has already been triggered this game
  const caravanDoneRef = useRef(false);
  // Animation start position/target and elapsed time for time-based lerp
  const animStartPosRef = useRef(new THREE.Vector3());
  const animStartTargetRef = useRef(new THREE.Vector3());
  const animElapsedRef = useRef(0);
  // Track the last cameraTarget to detect transitions
  const lastCameraTargetRef = useRef<{ x: number; z: number } | null>(null);

  // Set initial camera position on mount — mid-zoom, closer to street level
  useEffect(() => {
    if (disabled) return;
    camera.position.set(center + 8, 12, center + 8);
    camera.lookAt(center, 0, center);
  }, [camera, center, disabled]);

  // Escape key — return camera from street-level zoom to default position
  useEffect(() => {
    if (disabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearCameraTarget();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [disabled]);

  // Camera animation: zoom-to-building and return
  useFrame((_state, delta) => {
    if (disabled) return;
    const controls = controlsRef.current;
    if (!controls) return;

    // Caravan arrival: start camera at map edge, pan toward settlement target
    const caravanTarget = getCaravanTarget();
    if (caravanTarget && !caravanDoneRef.current && animatingRef.current !== 'caravan') {
      // Start camera at southwest map edge looking inward
      const gridSize = getCurrentGridSize();
      camera.position.set(-2, 8, gridSize + 2);
      controls.target.set(0, 0, gridSize);
      controls.update();
      animStartPosRef.current.copy(camera.position);
      animStartTargetRef.current.copy(controls.target);
      animElapsedRef.current = 0;
      animatingRef.current = 'caravan';
      setCameraAnimating('zoom');
      controls.enabled = false;
      caravanDoneRef.current = true;
    }

    if (animatingRef.current === 'caravan') {
      if (!caravanTarget) {
        // Arrival finished — snap to final position and release controls
        animatingRef.current = null;
        setCameraAnimating(null);
        controls.enabled = true;
      } else {
        _targetPos.set(caravanTarget.x + 8, 12, caravanTarget.z + 8);
        _targetLookAt.set(caravanTarget.x, 0, caravanTarget.z);

        animElapsedRef.current += delta;
        const t = Math.min(animElapsedRef.current / CARAVAN_DURATION, 1);
        const eased = 1 - (1 - t) * (1 - t);

        camera.position.lerpVectors(animStartPosRef.current, _targetPos, eased);
        controls.target.lerpVectors(animStartTargetRef.current, _targetLookAt, eased);
        controls.update();

        if (t >= 1) {
          camera.position.copy(_targetPos);
          controls.target.copy(_targetLookAt);
          controls.update();
          animatingRef.current = null;
          setCameraAnimating(null);
          controls.enabled = true;
        }
        return;
      }
    }

    const cameraTarget = getCameraTarget();

    // Detect transition: cameraTarget just appeared (zoom in)
    if (cameraTarget && !lastCameraTargetRef.current) {
      // Save current position and target for return
      returnPosRef.current = camera.position.clone();
      returnTargetRef.current = controls.target.clone();
      animStartPosRef.current.copy(camera.position);
      animStartTargetRef.current.copy(controls.target);
      animElapsedRef.current = 0;
      animatingRef.current = 'zoom';
      setCameraAnimating('zoom');
      controls.enabled = false;
    }

    // Detect transition: cameraTarget just cleared (return)
    if (!cameraTarget && lastCameraTargetRef.current && returnPosRef.current) {
      animStartPosRef.current.copy(camera.position);
      animStartTargetRef.current.copy(controls.target);
      animElapsedRef.current = 0;
      animatingRef.current = 'return';
      setCameraAnimating('return');
      controls.enabled = false;
    }

    lastCameraTargetRef.current = cameraTarget ? { x: cameraTarget.x, z: cameraTarget.z } : null;

    // Animate zoom-in to building street level
    if (animatingRef.current === 'zoom' && cameraTarget) {
      _targetPos.set(cameraTarget.x + 0.5, 2, cameraTarget.z + 2);
      _targetLookAt.set(cameraTarget.x + 0.5, 3, cameraTarget.z + 0.5);

      animElapsedRef.current += delta;
      const t = Math.min(animElapsedRef.current / ZOOM_IN_DURATION, 1);
      // Smooth ease-out for natural deceleration
      const eased = 1 - (1 - t) * (1 - t);

      camera.position.lerpVectors(animStartPosRef.current, _targetPos, eased);
      controls.target.lerpVectors(animStartTargetRef.current, _targetLookAt, eased);
      controls.update();

      // Animation complete
      if (t >= 1) {
        camera.position.copy(_targetPos);
        controls.target.copy(_targetLookAt);
        controls.update();
        animatingRef.current = null;
        setCameraAnimating(null);
        // Keep controls disabled while panel is open
      }
      return; // Skip normal input processing during animation
    }

    // Animate return to saved position
    if (animatingRef.current === 'return' && returnPosRef.current && returnTargetRef.current) {
      animElapsedRef.current += delta;
      const t = Math.min(animElapsedRef.current / RETURN_DURATION, 1);
      // Smooth ease-out
      const eased = 1 - (1 - t) * (1 - t);

      camera.position.lerpVectors(animStartPosRef.current, returnPosRef.current, eased);
      controls.target.lerpVectors(animStartTargetRef.current, returnTargetRef.current, eased);
      controls.update();

      // Animation complete
      if (t >= 1) {
        camera.position.copy(returnPosRef.current);
        controls.target.copy(returnTargetRef.current);
        controls.update();
        returnPosRef.current = null;
        returnTargetRef.current = null;
        animatingRef.current = null;
        setCameraAnimating(null);
        controls.enabled = true;
      }
      return; // Skip normal input processing during animation
    }

    // Skip normal input if controls are disabled (panel open at street level)
    if (!controls.enabled) return;

    // Normal keyboard/gamepad input processing
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
      const newDist = THREE.MathUtils.clamp(dist + axes.camera_zoom * ZOOM_SPEED, 3, 50);
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
      minDistance={3}
      maxDistance={50}
      maxPolarAngle={Math.PI / 2.2}
      enableDamping
      dampingFactor={0.1}
      screenSpacePanning={false}
    />
  );
};

export default CameraController;

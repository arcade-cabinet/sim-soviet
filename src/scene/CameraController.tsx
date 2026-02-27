/**
 * CameraController — ArcRotateCamera orbiting the Soviet city.
 *
 * Inspired by Cities Skylines: orbit/rotate/zoom/pan around the cityscape.
 *
 * - Default view from southwest at ~30° from horizontal (nice 3D perspective)
 * - Mouse drag to orbit, scroll/pinch to zoom (radius 5–80)
 * - Right-click or Ctrl+click to pan the view
 * - WASD / arrow keys to pan the target point (camera-relative)
 * - Beta (tilt) freely adjustable between near-overhead and near-street-level
 */
import React, { useEffect } from 'react';
import {
  ArcRotateCamera,
  Vector3,
  KeyboardEventTypes,
  type Observer,
  type KeyboardInfo,
} from '@babylonjs/core';
import { useScene } from 'reactylon';
import { GRID_SIZE } from '../engine/GridTypes';

const MIN_RADIUS = 5;
const MAX_RADIUS = 80;
const PAN_SPEED = 0.3;
const GRID_MARGIN = 15;

const CameraController: React.FC = () => {
  const scene = useScene();

  useEffect(() => {
    // Start focused on the starter buildings (roughly at grid 5-9, 4-8)
    // rather than the grid center, so the player sees the city immediately
    const targetX = 7;
    const targetZ = 6;

    const camera = new ArcRotateCamera(
      'cityCamera',
      -Math.PI / 4,    // alpha: 45° from +X — viewing from southwest
      Math.PI / 3.5,   // beta: ~51° from vertical — classic city builder bird's-eye
      25,               // radius: closer to buildings for better initial view
      new Vector3(targetX, 0, targetZ), // target centered on starter buildings
      scene,
    );

    // Zoom limits
    camera.lowerRadiusLimit = MIN_RADIUS;
    camera.upperRadiusLimit = MAX_RADIUS;

    // Tilt limits (beta = angle from vertical: 0 = straight down, π/2 = horizontal)
    camera.lowerBetaLimit = 0.3;   // ~17° from vertical — near bird-eye
    camera.upperBetaLimit = 1.5;   // ~86° from vertical — near street-level

    // Control sensitivity
    camera.wheelPrecision = 15;
    camera.pinchPrecision = 40;
    camera.panningSensibility = 80;
    camera.angularSensibilityX = 500;
    camera.angularSensibilityY = 500;
    camera.inertia = 0.85;

    // Pan on XZ plane only (don't lift target off the ground)
    camera.panningAxis = new Vector3(1, 0, 1);

    // Remove default keyboard orbit — we use keyboard for panning instead
    camera.inputs.removeByType('ArcRotateCameraKeyboardMoveInput');

    // Attach mouse/touch controls to the canvas
    const canvas = scene.getEngine().getRenderingCanvas();
    if (canvas) {
      camera.attachControl(canvas, true);
    }
    scene.activeCamera = camera;

    // --- WASD / Arrow key panning ---
    const keys = new Set<string>();

    const keyObs: Observer<KeyboardInfo> = scene.onKeyboardObservable.add(
      (info) => {
        const key = info.event.key.toLowerCase();
        if (info.type === KeyboardEventTypes.KEYDOWN) {
          keys.add(key);
        } else if (info.type === KeyboardEventTypes.KEYUP) {
          keys.delete(key);
        }
      },
    )!;

    function tick() {
      // Keyboard pan: WASD / arrow keys move the target point
      let dx = 0;
      let dz = 0;
      const speed = PAN_SPEED * (camera.radius / 30);
      if (keys.has('w') || keys.has('arrowup')) dz -= speed;
      if (keys.has('s') || keys.has('arrowdown')) dz += speed;
      if (keys.has('a') || keys.has('arrowleft')) dx -= speed;
      if (keys.has('d') || keys.has('arrowright')) dx += speed;

      if (dx !== 0 || dz !== 0) {
        // Move relative to camera's horizontal angle (alpha)
        const cosA = Math.cos(camera.alpha);
        const sinA = Math.sin(camera.alpha);
        camera.target.x += dx * cosA - dz * sinA;
        camera.target.z += dx * sinA + dz * cosA;
      }

      // Clamp target to stay near the grid
      camera.target.x = Math.max(
        -GRID_MARGIN,
        Math.min(GRID_SIZE + GRID_MARGIN, camera.target.x),
      );
      camera.target.z = Math.max(
        -GRID_MARGIN,
        Math.min(GRID_SIZE + GRID_MARGIN, camera.target.z),
      );
      camera.target.y = 2;
    }

    scene.registerBeforeRender(tick);

    return () => {
      scene.unregisterBeforeRender(tick);
      scene.onKeyboardObservable.remove(keyObs);
      camera.dispose();
    };
  }, [scene]);

  return null;
};

export default CameraController;

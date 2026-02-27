/**
 * VehicleRenderer — Cars on roads using thin instances.
 *
 * Reads gameState.traffic[] array. Each vehicle = small colored box (0.3 units)
 * positioned at (v.x, 0.1, v.y). Color from vehicle.color property.
 * Performance: uses thin instances for many vehicles.
 */
import React, { useEffect, useRef } from 'react';
import {
  MeshBuilder,
  StandardMaterial,
  Color3,
  Color4,
  Matrix,
  Vector3,
  type Mesh,
  type Scene,
} from '@babylonjs/core';
import { useScene } from 'reactylon';

import { gameState } from '../engine/GameState';

/** Parse a hex color string to Color4 */
function hexToColor4(hex: string): Color4 {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return new Color4(r, g, b, 1);
}

const VehicleRenderer: React.FC = () => {
  const scene = useScene();
  const meshRef = useRef<Mesh | null>(null);

  useEffect(() => {
    // Template box for thin instances
    const box = MeshBuilder.CreateBox(
      'vehicleTemplate',
      { width: 0.3, height: 0.15, depth: 0.2 },
      scene,
    );
    const mat = new StandardMaterial('vehicleMat', scene);
    mat.diffuseColor = new Color3(0.3, 0.3, 0.3);
    box.material = mat;
    box.isVisible = false;
    meshRef.current = box;

    function update() {
      const traffic = gameState.traffic;
      if (traffic.length === 0) {
        box.isVisible = false;
        box.thinInstanceCount = 0;
        return;
      }

      box.isVisible = true;

      const matrices = new Float32Array(traffic.length * 16);
      const colors = new Float32Array(traffic.length * 4);

      for (let i = 0; i < traffic.length; i++) {
        const v = traffic[i];
        const m = Matrix.Translation(v.x, 0.1, v.y);
        m.copyToArray(matrices, i * 16);

        const c = hexToColor4(v.color);
        colors[i * 4] = c.r;
        colors[i * 4 + 1] = c.g;
        colors[i * 4 + 2] = c.b;
        colors[i * 4 + 3] = c.a;
      }

      box.thinInstanceSetBuffer('matrix', matrices, 16, false);
      box.thinInstanceSetBuffer('color', colors, 4, false);
    }

    scene.registerBeforeRender(update);
    return () => {
      scene.unregisterBeforeRender(update);
      box.dispose();
      mat.dispose();
    };
  }, [scene]);

  return null;
};

export default VehicleRenderer;

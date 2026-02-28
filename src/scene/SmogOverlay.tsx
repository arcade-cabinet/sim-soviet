/**
 * SmogOverlay — Per-tile smog visualization using thin instances.
 *
 * For each grid cell with smog > 0: renders a semi-transparent green-tinted plane.
 * Alpha = Math.min(1.0, cell.smog / 100).
 * Color transitions from green (low) to yellow-orange (high smog).
 * At street level, smog uses thin boxes with height for volumetric feel.
 * Performance: uses a single mesh with thin instances.
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
import { GRID_SIZE } from '../engine/GridTypes';

/** Minimum smog value to render (skip nearly-clean cells) */
const SMOG_THRESHOLD = 8;

/** Lerp between muted green and warm amber based on smog ratio */
function smogColor(ratio: number): Color3 {
  // Muted green (0.2,0.4,0.1) -> Warm yellow (0.6,0.5,0.1) -> Amber (0.7,0.3,0.05)
  if (ratio < 0.5) {
    const t = ratio * 2;
    return new Color3(0.2 + t * 0.4, 0.4 + t * 0.1, 0.1);
  }
  const t = (ratio - 0.5) * 2;
  return new Color3(0.6 + t * 0.1, 0.5 - t * 0.2, 0.1 - t * 0.05);
}

const SmogOverlay: React.FC = () => {
  const scene = useScene();
  const meshRef = useRef<Mesh | null>(null);
  const matRef = useRef<StandardMaterial | null>(null);

  useEffect(() => {
    // Create a single thin box to use as smog volume
    const box = MeshBuilder.CreateBox(
      'smogTemplate',
      { width: 1, height: 0.5, depth: 1 },
      scene,
    );
    box.isVisible = false; // template mesh is hidden

    const mat = new StandardMaterial('smogMat', scene);
    mat.disableLighting = true;
    mat.alpha = 0.2;
    mat.emissiveColor = new Color3(0.3, 0.5, 0.1);
    mat.backFaceCulling = false;
    box.material = mat;

    meshRef.current = box;
    matRef.current = mat;

    function update() {
      const grid = gameState.grid;
      if (!grid.length) return;

      // Collect smog cells
      const matrices: Matrix[] = [];
      const colors: number[] = [];

      for (let y = 0; y < GRID_SIZE; y++) {
        const row = grid[y];
        if (!row) continue;
        for (let x = 0; x < GRID_SIZE; x++) {
          const cell = row[x];
          if (!cell || cell.smog < SMOG_THRESHOLD) continue;

          const ratio = Math.min(1.0, cell.smog / 100);
          // Quadratic falloff: low smog fades fast, high smog builds gradually
          const intensity = ratio * ratio;
          const height = 0.2 + intensity * 0.8;
          // Shrink low-smog boxes to create natural gaps at the edge
          const spread = 0.5 + ratio * 0.5;
          const m = Matrix.Compose(
            new Vector3(spread, height, spread),
            Vector3.Zero().toQuaternion(),
            new Vector3(x + 0.5, (cell.z ?? 0) * 0.5 + height / 2, y + 0.5),
          );
          matrices.push(m);

          const c = smogColor(ratio);
          const alpha = intensity * 0.5;
          colors.push(c.r, c.g, c.b, alpha);
        }
      }

      // Update thin instances
      if (matrices.length === 0) {
        box.isVisible = false;
        box.thinInstanceCount = 0;
        return;
      }

      box.isVisible = true;
      const bufferData = new Float32Array(matrices.length * 16);
      for (let i = 0; i < matrices.length; i++) {
        matrices[i].copyToArray(bufferData, i * 16);
      }
      box.thinInstanceSetBuffer('matrix', bufferData, 16, false);

      // Per-instance colors
      const colorData = new Float32Array(colors);
      box.thinInstanceSetBuffer('color', colorData, 4, false);
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

export default SmogOverlay;

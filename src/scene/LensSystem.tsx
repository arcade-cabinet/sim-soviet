/**
 * LensSystem — Visual lens mode overlays.
 *
 * 'default': normal rendering (no overrides).
 * 'water': dark overlay on all tiles + blue highlight on watered tiles + cyan pipes.
 * 'power': buildings tinted green (powered) or red (unpowered), non-power dimmed.
 * 'smog': orange-green heatmap on terrain tiles.
 * 'aura': show aura rings, dim everything else to dark.
 *
 * Reads activeLens from gameState, apply/remove material overrides when lens changes.
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

import { gameState, type LensType } from '../engine/GameState';
import { GRID_SIZE } from '../engine/GridTypes';

interface LensMeshes {
  darkOverlay: Mesh;
  waterHighlight: Mesh;
  pipeLines: Mesh | null;
  powerOverlay: Mesh;
  smogHeatmap: Mesh;
  auraOverlay: Mesh;
}

function createOverlayPlane(
  name: string,
  scene: Scene,
  color: Color3,
  alpha: number,
): Mesh {
  const mesh = MeshBuilder.CreateGround(
    name,
    { width: GRID_SIZE, height: GRID_SIZE },
    scene,
  );
  const mat = new StandardMaterial(`${name}_mat`, scene);
  mat.emissiveColor = color;
  mat.alpha = alpha;
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  mesh.material = mat;
  mesh.position = new Vector3(GRID_SIZE / 2 - 0.5, 0.01, GRID_SIZE / 2 - 0.5);
  mesh.isVisible = false;
  mesh.isPickable = false;
  return mesh;
}

const LensSystem: React.FC = () => {
  const scene = useScene();
  const meshesRef = useRef<LensMeshes | null>(null);
  const prevLensRef = useRef<LensType>('default');
  const waterTilesRef = useRef<Mesh | null>(null);
  const powerTilesRef = useRef<Mesh | null>(null);

  useEffect(() => {
    // Create persistent overlay meshes
    const darkOverlay = createOverlayPlane('lensWaterDark', scene, new Color3(0, 0, 0), 0.6);
    const waterHighlight = createOverlayPlane('lensWaterBlue', scene, new Color3(0, 0.6, 1), 0.3);
    const powerOverlay = createOverlayPlane('lensPowerDim', scene, new Color3(0.1, 0.1, 0.1), 0.5);
    const smogHeatmap = createOverlayPlane('lensSmogHeat', scene, new Color3(0.8, 0.4, 0), 0.4);
    const auraOverlay = createOverlayPlane('lensAuraDim', scene, new Color3(0, 0, 0.05), 0.7);

    // Water tile highlight instances
    const waterBox = MeshBuilder.CreateBox(
      'waterTileHighlight',
      { width: 1, height: 0.02, depth: 1 },
      scene,
    );
    const waterBoxMat = new StandardMaterial('waterTileMat', scene);
    waterBoxMat.emissiveColor = new Color3(0, 0.6, 1);
    waterBoxMat.alpha = 0.3;
    waterBoxMat.disableLighting = true;
    waterBox.material = waterBoxMat;
    waterBox.isVisible = false;
    waterBox.isPickable = false;
    waterTilesRef.current = waterBox;

    // Power tile overlay instances
    const powerBox = MeshBuilder.CreateBox(
      'powerTileOverlay',
      { width: 0.9, height: 0.5, depth: 0.9 },
      scene,
    );
    const powerBoxMat = new StandardMaterial('powerTileMat', scene);
    powerBoxMat.disableLighting = true;
    powerBoxMat.alpha = 0.5;
    powerBox.material = powerBoxMat;
    powerBox.isVisible = false;
    powerBox.isPickable = false;
    powerTilesRef.current = powerBox;

    meshesRef.current = {
      darkOverlay,
      waterHighlight,
      pipeLines: null,
      powerOverlay,
      smogHeatmap,
      auraOverlay,
    };

    function hideAll() {
      darkOverlay.isVisible = false;
      waterHighlight.isVisible = false;
      powerOverlay.isVisible = false;
      smogHeatmap.isVisible = false;
      auraOverlay.isVisible = false;
      waterBox.isVisible = false;
      waterBox.thinInstanceCount = 0;
      powerBox.isVisible = false;
      powerBox.thinInstanceCount = 0;
    }

    function updateWaterLens() {
      darkOverlay.isVisible = true;
      const grid = gameState.grid;
      if (!grid.length) return;

      const matrices: Matrix[] = [];
      for (let y = 0; y < GRID_SIZE; y++) {
        const row = grid[y];
        if (!row) continue;
        for (let x = 0; x < GRID_SIZE; x++) {
          const cell = row[x];
          if (cell?.watered) {
            matrices.push(Matrix.Translation(x, cell.z + 0.02, y));
          }
        }
      }

      if (matrices.length > 0) {
        waterBox.isVisible = true;
        const buf = new Float32Array(matrices.length * 16);
        for (let i = 0; i < matrices.length; i++) {
          matrices[i].copyToArray(buf, i * 16);
        }
        waterBox.thinInstanceSetBuffer('matrix', buf, 16, false);
      }
    }

    function updatePowerLens() {
      const buildings = gameState.buildings;
      const matrices: Matrix[] = [];
      const colors: number[] = [];

      for (const b of buildings) {
        const isPowerSrc = b.type === 'farm' || b.type === 'tap' || b.type === 'pump';
        const cell = gameState.grid[b.y]?.[b.x];
        const z = cell?.z ?? 0;

        if (isPowerSrc) {
          // Dim non-power buildings
          matrices.push(Matrix.Translation(b.x, z + 0.25, b.y));
          colors.push(0.2, 0.2, 0.2, 0.5);
        } else if (b.powered) {
          matrices.push(Matrix.Translation(b.x, z + 0.25, b.y));
          colors.push(0, 0.9, 0.45, 0.5);
        } else {
          matrices.push(Matrix.Translation(b.x, z + 0.25, b.y));
          colors.push(0.83, 0.18, 0.18, 0.5);
        }
      }

      if (matrices.length > 0) {
        powerBox.isVisible = true;
        const buf = new Float32Array(matrices.length * 16);
        for (let i = 0; i < matrices.length; i++) {
          matrices[i].copyToArray(buf, i * 16);
        }
        powerBox.thinInstanceSetBuffer('matrix', buf, 16, false);
        powerBox.thinInstanceSetBuffer('color', new Float32Array(colors), 4, false);
      }
    }

    function update() {
      const lens = gameState.activeLens;
      if (lens === prevLensRef.current) {
        // Still update dynamic lenses
        if (lens === 'water') updateWaterLens();
        else if (lens === 'power') updatePowerLens();
        return;
      }

      prevLensRef.current = lens;
      hideAll();

      switch (lens) {
        case 'water':
          updateWaterLens();
          break;
        case 'power':
          powerOverlay.isVisible = true;
          updatePowerLens();
          break;
        case 'smog':
          smogHeatmap.isVisible = true;
          break;
        case 'aura':
          auraOverlay.isVisible = true;
          break;
        case 'default':
        default:
          break;
      }
    }

    scene.registerBeforeRender(update);
    return () => {
      scene.unregisterBeforeRender(update);
      hideAll();
      darkOverlay.dispose();
      waterHighlight.dispose();
      powerOverlay.dispose();
      smogHeatmap.dispose();
      auraOverlay.dispose();
      waterBox.dispose();
      waterBoxMat.dispose();
      powerBox.dispose();
      powerBoxMat.dispose();
    };
  }, [scene]);

  return null;
};

export default LensSystem;

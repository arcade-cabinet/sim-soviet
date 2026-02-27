/**
 * FloatingText — Billboard text using DynamicTexture.
 *
 * Reads gameState.floatingTexts[] array. Each = DynamicTexture on a plane
 * with billboard mode. Text content and color from item properties. Float
 * upward (Y increases) and fade out (alpha decreases) over life duration.
 * Dispose when life reaches 0.
 */
import React, { useEffect, useRef } from 'react';
import {
  MeshBuilder,
  StandardMaterial,
  DynamicTexture,
  Vector3,
  type Mesh,
  type Scene,
} from '@babylonjs/core';
import { useScene } from 'reactylon';

import { gameState } from '../engine/GameState';

interface TextInstance {
  mesh: Mesh;
  mat: StandardMaterial;
  texture: DynamicTexture;
  id: number;
}

let nextTextId = 0;

const FloatingText: React.FC = () => {
  const scene = useScene();
  const instancesRef = useRef<Map<number, TextInstance>>(new Map());
  const trackedTextsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    function createTextMesh(
      text: string,
      color: string,
      x: number,
      y: number,
      z: number,
    ): TextInstance {
      const id = nextTextId++;

      // DynamicTexture for text rendering
      const textureSize = 256;
      const texture = new DynamicTexture(
        `floatText_${id}`,
        { width: textureSize, height: 64 },
        scene,
        false,
      );
      texture.hasAlpha = true;

      // BabylonJS ICanvasRenderingContext lacks textAlign/textBaseline but
      // the underlying context supports them at runtime (native canvas shim).
      const ctx = texture.getContext() as any;
      ctx.clearRect(0, 0, textureSize, 64);
      ctx.font = 'bold 28px monospace';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, textureSize / 2, 32);
      texture.update();

      const mat = new StandardMaterial(`floatTextMat_${id}`, scene);
      mat.diffuseTexture = texture;
      mat.emissiveTexture = texture;
      mat.disableLighting = true;
      mat.useAlphaFromDiffuseTexture = true;
      mat.backFaceCulling = false;
      mat.alpha = 1;

      const plane = MeshBuilder.CreatePlane(
        `floatTextPlane_${id}`,
        { width: 2, height: 0.5 },
        scene,
      );
      plane.material = mat;
      plane.position = new Vector3(x, z + 1, y);
      plane.billboardMode = 7; // BILLBOARDMODE_ALL
      plane.isPickable = false;

      return { mesh: plane, mat, texture, id };
    }

    function update() {
      const texts = gameState.floatingTexts;
      const instances = instancesRef.current;
      const tracked = trackedTextsRef.current;

      // Track by index in the array for simplicity
      // Create new instances for new texts
      for (let i = 0; i < texts.length; i++) {
        const t = texts[i];
        if (!tracked.has(i) && t.life > 0) {
          const cellZ = gameState.grid[Math.round(t.y)]?.[Math.round(t.x)]?.z ?? 0;
          const instance = createTextMesh(t.text, t.color, t.x, t.y, cellZ);
          instances.set(i, instance);
          tracked.add(i);
        }
      }

      // Update existing instances
      for (const [idx, instance] of instances) {
        const t = texts[idx];
        if (!t || t.life <= 0) {
          // Remove
          instance.mesh.dispose();
          instance.mat.dispose();
          instance.texture.dispose();
          instances.delete(idx);
          tracked.delete(idx);
          continue;
        }

        // Float upward
        const progress = 1 - t.life / t.maxLife;
        const cellZ = gameState.grid[Math.round(t.y)]?.[Math.round(t.x)]?.z ?? 0;
        instance.mesh.position.y = cellZ + 1 + progress * 2;

        // Fade out
        instance.mat.alpha = t.life / t.maxLife;
      }

      // Clean up tracked indices that no longer exist in the array
      for (const idx of tracked) {
        if (idx >= texts.length) {
          const instance = instances.get(idx);
          if (instance) {
            instance.mesh.dispose();
            instance.mat.dispose();
            instance.texture.dispose();
            instances.delete(idx);
          }
          tracked.delete(idx);
        }
      }
    }

    scene.registerBeforeRender(update);
    return () => {
      scene.unregisterBeforeRender(update);
      for (const instance of instancesRef.current.values()) {
        instance.mesh.dispose();
        instance.mat.dispose();
        instance.texture.dispose();
      }
      instancesRef.current.clear();
      trackedTextsRef.current.clear();
    };
  }, [scene]);

  return null;
};

export default FloatingText;

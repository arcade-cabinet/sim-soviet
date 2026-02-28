/**
 * LightningRenderer — Storm lightning bolt effect.
 *
 * Triggered by gameState.activeLightning. White jagged line mesh from sky (y=50)
 * to strike point. Full-screen white flash (scene ambient spike for 2 frames).
 * Mesh and flash fade over ~15 frames then dispose. Lightning bolt has jagged
 * segments with random offsets along Y.
 */
import React, { useEffect, useRef } from 'react';
import {
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  type Mesh,
  type LinesMesh,
  type Scene,
} from '@babylonjs/core';
import { useScene } from 'reactylon';

import { gameState } from '../engine/GameState';

const BOLT_Y_START = 50;
const BOLT_SEGMENTS = 12;
const FADE_FRAMES = 15;

interface BoltInstance {
  mesh: LinesMesh;
  framesLeft: number;
  originalAmbient: Color3;
  flashFrames: number;
}

const LightningRenderer: React.FC = () => {
  const scene = useScene();
  const boltRef = useRef<BoltInstance | null>(null);
  const prevLightningRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    function createBolt(targetX: number, targetY: number): LinesMesh {
      const points: Vector3[] = [];
      const startY = BOLT_Y_START;
      const endPos = new Vector3(targetX, 0, targetY);
      const startPos = new Vector3(targetX + (Math.random() - 0.5) * 3, startY, targetY + (Math.random() - 0.5) * 3);

      for (let i = 0; i <= BOLT_SEGMENTS; i++) {
        const t = i / BOLT_SEGMENTS;
        const pos = Vector3.Lerp(startPos, endPos, t);

        // Add jagged random offsets (not at start or end)
        if (i > 0 && i < BOLT_SEGMENTS) {
          pos.x += (Math.random() - 0.5) * 2;
          pos.z += (Math.random() - 0.5) * 2;
          pos.y += (Math.random() - 0.5) * 3;
        }

        points.push(pos);
      }

      const bolt = MeshBuilder.CreateLines(
        'lightning',
        { points },
        scene,
      );
      bolt.color = new Color3(1, 1, 1);
      bolt.isPickable = false;
      return bolt;
    }

    function update() {
      const lightning = gameState.activeLightning;

      // Detect new lightning
      if (lightning) {
        const prev = prevLightningRef.current;
        const isNew = !prev || prev.x !== lightning.x || prev.y !== lightning.y;

        if (isNew) {
          // Dispose any existing bolt
          if (boltRef.current) {
            boltRef.current.mesh.dispose();
          }

          const mesh = createBolt(lightning.x, lightning.y);
          boltRef.current = {
            mesh,
            framesLeft: FADE_FRAMES,
            originalAmbient: scene.ambientColor.clone(),
            flashFrames: 2,
          };

          prevLightningRef.current = { x: lightning.x, y: lightning.y };
        }
      }

      // Animate active bolt
      if (boltRef.current) {
        const bolt = boltRef.current;

        // Flash: spike scene ambient for 2 frames
        if (bolt.flashFrames > 0) {
          scene.ambientColor = new Color3(1, 1, 1);
          bolt.flashFrames--;
        } else {
          scene.ambientColor = bolt.originalAmbient;
        }

        // Fade bolt
        bolt.framesLeft--;
        const alpha = bolt.framesLeft / FADE_FRAMES;
        bolt.mesh.alpha = alpha;

        if (bolt.framesLeft <= 0) {
          bolt.mesh.dispose();
          scene.ambientColor = bolt.originalAmbient;
          boltRef.current = null;
          prevLightningRef.current = null;
        }
      }
    }

    scene.registerBeforeRender(update);
    return () => {
      scene.unregisterBeforeRender(update);
      if (boltRef.current) {
        scene.ambientColor = boltRef.current.originalAmbient;
        boltRef.current.mesh.dispose();
        boltRef.current = null;
      }
    };
  }, [scene]);

  return null;
};

export default LightningRenderer;

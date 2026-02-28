/**
 * MeteorRenderer — Meteor impact visual effect.
 *
 * When meteor.active: glowing white sphere with orange trail particles descending
 * from sky. Trail = cone-shaped particle system behind meteor. Screen shake increases
 * as meteor descends. On impact (z <= 0): explosion particle burst, crater appears,
 * screen flash. Dispose meteor mesh after impact.
 */
import React, { useEffect, useRef } from 'react';
import {
  MeshBuilder,
  StandardMaterial,
  ParticleSystem,
  Color3,
  Color4,
  Vector3,
  type Mesh,
  type Scene,
  type ArcRotateCamera,
} from '@babylonjs/core';
import { useScene } from 'reactylon';

import { gameState } from '../engine/GameState';

interface MeteorVisuals {
  sphere: Mesh;
  trail: ParticleSystem;
  explosion: ParticleSystem | null;
}

const MeteorRenderer: React.FC = () => {
  const scene = useScene();
  const visualsRef = useRef<MeteorVisuals | null>(null);
  const wasActiveRef = useRef(false);
  const flashFramesRef = useRef(0);
  const originalAmbientRef = useRef<Color3 | null>(null);

  useEffect(() => {
    function createMeteor(): MeteorVisuals {
      // Glowing sphere
      const mat = new StandardMaterial('meteorMat', scene);
      mat.emissiveColor = new Color3(1, 1, 1);
      mat.disableLighting = true;

      const sphere = MeshBuilder.CreateSphere(
        'meteor',
        { diameter: 0.6, segments: 8 },
        scene,
      );
      sphere.material = mat;

      // Orange trail particles
      const trail = new ParticleSystem('meteorTrail', 500, scene);
      trail.createPointEmitter(
        new Vector3(-0.5, 0.5, -0.5),
        new Vector3(0.5, 2, 0.5),
      );
      trail.color1 = new Color4(1, 0.6, 0, 1);
      trail.color2 = new Color4(1, 0.3, 0, 0.8);
      trail.colorDead = new Color4(0.5, 0.1, 0, 0);
      trail.minSize = 0.05;
      trail.maxSize = 0.2;
      trail.minLifeTime = 0.2;
      trail.maxLifeTime = 0.6;
      trail.emitRate = 200;
      trail.gravity = new Vector3(0, -1, 0);
      trail.minEmitPower = 1;
      trail.maxEmitPower = 3;
      trail.updateSpeed = 0.01;
      trail.start();

      return { sphere, trail, explosion: null };
    }

    function createExplosion(x: number, z: number): ParticleSystem {
      const explosion = new ParticleSystem('meteorExplosion', 1000, scene);
      explosion.createSphereEmitter(2);
      explosion.emitter = new Vector3(x, 0.2, z);
      explosion.color1 = new Color4(1, 0.5, 0, 1);
      explosion.color2 = new Color4(1, 0.2, 0, 0.8);
      explosion.colorDead = new Color4(0.3, 0.05, 0, 0);
      explosion.minSize = 0.1;
      explosion.maxSize = 0.5;
      explosion.minLifeTime = 0.3;
      explosion.maxLifeTime = 1.0;
      explosion.emitRate = 0; // burst mode
      explosion.gravity = new Vector3(0, 2, 0);
      explosion.minEmitPower = 3;
      explosion.maxEmitPower = 8;
      explosion.updateSpeed = 0.01;
      explosion.manualEmitCount = 500;
      explosion.targetStopDuration = 0.5;
      explosion.disposeOnStop = true;
      explosion.start();
      return explosion;
    }

    function update() {
      const meteor = gameState.meteor;

      // Handle flash fade
      if (flashFramesRef.current > 0) {
        flashFramesRef.current--;
        const t = flashFramesRef.current / 10;
        scene.ambientColor = Color3.Lerp(
          originalAmbientRef.current ?? new Color3(0.2, 0.2, 0.2),
          new Color3(1, 1, 1),
          t,
        );
        if (flashFramesRef.current <= 0 && originalAmbientRef.current) {
          scene.ambientColor = originalAmbientRef.current;
        }
      }

      if (meteor.active) {
        if (!visualsRef.current) {
          visualsRef.current = createMeteor();
        }

        const v = visualsRef.current;
        const worldY = meteor.z * 0.03; // scale z to world Y
        v.sphere.position = new Vector3(meteor.x, worldY, meteor.y);
        v.trail.emitter = v.sphere.position.clone();

        // Increasing screen shake as meteor descends
        const shakeIntensity = Math.max(0, 1 - worldY / 30) * 0.15;
        if (shakeIntensity > 0.01) {
          const cam = scene.activeCamera as ArcRotateCamera | null;
          if (cam?.target) {
            cam.target.x += (Math.random() - 0.5) * shakeIntensity;
            cam.target.z += (Math.random() - 0.5) * shakeIntensity;
          }
        }

        wasActiveRef.current = true;
      } else if (wasActiveRef.current) {
        // Meteor just impacted
        wasActiveRef.current = false;

        if (visualsRef.current) {
          const v = visualsRef.current;

          // Explosion at impact point
          createExplosion(
            v.sphere.position.x,
            v.sphere.position.z,
          );

          // Screen flash
          originalAmbientRef.current = scene.ambientColor.clone();
          flashFramesRef.current = 10;
          scene.ambientColor = new Color3(1, 1, 1);

          // Dispose meteor
          v.sphere.dispose();
          v.trail.stop();
          v.trail.dispose();
          visualsRef.current = null;
        }
      }
    }

    scene.registerBeforeRender(update);
    return () => {
      scene.unregisterBeforeRender(update);
      if (visualsRef.current) {
        visualsRef.current.sphere.dispose();
        visualsRef.current.trail.stop();
        visualsRef.current.trail.dispose();
        visualsRef.current = null;
      }
      if (originalAmbientRef.current) {
        scene.ambientColor = originalAmbientRef.current;
      }
    };
  }, [scene]);

  return null;
};

export default MeteorRenderer;

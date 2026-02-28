/**
 * ZeppelinRenderer — Firefighting airships.
 *
 * Reads gameState.zeppelins[] array. Each = ellipsoid mesh floating at y=15
 * above grid. Gondola = small box underneath. Shadow = dark ellipse on ground.
 * Animate position smoothly toward target. When over fire, show water-drop
 * particle effect.
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
} from '@babylonjs/core';
import { useScene } from 'reactylon';

import { gameState } from '../engine/GameState';
import { GRID_SIZE } from '../engine/GridTypes';

const FLOAT_Y = 8;
const LERP_SPEED = 0.02;

interface ZepMeshes {
  body: Mesh;
  gondola: Mesh;
  shadow: Mesh;
  waterDrop: ParticleSystem;
}

function createZepMeshes(scene: Scene, id: number): ZepMeshes {
  const bodyMat = new StandardMaterial(`zepBody_${id}`, scene);
  bodyMat.diffuseColor = new Color3(0.5, 0.5, 0.5);

  const body = MeshBuilder.CreateSphere(
    `zepBody_${id}`,
    { diameterX: 1.5, diameterY: 0.6, diameterZ: 0.7, segments: 8 },
    scene,
  );
  body.material = bodyMat;

  const gondolaMat = new StandardMaterial(`zepGondola_${id}`, scene);
  gondolaMat.diffuseColor = new Color3(0.25, 0.2, 0.15);

  const gondola = MeshBuilder.CreateBox(
    `zepGondola_${id}`,
    { width: 0.4, height: 0.15, depth: 0.25 },
    scene,
  );
  gondola.material = gondolaMat;

  const shadowMat = new StandardMaterial(`zepShadow_${id}`, scene);
  shadowMat.diffuseColor = new Color3(0, 0, 0);
  shadowMat.alpha = 0.3;
  shadowMat.disableLighting = true;

  const shadow = MeshBuilder.CreateDisc(
    `zepShadow_${id}`,
    { radius: 0.6, tessellation: 16 },
    scene,
  );
  shadow.material = shadowMat;
  shadow.rotation.x = Math.PI / 2;

  // Water-drop particles
  const waterDrop = new ParticleSystem(`zepWater_${id}`, 100, scene);
  waterDrop.createPointEmitter(
    new Vector3(-0.1, -1, -0.1),
    new Vector3(0.1, -2, 0.1),
  );
  waterDrop.color1 = new Color4(0.3, 0.5, 1, 0.7);
  waterDrop.color2 = new Color4(0.2, 0.4, 0.9, 0.5);
  waterDrop.colorDead = new Color4(0.1, 0.2, 0.5, 0);
  waterDrop.minSize = 0.03;
  waterDrop.maxSize = 0.08;
  waterDrop.minLifeTime = 0.5;
  waterDrop.maxLifeTime = 1.0;
  waterDrop.emitRate = 80;
  waterDrop.gravity = new Vector3(0, -3, 0);
  waterDrop.minEmitPower = 0.5;
  waterDrop.maxEmitPower = 1.0;
  waterDrop.updateSpeed = 0.01;

  return { body, gondola, shadow, waterDrop };
}

const ZeppelinRenderer: React.FC = () => {
  const scene = useScene();
  const zepsRef = useRef<ZepMeshes[]>([]);

  useEffect(() => {
    function ensureMeshCount(count: number) {
      const current = zepsRef.current;
      while (current.length < count) {
        current.push(createZepMeshes(scene, current.length));
      }
      // Hide extras
      for (let i = count; i < current.length; i++) {
        current[i].body.isVisible = false;
        current[i].gondola.isVisible = false;
        current[i].shadow.isVisible = false;
        if (current[i].waterDrop.isStarted()) current[i].waterDrop.stop();
      }
    }

    function update() {
      const zeppelins = gameState.zeppelins;
      ensureMeshCount(zeppelins.length);

      for (let i = 0; i < zeppelins.length; i++) {
        const z = zeppelins[i];
        const m = zepsRef.current[i];

        // Smooth movement toward target
        const targetX = z.x;
        const targetZ = z.y;

        m.body.position.x += (targetX - m.body.position.x) * LERP_SPEED;
        m.body.position.z += (targetZ - m.body.position.z) * LERP_SPEED;
        m.body.position.y = FLOAT_Y + Math.sin(Date.now() * 0.001 + i) * 0.2;
        m.body.isVisible = true;

        // Gondola underneath
        m.gondola.position = m.body.position.clone();
        m.gondola.position.y -= 0.4;
        m.gondola.isVisible = true;

        // Shadow on ground
        m.shadow.position.x = m.body.position.x;
        m.shadow.position.z = m.body.position.z;
        m.shadow.position.y = 0.02;
        m.shadow.isVisible = true;

        // Check if over a fire
        const gx = Math.round(m.body.position.x);
        const gz = Math.round(m.body.position.z);
        const grid = gameState.grid;
        const isOverFire =
          gx >= 0 &&
          gx < GRID_SIZE &&
          gz >= 0 &&
          gz < GRID_SIZE &&
          grid[gz]?.[gx]?.onFire > 0;

        if (isOverFire) {
          m.waterDrop.emitter = m.gondola.position.clone();
          if (!m.waterDrop.isStarted()) m.waterDrop.start();
        } else {
          if (m.waterDrop.isStarted()) m.waterDrop.stop();
        }
      }
    }

    scene.registerBeforeRender(update);
    return () => {
      scene.unregisterBeforeRender(update);
      for (const z of zepsRef.current) {
        z.body.dispose();
        z.gondola.dispose();
        z.shadow.dispose();
        z.waterDrop.stop();
        z.waterDrop.dispose();
      }
      zepsRef.current = [];
    };
  }, [scene]);

  return null;
};

export default ZeppelinRenderer;

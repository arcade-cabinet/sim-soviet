/**
 * TrainRenderer — Animated train on rail.
 *
 * Reads gameState.train.active and train.x. Locomotive = dark box + chimney cylinder.
 * 4 trailing car meshes spaced 1.1 units apart. All at y=0.1, z=train.y (rail row).
 * Camera shake when train passes. Train smoke: small gray particle system from chimney.
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
import { GRID_SIZE } from '../engine/GridTypes';

const CAR_COUNT = 4;
const CAR_SPACING = 1.1;

interface TrainMeshes {
  loco: Mesh;
  chimney: Mesh;
  cars: Mesh[];
  smoke: ParticleSystem;
}

function createTrainMeshes(scene: Scene): TrainMeshes {
  const locoMat = new StandardMaterial('locoMat', scene);
  locoMat.diffuseColor = new Color3(0.15, 0.15, 0.15);

  const carMat = new StandardMaterial('carMat', scene);
  carMat.diffuseColor = new Color3(0.25, 0.2, 0.18);

  // Locomotive body
  const loco = MeshBuilder.CreateBox('loco', { width: 0.8, height: 0.4, depth: 0.5 }, scene);
  loco.material = locoMat;
  loco.isVisible = false;

  // Chimney
  const chimney = MeshBuilder.CreateCylinder('chimney', { diameter: 0.15, height: 0.3, tessellation: 8 }, scene);
  chimney.material = locoMat;
  chimney.isVisible = false;

  // Cars
  const cars: Mesh[] = [];
  for (let i = 0; i < CAR_COUNT; i++) {
    const car = MeshBuilder.CreateBox(`car_${i}`, { width: 0.7, height: 0.3, depth: 0.45 }, scene);
    car.material = carMat;
    car.isVisible = false;
    cars.push(car);
  }

  // Smoke
  const smoke = new ParticleSystem('trainSmoke', 200, scene);
  smoke.createPointEmitter(
    new Vector3(-0.1, 0.3, -0.1),
    new Vector3(0.1, 0.8, 0.1),
  );
  smoke.color1 = new Color4(0.4, 0.4, 0.4, 0.5);
  smoke.color2 = new Color4(0.3, 0.3, 0.3, 0.3);
  smoke.colorDead = new Color4(0.2, 0.2, 0.2, 0);
  smoke.minSize = 0.08;
  smoke.maxSize = 0.2;
  smoke.minLifeTime = 0.5;
  smoke.maxLifeTime = 1.5;
  smoke.emitRate = 30;
  smoke.gravity = new Vector3(0.3, 0.5, 0);
  smoke.minEmitPower = 0.2;
  smoke.maxEmitPower = 0.5;
  smoke.updateSpeed = 0.01;

  return { loco, chimney, cars, smoke };
}

const TrainRenderer: React.FC = () => {
  const scene = useScene();
  const meshesRef = useRef<TrainMeshes | null>(null);
  const shakeRef = useRef(0);

  useEffect(() => {
    const meshes = createTrainMeshes(scene);
    meshesRef.current = meshes;

    function update() {
      const train = gameState.train;
      const m = meshesRef.current!;

      if (!train.active) {
        m.loco.isVisible = false;
        m.chimney.isVisible = false;
        m.cars.forEach((c) => (c.isVisible = false));
        m.smoke.stop();

        // Decay camera shake
        if (shakeRef.current > 0) {
          shakeRef.current *= 0.9;
          if (shakeRef.current < 0.01) shakeRef.current = 0;
        }
        return;
      }

      const railZ = train.y;
      const locoX = train.x;
      const baseY = 0.25;

      // Position locomotive
      m.loco.position = new Vector3(locoX, baseY, railZ);
      m.loco.isVisible = true;

      // Chimney on top
      m.chimney.position = new Vector3(locoX + 0.2, baseY + 0.35, railZ);
      m.chimney.isVisible = true;

      // Trailing cars
      for (let i = 0; i < CAR_COUNT; i++) {
        const carX = locoX - (i + 1) * CAR_SPACING;
        m.cars[i].position = new Vector3(carX, baseY - 0.05, railZ);
        m.cars[i].isVisible = carX >= -2 && carX < GRID_SIZE + 2;
      }

      // Smoke from chimney
      m.smoke.emitter = new Vector3(locoX + 0.2, baseY + 0.5, railZ);
      if (!m.smoke.isStarted()) m.smoke.start();

      // Camera shake when train is on screen
      if (locoX > 0 && locoX < GRID_SIZE) {
        shakeRef.current = 0.05;
      }

      if (shakeRef.current > 0.001) {
        const cam = scene.activeCamera as ArcRotateCamera | null;
        if (cam && cam.target) {
          cam.target.x += (Math.random() - 0.5) * shakeRef.current;
          cam.target.z += (Math.random() - 0.5) * shakeRef.current;
        }
        shakeRef.current *= 0.95;
      }
    }

    scene.registerBeforeRender(update);
    return () => {
      scene.unregisterBeforeRender(update);
      const m = meshesRef.current!;
      m.loco.dispose();
      m.chimney.dispose();
      m.cars.forEach((c) => c.dispose());
      m.smoke.stop();
      m.smoke.dispose();
    };
  }, [scene]);

  return null;
};

export default TrainRenderer;

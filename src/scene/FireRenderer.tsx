/**
 * FireRenderer — Building fire/riot particle effects.
 *
 * For each building with cell.onFire > 0: orange-red particle system emitting
 * from building top. Flickering orange PointLight at fire location. Particles
 * scale by fire intensity.
 */
import React, { useEffect, useRef } from 'react';
import {
  ParticleSystem,
  PointLight,
  Color3,
  Color4,
  Vector3,
  type Scene,
} from '@babylonjs/core';
import { useScene } from 'reactylon';

import { gameState } from '../engine/GameState';
import { GRID_SIZE } from '../engine/GridTypes';
import { getBuildingHeight } from '../engine/BuildingTypes';

interface FireInstance {
  ps: ParticleSystem;
  light: PointLight;
  key: string;
}

const FireRenderer: React.FC = () => {
  const scene = useScene();
  const firesRef = useRef<Map<string, FireInstance>>(new Map());
  const frameRef = useRef(0);

  useEffect(() => {
    function update() {
      frameRef.current++;
      const fires = firesRef.current;
      const activeKeys = new Set<string>();

      // Scan grid for fires
      const grid = gameState.grid;
      if (!grid.length) return;

      for (let y = 0; y < GRID_SIZE; y++) {
        const row = grid[y];
        if (!row) continue;
        for (let x = 0; x < GRID_SIZE; x++) {
          const cell = row[x];
          if (!cell || cell.onFire <= 0 || !cell.type) continue;

          const key = `${x}_${y}`;
          activeKeys.add(key);

          const bRef = gameState.buildings.find(
            (b) => b.x === x && b.y === y,
          );
          const level = bRef?.level ?? 0;
          const buildingH =
            getBuildingHeight(cell.type, level) * 0.02 + cell.z;
          const intensity = Math.min(cell.onFire, 15);

          if (fires.has(key)) {
            // Update existing fire intensity
            const fire = fires.get(key)!;
            fire.ps.emitRate = 50 + intensity * 20;
            fire.ps.minSize = 0.05 + intensity * 0.01;
            fire.ps.maxSize = 0.15 + intensity * 0.02;

            // Flickering light
            const flicker =
              Math.sin(frameRef.current * 0.3) * 0.3 +
              Math.sin(frameRef.current * 0.7) * 0.2;
            fire.light.intensity = 0.5 + intensity * 0.1 + flicker;
          } else {
            // Create new fire
            const pos = new Vector3(x, buildingH, y);

            const ps = new ParticleSystem(`fire_${key}`, 300, scene);
            ps.createPointEmitter(
              new Vector3(-0.2, 0.5, -0.2),
              new Vector3(0.2, 1.5, 0.2),
            );
            ps.emitter = pos;
            ps.minEmitBox = new Vector3(-0.3, 0, -0.3);
            ps.maxEmitBox = new Vector3(0.3, 0, 0.3);

            ps.color1 = new Color4(1, 0.6, 0, 1);
            ps.color2 = new Color4(1, 0.2, 0, 0.8);
            ps.colorDead = new Color4(0.3, 0.1, 0, 0);

            ps.minSize = 0.05 + intensity * 0.01;
            ps.maxSize = 0.15 + intensity * 0.02;
            ps.minLifeTime = 0.3;
            ps.maxLifeTime = 0.8;
            ps.emitRate = 50 + intensity * 20;
            ps.gravity = new Vector3(0, 1, 0);
            ps.minEmitPower = 0.5;
            ps.maxEmitPower = 1.5;
            ps.updateSpeed = 0.01;
            ps.start();

            const light = new PointLight(`fireLight_${key}`, pos, scene);
            light.diffuse = new Color3(1, 0.5, 0);
            light.intensity = 0.5 + intensity * 0.1;
            light.range = 3;

            fires.set(key, { ps, light, key });
          }
        }
      }

      // Remove fires that are no longer active
      for (const [key, fire] of fires) {
        if (!activeKeys.has(key)) {
          fire.ps.stop();
          fire.ps.dispose();
          fire.light.dispose();
          fires.delete(key);
        }
      }
    }

    scene.registerBeforeRender(update);
    return () => {
      scene.unregisterBeforeRender(update);
      for (const fire of firesRef.current.values()) {
        fire.ps.stop();
        fire.ps.dispose();
        fire.light.dispose();
      }
      firesRef.current.clear();
    };
  }, [scene]);

  return null;
};

export default FireRenderer;

/**
 * WeatherFX — BabylonJS ParticleSystem for weather effects.
 *
 * Snow (winter): white particles, slow fall, slight horizontal drift.
 * Rain (spring/fall): blue-gray thin particles, fast diagonal fall.
 * Storm: heavy rain + scene fog density increase.
 * Clear: no particles.
 *
 * Reads currentWeather from gameState and swaps particle systems on change.
 */
import React, { useEffect, useRef } from 'react';
import {
  ParticleSystem,
  Texture,
  Color4,
  Vector3,
  type Scene,
} from '@babylonjs/core';
import { useScene } from 'reactylon';

import { gameState, type WeatherType } from '../engine/GameState';
import { GRID_SIZE } from '../engine/GridTypes';

const EMITTER_WIDTH = GRID_SIZE * 2;
const EMITTER_DEPTH = GRID_SIZE * 2;
const EMITTER_Y = 30;

function createSnowSystem(scene: Scene): ParticleSystem {
  const ps = new ParticleSystem('snow', 2000, scene);
  ps.createPointEmitter(
    new Vector3(-0.3, -0.5, -0.3),
    new Vector3(0.3, -0.5, 0.3),
  );
  ps.emitter = new Vector3(GRID_SIZE / 2, EMITTER_Y, GRID_SIZE / 2);
  ps.minEmitBox = new Vector3(-EMITTER_WIDTH / 2, 0, -EMITTER_DEPTH / 2);
  ps.maxEmitBox = new Vector3(EMITTER_WIDTH / 2, 0, EMITTER_DEPTH / 2);

  ps.color1 = new Color4(1, 1, 1, 0.9);
  ps.color2 = new Color4(0.9, 0.95, 1, 0.7);
  ps.colorDead = new Color4(1, 1, 1, 0);

  ps.minSize = 0.05;
  ps.maxSize = 0.12;
  ps.minLifeTime = 3;
  ps.maxLifeTime = 6;
  ps.emitRate = 600;
  ps.gravity = new Vector3(0.2, -0.5, 0.1);
  ps.minEmitPower = 0.1;
  ps.maxEmitPower = 0.3;
  ps.updateSpeed = 0.01;

  return ps;
}

function createRainSystem(scene: Scene, heavy: boolean): ParticleSystem {
  const count = heavy ? 4000 : 1500;
  const ps = new ParticleSystem('rain', count, scene);
  ps.createPointEmitter(
    new Vector3(-0.5, -5, -0.3),
    new Vector3(0.5, -5, 0.3),
  );
  ps.emitter = new Vector3(GRID_SIZE / 2, EMITTER_Y, GRID_SIZE / 2);
  ps.minEmitBox = new Vector3(-EMITTER_WIDTH / 2, 0, -EMITTER_DEPTH / 2);
  ps.maxEmitBox = new Vector3(EMITTER_WIDTH / 2, 0, EMITTER_DEPTH / 2);

  ps.color1 = new Color4(0.5, 0.55, 0.7, 0.6);
  ps.color2 = new Color4(0.4, 0.45, 0.6, 0.4);
  ps.colorDead = new Color4(0.3, 0.35, 0.5, 0);

  ps.minSize = 0.01;
  ps.maxSize = 0.03;
  ps.minLifeTime = 0.4;
  ps.maxLifeTime = 0.8;
  ps.emitRate = heavy ? 3000 : 1000;
  ps.gravity = new Vector3(1, -5, 0.5);
  ps.minEmitPower = 2;
  ps.maxEmitPower = 4;
  ps.updateSpeed = 0.01;

  return ps;
}

const WeatherFX: React.FC = () => {
  const scene = useScene();
  const systemRef = useRef<ParticleSystem | null>(null);
  const prevWeatherRef = useRef<WeatherType | null>(null);
  const baseFogDensity = useRef(0);

  useEffect(() => {
    baseFogDensity.current = scene.fogDensity;

    function update() {
      const weather = gameState.currentWeather;
      if (weather === prevWeatherRef.current) return;
      prevWeatherRef.current = weather;

      // Dispose previous system
      if (systemRef.current) {
        systemRef.current.stop();
        systemRef.current.dispose();
        systemRef.current = null;
      }

      // Reset fog
      scene.fogDensity = baseFogDensity.current;

      switch (weather) {
        case 'snow': {
          const ps = createSnowSystem(scene);
          ps.start();
          systemRef.current = ps;
          break;
        }
        case 'rain': {
          const ps = createRainSystem(scene, false);
          ps.start();
          systemRef.current = ps;
          break;
        }
        case 'storm': {
          const ps = createRainSystem(scene, true);
          ps.start();
          systemRef.current = ps;
          scene.fogDensity = baseFogDensity.current + 0.02;
          break;
        }
        case 'clear':
        default:
          break;
      }
    }

    scene.registerBeforeRender(update);
    return () => {
      scene.unregisterBeforeRender(update);
      if (systemRef.current) {
        systemRef.current.stop();
        systemRef.current.dispose();
        systemRef.current = null;
      }
      scene.fogDensity = baseFogDensity.current;
    };
  }, [scene]);

  return null;
};

export default WeatherFX;

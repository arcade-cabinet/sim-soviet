/**
 * AuraRenderer — Propaganda and gulag aura effects.
 *
 * Propaganda towers (powered): pulsing red translucent torus rings expanding
 * outward (radius 5 tiles), 3 rings at different phases.
 * Gulags (powered): rotating spotlight cone (sweeping searchlight, radius 7 tiles).
 * Both animate per frame via registerBeforeRender.
 * Only visible in 'aura' lens or 'default' lens.
 */
import React, { useEffect, useRef } from 'react';
import {
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  type Mesh,
  type Scene,
} from '@babylonjs/core';
import { useScene } from 'reactylon';

import { gameState } from '../engine/GameState';

interface TowerAura {
  rings: Mesh[];
  key: string;
}

interface GulagAura {
  cone: Mesh;
  key: string;
}

const TOWER_RADIUS = 5;
const GULAG_RADIUS = 7;
const RING_COUNT = 3;

const AuraRenderer: React.FC = () => {
  const scene = useScene();
  const towersRef = useRef<Map<string, TowerAura>>(new Map());
  const gulagsRef = useRef<Map<string, GulagAura>>(new Map());
  const frameRef = useRef(0);

  useEffect(() => {
    // Shared materials
    const ringMat = new StandardMaterial('auraPropRing', scene);
    ringMat.emissiveColor = new Color3(1, 0.1, 0.1);
    ringMat.disableLighting = true;
    ringMat.alpha = 0.4;
    ringMat.backFaceCulling = false;

    const coneMat = new StandardMaterial('auraGulagCone', scene);
    coneMat.emissiveColor = new Color3(1, 1, 0.8);
    coneMat.disableLighting = true;
    coneMat.alpha = 0.1;
    coneMat.backFaceCulling = false;

    function update() {
      frameRef.current++;
      const lens = gameState.activeLens;
      const visible = lens === 'default' || lens === 'aura';

      const towers = towersRef.current;
      const gulags = gulagsRef.current;
      const activeKeys = new Set<string>();

      if (!visible) {
        // Hide everything
        for (const t of towers.values()) {
          for (const r of t.rings) r.isVisible = false;
        }
        for (const g of gulags.values()) g.cone.isVisible = false;
        return;
      }

      const time = frameRef.current * 0.016; // ~60fps => seconds

      // Process buildings
      for (const b of gameState.buildings) {
        if (!b.powered) continue;

        if (b.type === 'tower' || b.type === 'radio-station') {
          const key = `tower_${b.x}_${b.y}`;
          activeKeys.add(key);

          if (!towers.has(key)) {
            const rings: Mesh[] = [];
            for (let i = 0; i < RING_COUNT; i++) {
              const ring = MeshBuilder.CreateTorus(
                `${key}_ring_${i}`,
                { diameter: 0.1, thickness: 0.05, tessellation: 32 },
                scene,
              );
              ring.material = ringMat;
              ring.position = new Vector3(b.x, 0.1, b.y);
              rings.push(ring);
            }
            towers.set(key, { rings, key });
          }

          const tower = towers.get(key)!;
          for (let i = 0; i < RING_COUNT; i++) {
            const ring = tower.rings[i];
            const t = ((time / 2) + (i * (1 / RING_COUNT))) % 1;
            const radius = t * TOWER_RADIUS;
            const alpha = (1 - t) * 0.6;

            ring.scaling = new Vector3(radius * 2, 1, radius * 2);
            ring.position.x = b.x;
            ring.position.z = b.y;
            ring.isVisible = true;

            if (ring.material instanceof StandardMaterial) {
              (ring.material as StandardMaterial).alpha = alpha;
            }
          }
        } else if (b.type === 'gulag' || b.type === 'gulag-admin') {
          const key = `gulag_${b.x}_${b.y}`;
          activeKeys.add(key);

          if (!gulags.has(key)) {
            const cone = MeshBuilder.CreateCylinder(
              `${key}_cone`,
              { diameterTop: 0, diameterBottom: GULAG_RADIUS * 2, height: 3, tessellation: 16 },
              scene,
            );
            cone.material = coneMat;
            cone.position = new Vector3(b.x, 1.5, b.y);
            gulags.set(key, { cone, key });
          }

          const gulag = gulags.get(key)!;
          const angle = (time * 0.8) % (Math.PI * 2);
          gulag.cone.position.x = b.x;
          gulag.cone.position.z = b.y;
          gulag.cone.rotation.y = angle;
          // Make the cone lean to sweep like a searchlight
          gulag.cone.rotation.z = 0.5;
          gulag.cone.isVisible = true;
        }
      }

      // Cleanup removed buildings
      for (const [key, tower] of towers) {
        if (!activeKeys.has(key)) {
          for (const r of tower.rings) r.dispose();
          towers.delete(key);
        }
      }
      for (const [key, gulag] of gulags) {
        if (!activeKeys.has(key)) {
          gulag.cone.dispose();
          gulags.delete(key);
        }
      }
    }

    scene.registerBeforeRender(update);
    return () => {
      scene.unregisterBeforeRender(update);
      for (const t of towersRef.current.values()) {
        for (const r of t.rings) r.dispose();
      }
      for (const g of gulagsRef.current.values()) g.cone.dispose();
      towersRef.current.clear();
      gulagsRef.current.clear();
      ringMat.dispose();
      coneMat.dispose();
    };
  }, [scene]);

  return null;
};

export default AuraRenderer;

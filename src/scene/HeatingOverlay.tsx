/**
 * HeatingOverlay — Per-building heating visual indicators during cold seasons.
 *
 * During months where heating is required (heatCostPerTick > 0):
 *   - Heated buildings (heating operational): warm orange point light + chimney
 *     smoke particles (1-2 particles rising slowly from building top).
 *   - Unheated buildings (heating failing): blue-ish tint via semi-transparent
 *     blue plane hovering above the building.
 *
 * Heating state is city-wide (from EconomySystem), not per-building.
 * All operational buildings share the same heated/unheated status.
 *
 * Performance: overlays are created only during cold months and fully disposed
 * when season changes to a warm month.
 */
import React, { useEffect, useRef } from 'react';
import {
  Color3,
  Color4,
  MeshBuilder,
  ParticleSystem,
  PointLight,
  StandardMaterial,
  Vector3,
  type Mesh,
  type Scene,
} from '@babylonjs/core';
import { useScene } from 'reactylon';

import { buildings as buildingArchetype } from '@/ecs/archetypes';
import { getEngine } from '../bridge/GameInit';
import { getMetaEntity } from '@/ecs/archetypes';

// Months that require heating (heatCostPerTick > 0 in Chronology.ts SEASON_TABLE)
// Winter: 11,12,1,2,3  Early Frost: 9  Rasputitsa Autumn: 10  Rasputitsa Spring: 4
const COLD_MONTHS = new Set([1, 2, 3, 4, 9, 10, 11, 12]);

/** Per-building warm effect: point light + chimney smoke particles */
interface WarmEffect {
  light: PointLight;
  smoke: ParticleSystem;
}

/** Per-building cold effect: blue tint plane above building */
interface ColdEffect {
  plane: Mesh;
}

const HeatingOverlay: React.FC = () => {
  const scene = useScene();

  const warmRef = useRef<Map<string, WarmEffect>>(new Map());
  const coldRef = useRef<Map<string, ColdEffect>>(new Map());
  const coldMatRef = useRef<StandardMaterial | null>(null);

  useEffect(() => {
    // Shared material for cold tint planes
    const coldMat = new StandardMaterial('heatingColdMat', scene);
    coldMat.emissiveColor = new Color3(0.15, 0.25, 0.6);
    coldMat.disableLighting = true;
    coldMat.alpha = 0.25;
    coldMat.backFaceCulling = false;
    coldMatRef.current = coldMat;

    function disposeWarm(effect: WarmEffect): void {
      effect.smoke.stop();
      effect.smoke.dispose();
      effect.light.dispose();
    }

    function disposeCold(effect: ColdEffect): void {
      effect.plane.dispose();
    }

    function clearAll(): void {
      for (const w of warmRef.current.values()) disposeWarm(w);
      for (const c of coldRef.current.values()) disposeCold(c);
      warmRef.current.clear();
      coldRef.current.clear();
    }

    function update(): void {
      const meta = getMetaEntity();
      const month = meta?.gameMeta?.date?.month ?? 6; // default to summer
      const isCold = COLD_MONTHS.has(month);

      if (!isCold) {
        // Warm season: dispose everything
        if (warmRef.current.size > 0 || coldRef.current.size > 0) {
          clearAll();
        }
        return;
      }

      // Read global heating state from EconomySystem
      const engine = getEngine();
      const economy = engine?.getEconomySystem() ?? null;
      const heating = economy?.getHeating() ?? null;
      const isHeated = heating ? !heating.failing : true;

      // Collect active building positions
      const activeKeys = new Set<string>();

      for (const entity of buildingArchetype.entities) {
        const { position, building } = entity;
        // Only show on operational buildings
        const phase = building.constructionPhase;
        if (phase != null && phase !== 'complete') continue;

        const key = `${position.gridX}_${position.gridY}`;
        activeKeys.add(key);

        const worldX = position.gridX + 0.5;
        const worldZ = position.gridY + 0.5;
        // Approximate building top height (buildings sit at elevation * 0.5)
        // Most buildings are ~1-2 units tall after scaling to 0.85 tile width
        const baseY = 0; // Elevation already encoded in BuildingRenderer positioning
        const topY = baseY + 1.2;

        if (isHeated) {
          // ── Warm effects ──
          // Remove any cold effect for this building
          const coldEffect = coldRef.current.get(key);
          if (coldEffect) {
            disposeCold(coldEffect);
            coldRef.current.delete(key);
          }

          if (!warmRef.current.has(key)) {
            // Create warm orange point light
            const light = new PointLight(
              `heatLight_${key}`,
              new Vector3(worldX, topY + 0.3, worldZ),
              scene,
            );
            light.diffuse = new Color3(1.0, 0.6, 0.2);
            light.intensity = 0.3;
            light.range = 2.0;

            // Create subtle chimney smoke (1-2 slow-rising particles)
            const smoke = new ParticleSystem(`heatSmoke_${key}`, 15, scene);
            smoke.createPointEmitter(
              new Vector3(-0.05, 0.3, -0.05),
              new Vector3(0.05, 0.6, 0.05),
            );
            smoke.emitter = new Vector3(worldX, topY, worldZ);
            smoke.minEmitBox = new Vector3(-0.1, 0, -0.1);
            smoke.maxEmitBox = new Vector3(0.1, 0, 0.1);

            // Pale grey wisps
            smoke.color1 = new Color4(0.6, 0.55, 0.5, 0.3);
            smoke.color2 = new Color4(0.5, 0.45, 0.4, 0.2);
            smoke.colorDead = new Color4(0.4, 0.4, 0.4, 0.0);

            smoke.minSize = 0.03;
            smoke.maxSize = 0.08;
            smoke.minLifeTime = 1.0;
            smoke.maxLifeTime = 2.5;
            smoke.emitRate = 2; // very subtle — 2 particles per second
            smoke.gravity = new Vector3(0, 0.15, 0); // gentle rise
            smoke.minEmitPower = 0.05;
            smoke.maxEmitPower = 0.15;
            smoke.updateSpeed = 0.008;
            smoke.start();

            warmRef.current.set(key, { light, smoke });
          } else {
            // Update position in case building moved
            const w = warmRef.current.get(key)!;
            w.light.position.set(worldX, topY + 0.3, worldZ);
            (w.smoke.emitter as Vector3).set(worldX, topY, worldZ);
          }
        } else {
          // ── Cold effects (heating failing) ──
          // Remove any warm effect for this building
          const warmEffect = warmRef.current.get(key);
          if (warmEffect) {
            disposeWarm(warmEffect);
            warmRef.current.delete(key);
          }

          if (!coldRef.current.has(key)) {
            // Semi-transparent blue plane above building
            const plane = MeshBuilder.CreatePlane(
              `heatCold_${key}`,
              { size: 0.9 },
              scene,
            );
            plane.material = coldMat;
            plane.position = new Vector3(worldX, topY + 0.1, worldZ);
            // Rotate to be horizontal (face up)
            plane.rotation.x = Math.PI / 2;
            plane.isPickable = false;

            coldRef.current.set(key, { plane });
          } else {
            const c = coldRef.current.get(key)!;
            c.plane.position.set(worldX, topY + 0.1, worldZ);
          }
        }
      }

      // Clean up effects for buildings that no longer exist
      for (const [key, w] of warmRef.current) {
        if (!activeKeys.has(key)) {
          disposeWarm(w);
          warmRef.current.delete(key);
        }
      }
      for (const [key, c] of coldRef.current) {
        if (!activeKeys.has(key)) {
          disposeCold(c);
          coldRef.current.delete(key);
        }
      }
    }

    scene.registerBeforeRender(update);
    return () => {
      scene.unregisterBeforeRender(update);
      clearAll();
      coldMat.dispose();
    };
  }, [scene]);

  return null;
};

export default HeatingOverlay;

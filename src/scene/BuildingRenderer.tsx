/**
 * BuildingRenderer — reads game state buildings and manages 3D mesh clones.
 *
 * For each building in state: lookup model via getModelName, clone from ModelCache,
 * position at grid coordinates with elevation, and manage lifecycle on state changes.
 *
 * Buildings are tinted per settlement tier (selo→posyolok→pgt→gorod) to visually
 * communicate the settlement's progression. On tier change, all buildings are
 * re-tinted with an optional flash celebration effect.
 */
import React, { useEffect, useRef } from 'react';
import {
  Color3,
  StandardMaterial,
  Vector3,
  type TransformNode,
  type AbstractMesh,
} from '@babylonjs/core';
import { useScene } from 'reactylon';
import { getModelName } from './ModelMapping';
import { cloneModel, disposeModel, isPreloaded } from './ModelCache';
import { shadowGenerator } from './Lighting';
import { applyTierTint, flashTierTransition, clearTintData } from './TierTinting';
import type { SettlementTier } from '../game/SettlementSystem';

export interface BuildingState {
  id: string;
  type: string;
  level: number;
  gridX: number;
  gridY: number;
  elevation: number;
  powered: boolean;
  onFire: boolean;
}

interface BuildingRendererProps {
  buildings: BuildingState[];
  /** Current settlement tier — drives material tinting */
  settlementTier?: SettlementTier;
}

interface ManagedBuilding {
  id: string;
  type: string;
  level: number;
  node: TransformNode;
  yOffset: number;
}

/**
 * Apply visual effects to a building mesh based on its state.
 */
function applyBuildingEffects(
  node: TransformNode,
  powered: boolean,
  onFire: boolean,
): void {
  const meshes = node.getChildMeshes() as AbstractMesh[];
  for (const mesh of meshes) {
    if (!(mesh.material instanceof StandardMaterial)) continue;
    const stdMat = mesh.material;

    // Unpowered: darken
    if (!powered) {
      stdMat.diffuseColor = stdMat.diffuseColor.scale(0.4);
    }
    // On fire: red emissive tint
    if (onFire) {
      stdMat.emissiveColor = new Color3(0.6, 0.1, 0.0);
    } else {
      stdMat.emissiveColor = Color3.Black();
    }
  }
}

const BuildingRenderer: React.FC<BuildingRendererProps> = ({ buildings, settlementTier = 'selo' }) => {
  const scene = useScene();
  const managedRef = useRef<Map<string, ManagedBuilding>>(new Map());
  const lastTierRef = useRef<SettlementTier>(settlementTier);

  // ── Handle tier changes: re-tint all buildings with flash effect ──
  useEffect(() => {
    if (!isPreloaded()) return;
    const prevTier = lastTierRef.current;
    if (prevTier === settlementTier) return;

    lastTierRef.current = settlementTier;
    const managed = managedRef.current;

    // Re-tint all existing buildings with celebration flash
    for (const [, mb] of managed) {
      flashTierTransition(mb.node, settlementTier, 500);
    }
  }, [settlementTier]);

  useEffect(() => {
    // Don't attempt cloning until all models have finished preloading
    if (!isPreloaded()) return;

    const managed = managedRef.current;
    const currentIds = new Set(buildings.map((b) => b.id));

    // Remove buildings no longer in state
    for (const [id, mb] of managed) {
      if (!currentIds.has(id)) {
        clearTintData(mb.node);
        disposeModel(mb.node);
        managed.delete(id);
      }
    }

    // Add or update buildings
    for (const building of buildings) {
      const existing = managed.get(building.id);
      // ECS defIds match GLB model names directly (e.g., "apartment-tower-a")
      // Fall back to getModelName for legacy building types
      const modelName = getModelName(building.type, building.level) ?? building.type;
      if (!modelName) continue;

      // If type or level changed, need to swap mesh
      if (existing && (existing.type !== building.type || existing.level !== building.level)) {
        clearTintData(existing.node);
        disposeModel(existing.node);
        managed.delete(building.id);
      }

      if (!managed.has(building.id)) {
        // Clone a new model from the preloaded cache
        const node = cloneModel(modelName, building.id);
        if (!node) {
          console.warn(`[Building] Model "${modelName}" not found in cache for ${building.id}`);
          continue;
        }

        // Scale building to fill its tile footprint. Use XZ extent only
        // so buildings stand naturally tall (not squished by height).
        let yOffset = 0;
        const meshes = node.getChildMeshes();
        if (meshes.length > 0) {
          let maxFootprint = 0;
          let minLocalY = Infinity;
          for (const m of meshes) {
            m.computeWorldMatrix(true);
            const bounds = m.getBoundingInfo();
            const ext = bounds.boundingBox.extendSize;
            const center = bounds.boundingBox.center;
            maxFootprint = Math.max(maxFootprint, ext.x, ext.z);
            minLocalY = Math.min(minLocalY, center.y - ext.y);
          }
          if (maxFootprint > 0) {
            // Scale to ~85% of tile width so buildings fill their footprint
            const scale = 0.85 / maxFootprint;
            node.scaling = new Vector3(scale, scale, scale);
            yOffset = -minLocalY * scale;
          }
        }

        node.position = new Vector3(
          building.gridX + 0.5,
          building.elevation * 0.5 + yOffset,
          building.gridY + 0.5,
        );

        // Apply tier tint to the newly created building
        applyTierTint(node, settlementTier);

        // Register as shadow caster
        if (shadowGenerator) {
          for (const m of node.getChildMeshes()) {
            shadowGenerator.addShadowCaster(m);
          }
        }

        managed.set(building.id, {
          id: building.id,
          type: building.type,
          level: building.level,
          node,
          yOffset,
        });
      }

      // Update position and effects (in case building moved or state changed)
      const mb = managed.get(building.id);
      if (mb) {
        mb.node.position = new Vector3(
          building.gridX + 0.5,
          building.elevation * 0.5 + mb.yOffset,
          building.gridY + 0.5,
        );
        applyBuildingEffects(mb.node, building.powered, building.onFire);
      }
    }
  }, [buildings, settlementTier]);

  // Cleanup all on unmount
  useEffect(() => {
    return () => {
      for (const [, mb] of managedRef.current) {
        clearTintData(mb.node);
        disposeModel(mb.node);
      }
      managedRef.current.clear();
    };
  }, []);

  return null;
};

export default BuildingRenderer;

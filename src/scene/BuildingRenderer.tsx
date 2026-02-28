/**
 * BuildingRenderer — reads game state buildings and renders 3D GLB clones.
 *
 * For each building in state: lookup model via getModelName, load GLB via
 * useGLTF from drei, clone via <Clone>, position at grid coordinates with
 * elevation, and manage lifecycle on state changes.
 *
 * Buildings are tinted per settlement tier (selo->posyolok->pgt->gorod) to
 * visually communicate the settlement's progression. On tier change, all
 * buildings are re-tinted with an optional flash celebration effect.
 *
 * Buildings under construction are rendered semi-transparent with a yellow
 * emissive glow that intensifies as construction progresses.
 *
 * R3F migration: uses drei's useGLTF + Clone for model instancing.
 * Each building wrapped in Suspense since useGLTF suspends on first load.
 */

import { Clone, useGLTF } from '@react-three/drei';
import type React from 'react';
import { Suspense, useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { SettlementTier } from '../game/SettlementSystem';
import { getModelName } from './ModelMapping';
import { getModelUrl } from './ModelPreloader';
import type { Season } from './TerrainGrid';
import {
  applyConstructionState,
  applyFireTint,
  applyPoweredState,
  applySeasonTint,
  applyTierTint,
  clearTintData,
} from './TierTinting';

export interface BuildingState {
  id: string;
  type: string;
  level: number;
  gridX: number;
  gridY: number;
  elevation: number;
  powered: boolean;
  onFire: boolean;
  /** Construction phase — undefined or 'complete' means operational */
  constructionPhase?: 'foundation' | 'building' | 'complete';
  /** Construction progress 0.0–1.0 (undefined means complete) */
  constructionProgress?: number;
}

interface BuildingRendererProps {
  buildings: BuildingState[];
  /** Current settlement tier — drives material tinting */
  settlementTier?: SettlementTier;
  /** Current season — drives seasonal color tinting */
  season?: Season;
}

// ── Single Building Component ───────────────────────────────────────────────

interface BuildingMeshProps {
  building: BuildingState;
  modelUrl: string;
  settlementTier: SettlementTier;
  season: Season;
}

/** Whether a building is still under construction. */
function isUnderConstruction(building: BuildingState): boolean {
  return building.constructionPhase != null && building.constructionPhase !== 'complete';
}

/**
 * Individual building — loads GLB via useGLTF, clones it, applies
 * tier tinting + powered/fire/construction state, positions at grid cell.
 */
const BuildingMesh: React.FC<BuildingMeshProps> = ({ building, modelUrl, settlementTier, season }) => {
  const { scene } = useGLTF(modelUrl);
  const groupRef = useRef<THREE.Group>(null);

  // Apply tier tinting + powered/fire/construction state after clone mounts
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    // Scale building to fill its tile footprint (~85% of tile width).
    // Use XZ extent only so buildings stand naturally tall.
    let yOffset = 0;
    const box = new THREE.Box3().setFromObject(group);
    const size = box.getSize(new THREE.Vector3());
    const _center = box.getCenter(new THREE.Vector3());
    const maxFootprint = Math.max(size.x, size.z);

    if (maxFootprint > 0) {
      const scale = 0.85 / maxFootprint;
      group.scale.setScalar(scale);

      // Recompute after scaling
      const scaledBox = new THREE.Box3().setFromObject(group);
      const _scaledCenter = scaledBox.getCenter(new THREE.Vector3());
      const scaledMin = scaledBox.min;
      yOffset = -scaledMin.y;
    }

    group.position.set(building.gridX + 0.5, building.elevation * 0.5 + yOffset, building.gridY + 0.5);

    // Store yOffset for later updates
    group.userData._yOffset = yOffset;

    // Apply visual states
    applyTierTint(group, settlementTier);
    applySeasonTint(group, season);
    if (isUnderConstruction(building)) {
      applyConstructionState(group, building.constructionPhase as 'foundation' | 'building', building.constructionProgress ?? 0);
    } else {
      applyPoweredState(group, building.powered);
    }
    applyFireTint(group, building.onFire);

    // Enable shadow casting on all child meshes
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    return () => {
      clearTintData(group);
    };
  }, [
    settlementTier,
    season,
    building.elevation,
    building.gridX,
    building.gridY,
    building.onFire,
    building.powered,
    building.constructionPhase,
    building.constructionProgress,
  ]);

  // Update position and visual states when building data changes
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const yOffset = group.userData._yOffset ?? 0;
    group.position.set(building.gridX + 0.5, building.elevation * 0.5 + yOffset, building.gridY + 0.5);

    // Re-apply tint from base (resets powered/fire/construction modifications)
    applyTierTint(group, settlementTier);
    applySeasonTint(group, season);
    if (isUnderConstruction(building)) {
      applyConstructionState(group, building.constructionPhase as 'foundation' | 'building', building.constructionProgress ?? 0);
    } else {
      applyPoweredState(group, building.powered);
    }
    applyFireTint(group, building.onFire);
  }, [
    building.gridX,
    building.gridY,
    building.elevation,
    building.powered,
    building.onFire,
    building.constructionPhase,
    building.constructionProgress,
    settlementTier,
    season,
  ]);

  return (
    <group ref={groupRef}>
      <Clone object={scene} />
    </group>
  );
};

// ── Main BuildingRenderer ───────────────────────────────────────────────────

const BuildingRenderer: React.FC<BuildingRendererProps> = ({ buildings, settlementTier = 'selo', season = 'summer' }) => {
  const _lastTierRef = useRef<SettlementTier>(settlementTier);

  // Detect tier changes for flash effect
  // (Individual BuildingMesh components handle re-tinting via useEffect deps)
  // The flash is a nice-to-have visual nicety that we handle at the group level.
  // For simplicity in R3F, the flash is omitted here — the tier tint update
  // in each BuildingMesh's useEffect already re-tints smoothly.

  return (
    <group>
      {buildings.map((building) => {
        // ECS defIds match GLB model names directly (e.g., "apartment-tower-a")
        // Fall back to getModelName for legacy building types
        const modelName = getModelName(building.type, building.level) ?? building.type;
        if (!modelName) return null;

        const modelUrl = getModelUrl(modelName);
        if (!modelUrl) return null;

        return (
          <Suspense key={building.id} fallback={null}>
            <BuildingMesh building={building} modelUrl={modelUrl} settlementTier={settlementTier} season={season} />
          </Suspense>
        );
      })}
    </group>
  );
};

export default BuildingRenderer;

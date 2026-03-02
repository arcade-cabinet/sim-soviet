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
import type { SettlementTier } from '../ai/agents/infrastructure/SettlementSystem';
import { getModelName, getTierVariant } from './ModelMapping';
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
import { GROWN_TYPES, BUILDING_TYPES } from '../engine/BuildingTypes';

/** State snapshot for a single building, consumed by the 3D renderer. */
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
  /** Housing capacity — used for brutalist scaling (aggregate mode mega-blocks) */
  housingCap?: number;
  /** Worker count — used for brutalist scaling (aggregate mode factories) */
  workerCount?: number;
}

interface BuildingRendererProps {
  buildings: BuildingState[];
  /** Current settlement tier — drives material tinting */
  settlementTier?: SettlementTier;
  /** Current season — drives seasonal color tinting */
  season?: Season;
}

// ── Brutalist Scaling ───────────────────────────────────────────────────────

/**
 * Compute brutalist capacity-based scale multiplier.
 * Mega-blocks use the SAME GLB model — just bigger. Same depressing geometry.
 *
 * Returns 1.0 for normal buildings, up to ~8.0 for arcology-scale structures.
 */
function getBrutalistScale(buildingType: string, housingCap?: number, workerCount?: number): number {
  // Determine base capacity from building defs
  let baseCap = 10;
  // Check GROWN_TYPES first (housing, factory, distillery, farm)
  const grownKey = buildingType.includes('house') || buildingType.includes('apartment') || buildingType.includes('khrushch')
    ? 'housing'
    : buildingType.includes('factory') || buildingType.includes('mill') || buildingType.includes('workshop')
      ? 'factory'
      : buildingType.includes('distill') || buildingType.includes('vodka') || buildingType.includes('brewery')
        ? 'distillery'
        : buildingType.includes('farm') || buildingType.includes('kolkhoz') || buildingType.includes('sovkhoz')
          ? 'farm'
          : null;
  if (grownKey && GROWN_TYPES[grownKey]) {
    baseCap = GROWN_TYPES[grownKey][0].cap ?? GROWN_TYPES[grownKey][0].amt ?? 10;
  } else {
    const btDef = BUILDING_TYPES[buildingType];
    baseCap = Math.abs(btDef?.cap ?? 10);
  }

  const actualCap = housingCap || workerCount || baseCap;
  if (actualCap <= baseCap) return 1.0;

  const scaleTier = Math.max(1, Math.log2(actualCap / baseCap) + 1);
  return 1 + (scaleTier - 1) * 0.5;
}

// ── Single Building Component ───────────────────────────────────────────────

interface BuildingMeshProps {
  building: BuildingState;
  modelUrl: string;
  settlementTier: SettlementTier;
  season: Season;
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
      const tileScale = 0.85 / maxFootprint;
      // Apply brutalist capacity-based scaling on top of tile-fit
      const brutalist = getBrutalistScale(building.type, building.housingCap, building.workerCount);
      const scale = tileScale * brutalist;
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
    if (building.constructionPhase != null && building.constructionPhase !== 'complete') {
      applyConstructionState(
        group,
        building.constructionPhase as 'foundation' | 'building',
        building.constructionProgress ?? 0,
      );
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
    building.housingCap,
    building.workerCount,
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
    if (building.constructionPhase != null && building.constructionPhase !== 'complete') {
      applyConstructionState(
        group,
        building.constructionPhase as 'foundation' | 'building',
        building.constructionProgress ?? 0,
      );
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
    building.housingCap,
    building.workerCount,
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

/** Renders all buildings as GLB model clones with tier tinting, season colors, and status effects. */
const BuildingRenderer: React.FC<BuildingRendererProps> = ({
  buildings,
  settlementTier = 'selo',
  season = 'summer',
}) => {
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
        const baseModel = getModelName(building.type, building.level) ?? building.type;
        if (!baseModel) return null;

        // Apply tier-based model variant (e.g., workers-house-a → workers-house-b at posyolok)
        const modelName = getTierVariant(baseModel, settlementTier);
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

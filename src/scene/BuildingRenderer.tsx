/**
 * BuildingRenderer — reads game state buildings and renders 3D GLB models.
 *
 * Operational buildings are batched into InstancedMesh per unique model URL
 * and child mesh, drastically reducing draw calls (from N buildings to ~M
 * unique meshes across all model types).
 *
 * Buildings under construction remain as individual Clone components since
 * they need per-building transparency and emissive effects.
 *
 * Per-instance tinting (tier, season, powered state) is achieved via
 * InstancedMesh.instanceColor which multiplies the base material color.
 */

import { Clone, useGLTF } from '@react-three/drei';
import type React from 'react';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { SettlementTier } from '../ai/agents/infrastructure/SettlementSystem';
import { BUILDING_TYPES, GROWN_TYPES } from '../engine/BuildingTypes';
import type { Season } from '../engine/WeatherSystem';
import { getModelName, getTierVariant } from './ModelMapping';
import { getModelUrl } from './ModelPreloader';
import {
  applyConstructionState,
  applyFireTint,
  applySeasonTint,
  applyTierTint,
  clearTintData,
  SEASON_TINTS,
  TIER_TINTS,
} from './TierTinting';

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
  /** Housing capacity used for grounded visual massing. */
  housingCap?: number;
  /** Worker count used for grounded visual massing. */
  workerCount?: number;
  /** Building durability 0–100 (undefined = no decay component, treat as 100) */
  durability?: number;
}

interface BuildingRendererProps {
  buildings: BuildingState[];
  /** Current settlement tier — drives material tinting */
  settlementTier?: SettlementTier;
  /** Current season — drives seasonal color tinting */
  season?: Season;
  /** Current era — drives era-specific model set selection */
  currentEra?: string;
  /** When true, buildings show foundation subsidence tilt (permafrost collapse). */
  subsidenceTilt?: boolean;
}

// ── Capacity-Based Visual Massing ───────────────────────────────────────────

/**
 * Compute a conservative capacity-based scale multiplier.
 *
 * Returns 1.0 for normal buildings, with a modest cap for larger civic structures.
 */
function getCapacityScale(buildingType: string, housingCap?: number, workerCount?: number): number {
  let baseCap = 10;
  const grownKey =
    buildingType.includes('house') || buildingType.includes('apartment') || buildingType.includes('khrushch')
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
  return Math.min(1.75, 1 + (scaleTier - 1) * 0.35);
}

// ── Construction Building (Clone-based) ─────────────────────────────────────

interface ConstructionMeshProps {
  building: BuildingState;
  modelUrl: string;
  settlementTier: SettlementTier;
  season: Season;
}

/**
 * Individual building under construction — uses Clone for per-building
 * transparency and emissive effects that InstancedMesh cannot support.
 */
const ConstructionMesh: React.FC<ConstructionMeshProps> = ({ building, modelUrl, settlementTier, season }) => {
  const { scene } = useGLTF(modelUrl);
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    let yOffset = 0;
    const box = new THREE.Box3().setFromObject(group);
    const size = box.getSize(new THREE.Vector3());
    const maxFootprint = Math.max(size.x, size.z);

    if (maxFootprint > 0) {
      const tileScale = 0.85 / maxFootprint;
      const capacityScale = getCapacityScale(building.type, building.housingCap, building.workerCount);
      const scale = tileScale * capacityScale;
      group.scale.setScalar(scale);

      const scaledBox = new THREE.Box3().setFromObject(group);
      const scaledMin = scaledBox.min;
      yOffset = -scaledMin.y;
    }

    group.position.set(building.gridX + 0.5, building.elevation * 0.5 + yOffset, building.gridY + 0.5);
    group.userData._yOffset = yOffset;

    applyTierTint(group, settlementTier);
    applySeasonTint(group, season);
    applyConstructionState(
      group,
      building.constructionPhase as 'foundation' | 'building',
      building.constructionProgress ?? 0,
    );
    applyFireTint(group, building.onFire);

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
    building.constructionPhase,
    building.constructionProgress,
    building.housingCap,
    building.workerCount,
    building.type,
  ]);

  return (
    <group ref={groupRef}>
      <Clone object={scene} />
    </group>
  );
};

// ── InstancedMesh helpers ───────────────────────────────────────────────────

/** Extracted child mesh info from a GLB scene. */
interface MeshInfo {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  /** Local transform within the GLB scene graph */
  localMatrix: THREE.Matrix4;
}

/**
 * Extract all Mesh children from a GLB scene, capturing their geometry,
 * material, and world transform relative to the scene root.
 */
function extractMeshes(scene: THREE.Group): MeshInfo[] {
  const meshes: MeshInfo[] = [];
  scene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      // Get the child's world matrix relative to the scene root
      const localMatrix = new THREE.Matrix4();
      child.updateWorldMatrix(true, false);
      localMatrix.copy(child.matrixWorld);
      // Remove the scene root's own transform to get relative transform
      const sceneInv = new THREE.Matrix4().copy(scene.matrixWorld).invert();
      localMatrix.premultiply(sceneInv);

      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of materials) {
        meshes.push({
          geometry: child.geometry,
          material: mat,
          localMatrix,
        });
      }
    }
  });
  return meshes;
}

/**
 * Compute tile-fitting scale for a GLB scene. Normalizes the model's
 * XZ footprint to 85% of a tile width, returns the scale and Y offset.
 */
function computeTileFitScale(scene: THREE.Group): { tileScale: number; yOffsetBase: number } {
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const maxFootprint = Math.max(size.x, size.z);
  if (maxFootprint <= 0) return { tileScale: 1, yOffsetBase: 0 };

  const tileScale = 0.85 / maxFootprint;

  // Compute Y offset after scaling — need to figure out how much to raise
  // the model so its bottom sits on the ground plane.
  // We scale uniformly, so minY * tileScale is the scaled bottom.
  const yOffsetBase = -box.min.y * tileScale;
  return { tileScale, yOffsetBase };
}

/**
 * Compute per-instance color combining tier tint, season tint, powered state,
 * fire state, and durability health.
 * This is multiplied with the base material color via InstancedMesh.instanceColor.
 */
export function computeInstanceColor(
  tier: SettlementTier,
  season: Season,
  powered: boolean,
  onFire: boolean,
  durability?: number,
): THREE.Color {
  const tierTint = TIER_TINTS[tier];
  const seasonTint = SEASON_TINTS[season];

  const r = tierTint.colorFactor[0] * seasonTint[0];
  const g = tierTint.colorFactor[1] * seasonTint[1];
  const b = tierTint.colorFactor[2] * seasonTint[2];

  const color = new THREE.Color(r, g, b);

  // Health-based tinting: below 60% durability, shift toward desaturated brown
  if (durability != null && durability < 60) {
    // t = 0 at 60 durability, t = 1 at 0 durability
    const t = 1 - durability / 60;
    // Desaturated brownish target (crumbling concrete)
    const decayR = 0.55;
    const decayG = 0.45;
    const decayB = 0.35;
    color.r = color.r + (decayR - color.r) * t * 0.6;
    color.g = color.g + (decayG - color.g) * t * 0.6;
    color.b = color.b + (decayB - color.b) * t * 0.6;
  }

  // Unpowered buildings dim to 40%
  if (!powered) {
    color.multiplyScalar(0.4);
  }

  // Fire gives a reddish tint boost (approximate the emissive with color shift)
  if (onFire) {
    color.r = Math.min(1, color.r + 0.3);
    color.g *= 0.6;
    color.b *= 0.5;
  }

  return color;
}

// ── Instanced Model Group ───────────────────────────────────────────────────

interface InstancedModelGroupProps {
  modelUrl: string;
  buildings: BuildingState[];
  settlementTier: SettlementTier;
  season: Season;
  /** When true, apply random foundation tilt per building (permafrost subsidence). */
  subsidenceTilt?: boolean;
}

/**
 * Renders all buildings sharing a single model URL as InstancedMesh batches.
 * One InstancedMesh per child mesh in the GLB.
 */
const InstancedModelGroup: React.FC<InstancedModelGroupProps> = ({
  modelUrl,
  buildings,
  settlementTier,
  season,
  subsidenceTilt,
}) => {
  const { scene } = useGLTF(modelUrl);
  const groupRef = useRef<THREE.Group>(null);
  const instancedMeshRefs = useRef<THREE.InstancedMesh[]>([]);

  // Extract child meshes from the GLB scene (memoized on scene identity)
  const meshInfos = useMemo(() => {
    scene.updateMatrixWorld(true);
    return extractMeshes(scene);
  }, [scene]);

  // Compute the tile-fitting base scale for this model
  const { tileScale, yOffsetBase } = useMemo(() => computeTileFitScale(scene), [scene]);

  // Create/update InstancedMesh objects when mesh infos or building count changes
  useEffect(() => {
    const group = groupRef.current;
    if (!group || meshInfos.length === 0 || buildings.length === 0) return;

    // Clean up previous instanced meshes
    for (const im of instancedMeshRefs.current) {
      group.remove(im);
      im.dispose();
    }
    instancedMeshRefs.current = [];

    const count = buildings.length;
    const tierTint = TIER_TINTS[settlementTier];

    for (const info of meshInfos) {
      // Clone material so tinting doesn't affect the shared GLB material
      const mat = info.material.clone() as THREE.MeshStandardMaterial;
      // Apply PBR tier overrides to the base material
      if (mat instanceof THREE.MeshStandardMaterial) {
        const PBR_BLEND = 0.7;
        mat.roughness = mat.roughness + (tierTint.roughness - mat.roughness) * PBR_BLEND;
        mat.metalness = mat.metalness + (tierTint.metalness - mat.metalness) * PBR_BLEND;
      }

      const im = new THREE.InstancedMesh(info.geometry, mat, count);
      im.castShadow = true;
      im.receiveShadow = true;
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);

      // Pre-compute instance transforms and colors
      const tempMatrix = new THREE.Matrix4();
      const tempColor = new THREE.Color();
      const tiltMatrix = new THREE.Matrix4();
      const tiltEuler = new THREE.Euler();

      for (let i = 0; i < count; i++) {
        const bldg = buildings[i];
        const capacityScale = getCapacityScale(bldg.type, bldg.housingCap, bldg.workerCount);
        const scale = tileScale * capacityScale;

        // Build instance matrix: localMeshTransform * (scale + position)
        // 1. Start with the mesh's local transform within the GLB
        tempMatrix.copy(info.localMatrix);
        // 2. Apply uniform scale
        tempMatrix.scale(new THREE.Vector3(scale, scale, scale));
        // 3. Set position: grid center + elevation + yOffset (scaled by visual mass)
        const yOffset = yOffsetBase * capacityScale;
        const posX = bldg.gridX + 0.5;
        const posY = bldg.elevation * 0.5 + yOffset;
        const posZ = bldg.gridY + 0.5;
        tempMatrix.setPosition(posX, posY, posZ);

        // 4. Apply subsidence tilt if permafrost collapse is active (max 5 degrees)
        if (subsidenceTilt) {
          const tiltSeed = (bldg.gridX * 7919 + bldg.gridY * 104729) & 0xffff;
          const tiltX = (tiltSeed / 0xffff - 0.5) * 0.174; // +-5 degrees
          const tiltZ = (((tiltSeed * 31) & 0xffff) / 0xffff - 0.5) * 0.174;
          tiltEuler.set(tiltX, 0, tiltZ);
          tiltMatrix.makeRotationFromEuler(tiltEuler);
          tempMatrix.multiply(tiltMatrix);
        }

        im.setMatrixAt(i, tempMatrix);

        // Compute per-instance color
        tempColor.copy(computeInstanceColor(settlementTier, season, bldg.powered, bldg.onFire, bldg.durability));
        im.setColorAt(i, tempColor);
      }

      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;

      instancedMeshRefs.current.push(im);
      group.add(im);
    }

    return () => {
      for (const im of instancedMeshRefs.current) {
        group.remove(im);
        im.dispose();
      }
      instancedMeshRefs.current = [];
    };
  }, [meshInfos, buildings, settlementTier, season, tileScale, yOffsetBase, subsidenceTilt]);

  return <group ref={groupRef} />;
};

// ── Main BuildingRenderer ───────────────────────────────────────────────────

/** Renders all buildings: operational via InstancedMesh batching, constructing via Clone. */
const BuildingRenderer: React.FC<BuildingRendererProps> = ({
  buildings,
  settlementTier = 'selo',
  season = 'summer',
  currentEra,
  subsidenceTilt,
}) => {
  // Partition buildings into constructing vs operational
  const { constructing, operationalByModel } = useMemo(() => {
    const constructingList: BuildingState[] = [];
    const modelGroups = new Map<string, { modelUrl: string; buildings: BuildingState[] }>();

    for (const building of buildings) {
      // Check if building is under construction
      const isConstructing = building.constructionPhase != null && building.constructionPhase !== 'complete';

      if (isConstructing) {
        constructingList.push(building);
        continue;
      }

      // Resolve model URL (era override → tier variant → base)
      const baseModel = getModelName(building.type, building.level, currentEra) ?? building.type;
      if (!baseModel) continue;
      const modelName = getTierVariant(baseModel, settlementTier);
      const modelUrl = getModelUrl(modelName);
      if (!modelUrl) continue;

      let group = modelGroups.get(modelUrl);
      if (!group) {
        group = { modelUrl, buildings: [] };
        modelGroups.set(modelUrl, group);
      }
      group.buildings.push(building);
    }

    return {
      constructing: constructingList,
      operationalByModel: Array.from(modelGroups.values()),
    };
  }, [buildings, settlementTier, currentEra]);

  return (
    <group>
      {/* Operational buildings — batched via InstancedMesh per model type */}
      {operationalByModel.map((group) => (
        <Suspense key={group.modelUrl} fallback={null}>
          <InstancedModelGroup
            modelUrl={group.modelUrl}
            buildings={group.buildings}
            settlementTier={settlementTier}
            season={season}
            subsidenceTilt={subsidenceTilt}
          />
        </Suspense>
      ))}

      {/* Constructing buildings — individual Clone components for transparency effects */}
      {constructing.map((building) => {
        const baseModel = getModelName(building.type, building.level, currentEra) ?? building.type;
        if (!baseModel) return null;
        const modelName = getTierVariant(baseModel, settlementTier);
        const modelUrl = getModelUrl(modelName);
        if (!modelUrl) return null;

        return (
          <Suspense key={building.id} fallback={null}>
            <ConstructionMesh building={building} modelUrl={modelUrl} settlementTier={settlementTier} season={season} />
          </Suspense>
        );
      })}
    </group>
  );
};

export default BuildingRenderer;

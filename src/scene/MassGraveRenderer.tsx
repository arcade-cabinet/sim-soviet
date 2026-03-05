/**
 * MassGraveRenderer — renders persistent grave marker clusters at the
 * settlement edge when mass casualty events occur (purges, famines, etc).
 *
 * Each cluster places 3-5 grave markers (crosses, headstones, mounds)
 * in a tight group. Clusters are persistent — they accumulate over the
 * game's history, providing a visual record of the settlement's losses.
 */

import { Clone, useGLTF } from '@react-three/drei';
import type React from 'react';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getModelUrl } from './ModelPreloader';
import { useMassGraves, type MassGraveCluster } from '../stores/gameStore';

/** The 6 grave marker model names from manifest.json */
const GRAVE_MODELS = [
  'grave-cross-a',
  'grave-cross-b',
  'grave-cross-c',
  'grave-stone-a',
  'grave-stone-b',
  'grave-mound',
] as const;

/**
 * Deterministic pseudo-random from a seed. Returns 0-1.
 * Used to consistently place markers within a cluster.
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Select a subset of model names for a cluster based on its ID.
 * Returns `count` model names drawn from GRAVE_MODELS.
 */
function selectModels(clusterId: string, count: number): string[] {
  let hash = 0;
  for (let i = 0; i < clusterId.length; i++) {
    hash = ((hash << 5) - hash + clusterId.charCodeAt(i)) | 0;
  }
  const models: string[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.abs((hash + i * 7919) % GRAVE_MODELS.length);
    models.push(GRAVE_MODELS[idx]);
  }
  return models;
}

// ── Single Grave Marker ──────────────────────────────────────────────────

interface GraveMarkerProps {
  modelUrl: string;
  position: [number, number, number];
  rotationY: number;
  scale: number;
}

const GraveMarker: React.FC<GraveMarkerProps> = ({ modelUrl, position, rotationY, scale }) => {
  const { scene } = useGLTF(modelUrl);
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    // Fit model to a small footprint (roughly 0.3 tiles)
    const box = new THREE.Box3().setFromObject(group);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const fitScale = (0.3 / maxDim) * scale;
      group.scale.setScalar(fitScale);
    }

    // Recompute bounds after scaling to ground the model
    const scaledBox = new THREE.Box3().setFromObject(group);
    const yOffset = -scaledBox.min.y;

    group.position.set(position[0], position[1] + yOffset, position[2]);
    group.rotation.set(0, rotationY, 0);

    // Muted, desaturated look — multiply existing material colors
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        const mat = child.material as THREE.MeshStandardMaterial;
        if (mat.isMeshStandardMaterial) {
          mat.roughness = Math.min(1, mat.roughness + 0.2);
        }
      }
    });
  }, [modelUrl, position, rotationY, scale]);

  return (
    <group ref={groupRef}>
      <Clone object={scene} />
    </group>
  );
};

// ── Grave Cluster ────────────────────────────────────────────────────────

interface GraveClusterProps {
  cluster: MassGraveCluster;
}

const GraveCluster: React.FC<GraveClusterProps> = ({ cluster }) => {
  const models = useMemo(() => selectModels(cluster.id, cluster.markerCount), [cluster.id, cluster.markerCount]);

  const markers = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < cluster.id.length; i++) {
      hash = ((hash << 5) - hash + cluster.id.charCodeAt(i)) | 0;
    }

    return models.map((modelName, i) => {
      const url = getModelUrl(modelName);
      if (!url) return null;

      // Spread markers in a tight cluster (radius ~0.4 tiles)
      const angle = seededRandom(hash + i * 13) * Math.PI * 2;
      const radius = 0.15 + seededRandom(hash + i * 37) * 0.25;
      const dx = Math.cos(angle) * radius;
      const dz = Math.sin(angle) * radius;
      const rotY = seededRandom(hash + i * 59) * Math.PI * 2;
      const scale = 0.7 + seededRandom(hash + i * 71) * 0.6;

      return {
        key: `${cluster.id}-${i}`,
        modelUrl: url,
        position: [
          cluster.gridX + 0.5 + dx,
          0,
          cluster.gridY + 0.5 + dz,
        ] as [number, number, number],
        rotationY: rotY,
        scale,
      };
    }).filter(Boolean) as Array<{
      key: string;
      modelUrl: string;
      position: [number, number, number];
      rotationY: number;
      scale: number;
    }>;
  }, [cluster, models]);

  return (
    <>
      {markers.map((m) => (
        <Suspense key={m.key} fallback={null}>
          <GraveMarker
            modelUrl={m.modelUrl}
            position={m.position}
            rotationY={m.rotationY}
            scale={m.scale}
          />
        </Suspense>
      ))}
    </>
  );
};

// ── Main Renderer ────────────────────────────────────────────────────────

const MassGraveRenderer: React.FC = () => {
  const graves = useMassGraves();

  if (graves.length === 0) return null;

  return (
    <group>
      {graves.map((cluster) => (
        <GraveCluster key={cluster.id} cluster={cluster} />
      ))}
    </group>
  );
};

export default MassGraveRenderer;

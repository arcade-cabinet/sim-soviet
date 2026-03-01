/**
 * PoliticalEntityRenderer — 3D visualization of political entities on the game map.
 *
 * Renders politruks, KGB agents, military officers, and conscription officers
 * as capsule-body + sphere-head figures positioned near their assigned buildings.
 *
 * Color by role:
 *   politruk = #c62828 (red)
 *   kgb_agent = #fbc02d (gold)
 *   military_officer = #ff5722 (orange)
 *   conscription_officer = #2196f3 (blue)
 *
 * Uses regular meshes (not instanced) since there are only ~5-10 entities max.
 * Subtle idle bob animation via useFrame.
 */

import { useFrame } from '@react-three/fiber';
import type React from 'react';
import { useRef, useState } from 'react';
import type * as THREE from 'three';

import { getEngine } from '../bridge/GameInit';
import type { PoliticalRole } from '../game/political/types';

/** Role -> color mapping for political entity meshes. */
const ROLE_COLORS: Record<PoliticalRole, string> = {
  politruk: '#c62828',
  kgb_agent: '#fbc02d',
  military_officer: '#ff5722',
  conscription_officer: '#2196f3',
};

/** Data for a single political entity to render. */
interface PoliticalEntityData {
  id: string;
  role: PoliticalRole;
  gridX: number;
  gridY: number;
}

/** Single political entity mesh: capsule body + sphere head with idle bob. */
const PoliticalEntityMesh: React.FC<{
  data: PoliticalEntityData;
  index: number;
}> = ({ data, index }) => {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(index * 1.5); // stagger phase
  const color = ROLE_COLORS[data.role];

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    timeRef.current += delta;
    // Subtle idle bob
    group.position.y = 0.3 + Math.sin(timeRef.current * 1.8) * 0.04;
  });

  // Offset slightly from the building center so they don't overlap
  const offsetX = 0.3;
  const offsetZ = 0.3;

  return (
    <group ref={groupRef} position={[data.gridX + offsetX, 0.3, data.gridY + offsetZ]}>
      {/* Body (cylinder) */}
      <mesh position={[0, 0, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.1, 0.35, 8]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      {/* Head (sphere) */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <sphereGeometry args={[0.08, 8, 6]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
    </group>
  );
};

/** Renders political entities (politruks, KGB agents, etc.) as capsule figures on the map. */
const PoliticalEntityRenderer: React.FC = () => {
  const [entities, setEntities] = useState<PoliticalEntityData[]>([]);
  const prevCountRef = useRef(0);

  // Poll political entity data each frame (low frequency: only update on count change)
  useFrame(() => {
    const engine = getEngine();
    if (!engine) {
      if (prevCountRef.current !== 0) {
        setEntities([]);
        prevCountRef.current = 0;
      }
      return;
    }

    const visible = engine.getPoliticalEntities().getVisibleEntities();
    if (visible.length !== prevCountRef.current) {
      prevCountRef.current = visible.length;
      setEntities(
        visible.map((e) => ({
          id: e.id,
          role: e.role,
          gridX: e.stationedAt.gridX,
          gridY: e.stationedAt.gridY,
        })),
      );
    }
  });

  // Shared geometries can be created if needed, but with <10 entities
  // individual meshes are fine for performance.

  return (
    <>
      {entities.map((entity, i) => (
        <PoliticalEntityMesh key={entity.id} data={entity} index={i} />
      ))}
    </>
  );
};

export default PoliticalEntityRenderer;

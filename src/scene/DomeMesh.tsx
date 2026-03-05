/**
 * DomeMesh — Procedural translucent dome component for habitat enclosures.
 *
 * Generates a parametric hemisphere (or partial sphere) using SphereGeometry
 * with the bottom clipped via thetaStart/thetaLength. Uses MeshPhysicalMaterial
 * with transmission for glass-like translucency and a Fresnel-style edge glow.
 *
 * Scales from single-building greenhouses (r=2) to city-covering atmospheric
 * containment (r=50+). LOD adjusts segment count based on camera distance.
 *
 * Tint presets:
 *   - Green: greenhouse enclosure (Earth early)
 *   - Blue-white: atmospheric containment (Earth ecological collapse)
 *   - Orange: Mars atmospheric containment
 *   - White-silver: lunar pressurized habitat
 */

import { useFrame } from '@react-three/fiber';
import type React from 'react';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

export interface DomeMeshProps {
  /** Center position [x, y, z] on the grid. */
  position: [number, number, number];
  /** Radius in grid units. */
  radius: number;
  /** Height as fraction of radius (0.5 = hemisphere, 1.0 = full sphere). Default 0.5. */
  heightRatio?: number;
  /** Opacity (0.15 for glass, 0.3 for atmosphere shield, 0.5 for radiation). Default 0.2. */
  opacity?: number;
  /** Color tint hex string. Default '#b3e5fc' (blue-white). */
  tint?: string;
  /** Whether to render both faces (true for full enclosure). Default false. */
  doubleSided?: boolean;
}

/** Segment counts for LOD tiers. */
const LOD_FAR = 16;
const LOD_CLOSE = 64;
/** Distance threshold for LOD switch (in world units). */
const LOD_THRESHOLD = 30;

/**
 * Procedural translucent dome mesh with Fresnel-like edge effect and LOD.
 *
 * Uses MeshPhysicalMaterial with transmission + roughness + ior for
 * glass-like appearance. Edge brightening is achieved via a high clearcoat
 * value which creates grazing-angle reflections (physical Fresnel).
 */
const DomeMesh: React.FC<DomeMeshProps> = ({
  position,
  radius,
  heightRatio = 0.5,
  opacity = 0.2,
  tint = '#b3e5fc',
  doubleSided = false,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [segments, setSegments] = useState(LOD_FAR);

  // Compute sphere geometry parameters for a dome (upper hemisphere portion)
  // thetaStart = 0 (top of sphere), thetaLength = PI * heightRatio
  // For a hemisphere (heightRatio=0.5): thetaLength = PI/2
  const geometry = useMemo(() => {
    const phiLength = Math.PI * 2; // full revolution
    const thetaStart = 0;
    const thetaLength = Math.PI * Math.min(heightRatio, 1);
    return new THREE.SphereGeometry(
      radius,
      segments,
      Math.max(8, Math.floor(segments / 2)),
      0,
      phiLength,
      thetaStart,
      thetaLength,
    );
  }, [radius, heightRatio, segments]);

  // MeshPhysicalMaterial for glass-like dome
  const material = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(tint),
      transparent: true,
      opacity,
      transmission: 0.6,
      roughness: 0.1,
      ior: 1.5,
      thickness: 0.5,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
      depthWrite: false,
    });
  }, [tint, opacity, doubleSided]);

  // LOD: adjust segments based on camera distance
  useFrame(({ camera }) => {
    if (!meshRef.current) return;
    const dist = camera.position.distanceTo(meshRef.current.position);
    const targetSegments = dist > LOD_THRESHOLD ? LOD_FAR : LOD_CLOSE;
    if (targetSegments !== segments) {
      setSegments(targetSegments);
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={position}
      geometry={geometry}
      material={material}
      renderOrder={1}
    />
  );
};

export default DomeMesh;

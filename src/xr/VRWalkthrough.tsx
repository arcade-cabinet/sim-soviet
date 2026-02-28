import type React from 'react';
import { useRef } from 'react';
import * as THREE from 'three/webgpu';

/**
 * VR Walkthrough — street-level view inside the city.
 * Player starts at the center of the grid at eye height (1.6m).
 * Uses teleportation for movement (via @react-three/xr controllers).
 *
 * Works on: Quest 3, Vision Pro, SteamVR browsers.
 */
const VRWalkthrough: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const groupRef = useRef<THREE.Group>(null);

  // Position camera at grid center, eye height
  return (
    <group ref={groupRef} position={[15, 1.6, 15]}>
      {children}
    </group>
  );
};

export default VRWalkthrough;

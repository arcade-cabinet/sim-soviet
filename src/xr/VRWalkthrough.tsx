/**
 * VRWalkthrough -- street-level VR view inside the Soviet city.
 *
 * Player starts at the center of the grid at 1.6m eye height.
 * Movement uses @react-three/xr's useXRControllerLocomotion:
 *   - Left thumbstick: smooth translation (2 m/s)
 *   - Right thumbstick: snap rotation (45 degrees)
 *
 * Teleport is handled via TeleportTarget on a ground plane:
 *   - Controller ray + trigger teleports XROrigin to the hit point.
 *
 * Works on: Quest 3, Vision Pro, SteamVR browsers.
 */

import { TeleportTarget, useXRControllerLocomotion, XROrigin } from '@react-three/xr';
import type React from 'react';
import { useCallback, useRef } from 'react';
import type { Group } from 'three';
import { DoubleSide, type Vector3 } from 'three';
import { getCurrentGridSize } from '@/engine/GridTypes';
import XRInteraction from './XRInteraction';

const _EYE_HEIGHT = 1.6;
const MOVE_SPEED = 2;
const SNAP_DEGREES = 45;

interface VRWalkthroughProps {
  children: React.ReactNode;
}

const VRWalkthrough: React.FC<VRWalkthroughProps> = ({ children }) => {
  const originRef = useRef<Group>(null);
  const gridSize = getCurrentGridSize();
  const center = gridSize / 2;

  // Smooth locomotion via left thumbstick, snap rotation via right thumbstick
  useXRControllerLocomotion(originRef, { speed: MOVE_SPEED }, { type: 'snap', degrees: SNAP_DEGREES }, 'left');

  // Teleport handler: move XROrigin to the hit point
  const handleTeleport = useCallback((point: Vector3) => {
    if (!originRef.current) return;
    originRef.current.position.set(point.x, 0, point.z);
  }, []);

  return (
    <>
      <XROrigin ref={originRef} position={[center, 0, center]}>
        {/* Eye height is handled by the headset tracking offset from origin */}
      </XROrigin>

      {/* Ground plane as teleport target */}
      <TeleportTarget onTeleport={handleTeleport}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center, 0.001, center]}>
          <planeGeometry args={[gridSize, gridSize]} />
          <meshBasicMaterial visible={false} side={DoubleSide} />
        </mesh>
      </TeleportTarget>

      {children}
      <XRInteraction scale={1} />
    </>
  );
};

export default VRWalkthrough;

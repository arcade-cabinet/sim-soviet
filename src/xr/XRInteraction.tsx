/**
 * XRInteraction -- shared controller interaction logic for AR and VR.
 *
 * Provides:
 * - Controller ray visualization (line from controller to ground intersection)
 * - Ray-to-ground-plane intersection converted to grid cell coordinates
 * - Ghost preview mesh at the hovered grid cell
 * - Select trigger: clear an armed bulldoze action
 * - Squeeze trigger: bulldoze via bulldozeECSBuilding
 * - Haptic feedback on bulldoze actions
 *
 * Included by both ARTabletop and VRWalkthrough.
 */

import { useFrame, useThree } from '@react-three/fiber';
import { useXRInputSourceEvent, useXRInputSourceState } from '@react-three/xr';
import type React from 'react';
import { useCallback, useRef, useState } from 'react';
import type { BufferGeometry, Line, Mesh } from 'three';
import { Plane, Raycaster, Vector3 } from 'three';
import { bulldozeECSBuilding } from '@/bridge/BuildingPlacement';
import { gameState } from '@/engine/GameState';
import { getCurrentGridSize } from '@/engine/GridTypes';

const groundPlane = new Plane(new Vector3(0, 1, 0), 0);
const raycaster = new Raycaster();
const intersectionPoint = new Vector3();
const tempOrigin = new Vector3();
const tempDirection = new Vector3();

interface XRInteractionProps {
  /** World-space scale factor (0.02 for AR tabletop, 1 for VR) */
  scale: number;
  /** AR reposition callback -- called on select when no grid cell is hovered */
  onRepositionAR?: () => void;
}

/**
 * Pulse haptic feedback on a controller's gamepad, if available.
 */
function pulseHaptic(inputSource: XRInputSource | undefined, intensity: number, duration: number) {
  if (!inputSource?.gamepad?.hapticActuators?.length) return;
  const actuator = inputSource.gamepad.hapticActuators[0] as GamepadHapticActuator & {
    pulse?: (intensity: number, duration: number) => void;
  };
  actuator.pulse?.(intensity, duration);
}

const XRInteraction: React.FC<XRInteractionProps> = ({ scale, onRepositionAR }) => {
  useThree();
  const [hoveredCell, setHoveredCell] = useState<{ x: number; z: number } | null>(null);
  const rayLineRef = useRef<Line<BufferGeometry>>(null);
  const ghostRef = useRef<Mesh>(null);

  // Read the dominant (right) controller state
  const controllerState = useXRInputSourceState('controller', 'right');
  const gridSize = getCurrentGridSize();

  // Per-frame: cast ray from controller to ground plane, find hovered grid cell
  useFrame(() => {
    if (!controllerState?.inputSource) {
      setHoveredCell(null);
      return;
    }

    const grip = controllerState.object;
    if (!grip) {
      setHoveredCell(null);
      return;
    }

    // Get controller world position and direction
    grip.getWorldPosition(tempOrigin);
    grip.getWorldDirection(tempDirection);
    tempDirection.negate(); // Controller forward is -Z

    raycaster.set(tempOrigin, tempDirection);

    // Intersect with ground plane (y=0)
    const hit = raycaster.ray.intersectPlane(groundPlane, intersectionPoint);

    if (!hit) {
      setHoveredCell(null);
      return;
    }

    // In AR tabletop mode, the scene is scaled down.
    // The intersection is in world space; convert to grid coordinates.
    const worldX = intersectionPoint.x / scale;
    const worldZ = intersectionPoint.z / scale;

    const gridX = Math.floor(worldX);
    const gridZ = Math.floor(worldZ);

    if (gridX >= 0 && gridX < gridSize && gridZ >= 0 && gridZ < gridSize) {
      setHoveredCell({ x: gridX, z: gridZ });
    } else {
      setHoveredCell(null);
    }

    // Update ray line visualization
    if (rayLineRef.current) {
      const positions = rayLineRef.current.geometry.attributes.position;
      if (positions) {
        positions.setXYZ(0, tempOrigin.x, tempOrigin.y, tempOrigin.z);
        positions.setXYZ(1, intersectionPoint.x, intersectionPoint.y, intersectionPoint.z);
        positions.needsUpdate = true;
      }
    }

    // Update ghost preview position
    if (ghostRef.current) {
      if (gridX >= 0 && gridX < gridSize && gridZ >= 0 && gridZ < gridSize) {
        ghostRef.current.visible = true;
        ghostRef.current.position.set((gridX + 0.5) * scale, 0.01, (gridZ + 0.5) * scale);
      } else {
        ghostRef.current.visible = false;
      }
    }
  });

  // Select trigger: no direct placement. Only execute if bulldoze is armed.
  const handleSelect = useCallback(() => {
    if (!hoveredCell) {
      // In AR, selecting empty space repositions the model
      onRepositionAR?.();
      return;
    }

    const tool = gameState.selectedTool;
    if (!tool || tool === 'none') return;

    if (tool === 'bulldoze') {
      const success = bulldozeECSBuilding(hoveredCell.x, hoveredCell.z);
      if (success) {
        pulseHaptic(controllerState?.inputSource, 0.7, 80);
      }
    }
  }, [hoveredCell, controllerState?.inputSource, onRepositionAR]);

  // Squeeze trigger: bulldoze at hovered cell
  const handleSqueeze = useCallback(() => {
    if (!hoveredCell) return;

    const success = bulldozeECSBuilding(hoveredCell.x, hoveredCell.z);
    if (success) {
      pulseHaptic(controllerState?.inputSource, 0.7, 80);
    }
  }, [hoveredCell, controllerState?.inputSource]);

  // Bind XR input events
  useXRInputSourceEvent(controllerState?.inputSource ?? 'all', 'select', handleSelect, [handleSelect]);

  useXRInputSourceEvent(controllerState?.inputSource ?? 'all', 'squeeze', handleSqueeze, [handleSqueeze]);

  const ghostScale = scale;

  return (
    <>
      {/* Controller ray visualization */}
      <line ref={rayLineRef as any}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array([0, 0, 0, 0, 0, 0]), 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#ff4444" linewidth={2} transparent opacity={0.6} />
      </line>

      {/* Ghost preview at hovered grid cell */}
      <mesh ref={ghostRef} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ghostScale, ghostScale]} />
        <meshBasicMaterial color="#fbc02d" transparent opacity={0.4} depthWrite={false} />
      </mesh>
    </>
  );
};

export default XRInteraction;

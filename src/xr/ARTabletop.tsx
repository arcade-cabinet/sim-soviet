/**
 * ARTabletop -- places the city grid as a tabletop-scale model in AR.
 *
 * The 30x30 grid (1 unit per cell) is scaled to 0.02 (2cm per cell),
 * making the entire city approximately 60cm across -- fits on a table.
 *
 * Uses useXRHitTest to detect surfaces and place the city on the first
 * detected plane. After placement, the user can tap empty space to
 * reposition the model via useXRRequestHitTest.
 *
 * Works on: Android Chrome (WebXR AR), Quest 3 passthrough.
 * Does NOT work on: iOS Safari (no WebXR support).
 */

import { useXRHitTest, useXRRequestHitTest, XROrigin } from '@react-three/xr';
import type React from 'react';
import { useCallback, useRef, useState } from 'react';
import type { Group } from 'three';
import { Matrix4, Vector3 } from 'three';
import { getCurrentGridSize } from '@/engine/GridTypes';
import XRInteraction from './XRInteraction';

const TABLETOP_SCALE = 0.02;

const matrixHelper = new Matrix4();
const positionHelper = new Vector3();

interface ARTabletopProps {
  children: React.ReactNode;
}

const ARTabletop: React.FC<ARTabletopProps> = ({ children }) => {
  const groupRef = useRef<Group>(null);
  const [placed, setPlaced] = useState(false);
  const [origin, setOrigin] = useState<[number, number, number]>([0, -0.5, -1]);
  const requestHitTest = useXRRequestHitTest();

  // Continuous hit test: anchor on first detected surface
  useXRHitTest(
    (results, getWorldMatrix) => {
      if (placed || results.length === 0) return;

      if (getWorldMatrix(matrixHelper, results[0])) {
        positionHelper.setFromMatrixPosition(matrixHelper);
        setOrigin([positionHelper.x, positionHelper.y, positionHelper.z]);
        setPlaced(true);
      }
    },
    'viewer',
    'plane',
  );

  // Tap-to-reposition: controller select on empty space triggers a single hit test
  const handleReposition = useCallback(async () => {
    if (!requestHitTest) return;
    const result = await requestHitTest('viewer', ['plane', 'mesh']);
    if (!result || result.results.length === 0) return;

    if (result.getWorldMatrix(matrixHelper, result.results[0])) {
      positionHelper.setFromMatrixPosition(matrixHelper);
      setOrigin([positionHelper.x, positionHelper.y, positionHelper.z]);
    }
  }, [requestHitTest]);

  const gridSize = getCurrentGridSize();
  // Offset so the grid center sits at the origin point
  const offset = (-gridSize * TABLETOP_SCALE) / 2;

  return (
    <>
      <XROrigin position={origin} />
      <group ref={groupRef} position={[offset, 0, offset]} scale={[TABLETOP_SCALE, TABLETOP_SCALE, TABLETOP_SCALE]}>
        {children}
        <XRInteraction scale={TABLETOP_SCALE} onRepositionAR={handleReposition} />
      </group>
    </>
  );
};

export default ARTabletop;

/**
 * HeatingOverlay — Per-building heating visual indicators during cold seasons.
 *
 * During cold months (Nov-Mar = winter/autumn seasons):
 *   - Buildings with operational heating: warm orange pointLight glow
 *   - Buildings with failing heating: blue-tinted semi-transparent plane above
 *
 * Reads heating state from the EconomySystem via SimulationEngine,
 * and building positions from the ECS bridge.
 *
 * Only renders during cold seasons to minimize GPU load.
 */

import { useFrame } from '@react-three/fiber';
import type React from 'react';
import { useRef, useState } from 'react';
import { getBuildingStates } from '../bridge/ECSBridge';
import { getEngine } from '../bridge/GameInit';
import { useGameSnapshot } from '../hooks/useGameState';

/** Data for a single building's heating visual. */
interface HeatingVisual {
  gridX: number;
  gridY: number;
  heated: boolean;
}

/** Whether this season has cold months that require heating. */
function isColdSeason(season: string): boolean {
  return season === 'winter' || season === 'autumn';
}

/** Renders per-building heating indicators (warm glow or cold overlay) during cold seasons. */
const HeatingOverlay: React.FC = () => {
  const snap = useGameSnapshot();
  const [visuals, setVisuals] = useState<HeatingVisual[]>([]);
  const prevVersionRef = useRef(0);

  // Only render during cold seasons
  const cold = isColdSeason(snap.season);

  // Update heating visuals at low frequency (when building count changes)
  useFrame(() => {
    if (!cold) {
      if (visuals.length > 0) setVisuals([]);
      return;
    }

    const engine = getEngine();
    if (!engine) return;

    const buildings = getBuildingStates();
    const buildingCount = buildings.length;

    // Simple version check — only rebuild when building count changes
    if (buildingCount === prevVersionRef.current) return;
    prevVersionRef.current = buildingCount;

    const heating = engine.getEconomySystem().getHeating();
    const isHeated = !heating.failing;

    setVisuals(
      buildings.map((b) => ({
        gridX: b.gridX,
        gridY: b.gridY,
        heated: isHeated,
      })),
    );
  });

  if (!cold || visuals.length === 0) return null;

  return (
    <>
      {visuals.map((v, i) =>
        v.heated ? (
          // Warm orange glow for heated buildings
          <pointLight
            key={`heat_${i}`}
            position={[v.gridX + 0.5, 1.2, v.gridY + 0.5]}
            color="#ff8a50"
            intensity={0.4}
            distance={3}
            decay={2}
          />
        ) : (
          // Blue cold overlay for unheated buildings
          <mesh key={`cold_${i}`} position={[v.gridX + 0.5, 1.0, v.gridY + 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.9, 0.9]} />
            <meshBasicMaterial color="#42a5f5" transparent opacity={0.3} depthWrite={false} side={2} />
          </mesh>
        ),
      )}
    </>
  );
};

export default HeatingOverlay;

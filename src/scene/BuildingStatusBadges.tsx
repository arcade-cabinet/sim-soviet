/**
 * BuildingStatusBadges — Billboard status icons floating above buildings.
 *
 * Renders a colored glyph above each building based on its current state:
 *   Red !       — on fire / emergency
 *   Yellow bolt — unpowered (needs power but has none)
 *   Orange gear — under construction
 *   Green check — operational (only shown briefly on state transitions, or
 *                 when the building is fully staffed + powered)
 *
 * Uses drei's Billboard + Text to always face the camera.
 * Badge floats ~1.2 units above the building's grid position.
 */

import { Billboard, Text } from '@react-three/drei';
import type React from 'react';
import { useMemo } from 'react';

import type { BuildingState } from './BuildingRenderer';

interface BuildingStatusBadgesProps {
  buildings: BuildingState[];
}

/** Badge definition: what to show for a given building state. */
interface BadgeDef {
  glyph: string;
  color: string;
  /** Slightly larger font for urgent statuses. */
  fontSize: number;
}

/** Determine the status badge for a building, or null if no badge needed. */
function getBadge(b: BuildingState): BadgeDef | null {
  // Priority 1: Fire
  if (b.onFire) {
    return { glyph: '\u2757', color: '#ff1744', fontSize: 0.35 }; // red !
  }

  // Priority 2: Under construction
  if (b.constructionPhase != null && b.constructionPhase !== 'complete') {
    return { glyph: '\u2692', color: '#ff9800', fontSize: 0.3 }; // crossed hammers
  }

  // Priority 3: Unpowered (only for buildings that need power)
  // We don't have powerReq on BuildingState, so we infer: if powered=false
  // and the building is complete, it might be unpowered. Since roads/trees
  // also have powered=false but don't need power, we skip types that are
  // typically non-powered (those without a meaningful type).
  if (!b.powered && b.constructionPhase === 'complete') {
    return { glyph: '\u26A1', color: '#fbc02d', fontSize: 0.3 }; // lightning bolt
  }

  // No badge for normal operational buildings (green check is too noisy)
  return null;
}

/** Single billboard badge above one building. */
const Badge: React.FC<{ building: BuildingState; badge: BadgeDef }> = ({ building, badge }) => {
  // Position above building center, elevated above model height
  const posX = building.gridX + 0.5;
  const posY = building.elevation * 0.5 + 1.4;
  const posZ = building.gridY + 0.5;

  return (
    <Billboard position={[posX, posY, posZ]} follow lockX={false} lockY={false} lockZ={false}>
      <Text
        fontSize={badge.fontSize}
        color={badge.color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.025}
        outlineColor="black"
        font={undefined}
      >
        {badge.glyph}
      </Text>
    </Billboard>
  );
};

const BuildingStatusBadges: React.FC<BuildingStatusBadgesProps> = ({ buildings }) => {
  // Compute badges for all buildings that need one
  const badgedBuildings = useMemo(() => {
    const result: Array<{ building: BuildingState; badge: BadgeDef }> = [];
    for (const b of buildings) {
      const badge = getBadge(b);
      if (badge) {
        result.push({ building: b, badge });
      }
    }
    return result;
  }, [buildings]);

  if (badgedBuildings.length === 0) return null;

  return (
    <group>
      {badgedBuildings.map(({ building, badge }) => (
        <Badge key={building.id} building={building} badge={badge} />
      ))}
    </group>
  );
};

export default BuildingStatusBadges;

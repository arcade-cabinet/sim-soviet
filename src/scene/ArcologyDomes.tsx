/**
 * ArcologyDomes — Renders DomeMesh instances over arcologies that have domes.
 *
 * Reads arcology data from SimulationEngine and renders a translucent dome
 * over each arcology with hasDome=true. Tint is determined by the active
 * settlement's celestial body.
 */

import React, { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';

import { getEngine } from '@/bridge/GameInit';
import DomeMesh from './DomeMesh';

/** Map celestial body to dome tint color. */
const BODY_TINT: Record<string, string> = {
  earth: '#aaccff',    // blue-white atmospheric containment
  moon: '#ddddee',     // white-silver pressurized
  mars: '#ffaa66',     // orange Martian
  titan: '#aacc44',    // yellow-green methane-resistant
  exoplanet: '#88ddcc', // teal alien atmosphere
};

const ArcologyDomes: React.FC = () => {
  const engine = getEngine();
  const arcologies = engine?.getArcologies() ?? [];

  const domes = useMemo(() => {
    return arcologies
      .filter((a) => a.hasDome && a.footprint.length > 0)
      .map((a) => {
        // Compute dome center from footprint centroid
        const cx = a.footprint.reduce((s, p) => s + p.x, 0) / a.footprint.length;
        const cz = a.footprint.reduce((s, p) => s + p.y, 0) / a.footprint.length;
        // Radius: approximate from footprint extent
        const maxDist = Math.max(
          ...a.footprint.map((p) => Math.sqrt((p.x - cx) ** 2 + (p.y - cz) ** 2)),
        );
        const radius = Math.max(2, maxDist + 1.5); // padding

        return { id: a.id, cx, cz, radius };
      });
  }, [arcologies]);

  if (domes.length === 0) return null;

  // Determine tint from active settlement's celestial body
  const body = engine?.getRelocationEngine()?.getRegistry()?.getActive()?.celestialBody ?? 'earth';
  const tint = BODY_TINT[body] ?? BODY_TINT.earth;

  return (
    <>
      {domes.map((d) => (
        <DomeMesh
          key={d.id}
          position={[d.cx + 0.5, 0, d.cz + 0.5]}
          radius={d.radius}
          heightRatio={0.5}
          opacity={0.15}
          tint={tint!}
          doubleSided={false}
        />
      ))}
    </>
  );
};

export default ArcologyDomes;

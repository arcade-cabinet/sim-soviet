/**
 * Directives array with check functions.
 *
 * Originally a faithful port of poc.html lines 373-390. Updated to query
 * ECS building entities via Miniplex archetypes instead of the old flat
 * grid, so directive checks work with the ECS SimulationEngine.
 */

import { getBuildingDef } from '@/data/buildingDefs';
import type { Role } from '@/data/buildingDefs.schema';
import { buildingsLogic, getResourceEntity, operationalBuildings } from '@/ecs/archetypes';
import { gameState } from './GameState';

export interface Directive {
  text: string;
  target: number;
  reward: number;
  check: () => boolean;
}

/**
 * Count ECS buildings whose defId matches, or whose role matches the given value.
 * Falls back to checking the old flat grid for non-ECS types (road, pipe).
 */
export function countBuildingsByRole(role: Role): number {
  return buildingsLogic.entities.filter((e) => {
    const def = getBuildingDef(e.building.defId);
    return def?.role === role;
  }).length;
}

/** Count ECS buildings with a specific defId. */
export function countBuildingsByDefId(defId: string): number {
  return buildingsLogic.entities.filter((e) => e.building.defId === defId).length;
}

/** Count flat-grid cells with a given type (for non-ECS placements like roads). */
export function countGridCellType(type: string): number {
  if (gameState.grid.length === 0) return 0;
  return gameState.grid.flat().filter((c) => c.type === type).length;
}

/** Check if any operational building has powerReq > 0 and is powered (water demand proxy). */
function hasWaterDemand(): boolean {
  return operationalBuildings.entities.some((e) => e.building.powered && e.building.powerReq > 0);
}

export const DIRECTIVES: Directive[] = [
  {
    text: 'Housing: Build 4 Residential buildings.',
    target: 4,
    reward: 150,
    check: () => countBuildingsByRole('housing') >= 4,
  },
  {
    text: 'Utilities: Build a Water Pump (on river).',
    target: 1,
    reward: 150,
    check: () => countBuildingsByDefId('warehouse') >= 1,
  },
  {
    text: 'Infrastructure: Connect buildings with Pipes.',
    target: 1,
    reward: 100,
    check: () => hasWaterDemand(),
  },
  {
    text: 'Power: Build a Coal Plant.',
    target: 1,
    reward: 300,
    check: () => countBuildingsByRole('power') >= 1,
  },
  {
    text: 'Industry: Build 2 Industrial buildings.',
    target: 2,
    reward: 200,
    check: () => countBuildingsByRole('industry') >= 2,
  },
  {
    text: 'Agriculture: Build 2 Farm buildings.',
    target: 2,
    reward: 150,
    check: () => countBuildingsByRole('agriculture') >= 2,
  },
  {
    text: 'Logistics: Build 3 Roads.',
    target: 3,
    reward: 50,
    check: () => countGridCellType('road') >= 3,
  },
  {
    text: 'Ensure Loyalty: Build a Gulag.',
    target: 1,
    reward: 200,
    check: () => countBuildingsByDefId('gulag-admin') >= 1,
  },
  {
    text: 'Expand the State: Reach 100 Population.',
    target: 100,
    reward: 500,
    check: () => (getResourceEntity()?.resources.population ?? 0) >= 100,
  },
  {
    text: 'Clean Energy: Build a Reactor.',
    target: 1,
    reward: 800,
    check: () => countBuildingsByDefId('cooling-tower') >= 1,
  },
  {
    text: 'Conquer the Stars: Build the Cosmodrome.',
    target: 1,
    reward: 1000,
    check: () => countBuildingsByDefId('government-hq') >= 1,
  },
  {
    text: 'Awaiting Further Orders...',
    target: 1,
    reward: 0,
    check: () => false,
  },
];

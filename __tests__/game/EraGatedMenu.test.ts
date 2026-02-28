/**
 * Tests for era-gated building menu data flow.
 *
 * Verifies that the RadialBuildMenu filtering logic correctly
 * excludes buildings from future eras and includes all buildings
 * from the current and past eras.
 */

import { BUILDING_DEFS, getBuildingsByRole, type Role } from '../../src/data/buildingDefs';
import { ERA_DEFINITIONS, ERA_ORDER, getAvailableBuildingsForYear } from '../../src/game/era/definitions';

/** Category definitions matching RadialBuildMenu.tsx */
const CATEGORIES: { id: string; roles: Role[] }[] = [
  { id: 'res', roles: ['housing'] },
  { id: 'ind', roles: ['industry', 'agriculture'] },
  { id: 'utility', roles: ['power', 'utility'] },
  { id: 'svc', roles: ['services', 'culture'] },
  { id: 'gov', roles: ['government', 'propaganda'] },
  { id: 'mil', roles: ['military'] },
  { id: 'infra', roles: ['transport', 'environment'] },
];

describe('Era-gated build menu filtering', () => {
  it('revolution (1917) has at least one building available', () => {
    const available = new Set(getAvailableBuildingsForYear(1917));
    expect(available.size).toBeGreaterThan(0);
  });

  it('future-era buildings are excluded from early eras', () => {
    const era1Available = new Set(getAvailableBuildingsForYear(1917));

    // Collect buildings only unlocked in later eras
    const laterEraBuildings: string[] = [];
    for (let i = 1; i < ERA_ORDER.length; i++) {
      const eraDef = ERA_DEFINITIONS[ERA_ORDER[i]!];
      laterEraBuildings.push(...eraDef.unlockedBuildings);
    }

    // None of the later-era buildings should appear in era 1
    for (const b of laterEraBuildings) {
      if (!ERA_DEFINITIONS[ERA_ORDER[0]!].unlockedBuildings.includes(b)) {
        expect(era1Available.has(b)).toBe(false);
      }
    }
  });

  it('all categories have at least one building by final era', () => {
    const available = new Set(getAvailableBuildingsForYear(2100));

    for (const cat of CATEGORIES) {
      const catBuildings = cat.roles.flatMap((r) => getBuildingsByRole(r)).filter((id) => available.has(id));
      expect(catBuildings.length).toBeGreaterThan(0);
    }
  });

  it('each era cumulatively includes all previous era buildings', () => {
    let previousSet = new Set<string>();

    for (const eraId of ERA_ORDER) {
      const eraDef = ERA_DEFINITIONS[eraId];
      const available = new Set(getAvailableBuildingsForYear(eraDef.startYear));

      // All buildings from previous eras should still be available
      for (const b of previousSet) {
        expect(available.has(b)).toBe(true);
      }

      previousSet = available;
    }
  });

  it('era-available buildings with BUILDING_DEFS entries have valid roles', () => {
    const allAvailable = getAvailableBuildingsForYear(2100);
    for (const defId of allAvailable) {
      const def = BUILDING_DEFS[defId];
      // Some defIds are infrastructure (road, pipe, rail) without BUILDING_DEFS entries
      if (def) {
        expect(def.presentation.name).toBeTruthy();
        expect(def.role).toBeTruthy();
      }
    }
  });
});

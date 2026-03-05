/**
 * Tests for the Kardashev sub-era system.
 *
 * Verifies:
 * - Sub-era definitions exist and are correctly structured
 * - Sub-era transitions fire at correct conditions in OrganicUnlocks
 * - Building model lookup works for each sub-era
 * - Backward compatibility: the_eternal maps to post_soviet
 * - Sub-eras do NOT interfere with historical mode (eraIndexForYear)
 * - Terrain, prestige, and agent wiring
 */

import {
  ERA_DEFINITIONS,
  ERA_ORDER,
  FULL_ERA_ORDER,
  eraIndexForYear,
} from '../../src/game/era/definitions';
import {
  KARDASHEV_ORDER,
  KARDASHEV_SCALE,
  isKardashevSubEra,
  resolveEternalToSubEra,
} from '../../src/config/kardashevSubEras';
import { evaluateOrganicUnlocks, type UnlockContext } from '../../src/growth/OrganicUnlocks';
import { getModelName, ERA_MODEL_MAP } from '../../src/scene/ModelMapping';
import { eraToTerrainState } from '../../src/scene/terrainEraMapping';
import { getPrestigeProject } from '../../src/config/prestigeProjects';
import { getBuildInterval } from '../../src/growth/GrowthPacing';

/** Create a default unlock context. */
function createContext(overrides: Partial<UnlockContext> = {}): UnlockContext {
  return {
    population: 50,
    industrialBuildingCount: 0,
    hasActiveWar: false,
    hasExperiencedWar: false,
    yearsSinceLastWar: Infinity,
    recentGrowthRate: 0.05,
    lowGrowthYears: 0,
    simulationYearsElapsed: 5,
    currentEraId: 'revolution',
    ...overrides,
  };
}

describe('Kardashev Sub-Era Definitions', () => {
  it('defines 8 sub-eras in KARDASHEV_ORDER', () => {
    expect(KARDASHEV_ORDER).toHaveLength(8);
  });

  it('all sub-eras exist in ERA_DEFINITIONS', () => {
    for (const subEra of KARDASHEV_ORDER) {
      expect(ERA_DEFINITIONS[subEra]).toBeDefined();
      expect(ERA_DEFINITIONS[subEra].id).toBe(subEra);
    }
  });

  it('FULL_ERA_ORDER has 16 entries (8 historical + 8 sub-eras)', () => {
    expect(FULL_ERA_ORDER).toHaveLength(16);
    // First 8 are historical
    expect(FULL_ERA_ORDER.slice(0, 8)).toEqual([...ERA_ORDER]);
    // Last 8 are sub-eras
    expect(FULL_ERA_ORDER.slice(8)).toEqual([...KARDASHEV_ORDER]);
  });

  it('ERA_ORDER remains at 8 entries (historical only)', () => {
    expect(ERA_ORDER).toHaveLength(8);
    expect(ERA_ORDER).not.toContain('post_soviet');
  });

  it('sub-eras have progressive start years', () => {
    const years = KARDASHEV_ORDER.map((id) => ERA_DEFINITIONS[id].startYear);
    for (let i = 1; i < years.length; i++) {
      expect(years[i]).toBeGreaterThanOrEqual(years[i - 1]!);
    }
  });

  it('sub-eras have progressive production multipliers', () => {
    const mults = KARDASHEV_ORDER.map((id) => ERA_DEFINITIONS[id].modifiers.productionMult);
    for (let i = 1; i < mults.length; i++) {
      expect(mults[i]).toBeGreaterThanOrEqual(mults[i - 1]!);
    }
  });

  it('all sub-eras use eternal doctrine', () => {
    for (const subEra of KARDASHEV_ORDER) {
      expect(ERA_DEFINITIONS[subEra].doctrine).toBe('eternal');
    }
  });

  it('type_two_peak has endYear -1 (terminal)', () => {
    expect(ERA_DEFINITIONS.type_two_peak.endYear).toBe(-1);
  });

  it('construction methods progress: industrial -> automated -> nanoscale', () => {
    const methods = KARDASHEV_ORDER.map((id) => ERA_DEFINITIONS[id].constructionMethod);
    expect(methods[0]).toBe('industrial'); // post_soviet
    expect(methods[1]).toBe('automated'); // planetary
    expect(methods[4]).toBe('nanoscale'); // deconstruction
    expect(methods[7]).toBe('nanoscale'); // type_two_peak
  });

  it('every sub-era has flavor text', () => {
    for (const subEra of KARDASHEV_ORDER) {
      const def = ERA_DEFINITIONS[subEra];
      expect(def.introTitle.length).toBeGreaterThan(0);
      expect(def.introText.length).toBeGreaterThan(0);
      expect(def.briefingFlavor.length).toBeGreaterThan(0);
    }
  });
});

describe('Kardashev Scale', () => {
  it('has scale entries for all sub-eras', () => {
    for (const subEra of KARDASHEV_ORDER) {
      expect(KARDASHEV_SCALE[subEra]).toBeDefined();
      expect(KARDASHEV_SCALE[subEra].min).toBeLessThanOrEqual(KARDASHEV_SCALE[subEra].max);
    }
  });

  it('scale ranges are monotonically increasing', () => {
    for (let i = 1; i < KARDASHEV_ORDER.length; i++) {
      const prev = KARDASHEV_SCALE[KARDASHEV_ORDER[i - 1]!];
      const curr = KARDASHEV_SCALE[KARDASHEV_ORDER[i]!];
      expect(curr.min).toBeGreaterThanOrEqual(prev.min);
    }
  });

  it('starts at K 0.72 and ends at K 2.0', () => {
    expect(KARDASHEV_SCALE.post_soviet.min).toBe(0.72);
    expect(KARDASHEV_SCALE.type_two_peak.max).toBe(2.0);
  });
});

describe('isKardashevSubEra', () => {
  it('returns true for sub-eras', () => {
    for (const subEra of KARDASHEV_ORDER) {
      expect(isKardashevSubEra(subEra)).toBe(true);
    }
  });

  it('returns false for historical eras', () => {
    for (const era of ERA_ORDER) {
      expect(isKardashevSubEra(era)).toBe(false);
    }
  });
});

describe('resolveEternalToSubEra (backward compatibility)', () => {
  it('maps the_eternal to post_soviet', () => {
    expect(resolveEternalToSubEra('the_eternal')).toBe('post_soviet');
  });

  it('leaves other eras unchanged', () => {
    expect(resolveEternalToSubEra('revolution')).toBe('revolution');
    expect(resolveEternalToSubEra('stagnation')).toBe('stagnation');
    expect(resolveEternalToSubEra('post_soviet')).toBe('post_soviet');
  });
});

describe('Sub-era transitions in OrganicUnlocks', () => {
  it('the_eternal -> post_soviet: triggers at techLevel > 0.72', () => {
    const ctx = createContext({
      currentEraId: 'the_eternal',
      techLevel: 0.73,
      simulationYearsElapsed: 60,
    });
    expect(evaluateOrganicUnlocks(ctx)).toBe('post_soviet');
  });

  it('the_eternal -> post_soviet: triggers at 100+ years even without techLevel', () => {
    const ctx = createContext({
      currentEraId: 'the_eternal',
      techLevel: 0.5,
      simulationYearsElapsed: 100,
    });
    expect(evaluateOrganicUnlocks(ctx)).toBe('post_soviet');
  });

  it('post_soviet -> planetary: requires techLevel > 0.80 AND pop > 10K', () => {
    const ctx = createContext({
      currentEraId: 'post_soviet',
      techLevel: 0.85,
      population: 15000,
      simulationYearsElapsed: 120,
    });
    expect(evaluateOrganicUnlocks(ctx)).toBe('planetary');
  });

  it('post_soviet does not transition without sufficient techLevel', () => {
    const ctx = createContext({
      currentEraId: 'post_soviet',
      techLevel: 0.75,
      population: 15000,
      simulationYearsElapsed: 120,
    });
    expect(evaluateOrganicUnlocks(ctx)).toBeNull();
  });

  it('type_two_peak has no further transitions', () => {
    const ctx = createContext({
      currentEraId: 'type_two_peak',
      population: 10000000,
      simulationYearsElapsed: 500000,
      techLevel: 1.0,
    });
    expect(evaluateOrganicUnlocks(ctx)).toBeNull();
  });

  it('sub-era transitions are forward-only', () => {
    const ctx = createContext({
      currentEraId: 'dyson_swarm',
      population: 100,
      techLevel: 0.73,
      simulationYearsElapsed: 100,
    });
    // Should not go back to post_soviet or earlier
    expect(evaluateOrganicUnlocks(ctx)).toBeNull();
  });

  it('all sub-era transitions are +1 only', () => {
    // From planetary, should go to solar_engineering, not skip ahead
    const ctx = createContext({
      currentEraId: 'planetary',
      techLevel: 0.95,
      population: 200000,
      simulationYearsElapsed: 500,
    });
    expect(evaluateOrganicUnlocks(ctx)).toBe('solar_engineering');
  });
});

describe('Sub-era building models', () => {
  it('ERA_MODEL_MAP has entries for all sub-eras', () => {
    for (const subEra of KARDASHEV_ORDER) {
      expect(ERA_MODEL_MAP[subEra]).toBeDefined();
    }
  });

  it('housing model lookup works for each sub-era', () => {
    for (const subEra of KARDASHEV_ORDER) {
      const name = getModelName('housing', 0, subEra);
      expect(name).not.toBeNull();
      expect(typeof name).toBe('string');
    }
  });

  it('post_soviet mixes brutalist + colony models', () => {
    const housing0 = getModelName('housing', 0, 'post_soviet');
    expect(housing0).toBe('apartment-tower-d'); // brutalist
    const housing2 = getModelName('housing', 2, 'post_soviet');
    expect(housing2).toBe('spacestation-01'); // colony
  });

  it('type_two_peak uses only advanced models', () => {
    const housing = getModelName('housing', 0, 'type_two_peak');
    expect(housing).toBe('spacestation-03');
    const factory = getModelName('factory', 0, 'type_two_peak');
    expect(factory).toBe('spacestation-04');
  });
});

describe('Sub-era terrain mapping', () => {
  it('all sub-eras map to permafrost_thaw', () => {
    for (const subEra of KARDASHEV_ORDER) {
      expect(eraToTerrainState(subEra)).toBe('permafrost_thaw');
    }
  });
});

describe('Sub-era prestige projects', () => {
  it('sub-eras have no prestige projects', () => {
    for (const subEra of KARDASHEV_ORDER) {
      expect(getPrestigeProject(subEra)).toBeUndefined();
    }
  });
});

describe('Sub-era build intervals', () => {
  it('sub-eras have progressively faster build intervals', () => {
    const intervals = KARDASHEV_ORDER.map((id) => getBuildInterval(id));
    for (let i = 1; i < intervals.length; i++) {
      expect(intervals[i]).toBeLessThanOrEqual(intervals[i - 1]!);
    }
  });
});

describe('Historical mode isolation', () => {
  it('eraIndexForYear never resolves to sub-era indices', () => {
    // Test years far into the future — should still resolve to the_eternal (index 7)
    expect(eraIndexForYear(2000)).toBe(7);
    expect(eraIndexForYear(5000)).toBe(7);
    expect(eraIndexForYear(100000)).toBe(7);
    expect(eraIndexForYear(1000000)).toBe(7);
  });

  it('ERA_ORDER length is exactly 8', () => {
    expect(ERA_ORDER).toHaveLength(8);
  });
});

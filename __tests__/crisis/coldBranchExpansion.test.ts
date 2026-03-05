/**
 * Tests for new cold branches: planetary deconstruction + FTL/expansion + beyond Type II.
 *
 * Validates branch definitions, activation conditions, and effect structures.
 */

import type { PressureDomain } from '../../src/ai/agents/crisis/pressure/PressureDomains';
import type { WorldState } from '../../src/ai/agents/core/WorldAgent';
import type { GovernanceType, SphereId } from '../../src/ai/agents/core/worldCountries';
import {
  COLD_BRANCHES,
  evaluateBranches,
  type ColdBranch,
  type BranchTracker,
} from '../../src/ai/agents/core/worldBranches';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeWorldState(overrides: Partial<WorldState> = {}): WorldState {
  return {
    spheres: {} as WorldState['spheres'],
    countries: [],
    globalTension: 0,
    borderThreat: 0,
    tradeAccess: 1.0,
    commodityIndex: 1.0,
    centralPlanningEfficiency: 1.0,
    climateTrend: 0,
    climateCycleRemaining: 120,
    moscowAttention: 0,
    ideologyRigidity: 0.5,
    techLevel: 0,
    ...overrides,
  };
}

function makePressureState(
  overrides: Partial<Record<PressureDomain, number>> = {},
): Record<PressureDomain, { level: number }> {
  const domains: PressureDomain[] = [
    'food', 'morale', 'loyalty', 'housing', 'political',
    'power', 'infrastructure', 'demographic', 'health', 'economic',
  ];
  const state = {} as Record<PressureDomain, { level: number }>;
  for (const domain of domains) {
    state[domain] = { level: overrides[domain] ?? 0 };
  }
  return state;
}

function makeSpheres(
  overrides: Partial<Record<SphereId, { governance: GovernanceType; aggregateHostility: number }>> = {},
): Record<SphereId, { governance: GovernanceType; aggregateHostility: number }> {
  const sphereIds: SphereId[] = ['european', 'sinosphere', 'western', 'middle_eastern', 'eurasian', 'corporate'];
  const spheres = {} as Record<SphereId, { governance: GovernanceType; aggregateHostility: number }>;
  for (const id of sphereIds) {
    spheres[id] = overrides[id] ?? { governance: 'democratic', aggregateHostility: 0 };
  }
  return spheres;
}

function getBranch(id: string): ColdBranch {
  const branch = COLD_BRANCHES.find((b) => b.id === id);
  if (!branch) throw new Error(`Branch not found: ${id}`);
  return branch;
}

// ── New Branch IDs ──────────────────────────────────────────────────────────

const PLANETARY_DECONSTRUCTION_IDS = [
  'moon_deconstruction',
  'mercury_deconstruction',
  'venus_deconstruction',
  'mars_deconstruction',
  'jupiter_gas_harvesting',
  'saturn_ring_mining',
  'ice_giant_mining',
];

const FTL_EXPANSION_IDS = [
  'wormhole_discovery',
  'stargate_network',
  'ftl_drive',
  'communist_universe',
  'multiverse_discovery',
];

const BEYOND_TYPE_II_IDS = [
  'type_three',
  'type_four',
  'type_five_plus',
];

const ALL_NEW_IDS = [...PLANETARY_DECONSTRUCTION_IDS, ...FTL_EXPANSION_IDS, ...BEYOND_TYPE_II_IDS];

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Planetary deconstruction branches', () => {
  it('all 7 planetary deconstruction branches exist in catalog', () => {
    for (const id of PLANETARY_DECONSTRUCTION_IDS) {
      expect(COLD_BRANCHES.find((b) => b.id === id)).toBeDefined();
    }
  });

  it('moon deconstruction requires techLevel > 0.85 and year >= 3000', () => {
    const branch = getBranch('moon_deconstruction');
    expect(branch.conditions.worldStateConditions?.techLevel?.min).toBe(0.85);
    expect(branch.conditions.yearRange?.min).toBe(3000);
    expect(branch.oneShot).toBe(true);
  });

  it('mercury deconstruction requires techLevel > 0.9', () => {
    const branch = getBranch('mercury_deconstruction');
    expect(branch.conditions.worldStateConditions?.techLevel?.min).toBe(0.9);
  });

  it('venus deconstruction has a crisis definition for evacuation', () => {
    const branch = getBranch('venus_deconstruction');
    expect(branch.effects.crisisDefinition).toBeDefined();
    expect(branch.effects.crisisDefinition!.id).toBe('venus_evacuation');
    expect(branch.effects.crisisDefinition!.severity).toBe('existential');
  });

  it('mars deconstruction creates a new settlement via forced_transfer', () => {
    const branch = getBranch('mars_deconstruction');
    expect(branch.effects.newSettlement).toBe(true);
    expect(branch.effects.relocation).toBeDefined();
    expect(branch.effects.relocation!.type).toBe('forced_transfer');
  });

  it('jupiter gas harvesting creates a new settlement', () => {
    const branch = getBranch('jupiter_gas_harvesting');
    expect(branch.effects.newSettlement).toBe(true);
  });

  it('saturn ring mining creates a new settlement', () => {
    const branch = getBranch('saturn_ring_mining');
    expect(branch.effects.newSettlement).toBe(true);
  });

  it('ice giant mining creates a new settlement', () => {
    const branch = getBranch('ice_giant_mining');
    expect(branch.effects.newSettlement).toBe(true);
  });

  it('deconstruction branches require progressively higher tech levels', () => {
    const techLevels = PLANETARY_DECONSTRUCTION_IDS.map((id) => {
      const branch = getBranch(id);
      return branch.conditions.worldStateConditions?.techLevel?.min ?? 0;
    });
    // Each subsequent branch should require equal or higher tech
    for (let i = 1; i < techLevels.length; i++) {
      expect(techLevels[i]).toBeGreaterThanOrEqual(techLevels[i - 1]);
    }
  });
});

describe('FTL/expansion branches', () => {
  it('all 5 FTL branches exist in catalog', () => {
    for (const id of FTL_EXPANSION_IDS) {
      expect(COLD_BRANCHES.find((b) => b.id === id)).toBeDefined();
    }
  });

  it('wormhole discovery requires techLevel > 0.99', () => {
    const branch = getBranch('wormhole_discovery');
    expect(branch.conditions.worldStateConditions?.techLevel?.min).toBe(0.99);
    expect(branch.oneShot).toBe(true);
  });

  it('stargate network creates interstellar settlement', () => {
    const branch = getBranch('stargate_network');
    expect(branch.effects.newSettlement).toBe(true);
    expect(branch.effects.relocation).toBeDefined();
    expect(branch.effects.relocation!.type).toBe('interstellar');
  });

  it('ftl drive requires extreme tech level (0.995)', () => {
    const branch = getBranch('ftl_drive');
    expect(branch.conditions.worldStateConditions?.techLevel?.min).toBe(0.995);
    expect(branch.conditions.yearRange?.min).toBe(50000);
  });

  it('communist universe requires communist governance in eurasian sphere', () => {
    const branch = getBranch('communist_universe');
    expect(branch.conditions.sphereConditions).toBeDefined();
    expect(branch.conditions.sphereConditions![0].sphere).toBe('eurasian');
    expect(branch.conditions.sphereConditions![0].governance).toBe('communist');
  });

  it('multiverse discovery requires techLevel > 0.999', () => {
    const branch = getBranch('multiverse_discovery');
    expect(branch.conditions.worldStateConditions?.techLevel?.min).toBe(0.999);
    expect(branch.conditions.yearRange?.min).toBe(80000);
  });
});

describe('Beyond Type II branches', () => {
  it('all 3 beyond-Type-II branches exist in catalog', () => {
    for (const id of BEYOND_TYPE_II_IDS) {
      expect(COLD_BRANCHES.find((b) => b.id === id)).toBeDefined();
    }
  });

  it('type_three creates a new settlement (galactic)', () => {
    const branch = getBranch('type_three');
    expect(branch.effects.newSettlement).toBe(true);
  });

  it('type_four does not create a new settlement', () => {
    const branch = getBranch('type_four');
    expect(branch.effects.newSettlement).toBeUndefined();
  });

  it('type_five_plus is the final branch at year 90000+', () => {
    const branch = getBranch('type_five_plus');
    expect(branch.conditions.yearRange?.min).toBe(90000);
    expect(branch.oneShot).toBe(true);
  });
});

describe('New branches — structural integrity', () => {
  it('no duplicate IDs among all branches', () => {
    const ids = COLD_BRANCHES.map((b) => b.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('all new branches have valid narrative fields', () => {
    for (const id of ALL_NEW_IDS) {
      const branch = getBranch(id);
      expect(typeof branch.effects.narrative.pravdaHeadline).toBe('string');
      expect(branch.effects.narrative.pravdaHeadline.length).toBeGreaterThan(0);
      expect(typeof branch.effects.narrative.toast).toBe('string');
      expect(branch.effects.narrative.toast.length).toBeGreaterThan(0);
    }
  });

  it('all new branches have valid pressure spikes (known domains)', () => {
    const validDomains: string[] = [
      'food', 'morale', 'loyalty', 'housing', 'political',
      'power', 'infrastructure', 'demographic', 'health', 'economic',
    ];
    for (const id of ALL_NEW_IDS) {
      const branch = getBranch(id);
      if (branch.effects.pressureSpikes) {
        for (const key of Object.keys(branch.effects.pressureSpikes)) {
          expect(validDomains).toContain(key);
        }
      }
    }
  });

  it('all new branches are oneShot=true', () => {
    for (const id of ALL_NEW_IDS) {
      const branch = getBranch(id);
      expect(branch.oneShot).toBe(true);
    }
  });

  it('all new branches have positive sustainedTicks', () => {
    for (const id of ALL_NEW_IDS) {
      const branch = getBranch(id);
      if (branch.conditions.sustainedTicks !== undefined) {
        expect(branch.conditions.sustainedTicks).toBeGreaterThan(0);
      }
    }
  });
});

describe('New branches — activation via evaluateBranches()', () => {
  it('moon deconstruction activates at year 3000 with techLevel 0.9', () => {
    const branch = getBranch('moon_deconstruction');
    const worldState = makeWorldState({ techLevel: 0.9 });
    const pressureState = makePressureState();
    const spheres = makeSpheres();
    const activated = new Set<string>();
    const trackers = new Map<string, BranchTracker>();

    const requiredTicks = branch.conditions.sustainedTicks ?? 1;
    let result: ColdBranch[] = [];
    for (let i = 0; i < requiredTicks; i++) {
      result = evaluateBranches([branch], activated, trackers, pressureState, worldState, 3500, spheres);
    }
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('moon_deconstruction');
  });

  it('moon deconstruction does NOT activate at year 2000', () => {
    const branch = getBranch('moon_deconstruction');
    const worldState = makeWorldState({ techLevel: 0.95 });
    const pressureState = makePressureState();
    const spheres = makeSpheres();
    const activated = new Set<string>();
    const trackers = new Map<string, BranchTracker>();

    const requiredTicks = branch.conditions.sustainedTicks ?? 1;
    let result: ColdBranch[] = [];
    for (let i = 0; i < requiredTicks; i++) {
      result = evaluateBranches([branch], activated, trackers, pressureState, worldState, 2000, spheres);
    }
    expect(result).toHaveLength(0);
  });

  it('wormhole discovery activates with extreme tech at year 30000+', () => {
    const branch = getBranch('wormhole_discovery');
    const worldState = makeWorldState({ techLevel: 0.995 });
    const pressureState = makePressureState();
    const spheres = makeSpheres();
    const activated = new Set<string>();
    const trackers = new Map<string, BranchTracker>();

    const result = evaluateBranches([branch], activated, trackers, pressureState, worldState, 35000, spheres);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('wormhole_discovery');
  });

  it('communist universe requires communist governance in eurasian sphere', () => {
    const branch = getBranch('communist_universe');
    const worldState = makeWorldState({ techLevel: 0.999 });
    const pressureState = makePressureState();
    const activated = new Set<string>();
    const trackers = new Map<string, BranchTracker>();

    // Without communist governance — should not activate
    const spheresDemocratic = makeSpheres();
    const requiredTicks = branch.conditions.sustainedTicks ?? 1;
    let result: ColdBranch[] = [];
    for (let i = 0; i < requiredTicks; i++) {
      result = evaluateBranches([branch], activated, trackers, pressureState, worldState, 60000, spheresDemocratic);
    }
    expect(result).toHaveLength(0);

    // With communist governance — should activate
    const spheresCommunist = makeSpheres({
      eurasian: { governance: 'communist', aggregateHostility: 0 },
    });
    trackers.clear();
    activated.clear();
    for (let i = 0; i < requiredTicks; i++) {
      result = evaluateBranches([branch], activated, trackers, pressureState, worldState, 60000, spheresCommunist);
    }
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('communist_universe');
  });

  it('oneShot branches do not re-activate', () => {
    const branch = getBranch('moon_deconstruction');
    const worldState = makeWorldState({ techLevel: 0.95 });
    const pressureState = makePressureState();
    const spheres = makeSpheres();
    const activated = new Set<string>();
    const trackers = new Map<string, BranchTracker>();

    // Activate once
    const requiredTicks = branch.conditions.sustainedTicks ?? 1;
    for (let i = 0; i < requiredTicks; i++) {
      evaluateBranches([branch], activated, trackers, pressureState, worldState, 4000, spheres);
    }
    expect(activated.has('moon_deconstruction')).toBe(true);

    // Try again — should NOT activate
    const result = evaluateBranches([branch], activated, trackers, pressureState, worldState, 4000, spheres);
    expect(result).toHaveLength(0);
  });
});

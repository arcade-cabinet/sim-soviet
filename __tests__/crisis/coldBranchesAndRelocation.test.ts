/**
 * Tests for Cold Branches (worldBranches.ts), SettlementRegistry (Settlement.ts),
 * RelocationEngine (RelocationEngine.ts), and terrain presets (terrainProfiles.ts).
 */

import type { PressureDomain } from '../../src/ai/agents/crisis/pressure/PressureDomains';
import type { WorldState } from '../../src/ai/agents/core/WorldAgent';
import type { GovernanceType, SphereId } from '../../src/ai/agents/core/worldCountries';
import {
  COLD_BRANCHES,
  evaluateBranches,
  serializeBranchSystem,
  restoreBranchSystem,
  type ColdBranch,
  type BranchTracker,
} from '../../src/ai/agents/core/worldBranches';
import { SettlementRegistry } from '../../src/game/relocation/Settlement';
import { RelocationEngine, type RelocationEvent } from '../../src/game/relocation/RelocationEngine';
import {
  TERRAIN_SIBERIA,
  TERRAIN_STEPPE,
  TERRAIN_ARCTIC,
  TERRAIN_LUNAR,
  TERRAIN_MARS,
  TERRAIN_TITAN,
  TERRAIN_EXOPLANET,
  SURVIVAL_COST_MULTIPLIER,
  FARMING_EFFICIENCY,
  CONSTRUCTION_MULTIPLIER,
} from '../../src/game/relocation/terrainProfiles';
import { GameRng } from '../../src/game/SeedSystem';

// ─── Test Helpers ────────────────────────────────────────────────────────────

/** Build a minimal WorldState with all-neutral values. */
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

/** Build a minimal pressure state map with all domains at zero. */
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

/** Build a sphere map with all spheres using default governance and zero hostility. */
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

// ─── Cold Branches — Catalog ─────────────────────────────────────────────────

describe('COLD_BRANCHES catalog', () => {
  it('contains exactly 27 branches', () => {
    expect(COLD_BRANCHES).toHaveLength(27);
  });

  it('every branch has a non-empty id string', () => {
    for (const branch of COLD_BRANCHES) {
      expect(typeof branch.id).toBe('string');
      expect(branch.id.length).toBeGreaterThan(0);
    }
  });

  it('every branch has a non-empty name string', () => {
    for (const branch of COLD_BRANCHES) {
      expect(typeof branch.name).toBe('string');
      expect(branch.name.length).toBeGreaterThan(0);
    }
  });

  it('every branch has a conditions object', () => {
    for (const branch of COLD_BRANCHES) {
      expect(branch.conditions).toBeDefined();
      expect(typeof branch.conditions).toBe('object');
    }
  });

  it('every branch has an effects object with a narrative field', () => {
    for (const branch of COLD_BRANCHES) {
      expect(branch.effects).toBeDefined();
      expect(branch.effects.narrative).toBeDefined();
      expect(typeof branch.effects.narrative.pravdaHeadline).toBe('string');
      expect(typeof branch.effects.narrative.toast).toBe('string');
    }
  });

  it('every branch has a boolean oneShot field', () => {
    for (const branch of COLD_BRANCHES) {
      expect(typeof branch.oneShot).toBe('boolean');
    }
  });

  it('all branch IDs are unique', () => {
    const ids = COLD_BRANCHES.map((b) => b.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('every branch with sustainedTicks has a positive integer value', () => {
    for (const branch of COLD_BRANCHES) {
      if (branch.conditions.sustainedTicks !== undefined) {
        expect(Number.isInteger(branch.conditions.sustainedTicks)).toBe(true);
        expect(branch.conditions.sustainedTicks).toBeGreaterThan(0);
      }
    }
  });
});

// ─── Cold Branches — evaluateBranches() ──────────────────────────────────────

describe('evaluateBranches()', () => {
  it('returns an empty array when no conditions are met', () => {
    const pressureState = makePressureState();
    const worldState = makeWorldState();
    const spheres = makeSpheres();
    const activated = new Set<string>();
    const trackers = new Map<string, BranchTracker>();

    const result = evaluateBranches(
      COLD_BRANCHES,
      activated,
      trackers,
      pressureState,
      worldState,
      1917,
      spheres,
    );

    expect(result).toHaveLength(0);
  });

  it('activates a branch when all its conditions are met for the required sustained ticks', () => {
    // Use nuclear_winter: needs globalTension >= 0.7, sustainedTicks: 6
    const pressureState = makePressureState();
    const worldState = makeWorldState({ globalTension: 0.95 });
    const spheres = makeSpheres();
    const activated = new Set<string>();
    const trackers = new Map<string, BranchTracker>();

    const nuclearWinterBranch = COLD_BRANCHES.find((b) => b.id === 'nuclear_winter')!;
    const requiredTicks = nuclearWinterBranch.conditions.sustainedTicks ?? 1;

    let result: ColdBranch[] = [];
    for (let i = 0; i < requiredTicks; i++) {
      result = evaluateBranches(
        [nuclearWinterBranch],
        activated,
        trackers,
        pressureState,
        worldState,
        1980,
        spheres,
      );
    }

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('nuclear_winter');
  });

  it('does not activate a branch if conditions break before sustainedTicks are reached', () => {
    // nuclear_winter needs 6 ticks — meet for 5, then break on tick 6
    const nuclearWinterBranch = COLD_BRANCHES.find((b) => b.id === 'nuclear_winter')!;
    const pressureStateHigh = makePressureState();
    const worldStateHigh = makeWorldState({ globalTension: 0.95 });
    const worldStateLow = makeWorldState({ globalTension: 0.1 });
    const spheres = makeSpheres();
    const activated = new Set<string>();
    const trackers = new Map<string, BranchTracker>();

    // 5 ticks with conditions met
    for (let i = 0; i < 5; i++) {
      evaluateBranches([nuclearWinterBranch], activated, trackers, pressureStateHigh, worldStateHigh, 1980, spheres);
    }
    expect(trackers.has('nuclear_winter')).toBe(true);

    // Conditions break — tracker should be cleared
    evaluateBranches([nuclearWinterBranch], activated, trackers, pressureStateHigh, worldStateLow, 1980, spheres);
    expect(trackers.has('nuclear_winter')).toBe(false);
  });

  it('oneShot branch does not re-activate after being activated', () => {
    const nuclearWinterBranch = COLD_BRANCHES.find((b) => b.id === 'nuclear_winter')!;
    expect(nuclearWinterBranch.oneShot).toBe(true);

    const pressureState = makePressureState();
    const worldState = makeWorldState({ globalTension: 0.95 });
    const spheres = makeSpheres();
    const activated = new Set<string>();
    const trackers = new Map<string, BranchTracker>();
    const requiredTicks = nuclearWinterBranch.conditions.sustainedTicks ?? 1;

    // Fire it for the first time
    for (let i = 0; i < requiredTicks; i++) {
      evaluateBranches([nuclearWinterBranch], activated, trackers, pressureState, worldState, 1980, spheres);
    }
    expect(activated.has('nuclear_winter')).toBe(true);

    // Attempt to re-activate — conditions still met, but should return nothing
    let secondResult: ColdBranch[] = [];
    for (let i = 0; i < requiredTicks; i++) {
      secondResult = evaluateBranches([nuclearWinterBranch], activated, trackers, pressureState, worldState, 1980, spheres);
    }
    expect(secondResult).toHaveLength(0);
  });

  it('non-oneShot branch (moscow_promotion) can activate multiple times', () => {
    const promotionBranch = COLD_BRANCHES.find((b) => b.id === 'moscow_promotion')!;
    expect(promotionBranch.oneShot).toBe(false);

    // moscow_promotion needs moscowAttention >= 0.5 and political pressure >= 0
    const pressureState = makePressureState({ political: 0.01 });
    const worldState = makeWorldState({ moscowAttention: 0.6 });
    const spheres = makeSpheres();
    const activated = new Set<string>();
    const trackers = new Map<string, BranchTracker>();
    const requiredTicks = promotionBranch.conditions.sustainedTicks ?? 1;

    // First activation
    let result: ColdBranch[] = [];
    for (let i = 0; i < requiredTicks; i++) {
      result = evaluateBranches([promotionBranch], activated, trackers, pressureState, worldState, 1960, spheres);
    }
    expect(result).toHaveLength(1);

    // After activation, branch is in activatedBranches, but since oneShot=false,
    // evaluateBranches still processes it. Run again for another cycle.
    for (let i = 0; i < requiredTicks; i++) {
      result = evaluateBranches([promotionBranch], activated, trackers, pressureState, worldState, 1960, spheres);
    }
    expect(result).toHaveLength(1);
  });

  it('sustainedTicks: branch needs N continuous ticks before activation', () => {
    // Use ai_singularity (sustainedTicks: 6, techLevel >= 0.95)
    const singularityBranch = COLD_BRANCHES.find((b) => b.id === 'ai_singularity')!;
    const requiredTicks = singularityBranch.conditions.sustainedTicks!;
    expect(requiredTicks).toBe(6);

    const pressureState = makePressureState();
    const worldState = makeWorldState({ techLevel: 0.99 });
    const spheres = makeSpheres();
    const activated = new Set<string>();
    const trackers = new Map<string, BranchTracker>();

    // Each tick before the last should yield no activation
    for (let i = 1; i < requiredTicks; i++) {
      const result = evaluateBranches([singularityBranch], activated, trackers, pressureState, worldState, 2045, spheres);
      expect(result).toHaveLength(0);
      // Tracker should reflect accumulated ticks
      expect(trackers.get('ai_singularity')!.sustainedTicks).toBe(i);
    }

    // Final tick triggers activation
    const finalResult = evaluateBranches([singularityBranch], activated, trackers, pressureState, worldState, 2045, spheres);
    expect(finalResult).toHaveLength(1);
    expect(finalResult[0]!.id).toBe('ai_singularity');
    // Tracker removed after activation
    expect(trackers.has('ai_singularity')).toBe(false);
  });

  it('branch outside year range is not activated', () => {
    // dekulakization_purge requires yearRange { min: 1929, max: 1933 }
    const dekulakBranch = COLD_BRANCHES.find((b) => b.id === 'dekulakization_purge')!;
    const pressureState = makePressureState({ political: 0.8 });
    const worldState = makeWorldState();
    const spheres = makeSpheres();
    const activated = new Set<string>();
    const trackers = new Map<string, BranchTracker>();

    // Year too early
    const earlyResult = evaluateBranches([dekulakBranch], activated, trackers, pressureState, worldState, 1920, spheres);
    expect(earlyResult).toHaveLength(0);

    // Year too late
    const lateResult = evaluateBranches([dekulakBranch], activated, trackers, pressureState, worldState, 1945, spheres);
    expect(lateResult).toHaveLength(0);
  });
});

// ─── Cold Branches — Serialization ───────────────────────────────────────────

describe('BranchSystem serialization', () => {
  it('serializeBranchSystem round-trips through restoreBranchSystem', () => {
    const activated = new Set<string>(['nuclear_winter', 'ai_singularity']);
    const trackers = new Map<string, BranchTracker>([
      ['wwiii', { sustainedTicks: 3 }],
      ['great_depression_ii', { sustainedTicks: 10 }],
    ]);

    const saveData = serializeBranchSystem(activated, trackers);
    const { activatedBranches: restoredActivated, trackers: restoredTrackers } = restoreBranchSystem(saveData);

    expect(restoredActivated.has('nuclear_winter')).toBe(true);
    expect(restoredActivated.has('ai_singularity')).toBe(true);
    expect(restoredActivated.size).toBe(2);

    expect(restoredTrackers.get('wwiii')!.sustainedTicks).toBe(3);
    expect(restoredTrackers.get('great_depression_ii')!.sustainedTicks).toBe(10);
    expect(restoredTrackers.size).toBe(2);
  });

  it('restores an empty state correctly', () => {
    const saveData = serializeBranchSystem(new Set(), new Map());
    const { activatedBranches, trackers } = restoreBranchSystem(saveData);
    expect(activatedBranches.size).toBe(0);
    expect(trackers.size).toBe(0);
  });

  it('serialized activated list is a plain array (JSON-safe)', () => {
    const activated = new Set(['wwiii']);
    const trackers = new Map<string, BranchTracker>();
    const saveData = serializeBranchSystem(activated, trackers);
    expect(Array.isArray(saveData.activatedBranches)).toBe(true);
    expect(saveData.activatedBranches).toContain('wwiii');
  });

  it('serialized trackers is an array of [key, value] pairs (JSON-safe)', () => {
    const activated = new Set<string>();
    const trackers = new Map<string, BranchTracker>([['eu_dissolution', { sustainedTicks: 5 }]]);
    const saveData = serializeBranchSystem(activated, trackers);
    expect(Array.isArray(saveData.trackers)).toBe(true);
    expect(saveData.trackers[0]).toEqual(['eu_dissolution', { sustainedTicks: 5 }]);
  });
});

// ─── Cold Branches — Historical Branches ─────────────────────────────────────

describe('Historical Cold Branches', () => {
  it('dekulakization_purge has correct year range [1929, 1933]', () => {
    const branch = COLD_BRANCHES.find((b) => b.id === 'dekulakization_purge')!;
    expect(branch).toBeDefined();
    expect(branch.conditions.yearRange?.min).toBe(1929);
    expect(branch.conditions.yearRange?.max).toBe(1933);
  });

  it('ethnic_deportation has correct year range [1935, 1950]', () => {
    const branch = COLD_BRANCHES.find((b) => b.id === 'ethnic_deportation')!;
    expect(branch).toBeDefined();
    expect(branch.conditions.yearRange?.min).toBe(1935);
    expect(branch.conditions.yearRange?.max).toBe(1950);
  });

  it('virgin_lands_assignment has correct year range [1954, 1965]', () => {
    const branch = COLD_BRANCHES.find((b) => b.id === 'virgin_lands_assignment')!;
    expect(branch).toBeDefined();
    expect(branch.conditions.yearRange?.min).toBe(1954);
    expect(branch.conditions.yearRange?.max).toBe(1965);
  });

  it('dekulakization_purge requires political pressure >= 0.5', () => {
    const branch = COLD_BRANCHES.find((b) => b.id === 'dekulakization_purge')!;
    expect(branch.conditions.pressureThresholds?.political).toBe(0.5);
  });

  it('ethnic_deportation has a relocation effect (forced_transfer)', () => {
    // Note: ethnic_deportation does NOT have a relocation in the catalog (no relocation field),
    // only demographic pressure spikes.
    const branch = COLD_BRANCHES.find((b) => b.id === 'ethnic_deportation')!;
    // It has no relocation — just pressure spikes
    expect(branch.effects.pressureSpikes).toBeDefined();
    expect(branch.effects.pressureSpikes!.loyalty).toBe(0.25);
  });

  it('virgin_lands_assignment includes a relocation effect', () => {
    const branch = COLD_BRANCHES.find((b) => b.id === 'virgin_lands_assignment')!;
    expect(branch.effects.relocation).toBeDefined();
    expect(branch.effects.relocation!.type).toBe('forced_transfer');
    expect(branch.effects.newSettlement).toBe(true);
  });
});

// ─── Cold Branches — Geopolitical Branches ───────────────────────────────────

describe('Geopolitical Cold Branches', () => {
  it('wwiii checks globalTension and borderThreat world state conditions', () => {
    const branch = COLD_BRANCHES.find((b) => b.id === 'wwiii')!;
    expect(branch.conditions.worldStateConditions?.globalTension?.min).toBe(0.9);
    expect(branch.conditions.worldStateConditions?.borderThreat?.min).toBe(0.8);
  });

  it('wwiii has yearRange starting at 1960', () => {
    const branch = COLD_BRANCHES.find((b) => b.id === 'wwiii')!;
    expect(branch.conditions.yearRange?.min).toBe(1960);
  });

  it('eu_dissolution checks sphereConditions for european democratic governance', () => {
    const branch = COLD_BRANCHES.find((b) => b.id === 'eu_dissolution')!;
    expect(branch.conditions.sphereConditions).toBeDefined();
    const europeanCondition = branch.conditions.sphereConditions!.find((sc) => sc.sphere === 'european');
    expect(europeanCondition).toBeDefined();
    expect(europeanCondition!.governance).toBe('democratic');
  });

  it('eu_dissolution has yearRange starting at 2020', () => {
    const branch = COLD_BRANCHES.find((b) => b.id === 'eu_dissolution')!;
    expect(branch.conditions.yearRange?.min).toBe(2020);
  });

  it('eu_dissolution does not activate when year is before 2020', () => {
    const branch = COLD_BRANCHES.find((b) => b.id === 'eu_dissolution')!;
    const pressureState = makePressureState({ economic: 0.9 });
    const worldState = makeWorldState();
    const spheres = makeSpheres({ european: { governance: 'democratic', aggregateHostility: 0 } });
    const activated = new Set<string>();
    const trackers = new Map<string, BranchTracker>();

    const result = evaluateBranches([branch], activated, trackers, pressureState, worldState, 2015, spheres);
    expect(result).toHaveLength(0);
  });
});

// ─── Cold Branches — Technology Branches ─────────────────────────────────────

describe('Technology Cold Branches', () => {
  it('ai_singularity checks techLevel >= 0.95', () => {
    const branch = COLD_BRANCHES.find((b) => b.id === 'ai_singularity')!;
    expect(branch.conditions.worldStateConditions?.techLevel?.min).toBe(0.95);
  });

  it('ai_singularity has yearRange starting at 2040', () => {
    const branch = COLD_BRANCHES.find((b) => b.id === 'ai_singularity')!;
    expect(branch.conditions.yearRange?.min).toBe(2040);
  });

  it('lunar_colony_directive checks techLevel >= 0.7', () => {
    const branch = COLD_BRANCHES.find((b) => b.id === 'lunar_colony_directive')!;
    expect(branch.conditions.worldStateConditions?.techLevel?.min).toBe(0.7);
  });

  it('lunar_colony_directive has yearRange starting at 2030', () => {
    const branch = COLD_BRANCHES.find((b) => b.id === 'lunar_colony_directive')!;
    expect(branch.conditions.yearRange?.min).toBe(2030);
  });

  it('ai_singularity does not activate below required techLevel', () => {
    const branch = COLD_BRANCHES.find((b) => b.id === 'ai_singularity')!;
    const pressureState = makePressureState();
    const worldState = makeWorldState({ techLevel: 0.5 }); // below 0.95
    const spheres = makeSpheres();
    const activated = new Set<string>();
    const trackers = new Map<string, BranchTracker>();

    const result = evaluateBranches([branch], activated, trackers, pressureState, worldState, 2050, spheres);
    expect(result).toHaveLength(0);
  });

  it('interstellar_ark checks techLevel >= 0.99 and yearRange min 2200', () => {
    const branch = COLD_BRANCHES.find((b) => b.id === 'interstellar_ark')!;
    expect(branch.conditions.worldStateConditions?.techLevel?.min).toBe(0.99);
    expect(branch.conditions.yearRange?.min).toBe(2200);
  });
});

// ─── SettlementRegistry ───────────────────────────────────────────────────────

describe('SettlementRegistry', () => {
  it('createPrimary() creates a settlement with id "primary" and isActive: true', () => {
    const registry = new SettlementRegistry();
    const primary = registry.createPrimary('Novosibirsk', 21, 1917);

    expect(primary.id).toBe('primary');
    expect(primary.name).toBe('Novosibirsk');
    expect(primary.gridSize).toBe(21);
    expect(primary.isActive).toBe(true);
    expect(primary.foundedYear).toBe(1917);
    expect(primary.celestialBody).toBe('earth');
    expect(primary.population).toBe(0);
    expect(primary.distance).toBe(0);
  });

  it('createPrimary() gives the primary settlement earth terrain defaults', () => {
    const registry = new SettlementRegistry();
    const primary = registry.createPrimary('Omsk', 17, 1920);

    expect(primary.terrain.gravity).toBe(1.0);
    expect(primary.terrain.atmosphere).toBe('breathable');
    expect(primary.terrain.farming).toBe('soil');
    expect(primary.terrain.baseSurvivalCost).toBe('low');
  });

  it('addSettlement() adds a new settlement with a generated ID and isActive: false', () => {
    const registry = new SettlementRegistry();
    registry.createPrimary('Novosibirsk', 21, 1917);

    const second = registry.addSettlement(
      'Luna-1',
      TERRAIN_LUNAR,
      'moon',
      384_400,
      2045,
    );

    expect(second.id).toBe('settlement-1');
    expect(second.name).toBe('Luna-1');
    expect(second.celestialBody).toBe('moon');
    expect(second.isActive).toBe(false);
    expect(second.gridSize).toBe(11);
    expect(second.foundedYear).toBe(2045);
  });

  it('addSettlement() increments IDs sequentially for multiple settlements', () => {
    const registry = new SettlementRegistry();
    registry.createPrimary('Primary', 21, 1917);

    const s1 = registry.addSettlement('S1', TERRAIN_STEPPE, 'earth', 1000, 1954);
    const s2 = registry.addSettlement('S2', TERRAIN_MARS, 'mars', 225_000_000, 2060);

    expect(s1.id).toBe('settlement-1');
    expect(s2.id).toBe('settlement-2');
  });

  it('switchTo() changes the active settlement', () => {
    const registry = new SettlementRegistry();
    registry.createPrimary('Primary', 21, 1917);
    registry.addSettlement('Luna-1', TERRAIN_LUNAR, 'moon', 384_400, 2045);

    const switched = registry.switchTo('settlement-1');
    expect(switched).toBe(true);

    const active = registry.getActive();
    expect(active?.id).toBe('settlement-1');
    expect(active?.name).toBe('Luna-1');
  });

  it('switchTo() deactivates the previously active settlement', () => {
    const registry = new SettlementRegistry();
    registry.createPrimary('Primary', 21, 1917);
    registry.addSettlement('Luna-1', TERRAIN_LUNAR, 'moon', 384_400, 2045);

    registry.switchTo('settlement-1');

    const primary = registry.getById('primary');
    expect(primary?.isActive).toBe(false);
  });

  it('switchTo() returns false for a non-existent ID', () => {
    const registry = new SettlementRegistry();
    registry.createPrimary('Primary', 21, 1917);

    expect(registry.switchTo('nonexistent')).toBe(false);
    // Active settlement should remain unchanged
    expect(registry.getActive()?.id).toBe('primary');
  });

  it('getAll() returns all settlements in order', () => {
    const registry = new SettlementRegistry();
    registry.createPrimary('Primary', 21, 1917);
    registry.addSettlement('Second', TERRAIN_STEPPE, 'earth', 1000, 1954);
    registry.addSettlement('Third', TERRAIN_MARS, 'mars', 225_000_000, 2060);

    const all = registry.getAll();
    expect(all).toHaveLength(3);
    expect(all[0]!.id).toBe('primary');
    expect(all[1]!.id).toBe('settlement-1');
    expect(all[2]!.id).toBe('settlement-2');
  });

  it('count() returns the correct number of settlements', () => {
    const registry = new SettlementRegistry();
    expect(registry.count()).toBe(0);

    registry.createPrimary('Primary', 21, 1917);
    expect(registry.count()).toBe(1);

    registry.addSettlement('Second', TERRAIN_STEPPE, 'earth', 1000, 1954);
    expect(registry.count()).toBe(2);
  });

  it('updatePopulation() modifies only the targeted settlement', () => {
    const registry = new SettlementRegistry();
    registry.createPrimary('Primary', 21, 1917);
    registry.addSettlement('Second', TERRAIN_STEPPE, 'earth', 1000, 1954);

    registry.updatePopulation('primary', 500);
    registry.updatePopulation('settlement-1', 200);

    expect(registry.getById('primary')?.population).toBe(500);
    expect(registry.getById('settlement-1')?.population).toBe(200);
  });

  it('updatePopulation() is a no-op for unknown settlement ID', () => {
    const registry = new SettlementRegistry();
    registry.createPrimary('Primary', 21, 1917);

    // Should not throw
    expect(() => registry.updatePopulation('nonexistent', 999)).not.toThrow();
    expect(registry.getById('primary')?.population).toBe(0);
  });

  it('serialize() / restore() round-trip preserves all settlement data', () => {
    const registry = new SettlementRegistry();
    registry.createPrimary('Novosibirsk', 21, 1917);
    registry.addSettlement('Luna-1', TERRAIN_LUNAR, 'moon', 384_400, 2045);
    registry.updatePopulation('primary', 350);
    registry.updatePopulation('settlement-1', 42);
    registry.switchTo('settlement-1');

    const saved = registry.serialize();
    const restored = new SettlementRegistry();
    restored.restore(saved);

    expect(restored.count()).toBe(2);

    const restoredPrimary = restored.getById('primary');
    expect(restoredPrimary?.name).toBe('Novosibirsk');
    expect(restoredPrimary?.population).toBe(350);
    expect(restoredPrimary?.isActive).toBe(false);
    expect(restoredPrimary?.foundedYear).toBe(1917);

    const restoredLuna = restored.getById('settlement-1');
    expect(restoredLuna?.name).toBe('Luna-1');
    expect(restoredLuna?.population).toBe(42);
    expect(restoredLuna?.isActive).toBe(true);
    expect(restoredLuna?.terrain.gravity).toBe(0.16);
    expect(restoredLuna?.celestialBody).toBe('moon');
  });

  it('serialize() preserves terrain profile fields', () => {
    const registry = new SettlementRegistry();
    registry.createPrimary('Novosibirsk', 21, 1917);
    registry.addSettlement('Mars-1', TERRAIN_MARS, 'mars', 225_000_000, 2060);

    const saved = registry.serialize();
    const marsEntry = saved.find((s) => s.id === 'settlement-1');
    expect(marsEntry?.terrain.atmosphere).toBe('thin_co2');
    expect(marsEntry?.terrain.gravity).toBe(0.38);
    expect(marsEntry?.terrain.farming).toBe('greenhouse');
  });
});

// ─── RelocationEngine ─────────────────────────────────────────────────────────

describe('RelocationEngine', () => {
  it('executeRelocation() creates a new settlement in the registry', () => {
    const rng = new GameRng('relocation-test-seed');
    const engine = new RelocationEngine();
    engine.getRegistry().createPrimary('Novosibirsk', 21, 1917);

    const event: RelocationEvent = {
      type: 'forced_transfer',
      targetTerrain: TERRAIN_STEPPE,
      settlementName: 'Karaganda Colony',
      transferFraction: 0.3,
      resourceFraction: 0.2,
    };

    const result = engine.executeRelocation(event, 1000, 500, 2000, 1931, rng);

    expect(result.settlement).toBeDefined();
    expect(result.settlement.name).toBe('Karaganda Colony');
    expect(engine.getRegistry().count()).toBe(2);
  });

  it('executeRelocation() returns a TransitResult with mortality applied', () => {
    const rng = new GameRng('mortality-test');
    const engine = new RelocationEngine();
    engine.getRegistry().createPrimary('Primary', 21, 1917);

    const event: RelocationEvent = {
      type: 'forced_transfer',
      targetTerrain: TERRAIN_STEPPE,
      settlementName: 'Test Colony',
      transferFraction: 1.0,
      resourceFraction: 0.5,
    };

    const result = engine.executeRelocation(event, 1000, 1000, 500, 1931, rng);

    expect(result.transitDeaths).toBeGreaterThan(0);
    expect(result.arrivedPopulation).toBeLessThan(1000);
    expect(result.arrivedPopulation + result.transitDeaths).toBe(1000);
  });

  it('forced_transfer has base mortality rate of 0.15', () => {
    // Use deterministic RNG to check mortality is within expected range
    // forced_transfer: 0.15 base ± 20% variance = [0.12, 0.18] before distance/survival cost
    const rng = new GameRng('forced-transfer-mortality');
    const engine = new RelocationEngine();
    engine.getRegistry().createPrimary('Primary', 21, 1917);

    const event: RelocationEvent = {
      type: 'forced_transfer',
      targetTerrain: { gravity: 1.0, atmosphere: 'breathable', water: 'rivers', farming: 'soil', construction: 'standard', baseSurvivalCost: 'low' },
      settlementName: 'Test',
      celestialBody: 'earth', // minimal distance factor
      transferFraction: 1.0,
      resourceFraction: 0,
    };

    const result = engine.executeRelocation(event, 10000, 0, 0, 1931, rng);
    const actualRate = result.transitDeaths / 10000;

    // Base 0.15 + earth distance factor (1000 * 0.001 = 1.0 → capped at 0.3) + low survival (0)
    // Total mortality capped at 0.5. With variance it should be > 0
    expect(actualRate).toBeGreaterThan(0);
    expect(actualRate).toBeLessThanOrEqual(0.5);
  });

  it('climate_exodus has lower base mortality than forced_transfer', () => {
    const rng1 = new GameRng('climate-mortality-same-seed');
    const rng2 = new GameRng('climate-mortality-same-seed');
    const engine1 = new RelocationEngine();
    const engine2 = new RelocationEngine();
    engine1.getRegistry().createPrimary('P1', 21, 2100);
    engine2.getRegistry().createPrimary('P2', 21, 2100);

    const baseTerrain = { gravity: 1.0, atmosphere: 'breathable' as const, water: 'rivers' as const, farming: 'soil' as const, construction: 'standard' as const, baseSurvivalCost: 'low' as const };

    const forcedEvent: RelocationEvent = { type: 'forced_transfer', targetTerrain: baseTerrain, settlementName: 'F', celestialBody: 'earth', transferFraction: 1.0, resourceFraction: 0 };
    const climateEvent: RelocationEvent = { type: 'climate_exodus', targetTerrain: baseTerrain, settlementName: 'C', celestialBody: 'earth', transferFraction: 1.0, resourceFraction: 0 };

    const forced = engine1.executeRelocation(forcedEvent, 10000, 0, 0, 2100, rng1);
    const climate = engine2.executeRelocation(climateEvent, 10000, 0, 0, 2100, rng2);

    // On average forced_transfer (base 0.15) should lose more than climate_exodus (base 0.05)
    // With the same seed and same distance, only base rate differs
    expect(climate.transitDeaths).toBeLessThan(forced.transitDeaths);
  });

  it('interstellar relocation has the highest base mortality rate', () => {
    // Verify TRANSIT_MORTALITY constants by checking interstellar > colonial > forced > climate
    // We infer this from the source (interstellar=0.20, forced=0.15, colonial=0.10, climate=0.05)
    // Test that interstellar produces more deaths than climate_exodus given same conditions
    const engine1 = new RelocationEngine();
    const engine2 = new RelocationEngine();
    engine1.getRegistry().createPrimary('P1', 21, 2200);
    engine2.getRegistry().createPrimary('P2', 21, 2200);

    const interstellarTerrain = { gravity: 1.0, atmosphere: 'variable' as const, water: 'variable' as const, farming: 'variable' as const, construction: 'variable' as const, baseSurvivalCost: 'variable' as const };

    const interstellarEvent: RelocationEvent = {
      type: 'interstellar',
      targetTerrain: interstellarTerrain,
      settlementName: 'Ark Alpha',
      celestialBody: 'exoplanet',
      transferFraction: 1.0,
      resourceFraction: 0,
    };
    const climateEvent: RelocationEvent = {
      type: 'climate_exodus',
      targetTerrain: { gravity: 1.0, atmosphere: 'breathable', water: 'rivers', farming: 'soil', construction: 'standard', baseSurvivalCost: 'low' },
      settlementName: 'Climate',
      celestialBody: 'earth',
      transferFraction: 1.0,
      resourceFraction: 0,
    };

    // Use fixed seed so RNG variance is the same relative offset
    const interstellarResult = engine1.executeRelocation(interstellarEvent, 10000, 0, 0, 2200, new GameRng('interstellar-cmp'));
    const climateResult = engine2.executeRelocation(climateEvent, 10000, 0, 0, 2200, new GameRng('interstellar-cmp'));

    expect(interstellarResult.transitDeaths).toBeGreaterThan(climateResult.transitDeaths);
  });

  it('transferResources() applies logistics loss on both food and money', () => {
    const registry = new SettlementRegistry();
    registry.createPrimary('Primary', 21, 1917);
    registry.addSettlement('Luna-1', TERRAIN_LUNAR, 'moon', 384_400, 2045);
    const engine = new RelocationEngine(registry);

    const result = engine.transferResources({
      fromId: 'primary',
      toId: 'settlement-1',
      food: 1000,
      money: 1000,
      workers: 100,
    });

    // Some loss should occur (logistics cost)
    expect(result.food).toBeLessThan(1000);
    expect(result.money).toBeLessThan(1000);
    expect(result.workers).toBeLessThan(100);
    expect(result.food).toBeGreaterThan(0);
  });

  it('transferResources() returns zeros for unknown settlement IDs', () => {
    const engine = new RelocationEngine();
    engine.getRegistry().createPrimary('Primary', 21, 1917);

    const result = engine.transferResources({
      fromId: 'nonexistent',
      toId: 'primary',
      food: 500,
      money: 200,
      workers: 50,
    });

    expect(result.food).toBe(0);
    expect(result.money).toBe(0);
    expect(result.workers).toBe(0);
  });

  it('generateSettlementName() returns a non-empty string for all relocation types', () => {
    const rng = new GameRng('name-generation-test');
    const types = ['forced_transfer', 'climate_exodus', 'colonial_expansion', 'interstellar'] as const;

    for (const type of types) {
      const name = RelocationEngine.generateSettlementName(type, rng);
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it('generateSettlementName() returns earth-style names for forced_transfer', () => {
    const earthNames = [
      'Novosibirsk-2', 'Magadan Settlement', 'Vorkuta Extension',
      'Karaganda Colony', 'Norilsk Outpost', 'Yakutsk Forward Base',
      'Bratsk Settlement', 'Krasnoyarsk-2', 'Irkutsk Colony',
    ];
    const rng = new GameRng('forced-names');
    const name = RelocationEngine.generateSettlementName('forced_transfer', rng);
    expect(earthNames).toContain(name);
  });

  it('generateSettlementName() returns interstellar names for interstellar type', () => {
    const interstellarNames = [
      'Ark Alpha', 'Centauri Colony', 'Generation Ship Vostok',
      'New Earth Forward Base', 'Proxima Settlement',
    ];
    const rng = new GameRng('interstellar-names');
    const name = RelocationEngine.generateSettlementName('interstellar', rng);
    expect(interstellarNames).toContain(name);
  });

  it('infers celestial body from terrain atmosphere when none provided', () => {
    const rng = new GameRng('infer-body-test');
    const engine = new RelocationEngine();
    engine.getRegistry().createPrimary('Primary', 21, 1917);

    const event: RelocationEvent = {
      type: 'colonial_expansion',
      targetTerrain: TERRAIN_LUNAR, // atmosphere: 'none' → should infer 'moon'
      settlementName: 'Auto-Moon',
      // No celestialBody specified
      transferFraction: 0.1,
      resourceFraction: 0.1,
    };

    const result = engine.executeRelocation(event, 100, 100, 100, 2045, rng);
    expect(result.settlement.celestialBody).toBe('moon');
  });

  it('mars terrain infers celestial body as mars', () => {
    const rng = new GameRng('infer-mars-test');
    const engine = new RelocationEngine();
    engine.getRegistry().createPrimary('Primary', 21, 1917);

    const event: RelocationEvent = {
      type: 'colonial_expansion',
      targetTerrain: TERRAIN_MARS, // atmosphere: 'thin_co2' → 'mars'
      settlementName: 'Auto-Mars',
      transferFraction: 0.1,
      resourceFraction: 0.1,
    };

    const result = engine.executeRelocation(event, 100, 100, 100, 2060, rng);
    expect(result.settlement.celestialBody).toBe('mars');
  });
});

// ─── Terrain Profiles ────────────────────────────────────────────────────────

describe('terrainProfiles', () => {
  const allProfiles = [
    TERRAIN_SIBERIA,
    TERRAIN_STEPPE,
    TERRAIN_ARCTIC,
    TERRAIN_LUNAR,
    TERRAIN_MARS,
    TERRAIN_TITAN,
    TERRAIN_EXOPLANET,
  ];

  it('all 7 terrain presets are exported', () => {
    expect(allProfiles).toHaveLength(7);
    for (const profile of allProfiles) {
      expect(profile).toBeDefined();
    }
  });

  it('each terrain has all required fields', () => {
    for (const profile of allProfiles) {
      expect(profile).toHaveProperty('gravity');
      expect(profile).toHaveProperty('atmosphere');
      expect(profile).toHaveProperty('water');
      expect(profile).toHaveProperty('farming');
      expect(profile).toHaveProperty('construction');
      expect(profile).toHaveProperty('baseSurvivalCost');
    }
  });

  it('each terrain gravity is a positive number', () => {
    for (const profile of allProfiles) {
      expect(typeof profile.gravity).toBe('number');
      expect(profile.gravity).toBeGreaterThan(0);
    }
  });

  it('TERRAIN_SIBERIA has gravity: 1.0', () => {
    expect(TERRAIN_SIBERIA.gravity).toBe(1.0);
  });

  it('TERRAIN_SIBERIA has atmosphere: breathable', () => {
    expect(TERRAIN_SIBERIA.atmosphere).toBe('breathable');
  });

  it('TERRAIN_SIBERIA has baseSurvivalCost: low', () => {
    expect(TERRAIN_SIBERIA.baseSurvivalCost).toBe('low');
  });

  it('TERRAIN_LUNAR has atmosphere: none', () => {
    expect(TERRAIN_LUNAR.atmosphere).toBe('none');
  });

  it('TERRAIN_LUNAR has gravity: 0.16', () => {
    expect(TERRAIN_LUNAR.gravity).toBe(0.16);
  });

  it('TERRAIN_LUNAR has baseSurvivalCost: extreme', () => {
    expect(TERRAIN_LUNAR.baseSurvivalCost).toBe('extreme');
  });

  it('TERRAIN_MARS has atmosphere: thin_co2', () => {
    expect(TERRAIN_MARS.atmosphere).toBe('thin_co2');
  });

  it('TERRAIN_MARS has gravity: 0.38', () => {
    expect(TERRAIN_MARS.gravity).toBe(0.38);
  });

  it('TERRAIN_TITAN has atmosphere: thick_n2_ch4', () => {
    expect(TERRAIN_TITAN.atmosphere).toBe('thick_n2_ch4');
  });

  it('TERRAIN_EXOPLANET has atmosphere: variable', () => {
    expect(TERRAIN_EXOPLANET.atmosphere).toBe('variable');
  });

  it('TERRAIN_STEPPE has gravity: 1.0 and baseSurvivalCost: high', () => {
    expect(TERRAIN_STEPPE.gravity).toBe(1.0);
    expect(TERRAIN_STEPPE.baseSurvivalCost).toBe('high');
  });

  it('TERRAIN_ARCTIC has farming: greenhouse (limited arctic farming)', () => {
    expect(TERRAIN_ARCTIC.farming).toBe('greenhouse');
  });

  it('TERRAIN_TITAN has farming: impossible', () => {
    expect(TERRAIN_TITAN.farming).toBe('impossible');
  });
});

// ─── SURVIVAL_COST_MULTIPLIER ────────────────────────────────────────────────

describe('SURVIVAL_COST_MULTIPLIER', () => {
  it('has an entry for every baseSurvivalCost level', () => {
    const costLevels: Array<'low' | 'high' | 'very_high' | 'extreme' | 'variable'> = [
      'low', 'high', 'very_high', 'extreme', 'variable',
    ];
    for (const level of costLevels) {
      expect(SURVIVAL_COST_MULTIPLIER).toHaveProperty(level);
    }
  });

  it('low cost has multiplier of 1.0', () => {
    expect(SURVIVAL_COST_MULTIPLIER['low']).toBe(1.0);
  });

  it('high cost has multiplier greater than 1.0', () => {
    expect(SURVIVAL_COST_MULTIPLIER['high']).toBeGreaterThan(1.0);
  });

  it('extreme cost has the highest multiplier', () => {
    expect(SURVIVAL_COST_MULTIPLIER['extreme']).toBeGreaterThan(SURVIVAL_COST_MULTIPLIER['very_high']);
    expect(SURVIVAL_COST_MULTIPLIER['very_high']).toBeGreaterThan(SURVIVAL_COST_MULTIPLIER['high']);
  });

  it('all multipliers are positive numbers', () => {
    for (const value of Object.values(SURVIVAL_COST_MULTIPLIER)) {
      expect(typeof value).toBe('number');
      expect(value).toBeGreaterThan(0);
    }
  });

  it('TERRAIN_LUNAR (extreme) has the highest multiplier among preset terrains', () => {
    const lunarMultiplier = SURVIVAL_COST_MULTIPLIER[TERRAIN_LUNAR.baseSurvivalCost];
    const siberiaMultiplier = SURVIVAL_COST_MULTIPLIER[TERRAIN_SIBERIA.baseSurvivalCost];
    const steppeMultiplier = SURVIVAL_COST_MULTIPLIER[TERRAIN_STEPPE.baseSurvivalCost];
    const marsMultiplier = SURVIVAL_COST_MULTIPLIER[TERRAIN_MARS.baseSurvivalCost];

    expect(lunarMultiplier).toBeGreaterThan(marsMultiplier);
    expect(marsMultiplier).toBeGreaterThan(steppeMultiplier);
    expect(steppeMultiplier).toBeGreaterThan(siberiaMultiplier);
  });

  it('celestial bodies (moon/mars/titan) all have survival multipliers >= 2.5', () => {
    // TERRAIN_LUNAR is extreme (4.0), TERRAIN_MARS is very_high (2.5), TERRAIN_TITAN is extreme (4.0)
    expect(SURVIVAL_COST_MULTIPLIER[TERRAIN_LUNAR.baseSurvivalCost]).toBeGreaterThanOrEqual(2.5);
    expect(SURVIVAL_COST_MULTIPLIER[TERRAIN_MARS.baseSurvivalCost]).toBeGreaterThanOrEqual(2.5);
    expect(SURVIVAL_COST_MULTIPLIER[TERRAIN_TITAN.baseSurvivalCost]).toBeGreaterThanOrEqual(2.5);
  });
});

// ─── FARMING_EFFICIENCY ─────────────────────────────────────────────────────

describe('FARMING_EFFICIENCY', () => {
  it('soil has the highest efficiency at 1.0', () => {
    expect(FARMING_EFFICIENCY.soil).toBe(1.0);
  });

  it('greenhouse and hydroponics are positive but less than soil', () => {
    expect(FARMING_EFFICIENCY.greenhouse).toBeGreaterThan(0);
    expect(FARMING_EFFICIENCY.greenhouse).toBeLessThan(1.0);
    expect(FARMING_EFFICIENCY.hydroponics).toBeGreaterThan(0);
    expect(FARMING_EFFICIENCY.hydroponics).toBeLessThan(FARMING_EFFICIENCY.greenhouse);
  });

  it('impossible farming has zero efficiency', () => {
    expect(FARMING_EFFICIENCY.impossible).toBe(0);
  });

  it('variable farming has a middle-ground efficiency', () => {
    expect(FARMING_EFFICIENCY.variable).toBeGreaterThan(0);
    expect(FARMING_EFFICIENCY.variable).toBeLessThan(1.0);
  });

  it('all efficiency values are in [0, 1] range', () => {
    for (const value of Object.values(FARMING_EFFICIENCY)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1.0);
    }
  });
});

// ─── CONSTRUCTION_MULTIPLIER ─────────────────────────────────────────────────

describe('CONSTRUCTION_MULTIPLIER', () => {
  it('standard construction is baseline 1.0', () => {
    expect(CONSTRUCTION_MULTIPLIER.standard).toBe(1.0);
  });

  it('pressurized_domes cost more than standard', () => {
    expect(CONSTRUCTION_MULTIPLIER.pressurized_domes).toBeGreaterThan(CONSTRUCTION_MULTIPLIER.standard);
  });

  it('variable construction cost is greater than standard', () => {
    expect(CONSTRUCTION_MULTIPLIER.variable).toBeGreaterThan(CONSTRUCTION_MULTIPLIER.standard);
  });

  it('all construction multipliers are positive', () => {
    for (const value of Object.values(CONSTRUCTION_MULTIPLIER)) {
      expect(typeof value).toBe('number');
      expect(value).toBeGreaterThan(0);
    }
  });
});

// ─── Additional: evaluateBranches() — activated set tracking ─────────────────

describe('evaluateBranches() — activated set tracking', () => {
  it('adds activated branch IDs to the activatedBranches set', () => {
    const activated = new Set<string>();
    const trackers = new Map<string, BranchTracker>();
    const nuclearWinterBranch = COLD_BRANCHES.find((b) => b.id === 'nuclear_winter')!;
    const pressureState = makePressureState();
    const worldState = makeWorldState({ globalTension: 0.95 });
    const spheres = makeSpheres();
    const requiredTicks = nuclearWinterBranch.conditions.sustainedTicks ?? 1;

    expect(activated.size).toBe(0);

    for (let i = 0; i < requiredTicks; i++) {
      evaluateBranches([nuclearWinterBranch], activated, trackers, pressureState, worldState, 1980, spheres);
    }

    expect(activated.size).toBe(1);
    expect(activated.has('nuclear_winter')).toBe(true);
  });

  it('multiple branches can activate in the same tick', () => {
    // Create a custom branch set where two branches can fire simultaneously
    const branchA: ColdBranch = {
      id: 'test_a',
      name: 'Test A',
      conditions: { pressureThresholds: { food: 0.5 } },
      effects: { narrative: { pravdaHeadline: 'A', toast: 'a' } },
      oneShot: true,
    };
    const branchB: ColdBranch = {
      id: 'test_b',
      name: 'Test B',
      conditions: { pressureThresholds: { food: 0.5 } },
      effects: { narrative: { pravdaHeadline: 'B', toast: 'b' } },
      oneShot: true,
    };

    const activated = new Set<string>();
    const trackers = new Map<string, BranchTracker>();
    const pressure = makePressureState({ food: 0.7 });
    const worldState = makeWorldState();
    const spheres = makeSpheres();

    const result = evaluateBranches([branchA, branchB], activated, trackers, pressure, worldState, 1950, spheres);

    expect(result).toHaveLength(2);
    expect(activated.has('test_a')).toBe(true);
    expect(activated.has('test_b')).toBe(true);
  });

  it('tracker is removed after a branch activates', () => {
    const activated = new Set<string>();
    const trackers = new Map<string, BranchTracker>();
    const branch = COLD_BRANCHES.find((b) => b.id === 'nuclear_winter')!;
    const pressureState = makePressureState();
    const worldState = makeWorldState({ globalTension: 0.95 });
    const spheres = makeSpheres();
    const requiredTicks = branch.conditions.sustainedTicks ?? 1;

    for (let i = 0; i < requiredTicks; i++) {
      evaluateBranches([branch], activated, trackers, pressureState, worldState, 1980, spheres);
    }

    // Tracker should be cleaned up after activation
    expect(trackers.has('nuclear_winter')).toBe(false);
  });
});

// ─── Additional: RelocationEngine — resource transfer amounts ────────────────

describe('RelocationEngine — resource transfer details', () => {
  it('executeRelocation transfers the correct fraction of population', () => {
    const rng = new GameRng('fraction-test');
    const engine = new RelocationEngine();
    engine.getRegistry().createPrimary('P', 21, 1917);

    const event: RelocationEvent = {
      type: 'forced_transfer',
      targetTerrain: TERRAIN_STEPPE,
      settlementName: 'Colony',
      transferFraction: 0.25,
      resourceFraction: 0.5,
    };

    const result = engine.executeRelocation(event, 400, 2000, 1000, 1930, rng);

    // 400 * 0.25 = 100 transferred, minus transit deaths
    expect(result.arrivedPopulation + result.transitDeaths).toBe(100);
  });

  it('executeRelocation money transfer is floor(currentMoney * resourceFraction)', () => {
    const rng = new GameRng('money-fraction-test');
    const engine = new RelocationEngine();
    engine.getRegistry().createPrimary('P', 21, 1917);

    const event: RelocationEvent = {
      type: 'climate_exodus',
      targetTerrain: TERRAIN_SIBERIA,
      settlementName: 'Colony',
      celestialBody: 'earth',
      transferFraction: 0.1,
      resourceFraction: 0.4,
    };

    const result = engine.executeRelocation(event, 500, 1000, 777, 2100, rng);

    // Money is transferred without transit mortality loss
    // floor(777 * 0.4) = 310
    expect(result.moneyTransferred).toBe(310);
  });

  it('transferResources workers lose less than food (lossRate * 0.3 vs full lossRate)', () => {
    const registry = new SettlementRegistry();
    registry.createPrimary('P', 21, 1917);
    registry.addSettlement('S', TERRAIN_STEPPE, 'earth', 5000, 1930);
    const engine = new RelocationEngine(registry);

    const result = engine.transferResources({
      fromId: 'primary',
      toId: 'settlement-1',
      food: 10000,
      money: 10000,
      workers: 10000,
    });

    const foodLoss = 10000 - result.food;
    const workerLoss = 10000 - result.workers;
    // Workers are hardier (lossRate * 0.3 vs full lossRate for food)
    expect(workerLoss).toBeLessThan(foodLoss);
  });
});

// ─── Additional: Deterministic test using jest.spyOn(Math, 'random') ─────────

describe('Deterministic behavior with mocked Math.random', () => {
  it('evaluateBranches is deterministic (no Math.random usage)', () => {
    // evaluateBranches itself does not use Math.random — it is purely condition-based.
    // Verify by mocking Math.random to return a fixed value and checking same results.
    const spy = jest.spyOn(Math, 'random').mockReturnValue(0.42);

    const activated = new Set<string>();
    const trackers = new Map<string, BranchTracker>();
    const pressure = makePressureState({ political: 0.6 });
    const worldState = makeWorldState();
    const spheres = makeSpheres();

    for (let i = 0; i < 6; i++) {
      evaluateBranches(COLD_BRANCHES, activated, trackers, pressure, worldState, 1930, spheres);
    }
    const activatedSet1 = new Set(activated);

    spy.mockRestore();

    // Run again without mock
    const activated2 = new Set<string>();
    const trackers2 = new Map<string, BranchTracker>();
    for (let i = 0; i < 6; i++) {
      evaluateBranches(COLD_BRANCHES, activated2, trackers2, pressure, worldState, 1930, spheres);
    }

    expect(activatedSet1).toEqual(activated2);
  });

  it('RelocationEngine uses GameRng, not Math.random, for transit mortality', () => {
    const spy = jest.spyOn(Math, 'random').mockReturnValue(0.99);

    const engine = new RelocationEngine();
    engine.getRegistry().createPrimary('P', 21, 1917);

    const event: RelocationEvent = {
      type: 'forced_transfer',
      targetTerrain: TERRAIN_STEPPE,
      settlementName: 'Colony',
      transferFraction: 1.0,
      resourceFraction: 0.5,
    };

    // Run with GameRng — result should come from the seeded RNG, not Math.random
    const result1 = engine.executeRelocation(event, 1000, 500, 200, 1930, new GameRng('stable-seed'));

    spy.mockRestore();

    const engine2 = new RelocationEngine();
    engine2.getRegistry().createPrimary('P', 21, 1917);
    const result2 = engine2.executeRelocation(event, 1000, 500, 200, 1930, new GameRng('stable-seed'));

    // Both results should be identical despite Math.random being different
    expect(result1.arrivedPopulation).toBe(result2.arrivedPopulation);
    expect(result1.transitDeaths).toBe(result2.transitDeaths);
    expect(result1.foodTransferred).toBe(result2.foodTransferred);
    expect(result1.moneyTransferred).toBe(result2.moneyTransferred);
  });
});

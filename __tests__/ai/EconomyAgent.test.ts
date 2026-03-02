/**
 * @file EconomyAgent.test.ts
 *
 * Tests for EconomyAgent — planned economy decision-making Yuka agent.
 * Covers trudodni accrual, fondy delivery reliability by era, blat risk
 * thresholds, ration period activation, heating tier transitions, state
 * machine transitions, and serialization round-trip.
 */

import { EconomyAgent } from '../../src/ai/agents/economy/EconomyAgent';
import {
  BLAT_SAFE_THRESHOLD,
  BLAT_ARREST_THRESHOLD,
  TRUDODNI_VALUES,
  MINIMUM_TRUDODNI_BY_DIFFICULTY,
  FONDY_BY_ERA,
  RATION_PERIODS,
} from '../../src/ai/agents/economy/EconomyAgent';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deterministic mock RNG for testing random checks. */
function makeMockRng(sequence: number[]): { random: () => number; pickIndex: (n: number) => number } {
  let idx = 0;
  return {
    random: () => sequence[idx++ % sequence.length] ?? 0,
    pickIndex: (n: number) => Math.floor((sequence[idx++ % sequence.length] ?? 0) * n),
  };
}

// ---------------------------------------------------------------------------
// 1. Instantiation
// ---------------------------------------------------------------------------

describe('EconomyAgent — instantiation', () => {
  it('can be instantiated with name EconomyAgent', () => {
    const agent = new EconomyAgent();
    expect(agent.name).toBe('EconomyAgent');
  });

  it('defaults to revolution era and comrade difficulty', () => {
    const agent = new EconomyAgent();
    expect(agent.getEra()).toBe('revolution');
    expect(agent.getDifficulty()).toBe('comrade');
  });

  it('accepts era and difficulty constructor args', () => {
    const agent = new EconomyAgent('thaw', 'tovarish');
    expect(agent.getEra()).toBe('thaw');
    expect(agent.getDifficulty()).toBe('tovarish');
  });

  it('starts in NormalOperations mode', () => {
    const agent = new EconomyAgent();
    expect(agent.getMode()).toBe('NormalOperations');
  });
});

// ---------------------------------------------------------------------------
// 2. Trudodni accrual
// ---------------------------------------------------------------------------

describe('EconomyAgent — trudodni accrual', () => {
  it('accrues trudodni for known building types', () => {
    const agent = new EconomyAgent();
    agent.recordTrudodni('b1', 'factory', 10);
    const state = agent.getTrudodni();
    // factory rate = 1.2 per worker × 10 workers = 12
    expect(state.totalContributed).toBeCloseTo(12);
    expect(state.perBuilding.get('b1')).toBeCloseTo(12);
  });

  it('uses DEFAULT_TRUDODNI (0.5) for unknown building types', () => {
    const agent = new EconomyAgent();
    agent.recordTrudodni('unknown-b', 'unknown-building-type', 4);
    const state = agent.getTrudodni();
    // rate 0.5 × 4 = 2.0
    expect(state.totalContributed).toBeCloseTo(2.0);
  });

  it('accumulates across multiple buildings', () => {
    const agent = new EconomyAgent();
    agent.recordTrudodni('farm1', 'kolkhoz', 5);  // rate 1.0 × 5 = 5
    agent.recordTrudodni('mill1', 'steel-mill', 3); // rate 1.5 × 3 = 4.5
    const state = agent.getTrudodni();
    expect(state.totalContributed).toBeCloseTo(9.5);
  });

  it('getTrudodniRatio returns ratio to minimum', () => {
    const agent = new EconomyAgent('revolution', 'worker');
    // worker minimum = 50
    agent.recordTrudodni('b1', 'factory', 10); // 1.2 × 10 = 12
    expect(agent.getTrudodniRatio()).toBeCloseTo(12 / MINIMUM_TRUDODNI_BY_DIFFICULTY['worker']);
  });

  it('resetTrudodni clears totals', () => {
    const agent = new EconomyAgent();
    agent.recordTrudodni('b1', 'factory', 10);
    agent.resetTrudodni();
    const state = agent.getTrudodni();
    expect(state.totalContributed).toBe(0);
    expect(state.perBuilding.size).toBe(0);
  });

  it('minimum trudodni is correct for each difficulty', () => {
    for (const [level, expected] of Object.entries(MINIMUM_TRUDODNI_BY_DIFFICULTY)) {
      const agent = new EconomyAgent('revolution', level as 'worker' | 'comrade' | 'tovarish');
      const state = agent.getTrudodni();
      expect(state.minimumRequired).toBe(expected);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Fondy delivery reliability by era
// ---------------------------------------------------------------------------

describe('EconomyAgent — fondy delivery reliability', () => {
  it('delivers when RNG < reliability', () => {
    const agent = new EconomyAgent('thaw', 'comrade');
    // thaw reliability = 0.8; RNG = 0.5 → should deliver
    agent.setRng(makeMockRng([0.5, 0.9]) as any);
    const result = agent.processDelivery(FONDY_BY_ERA['thaw'].interval);
    expect(result).not.toBeNull();
    expect(result!.delivered).toBe(true);
  });

  it('fails to deliver when RNG >= reliability', () => {
    const agent = new EconomyAgent('revolution', 'comrade');
    // revolution reliability = 0.4; RNG = 0.9 → should fail
    agent.setRng(makeMockRng([0.9]) as any);
    const result = agent.processDelivery(FONDY_BY_ERA['revolution'].interval);
    expect(result).not.toBeNull();
    expect(result!.delivered).toBe(false);
    // Failed delivery delivers zero resources
    expect(result!.actualDelivered.food).toBe(0);
    expect(result!.actualDelivered.steel).toBe(0);
  });

  it('returns null before scheduled delivery tick', () => {
    const agent = new EconomyAgent('revolution', 'comrade');
    const result = agent.processDelivery(0);
    expect(result).toBeNull();
  });

  it('advances nextDeliveryTick after delivery attempt', () => {
    const agent = new EconomyAgent('thaw', 'comrade');
    agent.setRng(makeMockRng([0.5, 0.9]) as any);
    const interval = FONDY_BY_ERA['thaw'].interval;
    agent.processDelivery(interval);
    // Should now not deliver until 2 * interval
    const secondResult = agent.processDelivery(interval);
    expect(secondResult).toBeNull();
    const thirdResult = agent.processDelivery(interval * 2);
    expect(thirdResult).not.toBeNull();
  });

  it('wartime has lower reliability than thaw', () => {
    expect(FONDY_BY_ERA['wartime'].reliability).toBeLessThan(FONDY_BY_ERA['thaw'].reliability);
  });

  it('eternal era has lowest reliability', () => {
    expect(FONDY_BY_ERA['eternal'].reliability).toBeLessThanOrEqual(
      Math.min(...Object.values(FONDY_BY_ERA).map((f) => f.reliability)),
    );
  });

  it('delivers 70-100% of allocated amounts on success', () => {
    const agent = new EconomyAgent('thaw', 'comrade');
    // RNG: first call (reliability check) = 0.1 (< 0.8 → deliver),
    // second call (quantity roll) = 0.0 → 70% of allocated
    agent.setRng(makeMockRng([0.1, 0.0]) as any);
    const interval = FONDY_BY_ERA['thaw'].interval;
    const result = agent.processDelivery(interval);
    expect(result!.delivered).toBe(true);
    const allocated = FONDY_BY_ERA['thaw'].allocated;
    // quantity = 0.7 + 0.0 * 0.3 = 0.7
    expect(result!.actualDelivered.steel).toBe(Math.round(allocated.steel * 0.7));
  });
});

// ---------------------------------------------------------------------------
// 4. Blat risk thresholds
// ---------------------------------------------------------------------------

describe('EconomyAgent — blat risk thresholds', () => {
  it('safe blat (<= 15) returns null KGB risk', () => {
    const agent = new EconomyAgent();
    agent.setRng(makeMockRng([0.001]) as any); // Would trigger if not safe
    // Default blat = 10, which is <= 15
    const result = agent.checkBlatKgbRisk();
    expect(result).toBeNull();
  });

  it('blat exactly at BLAT_SAFE_THRESHOLD returns null', () => {
    const agent = new EconomyAgent();
    agent.grantBlat(BLAT_SAFE_THRESHOLD - 10); // default is 10, so grant 5 to reach 15
    expect(agent.getBlat().connections).toBe(BLAT_SAFE_THRESHOLD);
    agent.setRng(makeMockRng([0.001]) as any);
    expect(agent.checkBlatKgbRisk()).toBeNull();
  });

  it('blat above safe threshold triggers investigation risk', () => {
    const agent = new EconomyAgent();
    // Grant enough to go above threshold: default=10, need >15, so grant 10 → 20
    agent.grantBlat(10); // connections = 20
    agent.setRng(makeMockRng([0.0, 0.9]) as any); // 0.0 < investigationChance → investigated
    const result = agent.checkBlatKgbRisk();
    expect(result).not.toBeNull();
    expect(result!.investigated).toBe(true);
  });

  it('blat at BLAT_ARREST_THRESHOLD triggers arrest risk', () => {
    const agent = new EconomyAgent();
    // Grant to go above 30: default=10, grant 25 → 35
    agent.grantBlat(25); // connections = 35
    // First rand: investigation check (excess = 35-15=20, chance=min(1,0.2)), provide 0.0 → investigated
    // Second rand: arrest check (connections > 30, chance = 0.01), provide 0.0 → arrested
    agent.setRng(makeMockRng([0.0, 0.0]) as any);
    const result = agent.checkBlatKgbRisk();
    expect(result).not.toBeNull();
    expect(result!.arrested).toBe(true);
  });

  it('blat above safe but below arrest does not trigger arrest', () => {
    const agent = new EconomyAgent();
    agent.grantBlat(10); // connections = 20 (above 15, below 30)
    // First rand (investigation): set high to NOT investigate
    // arrest check: connections <= 30, so no arrest check
    agent.setRng(makeMockRng([0.99, 0.99]) as any);
    const result = agent.checkBlatKgbRisk();
    // Both investigate and arrest miss (or no arrest check) → null
    if (result !== null) {
      expect(result.arrested).toBe(false);
    } else {
      expect(result).toBeNull();
    }
  });

  it('spendBlat reduces connections by amount', () => {
    const agent = new EconomyAgent();
    const initialBlat = agent.getBlat().connections;
    agent.spendBlat(5, 'improve_delivery');
    expect(agent.getBlat().connections).toBe(initialBlat - 5);
    expect(agent.getBlat().totalSpent).toBe(5);
  });

  it('spendBlat fails when insufficient connections', () => {
    const agent = new EconomyAgent();
    const result = agent.spendBlat(999, 'improve_delivery');
    expect(result.success).toBe(false);
  });

  it('grantBlat increases connections (capped at 100)', () => {
    const agent = new EconomyAgent();
    agent.grantBlat(95); // 10 + 95 = 105 → capped at 100
    expect(agent.getBlat().connections).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// 5. Ration period activation
// ---------------------------------------------------------------------------

describe('EconomyAgent — ration period activation', () => {
  it('activates rations during first historical period (1929-1935)', () => {
    const agent = new EconomyAgent();
    agent.updateRations(1929);
    expect(agent.getRations().active).toBe(true);

    agent.updateRations(1935);
    expect(agent.getRations().active).toBe(true);
  });

  it('deactivates rations outside ration periods', () => {
    const agent = new EconomyAgent();
    agent.updateRations(1936);
    expect(agent.getRations().active).toBe(false);
  });

  it('activates rations during wartime period (1941-1947)', () => {
    const agent = new EconomyAgent();
    agent.updateRations(1941);
    expect(agent.getRations().active).toBe(true);

    agent.updateRations(1944);
    expect(agent.getRations().active).toBe(true);

    agent.updateRations(1947);
    expect(agent.getRations().active).toBe(true);
  });

  it('activates rations from 1983 onward', () => {
    const agent = new EconomyAgent();
    agent.updateRations(1983);
    expect(agent.getRations().active).toBe(true);

    agent.updateRations(2000);
    expect(agent.getRations().active).toBe(true);
  });

  it('calculates ration demand when active', () => {
    const agent = new EconomyAgent();
    agent.updateRations(1941);
    const demand = agent.calculateDemand(100);
    expect(demand).not.toBeNull();
    expect(demand!.food).toBeGreaterThan(0);
  });

  it('returns null ration demand when inactive', () => {
    const agent = new EconomyAgent();
    agent.updateRations(1960);
    const demand = agent.calculateDemand(100);
    expect(demand).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 6. Heating tier transitions
// ---------------------------------------------------------------------------

describe('EconomyAgent — heating tier transitions', () => {
  it('starts at pechka tier', () => {
    const agent = new EconomyAgent();
    expect(agent.getHeating().tier).toBe('pechka');
  });

  it('upgrades to district tier at 100+ population', () => {
    const agent = new EconomyAgent();
    agent.processHeating(100, 6, true); // summer, has resource
    expect(agent.getHeating().tier).toBe('district');
  });

  it('stays pechka below 100 population', () => {
    const agent = new EconomyAgent();
    agent.processHeating(50, 6, true);
    expect(agent.getHeating().tier).toBe('pechka');
  });

  it('degrades from district to crumbling after 1000 ticks without repair', () => {
    const agent = new EconomyAgent();
    // Force district tier by passing 100+ population many times
    for (let i = 0; i < 1001; i++) {
      agent.processHeating(150, 6, true);
    }
    expect(agent.getHeating().tier).toBe('crumbling');
  });

  it('repairHeating resets ticksSinceRepair', () => {
    const agent = new EconomyAgent();
    // Get to district tier
    for (let i = 0; i < 5; i++) {
      agent.processHeating(150, 6, true);
    }
    expect(agent.getHeating().ticksSinceRepair).toBeGreaterThan(0);
    agent.repairHeating();
    expect(agent.getHeating().ticksSinceRepair).toBe(0);
    expect(agent.getHeating().failing).toBe(false);
  });

  it('marks as failing in winter without heating resource', () => {
    const agent = new EconomyAgent();
    const result = agent.processHeating(50, 1, false); // January, no resource
    expect(result.operational).toBe(false);
    expect(agent.getHeating().failing).toBe(true);
    expect(result.populationAtRisk).toBeGreaterThan(0);
  });

  it('consumes fuel in winter with heating resource', () => {
    const agent = new EconomyAgent();
    const result = agent.processHeating(50, 12, true); // December, has resource
    expect(result.fuelConsumed).not.toBeNull();
    expect(result.fuelConsumed!.resource).toBe('timber'); // pechka burns timber
    expect(agent.getHeating().failing).toBe(false);
  });

  it('does not consume fuel outside winter months', () => {
    const agent = new EconomyAgent();
    const result = agent.processHeating(50, 7, true); // July
    expect(result.fuelConsumed).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 7. State machine transitions
// ---------------------------------------------------------------------------

describe('EconomyAgent — state machine', () => {
  it('transitions to CrisisMode when blat > BLAT_ARREST_THRESHOLD', () => {
    const agent = new EconomyAgent();
    // Grant enough blat to exceed arrest threshold (default 10, need >30 → grant 25)
    agent.grantBlat(25); // connections = 35 > 30
    // Trigger state machine via economyTick (calls updateStateMachine internally)
    agent.setRng(makeMockRng([0.99, 0.99, 0.99, 0.99, 0.99]) as any);
    agent.economyTick(999, 1920, 10, []);
    expect(agent.getMode()).toBe('CrisisMode');
  });

  it('transitions to CrisisMode when rations active', () => {
    const agent = new EconomyAgent();
    // Year 1941 activates rations
    agent.setRng(makeMockRng([0.99]) as any);
    agent.economyTick(999, 1941, 10, []);
    expect(agent.getMode()).toBe('CrisisMode');
  });

  it('transitions back to NormalOperations when blat drops below safe', () => {
    const agent = new EconomyAgent();
    agent.grantBlat(25); // connections = 35, triggers crisis
    agent.setRng(makeMockRng([0.99]) as any);
    agent.economyTick(999, 1920, 10, []);
    expect(agent.getMode()).toBe('CrisisMode');

    // Spend blat down below safe threshold
    agent.spendBlat(25, 'kgb_protection'); // 35 - 25 = 10 <= 15
    agent.economyTick(1998, 1960, 10, []); // year 1960 = no rations
    expect(agent.getMode()).toBe('NormalOperations');
  });

  it('enters ReformPeriod on currency reform, then exits next tick', () => {
    const agent = new EconomyAgent('revolution', 'comrade');
    // 1924 chervonets reform, game starting at 1917 so reform is pending at 1924
    agent.setRng(makeMockRng([0.99]) as any);
    agent.economyTick(999, 1924, 10, [], { money: 1000 });
    // Mode should be NormalOperations or CrisisMode after ReformPeriod exits this tick
    // (ReformPeriod enters then immediately exits in updateStateMachine on next call)
    // The reform was applied → mode set to ReformPeriod inside checkCurrencyReform
    // then updateStateMachine runs afterward → exits to Normal (blat=10 ≤15, no rations in 1924)
    expect(agent.getMode()).toBe('NormalOperations');
  });
});

// ---------------------------------------------------------------------------
// 8. MTS rental decisions
// ---------------------------------------------------------------------------

describe('EconomyAgent — MTS rental', () => {
  it('applies MTS during 1928-1958 with sufficient funds', () => {
    const agent = new EconomyAgent();
    const result = agent.processMTS(1935, 1000);
    expect(result).not.toBeNull();
    expect(result!.applied).toBe(true);
    expect(result!.grainMultiplier).toBeGreaterThan(1.0);
  });

  it('does not apply MTS before 1928', () => {
    const agent = new EconomyAgent();
    const result = agent.processMTS(1920, 1000);
    expect(result).toBeNull();
  });

  it('does not apply MTS after 1958', () => {
    const agent = new EconomyAgent();
    const result = agent.processMTS(1960, 1000);
    expect(result).toBeNull();
  });

  it('does not apply MTS when insufficient funds', () => {
    const agent = new EconomyAgent();
    const result = agent.processMTS(1935, 0);
    expect(result).not.toBeNull();
    expect(result!.applied).toBe(false);
    expect(result!.grainMultiplier).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// 9. Era transitions
// ---------------------------------------------------------------------------

describe('EconomyAgent — era transitions', () => {
  it('setEra updates fondy configuration', () => {
    const agent = new EconomyAgent('revolution', 'comrade');
    expect(agent.getFondy().reliability).toBe(FONDY_BY_ERA['revolution'].reliability);

    agent.setEra('thaw');
    expect(agent.getEra()).toBe('thaw');
    expect(agent.getFondy().reliability).toBe(FONDY_BY_ERA['thaw'].reliability);
  });

  it('getMultipliers returns correct values for difficulty', () => {
    const worker = new EconomyAgent('revolution', 'worker');
    const mults = worker.getMultipliers();
    expect(mults.quotaTarget).toBe(0.8);

    const tovarish = new EconomyAgent('revolution', 'tovarish');
    const multT = tovarish.getMultipliers();
    expect(multT.quotaTarget).toBe(1.3);
  });
});

// ---------------------------------------------------------------------------
// 10. Serialization round-trip
// ---------------------------------------------------------------------------

describe('EconomyAgent — serialization round-trip', () => {
  it('serializes and deserializes without data loss', () => {
    const agent = new EconomyAgent('industrialization', 'tovarish');
    agent.recordTrudodni('building-1', 'factory', 10);
    agent.grantBlat(15);
    agent.spendBlat(5, 'improve_delivery');
    agent.updateRations(1941);
    agent.processMTS(1935, 1000);
    agent.processHeating(150, 6, true); // gets district tier

    const saved = agent.serialize();
    const restored = EconomyAgent.deserialize(saved);

    expect(restored.getEra()).toBe('industrialization');
    expect(restored.getDifficulty()).toBe('tovarish');
    expect(restored.getTrudodni().totalContributed).toBeCloseTo(12); // 1.2 * 10
    expect(restored.getBlat().connections).toBe(20); // 10 initial + 15 granted - 5 spent
    expect(restored.getBlat().totalSpent).toBe(5);
    expect(restored.getBlat().totalEarned).toBe(25); // initial 10 + 15 granted
    expect(restored.getRations().active).toBe(true);
    expect(restored.getMTS().active).toBe(true);
    expect(restored.getHeating().tier).toBe('district');
  });

  it('preserves currency reforms applied state', () => {
    const agent = new EconomyAgent('revolution', 'comrade');
    agent.setRng(makeMockRng([0.99]) as any);
    // Apply the 1924 reform
    agent.checkCurrencyReform(1924, 5000);

    const saved = agent.serialize();
    const restored = EconomyAgent.deserialize(saved);

    const reforms = restored.getCurrencyReforms();
    const reform1924 = reforms.find((r) => r.year === 1924);
    expect(reform1924).toBeDefined();
    expect(reform1924!.applied).toBe(true);
  });

  it('markReformsBeforeYear marks historical reforms as applied', () => {
    const agent = new EconomyAgent('revolution', 'comrade');
    agent.markReformsBeforeYear(1950);

    const reforms = agent.getCurrencyReforms();
    const reform1924 = reforms.find((r) => r.year === 1924);
    const reform1947 = reforms.find((r) => r.year === 1947);
    const reform1961 = reforms.find((r) => r.year === 1961);

    expect(reform1924!.applied).toBe(true);
    expect(reform1947!.applied).toBe(true);
    expect(reform1961!.applied).toBe(false); // 1961 > 1950
  });

  it('preserves per-building trudodni map through round-trip', () => {
    const agent = new EconomyAgent();
    agent.recordTrudodni('grid-5-7', 'kolkhoz', 3);
    agent.recordTrudodni('grid-2-4', 'hospital', 2);

    const saved = agent.serialize();
    const restored = EconomyAgent.deserialize(saved);

    const state = restored.getTrudodni();
    expect(state.perBuilding.get('grid-5-7')).toBeCloseTo(3.0); // 1.0 * 3
    expect(state.perBuilding.get('grid-2-4')).toBeCloseTo(4.0); // 2.0 * 2
  });
});

// ---------------------------------------------------------------------------
// 11. Production chains
// ---------------------------------------------------------------------------

describe('EconomyAgent — production chains', () => {
  it('does not process bread chain when grain not yet in storage', () => {
    const agent = new EconomyAgent();
    // bread chain step 2 requires grain:5 in resources; starting with grain:0 fails
    const resources = { food: 0, vodka: 0, timber: 0, steel: 0 };
    const buildings = ['kolkhoz-hq', 'factory'];
    // canExecute checks ALL steps upfront — step 2 needs grain:5, not yet available
    const produced = agent.tickProductionChains(buildings, resources);
    expect(produced).not.toContain('bread');
  });

  it('does not produce when required building is missing', () => {
    const agent = new EconomyAgent();
    const resources = { food: 0, vodka: 0, timber: 0, steel: 0 };
    const buildings = ['kolkhoz-hq']; // Missing 'factory' for bread chain
    const produced = agent.tickProductionChains(buildings, resources);
    expect(produced).not.toContain('bread');
  });

  it('consumes steel for steel_goods chain', () => {
    const agent = new EconomyAgent();
    const resources = { food: 0, vodka: 0, timber: 0, steel: 5 };
    const buildings = ['steel-mill'];
    // steel_goods: steel-mill consumes 3 steel → produces 2 tools
    agent.tickProductionChains(buildings, resources);
    expect(resources.steel).toBe(2); // 5 - 3 = 2
  });
});

// ---------------------------------------------------------------------------
// 12. Full economyTick
// ---------------------------------------------------------------------------

describe('EconomyAgent — full economyTick', () => {
  it('returns all expected fields', () => {
    const agent = new EconomyAgent('revolution', 'comrade');
    agent.setRng(makeMockRng([0.99, 0.99, 0.99]) as any);
    const result = agent.economyTick(30, 1920, 50, ['kolkhoz'], { money: 500, month: 6 });

    expect(result).toHaveProperty('trudodniEarned');
    expect(result).toHaveProperty('fondyDelivered');
    expect(result).toHaveProperty('stakhanovite');
    expect(result).toHaveProperty('blatLevel');
    expect(result).toHaveProperty('rationsActive');
    expect(result).toHaveProperty('rationDemand');
    expect(result).toHaveProperty('mtsResult');
    expect(result).toHaveProperty('heatingResult');
    expect(result).toHaveProperty('currencyReform');
    expect(result).toHaveProperty('blatKgbResult');
  });

  it('trudodniEarned accumulates from all buildings', () => {
    const agent = new EconomyAgent('revolution', 'comrade');
    agent.setRng(makeMockRng([0.99]) as any);
    const result = agent.economyTick(999, 1920, 10, ['factory', 'kolkhoz'], { month: 6 });
    // factory: 1.2 * 10 = 12, kolkhoz: 1.0 * 10 = 10 → total 22
    expect(result.trudodniEarned).toBeCloseTo(22);
  });

  it('blatKgbResult is null when blat is safe', () => {
    const agent = new EconomyAgent();
    // Default blat = 10 <= 15 (safe threshold)
    agent.setRng(makeMockRng([0.99]) as any);
    const result = agent.economyTick(999, 1920, 10, []);
    expect(result.blatKgbResult).toBeNull();
  });
});

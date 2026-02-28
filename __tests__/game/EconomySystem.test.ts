import {
  applyCurrencyReform,
  CURRENCY_REFORMS,
  calculateBuildingTrudodni,
  calculateNextQuota,
  calculateRationDemand,
  calculateStartingResources,
  DEFAULT_RATIONS,
  DEFAULT_TRUDODNI,
  DIFFICULTY_MULTIPLIERS,
  DIFFICULTY_QUOTA_MULT,
  DIFFICULTY_RESOURCE_MULT,
  DISTRICT_HEATING_POPULATION,
  DISTRICT_TO_CRUMBLING_TICKS,
  type DifficultyLevel,
  determineHeatingTier,
  type EconomySaveData,
  EconomySystem,
  ERA_ESCALATION,
  ERA_RESOURCE_MULT,
  type EraId,
  FONDY_BY_ERA,
  findPendingReform,
  getDifficultyMultipliers,
  HEATING_CONFIGS,
  MINIMUM_TRUDODNI_BY_DIFFICULTY,
  MTS_DEFAULTS,
  MTS_END_YEAR,
  MTS_START_YEAR,
  PRODUCTION_CHAINS,
  QUOTA_MET_ESCALATION,
  QUOTA_MISSED_REDUCTION,
  RATION_PERIODS,
  STAKHANOVITE_CHANCE,
  shouldMTSBeActive,
  shouldRationsBeActive,
  TRUDODNI_PER_BUILDING,
  type TransferableResource,
} from '../../src/game/economy';
import { GameRng } from '../../src/game/SeedSystem';

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const ALL_ERAS: EraId[] = [
  'revolution',
  'industrialization',
  'wartime',
  'reconstruction',
  'thaw',
  'stagnation',
  'perestroika',
  'eternal',
];

const TRANSFERABLE_KEYS: TransferableResource[] = ['food', 'vodka', 'money', 'steel', 'timber'];

// ─────────────────────────────────────────────────────────────────────────────
//  TESTS — Fondy Delivery Reliability
// ─────────────────────────────────────────────────────────────────────────────

describe('EconomySystem — Fondy Delivery', () => {
  it('returns null when delivery is not yet due', () => {
    const sys = new EconomySystem('thaw', 'comrade');
    const result = sys.processDelivery(0);
    expect(result).toBeNull();
  });

  it('delivers something when tick reaches nextDeliveryTick', () => {
    const rng = new GameRng('fondy-test-delivers');
    const sys = new EconomySystem('thaw', 'comrade');
    sys.setRng(rng);

    const fondy = sys.getFondy();
    const deliveryTick = fondy.nextDeliveryTick;

    // Run at delivery tick — should get a result (delivered or not)
    const result = sys.processDelivery(deliveryTick);
    expect(result).not.toBeNull();
  });

  it('schedules next delivery after processing', () => {
    const rng = new GameRng('fondy-schedule');
    const sys = new EconomySystem('thaw', 'comrade');
    sys.setRng(rng);

    const interval = sys.getFondy().deliveryInterval;
    const deliveryTick = sys.getFondy().nextDeliveryTick;

    sys.processDelivery(deliveryTick);
    expect(sys.getFondy().nextDeliveryTick).toBe(deliveryTick + interval);
  });

  it('delivered amounts are less than or equal to allocated', () => {
    const rng = new GameRng('fondy-amounts');
    const sys = new EconomySystem('thaw', 'comrade');
    sys.setRng(rng);

    const deliveryTick = sys.getFondy().nextDeliveryTick;
    const result = sys.processDelivery(deliveryTick);

    if (result?.delivered) {
      for (const key of TRANSFERABLE_KEYS) {
        expect(result.actualDelivered[key]).toBeLessThanOrEqual(result.allocated[key]);
      }
    }
  });

  it('reliability varies by era — wartime has lowest', () => {
    const wartime = new EconomySystem('wartime', 'comrade');
    const thaw = new EconomySystem('thaw', 'comrade');

    expect(wartime.getFondy().reliability).toBeLessThan(thaw.getFondy().reliability);
  });

  it('failed delivery returns zero resources with reason', () => {
    // Use a seed that produces a high random value to trigger failed delivery
    // We try many seeds until we find one that fails
    let failedResult = null;
    for (let i = 0; i < 100; i++) {
      const rng = new GameRng(`fail-delivery-${i}`);
      // Use wartime era (reliability 0.3) for highest failure chance
      const sys = new EconomySystem('wartime', 'comrade');
      sys.setRng(rng);
      const result = sys.processDelivery(sys.getFondy().nextDeliveryTick);
      if (result && !result.delivered) {
        failedResult = result;
        break;
      }
    }

    expect(failedResult).not.toBeNull();
    if (failedResult) {
      expect(failedResult.delivered).toBe(false);
      for (const key of TRANSFERABLE_KEYS) {
        expect(failedResult.actualDelivered[key]).toBe(0);
      }
      expect(failedResult.reason.length).toBeGreaterThan(0);
    }
  });

  it('era change updates fondy allocation', () => {
    const sys = new EconomySystem('revolution', 'comrade');
    const revAllocated = { ...sys.getFondy().allocated };

    sys.setEra('industrialization');
    const indAllocated = sys.getFondy().allocated;

    // Industrialization should have higher steel allocation
    expect(indAllocated.steel).toBeGreaterThan(revAllocated.steel);
  });

  it('all eras have valid fondy config', () => {
    for (const era of ALL_ERAS) {
      const config = FONDY_BY_ERA[era];
      expect(config.reliability).toBeGreaterThan(0);
      expect(config.reliability).toBeLessThanOrEqual(1.0);
      expect(config.interval).toBeGreaterThan(0);
      for (const key of TRANSFERABLE_KEYS) {
        expect(config.allocated[key]).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  TESTS — Trudodni
// ─────────────────────────────────────────────────────────────────────────────

describe('EconomySystem — Trudodni', () => {
  it('calculates building trudodni using per-building rates', () => {
    const earned = calculateBuildingTrudodni('coal-plant', 5);
    expect(earned).toBe(1.5 * 5);
  });

  it('uses default rate for unknown buildings', () => {
    const earned = calculateBuildingTrudodni('unknown-building', 3);
    expect(earned).toBe(DEFAULT_TRUDODNI * 3);
  });

  it('records trudodni and accumulates total', () => {
    const sys = new EconomySystem('thaw', 'comrade');
    sys.recordTrudodni('5,5', 'factory', 10);
    sys.recordTrudodni('6,6', 'kolkhoz-hq', 8);

    const record = sys.getTrudodni();
    expect(record.totalContributed).toBe(1.2 * 10 + 1.0 * 8);
    expect(record.perBuilding.get('5,5')).toBe(1.2 * 10);
    expect(record.perBuilding.get('6,6')).toBe(1.0 * 8);
  });

  it('accumulates trudodni at the same building key', () => {
    const sys = new EconomySystem('thaw', 'comrade');
    sys.recordTrudodni('5,5', 'factory', 10);
    sys.recordTrudodni('5,5', 'factory', 10);

    const record = sys.getTrudodni();
    expect(record.perBuilding.get('5,5')).toBe(1.2 * 10 * 2);
  });

  it('resetTrudodni clears all tracking', () => {
    const sys = new EconomySystem('thaw', 'comrade');
    sys.recordTrudodni('5,5', 'factory', 10);
    expect(sys.getTrudodni().totalContributed).toBeGreaterThan(0);

    sys.resetTrudodni();
    expect(sys.getTrudodni().totalContributed).toBe(0);
    expect(sys.getTrudodni().perBuilding.size).toBe(0);
  });

  it('trudodni ratio is correct', () => {
    const sys = new EconomySystem('thaw', 'comrade');
    const minimum = sys.getTrudodni().minimumRequired;

    // Record enough to hit exactly the minimum
    // factory rate = 1.2, so workers = min / 1.2
    const workers = Math.ceil(minimum / 1.2);
    sys.recordTrudodni('0,0', 'factory', workers);

    expect(sys.getTrudodniRatio()).toBeGreaterThanOrEqual(1.0);
  });

  it('minimum trudodni varies by difficulty', () => {
    const worker = new EconomySystem('thaw', 'worker');
    const tovarish = new EconomySystem('thaw', 'tovarish');

    expect(worker.getTrudodni().minimumRequired).toBeLessThan(
      tovarish.getTrudodni().minimumRequired
    );
  });

  it('all known buildings have positive trudodni rates', () => {
    for (const [defId, rate] of Object.entries(TRUDODNI_PER_BUILDING)) {
      expect(rate).toBeGreaterThan(0);
      expect(typeof defId).toBe('string');
    }
  });

  it('ministry earns less than factory (paper-pushers)', () => {
    const ministry = TRUDODNI_PER_BUILDING.ministry!;
    const factory = TRUDODNI_PER_BUILDING.factory!;
    expect(ministry).toBeLessThan(factory);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  TESTS — Ration Card Activation by Era
// ─────────────────────────────────────────────────────────────────────────────

describe('EconomySystem — Ration Cards', () => {
  it('rations active during 1929-1935', () => {
    expect(shouldRationsBeActive(1929)).toBe(true);
    expect(shouldRationsBeActive(1932)).toBe(true);
    expect(shouldRationsBeActive(1935)).toBe(true);
  });

  it('rations inactive between crisis periods', () => {
    expect(shouldRationsBeActive(1936)).toBe(false);
    expect(shouldRationsBeActive(1940)).toBe(false);
    expect(shouldRationsBeActive(1950)).toBe(false);
    expect(shouldRationsBeActive(1980)).toBe(false);
  });

  it('rations active during 1941-1947 (wartime)', () => {
    expect(shouldRationsBeActive(1941)).toBe(true);
    expect(shouldRationsBeActive(1945)).toBe(true);
    expect(shouldRationsBeActive(1947)).toBe(true);
  });

  it('rations active from 1983 onward', () => {
    expect(shouldRationsBeActive(1983)).toBe(true);
    expect(shouldRationsBeActive(1991)).toBe(true);
    expect(shouldRationsBeActive(2000)).toBe(true);
  });

  it('rations inactive before 1929', () => {
    expect(shouldRationsBeActive(1922)).toBe(false);
    expect(shouldRationsBeActive(1928)).toBe(false);
  });

  it('EconomySystem.updateRations activates/deactivates based on year', () => {
    const sys = new EconomySystem('revolution', 'comrade');
    expect(sys.getRations().active).toBe(false);

    sys.updateRations(1932);
    expect(sys.getRations().active).toBe(true);

    sys.updateRations(1950);
    expect(sys.getRations().active).toBe(false);
  });

  it('calculateDemand returns null when rations inactive', () => {
    const sys = new EconomySystem('revolution', 'comrade');
    sys.updateRations(1950); // Not active
    expect(sys.calculateDemand(100)).toBeNull();
  });

  it('calculateDemand returns demand when rations active', () => {
    const sys = new EconomySystem('revolution', 'comrade');
    sys.updateRations(1932); // Active
    const demand = sys.calculateDemand(100);
    expect(demand).not.toBeNull();
    expect(demand!.food).toBeGreaterThan(0);
  });

  it('ration demand scales with population', () => {
    const demand100 = calculateRationDemand(100, DEFAULT_RATIONS);
    const demand200 = calculateRationDemand(200, DEFAULT_RATIONS);

    expect(demand200.food).toBeGreaterThan(demand100.food);
    expect(demand200.vodka).toBeGreaterThan(demand100.vodka);
  });

  it('ration demand accounts for tier distribution', () => {
    const demand = calculateRationDemand(100, DEFAULT_RATIONS);
    // 50 workers * 1.0 + 20 employees * 0.7 + 20 dependents * 0.5 + 10 children * 0.4
    const expectedFood = 50 * 1.0 + 20 * 0.7 + 20 * 0.5 + 10 * 0.4;
    expect(demand.food).toBeCloseTo(expectedFood);
  });

  it('ration periods are non-overlapping', () => {
    for (let i = 0; i < RATION_PERIODS.length - 1; i++) {
      const current = RATION_PERIODS[i]!;
      const next = RATION_PERIODS[i + 1]!;
      expect(current.end).toBeLessThan(next.start);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  TESTS — Production Chain Processing
// ─────────────────────────────────────────────────────────────────────────────

describe('EconomySystem — Production Chains', () => {
  it('bread chain has correct steps', () => {
    const bread = PRODUCTION_CHAINS.find((c) => c.id === 'bread');
    expect(bread).toBeDefined();
    expect(bread!.steps).toHaveLength(2);
    expect(bread!.steps[0]!.building).toBe('kolkhoz-hq');
    expect(bread!.steps[1]!.building).toBe('factory');
  });

  it('vodka chain has correct steps', () => {
    const vodka = PRODUCTION_CHAINS.find((c) => c.id === 'vodka');
    expect(vodka).toBeDefined();
    expect(vodka!.steps).toHaveLength(2);
    expect(vodka!.steps[0]!.building).toBe('kolkhoz-hq');
    expect(vodka!.steps[1]!.building).toBe('vodka-plant');
  });

  it('each chain has a unique id', () => {
    const ids = PRODUCTION_CHAINS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('each step has positive ticksRequired', () => {
    for (const chain of PRODUCTION_CHAINS) {
      for (const step of chain.steps) {
        expect(step.ticksRequired).toBeGreaterThan(0);
      }
    }
  });

  it('first step of grain chains has no input', () => {
    const bread = PRODUCTION_CHAINS.find((c) => c.id === 'bread')!;
    expect(Object.keys(bread.steps[0]!.input)).toHaveLength(0);
  });

  it('later steps consume previous step output', () => {
    const bread = PRODUCTION_CHAINS.find((c) => c.id === 'bread')!;
    const step1Output = bread.steps[0]!.output;
    const step2Input = bread.steps[1]!.input;

    // Step 2 should consume grain, which step 1 produces
    expect(step2Input.grain).toBeDefined();
    expect(step1Output.grain).toBeDefined();
    expect(step2Input.grain).toBe(step1Output.grain);
  });

  it('paperwork chain requires timber input', () => {
    const pw = PRODUCTION_CHAINS.find((c) => c.id === 'paperwork')!;
    expect(pw.steps[0]!.input.timber).toBeDefined();
    expect(pw.steps[0]!.input.timber).toBeGreaterThan(0);
  });

  it('all chains have at least one step', () => {
    for (const chain of PRODUCTION_CHAINS) {
      expect(chain.steps.length).toBeGreaterThanOrEqual(1);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  TESTS — Quota Escalation Math
// ─────────────────────────────────────────────────────────────────────────────

describe('EconomySystem — Quota Escalation', () => {
  it('meeting quota increases target by escalation factor', () => {
    const next = calculateNextQuota(100, true, 1.0, 1.0);
    expect(next).toBe(Math.round(100 * QUOTA_MET_ESCALATION));
  });

  it('missing quota decreases target slightly', () => {
    const next = calculateNextQuota(100, false, 1.0, 1.0);
    expect(next).toBe(Math.round(100 * QUOTA_MISSED_REDUCTION));
  });

  it('era escalation multiplies into result', () => {
    const base = calculateNextQuota(100, true, 1.0, 1.0);
    const wartime = calculateNextQuota(100, true, ERA_ESCALATION.wartime, 1.0);
    expect(wartime).toBeGreaterThan(base);
  });

  it('difficulty multiplier scales target', () => {
    const easy = calculateNextQuota(100, true, 1.0, DIFFICULTY_QUOTA_MULT.worker);
    const hard = calculateNextQuota(100, true, 1.0, DIFFICULTY_QUOTA_MULT.tovarish);
    expect(hard).toBeGreaterThan(easy);
  });

  it('result is always a rounded integer', () => {
    for (const era of ALL_ERAS) {
      const next = calculateNextQuota(137, true, ERA_ESCALATION[era], 1.0);
      expect(next).toBe(Math.round(next));
    }
  });

  it('successive met quotas compound upward', () => {
    let target = 100;
    for (let i = 0; i < 5; i++) {
      target = calculateNextQuota(target, true, 1.0, 1.0);
    }
    // After 5 consecutive successes: 100 * 1.15^5 ≈ 201
    expect(target).toBeGreaterThan(200);
  });

  it('successive missed quotas reduce but stay positive', () => {
    let target = 100;
    for (let i = 0; i < 50; i++) {
      target = calculateNextQuota(target, false, 1.0, 1.0);
    }
    expect(target).toBeGreaterThan(0);
  });

  it('zero target stays zero', () => {
    const next = calculateNextQuota(0, true, 1.5, 1.3);
    expect(next).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  TESTS — Starting Resources Calculation
// ─────────────────────────────────────────────────────────────────────────────

describe('EconomySystem — Starting Resources', () => {
  it('returns all expected resource keys', () => {
    const res = calculateStartingResources('comrade', 'revolution', 30);
    expect(res).toHaveProperty('money');
    expect(res).toHaveProperty('food');
    expect(res).toHaveProperty('vodka');
    expect(res).toHaveProperty('power');
    expect(res).toHaveProperty('population');
    expect(res).toHaveProperty('timber');
    expect(res).toHaveProperty('steel');
    expect(res).toHaveProperty('paperwork');
  });

  it('worker difficulty gives more resources than tovarish', () => {
    const easy = calculateStartingResources('worker', 'thaw', 30);
    const hard = calculateStartingResources('tovarish', 'thaw', 30);
    expect(easy.money).toBeGreaterThan(hard.money);
    expect(easy.food).toBeGreaterThan(hard.food);
  });

  it('thaw era gives more resources than wartime', () => {
    const thaw = calculateStartingResources('comrade', 'thaw', 30);
    const wartime = calculateStartingResources('comrade', 'wartime', 30);
    expect(thaw.money).toBeGreaterThan(wartime.money);
    expect(thaw.food).toBeGreaterThan(wartime.food);
  });

  it('larger map gives more resources', () => {
    const small = calculateStartingResources('comrade', 'thaw', 15);
    const large = calculateStartingResources('comrade', 'thaw', 60);
    expect(large.money).toBeGreaterThan(small.money);
  });

  it('default 30x30 matches base values at comrade+revolution', () => {
    // comrade = 1.0, revolution = 0.8, size = 30/30 = 1.0
    const res = calculateStartingResources('comrade', 'revolution', 30);
    expect(res.money).toBe(Math.round(2000 * 1.0 * 0.8 * 1.0));
    expect(res.food).toBe(Math.round(200 * 1.0 * 0.8 * 1.0));
  });

  it('all difficulty levels have valid multipliers', () => {
    for (const mult of Object.values(DIFFICULTY_RESOURCE_MULT)) {
      expect(mult).toBeGreaterThan(0);
      expect(mult).toBeLessThanOrEqual(2.0);
    }
  });

  it('all era multipliers are valid', () => {
    for (const mult of Object.values(ERA_RESOURCE_MULT)) {
      expect(mult).toBeGreaterThan(0);
      expect(mult).toBeLessThanOrEqual(2.0);
    }
  });

  it('all values are non-negative integers', () => {
    const res = calculateStartingResources('comrade', 'thaw', 30);
    for (const val of Object.values(res)) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBe(Math.round(val));
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  TESTS — Serialization Roundtrip
// ─────────────────────────────────────────────────────────────────────────────

describe('EconomySystem — Serialization', () => {
  it('round-trips correctly with default state', () => {
    const sys = new EconomySystem('thaw', 'comrade');
    const saved = sys.serialize();
    const restored = EconomySystem.deserialize(saved);

    expect(restored.getEra()).toBe('thaw');
    expect(restored.getDifficulty()).toBe('comrade');
  });

  it('preserves trudodni across serialization', () => {
    const sys = new EconomySystem('thaw', 'comrade');
    sys.recordTrudodni('3,4', 'factory', 10);
    sys.recordTrudodni('7,8', 'kolkhoz-hq', 5);

    const saved = sys.serialize();
    const restored = EconomySystem.deserialize(saved);

    const original = sys.getTrudodni();
    const restoredTrudodni = restored.getTrudodni();
    expect(restoredTrudodni.totalContributed).toBeCloseTo(original.totalContributed);
    expect(restoredTrudodni.perBuilding.get('3,4')).toBeCloseTo(original.perBuilding.get('3,4')!);
    expect(restoredTrudodni.perBuilding.get('7,8')).toBeCloseTo(original.perBuilding.get('7,8')!);
  });

  it('preserves fondy state', () => {
    const sys = new EconomySystem('industrialization', 'worker');
    const saved = sys.serialize();
    const restored = EconomySystem.deserialize(saved);

    const originalFondy = sys.getFondy();
    const restoredFondy = restored.getFondy();
    expect(restoredFondy.reliability).toBe(originalFondy.reliability);
    expect(restoredFondy.deliveryInterval).toBe(originalFondy.deliveryInterval);

    for (const key of TRANSFERABLE_KEYS) {
      expect(restoredFondy.allocated[key]).toBe(originalFondy.allocated[key]);
    }
  });

  it('preserves blat state', () => {
    const sys = new EconomySystem('thaw', 'comrade');
    sys.grantBlat(25);
    sys.spendBlat(10, 'test');

    const saved = sys.serialize();
    const restored = EconomySystem.deserialize(saved);

    expect(restored.getBlat().connections).toBe(sys.getBlat().connections);
    expect(restored.getBlat().totalSpent).toBe(sys.getBlat().totalSpent);
    expect(restored.getBlat().totalEarned).toBe(sys.getBlat().totalEarned);
  });

  it('preserves ration state', () => {
    const sys = new EconomySystem('revolution', 'comrade');
    sys.updateRations(1932); // Activate rations

    const saved = sys.serialize();
    const restored = EconomySystem.deserialize(saved);

    expect(restored.getRations().active).toBe(true);
    expect(restored.getRations().rations.worker.food).toBe(sys.getRations().rations.worker.food);
  });

  it('serialized data has correct shape', () => {
    const sys = new EconomySystem();
    const saved: EconomySaveData = sys.serialize();

    expect(saved).toHaveProperty('trudodni');
    expect(saved).toHaveProperty('fondy');
    expect(saved).toHaveProperty('blat');
    expect(saved).toHaveProperty('rations');
    expect(saved).toHaveProperty('era');
    expect(saved).toHaveProperty('difficulty');

    expect(saved.trudodni).toHaveProperty('totalContributed');
    expect(saved.trudodni).toHaveProperty('perBuilding');
    expect(Array.isArray(saved.trudodni.perBuilding)).toBe(true);

    expect(saved.fondy).toHaveProperty('reliability');
    expect(saved.fondy).toHaveProperty('deliveryInterval');
    expect(saved.fondy).toHaveProperty('allocated');
  });

  it('deserialized instance is independent of original', () => {
    const sys = new EconomySystem('thaw', 'comrade');
    const saved = sys.serialize();
    const restored = EconomySystem.deserialize(saved);

    // Mutate the restored copy
    restored.grantBlat(50);
    restored.recordTrudodni('0,0', 'factory', 100);

    // Original should be unaffected
    expect(sys.getBlat().connections).toBe(10); // Initial value
    expect(sys.getTrudodni().totalContributed).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  TESTS — Blat System
// ─────────────────────────────────────────────────────────────────────────────

describe('EconomySystem — Blat', () => {
  it('starts with 10 connections', () => {
    const sys = new EconomySystem();
    expect(sys.getBlat().connections).toBe(10);
  });

  it('grantBlat increases connections', () => {
    const sys = new EconomySystem();
    sys.grantBlat(15);
    expect(sys.getBlat().connections).toBe(25);
    expect(sys.getBlat().totalEarned).toBe(25);
  });

  it('connections cap at 100', () => {
    const sys = new EconomySystem();
    sys.grantBlat(200);
    expect(sys.getBlat().connections).toBe(100);
  });

  it('spendBlat returns success=false if insufficient', () => {
    const sys = new EconomySystem();
    expect(sys.spendBlat(50, 'too_much').success).toBe(false);
    expect(sys.getBlat().connections).toBe(10); // Unchanged
  });

  it('spendBlat deducts and returns success=true if sufficient', () => {
    const sys = new EconomySystem();
    sys.grantBlat(30);
    expect(sys.spendBlat(20, 'test').success).toBe(true);
    expect(sys.getBlat().connections).toBe(20); // 10 + 30 - 20
    expect(sys.getBlat().totalSpent).toBe(20);
  });

  it('spending blat for delivery improves reliability', () => {
    const sys = new EconomySystem('wartime', 'comrade');
    const before = sys.getFondy().reliability;
    sys.grantBlat(20);
    sys.spendBlat(10, 'improve_delivery');
    expect(sys.getFondy().reliability).toBe(Math.min(1.0, before + 0.05));
  });

  it('reliability never exceeds 1.0 from blat spending', () => {
    const sys = new EconomySystem('thaw', 'comrade');
    sys.grantBlat(90);
    // Spend multiple times
    for (let i = 0; i < 10; i++) {
      sys.spendBlat(5, 'improve_delivery');
    }
    expect(sys.getFondy().reliability).toBeLessThanOrEqual(1.0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  TESTS — Stakhanovite Events
// ─────────────────────────────────────────────────────────────────────────────

describe('EconomySystem — Stakhanovite', () => {
  it('returns null with no buildings', () => {
    const sys = new EconomySystem();
    sys.setRng(new GameRng('stakh-no-buildings'));
    expect(sys.checkStakhanovite([])).toBeNull();
  });

  it('eventually fires with enough attempts', () => {
    let found = false;
    for (let i = 0; i < 2000; i++) {
      const rng = new GameRng(`stakh-${i}`);
      const sys = new EconomySystem();
      sys.setRng(rng);
      const result = sys.checkStakhanovite(['factory', 'kolkhoz-hq']);
      if (result !== null) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('event has all required fields', () => {
    // Find a seed that produces an event
    let event = null;
    for (let i = 0; i < 5000; i++) {
      const rng = new GameRng(`stakh-fields-${i}`);
      const sys = new EconomySystem();
      sys.setRng(rng);
      event = sys.checkStakhanovite(['factory', 'coal-plant']);
      if (event) break;
    }

    expect(event).not.toBeNull();
    if (event) {
      expect(event.workerName.length).toBeGreaterThan(0);
      expect(event.building).toBeDefined();
      expect(event.productionBoost).toBeGreaterThanOrEqual(1.5);
      expect(event.productionBoost).toBeLessThanOrEqual(4.0);
      expect(event.propagandaValue).toBeGreaterThan(0);
      expect(event.quotaIncrease).toBeGreaterThan(0);
      expect(event.announcement.length).toBeGreaterThan(0);
    }
  });

  it('Stakhanovite grants blat via tick()', () => {
    // We need to find a tick that produces a Stakhanovite event
    let blatIncreased = false;
    for (let i = 0; i < 5000; i++) {
      const rng = new GameRng(`stakh-blat-${i}`);
      const sys = new EconomySystem('thaw', 'comrade');
      sys.setRng(rng);
      const before = sys.getBlat().connections;
      // Use a delivery tick far away to avoid fondy interference
      const result = sys.tick(0, 1960, 100, ['factory', 'coal-plant']);
      if (result.stakhanovite) {
        expect(sys.getBlat().connections).toBeGreaterThan(before);
        blatIncreased = true;
        break;
      }
    }
    expect(blatIncreased).toBe(true);
  });

  it('STAKHANOVITE_CHANCE is very small', () => {
    expect(STAKHANOVITE_CHANCE).toBeLessThan(0.01);
    expect(STAKHANOVITE_CHANCE).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  TESTS — Remainder Allocation
// ─────────────────────────────────────────────────────────────────────────────

describe('EconomySystem — Remainder Allocation', () => {
  it('splits surplus into 70/30 distribution/reserve', () => {
    const sys = new EconomySystem();
    const surplus: Record<TransferableResource, number> = {
      food: 100,
      vodka: 50,
      money: 200,
      steel: 10,
      timber: 20,
    };

    const result = sys.allocateRemainder(surplus);
    expect(result.distributed.food).toBe(70);
    expect(result.reserved.food).toBe(30);
    expect(result.distributed.vodka).toBe(35);
    expect(result.reserved.vodka).toBe(15);
  });

  it('distributed + reserved equals original', () => {
    const sys = new EconomySystem();
    const surplus: Record<TransferableResource, number> = {
      food: 137,
      vodka: 83,
      money: 999,
      steel: 41,
      timber: 67,
    };

    const result = sys.allocateRemainder(surplus);
    for (const key of TRANSFERABLE_KEYS) {
      expect(result.distributed[key] + result.reserved[key]).toBe(surplus[key]);
    }
  });

  it('handles zero surplus gracefully', () => {
    const sys = new EconomySystem();
    const surplus: Record<TransferableResource, number> = {
      food: 0,
      vodka: 0,
      money: 0,
      steel: 0,
      timber: 0,
    };

    const result = sys.allocateRemainder(surplus);
    for (const key of TRANSFERABLE_KEYS) {
      expect(result.distributed[key]).toBe(0);
      expect(result.reserved[key]).toBe(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  TESTS — Main Tick Integration
// ─────────────────────────────────────────────────────────────────────────────

describe('EconomySystem — tick()', () => {
  it('returns a valid EconomyTickResult', () => {
    const rng = new GameRng('tick-test');
    const sys = new EconomySystem('thaw', 'comrade');
    sys.setRng(rng);

    const result = sys.tick(0, 1960, 100, ['factory', 'kolkhoz-hq']);

    expect(result).toHaveProperty('trudodniEarned');
    expect(result).toHaveProperty('fondyDelivered');
    expect(result).toHaveProperty('stakhanovite');
    expect(result).toHaveProperty('blatLevel');
    expect(result).toHaveProperty('rationsActive');
    expect(result).toHaveProperty('rationDemand');
  });

  it('accumulates trudodni each tick', () => {
    const sys = new EconomySystem('thaw', 'comrade');
    sys.tick(0, 1960, 100, ['factory']);
    sys.tick(1, 1960, 100, ['factory']);

    expect(sys.getTrudodni().totalContributed).toBeGreaterThan(0);
  });

  it('rations are active during wartime year', () => {
    const sys = new EconomySystem('wartime', 'comrade');
    const result = sys.tick(0, 1943, 100, ['factory']);

    expect(result.rationsActive).toBe(true);
    expect(result.rationDemand).not.toBeNull();
  });

  it('rations are inactive during thaw year', () => {
    const sys = new EconomySystem('thaw', 'comrade');
    const result = sys.tick(0, 1960, 100, ['factory']);

    expect(result.rationsActive).toBe(false);
    expect(result.rationDemand).toBeNull();
  });

  it('trudodniEarned reflects buildings provided', () => {
    const sys = new EconomySystem('thaw', 'comrade');
    const result1 = sys.tick(0, 1960, 100, ['factory']);
    const sys2 = new EconomySystem('thaw', 'comrade');
    const result2 = sys2.tick(0, 1960, 100, ['factory', 'coal-plant', 'kolkhoz-hq']);

    expect(result2.trudodniEarned).toBeGreaterThan(result1.trudodniEarned);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  TESTS — Constructor & Configuration
// ─────────────────────────────────────────────────────────────────────────────

describe('EconomySystem — Construction', () => {
  it('defaults to revolution era and comrade difficulty', () => {
    const sys = new EconomySystem();
    expect(sys.getEra()).toBe('revolution');
    expect(sys.getDifficulty()).toBe('comrade');
  });

  it('accepts era and difficulty parameters', () => {
    const sys = new EconomySystem('stagnation', 'tovarish');
    expect(sys.getEra()).toBe('stagnation');
    expect(sys.getDifficulty()).toBe('tovarish');
  });

  it('setEra updates fondy configuration', () => {
    const sys = new EconomySystem('revolution', 'comrade');
    const revReliability = sys.getFondy().reliability;

    sys.setEra('thaw');
    expect(sys.getEra()).toBe('thaw');
    expect(sys.getFondy().reliability).not.toBe(revReliability);
  });

  it('minimum trudodni is set by difficulty', () => {
    for (const [diff, min] of Object.entries(MINIMUM_TRUDODNI_BY_DIFFICULTY)) {
      const sys = new EconomySystem('revolution', diff as 'worker' | 'comrade' | 'tovarish');
      expect(sys.getTrudodni().minimumRequired).toBe(min);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  TESTS — Seeded RNG Determinism
// ─────────────────────────────────────────────────────────────────────────────

describe('EconomySystem — Determinism', () => {
  it('produces identical fondy deliveries with same seed', () => {
    const make = () => {
      const rng = new GameRng('determinism-fondy');
      const sys = new EconomySystem('wartime', 'comrade');
      sys.setRng(rng);
      return sys.processDelivery(sys.getFondy().nextDeliveryTick);
    };

    const result1 = make();
    const result2 = make();

    expect(result1?.delivered).toBe(result2?.delivered);
    if (result1?.delivered && result2?.delivered) {
      for (const key of TRANSFERABLE_KEYS) {
        expect(result1.actualDelivered[key]).toBe(result2.actualDelivered[key]);
      }
    }
  });

  it('produces identical Stakhanovite events with same seed', () => {
    const make = () => {
      const rng = new GameRng('determinism-stakh');
      const sys = new EconomySystem();
      sys.setRng(rng);
      return sys.checkStakhanovite(['factory', 'coal-plant']);
    };

    const result1 = make();
    const result2 = make();

    if (result1 && result2) {
      expect(result1.workerName).toBe(result2.workerName);
      expect(result1.productionBoost).toBe(result2.productionBoost);
    } else {
      expect(result1).toBe(result2); // Both null
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  MTS (Machine-Tractor Stations)
// ─────────────────────────────────────────────────────────────────────────────

describe('EconomySystem — MTS', () => {
  it('shouldMTSBeActive returns true within MTS era', () => {
    expect(shouldMTSBeActive(MTS_START_YEAR)).toBe(true);
    expect(shouldMTSBeActive(1940)).toBe(true);
    expect(shouldMTSBeActive(MTS_END_YEAR)).toBe(true);
  });

  it('shouldMTSBeActive returns false outside MTS era', () => {
    expect(shouldMTSBeActive(MTS_START_YEAR - 1)).toBe(false);
    expect(shouldMTSBeActive(MTS_END_YEAR + 1)).toBe(false);
    expect(shouldMTSBeActive(1980)).toBe(false);
  });

  it('processMTS returns null when year is outside MTS era', () => {
    const sys = new EconomySystem('stagnation', 'comrade');
    const result = sys.processMTS(1980, 10000);
    expect(result).toBeNull();
    expect(sys.getMTS().active).toBe(false);
  });

  it('processMTS charges rental and returns grain multiplier when funded', () => {
    const sys = new EconomySystem('industrialization', 'comrade');
    const result = sys.processMTS(1935, 10000);
    expect(result).not.toBeNull();
    expect(result!.applied).toBe(true);
    expect(result!.cost).toBeGreaterThan(0);
    expect(result!.grainMultiplier).toBe(MTS_DEFAULTS.grainBoostMultiplier);
    expect(sys.getMTS().active).toBe(true);
  });

  it('processMTS returns no boost when funds are insufficient', () => {
    const sys = new EconomySystem('industrialization', 'comrade');
    const result = sys.processMTS(1935, 0);
    expect(result).not.toBeNull();
    expect(result!.applied).toBe(false);
    expect(result!.cost).toBe(0);
    expect(result!.grainMultiplier).toBe(1.0);
  });

  it('accumulates totalRentalSpent across multiple ticks', () => {
    const sys = new EconomySystem('industrialization', 'comrade');
    sys.processMTS(1935, 10000);
    const afterFirst = sys.getMTS().totalRentalSpent;
    sys.processMTS(1935, 10000);
    expect(sys.getMTS().totalRentalSpent).toBe(afterFirst * 2);
  });

  it('MTS defaults have sensible values', () => {
    expect(MTS_DEFAULTS.tractorUnits).toBeGreaterThan(0);
    expect(MTS_DEFAULTS.rentalCostPerUnit).toBeGreaterThan(0);
    expect(MTS_DEFAULTS.grainBoostMultiplier).toBeGreaterThan(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  HEATING PROGRESSION
// ─────────────────────────────────────────────────────────────────────────────

describe('EconomySystem — Heating', () => {
  it('determineHeatingTier returns pechka for small population', () => {
    expect(determineHeatingTier(50, 0, 'pechka')).toBe('pechka');
    expect(determineHeatingTier(DISTRICT_HEATING_POPULATION - 1, 0, 'pechka')).toBe('pechka');
  });

  it('determineHeatingTier upgrades to district at population threshold', () => {
    expect(determineHeatingTier(DISTRICT_HEATING_POPULATION, 0, 'pechka')).toBe('district');
    expect(determineHeatingTier(200, 0, 'pechka')).toBe('district');
  });

  it('determineHeatingTier degrades to crumbling after threshold ticks', () => {
    expect(determineHeatingTier(200, DISTRICT_TO_CRUMBLING_TICKS, 'district')).toBe('crumbling');
    expect(determineHeatingTier(200, DISTRICT_TO_CRUMBLING_TICKS + 100, 'district')).toBe(
      'crumbling'
    );
  });

  it('determineHeatingTier does not crumble before threshold', () => {
    expect(determineHeatingTier(200, DISTRICT_TO_CRUMBLING_TICKS - 1, 'district')).toBe('district');
  });

  it('processHeating returns operational when resources available', () => {
    const sys = new EconomySystem('stagnation', 'comrade');
    const result = sys.processHeating(50, 6, true);
    expect(result.operational).toBe(true);
    expect(result.populationAtRisk).toBe(0);
  });

  it('processHeating marks population at risk in winter without heating', () => {
    const sys = new EconomySystem('stagnation', 'comrade');
    // Force failing state
    const result = sys.processHeating(100, 1, false);
    expect(result.operational).toBe(false);
    expect(result.populationAtRisk).toBeGreaterThan(0);
  });

  it('processHeating has no risk in summer even without heating', () => {
    const sys = new EconomySystem('stagnation', 'comrade');
    const result = sys.processHeating(100, 7, false);
    expect(result.operational).toBe(false);
    expect(result.populationAtRisk).toBe(0);
  });

  it('processHeating upgrades tier when population grows', () => {
    const sys = new EconomySystem('stagnation', 'comrade');
    expect(sys.getHeating().tier).toBe('pechka');

    // Process with enough population to trigger district
    sys.processHeating(DISTRICT_HEATING_POPULATION, 6, true);
    expect(sys.getHeating().tier).toBe('district');
  });

  it('repairHeating resets failing state and timer', () => {
    const sys = new EconomySystem('stagnation', 'comrade');
    // Simulate some ticks to increment timer
    sys.processHeating(200, 6, true); // upgrades to district
    for (let i = 0; i < 10; i++) {
      sys.processHeating(200, 6, true);
    }
    expect(sys.getHeating().ticksSinceRepair).toBeGreaterThan(0);

    sys.repairHeating();
    expect(sys.getHeating().ticksSinceRepair).toBe(0);
    expect(sys.getHeating().failing).toBe(false);
  });

  it('winter months are correctly identified', () => {
    const sys = new EconomySystem('stagnation', 'comrade');
    // Winter: Nov(11), Dec(12), Jan(1), Feb(2), Mar(3) — should have risk when no heat
    for (const month of [1, 2, 3, 11, 12]) {
      const result = sys.processHeating(100, month, false);
      expect(result.populationAtRisk).toBeGreaterThan(0);
    }
    // Summer: should have no risk
    for (const month of [4, 5, 6, 7, 8, 9, 10]) {
      const result = sys.processHeating(100, month, false);
      expect(result.populationAtRisk).toBe(0);
    }
  });

  it('HEATING_CONFIGS have valid configurations for all tiers', () => {
    for (const tier of ['pechka', 'district', 'crumbling'] as const) {
      const config = HEATING_CONFIGS[tier];
      expect(config.consumption.amount).toBeGreaterThan(0);
      expect(config.baseEfficiency).toBeGreaterThan(0);
      expect(config.baseEfficiency).toBeLessThanOrEqual(1);
      expect(config.capacityPer100Pop).toBeGreaterThan(0);
      expect(config.repairThreshold).toBeGreaterThan(0);
    }
  });

  it('crumbling tier has lower efficiency than district', () => {
    expect(HEATING_CONFIGS.crumbling.baseEfficiency).toBeLessThan(
      HEATING_CONFIGS.district.baseEfficiency
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  CURRENCY REFORMS
// ─────────────────────────────────────────────────────────────────────────────

describe('EconomySystem — Currency Reforms', () => {
  it('CURRENCY_REFORMS are in chronological order', () => {
    for (let i = 1; i < CURRENCY_REFORMS.length; i++) {
      expect(CURRENCY_REFORMS[i]!.year).toBeGreaterThan(CURRENCY_REFORMS[i - 1]!.year);
    }
  });

  it('findPendingReform finds the earliest unapplied reform', () => {
    const reforms = CURRENCY_REFORMS.map((r) => ({ ...r }));
    const result = findPendingReform(reforms, 1950);
    expect(result).not.toBeNull();
    expect(result!.year).toBe(1924);
  });

  it('findPendingReform skips applied reforms', () => {
    const reforms = CURRENCY_REFORMS.map((r) => ({ ...r }));
    reforms[0]!.applied = true;
    const result = findPendingReform(reforms, 1950);
    expect(result).not.toBeNull();
    expect(result!.year).toBe(1947);
  });

  it('findPendingReform returns null when no reforms are pending', () => {
    const reforms = CURRENCY_REFORMS.map((r) => ({ ...r, applied: true }));
    expect(findPendingReform(reforms, 2000)).toBeNull();
  });

  it('findPendingReform returns null when year is too early', () => {
    const reforms = CURRENCY_REFORMS.map((r) => ({ ...r }));
    expect(findPendingReform(reforms, 1920)).toBeNull();
  });

  it('applyCurrencyReform applies exchange rate correctly', () => {
    const reform = { ...CURRENCY_REFORMS[1]! }; // 1947 Post-War, rate 10
    const result = applyCurrencyReform(10000, reform);
    expect(result.moneyBefore).toBe(10000);
    expect(result.moneyAfter).toBe(1000);
    expect(result.amountLost).toBe(9000);
  });

  it('applyCurrencyReform handles 1924 Chervonets reform', () => {
    const reform = { ...CURRENCY_REFORMS[0]! }; // rate 50000
    const result = applyCurrencyReform(100000, reform);
    expect(result.moneyAfter).toBe(Math.round(100000 / 50000));
    expect(result.moneyAfter).toBe(2);
  });

  it('applyCurrencyReform 1991 Pavlov: confiscates 50% above 1000', () => {
    const reform = { ...CURRENCY_REFORMS[3]! }; // Pavlov 1991
    const result = applyCurrencyReform(5000, reform);
    // protected = 1000, excess = 4000, confiscated = 2000
    expect(result.moneyAfter).toBe(3000);
    expect(result.amountLost).toBe(2000);
  });

  it('applyCurrencyReform 1991 Pavlov: no loss below 1000', () => {
    const reform = { ...CURRENCY_REFORMS[3]! };
    const result = applyCurrencyReform(800, reform);
    expect(result.moneyAfter).toBe(800);
    expect(result.amountLost).toBe(0);
  });

  it('applyCurrencyReform guarantees minimum 1 ruble', () => {
    const reform = { ...CURRENCY_REFORMS[0]! }; // rate 50000
    const result = applyCurrencyReform(100, reform);
    // 100 / 50000 = ~0 rounds to 0, but min is 1
    expect(result.moneyAfter).toBe(1);
  });

  it('checkCurrencyReform applies and marks reform', () => {
    const sys = new EconomySystem('reconstruction', 'comrade');
    const reforms = sys.getCurrencyReforms();
    const initialUnapplied = reforms.filter((r) => !r.applied).length;

    const result = sys.checkCurrencyReform(1950, 10000);
    expect(result).not.toBeNull();

    const afterUnapplied = sys.getCurrencyReforms().filter((r) => !r.applied).length;
    expect(afterUnapplied).toBe(initialUnapplied - 1);
  });

  it('checkCurrencyReform returns null when no reform pending', () => {
    const sys = new EconomySystem('revolution', 'comrade');
    // Year 1920 — before any reforms
    expect(sys.checkCurrencyReform(1920, 10000)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  DIFFICULTY MULTIPLIERS
// ─────────────────────────────────────────────────────────────────────────────

describe('EconomySystem — Difficulty Multipliers', () => {
  const LEVELS: DifficultyLevel[] = ['worker', 'comrade', 'tovarish'];
  const FIELDS = [
    'quotaTarget',
    'startingResources',
    'birthRate',
    'decayRate',
    'politruksPer100',
    'fondyReliability',
    'deliveryRate',
    'eventSeverity',
    'markDecayRate',
    'starvationRate',
  ] as const;

  it('all difficulty levels have all required fields', () => {
    for (const level of LEVELS) {
      const mults = getDifficultyMultipliers(level);
      for (const field of FIELDS) {
        expect(mults[field]).toBeDefined();
        expect(typeof mults[field]).toBe('number');
      }
    }
  });

  it('comrade is baseline (1.0 for rate multipliers)', () => {
    const comrade = getDifficultyMultipliers('comrade');
    expect(comrade.quotaTarget).toBe(1.0);
    expect(comrade.startingResources).toBe(1.0);
    expect(comrade.birthRate).toBe(1.0);
    expect(comrade.decayRate).toBe(1.0);
    expect(comrade.fondyReliability).toBe(1.0);
    expect(comrade.deliveryRate).toBe(1.0);
    expect(comrade.eventSeverity).toBe(1.0);
  });

  it('worker is easier than comrade', () => {
    const worker = getDifficultyMultipliers('worker');
    expect(worker.quotaTarget).toBeLessThan(1.0);
    expect(worker.startingResources).toBeGreaterThan(1.0);
    expect(worker.decayRate).toBeLessThan(1.0);
    expect(worker.starvationRate).toBeLessThan(1.0);
  });

  it('tovarish is harder than comrade', () => {
    const tovarish = getDifficultyMultipliers('tovarish');
    expect(tovarish.quotaTarget).toBeGreaterThan(1.0);
    expect(tovarish.startingResources).toBeLessThan(1.0);
    expect(tovarish.decayRate).toBeGreaterThan(1.0);
    expect(tovarish.starvationRate).toBeGreaterThan(1.0);
  });

  it('getMultipliers returns current difficulty set', () => {
    const sys = new EconomySystem('stagnation', 'tovarish');
    const mults = sys.getMultipliers();
    expect(mults.quotaTarget).toBe(DIFFICULTY_MULTIPLIERS.tovarish.quotaTarget);
  });

  it('getDifficultyMultipliers returns independent copies', () => {
    const m1 = getDifficultyMultipliers('comrade');
    const m2 = getDifficultyMultipliers('comrade');
    m1.quotaTarget = 999;
    expect(m2.quotaTarget).toBe(1.0);
  });

  it('all multiplier values are positive', () => {
    for (const level of LEVELS) {
      const mults = getDifficultyMultipliers(level);
      for (const field of FIELDS) {
        expect(mults[field]).toBeGreaterThan(0);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  EXTENDED SERIALIZATION (Phase 2 state)
// ─────────────────────────────────────────────────────────────────────────────

describe('EconomySystem — Extended Serialization', () => {
  it('serializes and deserializes MTS state', () => {
    const sys = new EconomySystem('industrialization', 'comrade');
    sys.processMTS(1935, 10000);

    const data = sys.serialize();
    const restored = EconomySystem.deserialize(data);

    expect(restored.getMTS().active).toBe(sys.getMTS().active);
    expect(restored.getMTS().totalRentalSpent).toBe(sys.getMTS().totalRentalSpent);
    expect(restored.getMTS().tractorUnits).toBe(sys.getMTS().tractorUnits);
  });

  it('serializes and deserializes heating state', () => {
    const sys = new EconomySystem('stagnation', 'comrade');
    sys.processHeating(200, 6, true); // upgrades to district
    sys.processHeating(200, 6, true); // increment ticksSinceRepair

    const data = sys.serialize();
    const restored = EconomySystem.deserialize(data);

    expect(restored.getHeating().tier).toBe(sys.getHeating().tier);
    expect(restored.getHeating().ticksSinceRepair).toBe(sys.getHeating().ticksSinceRepair);
    expect(restored.getHeating().efficiency).toBe(sys.getHeating().efficiency);
  });

  it('serializes and deserializes currency reform state', () => {
    const sys = new EconomySystem('reconstruction', 'comrade');
    sys.checkCurrencyReform(1950, 10000); // Apply first pending reform

    const data = sys.serialize();
    const restored = EconomySystem.deserialize(data);

    const origReforms = sys.getCurrencyReforms();
    const restoredReforms = restored.getCurrencyReforms();

    expect(restoredReforms.length).toBe(origReforms.length);
    for (let i = 0; i < origReforms.length; i++) {
      expect(restoredReforms[i]!.year).toBe(origReforms[i]!.year);
      expect(restoredReforms[i]!.applied).toBe(origReforms[i]!.applied);
    }
  });

  it('deserialized system is independent from original', () => {
    const sys = new EconomySystem('stagnation', 'comrade');
    const data = sys.serialize();
    const restored = EconomySystem.deserialize(data);

    // Mutate original — should not affect restored
    sys.processMTS(1935, 10000);
    sys.processHeating(200, 6, true);
    sys.checkCurrencyReform(1950, 10000);

    expect(restored.getMTS().totalRentalSpent).toBe(0);
    expect(restored.getHeating().tier).toBe('pechka');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  tick() — WITH NEW SUBSYSTEMS
// ─────────────────────────────────────────────────────────────────────────────

describe('EconomySystem — tick() with new subsystems', () => {
  it('tick includes MTS result when year is in MTS era', () => {
    const sys = new EconomySystem('industrialization', 'comrade');
    const result = sys.tick(100, 1935, 100, ['kolkhoz'], { money: 10000 });
    expect(result.mtsResult).not.toBeNull();
    expect(result.mtsResult!.applied).toBe(true);
  });

  it('tick includes null MTS result when year is outside MTS era', () => {
    const sys = new EconomySystem('stagnation', 'comrade');
    const result = sys.tick(100, 1980, 100, ['kolkhoz'], { money: 10000 });
    expect(result.mtsResult).toBeNull();
  });

  it('tick includes heating result', () => {
    const sys = new EconomySystem('stagnation', 'comrade');
    const result = sys.tick(100, 1980, 100, ['factory'], {
      month: 6,
      hasHeatingResource: true,
    });
    expect(result.heatingResult).toBeDefined();
    expect(result.heatingResult!.operational).toBe(true);
  });

  it('tick applies currency reform when year matches', () => {
    const sys = new EconomySystem('reconstruction', 'comrade');
    // Year 1950 — should trigger 1924 reform (first unapplied, year <= 1950)
    const result = sys.tick(100, 1950, 100, ['factory'], { money: 50000 });
    expect(result.currencyReform).not.toBeNull();
    expect(result.currencyReform!.reform.year).toBe(1924);
  });
});

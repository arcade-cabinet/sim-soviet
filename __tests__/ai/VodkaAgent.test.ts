import type { VodkaAgentSnapshot, VodkaResourceView } from '../../src/ai/agents/economy/VodkaAgent';
import { GRAIN_TO_VODKA_RATIO, VODKA_MORALE_BONUS, VodkaAgent } from '../../src/ai/agents/economy/VodkaAgent';

function makeResources(overrides: Partial<VodkaResourceView> = {}): VodkaResourceView {
  return { food: 200, vodka: 0, population: 100, ...overrides };
}

describe('VodkaAgent', () => {
  // ── Instantiation ─────────────────────────────────────────────────────────

  it('can be instantiated with name VodkaAgent', () => {
    const agent = new VodkaAgent();
    expect(agent.name).toBe('VodkaAgent');
  });

  it('starts with diversion rate 1.0 and morale 50', () => {
    const agent = new VodkaAgent();
    expect(agent.getDiversionRate()).toBe(1.0);
    expect(agent.getMorale()).toBe(50);
    expect(agent.getShortageCounter()).toBe(0);
  });

  // ── Grain conversion ratio ────────────────────────────────────────────────

  it('converts grain to vodka at GRAIN_TO_VODKA_RATIO (1:1)', () => {
    expect(GRAIN_TO_VODKA_RATIO).toBe(1);
    const agent = new VodkaAgent();
    const resources = makeResources({ food: 100, vodka: 0, population: 0 });

    // rawVodkaOutput=10, each unit costs 1 grain → 10 grain consumed, 10 vodka produced
    const result = agent.tickVodka(10, resources, 1);
    expect(result.vodkaProduced).toBe(10);
    expect(result.grainConsumed).toBe(10);
    expect(resources.food).toBe(90);
    expect(resources.vodka).toBe(10);
  });

  it('produces proportionally when grain is insufficient', () => {
    const agent = new VodkaAgent();
    const resources = makeResources({ food: 6, vodka: 0, population: 0 });

    // rawVodkaOutput=10, but only 6 food → afford 6 vodka (6 / 1)
    const result = agent.tickVodka(10, resources, 1);
    expect(result.vodkaProduced).toBeCloseTo(6);
    expect(result.grainConsumed).toBeCloseTo(6);
    expect(resources.food).toBeCloseTo(0);
    expect(resources.vodka).toBeCloseTo(6);
  });

  // ── Consumption calculation ───────────────────────────────────────────────

  it('consumes ceil(population / 20) vodka per tick', () => {
    const agent = new VodkaAgent();
    // 200 citizens / 20 = 10 vodka needed
    const resources = makeResources({ food: 0, vodka: 50, population: 200 });
    const result = agent.tickVodka(0, resources, 1);
    expect(result.vodkaConsumed).toBe(10);
    expect(resources.vodka).toBe(40);
  });

  it('rounds up consumption for non-divisible populations', () => {
    const agent = new VodkaAgent();
    // 21 citizens / 20 = 1.05 → ceil = 2
    const resources = makeResources({ food: 0, vodka: 10, population: 21 });
    const result = agent.tickVodka(0, resources, 1);
    expect(result.vodkaConsumed).toBe(2);
  });

  it('scales consumption by consumptionMult', () => {
    const agent = new VodkaAgent();
    // 100 citizens / 20 = 5 * 2.0 = 10
    const resources = makeResources({ food: 0, vodka: 20, population: 100 });
    const result = agent.tickVodka(0, resources, 2.0);
    expect(result.vodkaConsumed).toBe(10);
  });

  // ── Morale bonus when supplied ────────────────────────────────────────────

  it('grants VODKA_MORALE_BONUS morale when demand is met', () => {
    expect(VODKA_MORALE_BONUS).toBe(20);
    const agent = new VodkaAgent();
    const initialMorale = agent.getMorale();

    const resources = makeResources({ food: 0, vodka: 50, population: 100 });
    const result = agent.tickVodka(0, resources, 1);

    expect(result.demandMet).toBe(true);
    expect(result.moraleDelta).toBe(VODKA_MORALE_BONUS);
    expect(agent.getMorale()).toBe(initialMorale + VODKA_MORALE_BONUS);
  });

  it('gives no morale bonus when demand is not met', () => {
    const agent = new VodkaAgent();
    const initialMorale = agent.getMorale();

    const resources = makeResources({ food: 0, vodka: 0, population: 100 });
    const result = agent.tickVodka(0, resources, 1);

    expect(result.demandMet).toBe(false);
    expect(result.moraleDelta).toBe(0);
    expect(agent.getMorale()).toBe(initialMorale);
  });

  it('caps morale at 100', () => {
    const agent = new VodkaAgent();
    // Drive morale near cap
    const resources = makeResources({ food: 0, vodka: 999, population: 20 });
    for (let i = 0; i < 10; i++) {
      agent.tickVodka(0, resources, 1);
      resources.vodka = 999; // replenish so demand is always met
    }
    expect(agent.getMorale()).toBe(100);
  });

  // ── Shortage detection ────────────────────────────────────────────────────

  it('detects VODKA_SHORTAGE when demand exceeds supply', () => {
    const agent = new VodkaAgent();
    const resources = makeResources({ food: 0, vodka: 0, population: 100 });
    const result = agent.tickVodka(0, resources, 1);
    expect(result.shortage).toBe(true);
    expect(agent.getShortageCounter()).toBe(1);
  });

  it('increments shortage counter on consecutive shortage ticks', () => {
    const agent = new VodkaAgent();
    for (let i = 0; i < 3; i++) {
      const resources = makeResources({ food: 0, vodka: 0, population: 100 });
      agent.tickVodka(0, resources, 1);
    }
    expect(agent.getShortageCounter()).toBe(3);
  });

  it('resets shortage counter when demand is met', () => {
    const agent = new VodkaAgent();
    // Two shortage ticks
    agent.tickVodka(0, makeResources({ food: 0, vodka: 0, population: 100 }), 1);
    agent.tickVodka(0, makeResources({ food: 0, vodka: 0, population: 100 }), 1);
    expect(agent.getShortageCounter()).toBe(2);

    // Now supply plenty of vodka
    agent.tickVodka(0, makeResources({ food: 0, vodka: 999, population: 100 }), 1);
    expect(agent.getShortageCounter()).toBe(0);
  });

  // ── Grain diversion decision ──────────────────────────────────────────────

  it('suspends grain diversion during food crisis (food per capita < 0.5)', () => {
    const agent = new VodkaAgent();
    // 10 food for 100 citizens = 0.1 food/capita → crisis
    const resources = makeResources({ food: 10, vodka: 0, population: 100 });
    const result = agent.tickVodka(10, resources, 1);
    expect(result.vodkaProduced).toBe(0);
    expect(result.grainConsumed).toBe(0);
    // Food should be untouched by production
    expect(resources.food).toBe(10);
  });

  it('ferments grain when food per capita is above crisis threshold', () => {
    const agent = new VodkaAgent();
    // 100 food for 100 citizens = 1.0 food/capita → no crisis
    const resources = makeResources({ food: 100, vodka: 0, population: 100 });
    const result = agent.tickVodka(5, resources, 1);
    expect(result.vodkaProduced).toBe(5);
    expect(result.grainConsumed).toBe(5);
  });

  it('setDiversionRate controls how much output is fermented', () => {
    const agent = new VodkaAgent();
    agent.setDiversionRate(0.5);
    // rawVodkaOutput=10 * 0.5 = 5 vodka, costing 5 food (1:1 ratio)
    const resources = makeResources({ food: 200, vodka: 0, population: 0 });
    const result = agent.tickVodka(10, resources, 1);
    expect(result.vodkaProduced).toBeCloseTo(5);
    expect(result.grainConsumed).toBeCloseTo(5);
  });

  it('clamps diversion rate to [0, 1]', () => {
    const agent = new VodkaAgent();
    agent.setDiversionRate(2.5);
    expect(agent.getDiversionRate()).toBe(1.0);
    agent.setDiversionRate(-0.5);
    expect(agent.getDiversionRate()).toBe(0.0);
  });

  it('produces no vodka when diversion rate is 0', () => {
    const agent = new VodkaAgent();
    agent.setDiversionRate(0);
    const resources = makeResources({ food: 200, vodka: 0, population: 0 });
    const result = agent.tickVodka(10, resources, 1);
    expect(result.vodkaProduced).toBe(0);
    expect(result.grainConsumed).toBe(0);
    expect(resources.food).toBe(200);
  });

  // ── Serialization round-trip ──────────────────────────────────────────────

  it('serializes and restores state correctly', () => {
    const agent = new VodkaAgent();
    agent.setDiversionRate(0.7);

    // Drive some ticks to set non-default state
    agent.tickVodka(0, makeResources({ food: 0, vodka: 0, population: 40 }), 1); // shortage
    agent.tickVodka(0, makeResources({ food: 0, vodka: 999, population: 40 }), 1); // supplied

    const snapshot: VodkaAgentSnapshot = agent.serialize();
    expect(snapshot.diversionRate).toBeCloseTo(0.7);
    expect(snapshot.morale).toBeGreaterThan(50); // morale boosted
    expect(snapshot.shortageCounter).toBe(0); // reset after supply

    const restored = new VodkaAgent();
    restored.restore(snapshot);

    expect(restored.getDiversionRate()).toBeCloseTo(snapshot.diversionRate);
    expect(restored.getMorale()).toBe(snapshot.morale);
    expect(restored.getShortageCounter()).toBe(snapshot.shortageCounter);
  });

  it('serialize/restore is a round-trip for shortage counter', () => {
    const agent = new VodkaAgent();
    for (let i = 0; i < 5; i++) {
      agent.tickVodka(0, makeResources({ food: 0, vodka: 0, population: 100 }), 1);
    }
    const snapshot = agent.serialize();
    expect(snapshot.shortageCounter).toBe(5);

    const restored = new VodkaAgent();
    restored.restore(snapshot);
    expect(restored.getShortageCounter()).toBe(5);
  });

  // ── No-population edge case ───────────────────────────────────────────────

  it('skips consumption when population is 0', () => {
    const agent = new VodkaAgent();
    const resources = makeResources({ food: 0, vodka: 10, population: 0 });
    const result = agent.tickVodka(0, resources, 1);
    expect(result.vodkaConsumed).toBe(0);
    expect(result.shortage).toBe(false);
    expect(resources.vodka).toBe(10);
  });
});

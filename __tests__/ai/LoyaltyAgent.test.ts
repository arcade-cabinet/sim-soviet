import { LoyaltyAgent } from '../../src/ai/agents/LoyaltyAgent';
import type { LoyaltyState } from '../../src/ai/agents/LoyaltyAgent';
import { MSG } from '../../src/ai/telegrams';
import { dvory } from '../../src/ecs/archetypes';
import { createDvor } from '../../src/ecs/factories';
import { world } from '../../src/ecs/world';

// Deterministic RNG helpers
const alwaysHigh = { random: () => 0.99 }; // never triggers chance events
const alwaysLow = { random: () => 0.01 };  // always triggers chance events

function makeDvor(loyalty: number) {
  const entity = createDvor(`dvor-${Math.random()}`, 'Ivanov', [
    { name: 'Ivan Ivanovich Ivanov', gender: 'male', age: 35 },
  ]);
  entity.dvor!.loyaltyToCollective = loyalty;
  return entity;
}

describe('LoyaltyAgent', () => {
  beforeEach(() => {
    world.clear();
  });

  afterEach(() => {
    world.clear();
  });

  // ── Instantiation ────────────────────────────────────────────────────────

  it('can be instantiated with name LoyaltyAgent', () => {
    const agent = new LoyaltyAgent();
    expect(agent.name).toBe('LoyaltyAgent');
  });

  it('exposes MSG constants', () => {
    expect(LoyaltyAgent.MSG.DVOR_DISLOYAL).toBe(MSG.DVOR_DISLOYAL);
    expect(LoyaltyAgent.MSG.SABOTAGE_EVENT).toBe(MSG.SABOTAGE_EVENT);
    expect(LoyaltyAgent.MSG.FLIGHT_RISK).toBe(MSG.FLIGHT_RISK);
  });

  // ── Loyalty adjustment ───────────────────────────────────────────────────

  it('increases loyalty when food is good (> 0.7)', () => {
    makeDvor(50);
    const agent = new LoyaltyAgent();
    agent.setFoodLevel(0.8);
    agent.setRng(alwaysHigh);

    agent.tickLoyalty('revolution', false);

    const dvor = dvory.entities[0]!.dvor!;
    expect(dvor.loyaltyToCollective).toBeCloseTo(50.15, 5);
  });

  it('decreases loyalty during starvation (food = 0)', () => {
    makeDvor(50);
    const agent = new LoyaltyAgent();
    agent.setFoodLevel(0);
    agent.setRng(alwaysHigh);

    agent.tickLoyalty('revolution', false);

    const dvor = dvory.entities[0]!.dvor!;
    expect(dvor.loyaltyToCollective).toBeCloseTo(49.2, 5);
  });

  it('does not change loyalty at mid-range food (0 < food <= 0.7)', () => {
    makeDvor(60);
    const agent = new LoyaltyAgent();
    agent.setFoodLevel(0.5);
    agent.setRng(alwaysHigh);

    agent.tickLoyalty('revolution', false);

    const dvor = dvory.entities[0]!.dvor!;
    expect(dvor.loyaltyToCollective).toBe(60);
  });

  it('clamps loyalty at 100 with good food', () => {
    makeDvor(99.95);
    const agent = new LoyaltyAgent();
    agent.setFoodLevel(0.9);
    agent.setRng(alwaysHigh);

    agent.tickLoyalty('revolution', false);

    const dvor = dvory.entities[0]!.dvor!;
    expect(dvor.loyaltyToCollective).toBe(100);
  });

  it('clamps loyalty at 0 during starvation', () => {
    makeDvor(0.3);
    const agent = new LoyaltyAgent();
    agent.setFoodLevel(0);
    agent.setRng(alwaysHigh);

    agent.tickLoyalty('revolution', false);

    const dvor = dvory.entities[0]!.dvor!;
    expect(dvor.loyaltyToCollective).toBe(0);
  });

  // ── Sabotage ─────────────────────────────────────────────────────────────

  it('triggers sabotage when loyalty < 20 and RNG fires', () => {
    makeDvor(10); // loyalty 10 < 20 threshold
    const agent = new LoyaltyAgent();
    agent.setFoodLevel(0.5);
    agent.setRng(alwaysLow); // always triggers

    const result = agent.tickLoyalty('revolution', false);
    expect(result.sabotageCount).toBe(1);
  });

  it('does not trigger sabotage when loyalty >= 20', () => {
    makeDvor(25); // loyalty above sabotage threshold
    const agent = new LoyaltyAgent();
    agent.setFoodLevel(0.5);
    agent.setRng(alwaysLow);

    const result = agent.tickLoyalty('revolution', false);
    expect(result.sabotageCount).toBe(0);
  });

  it('does not trigger sabotage when RNG does not fire', () => {
    makeDvor(10);
    const agent = new LoyaltyAgent();
    agent.setFoodLevel(0.5);
    agent.setRng(alwaysHigh); // never triggers

    const result = agent.tickLoyalty('revolution', false);
    expect(result.sabotageCount).toBe(0);
  });

  // ── Flight ────────────────────────────────────────────────────────────────

  it('triggers flight when loyalty < 10 and RNG fires', () => {
    makeDvor(5); // loyalty 5 < 10 threshold
    const agent = new LoyaltyAgent();
    agent.setFoodLevel(0.5);
    agent.setRng(alwaysLow);

    const result = agent.tickLoyalty('revolution', false);
    expect(result.flightCount).toBe(1);
  });

  it('does not trigger flight when loyalty >= 10', () => {
    makeDvor(15);
    const agent = new LoyaltyAgent();
    agent.setFoodLevel(0.5);
    agent.setRng(alwaysLow);

    const result = agent.tickLoyalty('revolution', false);
    expect(result.flightCount).toBe(0);
  });

  it('does not trigger flight when RNG does not fire', () => {
    makeDvor(5);
    const agent = new LoyaltyAgent();
    agent.setFoodLevel(0.5);
    agent.setRng(alwaysHigh);

    const result = agent.tickLoyalty('revolution', false);
    expect(result.flightCount).toBe(0);
  });

  // ── Average loyalty tracking ─────────────────────────────────────────────

  it('tracks average loyalty correctly across multiple dvory', () => {
    makeDvor(20);
    makeDvor(80);
    const agent = new LoyaltyAgent();
    agent.setFoodLevel(0.5); // mid-range: no loyalty change
    agent.setRng(alwaysHigh);

    const result = agent.tickLoyalty('revolution', false);
    expect(result.avgLoyalty).toBeCloseTo(50, 5);
    expect(agent.getAvgLoyalty()).toBeCloseTo(50, 5);
  });

  it('returns avgLoyalty of 50 when no dvory exist', () => {
    const agent = new LoyaltyAgent();
    const result = agent.tickLoyalty('revolution', false);
    expect(result.avgLoyalty).toBe(50);
  });

  // ── Sabotage penalty calculation ─────────────────────────────────────────

  it('calculates sabotage penalty as 5% per sabotaging dvor of total', () => {
    const agent = new LoyaltyAgent();
    // 1 saboteur out of 10: penalty = (1/10)*0.05*10 = 0.05
    const penalty = agent.calculateSabotagePenalty(1, 10);
    expect(penalty).toBeCloseTo(0.05, 5);
  });

  it('caps sabotage penalty at 50%', () => {
    const agent = new LoyaltyAgent();
    // many saboteurs: cap at 0.5
    const penalty = agent.calculateSabotagePenalty(100, 10);
    expect(penalty).toBe(0.5);
  });

  it('returns 0 penalty when no sabotage', () => {
    const agent = new LoyaltyAgent();
    expect(agent.calculateSabotagePenalty(0, 10)).toBe(0);
    expect(agent.calculateSabotagePenalty(5, 0)).toBe(0);
  });

  // ── Serialization round-trip ─────────────────────────────────────────────

  it('serializes and deserializes state correctly', () => {
    makeDvor(30);
    makeDvor(70);

    const agent = new LoyaltyAgent();
    agent.setFoodLevel(0.5);
    agent.setRng(alwaysHigh);
    agent.tickLoyalty('revolution', false);

    const saved: LoyaltyState = agent.toJSON();
    expect(saved.avgLoyalty).toBeDefined();
    expect(saved.foodLevel).toBe(0.5);

    const agent2 = new LoyaltyAgent();
    agent2.fromJSON(saved);

    expect(agent2.getAvgLoyalty()).toBe(agent.getAvgLoyalty());
    expect(agent2.getSabotageCount()).toBe(agent.getSabotageCount());
    expect(agent2.getFlightCount()).toBe(agent.getFlightCount());

    const restored = agent2.toJSON();
    expect(restored.avgLoyalty).toBe(saved.avgLoyalty);
    expect(restored.foodLevel).toBe(saved.foodLevel);
    expect(restored.sabotageCount).toBe(saved.sabotageCount);
    expect(restored.flightCount).toBe(saved.flightCount);
  });
});

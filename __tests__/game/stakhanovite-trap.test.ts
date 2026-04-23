/**
 * Tests for the Stakhanovite Trap — strengthened consequences for being
 * labeled as someone who does MORE for the party than is reasonable.
 *
 * Covers:
 * - New config values (neighborMoralePenalty, sabotageChance, fraudExposureChance, etc.)
 * - Quota escalation increased from 15% to 25% base
 * - Neighbor morale penalty applies
 * - Sabotage chance fires at 5%
 * - Fraud exposure chance fires at 8%
 * - WorkerSystem.applyGlobalMoraleDelta works correctly
 */

import { createMetaStore, createResourceStore } from '@/ecs/factories';
import { world } from '@/ecs/world';
import {
  EconomySystem,
  STAKHANOVITE_CHANCE,
  STAKHANOVITE_CONFIG,
  type StakhanoviteEvent,
} from '../../src/ai/agents/economy/economy-core';
import { WorkerSystem } from '../../src/ai/agents/workforce/WorkerSystem';
import { GameRng } from '../../src/game/SeedSystem';

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Brute-force find a seed that produces a Stakhanovite event. */
function findStakhanoviteEvent(
  buildings: string[] = ['factory', 'coal-plant'],
  maxAttempts = 5000,
): { event: StakhanoviteEvent; rng: GameRng; sys: EconomySystem } | null {
  for (let i = 0; i < maxAttempts; i++) {
    const rng = new GameRng(`stakh-trap-${i}`);
    const sys = new EconomySystem();
    sys.setRng(rng);
    const event = sys.checkStakhanovite(buildings);
    if (event) return { event, rng, sys };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  TESTS — STAKHANOVITE_CONFIG values
// ─────────────────────────────────────────────────────────────────────────────

describe('STAKHANOVITE_CONFIG', () => {
  it('has correct chance value', () => {
    expect(STAKHANOVITE_CONFIG.chance).toBe(0.001);
    expect(STAKHANOVITE_CHANCE).toBe(0.001);
  });

  it('has correct production boost range', () => {
    expect(STAKHANOVITE_CONFIG.productionBoostMin).toBe(1.5);
    expect(STAKHANOVITE_CONFIG.productionBoostRange).toBe(2.5);
  });

  it('has correct propaganda range', () => {
    expect(STAKHANOVITE_CONFIG.propagandaMin).toBe(10);
    expect(STAKHANOVITE_CONFIG.propagandaRange).toBe(40);
  });

  it('has bounded quotaIncreaseBase for 1.0 campaign playability', () => {
    expect(STAKHANOVITE_CONFIG.quotaIncreaseBase).toBe(0.04);
  });

  it('has bounded quotaIncreaseRange for 1.0 campaign playability', () => {
    expect(STAKHANOVITE_CONFIG.quotaIncreaseRange).toBe(0.04);
  });

  it('has neighborMoralePenalty of 8', () => {
    expect(STAKHANOVITE_CONFIG.neighborMoralePenalty).toBe(8);
  });

  it('has coworkerSabotageChance of 0.05 (5%)', () => {
    expect(STAKHANOVITE_CONFIG.coworkerSabotageChance).toBe(0.05);
  });

  it('has fraudExposureChance of 0.08 (8%)', () => {
    expect(STAKHANOVITE_CONFIG.fraudExposureChance).toBe(0.08);
  });

  it('has nextPlanEscalation of 1.05', () => {
    expect(STAKHANOVITE_CONFIG.nextPlanEscalation).toBe(1.05);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  TESTS — StakhanoviteEvent new fields
// ─────────────────────────────────────────────────────────────────────────────

describe('StakhanoviteEvent — new consequence fields', () => {
  it('event includes neighborMoralePenalty field', () => {
    const result = findStakhanoviteEvent();
    expect(result).not.toBeNull();
    expect(result!.event.neighborMoralePenalty).toBe(STAKHANOVITE_CONFIG.neighborMoralePenalty);
  });

  it('event includes sabotageFired boolean', () => {
    const result = findStakhanoviteEvent();
    expect(result).not.toBeNull();
    expect(typeof result!.event.sabotageFired).toBe('boolean');
  });

  it('event includes fraudExposed boolean', () => {
    const result = findStakhanoviteEvent();
    expect(result).not.toBeNull();
    expect(typeof result!.event.fraudExposed).toBe('boolean');
  });

  it('event includes nextPlanEscalation multiplier', () => {
    const result = findStakhanoviteEvent();
    expect(result).not.toBeNull();
    expect(result!.event.nextPlanEscalation).toBe(STAKHANOVITE_CONFIG.nextPlanEscalation);
  });

  it('quota increase stays within the bounded 1.0 range', () => {
    const result = findStakhanoviteEvent();
    expect(result).not.toBeNull();
    const event = result!.event;
    expect(event.quotaIncrease).toBeGreaterThanOrEqual(0.04);
    expect(event.quotaIncrease).toBeLessThanOrEqual(0.08);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  TESTS — Sabotage chance fires at 5%
// ─────────────────────────────────────────────────────────────────────────────

describe('Stakhanovite — coworker sabotage', () => {
  it('sabotage fires in approximately 5% of events', () => {
    let sabotageCount = 0;
    let eventCount = 0;

    for (let i = 0; i < 50000; i++) {
      const rng = new GameRng(`stakh-sabotage-${i}`);
      const sys = new EconomySystem();
      sys.setRng(rng);
      const event = sys.checkStakhanovite(['factory', 'coal-plant']);
      if (event) {
        eventCount++;
        if (event.sabotageFired) sabotageCount++;
      }
    }

    // Need enough events to get a meaningful ratio
    expect(eventCount).toBeGreaterThan(20);
    const ratio = sabotageCount / eventCount;
    // Allow wide tolerance since we're sampling from a small probability
    expect(ratio).toBeGreaterThan(0.01);
    expect(ratio).toBeLessThan(0.15);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  TESTS — Fraud exposure chance fires at 8%
// ─────────────────────────────────────────────────────────────────────────────

describe('Stakhanovite — fraud exposure', () => {
  it('fraud fires in approximately 8% of events', () => {
    let fraudCount = 0;
    let eventCount = 0;

    for (let i = 0; i < 50000; i++) {
      const rng = new GameRng(`stakh-fraud-${i}`);
      const sys = new EconomySystem();
      sys.setRng(rng);
      const event = sys.checkStakhanovite(['factory', 'coal-plant']);
      if (event) {
        eventCount++;
        if (event.fraudExposed) fraudCount++;
      }
    }

    expect(eventCount).toBeGreaterThan(20);
    const ratio = fraudCount / eventCount;
    // Allow wide tolerance
    expect(ratio).toBeGreaterThan(0.02);
    expect(ratio).toBeLessThan(0.2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  TESTS — WorkerSystem.applyGlobalMoraleDelta
// ─────────────────────────────────────────────────────────────────────────────

describe('WorkerSystem — applyGlobalMoraleDelta', () => {
  beforeEach(() => {
    world.clear();
    createResourceStore();
    createMetaStore();
  });

  afterEach(() => {
    world.clear();
  });

  it('reduces morale by given delta', () => {
    const rng = new GameRng('morale-delta-test');
    const ws = new WorkerSystem(rng);

    // Spawn some workers
    ws.syncPopulation(10);
    const moraleBefore = ws.getAverageMorale();

    ws.applyGlobalMoraleDelta(-8);
    const moraleAfter = ws.getAverageMorale();

    // Morale should have decreased (approximately by 8, but clamped at 0-100)
    expect(moraleAfter).toBeLessThan(moraleBefore);
    // The delta should be close to -8 if morale wasn't already near 0
    if (moraleBefore > 10) {
      expect(moraleBefore - moraleAfter).toBeCloseTo(8, 0);
    }
  });

  it('clamps morale at 0 (no negative morale)', () => {
    const rng = new GameRng('morale-clamp-zero');
    const ws = new WorkerSystem(rng);

    ws.syncPopulation(5);
    // Apply massive penalty
    ws.applyGlobalMoraleDelta(-200);
    const morale = ws.getAverageMorale();
    expect(morale).toBeGreaterThanOrEqual(0);
  });

  it('clamps morale at 100 (no excess morale)', () => {
    const rng = new GameRng('morale-clamp-hundred');
    const ws = new WorkerSystem(rng);

    ws.syncPopulation(5);
    // Apply massive boost
    ws.applyGlobalMoraleDelta(200);
    const morale = ws.getAverageMorale();
    expect(morale).toBeLessThanOrEqual(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  TESTS — Determinism with new fields
// ─────────────────────────────────────────────────────────────────────────────

describe('Stakhanovite — determinism with new consequence fields', () => {
  it('same seed produces identical consequence rolls', () => {
    const make = () => {
      const rng = new GameRng('determinism-stakh-trap');
      const sys = new EconomySystem();
      sys.setRng(rng);
      return sys.checkStakhanovite(['factory', 'coal-plant']);
    };

    const result1 = make();
    const result2 = make();

    // Both should be identical (both null or both matching)
    if (result1 === null) {
      expect(result2).toBeNull();
    } else {
      expect(result2).not.toBeNull();
      expect(result1.sabotageFired).toBe(result2!.sabotageFired);
      expect(result1.fraudExposed).toBe(result2!.fraudExposed);
      expect(result1.neighborMoralePenalty).toBe(result2!.neighborMoralePenalty);
      expect(result1.nextPlanEscalation).toBe(result2!.nextPlanEscalation);
      expect(result1.quotaIncrease).toBe(result2!.quotaIncrease);
      expect(result1.productionBoost).toBe(result2!.productionBoost);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  TESTS — Event templates exist
// ─────────────────────────────────────────────────────────────────────────────

describe('Stakhanovite — economic event templates', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ECONOMIC_EVENTS } = require('../../src/ai/agents/narrative/events/templates/economic');

  it('has stakhanovite_sabotage template', () => {
    const tmpl = ECONOMIC_EVENTS.find((e: { id: string }) => e.id === 'stakhanovite_sabotage');
    expect(tmpl).toBeDefined();
    expect(tmpl.category).toBe('economic');
    expect(tmpl.severity).toBe('minor');
  });

  it('has stakhanovite_fraud_exposed template', () => {
    const tmpl = ECONOMIC_EVENTS.find((e: { id: string }) => e.id === 'stakhanovite_fraud_exposed');
    expect(tmpl).toBeDefined();
    expect(tmpl.category).toBe('economic');
    expect(tmpl.severity).toBe('major');
  });

  it('has stakhanovite_quota_cascade template', () => {
    const tmpl = ECONOMIC_EVENTS.find((e: { id: string }) => e.id === 'stakhanovite_quota_cascade');
    expect(tmpl).toBeDefined();
    expect(tmpl.category).toBe('economic');
    expect(tmpl.severity).toBe('major');
  });

  it('consequence templates have weight 0 (not randomly triggered)', () => {
    const ids = ['stakhanovite_sabotage', 'stakhanovite_fraud_exposed', 'stakhanovite_quota_cascade'];
    for (const id of ids) {
      const tmpl = ECONOMIC_EVENTS.find((e: { id: string }) => e.id === id);
      expect(tmpl).toBeDefined();
      expect(tmpl.weight).toBe(0);
    }
  });
});

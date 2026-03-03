/**
 * @fileoverview Tests for DisasterAgent — parameterized disaster crisis agent.
 *
 * Covers all four disaster subtypes (nuclear, seismic, environmental, industrial),
 * phase transitions, aftermath exponential decay, and serialization round-trips.
 */

import { aftermathDecay, DisasterAgent } from '@/ai/agents/crisis/DisasterAgent';
import type { CrisisContext, CrisisDefinition, CrisisImpact } from '@/ai/agents/crisis/types';
import { GameRng } from '@/game/SeedSystem';

// ─── Fixtures ───────────────────────────────────────────────────────────────

/** Nuclear disaster — high disease, moderate destruction, very long aftermath. */
const CHERNOBYL: CrisisDefinition = {
  id: 'chernobyl',
  type: 'disaster',
  name: 'Chernobyl Disaster',
  startYear: 1986,
  endYear: 1990,
  severity: 'national',
  peakParams: {
    destructionCount: 3,
    casualtyCount: 31,
    moneyCost: 500,
    productionMult: 0.5,
    diseaseMult: 3.0,
    decayMult: 2.0,
    moralePenalty: -0.5,
    growthMult: 0.7,
  },
  buildupTicks: 2,
  aftermathTicks: 120,
};

/** Environmental disaster — near-zero immediate damage, decades of decline. */
const ARAL_SEA: CrisisDefinition = {
  id: 'aral_sea',
  type: 'disaster',
  name: 'Aral Sea Desiccation',
  startYear: 1960,
  endYear: 1990,
  severity: 'regional',
  peakParams: {
    destructionCount: 0,
    casualtyCount: 0,
    moneyCost: 100,
    productionMult: 0.6,
    diseaseMult: 1.5,
    decayMult: 1.2,
    moralePenalty: -0.1,
    growthMult: 0.8,
  },
  buildupTicks: 12,
  aftermathTicks: 360,
};

/** Seismic disaster — high destruction, high casualties, short aftermath. */
const ARMENIAN_EARTHQUAKE: CrisisDefinition = {
  id: 'armenian_earthquake',
  type: 'disaster',
  name: 'Armenian Earthquake',
  startYear: 1988,
  endYear: 1989,
  severity: 'localized',
  peakParams: {
    destructionCount: 10,
    casualtyCount: 200,
    moneyCost: 300,
    productionMult: 0.3,
    diseaseMult: 1.3,
    decayMult: 1.5,
    moralePenalty: -0.6,
    growthMult: 0.9,
  },
  buildupTicks: 0,
  aftermathTicks: 12,
};

/** Industrial disaster — localized destruction + casualties, short aftermath. */
const FACTORY_EXPLOSION: CrisisDefinition = {
  id: 'factory_explosion',
  type: 'disaster',
  name: 'Nedelin Catastrophe',
  startYear: 1960,
  endYear: 1961,
  severity: 'localized',
  peakParams: {
    destructionCount: 2,
    casualtyCount: 78,
    moneyCost: 200,
    productionMult: 0.7,
    diseaseMult: 1.0,
    decayMult: 1.3,
    moralePenalty: -0.4,
  },
  buildupTicks: 1,
  aftermathTicks: 8,
};

function makeContext(overrides?: Partial<CrisisContext>): CrisisContext {
  return {
    year: 1986,
    month: 4,
    population: 5000,
    food: 1000,
    money: 5000,
    rng: new GameRng('test-disaster'),
    activeCrises: [],
    ...overrides,
  };
}

/** Advance the agent N ticks, collecting all impacts. */
function advanceTicks(agent: DisasterAgent, count: number, ctxOverrides?: Partial<CrisisContext>): CrisisImpact[] {
  const allImpacts: CrisisImpact[] = [];
  for (let i = 0; i < count; i++) {
    const impacts = agent.evaluate(makeContext(ctxOverrides));
    allImpacts.push(...impacts);
  }
  return allImpacts;
}

// ─── Chernobyl (Nuclear) ────────────────────────────────────────────────────

describe('DisasterAgent — Chernobyl (nuclear subtype)', () => {
  let agent: DisasterAgent;

  beforeEach(() => {
    agent = new DisasterAgent();
    agent.configure(CHERNOBYL);
  });

  it('starts in resolved phase before startYear', () => {
    expect(agent.getPhase()).toBe('resolved');
    expect(agent.isActive()).toBe(false);
    const impacts = agent.evaluate(makeContext({ year: 1985 }));
    expect(impacts).toHaveLength(0);
    expect(agent.getPhase()).toBe('resolved');
  });

  it('enters buildup phase at startYear', () => {
    agent.evaluate(makeContext({ year: 1986 }));
    expect(agent.getPhase()).toBe('buildup');
    expect(agent.isActive()).toBe(true);
  });

  it('buildup phase produces warning toasts and minor production dip', () => {
    const impacts = advanceTicks(agent, 1, { year: 1986 });
    expect(impacts).toHaveLength(1);
    const impact = impacts[0]!;

    // Warning toast on first buildup tick
    expect(impact.narrative?.toastMessages).toBeDefined();
    expect(impact.narrative!.toastMessages!.length).toBeGreaterThan(0);
    expect(impact.narrative!.toastMessages![0]!.severity).toBe('warning');

    // Minor production dip (30% of peak penalty at most)
    if (impact.economy?.productionMult !== undefined) {
      expect(impact.economy.productionMult).toBeGreaterThan(0.8);
      expect(impact.economy.productionMult).toBeLessThanOrEqual(1.0);
    }
  });

  it('transitions to peak after buildupTicks', () => {
    // 2 buildup ticks, then transitions
    advanceTicks(agent, 2, { year: 1986 });
    expect(agent.getPhase()).toBe('peak');
  });

  it('peak phase destroys buildings and causes casualties', () => {
    // Advance through buildup (2 ticks → transitions to peak)
    advanceTicks(agent, 2, { year: 1986 });
    expect(agent.getPhase()).toBe('peak');

    // Peak tick
    const peakImpacts = agent.evaluate(makeContext({ year: 1986 }));
    expect(peakImpacts).toHaveLength(1);
    const peak = peakImpacts[0]!;

    // Destruction
    expect(peak.infrastructure?.destructionTargets).toBeDefined();
    expect(peak.infrastructure!.destructionTargets!).toHaveLength(3);
    for (const target of peak.infrastructure!.destructionTargets!) {
      expect(target.gridX).toBeGreaterThanOrEqual(0);
      expect(target.gridX).toBeLessThanOrEqual(29);
      expect(target.gridY).toBeGreaterThanOrEqual(0);
      expect(target.gridY).toBeLessThanOrEqual(29);
    }

    // Casualties
    expect(peak.workforce?.casualtyCount).toBe(31);
    expect(peak.workforce?.moraleModifier).toBe(-0.5);

    // Money cost
    expect(peak.economy?.moneyDelta).toBe(-500);

    // Production hit
    expect(peak.economy?.productionMult).toBe(0.5);

    // Narrative
    expect(peak.narrative?.toastMessages).toBeDefined();
    expect(peak.narrative!.toastMessages![0]!.severity).toBe('critical');
    expect(peak.narrative!.pravdaHeadlines).toBeDefined();
  });

  it('transitions to aftermath after peak tick', () => {
    // Buildup (2 ticks) → peak
    advanceTicks(agent, 2, { year: 1986 });
    expect(agent.getPhase()).toBe('peak');

    // Peak tick → transitions to aftermath
    agent.evaluate(makeContext({ year: 1986 }));
    expect(agent.getPhase()).toBe('aftermath');
  });

  it('aftermath has elevated disease and decay that decay over time', () => {
    // Fast-forward to aftermath: 2 buildup + 1 peak = 3 ticks
    advanceTicks(agent, 3, { year: 1986 });
    expect(agent.getPhase()).toBe('aftermath');

    // First aftermath tick — high values
    const earlyImpacts = agent.evaluate(makeContext({ year: 1986 }));
    expect(earlyImpacts).toHaveLength(1);
    const early = earlyImpacts[0]!;
    expect(early.social?.diseaseMult).toBeGreaterThan(2.0);
    expect(early.infrastructure?.decayMult).toBeGreaterThan(1.5);

    // Advance most of the aftermath
    advanceTicks(agent, 100, { year: 1988 });

    // Late aftermath tick — values should be lower
    const lateImpacts = agent.evaluate(makeContext({ year: 1989 }));
    expect(lateImpacts).toHaveLength(1);
    const late = lateImpacts[0]!;

    // Disease should have decayed significantly
    if (late.social?.diseaseMult !== undefined) {
      expect(late.social.diseaseMult).toBeLessThan(early.social!.diseaseMult!);
      expect(late.social.diseaseMult).toBeGreaterThanOrEqual(1.0);
    }
  });

  it('resolves after aftermathTicks', () => {
    // Fast-forward to aftermath: 2 buildup + 1 peak = 3 ticks
    advanceTicks(agent, 3, { year: 1986 });
    expect(agent.getPhase()).toBe('aftermath');

    // Run through all aftermath ticks (120)
    advanceTicks(agent, 120, { year: 1990 });

    // Should now be resolved
    expect(agent.getPhase()).toBe('resolved');
    expect(agent.isActive()).toBe(false);

    const impacts = agent.evaluate(makeContext({ year: 1991 }));
    expect(impacts).toHaveLength(0);
  });
});

// ─── Aral Sea (Environmental) ───────────────────────────────────────────────

describe('DisasterAgent — Aral Sea (environmental subtype)', () => {
  let agent: DisasterAgent;

  beforeEach(() => {
    agent = new DisasterAgent();
    agent.configure(ARAL_SEA);
  });

  it('has a long buildup phase', () => {
    advanceTicks(agent, 1, { year: 1960 });
    expect(agent.getPhase()).toBe('buildup');

    // Still in buildup after 10 more ticks (11 total, need 12)
    advanceTicks(agent, 10, { year: 1960 });
    expect(agent.getPhase()).toBe('buildup');
  });

  it('peak causes no destruction and no casualties', () => {
    // Advance through 12-tick buildup → transitions to peak
    advanceTicks(agent, 12, { year: 1960 });
    expect(agent.getPhase()).toBe('peak');

    const peakImpacts = agent.evaluate(makeContext({ year: 1960 }));
    expect(peakImpacts).toHaveLength(1);
    const peak = peakImpacts[0]!;

    // No destruction (destructionCount = 0)
    expect(peak.infrastructure?.destructionTargets).toBeUndefined();

    // No casualties (casualtyCount = 0)
    expect(peak.workforce?.casualtyCount).toBeUndefined();
  });

  it('peak still has minor morale penalty', () => {
    advanceTicks(agent, 12, { year: 1960 });
    const peakImpacts = agent.evaluate(makeContext({ year: 1960 }));
    const peak = peakImpacts[0]!;
    expect(peak.workforce?.moraleModifier).toBe(-0.1);
  });

  it('has decades-long aftermath with production decline', () => {
    // Fast-forward to aftermath: 12 buildup + 1 peak = 13 ticks
    advanceTicks(agent, 13, { year: 1960 });
    expect(agent.getPhase()).toBe('aftermath');

    // Early aftermath — significant production hit
    const earlyImpacts = agent.evaluate(makeContext({ year: 1965 }));
    const early = earlyImpacts[0]!;
    expect(early.economy?.productionMult).toBeDefined();
    expect(early.economy!.productionMult!).toBeLessThan(0.8);

    // Much later — production recovering
    advanceTicks(agent, 300, { year: 1985 });
    const lateImpacts = agent.evaluate(makeContext({ year: 1988 }));
    const late = lateImpacts[0]!;

    if (late.economy?.productionMult !== undefined) {
      expect(late.economy.productionMult).toBeGreaterThan(early.economy!.productionMult!);
    }
  });

  it('aftermath spans 360 ticks before resolving', () => {
    // Fast-forward to aftermath: 12 buildup + 1 peak = 13 ticks
    advanceTicks(agent, 13, { year: 1960 });
    expect(agent.getPhase()).toBe('aftermath');

    // Not resolved after 359 ticks
    advanceTicks(agent, 359, { year: 1988 });
    expect(agent.getPhase()).toBe('aftermath');

    // Resolved after 360th tick
    agent.evaluate(makeContext({ year: 1990 }));
    expect(agent.getPhase()).toBe('resolved');
  });
});

// ─── Armenian Earthquake (Seismic) ──────────────────────────────────────────

describe('DisasterAgent — Armenian Earthquake (seismic subtype)', () => {
  let agent: DisasterAgent;

  beforeEach(() => {
    agent = new DisasterAgent();
    agent.configure(ARMENIAN_EARTHQUAKE);
  });

  it('zero buildup — goes straight to peak', () => {
    agent.evaluate(makeContext({ year: 1988 }));
    // With 0 buildup ticks, first evaluate enters peak directly
    // After the peak tick evaluates, it transitions to aftermath
    expect(agent.getPhase()).toBe('aftermath');
  });

  it('causes high destruction and casualties at peak', () => {
    // With 0 buildup, first tick IS the peak tick
    const peakImpacts = agent.evaluate(makeContext({ year: 1988 }));
    expect(peakImpacts).toHaveLength(1);
    const peak = peakImpacts[0]!;

    // 10 buildings destroyed
    expect(peak.infrastructure?.destructionTargets).toHaveLength(10);

    // 200 casualties
    expect(peak.workforce?.casualtyCount).toBe(200);
    expect(peak.workforce?.moraleModifier).toBe(-0.6);
  });

  it('casualties are capped at population', () => {
    const peakImpacts = agent.evaluate(makeContext({ year: 1988, population: 50 }));
    const peak = peakImpacts[0]!;
    expect(peak.workforce?.casualtyCount).toBe(50);
  });

  it('has short aftermath (12 ticks)', () => {
    // First tick: peak (0 buildup) → aftermath
    agent.evaluate(makeContext({ year: 1988 }));
    expect(agent.getPhase()).toBe('aftermath');

    // 12 aftermath ticks
    advanceTicks(agent, 12, { year: 1989 });
    expect(agent.getPhase()).toBe('resolved');
  });

  it('severe production impact at peak', () => {
    const peakImpacts = agent.evaluate(makeContext({ year: 1988 }));
    const peak = peakImpacts[0]!;
    expect(peak.economy?.productionMult).toBe(0.3);
  });
});

// ─── Factory Explosion (Industrial) ─────────────────────────────────────────

describe('DisasterAgent — Factory Explosion (industrial subtype)', () => {
  let agent: DisasterAgent;

  beforeEach(() => {
    agent = new DisasterAgent();
    agent.configure(FACTORY_EXPLOSION);
  });

  it('has short 1-tick buildup', () => {
    advanceTicks(agent, 1, { year: 1960 });
    // After 1 tick of buildup (== buildupTicks), transitions to peak
    expect(agent.getPhase()).toBe('peak');
  });

  it('localized destruction at peak', () => {
    advanceTicks(agent, 1, { year: 1960 }); // buildup → peak
    expect(agent.getPhase()).toBe('peak');

    const peakImpacts = agent.evaluate(makeContext({ year: 1960 }));
    const peak = peakImpacts[0]!;

    expect(peak.infrastructure?.destructionTargets).toHaveLength(2);
    expect(peak.workforce?.casualtyCount).toBe(78);
    expect(peak.economy?.moneyDelta).toBe(-200);
  });

  it('no disease amplification (diseaseMult = 1.0)', () => {
    // Fast-forward to aftermath: 1 buildup + 1 peak = 2 ticks
    advanceTicks(agent, 2, { year: 1960 });
    expect(agent.getPhase()).toBe('aftermath');

    const impacts = agent.evaluate(makeContext({ year: 1960 }));
    const impact = impacts[0]!;

    // diseaseMult = 1.0, so no social.diseaseMult emitted
    expect(impact.social?.diseaseMult).toBeUndefined();
  });

  it('short aftermath (8 ticks)', () => {
    // 1 buildup + 1 peak = 2 ticks to reach aftermath
    advanceTicks(agent, 2, { year: 1960 });
    expect(agent.getPhase()).toBe('aftermath');

    advanceTicks(agent, 8, { year: 1961 });
    expect(agent.getPhase()).toBe('resolved');
  });
});

// ─── Phase Transitions ──────────────────────────────────────────────────────

describe('DisasterAgent — phase transitions', () => {
  it('follows resolved → buildup → peak → aftermath → resolved', () => {
    const agent = new DisasterAgent();
    agent.configure(FACTORY_EXPLOSION); // 1 buildup, 8 aftermath

    expect(agent.getPhase()).toBe('resolved');

    // Tick 1: enter buildup, evaluate, then buildup(1) >= buildupTicks(1) → peak
    agent.evaluate(makeContext({ year: 1960 }));
    expect(agent.getPhase()).toBe('peak');

    // Tick 2: peak evaluation → aftermath
    agent.evaluate(makeContext({ year: 1960 }));
    expect(agent.getPhase()).toBe('aftermath');

    // Ticks 3-9: aftermath (7 ticks, need 8 total)
    for (let i = 0; i < 7; i++) {
      agent.evaluate(makeContext({ year: 1960 }));
      expect(agent.getPhase()).toBe('aftermath');
    }

    // Tick 10: aftermath tick 8 → resolved
    agent.evaluate(makeContext({ year: 1961 }));
    expect(agent.getPhase()).toBe('resolved');
    expect(agent.isActive()).toBe(false);
  });

  it('unconfigured agent returns no impacts', () => {
    const agent = new DisasterAgent();
    const impacts = agent.evaluate(makeContext());
    expect(impacts).toHaveLength(0);
    expect(agent.isActive()).toBe(false);
  });

  it('does not re-activate after resolution', () => {
    const agent = new DisasterAgent();
    agent.configure(ARMENIAN_EARTHQUAKE); // 0 buildup, 12 aftermath

    // Run through entire lifecycle: 1 peak + 12 aftermath = 13 ticks
    agent.evaluate(makeContext({ year: 1988 })); // peak → aftermath
    advanceTicks(agent, 12, { year: 1989 }); // aftermath → resolved

    expect(agent.getPhase()).toBe('resolved');

    // Further evaluations do nothing (even though year >= startYear)
    const impacts = agent.evaluate(makeContext({ year: 1990 }));
    expect(impacts).toHaveLength(0);
    expect(agent.getPhase()).toBe('resolved');
  });
});

// ─── Aftermath Decay Curves ─────────────────────────────────────────────────

describe('DisasterAgent — aftermath decay curves', () => {
  it('aftermathDecay function returns correct values', () => {
    // At t=0: should be 1.0
    expect(aftermathDecay(0, 100)).toBe(1.0);

    // At t=T: should be ~0.05
    expect(aftermathDecay(100, 100)).toBeCloseTo(Math.exp(-3), 5);

    // Monotonically decreasing
    const v1 = aftermathDecay(10, 100);
    const v2 = aftermathDecay(50, 100);
    const v3 = aftermathDecay(90, 100);
    expect(v1).toBeGreaterThan(v2);
    expect(v2).toBeGreaterThan(v3);

    // Edge case: 0 total ticks
    expect(aftermathDecay(0, 0)).toBe(0);
  });

  it('disease multiplier decays exponentially from peak', () => {
    const agent = new DisasterAgent();
    agent.configure(CHERNOBYL); // diseaseMult: 3.0, aftermathTicks: 120

    // Advance to aftermath: 2 buildup + 1 peak = 3 ticks
    advanceTicks(agent, 3, { year: 1986 });
    expect(agent.getPhase()).toBe('aftermath');

    // Collect disease values at intervals
    const diseaseValues: number[] = [];
    for (let i = 0; i < 120; i++) {
      const impacts = agent.evaluate(makeContext({ year: 1987 }));
      if (impacts.length > 0 && impacts[0]!.social?.diseaseMult !== undefined) {
        diseaseValues.push(impacts[0]!.social!.diseaseMult!);
      }
    }

    // Should have values for all 120 ticks
    expect(diseaseValues.length).toBe(120);

    // Monotonically decreasing
    for (let i = 1; i < diseaseValues.length; i++) {
      expect(diseaseValues[i]!).toBeLessThanOrEqual(diseaseValues[i - 1]!);
    }

    // First value should be close to peak (3.0)
    expect(diseaseValues[0]!).toBeGreaterThan(2.5);

    // Last value should be close to 1.0
    expect(diseaseValues[diseaseValues.length - 1]!).toBeLessThan(1.2);
    expect(diseaseValues[diseaseValues.length - 1]!).toBeGreaterThanOrEqual(1.0);
  });

  it('production multiplier recovers toward 1.0 over aftermath', () => {
    const agent = new DisasterAgent();
    agent.configure(CHERNOBYL); // productionMult: 0.5, aftermathTicks: 120

    // Advance to aftermath: 2 buildup + 1 peak = 3 ticks
    advanceTicks(agent, 3, { year: 1986 });
    expect(agent.getPhase()).toBe('aftermath');

    // Early aftermath — production still severely impacted
    const earlyImpacts = agent.evaluate(makeContext({ year: 1987 }));
    const earlyProd = earlyImpacts[0]!.economy?.productionMult;
    expect(earlyProd).toBeDefined();
    expect(earlyProd!).toBeLessThan(0.7);

    // Late aftermath — production recovering
    advanceTicks(agent, 110, { year: 1989 });
    const lateImpacts = agent.evaluate(makeContext({ year: 1990 }));
    const lateProd = lateImpacts[0]!.economy?.productionMult;

    if (lateProd !== undefined) {
      expect(lateProd).toBeGreaterThan(earlyProd!);
    }
  });

  it('infrastructure decay multiplier decays toward 1.0', () => {
    const agent = new DisasterAgent();
    agent.configure(CHERNOBYL); // decayMult: 2.0, aftermathTicks: 120

    // Advance to aftermath: 2 buildup + 1 peak = 3 ticks
    advanceTicks(agent, 3, { year: 1986 });
    expect(agent.getPhase()).toBe('aftermath');

    const earlyImpacts = agent.evaluate(makeContext({ year: 1987 }));
    const earlyDecay = earlyImpacts[0]!.infrastructure?.decayMult;
    expect(earlyDecay).toBeDefined();
    expect(earlyDecay!).toBeGreaterThan(1.5);

    advanceTicks(agent, 110, { year: 1989 });
    const lateImpacts = agent.evaluate(makeContext({ year: 1990 }));
    const lateDecay = lateImpacts[0]!.infrastructure?.decayMult;

    if (lateDecay !== undefined) {
      expect(lateDecay).toBeLessThan(earlyDecay!);
    }
  });

  it('growth multiplier recovers during aftermath', () => {
    const agent = new DisasterAgent();
    agent.configure(CHERNOBYL); // growthMult: 0.7, aftermathTicks: 120

    // Advance to aftermath
    advanceTicks(agent, 3, { year: 1986 });
    expect(agent.getPhase()).toBe('aftermath');

    // Early aftermath
    const earlyImpacts = agent.evaluate(makeContext({ year: 1987 }));
    const earlyGrowth = earlyImpacts[0]!.social?.growthMult;
    expect(earlyGrowth).toBeDefined();
    expect(earlyGrowth!).toBeLessThan(0.8);

    // Late aftermath
    advanceTicks(agent, 110, { year: 1989 });
    const lateImpacts = agent.evaluate(makeContext({ year: 1990 }));
    const lateGrowth = lateImpacts[0]!.social?.growthMult;
    if (lateGrowth !== undefined) {
      expect(lateGrowth).toBeGreaterThan(earlyGrowth!);
    }
  });
});

// ─── Serialization ──────────────────────────────────────────────────────────

describe('DisasterAgent — serialization', () => {
  it('round-trips through serialize/restore in buildup phase', () => {
    const agent1 = new DisasterAgent();
    agent1.configure(CHERNOBYL);
    advanceTicks(agent1, 1, { year: 1986 }); // enter buildup (tick 0 evaluated, counter at 1)

    const saved = agent1.serialize();
    expect(saved.phase).toBe('buildup');
    expect(saved.ticksInPhase).toBe(1);
    expect(saved.definition.id).toBe('chernobyl');

    const agent2 = new DisasterAgent();
    agent2.restore(saved);
    expect(agent2.getPhase()).toBe('buildup');
    expect(agent2.isActive()).toBe(true);
  });

  it('round-trips through serialize/restore in aftermath phase', () => {
    const agent1 = new DisasterAgent();
    agent1.configure(CHERNOBYL);

    // Advance to aftermath: 2 buildup + 1 peak = 3 ticks
    advanceTicks(agent1, 3, { year: 1986 });
    expect(agent1.getPhase()).toBe('aftermath');

    // 10 more aftermath ticks
    advanceTicks(agent1, 10, { year: 1987 });

    const saved = agent1.serialize();
    expect(saved.phase).toBe('aftermath');
    expect(saved.ticksInPhase).toBe(10);
    expect(saved.extra?.hasStarted).toBe(true);

    const agent2 = new DisasterAgent();
    agent2.restore(saved);
    expect(agent2.getPhase()).toBe('aftermath');
    expect(agent2.isActive()).toBe(true);

    // Restored agent continues producing aftermath impacts
    const impacts = agent2.evaluate(makeContext({ year: 1987 }));
    expect(impacts).toHaveLength(1);
    expect(impacts[0]!.crisisId).toBe('chernobyl');
  });

  it('round-trips through JSON serialization', () => {
    const agent1 = new DisasterAgent();
    agent1.configure(ARAL_SEA);
    advanceTicks(agent1, 5, { year: 1960 });

    const saved = agent1.serialize();
    const json = JSON.stringify(saved);
    const restored = JSON.parse(json);

    const agent2 = new DisasterAgent();
    agent2.restore(restored);
    expect(agent2.getPhase()).toBe('buildup');
    expect(agent2.isActive()).toBe(true);
  });

  it('preserves hasStarted flag through serialization preventing re-activation', () => {
    const agent1 = new DisasterAgent();
    agent1.configure(ARMENIAN_EARTHQUAKE); // 0 buildup

    // Run full lifecycle: 1 peak + 12 aftermath = 13 ticks
    agent1.evaluate(makeContext({ year: 1988 })); // peak → aftermath
    advanceTicks(agent1, 12, { year: 1989 }); // aftermath → resolved
    expect(agent1.getPhase()).toBe('resolved');

    const saved = agent1.serialize();
    expect(saved.extra?.hasStarted).toBe(true);

    const agent2 = new DisasterAgent();
    agent2.restore(saved);

    // Restored resolved agent should not re-activate
    const impacts = agent2.evaluate(makeContext({ year: 1988 }));
    expect(impacts).toHaveLength(0);
    expect(agent2.getPhase()).toBe('resolved');
  });
});

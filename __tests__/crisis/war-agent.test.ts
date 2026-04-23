/**
 * @fileoverview Tests for WarAgent — parameterized war crisis agent.
 *
 * Validates phase transitions, conscription scaling, bombardment,
 * veteran returns, narrative output, and serialization round-trips.
 */

import type { CrisisContext, CrisisDefinition, CrisisPhase } from '@/ai/agents/crisis/types';
import { WarAgent } from '@/ai/agents/crisis/WarAgent';
import { TICKS_PER_MONTH } from '@/game/Chronology';
import { GameRng } from '@/game/SeedSystem';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const CIVIL_WAR_DEF: CrisisDefinition = {
  id: 'civil_war',
  type: 'war',
  name: 'Russian Civil War',
  startYear: 1918,
  endYear: 1921,
  severity: 'regional',
  peakParams: {
    conscriptionRate: 0.08,
    productionMult: 1.1,
    bombardmentRate: 0.01,
    foodDrain: 10,
    moneyDrain: 15,
    veteranReturnRate: 0.6,
  },
  buildupTicks: 6,
  aftermathTicks: 12,
};

const GPW_DEF: CrisisDefinition = {
  id: 'gpw',
  type: 'war',
  name: 'Great Patriotic War',
  startYear: 1941,
  endYear: 1945,
  severity: 'existential',
  peakParams: {
    conscriptionRate: 0.15,
    productionMult: 1.3,
    bombardmentRate: 0.05,
    foodDrain: 50,
    moneyDrain: 80,
    veteranReturnRate: 0.65,
  },
  buildupTicks: 12,
  aftermathTicks: 24,
};

function makeContext(overrides?: Partial<CrisisContext>): CrisisContext {
  return {
    year: 1941,
    month: 6,
    population: 5000,
    food: 2000,
    money: 1000,
    rng: new GameRng('war-test-seed'),
    activeCrises: [],
    ...overrides,
  };
}

function advanceTicks(agent: WarAgent, ctx: CrisisContext, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    agent.evaluate(ctx);
  }
}

function advanceMonths(agent: WarAgent, ctx: CrisisContext, months: number): void {
  advanceTicks(agent, ctx, months * TICKS_PER_MONTH);
}

function advanceToPeak(agent: WarAgent, ctx: CrisisContext, def: CrisisDefinition): void {
  advanceMonths(agent, ctx, def.buildupTicks);
}

function nextMonthlyImpact(agent: WarAgent, ctx: CrisisContext) {
  let impact = agent.evaluate(ctx)[0]!;
  for (let i = 1; i < TICKS_PER_MONTH; i++) {
    impact = agent.evaluate(ctx)[0]!;
  }
  return impact;
}

// ─── Phase transitions ──────────────────────────────────────────────────────

describe('WarAgent phase transitions', () => {
  it('starts in buildup phase after configure()', () => {
    const agent = new WarAgent();
    expect(agent.getPhase()).toBe('resolved');
    expect(agent.isActive()).toBe(false);

    agent.configure(GPW_DEF);
    expect(agent.getPhase()).toBe('buildup');
    expect(agent.isActive()).toBe(true);
  });

  it('transitions buildup -> peak after buildupTicks', () => {
    const agent = new WarAgent();
    agent.configure(CIVIL_WAR_DEF); // 6 buildup ticks

    const ctx = makeContext();
    advanceToPeak(agent, ctx, CIVIL_WAR_DEF);

    expect(agent.getPhase()).toBe('peak');
    expect(agent.isActive()).toBe(true);
  });

  it('stays in peak until transitionToAftermath is called', () => {
    const agent = new WarAgent();
    agent.configure(CIVIL_WAR_DEF);

    const ctx = makeContext();
    // Exhaust buildup
    advanceToPeak(agent, ctx, CIVIL_WAR_DEF);
    expect(agent.getPhase()).toBe('peak');

    // Many peak ticks
    for (let i = 0; i < 100; i++) {
      agent.evaluate(ctx);
    }
    expect(agent.getPhase()).toBe('peak');

    agent.transitionToAftermath();
    expect(agent.getPhase()).toBe('aftermath');
  });

  it('transitions aftermath -> resolved after aftermathTicks', () => {
    const agent = new WarAgent();
    agent.configure(CIVIL_WAR_DEF); // 12 aftermath ticks

    const ctx = makeContext();
    // Exhaust buildup
    advanceToPeak(agent, ctx, CIVIL_WAR_DEF);
    // Enter peak, then aftermath
    agent.transitionToAftermath();
    expect(agent.getPhase()).toBe('aftermath');

    // Exhaust aftermath
    advanceMonths(agent, ctx, CIVIL_WAR_DEF.aftermathTicks);
    expect(agent.getPhase()).toBe('resolved');
    expect(agent.isActive()).toBe(false);
  });

  it('full lifecycle: resolved -> buildup -> peak -> aftermath -> resolved', () => {
    const agent = new WarAgent();
    const phases: CrisisPhase[] = [];

    agent.configure(CIVIL_WAR_DEF);
    phases.push(agent.getPhase()); // buildup

    const ctx = makeContext();
    // Buildup
    advanceToPeak(agent, ctx, CIVIL_WAR_DEF);
    phases.push(agent.getPhase()); // peak

    // Peak for a while
    for (let i = 0; i < 5; i++) agent.evaluate(ctx);
    agent.transitionToAftermath();
    phases.push(agent.getPhase()); // aftermath

    // Aftermath
    advanceMonths(agent, ctx, CIVIL_WAR_DEF.aftermathTicks);
    phases.push(agent.getPhase()); // resolved

    expect(phases).toEqual(['buildup', 'peak', 'aftermath', 'resolved']);
  });
});

// ─── Resolved behavior ──────────────────────────────────────────────────────

describe('WarAgent when resolved', () => {
  it('returns empty array when not configured', () => {
    const agent = new WarAgent();
    const impacts = agent.evaluate(makeContext());
    expect(impacts).toEqual([]);
  });

  it('returns empty array after crisis completes', () => {
    const agent = new WarAgent();
    agent.configure(CIVIL_WAR_DEF);

    const ctx = makeContext();
    // Run through entire lifecycle
    advanceToPeak(agent, ctx, CIVIL_WAR_DEF);
    agent.transitionToAftermath();
    advanceMonths(agent, ctx, CIVIL_WAR_DEF.aftermathTicks);
    expect(agent.getPhase()).toBe('resolved');

    const impacts = agent.evaluate(ctx);
    expect(impacts).toEqual([]);
  });
});

// ─── Civil War configuration (regional severity) ────────────────────────────

describe('WarAgent — Civil War (regional)', () => {
  it('produces impacts with correct crisisId', () => {
    const agent = new WarAgent();
    agent.configure(CIVIL_WAR_DEF);

    const impacts = agent.evaluate(makeContext());
    expect(impacts).toHaveLength(1);
    expect(impacts[0]!.crisisId).toBe('civil_war');
  });

  it('has lower intensity than existential severity', () => {
    const civilAgent = new WarAgent();
    civilAgent.configure(CIVIL_WAR_DEF);
    const gpwAgent = new WarAgent();
    gpwAgent.configure(GPW_DEF);

    const ctx = makeContext();

    // Skip to peak for both
    advanceToPeak(civilAgent, ctx, CIVIL_WAR_DEF);
    const gpwCtx = makeContext();
    advanceToPeak(gpwAgent, gpwCtx, GPW_DEF);

    // Evaluate one monthly peak pulse
    const civilImpact = nextMonthlyImpact(civilAgent, ctx);
    const gpwImpact = nextMonthlyImpact(gpwAgent, gpwCtx);

    // GPW should drain more food than Civil War
    expect(Math.abs(gpwImpact.economy!.foodDelta!)).toBeGreaterThan(Math.abs(civilImpact.economy!.foodDelta!));
  });
});

// ─── GPW configuration (existential severity) ───────────────────────────────

describe('WarAgent — GPW (existential)', () => {
  it('conscripts 15% of population at peak intensity', () => {
    const agent = new WarAgent();
    agent.configure(GPW_DEF);

    const ctx = makeContext({ population: 10000 });

    // Skip through buildup
    advanceToPeak(agent, ctx, GPW_DEF);
    expect(agent.getPhase()).toBe('peak');

    // Evaluate one monthly peak pulse

    const impact = nextMonthlyImpact(agent, ctx);

    // existential intensity = 1.0, so monthly conscription = annual 15% / 12
    expect(impact.workforce!.conscriptionCount).toBe(125);
  });

  it('applies wartime production multiplier during peak', () => {
    const agent = new WarAgent();
    agent.configure(GPW_DEF);

    const ctx = makeContext();
    advanceToPeak(agent, ctx, GPW_DEF);

    const impact = agent.evaluate(ctx)[0]!;
    expect(impact.economy!.productionMult).toBe(1.3);
  });

  it('applies food and money drain during peak', () => {
    const agent = new WarAgent();
    agent.configure(GPW_DEF);

    const ctx = makeContext();
    advanceToPeak(agent, ctx, GPW_DEF);

    const impact = nextMonthlyImpact(agent, ctx);
    // foodDrain 50 * intensity 1.0 = -50
    expect(impact.economy!.foodDelta).toBe(-50);
    // moneyDrain 80 * intensity 1.0 = -80
    expect(impact.economy!.moneyDelta).toBe(-80);
  });

  it('affects disease and growth during peak', () => {
    const agent = new WarAgent();
    agent.configure(GPW_DEF);

    const ctx = makeContext();
    advanceToPeak(agent, ctx, GPW_DEF);

    const impact = agent.evaluate(ctx)[0]!;
    expect(impact.social).toBeDefined();
    expect(impact.social!.diseaseMult).toBeGreaterThan(1);
    expect(impact.social!.growthMult).toBeLessThan(1);
  });
});

// ─── Conscription scaling ───────────────────────────────────────────────────

describe('WarAgent conscription scaling', () => {
  it('scales conscription with population', () => {
    const agent1 = new WarAgent();
    agent1.configure(GPW_DEF);
    const agent2 = new WarAgent();
    agent2.configure(GPW_DEF);

    const ctx1 = makeContext({ population: 1000 });
    const ctx2 = makeContext({ population: 10000 });

    // Skip to peak
    advanceToPeak(agent1, ctx1, GPW_DEF);
    advanceToPeak(agent2, ctx2, GPW_DEF);

    const impact1 = nextMonthlyImpact(agent1, ctx1);
    const impact2 = nextMonthlyImpact(agent2, ctx2);

    expect(impact2.workforce!.conscriptionCount!).toBeGreaterThan(impact1.workforce!.conscriptionCount!);
    expect(impact2.workforce!.conscriptionCount! / impact1.workforce!.conscriptionCount!).toBeGreaterThan(9);
  });

  it('ramps conscription gradually during buildup', () => {
    const agent = new WarAgent();
    agent.configure(GPW_DEF);

    const ctx = makeContext({ population: 10000 });

    // First buildup month
    const earlyImpact = nextMonthlyImpact(agent, ctx);
    const earlyConscription = earlyImpact.workforce!.conscriptionCount!;

    // Skip most of buildup
    advanceMonths(agent, ctx, 10);

    // Last buildup month
    const lateImpact = nextMonthlyImpact(agent, ctx);
    const lateConscription = lateImpact.workforce!.conscriptionCount!;

    expect(lateConscription).toBeGreaterThan(earlyConscription);
  });

  it('ensures minimum conscription of 1 at peak', () => {
    const agent = new WarAgent();
    agent.configure(GPW_DEF);

    // Very small population
    const ctx = makeContext({ population: 1 });
    advanceToPeak(agent, ctx, GPW_DEF);

    const impact = nextMonthlyImpact(agent, ctx);
    expect(impact.workforce!.conscriptionCount).toBeGreaterThanOrEqual(1);
  });
});

// ─── Bombardment ────────────────────────────────────────────────────────────

describe('WarAgent bombardment', () => {
  it('includes destruction targets during peak', () => {
    const agent = new WarAgent();
    agent.configure(GPW_DEF);

    const ctx = makeContext();
    advanceToPeak(agent, ctx, GPW_DEF);

    const impact = nextMonthlyImpact(agent, ctx);

    // Bombardment is pulsed monthly so war damage remains playable.
    expect(impact.infrastructure).toBeDefined();
    expect(impact.infrastructure!.destructionTargets).toBeDefined();
    expect(impact.infrastructure!.destructionTargets!.length).toBeGreaterThan(0);
  });

  it('does not include bombardment during buildup', () => {
    const agent = new WarAgent();
    agent.configure(GPW_DEF);

    const impact = agent.evaluate(makeContext())[0]!;
    expect(impact.infrastructure).toBeUndefined();
  });

  it('does not include bombardment during aftermath', () => {
    const agent = new WarAgent();
    agent.configure(CIVIL_WAR_DEF);

    const ctx = makeContext();
    advanceToPeak(agent, ctx, CIVIL_WAR_DEF);
    agent.transitionToAftermath();

    const impact = nextMonthlyImpact(agent, ctx);
    // Aftermath has infrastructure.decayMult but no destructionTargets
    expect(impact.infrastructure!.destructionTargets).toBeUndefined();
  });

  it('targets have valid grid coordinates', () => {
    const agent = new WarAgent();
    agent.configure(GPW_DEF);

    const ctx = makeContext();
    advanceToPeak(agent, ctx, GPW_DEF);

    const impact = nextMonthlyImpact(agent, ctx);
    for (const target of impact.infrastructure!.destructionTargets!) {
      expect(target.gridX).toBeGreaterThanOrEqual(0);
      expect(target.gridX).toBeLessThanOrEqual(29);
      expect(target.gridY).toBeGreaterThanOrEqual(0);
      expect(target.gridY).toBeLessThanOrEqual(29);
    }
  });
});

// ─── Veteran returns (aftermath) ────────────────────────────────────────────

describe('WarAgent aftermath — veteran returns', () => {
  it('returns veterans via negative conscription', () => {
    const agent = new WarAgent();
    agent.configure(CIVIL_WAR_DEF);

    const ctx = makeContext({ population: 5000 });

    // Run through buildup + some peak ticks to accumulate conscripted
    advanceToPeak(agent, ctx, CIVIL_WAR_DEF);
    nextMonthlyImpact(agent, ctx);

    agent.transitionToAftermath();

    const impact = nextMonthlyImpact(agent, ctx);
    expect(impact.workforce!.conscriptionCount).toBeLessThan(0);
  });

  it('gradually reduces war-weariness growthMult', () => {
    const agent = new WarAgent();
    agent.configure(CIVIL_WAR_DEF);

    const ctx = makeContext();
    advanceToPeak(agent, ctx, CIVIL_WAR_DEF);
    agent.transitionToAftermath();

    // Early aftermath — stronger effect
    const earlyImpact = agent.evaluate(ctx)[0]!;

    // Skip most aftermath months
    advanceMonths(agent, ctx, 10);

    // Late aftermath — weaker effect (closer to 1.0)
    const lateImpact = agent.evaluate(ctx)[0]!;

    expect(lateImpact.social!.growthMult!).toBeGreaterThan(earlyImpact.social!.growthMult!);
  });

  it('increases decayMult during aftermath (reconstruction demand)', () => {
    const agent = new WarAgent();
    agent.configure(CIVIL_WAR_DEF);

    const ctx = makeContext();
    advanceToPeak(agent, ctx, CIVIL_WAR_DEF);
    agent.transitionToAftermath();

    const impact = agent.evaluate(ctx)[0]!;
    expect(impact.infrastructure!.decayMult).toBeGreaterThan(1);
  });
});

// ─── Serialization ──────────────────────────────────────────────────────────

describe('WarAgent serialization', () => {
  it('round-trips through serialize/restore', () => {
    const agent = new WarAgent();
    agent.configure(GPW_DEF);

    const ctx = makeContext();
    // Advance to peak
    advanceToPeak(agent, ctx, GPW_DEF);
    // Some peak ticks
    for (let i = 0; i < 5; i++) agent.evaluate(ctx);

    const saved = agent.serialize();

    // Restore to a fresh agent
    const restored = new WarAgent();
    restored.restore(saved);

    expect(restored.getPhase()).toBe(agent.getPhase());
    expect(restored.isActive()).toBe(agent.isActive());

    const restoredSaved = restored.serialize();
    expect(restoredSaved.phase).toBe(saved.phase);
    expect(restoredSaved.ticksInPhase).toBe(saved.ticksInPhase);
    expect(restoredSaved.extra!.totalConscripted).toBe(saved.extra!.totalConscripted);
    expect(restoredSaved.definition.id).toBe('gpw');
  });

  it('serializes during buildup phase', () => {
    const agent = new WarAgent();
    agent.configure(CIVIL_WAR_DEF);

    agent.evaluate(makeContext());
    agent.evaluate(makeContext());

    const saved = agent.serialize();
    expect(saved.phase).toBe('buildup');
    expect(saved.ticksInPhase).toBe(2);
    expect(saved.definition.id).toBe('civil_war');
  });

  it('serializes during aftermath phase', () => {
    const agent = new WarAgent();
    agent.configure(CIVIL_WAR_DEF);

    const ctx = makeContext();
    advanceToPeak(agent, ctx, CIVIL_WAR_DEF);
    agent.transitionToAftermath();
    for (let i = 0; i < 3; i++) agent.evaluate(ctx);

    const saved = agent.serialize();
    expect(saved.phase).toBe('aftermath');
    expect(saved.ticksInPhase).toBe(3);
  });

  it('preserves totalConscripted through save/restore', () => {
    const agent = new WarAgent();
    agent.configure(GPW_DEF);

    const ctx = makeContext({ population: 10000 });
    // Run through buildup + peak to accumulate conscripted
    advanceToPeak(agent, ctx, GPW_DEF);
    nextMonthlyImpact(agent, ctx);

    const saved = agent.serialize();
    const totalBefore = saved.extra!.totalConscripted as number;
    expect(totalBefore).toBeGreaterThan(0);

    const restored = new WarAgent();
    restored.restore(saved);
    const restoredSaved = restored.serialize();
    expect(restoredSaved.extra!.totalConscripted).toBe(totalBefore);
  });

  it('round-trips through JSON', () => {
    const agent = new WarAgent();
    agent.configure(GPW_DEF);

    const ctx = makeContext();
    advanceToPeak(agent, ctx, GPW_DEF);

    const saved = agent.serialize();
    const json = JSON.stringify(saved);
    const parsed = JSON.parse(json);

    const restored = new WarAgent();
    restored.restore(parsed);
    expect(restored.getPhase()).toBe('peak');
  });
});

// ─── Narrative output ───────────────────────────────────────────────────────

describe('WarAgent narrative', () => {
  it('produces narrative impacts during active phases', () => {
    const agent = new WarAgent();
    agent.configure(GPW_DEF);

    const ctx = makeContext();
    jest.spyOn(ctx.rng, 'coinFlip').mockReturnValue(true);
    advanceToPeak(agent, ctx, GPW_DEF);

    const impact = nextMonthlyImpact(agent, ctx);
    expect(impact.narrative).toBeDefined();
  });
});

// ─── ICrisisAgent interface compliance ──────────────────────────────────────

describe('WarAgent implements ICrisisAgent', () => {
  it('has all required methods', () => {
    const agent = new WarAgent();
    expect(typeof agent.configure).toBe('function');
    expect(typeof agent.evaluate).toBe('function');
    expect(typeof agent.isActive).toBe('function');
    expect(typeof agent.getPhase).toBe('function');
    expect(typeof agent.serialize).toBe('function');
    expect(typeof agent.restore).toBe('function');
  });
});

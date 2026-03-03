/**
 * @fileoverview Tests for FamineAgent crisis agent.
 *
 * Covers historical famine scenarios (1921-22, Holodomor, post-war),
 * phase transitions, severity scaling, war compounding, and serialization.
 */

import { GameRng } from '@/game/SeedSystem';
import { FamineAgent } from '@/ai/agents/crisis/FamineAgent';
import type { CrisisContext, CrisisDefinition } from '@/ai/agents/crisis/types';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const FAMINE_1921: CrisisDefinition = {
  id: 'famine-1921',
  type: 'famine',
  name: 'Russian Famine of 1921-22',
  startYear: 1921,
  endYear: 1922,
  severity: 'national',
  peakParams: { starvationRate: 0.25 },
  buildupTicks: 6,
  aftermathTicks: 12,
  description: 'Widespread famine following civil war and drought.',
};

const HOLODOMOR: CrisisDefinition = {
  id: 'holodomor',
  type: 'famine',
  name: 'Holodomor',
  startYear: 1932,
  endYear: 1933,
  severity: 'existential',
  peakParams: { starvationRate: 0.3, foodConfiscation: 0.9 },
  buildupTicks: 8,
  aftermathTicks: 16,
  description: 'Man-made famine in Soviet Ukraine caused by forced collectivization.',
};

const POSTWAR_FAMINE: CrisisDefinition = {
  id: 'famine-1946',
  type: 'famine',
  name: 'Soviet Famine of 1946-47',
  startYear: 1946,
  endYear: 1947,
  severity: 'national',
  peakParams: { starvationRate: 0.2 },
  buildupTicks: 4,
  aftermathTicks: 10,
  description: 'Post-war famine exacerbated by drought and war devastation.',
};

const LOCALIZED_FAMINE: CrisisDefinition = {
  id: 'local-famine',
  type: 'famine',
  name: 'Local Crop Failure',
  startYear: 1960,
  endYear: 1961,
  severity: 'localized',
  peakParams: {},
  buildupTicks: 4,
  aftermathTicks: 8,
};

const REGIONAL_FAMINE: CrisisDefinition = {
  id: 'regional-famine',
  type: 'famine',
  name: 'Regional Famine',
  startYear: 1970,
  endYear: 1971,
  severity: 'regional',
  peakParams: {},
  buildupTicks: 6,
  aftermathTicks: 12,
};

function makeContext(overrides?: Partial<CrisisContext>): CrisisContext {
  return {
    year: 1932,
    month: 6,
    population: 5000,
    food: 1000,
    money: 500,
    rng: new GameRng('test-famine-seed'),
    activeCrises: [],
    ...overrides,
  };
}

// ─── Basic Lifecycle ────────────────────────────────────────────────────────

describe('FamineAgent lifecycle', () => {
  it('starts in buildup phase after configure', () => {
    const agent = new FamineAgent();
    agent.configure(HOLODOMOR);
    expect(agent.isActive()).toBe(true);
    expect(agent.getPhase()).toBe('buildup');
  });

  it('is not active before configure', () => {
    const agent = new FamineAgent();
    expect(agent.isActive()).toBe(false);
    expect(agent.getPhase()).toBe('resolved');
  });

  it('returns empty impacts when resolved', () => {
    const agent = new FamineAgent();
    const impacts = agent.evaluate(makeContext());
    expect(impacts).toEqual([]);
  });

  it('returns exactly one impact per active tick', () => {
    const agent = new FamineAgent();
    agent.configure(HOLODOMOR);
    const ctx = makeContext();
    const impacts = agent.evaluate(ctx);
    expect(impacts).toHaveLength(1);
    expect(impacts[0]!.crisisId).toBe('holodomor');
  });
});

// ─── Phase Transitions ──────────────────────────────────────────────────────

describe('FamineAgent phase transitions', () => {
  it('transitions from buildup to peak after buildupTicks', () => {
    const agent = new FamineAgent();
    agent.configure(LOCALIZED_FAMINE); // buildupTicks = 4
    const ctx = makeContext();

    // Tick through buildup
    for (let i = 0; i < 4; i++) {
      agent.evaluate(ctx);
    }
    // After 4 ticks (buildupTicks), should transition to peak
    expect(agent.getPhase()).toBe('peak');
  });

  it('transitions from peak to aftermath', () => {
    const agent = new FamineAgent();
    agent.configure(LOCALIZED_FAMINE); // buildupTicks=4, aftermathTicks=8, 1960-1961
    const ctx = makeContext();

    // Burn through buildup
    for (let i = 0; i < 4; i++) {
      agent.evaluate(ctx);
    }
    expect(agent.getPhase()).toBe('peak');

    // Peak duration = max(1, (1961-1960)*12 - 4 - 8) = max(1, 0) = 1
    agent.evaluate(ctx);
    expect(agent.getPhase()).toBe('aftermath');
  });

  it('transitions from aftermath to resolved', () => {
    const agent = new FamineAgent();
    agent.configure(LOCALIZED_FAMINE); // buildupTicks=4, aftermathTicks=8
    const ctx = makeContext();

    // Buildup
    for (let i = 0; i < 4; i++) {
      agent.evaluate(ctx);
    }
    // Peak (1 tick minimum)
    agent.evaluate(ctx);
    expect(agent.getPhase()).toBe('aftermath');

    // Aftermath
    for (let i = 0; i < 8; i++) {
      agent.evaluate(ctx);
    }
    expect(agent.getPhase()).toBe('resolved');
    expect(agent.isActive()).toBe(false);
  });

  it('full lifecycle runs buildup → peak → aftermath → resolved', () => {
    const agent = new FamineAgent();
    agent.configure(LOCALIZED_FAMINE);
    const ctx = makeContext();
    const phases: string[] = [];

    for (let i = 0; i < 50; i++) {
      phases.push(agent.getPhase());
      if (!agent.isActive()) break;
      agent.evaluate(ctx);
    }

    expect(phases).toContain('buildup');
    expect(phases).toContain('peak');
    expect(phases).toContain('aftermath');
    expect(phases).toContain('resolved');

    // Verify ordering
    const firstPeak = phases.indexOf('peak');
    const firstAftermath = phases.indexOf('aftermath');
    const firstResolved = phases.indexOf('resolved');
    expect(firstPeak).toBeGreaterThan(0);
    expect(firstAftermath).toBeGreaterThan(firstPeak);
    expect(firstResolved).toBeGreaterThan(firstAftermath);
  });
});

// ─── 1921-22 Russian Famine (National Severity) ────────────────────────────

describe('1921-22 Russian Famine', () => {
  it('produces declining production during buildup', () => {
    const agent = new FamineAgent();
    agent.configure(FAMINE_1921);
    const ctx = makeContext({ population: 10000 });

    const impact = agent.evaluate(ctx)[0]!;
    expect(impact.economy).toBeDefined();
    expect(impact.economy!.productionMult).toBeDefined();
    // Early buildup: production should still be near 1.0
    expect(impact.economy!.productionMult).toBeGreaterThan(0.8);
    expect(impact.economy!.productionMult).toBeLessThanOrEqual(1.0);
  });

  it('produces food drain at peak proportional to population', () => {
    const agent = new FamineAgent();
    agent.configure(FAMINE_1921);
    const ctx = makeContext({ population: 10000 });

    // Advance to peak
    for (let i = 0; i < FAMINE_1921.buildupTicks; i++) {
      agent.evaluate(ctx);
    }
    expect(agent.getPhase()).toBe('peak');

    const impact = agent.evaluate(ctx)[0]!;
    expect(impact.economy!.foodDelta).toBeDefined();
    // National severity: -pop * 0.4
    expect(impact.economy!.foodDelta).toBe(-10000 * 0.4);
  });

  it('has starvation casualties during peak', () => {
    const agent = new FamineAgent();
    agent.configure(FAMINE_1921);
    const ctx = makeContext({ population: 10000 });

    // Advance to peak
    for (let i = 0; i < FAMINE_1921.buildupTicks; i++) {
      agent.evaluate(ctx);
    }

    const impact = agent.evaluate(ctx)[0]!;
    expect(impact.workforce!.casualtyCount).toBeGreaterThanOrEqual(1);
  });
});

// ─── Holodomor (Existential Severity) ──────────────────────────────────────

describe('Holodomor', () => {
  it('has highest food drain at existential severity', () => {
    const agent = new FamineAgent();
    agent.configure(HOLODOMOR);
    const ctx = makeContext({ population: 5000 });

    // Advance to peak
    for (let i = 0; i < HOLODOMOR.buildupTicks; i++) {
      agent.evaluate(ctx);
    }

    const impact = agent.evaluate(ctx)[0]!;
    // Existential: -pop * 0.6
    expect(impact.economy!.foodDelta).toBe(-5000 * 0.6);
  });

  it('has maximum disease multiplier at existential severity', () => {
    const agent = new FamineAgent();
    agent.configure(HOLODOMOR);
    const ctx = makeContext();

    // Advance to peak
    for (let i = 0; i < HOLODOMOR.buildupTicks; i++) {
      agent.evaluate(ctx);
    }

    const impact = agent.evaluate(ctx)[0]!;
    expect(impact.social!.diseaseMult).toBe(3.0);
  });

  it('has severe morale hit at existential severity', () => {
    const agent = new FamineAgent();
    agent.configure(HOLODOMOR);
    const ctx = makeContext();

    // Advance to peak
    for (let i = 0; i < HOLODOMOR.buildupTicks; i++) {
      agent.evaluate(ctx);
    }

    const impact = agent.evaluate(ctx)[0]!;
    expect(impact.workforce!.moraleModifier).toBe(-0.8);
  });

  it('has near-zero growth at existential severity', () => {
    const agent = new FamineAgent();
    agent.configure(HOLODOMOR);
    const ctx = makeContext();

    // Advance to peak
    for (let i = 0; i < HOLODOMOR.buildupTicks; i++) {
      agent.evaluate(ctx);
    }

    const impact = agent.evaluate(ctx)[0]!;
    expect(impact.social!.growthMult).toBe(0.1);
  });

  it('has lowest production multiplier at existential severity', () => {
    const agent = new FamineAgent();
    agent.configure(HOLODOMOR);
    const ctx = makeContext();

    // Advance to peak
    for (let i = 0; i < HOLODOMOR.buildupTicks; i++) {
      agent.evaluate(ctx);
    }

    const impact = agent.evaluate(ctx)[0]!;
    expect(impact.economy!.productionMult).toBe(0.3);
  });
});

// ─── Post-War Famine (War Compounding) ──────────────────────────────────────

describe('Post-war famine (war compounding)', () => {
  it('amplifies food drain when war is active', () => {
    const agent = new FamineAgent();
    agent.configure(POSTWAR_FAMINE);
    const population = 5000;

    const ctxNoWar = makeContext({ population, activeCrises: [] });
    const ctxWar = makeContext({ population, activeCrises: ['ww2-war'] });

    // Create two agents and advance both to peak
    const agentNoWar = new FamineAgent();
    agentNoWar.configure(POSTWAR_FAMINE);
    const agentWar = new FamineAgent();
    agentWar.configure(POSTWAR_FAMINE);

    for (let i = 0; i < POSTWAR_FAMINE.buildupTicks; i++) {
      agentNoWar.evaluate(ctxNoWar);
      agentWar.evaluate(ctxWar);
    }

    const impactNoWar = agentNoWar.evaluate(ctxNoWar)[0]!;
    const impactWar = agentWar.evaluate(ctxWar)[0]!;

    // War amplifies food drain by 1.5x
    expect(impactWar.economy!.foodDelta).toBe(impactNoWar.economy!.foodDelta! * 1.5);
  });

  it('amplifies disease multiplier when war is active', () => {
    const agentNoWar = new FamineAgent();
    agentNoWar.configure(POSTWAR_FAMINE);
    const agentWar = new FamineAgent();
    agentWar.configure(POSTWAR_FAMINE);

    const ctxNoWar = makeContext({ activeCrises: [] });
    const ctxWar = makeContext({ activeCrises: ['great-patriotic-war'] });

    for (let i = 0; i < POSTWAR_FAMINE.buildupTicks; i++) {
      agentNoWar.evaluate(ctxNoWar);
      agentWar.evaluate(ctxWar);
    }

    const impactNoWar = agentNoWar.evaluate(ctxNoWar)[0]!;
    const impactWar = agentWar.evaluate(ctxWar)[0]!;

    // War amplifies disease by 1.3x
    expect(impactWar.social!.diseaseMult).toBe(impactNoWar.social!.diseaseMult! * 1.3);
  });

  it('detects war by checking activeCrises for "war" substring', () => {
    const agent = new FamineAgent();
    agent.configure(POSTWAR_FAMINE);
    const population = 5000;

    // Various war IDs should all trigger compounding
    const warIds = ['ww2-war', 'civil-war', 'proxy-war-korea', 'war-afghanistan'];
    for (const warId of warIds) {
      const freshAgent = new FamineAgent();
      freshAgent.configure(POSTWAR_FAMINE);
      const ctx = makeContext({ population, activeCrises: [warId] });

      for (let i = 0; i < POSTWAR_FAMINE.buildupTicks; i++) {
        freshAgent.evaluate(ctx);
      }

      const impact = freshAgent.evaluate(ctx)[0]!;
      // Should be amplified (national: -pop*0.4 * 1.5 = -pop*0.6)
      expect(impact.economy!.foodDelta).toBe(-population * 0.4 * 1.5);
    }
  });

  it('does NOT amplify when no war in activeCrises', () => {
    const agent = new FamineAgent();
    agent.configure(POSTWAR_FAMINE);
    const population = 5000;
    const ctx = makeContext({ population, activeCrises: ['holodomor', 'chernobyl'] });

    for (let i = 0; i < POSTWAR_FAMINE.buildupTicks; i++) {
      agent.evaluate(ctx);
    }

    const impact = agent.evaluate(ctx)[0]!;
    // National severity without war: -pop * 0.4
    expect(impact.economy!.foodDelta).toBe(-population * 0.4);
  });
});

// ─── Disease Multiplication During Peak ─────────────────────────────────────

describe('Disease multiplication during peak', () => {
  it.each([
    ['localized', 1.5],
    ['regional', 2.0],
    ['national', 2.5],
    ['existential', 3.0],
  ] as const)('severity %s produces diseaseMult %f', (severity, expected) => {
    const def: CrisisDefinition = {
      id: `famine-${severity}`,
      type: 'famine',
      name: `Test ${severity} famine`,
      startYear: 1950,
      endYear: 1952,
      severity: severity as CrisisDefinition['severity'],
      peakParams: {},
      buildupTicks: 2,
      aftermathTicks: 4,
    };

    const agent = new FamineAgent();
    agent.configure(def);
    const ctx = makeContext();

    // Advance to peak
    for (let i = 0; i < def.buildupTicks; i++) {
      agent.evaluate(ctx);
    }

    const impact = agent.evaluate(ctx)[0]!;
    expect(impact.social!.diseaseMult).toBe(expected);
  });
});

// ─── Food Delta Proportional to Population ──────────────────────────────────

describe('Food delta proportional to population', () => {
  it('scales food drain linearly with population at peak', () => {
    const populations = [1000, 5000, 10000, 50000];
    const drains: number[] = [];

    for (const pop of populations) {
      const agent = new FamineAgent();
      agent.configure(HOLODOMOR);
      const ctx = makeContext({ population: pop });

      for (let i = 0; i < HOLODOMOR.buildupTicks; i++) {
        agent.evaluate(ctx);
      }

      const impact = agent.evaluate(ctx)[0]!;
      drains.push(impact.economy!.foodDelta!);
    }

    // Verify linear scaling: drain / population should be constant
    const ratios = drains.map((d, i) => d / populations[i]!);
    for (const ratio of ratios) {
      expect(ratio).toBeCloseTo(ratios[0]!, 5);
    }
  });

  it.each([
    ['localized', 0.1],
    ['regional', 0.2],
    ['national', 0.4],
    ['existential', 0.6],
  ] as const)('severity %s drains %f per capita', (severity, drainRate) => {
    const def: CrisisDefinition = {
      id: `famine-${severity}`,
      type: 'famine',
      name: `Test`,
      startYear: 1950,
      endYear: 1952,
      severity: severity as CrisisDefinition['severity'],
      peakParams: {},
      buildupTicks: 2,
      aftermathTicks: 4,
    };

    const agent = new FamineAgent();
    agent.configure(def);
    const pop = 10000;
    const ctx = makeContext({ population: pop });

    for (let i = 0; i < def.buildupTicks; i++) {
      agent.evaluate(ctx);
    }

    const impact = agent.evaluate(ctx)[0]!;
    expect(impact.economy!.foodDelta).toBe(-pop * drainRate);
  });
});

// ─── Buildup Phase Details ──────────────────────────────────────────────────

describe('Buildup phase', () => {
  it('production multiplier decreases over buildup ticks', () => {
    const agent = new FamineAgent();
    agent.configure(FAMINE_1921); // buildupTicks = 6
    const ctx = makeContext();

    const productionMults: number[] = [];
    for (let i = 0; i < FAMINE_1921.buildupTicks; i++) {
      const impact = agent.evaluate(ctx)[0]!;
      productionMults.push(impact.economy!.productionMult!);
    }

    // Production should be decreasing over time
    for (let i = 1; i < productionMults.length; i++) {
      expect(productionMults[i]).toBeLessThan(productionMults[i - 1]!);
    }
  });

  it('emits warning toast when ramp > 0.5', () => {
    const agent = new FamineAgent();
    agent.configure(FAMINE_1921); // buildupTicks = 6
    const ctx = makeContext();

    // First tick: ramp = 1/6 ≈ 0.17, no toast expected
    const early = agent.evaluate(ctx)[0]!;
    expect(early.narrative!.toastMessages).toHaveLength(0);

    // Advance past 0.5 threshold (tick 4: ramp = 4/6 ≈ 0.67)
    for (let i = 0; i < 3; i++) {
      agent.evaluate(ctx);
    }
    const later = agent.evaluate(ctx)[0]!;
    expect(later.narrative!.toastMessages!.length).toBeGreaterThan(0);
    expect(later.narrative!.toastMessages![0]!.severity).toBe('warning');
  });

  it('includes Pravda headlines', () => {
    const agent = new FamineAgent();
    agent.configure(FAMINE_1921);
    const ctx = makeContext();

    const impact = agent.evaluate(ctx)[0]!;
    expect(impact.narrative!.pravdaHeadlines).toBeDefined();
    expect(impact.narrative!.pravdaHeadlines!.length).toBeGreaterThan(0);
  });
});

// ─── Aftermath Phase Details ────────────────────────────────────────────────

describe('Aftermath phase', () => {
  function advanceToAftermath(def: CrisisDefinition): FamineAgent {
    const agent = new FamineAgent();
    agent.configure(def);
    const ctx = makeContext();

    // Buildup
    for (let i = 0; i < def.buildupTicks; i++) {
      agent.evaluate(ctx);
    }
    // Peak — compute peak duration
    const totalTicks = Math.max(1, (def.endYear - def.startYear) * 12);
    const peakDuration = Math.max(1, totalTicks - def.buildupTicks - def.aftermathTicks);
    for (let i = 0; i < peakDuration; i++) {
      agent.evaluate(ctx);
    }
    expect(agent.getPhase()).toBe('aftermath');
    return agent;
  }

  it('production recovers over aftermath ticks', () => {
    const agent = advanceToAftermath(REGIONAL_FAMINE);
    const ctx = makeContext();

    const mults: number[] = [];
    for (let i = 0; i < REGIONAL_FAMINE.aftermathTicks; i++) {
      const impact = agent.evaluate(ctx)[0]!;
      mults.push(impact.economy!.productionMult!);
    }

    // Production should be increasing over aftermath
    for (let i = 1; i < mults.length; i++) {
      expect(mults[i]).toBeGreaterThan(mults[i - 1]!);
    }
    // Final value should approach 1.0
    expect(mults[mults.length - 1]).toBeGreaterThan(0.9);
  });

  it('disease multiplier decreases toward 1.0', () => {
    const agent = advanceToAftermath(REGIONAL_FAMINE);
    const ctx = makeContext();

    const diseaseMults: number[] = [];
    for (let i = 0; i < REGIONAL_FAMINE.aftermathTicks; i++) {
      const impact = agent.evaluate(ctx)[0]!;
      diseaseMults.push(impact.social!.diseaseMult!);
    }

    // Disease should be decreasing toward 1.0
    for (let i = 1; i < diseaseMults.length; i++) {
      expect(diseaseMults[i]).toBeLessThan(diseaseMults[i - 1]!);
    }
    // Final value should be near 1.0
    expect(diseaseMults[diseaseMults.length - 1]).toBeLessThan(1.2);
  });

  it('morale recovers toward 0', () => {
    const agent = advanceToAftermath(REGIONAL_FAMINE);
    const ctx = makeContext();

    const moraleMods: number[] = [];
    for (let i = 0; i < REGIONAL_FAMINE.aftermathTicks; i++) {
      const impact = agent.evaluate(ctx)[0]!;
      moraleMods.push(impact.workforce!.moraleModifier!);
    }

    // Morale modifier should be approaching 0 (less negative over time)
    for (let i = 1; i < moraleMods.length; i++) {
      expect(moraleMods[i]).toBeGreaterThan(moraleMods[i - 1]!);
    }
  });

  it('no food delta during aftermath (only recovery)', () => {
    const agent = advanceToAftermath(REGIONAL_FAMINE);
    const ctx = makeContext();

    const impact = agent.evaluate(ctx)[0]!;
    expect(impact.economy!.foodDelta).toBeUndefined();
  });
});

// ─── Severity Comparisons ───────────────────────────────────────────────────

describe('Severity scaling', () => {
  function peakImpactForSeverity(severity: string): ReturnType<FamineAgent['evaluate']>[0] {
    const def: CrisisDefinition = {
      id: `famine-${severity}`,
      type: 'famine',
      name: `Test`,
      startYear: 1950,
      endYear: 1952,
      severity: severity as CrisisDefinition['severity'],
      peakParams: {},
      buildupTicks: 2,
      aftermathTicks: 4,
    };

    const agent = new FamineAgent();
    agent.configure(def);
    const ctx = makeContext({ population: 10000 });

    for (let i = 0; i < def.buildupTicks; i++) {
      agent.evaluate(ctx);
    }
    return agent.evaluate(ctx)[0]!;
  }

  it('higher severity = more food drain', () => {
    const localized = peakImpactForSeverity('localized');
    const regional = peakImpactForSeverity('regional');
    const national = peakImpactForSeverity('national');
    const existential = peakImpactForSeverity('existential');

    expect(localized.economy!.foodDelta!).toBeGreaterThan(regional.economy!.foodDelta!);
    expect(regional.economy!.foodDelta!).toBeGreaterThan(national.economy!.foodDelta!);
    expect(national.economy!.foodDelta!).toBeGreaterThan(existential.economy!.foodDelta!);
  });

  it('higher severity = worse morale', () => {
    const localized = peakImpactForSeverity('localized');
    const existential = peakImpactForSeverity('existential');

    expect(existential.workforce!.moraleModifier!).toBeLessThan(
      localized.workforce!.moraleModifier!,
    );
  });

  it('higher severity = lower production', () => {
    const localized = peakImpactForSeverity('localized');
    const existential = peakImpactForSeverity('existential');

    expect(existential.economy!.productionMult!).toBeLessThan(
      localized.economy!.productionMult!,
    );
  });
});

// ─── Serialization Round-Trip ───────────────────────────────────────────────

describe('Serialization', () => {
  it('round-trips through serialize/restore in buildup', () => {
    const agent = new FamineAgent();
    agent.configure(HOLODOMOR);
    const ctx = makeContext();

    // Advance a few ticks into buildup
    agent.evaluate(ctx);
    agent.evaluate(ctx);

    const saved = agent.serialize();
    expect(saved.phase).toBe('buildup');
    expect(saved.ticksInPhase).toBe(2);
    expect(saved.definition.id).toBe('holodomor');

    // Restore into a fresh agent
    const restored = new FamineAgent();
    restored.restore(saved);
    expect(restored.isActive()).toBe(true);
    expect(restored.getPhase()).toBe('buildup');

    // Both should produce the same impacts on the next tick
    const impactOriginal = agent.evaluate(ctx)[0]!;
    const impactRestored = restored.evaluate(ctx)[0]!;
    expect(impactRestored.economy!.productionMult).toBe(impactOriginal.economy!.productionMult);
  });

  it('round-trips through serialize/restore at peak', () => {
    // Use a definition with a longer peak duration so we can tick into it
    const longPeakDef: CrisisDefinition = {
      id: 'long-peak-famine',
      type: 'famine',
      name: 'Long Peak Famine',
      startYear: 1950,
      endYear: 1955, // 5 years = 60 ticks total, minus 4+8 = 48 peak ticks
      severity: 'national',
      peakParams: {},
      buildupTicks: 4,
      aftermathTicks: 8,
    };
    const agent = new FamineAgent();
    agent.configure(longPeakDef);
    const ctx = makeContext();

    // Advance to peak
    for (let i = 0; i < longPeakDef.buildupTicks; i++) {
      agent.evaluate(ctx);
    }
    expect(agent.getPhase()).toBe('peak');

    // Tick once into peak (still in peak since peakDuration = 48)
    agent.evaluate(ctx);

    const saved = agent.serialize();
    expect(saved.phase).toBe('peak');

    const restored = new FamineAgent();
    restored.restore(saved);
    expect(restored.getPhase()).toBe('peak');
    expect(restored.isActive()).toBe(true);
  });

  it('round-trips through JSON serialization', () => {
    const agent = new FamineAgent();
    agent.configure(FAMINE_1921);
    const ctx = makeContext();
    agent.evaluate(ctx);

    const saved = agent.serialize();
    const json = JSON.stringify(saved);
    const parsed = JSON.parse(json);

    const restored = new FamineAgent();
    restored.restore(parsed);
    expect(restored.getPhase()).toBe(agent.getPhase());
    expect(restored.isActive()).toBe(true);
  });
});

// ─── Narrative Content ──────────────────────────────────────────────────────

describe('Narrative content', () => {
  it('peak phase emits critical toast', () => {
    const agent = new FamineAgent();
    agent.configure(HOLODOMOR);
    const ctx = makeContext();

    // Advance to peak
    for (let i = 0; i < HOLODOMOR.buildupTicks; i++) {
      agent.evaluate(ctx);
    }

    const impact = agent.evaluate(ctx)[0]!;
    expect(impact.narrative!.toastMessages).toBeDefined();
    expect(impact.narrative!.toastMessages!.length).toBeGreaterThan(0);
    expect(impact.narrative!.toastMessages![0]!.severity).toBe('critical');
  });

  it('all phases produce Pravda headlines', () => {
    const agent = new FamineAgent();
    agent.configure(LOCALIZED_FAMINE);
    const ctx = makeContext();

    // Buildup
    const buildup = agent.evaluate(ctx)[0]!;
    expect(buildup.narrative!.pravdaHeadlines!.length).toBeGreaterThan(0);

    // Advance to peak
    for (let i = 1; i < LOCALIZED_FAMINE.buildupTicks; i++) {
      agent.evaluate(ctx);
    }
    const peak = agent.evaluate(ctx)[0]!;
    expect(peak.narrative!.pravdaHeadlines!.length).toBeGreaterThan(0);

    // Advance to aftermath
    // Peak is 1 tick for localized (12 - 4 - 8 = 0, clamped to 1)
    // Already consumed 1 peak tick above
    const aftermath = agent.evaluate(ctx)[0]!;
    expect(aftermath.narrative!.pravdaHeadlines!.length).toBeGreaterThan(0);
  });
});

// ─── Edge Cases ─────────────────────────────────────────────────────────────

describe('Edge cases', () => {
  it('handles zero buildupTicks (immediate peak)', () => {
    const def: CrisisDefinition = {
      id: 'sudden-famine',
      type: 'famine',
      name: 'Sudden Famine',
      startYear: 1960,
      endYear: 1962,
      severity: 'regional',
      peakParams: {},
      buildupTicks: 0,
      aftermathTicks: 4,
    };

    const agent = new FamineAgent();
    agent.configure(def);
    const ctx = makeContext();

    // First evaluate should be buildup but immediately transition
    agent.evaluate(ctx);
    expect(agent.getPhase()).toBe('peak');
  });

  it('handles zero population gracefully', () => {
    const agent = new FamineAgent();
    agent.configure(HOLODOMOR);
    const ctx = makeContext({ population: 0 });

    // Advance to peak
    for (let i = 0; i < HOLODOMOR.buildupTicks; i++) {
      agent.evaluate(ctx);
    }

    const impact = agent.evaluate(ctx)[0]!;
    // -0 * severity = -0, which is equal to 0 numerically
    expect(impact.economy!.foodDelta).toBeCloseTo(0);
    // casualtyCount should be at least 1 (Math.max(1, ...))
    expect(impact.workforce!.casualtyCount).toBe(1);
  });

  it('minimum 1 casualty even at tiny populations', () => {
    const agent = new FamineAgent();
    agent.configure(LOCALIZED_FAMINE);
    const ctx = makeContext({ population: 10 });

    for (let i = 0; i < LOCALIZED_FAMINE.buildupTicks; i++) {
      agent.evaluate(ctx);
    }

    const impact = agent.evaluate(ctx)[0]!;
    expect(impact.workforce!.casualtyCount).toBeGreaterThanOrEqual(1);
  });
});

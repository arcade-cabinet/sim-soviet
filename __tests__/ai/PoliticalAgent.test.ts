import {
  PoliticalAgent,
  MAX_QUOTA_FAILURES,
  PRIPISKI_QUOTA_INFLATION,
  PRIPISKI_INSPECTION_BONUS,
  STAKHANOVITE_THRESHOLD,
  ERA_ORDER,
  ERA_DEFINITIONS,
} from '../../src/ai/agents/PoliticalAgent';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a fresh agent starting at the given year (defaults to 1917). */
function makeAgent(startYear = 1917): PoliticalAgent {
  return new PoliticalAgent(startYear);
}

// ---------------------------------------------------------------------------
// 1. Instantiation
// ---------------------------------------------------------------------------

describe('PoliticalAgent — instantiation', () => {
  it('can be instantiated with correct defaults', () => {
    const agent = makeAgent();
    expect(agent.name).toBe('PoliticalAgent');
    expect(agent.getCurrentEraIndex()).toBe(0);
    expect(agent.getCurrentEra().id).toBe('revolution');
    expect(agent.getCurrentEra().name).toBe('Revolution');
    expect(agent.getConsecutiveFailures()).toBe(0);
    expect(agent.getPripiskiHistory()).toBe(0);
    expect(agent.getYear()).toBe(1917);
  });

  it('accepts a custom start year', () => {
    const agent = makeAgent(1932);
    expect(agent.getCurrentEra().id).toBe('industrialization');
    expect(agent.getYear()).toBe(1932);
  });
});

// ---------------------------------------------------------------------------
// 2. Era detection at year boundaries (all 8 eras)
// ---------------------------------------------------------------------------

describe('PoliticalAgent — era detection', () => {
  it('returns null when no transition occurs within the current era', () => {
    const agent = makeAgent();
    // Still in Revolution (1917-1921 → no crossing)
    expect(agent.checkEraTransition(1919)).toBeNull();
    expect(agent.checkEraTransition(1921)).toBeNull();
    expect(agent.getCurrentEra().id).toBe('revolution');
  });

  it('detects era transition at year boundaries (canonical dates)', () => {
    const agent = makeAgent();

    // Crosses into Collectivization at 1922
    const newEra = agent.checkEraTransition(1922);
    expect(newEra).not.toBeNull();
    expect(newEra!.id).toBe('collectivization');
    expect(agent.getCurrentEra().id).toBe('collectivization');
  });

  it('progresses through all 8 canonical eras in order', () => {
    const agent = makeAgent();

    const expectedTransitions: Array<[number, string]> = [
      [1922, 'collectivization'],
      [1932, 'industrialization'],
      [1941, 'great_patriotic'],
      [1945, 'reconstruction'],
      [1956, 'thaw_and_freeze'],
      [1982, 'stagnation'],
      [2000, 'the_eternal'],
    ];

    for (const [year, expectedId] of expectedTransitions) {
      const result = agent.checkEraTransition(year);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(expectedId);
      expect(agent.getCurrentEra().id).toBe(expectedId);
    }
  });

  it('ERA_ORDER has exactly 8 entries starting at revolution', () => {
    expect(ERA_ORDER).toHaveLength(8);
    expect(ERA_ORDER[0]).toBe('revolution');
    expect(ERA_ORDER[7]).toBe('the_eternal');
  });

  it('ERA_DEFINITIONS covers 1917 to -1 (eternal)', () => {
    expect(ERA_DEFINITIONS.revolution.startYear).toBe(1917);
    expect(ERA_DEFINITIONS.the_eternal.endYear).toBe(-1); // eternal
  });

  it('records previousEraId after transition', () => {
    const agent = makeAgent();
    expect(agent.getPreviousEraId()).toBeNull();
    agent.checkEraTransition(1922);
    expect(agent.getPreviousEraId()).toBe('revolution');
    agent.checkEraTransition(1932);
    expect(agent.getPreviousEraId()).toBe('collectivization');
  });
});

// ---------------------------------------------------------------------------
// 3. Modifier blending during transitions
// ---------------------------------------------------------------------------

describe('PoliticalAgent — modifier blending', () => {
  it('returns pure target modifiers when not transitioning', () => {
    const agent = makeAgent();
    const mods = agent.getModifiers();
    const expected = ERA_DEFINITIONS.revolution.modifiers;
    expect(mods.productionMult).toBeCloseTo(expected.productionMult);
    expect(mods.consumptionMult).toBeCloseTo(expected.consumptionMult);
  });

  it('starts a transition when era changes', () => {
    const agent = makeAgent();
    agent.checkEraTransition(1922); // → collectivization
    expect(agent.isTransitioning()).toBe(true);
  });

  it('blends modifiers part-way through a transition', () => {
    const agent = makeAgent();
    const fromMods = ERA_DEFINITIONS.revolution.modifiers;
    const toMods = ERA_DEFINITIONS.collectivization.modifiers;

    agent.checkEraTransition(1922); // starts blend

    // After 5 ticks (halfway through 10-tick transition)
    for (let i = 0; i < 5; i++) agent.tickTransition();

    const blended = agent.getModifiers();
    // At t≈0.5, blend should be between from and to
    const midProd = fromMods.productionMult + (toMods.productionMult - fromMods.productionMult) * 0.5;
    expect(blended.productionMult).toBeCloseTo(midProd, 1);
  });

  it('clears the transition after all ticks are consumed', () => {
    const agent = makeAgent();
    agent.checkEraTransition(1922);
    for (let i = 0; i < 10; i++) agent.tickTransition();
    expect(agent.isTransitioning()).toBe(false);
    // After transition completes, should return exact target modifiers
    const mods = agent.getModifiers();
    expect(mods.productionMult).toBeCloseTo(ERA_DEFINITIONS.collectivization.modifiers.productionMult);
  });

  it('tickTransition returns true while transitioning and false when done', () => {
    const agent = makeAgent();
    agent.checkEraTransition(1922);
    // All 10 ticks return true (the final tick goes from remaining=1 → 0, still returns true)
    for (let i = 0; i < 10; i++) {
      const stillGoing = agent.tickTransition();
      expect(stillGoing).toBe(true);
    }
    // 11th call: remaining=0, so returns false
    const afterDone = agent.tickTransition();
    expect(afterDone).toBe(false);
    expect(agent.isTransitioning()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Quota progress tracking
// ---------------------------------------------------------------------------

describe('PoliticalAgent — quota tracking', () => {
  it('clamps quota progress between 0 and 1', () => {
    const agent = makeAgent();
    agent.updateQuota(-0.5);
    expect(agent.getQuotaProgress()).toBe(0);
    agent.updateQuota(2.0);
    expect(agent.getQuotaProgress()).toBe(1);
  });

  it('updates quota target when provided', () => {
    const agent = makeAgent();
    agent.updateQuota(0.5, 800);
    expect(agent.getQuotaTarget()).toBe(800);
    expect(agent.getQuotaProgress()).toBeCloseTo(0.5);
  });

  it('syncs resource quotas from resource values', () => {
    const agent = makeAgent();
    agent.updateQuota(0, 500); // target 500 food
    agent.syncResourceQuotas({ food: 250 });
    // 250/500 = 0.5 progress
    expect(agent.getQuotaProgress()).toBeCloseTo(0.5);
  });

  it('advances plan to new type and target', () => {
    const agent = makeAgent();
    agent.advancePlan('vodka', 600, 1932);
    expect(agent.getQuotaType()).toBe('vodka');
    expect(agent.getQuotaTarget()).toBe(600);
    expect(agent.getDeadlineYear()).toBe(1932);
    expect(agent.getQuotaProgress()).toBe(0);
  });

  it('sets and retrieves deadline year', () => {
    const agent = makeAgent();
    agent.setDeadlineYear(1942);
    expect(agent.getDeadlineYear()).toBe(1942);
  });

  it('returns high urgency when quota far behind and deadline near', () => {
    const agent = makeAgent();
    const urgency = agent.assessQuotaUrgency(0.2, 6);
    expect(urgency).toBeGreaterThan(0.6);
  });

  it('returns low urgency when quota nearly met', () => {
    const agent = makeAgent();
    const urgency = agent.assessQuotaUrgency(0.95, 24);
    expect(urgency).toBeLessThan(0.2);
  });

  it('returns zero urgency when quota is fully met', () => {
    const agent = makeAgent();
    const urgency = agent.assessQuotaUrgency(1.0, 12);
    expect(urgency).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Mandate generation per era
// ---------------------------------------------------------------------------

describe('PoliticalAgent — mandate generation', () => {
  it('generates mandates for the revolution era', () => {
    const agent = makeAgent(1917);
    agent.generateMandatesForCurrentEra('comrade');
    const mandates = agent.getMandates();
    expect(mandates.length).toBeGreaterThan(0);
    // Revolution mandates include workers-house-a
    const housingMandate = mandates.find((m) => m.defId === 'workers-house-a');
    expect(housingMandate).toBeDefined();
    expect(housingMandate!.fulfilled).toBe(0);
  });

  it('generates harder mandates on tovarish difficulty', () => {
    const agentNormal = makeAgent(1917);
    const agentHard = makeAgent(1917);
    agentNormal.generateMandatesForCurrentEra('comrade');
    agentHard.generateMandatesForCurrentEra('tovarish');

    const normalTotal = agentNormal.getMandates().reduce((s, m) => s + m.required, 0);
    const hardTotal = agentHard.getMandates().reduce((s, m) => s + m.required, 0);
    expect(hardTotal).toBeGreaterThan(normalTotal);
  });

  it('generates fewer mandates on worker difficulty', () => {
    const agentNormal = makeAgent(1917);
    const agentEasy = makeAgent(1917);
    agentNormal.generateMandatesForCurrentEra('comrade');
    agentEasy.generateMandatesForCurrentEra('worker');

    const normalTotal = agentNormal.getMandates().reduce((s, m) => s + m.required, 0);
    const easyTotal = agentEasy.getMandates().reduce((s, m) => s + m.required, 0);
    expect(easyTotal).toBeLessThanOrEqual(normalTotal);
  });

  it('records building placement and increments fulfillment', () => {
    const agent = makeAgent(1917);
    agent.generateMandatesForCurrentEra('comrade');
    const before = agent.getMandateFulfillment();

    agent.recordBuildingPlaced('workers-house-a');
    const after = agent.getMandateFulfillment();
    expect(after).toBeGreaterThan(before);
  });

  it('allMandatesComplete returns true when all fulfilled', () => {
    const agent = makeAgent(1917);
    agent.generateMandatesForCurrentEra('comrade');

    // Fulfill all mandates
    const mandates = agent.getMandates();
    for (const m of mandates) {
      for (let i = 0; i < m.required; i++) {
        agent.recordBuildingPlaced(m.defId);
      }
    }
    expect(agent.allMandatesComplete()).toBe(true);
  });

  it('generates industrialization mandates after era transition', () => {
    const agent = makeAgent(1917);
    agent.checkEraTransition(1932);
    agent.generateMandatesForCurrentEra('comrade');
    const mandates = agent.getMandates();
    const defIds = mandates.map((m) => m.defId);
    // Industrialization era mandates include power-station and factory-office
    expect(defIds).toContain('power-station');
    expect(defIds).toContain('factory-office');
  });
});

// ---------------------------------------------------------------------------
// 6. Annual report strategy
// ---------------------------------------------------------------------------

describe('PoliticalAgent — annual report strategy', () => {
  it('recommends honest when quota is fully met', () => {
    const agent = makeAgent();
    expect(agent.evaluateReportStrategy(1.0, 0)).toBe('honest');
    expect(agent.evaluateReportStrategy(1.2, 0)).toBe('honest');
  });

  it('recommends honest when shortfall is small (<20%)', () => {
    const agent = makeAgent();
    // 85% met = 15% deficit — not worth the risk
    expect(agent.evaluateReportStrategy(0.85, 0)).toBe('honest');
  });

  it('recommends falsify for moderate shortfall with low marks', () => {
    const agent = makeAgent();
    // 65% met = 35% deficit, no prior pripiski, no marks
    expect(agent.evaluateReportStrategy(0.65, 0)).toBe('falsify');
  });

  it('recommends honest when shortfall is too large (>50%)', () => {
    const agent = makeAgent();
    // 40% met = 60% deficit — too obvious to falsify
    expect(agent.evaluateReportStrategy(0.4, 0)).toBe('honest');
  });

  it('switches to honest when inspection risk is high from pripiski history', () => {
    const agent = makeAgent();
    // Record enough pripiski to push inspectionRisk above 0.4
    agent.recordPripiski();
    agent.recordPripiski();
    agent.recordPripiski(); // 3 × 0.15 = 0.45 → honest
    expect(agent.evaluateReportStrategy(0.65, 0)).toBe('honest');
  });

  it('switches to honest when marks are high', () => {
    const agent = makeAgent();
    // marks * 0.1 = 4 * 0.1 = 0.4 → honest
    expect(agent.evaluateReportStrategy(0.65, 4)).toBe('honest');
  });
});

// ---------------------------------------------------------------------------
// 7. Pripiski inflation + inspection risk
// ---------------------------------------------------------------------------

describe('PoliticalAgent — pripiski', () => {
  it('inflates quota target after pripiski is recorded', () => {
    const agent = makeAgent();
    agent.updateQuota(0.5, 100);
    agent.recordPripiski();
    // Quota should be inflated by 20%: 100 * 1.2 = 120
    expect(agent.getQuotaTarget()).toBe(120);
    expect(agent.getPripiskiHistory()).toBe(1);
  });

  it('accumulates pripiski history across multiple incidents', () => {
    const agent = makeAgent();
    agent.updateQuota(0, 100);
    agent.recordPripiski();
    agent.recordPripiski();
    expect(agent.getPripiskiHistory()).toBe(2);
    // 100 * 1.2 * 1.2 = 144
    expect(agent.getQuotaTarget()).toBe(144);
  });

  it('exports PRIPISKI_QUOTA_INFLATION as 0.2', () => {
    expect(PRIPISKI_QUOTA_INFLATION).toBe(0.2);
  });

  it('exports PRIPISKI_INSPECTION_BONUS as 0.15', () => {
    expect(PRIPISKI_INSPECTION_BONUS).toBe(0.15);
  });

  it('computes falsification risk correctly', () => {
    const agent = makeAgent();
    expect(agent.computeFalsificationRisk(100, 100)).toBe(0);   // exact — no risk
    expect(agent.computeFalsificationRisk(100, 150)).toBe(50);  // 50% over-reporting
    expect(agent.computeFalsificationRisk(0, 50)).toBe(100);    // actual 0 → max risk
    expect(agent.computeFalsificationRisk(0, 0)).toBe(0);       // both 0 → no risk
  });

  it('computes investigation probability increasing with risk', () => {
    const agent = makeAgent();
    const lowRisk = agent.computeInvestigationProbability(10, 5, 5);
    const highRisk = agent.computeInvestigationProbability(70, 60, 50);
    expect(highRisk).toBeGreaterThan(lowRisk);
    expect(highRisk).toBeLessThanOrEqual(0.8); // capped at 80%
  });

  it('blat insurance reduces investigation probability', () => {
    const agent = makeAgent();
    const withoutBlat = agent.computeInvestigationProbability(50, 40, 30, 0);
    const withBlat = agent.computeInvestigationProbability(50, 40, 30, 50);
    expect(withBlat).toBeLessThan(withoutBlat);
  });

  it('prior pripiski history increases investigation probability', () => {
    const agent = makeAgent();
    const fresh = agent.computeInvestigationProbability(20, 10, 10);
    agent.recordPripiski();
    agent.recordPripiski();
    const experienced = agent.computeInvestigationProbability(20, 10, 10);
    expect(experienced).toBeGreaterThan(fresh);
  });
});

// ---------------------------------------------------------------------------
// 8. Consecutive failure counting
// ---------------------------------------------------------------------------

describe('PoliticalAgent — consecutive failures', () => {
  it('tracks consecutive failures and resets correctly', () => {
    const agent = makeAgent();
    expect(agent.getConsecutiveFailures()).toBe(0);

    agent.recordQuotaFailure();
    agent.recordQuotaFailure();
    expect(agent.getConsecutiveFailures()).toBe(2);

    agent.resetConsecutiveFailures();
    expect(agent.getConsecutiveFailures()).toBe(0);
  });

  it('exports MAX_QUOTA_FAILURES constant as 3', () => {
    expect(MAX_QUOTA_FAILURES).toBe(3);
  });

  it('reaches game-over threshold after MAX_QUOTA_FAILURES consecutive failures', () => {
    const agent = makeAgent();
    for (let i = 0; i < MAX_QUOTA_FAILURES; i++) {
      agent.recordQuotaFailure();
    }
    expect(agent.getConsecutiveFailures()).toBeGreaterThanOrEqual(MAX_QUOTA_FAILURES);
  });
});

// ---------------------------------------------------------------------------
// 9. Stakhanovite threshold
// ---------------------------------------------------------------------------

describe('PoliticalAgent — Stakhanovite threshold', () => {
  it('raises difficulty when Stakhanovite threshold is exceeded', () => {
    const agent = makeAgent();
    expect(agent.shouldRaiseDifficulty(1.15)).toBe(true);
    expect(agent.shouldRaiseDifficulty(1.2)).toBe(true);
    expect(agent.shouldRaiseDifficulty(1.5)).toBe(true);
  });

  it('does not raise difficulty below Stakhanovite threshold', () => {
    const agent = makeAgent();
    expect(agent.shouldRaiseDifficulty(1.0)).toBe(false);
    expect(agent.shouldRaiseDifficulty(1.14)).toBe(false);
    expect(agent.shouldRaiseDifficulty(0.8)).toBe(false);
  });

  it('exports STAKHANOVITE_THRESHOLD constant as 1.15', () => {
    expect(STAKHANOVITE_THRESHOLD).toBe(1.15);
  });
});

// ---------------------------------------------------------------------------
// 10. Serialization round-trip
// ---------------------------------------------------------------------------

describe('PoliticalAgent — serialization', () => {
  it('serializes and deserializes full state correctly', () => {
    const agent = makeAgent();

    // Advance through 2 era transitions (canonical dates)
    agent.checkEraTransition(1922); // → collectivization
    agent.checkEraTransition(1932); // → industrialization
    agent.updateQuota(0.7, 500);
    agent.recordQuotaFailure();
    agent.recordPripiski();
    agent.setDeadlineYear(1937);
    agent.generateMandatesForCurrentEra('comrade');
    agent.recordBuildingPlaced('power-station');

    const json = agent.toJSON();
    expect(json.currentYear).toBe(1932);
    expect(json.previousEraId).toBe('collectivization');
    expect(json.quotaProgress).toBeCloseTo(0.7);
    expect(json.quotaTarget).toBeGreaterThan(500); // inflated by pripiski
    expect(json.consecutiveFailures).toBe(1);
    expect(json.pripiskiHistory).toBe(1);
    expect(json.deadlineYear).toBe(1937);
    expect(json.mandates.length).toBeGreaterThan(0);

    // Restore into a fresh agent
    const agent2 = makeAgent();
    agent2.fromJSON(json);

    expect(agent2.getCurrentEra().id).toBe('industrialization');
    expect(agent2.getPreviousEraId()).toBe('collectivization');
    expect(agent2.getQuotaProgress()).toBeCloseTo(0.7);
    expect(agent2.getConsecutiveFailures()).toBe(1);
    expect(agent2.getPripiskiHistory()).toBe(1);
    expect(agent2.getDeadlineYear()).toBe(1937);
    expect(agent2.getMandates().length).toBeGreaterThan(0);
  });

  it('fromJSON is isolated from the source object', () => {
    const agent = makeAgent();
    const data = agent.toJSON();

    const agent2 = makeAgent();
    agent2.fromJSON(data);
    agent2.recordQuotaFailure();

    // Original agent should be unaffected
    expect(agent.getConsecutiveFailures()).toBe(0);
  });

  it('serializes mandates with fulfillment state', () => {
    const agent = makeAgent(1917);
    agent.generateMandatesForCurrentEra('comrade');
    agent.recordBuildingPlaced('workers-house-a');

    const json = agent.toJSON();
    const housingMandate = json.mandates.find((m) => m.defId === 'workers-house-a');
    expect(housingMandate).toBeDefined();
    expect(housingMandate!.fulfilled).toBe(1);

    const agent2 = makeAgent();
    agent2.fromJSON(json);
    const restored = agent2.getMandates().find((m) => m.defId === 'workers-house-a');
    expect(restored!.fulfilled).toBe(1);
  });

  it('preserves resourceQuotas in serialization round-trip', () => {
    const agent = makeAgent();
    agent.syncResourceQuotas({ food: 200, vodka: 80 });

    const json = agent.toJSON();
    const agent2 = makeAgent();
    agent2.fromJSON(json);

    // Resource quotas should be preserved
    const restored = agent2.toJSON();
    expect(restored.resourceQuotas).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 11. Telegram constants
// ---------------------------------------------------------------------------

describe('PoliticalAgent — telegram constants', () => {
  it('exposes relevant telegram constants via static MSG', () => {
    expect(PoliticalAgent.MSG.ERA_TRANSITION).toBe('ERA_TRANSITION');
    expect(PoliticalAgent.MSG.QUOTA_DEADLINE).toBe('QUOTA_DEADLINE');
    expect(PoliticalAgent.MSG.PLAN_UPDATED).toBe('PLAN_UPDATED');
    expect(PoliticalAgent.MSG.ANNUAL_REPORT_DUE).toBe('ANNUAL_REPORT_DUE');
    expect(PoliticalAgent.MSG.NEW_YEAR).toBe('NEW_YEAR');
    expect(PoliticalAgent.MSG.REPORT_SUBMITTED).toBe('REPORT_SUBMITTED');
  });
});

// ---------------------------------------------------------------------------
// 12. Available buildings gate
// ---------------------------------------------------------------------------

describe('PoliticalAgent — building availability', () => {
  it('returns revolution buildings in revolution era', () => {
    const agent = makeAgent(1917);
    const available = agent.getAvailableBuildings();
    expect(available).toContain('workers-house-a');
    expect(available).toContain('collective-farm-hq');
    // Later-era buildings should not be available
    expect(available).not.toContain('power-station'); // unlocked in industrialization
  });

  it('includes all prior-era buildings cumulatively after transition', () => {
    const agent = makeAgent();
    agent.checkEraTransition(1922); // → collectivization
    agent.checkEraTransition(1932); // → industrialization

    const available = agent.getAvailableBuildings();
    // Revolution buildings still available
    expect(available).toContain('workers-house-a');
    // Collectivization buildings available
    expect(available).toContain('warehouse');
    // Industrialization buildings available
    expect(available).toContain('power-station');
    expect(available).toContain('factory-office');
  });

  it('isBuildingAvailable returns true for unlocked buildings', () => {
    const agent = makeAgent(1917);
    expect(agent.isBuildingAvailable('workers-house-a')).toBe(true);
    expect(agent.isBuildingAvailable('power-station')).toBe(false);
  });

  it('isBuildingAvailable returns true after era unlocks building', () => {
    const agent = makeAgent(1917);
    agent.checkEraTransition(1932);
    expect(agent.isBuildingAvailable('power-station')).toBe(true);
  });
});

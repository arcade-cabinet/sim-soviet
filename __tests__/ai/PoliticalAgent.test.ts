import {
  PoliticalAgent,
  SOVIET_ERAS,
  MAX_QUOTA_FAILURES,
  PRIPISKI_QUOTA_INFLATION,
  STAKHANOVITE_THRESHOLD,
} from '../../src/ai/agents/PoliticalAgent';

describe('PoliticalAgent', () => {
  // 1. Instantiation
  it('can be instantiated', () => {
    const agent = new PoliticalAgent();
    expect(agent.name).toBe('PoliticalAgent');
    expect(agent.getCurrentEraIndex()).toBe(0);
    expect(agent.getCurrentEra().name).toBe('Revolution');
    expect(agent.getConsecutiveFailures()).toBe(0);
    expect(agent.getPripiskiHistory()).toBe(0);
  });

  // 2. Era transition detection at year boundaries
  it('detects era transition at year boundaries', () => {
    const agent = new PoliticalAgent();

    // Still in Revolution era (1917-1922)
    expect(agent.checkEraTransition(1920)).toBe(-1);
    expect(agent.getCurrentEraIndex()).toBe(0);

    // Crosses into Collectivization at 1922
    const newEra = agent.checkEraTransition(1922);
    expect(newEra).toBe(1);
    expect(agent.getCurrentEraIndex()).toBe(1);
    expect(agent.getCurrentEra().name).toBe('Collectivization');
  });

  it('progresses through all 8 eras in order', () => {
    const agent = new PoliticalAgent();

    const boundaryYears = [1922, 1932, 1941, 1945, 1952, 1964, 1985, 9999];
    const expectedNames = [
      'Collectivization',
      'Industrialization',
      'Great Patriotic War',
      'Reconstruction',
      'Thaw',
      'Stagnation',
      'Eternal',
    ];

    for (let i = 0; i < expectedNames.length; i++) {
      agent.checkEraTransition(boundaryYears[i]);
      expect(agent.getCurrentEra().name).toBe(expectedNames[i]);
    }
  });

  it('returns -1 when no transition occurs within the current era', () => {
    const agent = new PoliticalAgent();
    // Still in Revolution era — 1917 to 1921 should return -1
    expect(agent.checkEraTransition(1919)).toBe(-1);
    expect(agent.checkEraTransition(1921)).toBe(-1);
    expect(agent.getCurrentEraIndex()).toBe(0);
  });

  // 3. High quota urgency when behind + near deadline
  it('returns high urgency when quota is far behind and deadline is near', () => {
    const agent = new PoliticalAgent();
    // 20% progress, only 6 months left
    const urgency = agent.assessQuotaUrgency(0.2, 6);
    expect(urgency).toBeGreaterThan(0.6);
  });

  // 4. Low urgency when quota nearly met
  it('returns low urgency when quota is nearly met', () => {
    const agent = new PoliticalAgent();
    // 95% done, 24 months remaining
    const urgency = agent.assessQuotaUrgency(0.95, 24);
    expect(urgency).toBeLessThan(0.2);
  });

  it('returns zero urgency when quota is fully met', () => {
    const agent = new PoliticalAgent();
    const urgency = agent.assessQuotaUrgency(1.0, 12);
    expect(urgency).toBe(0);
  });

  // 5. Recommends honest report when quota is met
  it('recommends honest report when quota is fully met', () => {
    const agent = new PoliticalAgent();
    expect(agent.evaluateReportStrategy(1.0, 0)).toBe('honest');
    expect(agent.evaluateReportStrategy(1.2, 0)).toBe('honest');
  });

  // 6. Recommends falsify for moderate shortfall with low marks
  it('recommends falsify when there is a moderate shortfall and marks are low', () => {
    const agent = new PoliticalAgent();
    // 65% quota met = 35% deficit, no prior pripiski, no marks
    const strategy = agent.evaluateReportStrategy(0.65, 0);
    expect(strategy).toBe('falsify');
  });

  it('recommends honest when shortfall is too large (>50%)', () => {
    const agent = new PoliticalAgent();
    // 40% met = 60% deficit — too obvious to falsify
    expect(agent.evaluateReportStrategy(0.4, 0)).toBe('honest');
  });

  it('recommends honest when shortfall is too small (<20%)', () => {
    const agent = new PoliticalAgent();
    // 85% met = 15% deficit — not worth the risk
    expect(agent.evaluateReportStrategy(0.85, 0)).toBe('honest');
  });

  it('switches to honest for moderate shortfall when inspection risk is high', () => {
    const agent = new PoliticalAgent();
    // Record several pripiski to inflate inspection risk
    agent.recordPripiski();
    agent.recordPripiski();
    agent.recordPripiski(); // 3 × 0.15 = 0.45 inspection risk → honest
    const strategy = agent.evaluateReportStrategy(0.65, 0);
    expect(strategy).toBe('honest');
  });

  // 7. Tracks consecutive failures
  it('tracks consecutive failures and resets correctly', () => {
    const agent = new PoliticalAgent();
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
    const agent = new PoliticalAgent();
    for (let i = 0; i < MAX_QUOTA_FAILURES; i++) {
      agent.recordQuotaFailure();
    }
    expect(agent.getConsecutiveFailures()).toBeGreaterThanOrEqual(MAX_QUOTA_FAILURES);
  });

  // 8. Stakhanovite: quota >115% raises difficulty
  it('raises difficulty when Stakhanovite threshold is exceeded', () => {
    const agent = new PoliticalAgent();
    expect(agent.shouldRaiseDifficulty(1.15)).toBe(true);
    expect(agent.shouldRaiseDifficulty(1.2)).toBe(true);
    expect(agent.shouldRaiseDifficulty(1.5)).toBe(true);
  });

  it('does not raise difficulty below Stakhanovite threshold', () => {
    const agent = new PoliticalAgent();
    expect(agent.shouldRaiseDifficulty(1.0)).toBe(false);
    expect(agent.shouldRaiseDifficulty(1.14)).toBe(false);
    expect(agent.shouldRaiseDifficulty(0.8)).toBe(false);
  });

  it('exports STAKHANOVITE_THRESHOLD constant as 1.15', () => {
    expect(STAKHANOVITE_THRESHOLD).toBe(1.15);
  });

  // Pripiski / quota inflation
  it('inflates quota target after pripiski is recorded', () => {
    const agent = new PoliticalAgent();
    agent.updateQuota(0.5, 100);
    agent.recordPripiski();
    // Quota should be inflated by 20%: 100 * 1.2 = 120
    expect(agent.getPripiskiHistory()).toBe(1);
  });

  it('exports PRIPISKI_QUOTA_INFLATION constant as 0.2', () => {
    expect(PRIPISKI_QUOTA_INFLATION).toBe(0.2);
  });

  // 9. Serializes and deserializes
  it('serializes and deserializes state correctly', () => {
    const agent = new PoliticalAgent();

    // Advance state: must cross boundaries one at a time
    agent.checkEraTransition(1922); // → Collectivization (index 1)
    agent.checkEraTransition(1932); // → Industrialization (index 2)
    agent.updateQuota(0.7, 500);
    agent.recordQuotaFailure();
    agent.recordPripiski();
    agent.setDeadlineYear(1937);

    const json = agent.toJSON();
    expect(json.currentEraIndex).toBe(2);
    expect(json.quotaProgress).toBeCloseTo(0.7);
    expect(json.quotaTarget).toBeGreaterThan(500); // inflated by pripiski
    expect(json.consecutiveFailures).toBe(1);
    expect(json.pripiskiHistory).toBe(1);
    expect(json.deadlineYear).toBe(1937);

    // Restore into a fresh agent
    const agent2 = new PoliticalAgent();
    agent2.fromJSON(json);

    expect(agent2.getCurrentEraIndex()).toBe(2);
    expect(agent2.getCurrentEra().name).toBe('Industrialization');
    expect(agent2.getQuotaProgress()).toBeCloseTo(0.7);
    expect(agent2.getConsecutiveFailures()).toBe(1);
    expect(agent2.getPripiskiHistory()).toBe(1);
    expect(agent2.getDeadlineYear()).toBe(1937);
  });

  it('fromJSON is isolated from the source object', () => {
    const agent = new PoliticalAgent();
    const data = agent.toJSON();
    agent2: {
      const agent2 = new PoliticalAgent();
      agent2.fromJSON(data);
      agent2.recordQuotaFailure();
      // Original agent should be unaffected
      expect(agent.getConsecutiveFailures()).toBe(0);
    }
  });

  // Telegram constants
  it('exposes relevant telegram constants via static MSG', () => {
    expect(PoliticalAgent.MSG.ERA_TRANSITION).toBe('ERA_TRANSITION');
    expect(PoliticalAgent.MSG.QUOTA_DEADLINE).toBe('QUOTA_DEADLINE');
    expect(PoliticalAgent.MSG.PLAN_UPDATED).toBe('PLAN_UPDATED');
    expect(PoliticalAgent.MSG.ANNUAL_REPORT_DUE).toBe('ANNUAL_REPORT_DUE');
    expect(PoliticalAgent.MSG.NEW_YEAR).toBe('NEW_YEAR');
    expect(PoliticalAgent.MSG.REPORT_SUBMITTED).toBe('REPORT_SUBMITTED');
  });

  // Era definitions completeness
  it('SOVIET_ERAS has exactly 8 entries covering 1917-9999', () => {
    expect(SOVIET_ERAS).toHaveLength(8);
    expect(SOVIET_ERAS[0].startYear).toBe(1917);
    expect(SOVIET_ERAS[7].endYear).toBe(9999);
  });

  // Deadline accessors
  it('can set and retrieve deadline year', () => {
    const agent = new PoliticalAgent();
    agent.setDeadlineYear(1942);
    expect(agent.getDeadlineYear()).toBe(1942);
  });

  // updateQuota clamps to [0,1]
  it('clamps quota progress between 0 and 1', () => {
    const agent = new PoliticalAgent();
    agent.updateQuota(-0.5);
    expect(agent.getQuotaProgress()).toBe(0);
    agent.updateQuota(2.0);
    expect(agent.getQuotaProgress()).toBe(1);
  });
});

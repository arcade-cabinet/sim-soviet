import { KGBAgent } from '../../src/ai/agents/KGBAgent';
import type { KGBState } from '../../src/ai/agents/KGBAgent';

describe('KGBAgent', () => {
  // Test 1: Instantiation
  it('can be instantiated with name KGBAgent', () => {
    const kgb = new KGBAgent();
    expect(kgb.name).toBe('KGBAgent');
  });

  // Test 2: Low suspicion at 0 marks
  it('has low suspicion with 0 marks and full quota', () => {
    const kgb = new KGBAgent('comrade');
    kgb.assessThreat(0, 0, 1.0, 'comrade');
    expect(kgb.getSuspicionLevel()).toBe(0);
    expect(kgb.getInvestigationIntensity()).toBe('routine');
  });

  // Test 3: High suspicion with marks near threshold
  it('has high suspicion with marks near arrest threshold', () => {
    const kgb = new KGBAgent('tovarish');
    // tovarish aggression threshold = 3 marks; 6 marks is well above it
    kgb.assessThreat(6, 0, 0.5, 'tovarish');
    expect(kgb.getSuspicionLevel()).toBeGreaterThan(0.6);
  });

  // Test 4: Escalates at 3+ marks
  it('escalates at 3 or more marks', () => {
    const kgb = new KGBAgent('comrade');

    kgb.assessThreat(2, 0, 1.0, 'comrade');
    expect(kgb.shouldEscalate()).toBe(false);

    kgb.assessThreat(3, 0, 1.0, 'comrade');
    expect(kgb.shouldEscalate()).toBe(true);

    kgb.assessThreat(5, 0, 1.0, 'comrade');
    expect(kgb.shouldEscalate()).toBe(true);
  });

  // Test 5: Investigation intensity matches suspicion level
  it('maps suspicion ranges to correct investigation intensity', () => {
    const kgb = new KGBAgent('worker');
    // worker aggression threshold = 8 marks

    // 0 marks → suspicion ≈ 0 → routine
    kgb.assessThreat(0, 0, 1.0, 'worker');
    expect(kgb.getInvestigationIntensity()).toBe('routine');

    // 3 marks / 8 threshold = 0.375 suspicion → thorough
    kgb.assessThreat(3, 0, 1.0, 'worker');
    expect(kgb.getInvestigationIntensity()).toBe('thorough');

    // 6 marks / 8 threshold = 0.75 suspicion → purge
    kgb.assessThreat(6, 0, 1.0, 'worker');
    expect(kgb.getInvestigationIntensity()).toBe('purge');
  });

  // Test 6: Arrest risk is 1.0 at or above arrest threshold (7 marks)
  it('returns arrest risk of 1.0 at or above arrest threshold', () => {
    const kgb = new KGBAgent('comrade');
    kgb.assessThreat(7, 0, 1.0, 'comrade');
    expect(kgb.getArrestRisk()).toBe(1.0);

    kgb.assessThreat(10, 0, 1.0, 'comrade');
    expect(kgb.getArrestRisk()).toBe(1.0);
  });

  it('returns arrest risk of 0 with no marks', () => {
    const kgb = new KGBAgent('comrade');
    kgb.assessThreat(0, 0, 1.0, 'comrade');
    expect(kgb.getArrestRisk()).toBe(0);
  });

  it('returns arrest risk scaled linearly between 0 and threshold', () => {
    const kgb = new KGBAgent('comrade');
    kgb.assessThreat(3, 0, 1.0, 'comrade'); // 3/7 ≈ 0.4286
    const risk = kgb.getArrestRisk();
    expect(risk).toBeGreaterThan(0);
    expect(risk).toBeLessThan(1.0);
    expect(risk).toBeCloseTo(3 / 7, 4);
  });

  // Test 7: Difficulty affects aggression thresholds
  it('difficulty affects aggression level and suspicion threshold', () => {
    const low = new KGBAgent('worker');
    const high = new KGBAgent('tovarish');

    // Same marks, quota: tovarish (high) reaches higher suspicion sooner
    low.assessThreat(3, 0, 1.0, 'worker');    // 3/8 = 0.375
    high.assessThreat(3, 0, 1.0, 'tovarish'); // 3/3 = 1.0

    expect(high.getSuspicionLevel()).toBeGreaterThan(low.getSuspicionLevel());
    expect(high.getAggression()).toBe('high');
    expect(low.getAggression()).toBe('low');
  });

  // Test 8: Serializes and deserializes state
  it('serializes and deserializes state correctly', () => {
    const kgb = new KGBAgent('tovarish');
    kgb.assessThreat(4, 1, 0.6, 'tovarish');

    const saved: KGBState = kgb.toJSON();
    expect(saved.markCount).toBe(4);
    expect(saved.aggression).toBe('high');
    expect(saved.suspicionLevel).toBeGreaterThan(0);
    expect(['routine', 'thorough', 'purge']).toContain(saved.investigationIntensity);

    const kgb2 = new KGBAgent();
    kgb2.fromJSON(saved);
    expect(kgb2.getSuspicionLevel()).toBe(saved.suspicionLevel);
    expect(kgb2.getAggression()).toBe(saved.aggression);
    expect(kgb2.getInvestigationIntensity()).toBe(saved.investigationIntensity);
    expect(kgb2.getArrestRisk()).toBe(kgb.getArrestRisk());
  });

  // Additional: Bribe offer reduces suspicion
  it('reduces suspicion when bribe is offered', () => {
    const kgb = new KGBAgent('comrade');
    kgb.assessThreat(4, 0, 1.0, 'comrade');
    const suspicionBefore = kgb.getSuspicionLevel();

    kgb.handleBribeOffer(1.0);
    expect(kgb.getSuspicionLevel()).toBeLessThan(suspicionBefore);
  });

  // Additional: ERA_TRANSITION escalates aggression for later eras
  it('escalates aggression on late-era ERA_TRANSITION', () => {
    const kgb = new KGBAgent('worker'); // starts 'low'
    expect(kgb.getAggression()).toBe('low');

    kgb.handleEraTransition(4); // era 4 → high aggression
    expect(kgb.getAggression()).toBe('high');
  });

  // Additional: commendations mitigate suspicion
  it('commendations reduce suspicion level', () => {
    const kgbNoComm = new KGBAgent('comrade');
    const kgbWithComm = new KGBAgent('comrade');

    kgbNoComm.assessThreat(3, 0, 1.0, 'comrade');
    kgbWithComm.assessThreat(3, 4, 1.0, 'comrade');

    expect(kgbWithComm.getSuspicionLevel()).toBeLessThan(kgbNoComm.getSuspicionLevel());
  });
});

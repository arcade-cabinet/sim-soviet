import { ChairmanAgent } from '../../src/ai/agents/ChairmanAgent';

describe('ChairmanAgent', () => {
  it('can be instantiated with brain', () => {
    const chairman = new ChairmanAgent();
    expect(chairman.name).toBe('ChairmanAgent');
    expect(chairman.brain).toBeDefined();
  });

  it('evaluates survival goal as high priority during food crisis', () => {
    const chairman = new ChairmanAgent();
    chairman.assessGameState({ food: 10, population: 50 });

    const directive = chairman.getRecommendedDirective();
    expect(directive).toBe('food');
  });

  it('evaluates quota goal near deadline', () => {
    const chairman = new ChairmanAgent();
    chairman.assessGameState(
      { food: 5000, population: 50 },
      {
        quotaProgress: 0.3, // Only 30% of quota met
        quotaDeadlineMonths: 6, // 6 months left
        housingUtilization: 0.95, // Housing nearly full — limits growth score
      },
    );

    const directive = chairman.getRecommendedDirective();
    expect(['construction', 'production']).toContain(directive);
  });

  it('recommends balanced when stable', () => {
    const chairman = new ChairmanAgent();
    chairman.assessGameState(
      { food: 5000, population: 50 },
      {
        quotaProgress: 0.9, // Nearly met
        quotaDeadlineMonths: 12,
      },
    );

    const directive = chairman.getRecommendedDirective();
    expect(directive).toBe('balanced');
  });

  it('resolves minigame by choosing best expected value', () => {
    const chairman = new ChairmanAgent();
    chairman.assessGameState({ food: 500, population: 50 }, { blackMarks: 1, commendations: 2, blat: 3 });

    const choices = [
      {
        id: 'bribe',
        successChance: 0.8,
        onSuccess: { blackMarks: 0, commendations: 1, blat: -1 },
        onFailure: { blackMarks: 2, commendations: 0, blat: -2 },
      },
      {
        id: 'comply',
        successChance: 1.0,
        onSuccess: { blackMarks: 1, commendations: 0, blat: 0 },
        onFailure: { blackMarks: 1, commendations: 0, blat: 0 },
      },
    ];

    const choiceId = chairman.resolveMinigame(choices);
    expect(typeof choiceId).toBe('string');
    expect(['bribe', 'comply']).toContain(choiceId);
  });

  it('resolves annual report honestly when quota met', () => {
    const chairman = new ChairmanAgent();
    chairman.assessGameState({ food: 500, population: 50 });
    expect(chairman.resolveAnnualReport(1.0)).toBe(true);
  });

  it('resolves annual report honestly for large shortfall', () => {
    const chairman = new ChairmanAgent();
    chairman.assessGameState({ food: 500, population: 50 });
    expect(chairman.resolveAnnualReport(0.3)).toBe(true);
  });

  it('falsifies report for moderate shortfall when marks are low', () => {
    const chairman = new ChairmanAgent();
    chairman.assessGameState({ food: 500, population: 50 }, { blackMarks: 0, commendations: 0, blat: 0 });
    // 70% met, low marks -> falsify (return false = not honest)
    expect(chairman.resolveAnnualReport(0.7)).toBe(false);
  });

  it('is honest for moderate shortfall when marks are high', () => {
    const chairman = new ChairmanAgent();
    chairman.assessGameState({ food: 500, population: 50 }, { blackMarks: 4, commendations: 0, blat: 0 });
    // 70% met, high marks -> too risky to falsify
    expect(chairman.resolveAnnualReport(0.7)).toBe(true);
  });

  it('defense overrides all during emergency', () => {
    const chairman = new ChairmanAgent();
    chairman.assessGameState({ food: 5000, population: 50 }, { activeFires: 2, activeMeteors: 0, activeOutbreaks: 0 });
    // Defense should override balanced/quota
    expect(chairman.getRecommendedDirective()).toBe('food');
  });

  it('getScores returns copy of scores', () => {
    const chairman = new ChairmanAgent();
    chairman.assessGameState({ food: 100, population: 50 });
    const scores = chairman.getScores();
    expect(scores).toHaveProperty('survival');
    expect(scores).toHaveProperty('quota');
    expect(scores).toHaveProperty('political');
    expect(scores).toHaveProperty('growth');
    expect(scores).toHaveProperty('defense');
  });

  // ── shouldAttemptBribe ──

  it('recommends bribe when blackMarks >= 4 and blat >= 2', () => {
    const chairman = new ChairmanAgent();
    chairman.assessGameState({ food: 500, population: 50 }, { blackMarks: 4, commendations: 0, blat: 5 });
    const result = chairman.shouldAttemptBribe();
    expect(result.shouldBribe).toBe(true);
    expect(result.amount).toBe(0.5);
  });

  it('does not recommend bribe when blackMarks < 4', () => {
    const chairman = new ChairmanAgent();
    chairman.assessGameState({ food: 500, population: 50 }, { blackMarks: 3, commendations: 0, blat: 5 });
    const result = chairman.shouldAttemptBribe();
    expect(result.shouldBribe).toBe(false);
    expect(result.amount).toBe(0);
  });

  it('does not recommend bribe when blat < 2', () => {
    const chairman = new ChairmanAgent();
    chairman.assessGameState({ food: 500, population: 50 }, { blackMarks: 5, commendations: 0, blat: 1 });
    const result = chairman.shouldAttemptBribe();
    expect(result.shouldBribe).toBe(false);
    expect(result.amount).toBe(0);
  });

  it('recommends bribe at exact threshold (marks=4, blat=2)', () => {
    const chairman = new ChairmanAgent();
    chairman.assessGameState({ food: 500, population: 50 }, { blackMarks: 4, commendations: 0, blat: 2 });
    const result = chairman.shouldAttemptBribe();
    expect(result.shouldBribe).toBe(true);
    expect(result.amount).toBe(0.5);
  });

  it('does not recommend bribe with no blat (undefined)', () => {
    const chairman = new ChairmanAgent();
    chairman.assessGameState({ food: 500, population: 50 }, { blackMarks: 5, commendations: 0 });
    const result = chairman.shouldAttemptBribe();
    expect(result.shouldBribe).toBe(false);
    expect(result.amount).toBe(0);
  });
});

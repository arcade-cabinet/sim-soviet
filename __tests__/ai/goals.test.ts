import { evaluateSurvival } from '../../src/ai/goals/SurvivalGoal';
import { evaluateQuota } from '../../src/ai/goals/QuotaGoal';
import { evaluatePolitical } from '../../src/ai/goals/PoliticalGoal';
import { evaluateGrowth } from '../../src/ai/goals/GrowthGoal';
import { evaluateDefense } from '../../src/ai/goals/DefenseGoal';

describe('Goal Evaluators', () => {
  describe('SurvivalGoal', () => {
    it('returns 1.0 for extreme food crisis (< 1.0 per capita)', () => {
      expect(evaluateSurvival({ foodPerCapita: 0.5, population: 50 })).toBe(1.0);
    });

    it('returns high score for food crisis (1-3 per capita)', () => {
      const score = evaluateSurvival({ foodPerCapita: 2.0, population: 50 });
      expect(score).toBeGreaterThan(0.6);
      expect(score).toBeLessThan(1.0);
    });

    it('returns low score when food is abundant', () => {
      const score = evaluateSurvival({ foodPerCapita: 20, population: 50 });
      expect(score).toBeLessThan(0.2);
    });

    it('returns 0 for zero population', () => {
      expect(evaluateSurvival({ foodPerCapita: 0, population: 0 })).toBe(0);
    });
  });

  describe('QuotaGoal', () => {
    it('returns low score when quota is met', () => {
      expect(evaluateQuota({ quotaProgress: 1.0, quotaDeadlineMonths: 12 })).toBe(0.1);
    });

    it('returns high score when quota is far behind near deadline', () => {
      const score = evaluateQuota({ quotaProgress: 0.2, quotaDeadlineMonths: 2 });
      expect(score).toBeGreaterThan(0.7);
    });

    it('returns moderate score for moderate gap with time remaining', () => {
      const score = evaluateQuota({ quotaProgress: 0.5, quotaDeadlineMonths: 12 });
      expect(score).toBeGreaterThan(0.2);
      expect(score).toBeLessThan(0.6);
    });
  });

  describe('PoliticalGoal', () => {
    it('returns 1.0 at arrest threshold', () => {
      expect(evaluatePolitical({ blackMarks: 5, commendations: 0, blat: 0 })).toBe(1.0);
    });

    it('returns low score with no marks', () => {
      expect(evaluatePolitical({ blackMarks: 0, commendations: 2, blat: 5 })).toBe(0);
    });

    it('is more sensitive with high KGB aggression', () => {
      const lowAgg = evaluatePolitical({ blackMarks: 2, commendations: 0, blat: 0, kgbAggression: 'low' });
      const highAgg = evaluatePolitical({ blackMarks: 2, commendations: 0, blat: 0, kgbAggression: 'high' });
      expect(highAgg).toBeGreaterThan(lowAgg);
    });
  });

  describe('DefenseGoal', () => {
    it('returns 0 with no emergencies', () => {
      expect(evaluateDefense({ activeFires: 0, activeMeteors: 0, activeOutbreaks: 0 })).toBe(0);
    });

    it('returns high score during emergency', () => {
      expect(evaluateDefense({ activeFires: 1, activeMeteors: 0, activeOutbreaks: 0 })).toBeGreaterThan(0.7);
    });

    it('caps at 1.0 with multiple emergencies', () => {
      expect(evaluateDefense({ activeFires: 5, activeMeteors: 5, activeOutbreaks: 5 })).toBe(1.0);
    });
  });

  describe('GrowthGoal', () => {
    it('returns 0 during food crisis', () => {
      expect(evaluateGrowth({ housingUtilization: 0.3, foodPerCapita: 1, population: 50 })).toBe(0);
    });

    it('returns high score when stable with room to grow', () => {
      const score = evaluateGrowth({ housingUtilization: 0.3, foodPerCapita: 10, population: 50 });
      expect(score).toBeGreaterThan(0.5);
    });

    it('returns lower score when housing is full', () => {
      const full = evaluateGrowth({ housingUtilization: 1.0, foodPerCapita: 10, population: 50 });
      const empty = evaluateGrowth({ housingUtilization: 0.2, foodPerCapita: 10, population: 50 });
      expect(full).toBeLessThan(empty);
    });
  });
});

/**
 * Tests for consequence mode rehabilitation flow.
 *
 * When arrested with non-permadeath consequence modes (forgiving/harsh),
 * the game applies rehabilitation instead of game over: destroys buildings,
 * removes workers, skips time, resets marks, and resumes gameplay.
 */

import { PersonnelFile } from '@/game/PersonnelFile';
import { CONSEQUENCE_PRESETS, type ConsequenceConfig } from '@/game/ScoringSystem';

describe('ConsequenceModes', () => {
  // ── Consequence Presets ──

  describe('CONSEQUENCE_PRESETS', () => {
    it('forgiving mode is not permadeath', () => {
      expect(CONSEQUENCE_PRESETS.forgiving.permadeath).toBe(false);
    });

    it('permadeath mode is permadeath', () => {
      expect(CONSEQUENCE_PRESETS.permadeath.permadeath).toBe(true);
    });

    it('harsh mode is not permadeath', () => {
      expect(CONSEQUENCE_PRESETS.harsh.permadeath).toBe(false);
    });

    it('forgiving has 1 year delay', () => {
      expect(CONSEQUENCE_PRESETS.forgiving.returnDelayYears).toBe(1);
    });

    it('harsh has 3 year delay', () => {
      expect(CONSEQUENCE_PRESETS.harsh.returnDelayYears).toBe(3);
    });

    it('forgiving retains 90% buildings', () => {
      expect(CONSEQUENCE_PRESETS.forgiving.buildingSurvival).toBe(0.9);
    });

    it('harsh retains 40% buildings', () => {
      expect(CONSEQUENCE_PRESETS.harsh.buildingSurvival).toBe(0.4);
    });

    it('forgiving resets marks to 1', () => {
      expect(CONSEQUENCE_PRESETS.forgiving.marksReset).toBe(1);
    });

    it('harsh resets marks to 2', () => {
      expect(CONSEQUENCE_PRESETS.harsh.marksReset).toBe(2);
    });
  });

  // ── PersonnelFile Rehabilitation ──

  describe('PersonnelFile.resetForRehabilitation', () => {
    it('resets black marks to specified value', () => {
      const file = new PersonnelFile('comrade');
      // Accumulate marks
      file.addMark('quota_missed_catastrophic', 100);
      file.addMark('quota_missed_catastrophic', 200);
      file.addMark('quota_missed_catastrophic', 300);
      expect(file.isArrested()).toBe(true);

      file.resetForRehabilitation(1, 500);
      expect(file.getBlackMarks()).toBe(1);
      expect(file.getCommendations()).toBe(0);
      expect(file.isArrested()).toBe(false);
      expect(file.getThreatLevel()).toBe('safe');
    });

    it('adds rehabilitation entry to history', () => {
      const file = new PersonnelFile('comrade');
      file.addMark('quota_missed_catastrophic', 100);
      file.addMark('quota_missed_catastrophic', 200);

      file.resetForRehabilitation(2, 1000);
      const history = file.getHistory();
      const rehabEntry = history.find((e) => e.source === 'rehabilitation');
      expect(rehabEntry).toBeDefined();
      expect(rehabEntry!.type).toBe('reset');
      expect(rehabEntry!.tick).toBe(1000);
      expect(rehabEntry!.description).toContain('rehabilitated');
    });

    it('works with marks reset to 0', () => {
      const file = new PersonnelFile('comrade');
      file.addMark('quota_missed_catastrophic', 100);
      file.addMark('quota_missed_catastrophic', 200);

      file.resetForRehabilitation(0, 500);
      expect(file.getBlackMarks()).toBe(0);
      expect(file.getEffectiveMarks()).toBe(0);
    });
  });

  // ── Consequence Config Shape ──

  describe('ConsequenceConfig shape', () => {
    const configs: [string, ConsequenceConfig][] = [
      ['forgiving', CONSEQUENCE_PRESETS.forgiving],
      ['permadeath', CONSEQUENCE_PRESETS.permadeath],
      ['harsh', CONSEQUENCE_PRESETS.harsh],
    ];

    it.each(configs)('%s has all required fields', (_name, config) => {
      expect(typeof config.label).toBe('string');
      expect(typeof config.subtitle).toBe('string');
      expect(typeof config.returnDelayYears).toBe('number');
      expect(typeof config.buildingSurvival).toBe('number');
      expect(typeof config.workerSurvival).toBe('number');
      expect(typeof config.resourceSurvival).toBe('number');
      expect(typeof config.marksReset).toBe('number');
      expect(typeof config.scorePenalty).toBe('number');
      expect(typeof config.permadeath).toBe('boolean');
      expect(typeof config.permadeathScoreMultiplier).toBe('number');
    });

    it.each(configs)('%s survival rates are in [0, 1]', (_name, config) => {
      expect(config.buildingSurvival).toBeGreaterThanOrEqual(0);
      expect(config.buildingSurvival).toBeLessThanOrEqual(1);
      expect(config.workerSurvival).toBeGreaterThanOrEqual(0);
      expect(config.workerSurvival).toBeLessThanOrEqual(1);
      expect(config.resourceSurvival).toBeGreaterThanOrEqual(0);
      expect(config.resourceSurvival).toBeLessThanOrEqual(1);
    });
  });
});

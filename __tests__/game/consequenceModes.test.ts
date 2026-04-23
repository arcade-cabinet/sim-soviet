/**
 * Tests for consequence mode rehabilitation flow.
 *
 * When arrested with non-permadeath consequence modes (rehabilitated/gulag),
 * the game applies rehabilitation instead of game over: destroys buildings,
 * removes workers, skips time, resets marks, and resumes gameplay.
 */

import { CONSEQUENCE_PRESETS, type ConsequenceConfig } from '@/ai/agents/political/ScoringSystem';
import { PersonnelFile } from '../../src/ai/agents/political/KGBAgent';

describe('ConsequenceModes', () => {
  // ── Consequence Presets ──

  describe('CONSEQUENCE_PRESETS', () => {
    it('rehabilitated mode is not permadeath', () => {
      expect(CONSEQUENCE_PRESETS.rehabilitated.permadeath).toBe(false);
    });

    it('rasstrelyat mode is permadeath', () => {
      expect(CONSEQUENCE_PRESETS.rasstrelyat.permadeath).toBe(true);
    });

    it('gulag mode is not permadeath', () => {
      expect(CONSEQUENCE_PRESETS.gulag.permadeath).toBe(false);
    });

    it('rehabilitated has 1 year delay', () => {
      expect(CONSEQUENCE_PRESETS.rehabilitated.returnDelayYears).toBe(1);
    });

    it('gulag has 3 year delay', () => {
      expect(CONSEQUENCE_PRESETS.gulag.returnDelayYears).toBe(3);
    });

    it('rehabilitated retains 90% buildings', () => {
      expect(CONSEQUENCE_PRESETS.rehabilitated.buildingSurvival).toBe(0.9);
    });

    it('gulag retains 40% buildings', () => {
      expect(CONSEQUENCE_PRESETS.gulag.buildingSurvival).toBe(0.4);
    });

    it('rehabilitated resets marks to 1', () => {
      expect(CONSEQUENCE_PRESETS.rehabilitated.marksReset).toBe(1);
    });

    it('gulag resets marks to 2', () => {
      expect(CONSEQUENCE_PRESETS.gulag.marksReset).toBe(2);
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
      ['rehabilitated', CONSEQUENCE_PRESETS.rehabilitated],
      ['rasstrelyat', CONSEQUENCE_PRESETS.rasstrelyat],
      ['gulag', CONSEQUENCE_PRESETS.gulag],
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

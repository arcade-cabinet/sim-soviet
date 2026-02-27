import { beforeEach, describe, expect, it } from 'vitest';
import {
  type DialogueCharacter,
  type DialogueContext,
  getAllDialogueLines,
  getAllLines,
  getAmbientChatter,
  getDialogue,
  getLineCounts,
  setDialogueRng,
} from '@/content/dialogue';
import { GameRng } from '@/game/SeedSystem';

const ALL_CHARACTERS: DialogueCharacter[] = [
  'worker',
  'politruk',
  'kgb',
  'military',
  'party_official',
  'advisor',
  'ambient',
];

const DEFAULT_CONTEXT: DialogueContext = {
  season: 'winter',
  resourceLevel: 'adequate',
  era: 'cold_war',
  threatLevel: 'safe',
  settlementTier: 'posyolok',
};

describe('DialoguePools', () => {
  beforeEach(() => {
    // Reset RNG with a fixed seed for deterministic tests
    setDialogueRng(new GameRng('test-seed-dialogue'));
  });

  describe('line counts', () => {
    it('has at least 120 total dialogue lines', () => {
      const total = getAllDialogueLines().length;
      expect(total).toBeGreaterThanOrEqual(120);
    });

    it('worker has at least 20 lines', () => {
      expect(getAllLines('worker').length).toBeGreaterThanOrEqual(20);
    });

    it('politruk has at least 15 lines', () => {
      expect(getAllLines('politruk').length).toBeGreaterThanOrEqual(15);
    });

    it('kgb has at least 15 lines', () => {
      expect(getAllLines('kgb').length).toBeGreaterThanOrEqual(15);
    });

    it('military has at least 10 lines', () => {
      expect(getAllLines('military').length).toBeGreaterThanOrEqual(10);
    });

    it('party_official has at least 15 lines', () => {
      expect(getAllLines('party_official').length).toBeGreaterThanOrEqual(15);
    });

    it('advisor has at least 25 lines', () => {
      expect(getAllLines('advisor').length).toBeGreaterThanOrEqual(25);
    });

    it('ambient has at least 15 lines', () => {
      expect(getAllLines('ambient').length).toBeGreaterThanOrEqual(15);
    });

    it('getLineCounts matches actual line arrays', () => {
      const counts = getLineCounts();
      for (const character of ALL_CHARACTERS) {
        expect(counts[character]).toBe(getAllLines(character).length);
      }
    });
  });

  describe('getDialogue', () => {
    it('returns a non-empty string for every character type', () => {
      for (const character of ALL_CHARACTERS) {
        const text = getDialogue(character, DEFAULT_CONTEXT);
        expect(text).toBeTruthy();
        expect(typeof text).toBe('string');
        expect(text.length).toBeGreaterThan(0);
      }
    });

    it('returns context-appropriate lines for winter', () => {
      const winterContext: DialogueContext = {
        ...DEFAULT_CONTEXT,
        season: 'winter',
      };
      // Call many times — should never crash, always return a string
      for (let i = 0; i < 50; i++) {
        const text = getDialogue('worker', winterContext);
        expect(text.length).toBeGreaterThan(0);
      }
    });

    it('returns context-appropriate lines for starving', () => {
      const starvingContext: DialogueContext = {
        ...DEFAULT_CONTEXT,
        resourceLevel: 'starving',
      };
      for (let i = 0; i < 50; i++) {
        const text = getDialogue('advisor', starvingContext);
        expect(text.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getAmbientChatter', () => {
    it('returns a non-empty string', () => {
      const text = getAmbientChatter(DEFAULT_CONTEXT);
      expect(text).toBeTruthy();
      expect(text.length).toBeGreaterThan(0);
    });

    it('returns different results with different context', () => {
      const results = new Set<string>();
      const contexts: DialogueContext[] = [
        { ...DEFAULT_CONTEXT, season: 'winter' },
        { ...DEFAULT_CONTEXT, season: 'mud' },
        { ...DEFAULT_CONTEXT, season: 'summer' },
        { ...DEFAULT_CONTEXT, resourceLevel: 'starving' },
        { ...DEFAULT_CONTEXT, threatLevel: 'watched' },
      ];
      // Generate many lines across contexts
      for (const ctx of contexts) {
        for (let i = 0; i < 20; i++) {
          results.add(getAmbientChatter(ctx));
        }
      }
      // Should have at least a few unique results
      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe('RNG determinism', () => {
    it('produces the same sequence with the same seed', () => {
      const seed = 'deterministic-test-seed';

      setDialogueRng(new GameRng(seed));
      const run1: string[] = [];
      for (let i = 0; i < 10; i++) {
        run1.push(getDialogue('worker', DEFAULT_CONTEXT));
      }

      setDialogueRng(new GameRng(seed));
      const run2: string[] = [];
      for (let i = 0; i < 10; i++) {
        run2.push(getDialogue('worker', DEFAULT_CONTEXT));
      }

      expect(run1).toEqual(run2);
    });

    it('produces different sequences with different seeds', () => {
      setDialogueRng(new GameRng('seed-alpha'));
      const run1: string[] = [];
      for (let i = 0; i < 20; i++) {
        run1.push(getDialogue('worker', DEFAULT_CONTEXT));
      }

      setDialogueRng(new GameRng('seed-beta'));
      const run2: string[] = [];
      for (let i = 0; i < 20; i++) {
        run2.push(getDialogue('worker', DEFAULT_CONTEXT));
      }

      // Very unlikely to be identical across 20 picks with different seeds
      expect(run1).not.toEqual(run2);
    });
  });

  describe('context-sensitive filtering', () => {
    it('worker lines include winter-specific content', () => {
      const workerLines = getAllLines('worker');
      const winterLines = workerLines.filter((l) => l.conditions?.season === 'winter');
      expect(winterLines.length).toBeGreaterThan(0);
    });

    it('advisor lines include starving-specific content', () => {
      const advisorLines = getAllLines('advisor');
      const starvingLines = advisorLines.filter((l) => l.conditions?.resourceLevel === 'starving');
      expect(starvingLines.length).toBeGreaterThan(0);
    });

    it('kgb lines include threat-specific content', () => {
      const kgbLines = getAllLines('kgb');
      const threatLines = kgbLines.filter(
        (l) =>
          l.conditions?.threatLevel === 'endangered' || l.conditions?.threatLevel === 'critical'
      );
      expect(threatLines.length).toBeGreaterThan(0);
    });

    it('ambient lines include season-specific content', () => {
      const ambientLines = getAllLines('ambient');
      const seasonLines = ambientLines.filter((l) => l.conditions?.season !== undefined);
      expect(seasonLines.length).toBeGreaterThan(0);
    });

    it('every character type has its correct character field', () => {
      for (const character of ALL_CHARACTERS) {
        const lines = getAllLines(character);
        for (const line of lines) {
          expect(line.character).toBe(character);
        }
      }
    });
  });

  describe('all lines are well-formed', () => {
    it('every line has non-empty text', () => {
      for (const line of getAllDialogueLines()) {
        expect(line.text.length).toBeGreaterThan(0);
      }
    });

    it('every line has a valid character field', () => {
      for (const line of getAllDialogueLines()) {
        expect(ALL_CHARACTERS).toContain(line.character);
      }
    });

    it('weights are positive when specified', () => {
      for (const line of getAllDialogueLines()) {
        if (line.weight !== undefined) {
          expect(line.weight).toBeGreaterThan(0);
        }
      }
    });
  });
});

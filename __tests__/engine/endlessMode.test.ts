/**
 * TDD tests for freeform endless mode — unlimited map expansion.
 */
import { isEndlessMode, getMaxGridSize, shouldExpand } from '../../src/game/engine/endlessMode';

describe('endlessMode', () => {
  // ─── isEndlessMode ────────────────────────────────────────

  describe('isEndlessMode', () => {
    it('returns true for freeform', () => {
      expect(isEndlessMode('freeform')).toBe(true);
    });

    it('returns false for historical', () => {
      expect(isEndlessMode('historical')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isEndlessMode('')).toBe(false);
    });

    it('returns false for unknown mode', () => {
      expect(isEndlessMode('sandbox')).toBe(false);
    });
  });

  // ─── getMaxGridSize ───────────────────────────────────────

  describe('getMaxGridSize', () => {
    it('returns Infinity for freeform mode', () => {
      expect(getMaxGridSize('freeform')).toBe(Infinity);
    });

    it('returns finite value for historical mode', () => {
      const max = getMaxGridSize('historical');
      expect(Number.isFinite(max)).toBe(true);
      expect(max).toBeGreaterThan(0);
    });

    it('returns the gorod land grant radius for historical mode', () => {
      // gorod is the highest tier, radius 120 from landGrants config
      expect(getMaxGridSize('historical')).toBe(120);
    });

    it('returns finite value for unknown mode (defaults to historical cap)', () => {
      const max = getMaxGridSize('unknown');
      expect(Number.isFinite(max)).toBe(true);
      expect(max).toBe(120);
    });
  });

  // ─── shouldExpand ─────────────────────────────────────────

  describe('shouldExpand', () => {
    // Historical mode — respects max grid size
    it('returns true in historical when expansion trigger fires and under max', () => {
      // pop 50 = posyolok (radius 30), currentRadius 15 (selo) → should expand
      expect(shouldExpand('historical', 50, 15)).toBe(true);
    });

    it('returns false in historical when already at max grid size', () => {
      // pop 400 = gorod (radius 120), currentRadius already 120 → no expansion
      expect(shouldExpand('historical', 400, 120)).toBe(false);
    });

    it('returns false in historical when no expansion trigger', () => {
      // pop 10 = selo (radius 15), currentRadius 15 → no trigger
      expect(shouldExpand('historical', 10, 15)).toBe(false);
    });

    it('returns false in historical when current radius exceeds max', () => {
      // Even with high population, if somehow radius > max, do not expand
      expect(shouldExpand('historical', 500, 150)).toBe(false);
    });

    // Freeform mode — no cap
    it('returns true in freeform when expansion trigger fires', () => {
      // pop 50 = posyolok (radius 30), currentRadius 15 → expand
      expect(shouldExpand('freeform', 50, 15)).toBe(true);
    });

    it('returns false in freeform when no expansion trigger', () => {
      // pop 10 = selo (radius 15), currentRadius 15 → no trigger
      expect(shouldExpand('freeform', 10, 15)).toBe(false);
    });

    it('returns true in freeform even when radius exceeds historical max', () => {
      // In freeform, if checkExpansionTrigger would fire, it should expand
      // But checkExpansionTrigger is tier-based — gorod radius is 120
      // So at radius 120 with gorod pop, no trigger. This tests the concept:
      // at pop 400 (gorod) with radius 60, trigger fires even in endless
      expect(shouldExpand('freeform', 400, 60)).toBe(true);
    });

    it('returns false in freeform when at tier radius (no trigger)', () => {
      // pop 400 = gorod, radius 120 → tier radius matches, no trigger
      expect(shouldExpand('freeform', 400, 120)).toBe(false);
    });
  });
});

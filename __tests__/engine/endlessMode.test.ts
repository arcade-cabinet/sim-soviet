/**
 * Tests for grounded post-campaign map expansion: the historical land-grant
 * cap always applies.
 */
import { getMaxGridSize, isEndlessMode, shouldExpand } from '../../src/game/engine/endlessMode';

describe('endlessMode', () => {
  // ─── isEndlessMode ────────────────────────────────────────

  describe('isEndlessMode', () => {
    it('returns false for removed sandbox mode strings', () => {
      expect(isEndlessMode('sandbox')).toBe(false);
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
    it('returns finite value for removed sandbox mode strings', () => {
      expect(getMaxGridSize('sandbox')).toBe(120);
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

    it('uses the same cap for removed sandbox mode strings when under max', () => {
      expect(shouldExpand('sandbox', 50, 15)).toBe(true);
    });

    it('uses the same cap for removed sandbox mode strings when no trigger fires', () => {
      expect(shouldExpand('sandbox', 10, 15)).toBe(false);
    });

    it('does not expand removed sandbox mode strings beyond historical max', () => {
      expect(shouldExpand('sandbox', 500, 150)).toBe(false);
    });

    it('returns false for removed sandbox mode strings at tier radius', () => {
      expect(shouldExpand('sandbox', 400, 120)).toBe(false);
    });
  });
});

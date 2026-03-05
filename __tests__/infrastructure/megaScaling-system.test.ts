import {
  checkScaleUpTrigger,
  getMaxTier,
  getScaledCapacity,
  scaleUpBuilding,
} from '@/ai/agents/infrastructure/megaScalingSystem';

describe('megaScalingSystem', () => {
  // ── getMaxTier ──────────────────────────────────────────────────

  describe('getMaxTier', () => {
    it('returns 0 for revolution era', () => {
      expect(getMaxTier('revolution')).toBe(0);
    });

    it('returns 1 for collectivization era', () => {
      expect(getMaxTier('collectivization')).toBe(1);
    });

    it('returns 2 for industrialization era', () => {
      expect(getMaxTier('industrialization')).toBe(2);
    });

    it('returns 2 for wartime era', () => {
      expect(getMaxTier('wartime')).toBe(2);
    });

    it('returns 3 for reconstruction era', () => {
      expect(getMaxTier('reconstruction')).toBe(3);
    });

    it('returns 3 for thaw era', () => {
      expect(getMaxTier('thaw')).toBe(3);
    });

    it('returns 4 for stagnation era', () => {
      expect(getMaxTier('stagnation')).toBe(4);
    });

    it('returns 4 for perestroika era', () => {
      expect(getMaxTier('perestroika')).toBe(4);
    });

    it('returns 5 for the_eternal era', () => {
      expect(getMaxTier('the_eternal')).toBe(5);
    });

    it('returns 0 for unknown era', () => {
      expect(getMaxTier('unknown_era')).toBe(0);
    });
  });

  // ── getScaledCapacity ───────────────────────────────────────────

  describe('getScaledCapacity', () => {
    it('returns base capacity at tier 0', () => {
      expect(getScaledCapacity(50, 0)).toBe(50);
    });

    it('returns 10x at tier 1', () => {
      expect(getScaledCapacity(50, 1)).toBe(500);
    });

    it('returns 100x at tier 2', () => {
      expect(getScaledCapacity(50, 2)).toBe(5000);
    });

    it('returns 1000x at tier 3', () => {
      expect(getScaledCapacity(10, 3)).toBe(10000);
    });

    it('returns 10000x at tier 4', () => {
      expect(getScaledCapacity(10, 4)).toBe(100000);
    });

    it('returns 100000x at tier 5', () => {
      expect(getScaledCapacity(1, 5)).toBe(100000);
    });

    it('falls back to 1x for unknown tier', () => {
      expect(getScaledCapacity(50, 99)).toBe(50);
    });
  });

  // ── checkScaleUpTrigger ─────────────────────────────────────────

  describe('checkScaleUpTrigger', () => {
    it('returns true when demand exceeds 1.5x capacity and tier below max', () => {
      // capacity=100, demand=151, era allows tier 2, current tier 0
      expect(checkScaleUpTrigger(100, 151, 'industrialization', 0)).toBe(true);
    });

    it('returns false when demand is exactly 1.5x capacity', () => {
      expect(checkScaleUpTrigger(100, 150, 'industrialization', 0)).toBe(false);
    });

    it('returns false when demand is below 1.5x capacity', () => {
      expect(checkScaleUpTrigger(100, 100, 'industrialization', 0)).toBe(false);
    });

    it('returns false when already at max tier for era', () => {
      // revolution max tier is 0, already at 0
      expect(checkScaleUpTrigger(100, 200, 'revolution', 0)).toBe(false);
    });

    it('returns false when current tier equals max tier', () => {
      // collectivization max tier is 1, currently at 1
      expect(checkScaleUpTrigger(100, 200, 'collectivization', 1)).toBe(false);
    });

    it('returns true when current tier below max and demand sufficient', () => {
      // stagnation max tier is 4, currently at 2
      expect(checkScaleUpTrigger(100, 200, 'stagnation', 2)).toBe(true);
    });

    it('defaults currentTier to 0 when not specified', () => {
      expect(checkScaleUpTrigger(100, 200, 'the_eternal')).toBe(true);
    });

    it('handles zero capacity (demand always exceeds)', () => {
      expect(checkScaleUpTrigger(0, 1, 'industrialization', 0)).toBe(true);
    });

    it('handles zero demand', () => {
      expect(checkScaleUpTrigger(100, 0, 'industrialization', 0)).toBe(false);
    });
  });

  // ── scaleUpBuilding ────────────────────────────────────────────

  describe('scaleUpBuilding', () => {
    it('scales from tier 0 to tier 1', () => {
      const result = scaleUpBuilding(50, 0);
      expect(result).not.toBeNull();
      expect(result!.previousTier).toBe(0);
      expect(result!.newTier).toBe(1);
      expect(result!.scaleFactor).toBe(10);
      expect(result!.newCapacity).toBe(500);
    });

    it('scales from tier 1 to tier 2', () => {
      const result = scaleUpBuilding(50, 1);
      expect(result).not.toBeNull();
      expect(result!.newTier).toBe(2);
      expect(result!.scaleFactor).toBe(100);
      expect(result!.newCapacity).toBe(5000);
    });

    it('scales from tier 4 to tier 5', () => {
      const result = scaleUpBuilding(10, 4);
      expect(result).not.toBeNull();
      expect(result!.newTier).toBe(5);
      expect(result!.scaleFactor).toBe(100000);
      expect(result!.newCapacity).toBe(1000000);
    });

    it('returns null when trying to scale beyond tier 5', () => {
      const result = scaleUpBuilding(10, 5);
      // tier 5 → tier 6 is beyond max
      expect(result).toBeNull();
    });

    it('uses base capacity, not current scaled capacity', () => {
      // base=50, at tier 2 (effective 5000), scale to tier 3
      const result = scaleUpBuilding(50, 2);
      expect(result).not.toBeNull();
      expect(result!.newCapacity).toBe(50000); // 50 * 1000
    });
  });

  // ── Integration: trigger + scale-up ────────────────────────────

  describe('integration: trigger check then scale-up', () => {
    it('full pipeline: detect overpressure, scale up, verify new capacity', () => {
      const baseCapacity = 50;
      const currentTier = 0;
      const era = 'reconstruction'; // max tier 3
      const demand = 100; // 100 > 50 * 1.5 = 75

      const shouldScale = checkScaleUpTrigger(
        getScaledCapacity(baseCapacity, currentTier),
        demand,
        era,
        currentTier,
      );
      expect(shouldScale).toBe(true);

      const result = scaleUpBuilding(baseCapacity, currentTier);
      expect(result).not.toBeNull();
      expect(result!.newTier).toBe(1);
      expect(result!.newCapacity).toBe(500);

      // After scale-up, demand no longer exceeds 1.5x new capacity
      const shouldScaleAgain = checkScaleUpTrigger(result!.newCapacity, demand, era, result!.newTier);
      expect(shouldScaleAgain).toBe(false);
    });

    it('cannot scale in revolution era regardless of demand', () => {
      const shouldScale = checkScaleUpTrigger(10, 1000, 'revolution', 0);
      expect(shouldScale).toBe(false);
    });

    it('respects era tier cap across multiple scale-ups', () => {
      const baseCapacity = 10;
      const era = 'collectivization'; // max tier 1
      let currentTier = 0;

      // First scale-up should work
      const trigger1 = checkScaleUpTrigger(
        getScaledCapacity(baseCapacity, currentTier),
        1000,
        era,
        currentTier,
      );
      expect(trigger1).toBe(true);

      const result1 = scaleUpBuilding(baseCapacity, currentTier);
      expect(result1).not.toBeNull();
      currentTier = result1!.newTier;

      // Second scale-up should be blocked by era cap
      const trigger2 = checkScaleUpTrigger(
        getScaledCapacity(baseCapacity, currentTier),
        100000,
        era,
        currentTier,
      );
      expect(trigger2).toBe(false);
    });
  });
});

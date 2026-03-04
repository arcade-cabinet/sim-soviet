/**
 * @fileoverview Tests for the GosplanTab allocation system:
 * - ALLOCATION_CATEGORIES exports 4 categories
 * - DEFAULT_ALLOCATIONS sums to 100
 * - redistributeAllocations maintains 100% invariant
 * - clampAllocation bounds correctly
 * - Edge cases (0%, 100%, all-zero others)
 */

import {
  ALLOCATION_CATEGORIES,
  type AllocationCategory,
  type Allocations,
  clampAllocation,
  DEFAULT_ALLOCATIONS,
  redistributeAllocations,
} from '@/ui/hq-tabs/GosplanTab';

function sumAllocations(a: Allocations): number {
  return ALLOCATION_CATEGORIES.reduce((sum, c) => sum + a[c.key], 0);
}

describe('GosplanTab', () => {
  describe('ALLOCATION_CATEGORIES', () => {
    it('exports exactly 4 categories', () => {
      expect(ALLOCATION_CATEGORIES).toHaveLength(4);
    });

    it('has correct keys in order', () => {
      const keys = ALLOCATION_CATEGORIES.map((c) => c.key);
      expect(keys).toEqual(['food', 'industrial', 'military', 'reserve']);
    });

    it('all labels are uppercase', () => {
      for (const cat of ALLOCATION_CATEGORIES) {
        expect(cat.label).toBe(cat.label.toUpperCase());
      }
    });

    it('all keys are unique', () => {
      const keys = ALLOCATION_CATEGORIES.map((c) => c.key);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });

  describe('DEFAULT_ALLOCATIONS', () => {
    it('sums to 100', () => {
      expect(sumAllocations(DEFAULT_ALLOCATIONS)).toBe(100);
    });

    it('has all 4 categories defined', () => {
      const keys: AllocationCategory[] = ['food', 'industrial', 'military', 'reserve'];
      for (const key of keys) {
        expect(DEFAULT_ALLOCATIONS[key]).toBeGreaterThanOrEqual(0);
      }
    });

    it('food has the largest default share', () => {
      expect(DEFAULT_ALLOCATIONS.food).toBeGreaterThan(DEFAULT_ALLOCATIONS.industrial);
      expect(DEFAULT_ALLOCATIONS.food).toBeGreaterThan(DEFAULT_ALLOCATIONS.military);
      expect(DEFAULT_ALLOCATIONS.food).toBeGreaterThan(DEFAULT_ALLOCATIONS.reserve);
    });
  });

  describe('clampAllocation', () => {
    it('clamps below minimum', () => {
      expect(clampAllocation(-5, 0, 100)).toBe(0);
    });

    it('clamps above maximum', () => {
      expect(clampAllocation(120, 0, 100)).toBe(100);
    });

    it('passes through values within range', () => {
      expect(clampAllocation(50, 0, 100)).toBe(50);
    });

    it('rounds to nearest integer', () => {
      expect(clampAllocation(33.7, 0, 100)).toBe(34);
      expect(clampAllocation(33.2, 0, 100)).toBe(33);
    });
  });

  describe('redistributeAllocations', () => {
    it('always sums to 100 when increasing a category', () => {
      const result = redistributeAllocations(DEFAULT_ALLOCATIONS, 'food', 60);
      expect(sumAllocations(result)).toBe(100);
      expect(result.food).toBe(60);
    });

    it('always sums to 100 when decreasing a category', () => {
      const result = redistributeAllocations(DEFAULT_ALLOCATIONS, 'food', 20);
      expect(sumAllocations(result)).toBe(100);
      expect(result.food).toBe(20);
    });

    it('handles setting a category to 0', () => {
      const result = redistributeAllocations(DEFAULT_ALLOCATIONS, 'military', 0);
      expect(sumAllocations(result)).toBe(100);
      expect(result.military).toBe(0);
    });

    it('handles setting a category to 100', () => {
      const result = redistributeAllocations(DEFAULT_ALLOCATIONS, 'food', 100);
      expect(sumAllocations(result)).toBe(100);
      expect(result.food).toBe(100);
      expect(result.industrial).toBe(0);
      expect(result.military).toBe(0);
      expect(result.reserve).toBe(0);
    });

    it('clamps values above 100', () => {
      const result = redistributeAllocations(DEFAULT_ALLOCATIONS, 'food', 150);
      expect(sumAllocations(result)).toBe(100);
      expect(result.food).toBe(100);
    });

    it('clamps values below 0', () => {
      const result = redistributeAllocations(DEFAULT_ALLOCATIONS, 'food', -10);
      expect(sumAllocations(result)).toBe(100);
      expect(result.food).toBe(0);
    });

    it('redistributes proportionally among other categories', () => {
      // food=40, industrial=30, military=15, reserve=15 → set food to 60
      // remaining = 40, othersSum = 60
      const result = redistributeAllocations(DEFAULT_ALLOCATIONS, 'food', 60);
      // industrial should get 30/60 * 40 = 20
      // military should get 15/60 * 40 = 10
      // reserve gets remainder = 40 - 20 - 10 = 10
      expect(result.industrial).toBe(20);
      expect(result.military).toBe(10);
      expect(result.reserve).toBe(10);
    });

    it('handles edge case where all others are zero', () => {
      const edgeCase: Allocations = { food: 100, industrial: 0, military: 0, reserve: 0 };
      const result = redistributeAllocations(edgeCase, 'food', 40);
      expect(sumAllocations(result)).toBe(100);
      expect(result.food).toBe(40);
      // 60 remaining distributed among 3 categories
      expect(result.industrial + result.military + result.reserve).toBe(60);
    });

    it('preserves unchanged category when no redistribution needed', () => {
      const result = redistributeAllocations(DEFAULT_ALLOCATIONS, 'food', 40);
      expect(result.food).toBe(40);
      expect(result.industrial).toBe(30);
      expect(result.military).toBe(15);
      expect(result.reserve).toBe(15);
    });

    it('maintains sum through multiple sequential redistributions', () => {
      let alloc = { ...DEFAULT_ALLOCATIONS };
      alloc = redistributeAllocations(alloc, 'food', 50);
      expect(sumAllocations(alloc)).toBe(100);
      alloc = redistributeAllocations(alloc, 'military', 25);
      expect(sumAllocations(alloc)).toBe(100);
      alloc = redistributeAllocations(alloc, 'reserve', 5);
      expect(sumAllocations(alloc)).toBe(100);
    });

    it('no allocation goes negative', () => {
      const result = redistributeAllocations(DEFAULT_ALLOCATIONS, 'food', 95);
      for (const cat of ALLOCATION_CATEGORIES) {
        expect(result[cat.key]).toBeGreaterThanOrEqual(0);
      }
      expect(sumAllocations(result)).toBe(100);
    });
  });
});

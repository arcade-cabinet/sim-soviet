/**
 * Unit tests for GrowthPacing — era-based build intervals.
 */

import { ERA_BUILD_INTERVALS, DEFAULT_BUILD_INTERVAL, getBuildInterval } from '../../src/growth/GrowthPacing';

describe('GrowthPacing', () => {
  it('defines intervals for all 8 eras', () => {
    const eras = [
      'revolution',
      'collectivization',
      'industrialization',
      'great_patriotic',
      'reconstruction',
      'thaw_and_freeze',
      'stagnation',
      'the_eternal',
    ];
    for (const era of eras) {
      expect(ERA_BUILD_INTERVALS[era as keyof typeof ERA_BUILD_INTERVALS]).toBeGreaterThan(0);
    }
  });

  it('revolution has the slowest interval (120)', () => {
    expect(ERA_BUILD_INTERVALS.revolution).toBe(120);
  });

  it('great_patriotic has the fastest wartime interval (45)', () => {
    expect(ERA_BUILD_INTERVALS.great_patriotic).toBe(45);
  });

  it('stagnation and the_eternal share the fastest peacetime interval (30)', () => {
    expect(ERA_BUILD_INTERVALS.stagnation).toBe(30);
    expect(ERA_BUILD_INTERVALS.the_eternal).toBe(30);
  });

  it('intervals decrease from revolution through industrialization', () => {
    expect(ERA_BUILD_INTERVALS.revolution).toBeGreaterThan(ERA_BUILD_INTERVALS.collectivization);
    expect(ERA_BUILD_INTERVALS.collectivization).toBeGreaterThan(ERA_BUILD_INTERVALS.industrialization);
  });

  describe('getBuildInterval', () => {
    it('returns era-specific interval for known eras', () => {
      expect(getBuildInterval('revolution')).toBe(120);
      expect(getBuildInterval('stagnation')).toBe(30);
    });

    it('returns default interval for unknown era', () => {
      expect(getBuildInterval('unknown_era')).toBe(DEFAULT_BUILD_INTERVAL);
    });

    it('returns default interval for empty string', () => {
      expect(getBuildInterval('')).toBe(DEFAULT_BUILD_INTERVAL);
    });
  });
});

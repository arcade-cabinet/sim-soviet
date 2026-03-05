/**
 * Unit tests for OrganicUnlocks — milestone-based era transitions for Freeform mode.
 *
 * Tests each unlock condition individually and verifies forward-only transitions.
 */

import { evaluateOrganicUnlocks, type UnlockContext } from '../../src/growth/OrganicUnlocks';

/** Create a default unlock context in the revolution era. */
function createContext(overrides: Partial<UnlockContext> = {}): UnlockContext {
  return {
    population: 50,
    industrialBuildingCount: 0,
    hasActiveWar: false,
    hasExperiencedWar: false,
    yearsSinceLastWar: Infinity,
    recentGrowthRate: 0.05,
    lowGrowthYears: 0,
    simulationYearsElapsed: 5,
    currentEraId: 'revolution',
    ...overrides,
  };
}

describe('OrganicUnlocks', () => {
  // ── Revolution → Collectivization ──────────────────────────────────

  describe('Revolution → Collectivization', () => {
    it('triggers when population >= 100', () => {
      const ctx = createContext({ population: 100, currentEraId: 'revolution' });
      expect(evaluateOrganicUnlocks(ctx)).toBe('collectivization');
    });

    it('does not trigger when population < 100', () => {
      const ctx = createContext({ population: 99, currentEraId: 'revolution' });
      expect(evaluateOrganicUnlocks(ctx)).toBeNull();
    });

    it('triggers at population exactly 100', () => {
      const ctx = createContext({ population: 100, currentEraId: 'revolution' });
      expect(evaluateOrganicUnlocks(ctx)).toBe('collectivization');
    });
  });

  // ── Collectivization → Industrialization ───────────────────────────

  describe('Collectivization → Industrialization', () => {
    it('triggers when 3+ industrial buildings exist', () => {
      const ctx = createContext({
        currentEraId: 'collectivization',
        industrialBuildingCount: 3,
        population: 150,
      });
      expect(evaluateOrganicUnlocks(ctx)).toBe('industrialization');
    });

    it('does not trigger with only 2 industrial buildings', () => {
      const ctx = createContext({
        currentEraId: 'collectivization',
        industrialBuildingCount: 2,
        population: 150,
      });
      expect(evaluateOrganicUnlocks(ctx)).toBeNull();
    });
  });

  // ── Industrialization → Great Patriotic War ────────────────────────

  describe('Any era → Great Patriotic War', () => {
    it('triggers when a war crisis is active', () => {
      const ctx = createContext({
        currentEraId: 'industrialization',
        hasActiveWar: true,
        industrialBuildingCount: 5,
        population: 200,
      });
      expect(evaluateOrganicUnlocks(ctx)).toBe('great_patriotic');
    });

    it('does not trigger without active war', () => {
      const ctx = createContext({
        currentEraId: 'industrialization',
        hasActiveWar: false,
        industrialBuildingCount: 5,
        population: 200,
      });
      expect(evaluateOrganicUnlocks(ctx)).toBeNull();
    });
  });

  // ── Great Patriotic → Reconstruction ───────────────────────────────

  describe('Great Patriotic → Reconstruction', () => {
    it('triggers when war ends', () => {
      const ctx = createContext({
        currentEraId: 'great_patriotic',
        hasActiveWar: false,
        hasExperiencedWar: true,
        yearsSinceLastWar: 1,
        population: 150,
      });
      expect(evaluateOrganicUnlocks(ctx)).toBe('reconstruction');
    });

    it('does not trigger during active war', () => {
      const ctx = createContext({
        currentEraId: 'great_patriotic',
        hasActiveWar: true,
        hasExperiencedWar: true,
        yearsSinceLastWar: 0,
        population: 150,
      });
      expect(evaluateOrganicUnlocks(ctx)).toBeNull();
    });

    it('does not trigger if no war was experienced', () => {
      const ctx = createContext({
        currentEraId: 'great_patriotic',
        hasActiveWar: false,
        hasExperiencedWar: false,
        yearsSinceLastWar: Infinity,
        population: 150,
      });
      expect(evaluateOrganicUnlocks(ctx)).toBeNull();
    });
  });

  // ── Reconstruction → Thaw ─────────────────────────────────────────

  describe('Reconstruction → Thaw', () => {
    it('triggers when population >= 500 AND years since war > 5', () => {
      const ctx = createContext({
        currentEraId: 'reconstruction',
        population: 500,
        yearsSinceLastWar: 6,
        hasExperiencedWar: true,
      });
      expect(evaluateOrganicUnlocks(ctx)).toBe('thaw_and_freeze');
    });

    it('does not trigger when population < 500', () => {
      const ctx = createContext({
        currentEraId: 'reconstruction',
        population: 499,
        yearsSinceLastWar: 10,
        hasExperiencedWar: true,
      });
      expect(evaluateOrganicUnlocks(ctx)).toBeNull();
    });

    it('does not trigger when years since war <= 5', () => {
      const ctx = createContext({
        currentEraId: 'reconstruction',
        population: 600,
        yearsSinceLastWar: 5,
        hasExperiencedWar: true,
      });
      expect(evaluateOrganicUnlocks(ctx)).toBeNull();
    });
  });

  // ── Thaw → Stagnation ─────────────────────────────────────────────

  describe('Thaw → Stagnation', () => {
    it('triggers when growth rate < 2% for 3+ years', () => {
      const ctx = createContext({
        currentEraId: 'thaw_and_freeze',
        lowGrowthYears: 3,
        recentGrowthRate: 0.01,
        population: 800,
      });
      expect(evaluateOrganicUnlocks(ctx)).toBe('stagnation');
    });

    it('does not trigger with fewer than 3 low-growth years', () => {
      const ctx = createContext({
        currentEraId: 'thaw_and_freeze',
        lowGrowthYears: 2,
        recentGrowthRate: 0.01,
        population: 800,
      });
      expect(evaluateOrganicUnlocks(ctx)).toBeNull();
    });
  });

  // ── Stagnation → Eternal ──────────────────────────────────────────

  describe('Stagnation → Eternal', () => {
    it('triggers after 50+ simulation years', () => {
      const ctx = createContext({
        currentEraId: 'stagnation',
        simulationYearsElapsed: 50,
        population: 1000,
      });
      expect(evaluateOrganicUnlocks(ctx)).toBe('the_eternal');
    });

    it('does not trigger before 50 years', () => {
      const ctx = createContext({
        currentEraId: 'stagnation',
        simulationYearsElapsed: 49,
        population: 1000,
      });
      expect(evaluateOrganicUnlocks(ctx)).toBeNull();
    });
  });

  // ── Forward-only transitions ──────────────────────────────────────

  describe('Forward-only transitions', () => {
    it('does not allow backward transitions', () => {
      const ctx = createContext({
        currentEraId: 'thaw_and_freeze',
        population: 100, // would trigger collectivization if backward allowed
        industrialBuildingCount: 5,
        hasActiveWar: false,
      });
      expect(evaluateOrganicUnlocks(ctx)).toBeNull();
    });

    it('does not skip eras (only allows +1 transition)', () => {
      // Revolution with all conditions for thaw — should only transition to collectivization
      const ctx = createContext({
        currentEraId: 'revolution',
        population: 500,
        industrialBuildingCount: 5,
        hasActiveWar: true,
        yearsSinceLastWar: 10,
        lowGrowthYears: 5,
        simulationYearsElapsed: 60,
      });
      // Should get collectivization (next era), not jump ahead
      expect(evaluateOrganicUnlocks(ctx)).toBe('collectivization');
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────

  describe('Edge cases', () => {
    it('the_eternal transitions to post_soviet (Kardashev sub-era)', () => {
      const ctx = createContext({
        currentEraId: 'the_eternal',
        population: 10000,
        simulationYearsElapsed: 200,
      });
      expect(evaluateOrganicUnlocks(ctx)).toBe('post_soviet');
    });

    it('returns null for type_two_peak (final sub-era, no further transitions)', () => {
      const ctx = createContext({
        currentEraId: 'type_two_peak',
        population: 1000000,
        simulationYearsElapsed: 100000,
      });
      expect(evaluateOrganicUnlocks(ctx)).toBeNull();
    });

    it('handles zero population', () => {
      const ctx = createContext({
        currentEraId: 'revolution',
        population: 0,
      });
      expect(evaluateOrganicUnlocks(ctx)).toBeNull();
    });
  });
});

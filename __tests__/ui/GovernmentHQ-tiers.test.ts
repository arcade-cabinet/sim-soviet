/**
 * Tests for GovernmentHQ progressive tab splitting by settlement tier.
 *
 * Verifies:
 * - Selo: only Gosplan + Central Committee (2 tabs)
 * - Posyolok: + KGB + Military (4 tabs)
 * - PGT: + Politburo + Reports + Law Enforcement (all 7 tabs)
 * - Gorod: same 7 tabs (no additional unlock)
 */

// Mock heavy dependencies to avoid importing the full engine
jest.mock('../../src/bridge/GameInit', () => ({ getEngine: () => null }));
jest.mock('../../src/ecs/archetypes', () => ({ getResourceEntity: () => null }));
jest.mock('../../src/stores/gameStore', () => ({
  setActiveDirective: jest.fn(),
  setDefensePosture: jest.fn(),
  setGosplanAllocations: jest.fn(),
  useActiveDirective: () => null,
  useDefensePosture: () => 'defensive',
  useGosplanAllocations: () => ({}),
}));

import type { SettlementTier } from '../../src/ai/agents/infrastructure/SettlementSystem';
import { AGENCY_TABS, getVisibleTabs } from '../../src/ui/GovernmentHQ';

describe('GovernmentHQ tier-based tab gating', () => {
  test('selo shows only 2 tabs (gosplan + central_committee)', () => {
    const tabs = getVisibleTabs('selo');
    expect(tabs).toHaveLength(2);
    expect(tabs.map((t) => t.key)).toEqual(['gosplan', 'central_committee']);
  });

  test('posyolok shows 4 tabs (+ kgb, military)', () => {
    const tabs = getVisibleTabs('posyolok');
    expect(tabs).toHaveLength(4);
    expect(tabs.map((t) => t.key)).toEqual(['gosplan', 'central_committee', 'kgb', 'military']);
  });

  test('pgt shows all 7 tabs (+ politburo, reports, law_enforcement)', () => {
    const tabs = getVisibleTabs('pgt');
    expect(tabs).toHaveLength(7);
    expect(tabs.map((t) => t.key)).toEqual([
      'gosplan',
      'central_committee',
      'kgb',
      'military',
      'politburo',
      'reports',
      'law_enforcement',
    ]);
  });

  test('gorod shows all 7 tabs (same as pgt — no additional unlock)', () => {
    const tabs = getVisibleTabs('gorod');
    expect(tabs).toHaveLength(7);
    expect(tabs.map((t) => t.key)).toEqual([
      'gosplan',
      'central_committee',
      'kgb',
      'military',
      'politburo',
      'reports',
      'law_enforcement',
    ]);
  });

  test('all tiers include gosplan (always available)', () => {
    const tiers: SettlementTier[] = ['selo', 'posyolok', 'pgt', 'gorod'];
    for (const tier of tiers) {
      const tabs = getVisibleTabs(tier);
      expect(tabs.some((t) => t.key === 'gosplan')).toBe(true);
    }
  });

  test('law enforcement tab appears at pgt tier and above', () => {
    const hiddenTiers: SettlementTier[] = ['selo', 'posyolok'];
    for (const tier of hiddenTiers) {
      const tabs = getVisibleTabs(tier);
      expect(tabs.some((t) => t.key === 'law_enforcement')).toBe(false);
    }

    const visibleTiers: SettlementTier[] = ['pgt', 'gorod'];
    for (const tier of visibleTiers) {
      const tabs = getVisibleTabs(tier);
      expect(tabs.some((t) => t.key === 'law_enforcement')).toBe(true);
    }
  });

  test('AGENCY_TABS contains all 7 tab definitions', () => {
    expect(AGENCY_TABS).toHaveLength(7);
  });

  test('tab count increases monotonically with tier', () => {
    const tiers: SettlementTier[] = ['selo', 'posyolok', 'pgt', 'gorod'];
    let prevCount = 0;
    for (const tier of tiers) {
      const count = getVisibleTabs(tier).length;
      expect(count).toBeGreaterThanOrEqual(prevCount);
      prevCount = count;
    }
  });
});

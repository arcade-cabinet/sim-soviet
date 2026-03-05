/**
 * Tests for GovernmentHQ progressive tab splitting by settlement tier.
 *
 * Verifies:
 * - Selo: only Gosplan + Central Committee (2 tabs)
 * - Posyolok: + KGB + Military (4 tabs)
 * - PGT: + Politburo + Reports (6 tabs)
 * - Gorod: + Law Enforcement (7 tabs)
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

import { getVisibleTabs, AGENCY_TABS } from '../../src/ui/GovernmentHQ';
import type { SettlementTier } from '../../src/ai/agents/infrastructure/SettlementSystem';

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

  test('pgt shows 6 tabs (+ politburo, reports)', () => {
    const tabs = getVisibleTabs('pgt');
    expect(tabs).toHaveLength(6);
    expect(tabs.map((t) => t.key)).toEqual([
      'gosplan',
      'central_committee',
      'kgb',
      'military',
      'politburo',
      'reports',
    ]);
  });

  test('gorod shows all 7 tabs (+ law_enforcement)', () => {
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

  test('law enforcement tab only appears at gorod tier', () => {
    const tiers: SettlementTier[] = ['selo', 'posyolok', 'pgt'];
    for (const tier of tiers) {
      const tabs = getVisibleTabs(tier);
      expect(tabs.some((t) => t.key === 'law_enforcement')).toBe(false);
    }

    const gorodTabs = getVisibleTabs('gorod');
    expect(gorodTabs.some((t) => t.key === 'law_enforcement')).toBe(true);
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

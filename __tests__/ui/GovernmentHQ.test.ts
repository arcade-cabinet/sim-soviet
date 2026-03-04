/**
 * @fileoverview Tests for the GovernmentHQ component data model:
 * - AGENCY_TABS exports 6 tabs in correct order
 * - All tab keys are unique
 * - Tab definitions match expected labels
 * - AgencyTab type coverage
 */

// Mock modules that pull in expo-sqlite (ESM not transformable by Jest)
jest.mock('@/bridge/GameInit', () => ({ getEngine: () => null }));
jest.mock('@/ecs/archetypes', () => ({ getResourceEntity: () => null }));
jest.mock('@/stores/gameStore', () => ({
  useGosplanAllocations: () => ({ food: 40, industrial: 30, housing: 20, military: 10 }),
  setGosplanAllocations: jest.fn(),
}));

import { AGENCY_TABS, type AgencyTab, type AgencyTabDef, type GovernmentHQProps } from '@/ui/GovernmentHQ';

describe('GovernmentHQ', () => {
  describe('AGENCY_TABS definitions', () => {
    it('exports exactly 6 agency tabs', () => {
      expect(AGENCY_TABS).toHaveLength(6);
    });

    it('tabs are in correct order', () => {
      const keys = AGENCY_TABS.map((t: AgencyTabDef) => t.key);
      expect(keys).toEqual(['gosplan', 'central_committee', 'kgb', 'military', 'politburo', 'reports']);
    });

    it('all tab keys are unique', () => {
      const keys = AGENCY_TABS.map((t: AgencyTabDef) => t.key);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('all tab labels are uppercase strings', () => {
      for (const tab of AGENCY_TABS) {
        expect(tab.label).toBe(tab.label.toUpperCase());
        expect(tab.label.length).toBeGreaterThan(0);
      }
    });

    it('Gosplan is the default first tab', () => {
      expect(AGENCY_TABS[0].key).toBe('gosplan');
      expect(AGENCY_TABS[0].label).toBe('GOSPLAN');
    });

    it('each tab has the expected label', () => {
      const expected: Record<AgencyTab, string> = {
        gosplan: 'GOSPLAN',
        central_committee: 'CENTRAL COMMITTEE',
        kgb: 'KGB',
        military: 'MILITARY',
        politburo: 'POLITBURO',
        reports: 'REPORTS',
      };
      for (const tab of AGENCY_TABS) {
        expect(tab.label).toBe(expected[tab.key]);
      }
    });
  });

  describe('GovernmentHQProps interface', () => {
    it('accepts visible and onClose props', () => {
      const props: GovernmentHQProps = {
        visible: true,
        onClose: () => {},
      };
      expect(props.visible).toBe(true);
      expect(typeof props.onClose).toBe('function');
    });
  });

  describe('AgencyTab type completeness', () => {
    it('all 6 agency tab keys are valid AgencyTab values', () => {
      const allKeys: AgencyTab[] = ['gosplan', 'central_committee', 'kgb', 'military', 'politburo', 'reports'];
      // This verifies type assignment compiles and all values exist
      expect(allKeys).toHaveLength(6);
      for (const key of allKeys) {
        const found = AGENCY_TABS.find((t: AgencyTabDef) => t.key === key);
        expect(found).toBeDefined();
      }
    });
  });
});

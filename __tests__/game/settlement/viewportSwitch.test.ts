/**
 * Tests for viewport switching between settlements.
 *
 * Tests the SettlementRegistry.switchTo logic and the store state updates.
 */

import { SettlementRegistry } from '../../../src/game/relocation/Settlement';
import {
  getActiveSettlementId,
  getSettlementList,
  isSettlementTransitioning,
  setActiveSettlementId,
  setSettlementTransitioning,
  updateSettlementList,
  type SettlementSummaryEntry,
} from '../../../src/stores/gameStore';

describe('SettlementRegistry.switchTo', () => {
  let registry: SettlementRegistry;

  beforeEach(() => {
    registry = new SettlementRegistry();
    registry.createPrimary('Novgorod', 21, 1922);
  });

  it('switches active settlement by ID', () => {
    registry.addSettlement(
      'Siberian Camp',
      { gravity: 1.0, atmosphere: 'breathable', water: 'rivers', farming: 'soil', construction: 'standard', baseSurvivalCost: 'low' },
      'earth',
      3000,
      1930,
    );

    expect(registry.getActive()?.id).toBe('primary');

    const switched = registry.switchTo('settlement-1');
    expect(switched).toBe(true);
    expect(registry.getActive()?.id).toBe('settlement-1');
    expect(registry.getActive()?.name).toBe('Siberian Camp');

    // Old settlement should be inactive
    const primary = registry.getById('primary')!;
    expect(primary.isActive).toBe(false);
  });

  it('returns false for non-existent settlement ID', () => {
    expect(registry.switchTo('nonexistent')).toBe(false);
    expect(registry.getActive()?.id).toBe('primary');
  });

  it('switches back to primary', () => {
    registry.addSettlement(
      'Mars Colony',
      { gravity: 0.38, atmosphere: 'thin', water: 'ice', farming: 'hydroponics', construction: 'dome_required', baseSurvivalCost: 'extreme' },
      'mars',
      225_000_000,
      2050,
    );

    registry.switchTo('settlement-1');
    expect(registry.getActive()?.id).toBe('settlement-1');

    registry.switchTo('primary');
    expect(registry.getActive()?.id).toBe('primary');
  });

  it('maintains correct count after multiple switches', () => {
    registry.addSettlement(
      'Settlement B',
      { gravity: 1.0, atmosphere: 'breathable', water: 'rivers', farming: 'soil', construction: 'standard', baseSurvivalCost: 'low' },
      'earth',
      1000,
      1935,
    );
    registry.addSettlement(
      'Settlement C',
      { gravity: 1.0, atmosphere: 'breathable', water: 'rivers', farming: 'soil', construction: 'standard', baseSurvivalCost: 'low' },
      'earth',
      2000,
      1940,
    );

    expect(registry.count()).toBe(3);

    registry.switchTo('settlement-1');
    registry.switchTo('settlement-2');
    registry.switchTo('primary');

    expect(registry.count()).toBe(3);
    expect(registry.getActive()?.id).toBe('primary');
  });
});

describe('Viewport switch store integration', () => {
  afterEach(() => {
    setActiveSettlementId('primary');
    updateSettlementList([]);
    setSettlementTransitioning(false);
  });

  it('store reflects settlement switch', () => {
    const list: SettlementSummaryEntry[] = [
      { id: 'primary', name: 'Novgorod', population: 50, celestialBody: 'earth', isActive: true },
      { id: 'settlement-1', name: 'Luna Base', population: 10, celestialBody: 'moon', isActive: false },
    ];
    updateSettlementList(list);

    // Simulate a switch
    setActiveSettlementId('settlement-1');

    expect(getActiveSettlementId()).toBe('settlement-1');
    // List entries themselves are just snapshots — the isActive flag in the list
    // would be updated on next syncSettlementList call
  });

  it('transition flag blocks during switch', () => {
    expect(isSettlementTransitioning()).toBe(false);

    setSettlementTransitioning(true);
    expect(isSettlementTransitioning()).toBe(true);

    // Simulate transition complete
    setSettlementTransitioning(false);
    expect(isSettlementTransitioning()).toBe(false);
  });

  it('empty settlement list is handled gracefully', () => {
    updateSettlementList([]);
    expect(getSettlementList()).toHaveLength(0);
  });
});

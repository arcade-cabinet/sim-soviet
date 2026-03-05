/**
 * Tests for settlement switching coordinator.
 *
 * Tests store-level state (no engine dependency) and mocked engine tests.
 */

import {
  getActiveSettlementId,
  getCameraResetVersion,
  getSettlementList,
  isSettlementTransitioning,
  setActiveSettlementId,
  setSettlementTransitioning,
  signalCameraReset,
  updateSettlementList,
  type SettlementSummaryEntry,
} from '../../../src/stores/gameStore';

// Mock getEngine to avoid expo-sqlite import chain
jest.mock('../../../src/bridge/GameInit', () => ({
  getEngine: jest.fn(() => null),
}));

describe('Settlement switching store state', () => {
  afterEach(() => {
    // Reset to defaults
    setActiveSettlementId('primary');
    updateSettlementList([]);
    setSettlementTransitioning(false);
  });

  it('defaults to primary settlement', () => {
    expect(getActiveSettlementId()).toBe('primary');
  });

  it('updates active settlement ID', () => {
    setActiveSettlementId('settlement-1');
    expect(getActiveSettlementId()).toBe('settlement-1');
  });

  it('updates settlement list', () => {
    const list: SettlementSummaryEntry[] = [
      { id: 'primary', name: 'Novgorod', population: 50, celestialBody: 'earth', isActive: true },
      { id: 'settlement-1', name: 'Luna Base', population: 10, celestialBody: 'moon', isActive: false },
    ];
    updateSettlementList(list);
    expect(getSettlementList()).toHaveLength(2);
    expect(getSettlementList()[0].name).toBe('Novgorod');
    expect(getSettlementList()[1].celestialBody).toBe('moon');
  });

  it('tracks transition state', () => {
    expect(isSettlementTransitioning()).toBe(false);
    setSettlementTransitioning(true);
    expect(isSettlementTransitioning()).toBe(true);
    setSettlementTransitioning(false);
    expect(isSettlementTransitioning()).toBe(false);
  });

  it('stores threatLevel on settlement entries', () => {
    const list: SettlementSummaryEntry[] = [
      { id: 'primary', name: 'Novgorod', population: 50, celestialBody: 'earth', isActive: true, threatLevel: 'stable' },
      { id: 'settlement-1', name: 'Luna Base', population: 10, celestialBody: 'moon', isActive: false, threatLevel: 'critical' },
    ];
    updateSettlementList(list);
    expect(getSettlementList()[0].threatLevel).toBe('stable');
    expect(getSettlementList()[1].threatLevel).toBe('critical');
  });
});

describe('Camera reset on settlement switch', () => {
  it('signalCameraReset increments the version counter', () => {
    const v0 = getCameraResetVersion();
    signalCameraReset();
    expect(getCameraResetVersion()).toBe(v0 + 1);
    signalCameraReset();
    expect(getCameraResetVersion()).toBe(v0 + 2);
  });
});

describe('switchSettlementByIndex', () => {
  it('returns false when no engine is initialized', () => {
    const { switchSettlementByIndex } = require('../../../src/game/settlement/switchSettlement');
    expect(switchSettlementByIndex(0)).toBe(false);
    expect(switchSettlementByIndex(1)).toBe(false);
  });
});

describe('switchSettlement', () => {
  it('returns false when no engine is initialized', () => {
    const { switchSettlement } = require('../../../src/game/settlement/switchSettlement');
    expect(switchSettlement('settlement-1')).toBe(false);
  });
});

describe('syncSettlementList', () => {
  it('does not throw when no engine is initialized', () => {
    const { syncSettlementList } = require('../../../src/game/settlement/switchSettlement');
    expect(() => syncSettlementList()).not.toThrow();
  });
});

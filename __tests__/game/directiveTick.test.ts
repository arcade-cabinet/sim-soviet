/**
 * @fileoverview Tests for Central Committee directive tick logic.
 *
 * Verifies:
 * - No-op when no directive is active
 * - Lock-in expiration clears the directive
 * - Production modifiers for increase_production and mandatory_overtime
 * - Labor holiday zeroes production
 * - Emergency rations distribute reserves to food
 * - Morale delta applied on issuance tick
 * - Loyalty delta applied for patriotic_campaign
 */

// Mock gameStore before any imports
let mockDirective: any = null;
jest.mock('@/stores/gameStore', () => ({
  getActiveDirective: () => mockDirective,
  setActiveDirective: (d: any) => { mockDirective = d; },
}));

// Mock buildingsLogic for aggregate mode tests
const mockBuildings: any[] = [];
jest.mock('@/ecs/archetypes', () => ({
  buildingsLogic: { [Symbol.iterator]: () => mockBuildings[Symbol.iterator]() },
}));

import { tickDirective } from '@/game/engine/directiveTick';
import type { ActiveDirective } from '@/ui/hq-tabs/CentralCommitteeTab';

// ── Helpers ──

function makeWorkerSystem(overrides?: Partial<any>) {
  return {
    applyGlobalMoraleDelta: jest.fn(),
    ...overrides,
  };
}

function makeResources(overrides?: Partial<any>) {
  return {
    food: 100,
    emergencyReserve: 50,
    ...overrides,
  };
}

function makeCallbacks() {
  return {
    onToast: jest.fn(),
    onAdvisor: jest.fn(),
    onPravda: jest.fn(),
    onGameOver: jest.fn(),
  };
}

// ── Tests ──

describe('tickDirective', () => {
  beforeEach(() => {
    mockDirective = null;
    mockBuildings.length = 0;
  });

  it('returns no-op when no directive is active', () => {
    const result = tickDirective(10, makeWorkerSystem() as any, makeResources(), undefined, makeCallbacks() as any);
    expect(result.productionMult).toBe(1.0);
    expect(result.laborHoliday).toBe(false);
  });

  it('clears directive when lock-in expires', () => {
    mockDirective = { directiveId: 'increase_production', issuedAtTick: 0, lockInTicks: 24 } as ActiveDirective;
    const cb = makeCallbacks();
    const result = tickDirective(24, makeWorkerSystem() as any, makeResources(), undefined, cb as any);

    expect(mockDirective).toBeNull();
    expect(cb.onToast).toHaveBeenCalledWith(expect.stringContaining('EXPIRED'), 'warning');
    expect(result.productionMult).toBe(1.0);
  });

  it('returns 1.2x production for increase_production', () => {
    mockDirective = { directiveId: 'increase_production', issuedAtTick: 0, lockInTicks: 24 };
    // Not issuance tick, so no morale delta
    const result = tickDirective(5, makeWorkerSystem() as any, makeResources(), undefined, makeCallbacks() as any);
    expect(result.productionMult).toBe(1.2);
    expect(result.laborHoliday).toBe(false);
  });

  it('returns 1.3x production for mandatory_overtime', () => {
    mockDirective = { directiveId: 'mandatory_overtime', issuedAtTick: 0, lockInTicks: 36 };
    const result = tickDirective(5, makeWorkerSystem() as any, makeResources(), undefined, makeCallbacks() as any);
    expect(result.productionMult).toBe(1.3);
  });

  it('returns laborHoliday=true for labor_holiday', () => {
    mockDirective = { directiveId: 'labor_holiday', issuedAtTick: 0, lockInTicks: 12 };
    const result = tickDirective(5, makeWorkerSystem() as any, makeResources(), undefined, makeCallbacks() as any);
    expect(result.productionMult).toBe(0.0);
    expect(result.laborHoliday).toBe(true);
  });

  it('applies morale -10 on increase_production issuance tick', () => {
    mockDirective = { directiveId: 'increase_production', issuedAtTick: 10, lockInTicks: 24 };
    const ws = makeWorkerSystem();
    tickDirective(10, ws as any, makeResources(), undefined, makeCallbacks() as any);
    expect(ws.applyGlobalMoraleDelta).toHaveBeenCalledWith(-10);
  });

  it('applies morale +15 on labor_holiday issuance tick', () => {
    mockDirective = { directiveId: 'labor_holiday', issuedAtTick: 5, lockInTicks: 12 };
    const ws = makeWorkerSystem();
    tickDirective(5, ws as any, makeResources(), undefined, makeCallbacks() as any);
    expect(ws.applyGlobalMoraleDelta).toHaveBeenCalledWith(15);
  });

  it('applies morale -20 on mandatory_overtime issuance tick', () => {
    mockDirective = { directiveId: 'mandatory_overtime', issuedAtTick: 0, lockInTicks: 36 };
    const ws = makeWorkerSystem();
    tickDirective(0, ws as any, makeResources(), undefined, makeCallbacks() as any);
    expect(ws.applyGlobalMoraleDelta).toHaveBeenCalledWith(-20);
  });

  it('distributes emergency reserves on emergency_rations issuance', () => {
    mockDirective = { directiveId: 'emergency_rations', issuedAtTick: 10, lockInTicks: 6 };
    const resources = makeResources({ food: 100, emergencyReserve: 75 });
    const cb = makeCallbacks();
    tickDirective(10, makeWorkerSystem() as any, resources, undefined, cb as any);

    expect(resources.food).toBe(175);
    expect(resources.emergencyReserve).toBe(0);
    expect(cb.onToast).toHaveBeenCalledWith(expect.stringContaining('75'), 'warning');
  });

  it('handles emergency_rations with no reserves', () => {
    mockDirective = { directiveId: 'emergency_rations', issuedAtTick: 0, lockInTicks: 6 };
    const resources = makeResources({ food: 100, emergencyReserve: 0 });
    const cb = makeCallbacks();
    tickDirective(0, makeWorkerSystem() as any, resources, undefined, cb as any);

    expect(resources.food).toBe(100);
    expect(cb.onToast).toHaveBeenCalledWith(expect.stringContaining('No emergency reserves'), 'warning');
  });

  it('does not apply issuance effects on non-issuance ticks', () => {
    mockDirective = { directiveId: 'increase_production', issuedAtTick: 5, lockInTicks: 24 };
    const ws = makeWorkerSystem();
    tickDirective(10, ws as any, makeResources(), undefined, makeCallbacks() as any);
    expect(ws.applyGlobalMoraleDelta).not.toHaveBeenCalled();
  });

  describe('aggregate mode', () => {
    it('shifts raion avgMorale on issuance', () => {
      mockDirective = { directiveId: 'increase_production', issuedAtTick: 0, lockInTicks: 24 };
      const raion = { avgMorale: 60, avgLoyalty: 50, totalPopulation: 100 } as any;
      mockBuildings.push({ building: { workerCount: 10, avgMorale: 60, avgLoyalty: 50 } });

      tickDirective(0, makeWorkerSystem() as any, makeResources(), raion, makeCallbacks() as any);

      expect(raion.avgMorale).toBe(50); // 60 - 10
      expect(mockBuildings[0].building.avgMorale).toBe(50);
    });

    it('shifts raion avgLoyalty for patriotic_campaign', () => {
      mockDirective = { directiveId: 'patriotic_campaign', issuedAtTick: 0, lockInTicks: 18 };
      const raion = { avgMorale: 60, avgLoyalty: 50, totalPopulation: 100 } as any;
      mockBuildings.push({ building: { workerCount: 10, avgMorale: 60, avgLoyalty: 50 } });

      tickDirective(0, makeWorkerSystem() as any, makeResources(), raion, makeCallbacks() as any);

      expect(raion.avgLoyalty).toBe(60); // 50 + 10
      expect(mockBuildings[0].building.avgLoyalty).toBe(60);
    });

    it('clamps morale at 0', () => {
      mockDirective = { directiveId: 'mandatory_overtime', issuedAtTick: 0, lockInTicks: 36 };
      const raion = { avgMorale: 10, avgLoyalty: 50, totalPopulation: 100 } as any;
      mockBuildings.push({ building: { workerCount: 10, avgMorale: 5, avgLoyalty: 50 } });

      tickDirective(0, makeWorkerSystem() as any, makeResources(), raion, makeCallbacks() as any);

      expect(raion.avgMorale).toBe(0); // 10 - 20 = 0 (clamped)
      expect(mockBuildings[0].building.avgMorale).toBe(0); // 5 - 20 = 0 (clamped)
    });
  });
});

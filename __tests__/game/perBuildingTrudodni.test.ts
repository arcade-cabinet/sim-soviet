/**
 * Tests for per-building trudodni assignment tracking.
 *
 * Each building with assigned workers accumulates trudodni proportional
 * to the workers assigned to it. Tracked in a Map<buildingId, number>.
 */

import { world } from '@/ecs/world';
import {
  accrueTrudodni,
  defaultCategory,
  getAllBuildingTrudodni,
  getBuildingTrudodni,
  resetBuildingTrudodni,
  TRUDODNI_VALUES,
} from '@/game/TrudodniSystem';

describe('PerBuildingTrudodni', () => {
  beforeEach(() => {
    world.clear();
    resetBuildingTrudodni();
  });

  afterEach(() => {
    world.clear();
    resetBuildingTrudodni();
  });

  describe('getBuildingTrudodni', () => {
    it('returns 0 for unknown building', () => {
      expect(getBuildingTrudodni('nonexistent')).toBe(0);
    });
  });

  describe('getAllBuildingTrudodni', () => {
    it('returns empty map initially', () => {
      const map = getAllBuildingTrudodni();
      expect(map.size).toBe(0);
    });
  });

  describe('resetBuildingTrudodni', () => {
    it('clears all accumulated trudodni', () => {
      // Simulate some data by directly testing the module state
      // We need a citizen + dvor pair to accumulate trudodni
      const dvorId = 'test-dvor';
      const memberId = 'test-member';

      // Create a dvor entity
      world.add({
        dvor: {
          id: dvorId,
          surname: 'Ivanov',
          members: [
            {
              id: memberId,
              firstName: 'Ivan',
              gender: 'male' as const,
              age: 30,
              role: 'worker' as const,
              trudodniEarned: 0,
            },
          ],
          headOfHousehold: memberId,
          privatePlotSize: 0,
          privateLivestock: { cow: 0, pig: 0, sheep: 0, poultry: 0 },
          joinedTick: 0,
          loyaltyToCollective: 50,
        },
        isDvor: true,
      });

      // Create a citizen entity linked to the dvor
      world.add({
        position: { gridX: 5, gridY: 5 },
        citizen: {
          class: 'kolkhoznik',
          dvorId,
          dvorMemberId: memberId,
          gender: 'male' as const,
          assignment: 'farm-5-5',
        },
      });

      accrueTrudodni();
      expect(getBuildingTrudodni('farm-5-5')).toBeGreaterThan(0);

      resetBuildingTrudodni();
      expect(getBuildingTrudodni('farm-5-5')).toBe(0);
      expect(getAllBuildingTrudodni().size).toBe(0);
    });
  });

  describe('accrueTrudodni per-building', () => {
    it('accumulates trudodni for the assigned building', () => {
      const dvorId = 'dvor-1';
      const memberId = 'mem-1';

      world.add({
        dvor: {
          id: dvorId,
          surname: 'Petrov',
          members: [
            {
              id: memberId,
              firstName: 'Dmitri',
              gender: 'male' as const,
              age: 25,
              role: 'worker' as const,
              trudodniEarned: 0,
            },
          ],
          headOfHousehold: memberId,
          privatePlotSize: 0,
          privateLivestock: { cow: 0, pig: 0, sheep: 0, poultry: 0 },
          joinedTick: 0,
          loyaltyToCollective: 50,
        },
        isDvor: true,
      });

      world.add({
        position: { gridX: 3, gridY: 3 },
        citizen: {
          class: 'kolkhoznik',
          dvorId,
          dvorMemberId: memberId,
          gender: 'male' as const,
          assignment: 'factory-3-3',
        },
      });

      const result = accrueTrudodni();
      expect(result.memberCount).toBe(1);

      const cat = defaultCategory('male', 'worker');
      const expected = TRUDODNI_VALUES[cat] * 26; // DAYS_PER_MONTH = 26
      expect(getBuildingTrudodni('factory-3-3')).toBeCloseTo(expected);
    });

    it('accumulates across multiple workers at the same building', () => {
      const dvorId = 'dvor-multi';

      world.add({
        dvor: {
          id: dvorId,
          surname: 'Kuznetsov',
          members: [
            { id: 'a', firstName: 'A', gender: 'male' as const, age: 25, role: 'worker' as const, trudodniEarned: 0 },
            { id: 'b', firstName: 'B', gender: 'female' as const, age: 22, role: 'worker' as const, trudodniEarned: 0 },
          ],
          headOfHousehold: 'a',
          privatePlotSize: 0,
          privateLivestock: { cow: 0, pig: 0, sheep: 0, poultry: 0 },
          joinedTick: 0,
          loyaltyToCollective: 50,
        },
        isDvor: true,
      });

      world.add({
        position: { gridX: 1, gridY: 1 },
        citizen: {
          class: 'kolkhoznik',
          dvorId,
          dvorMemberId: 'a',
          gender: 'male' as const,
          assignment: 'farm-hq',
        },
      });

      world.add({
        position: { gridX: 1, gridY: 2 },
        citizen: {
          class: 'kolkhoznik',
          dvorId,
          dvorMemberId: 'b',
          gender: 'female' as const,
          assignment: 'farm-hq',
        },
      });

      accrueTrudodni();

      const maleTrudodni = TRUDODNI_VALUES[defaultCategory('male', 'worker')] * 26;
      const femaleTrudodni = TRUDODNI_VALUES[defaultCategory('female', 'worker')] * 26;
      expect(getBuildingTrudodni('farm-hq')).toBeCloseTo(maleTrudodni + femaleTrudodni);
    });

    it('tracks different buildings separately', () => {
      const dvorId = 'dvor-sep';

      world.add({
        dvor: {
          id: dvorId,
          surname: 'Popov',
          members: [
            { id: 'x', firstName: 'X', gender: 'male' as const, age: 30, role: 'worker' as const, trudodniEarned: 0 },
            { id: 'y', firstName: 'Y', gender: 'male' as const, age: 28, role: 'worker' as const, trudodniEarned: 0 },
          ],
          headOfHousehold: 'x',
          privatePlotSize: 0,
          privateLivestock: { cow: 0, pig: 0, sheep: 0, poultry: 0 },
          joinedTick: 0,
          loyaltyToCollective: 50,
        },
        isDvor: true,
      });

      world.add({
        position: { gridX: 2, gridY: 2 },
        citizen: {
          class: 'kolkhoznik',
          dvorId,
          dvorMemberId: 'x',
          gender: 'male' as const,
          assignment: 'building-A',
        },
      });

      world.add({
        position: { gridX: 4, gridY: 4 },
        citizen: {
          class: 'kolkhoznik',
          dvorId,
          dvorMemberId: 'y',
          gender: 'male' as const,
          assignment: 'building-B',
        },
      });

      accrueTrudodni();

      expect(getBuildingTrudodni('building-A')).toBeGreaterThan(0);
      expect(getBuildingTrudodni('building-B')).toBeGreaterThan(0);
      expect(getAllBuildingTrudodni().size).toBe(2);
    });

    it('does not accrue for workers without assignments', () => {
      const dvorId = 'dvor-idle';

      world.add({
        dvor: {
          id: dvorId,
          surname: 'Smirnov',
          members: [
            { id: 'z', firstName: 'Z', gender: 'male' as const, age: 30, role: 'worker' as const, trudodniEarned: 0 },
          ],
          headOfHousehold: 'z',
          privatePlotSize: 0,
          privateLivestock: { cow: 0, pig: 0, sheep: 0, poultry: 0 },
          joinedTick: 0,
          loyaltyToCollective: 50,
        },
        isDvor: true,
      });

      world.add({
        position: { gridX: 7, gridY: 7 },
        citizen: {
          class: 'kolkhoznik',
          dvorId,
          dvorMemberId: 'z',
          gender: 'male' as const,
          // No assignment
        },
      });

      accrueTrudodni();
      expect(getAllBuildingTrudodni().size).toBe(0);
    });
  });
});

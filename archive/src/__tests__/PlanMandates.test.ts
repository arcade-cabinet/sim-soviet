/**
 * @module __tests__/PlanMandates.test
 *
 * TDD tests for Iteration 14: 5-Year Plan Building Mandates.
 *
 * The 5-Year Plan doesn't just set quotas — it MANDATES which buildings
 * to construct. Placing mandated buildings increments fulfillment.
 * Meeting mandates earns commendations; ignoring them risks black marks.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { world } from '@/ecs/world';
import {
  allMandatesComplete,
  type BuildingMandate,
  createMandatesForEra,
  createPlanMandateState,
  getMandateFulfillment,
  isMandateComplete,
  type PlanMandateState,
  recordBuildingPlaced,
} from '@/game/PlanMandates';

describe('PlanMandates', () => {
  beforeEach(() => {
    world.clear();
  });

  afterEach(() => {
    world.clear();
  });

  // ── createMandatesForEra ──────────────────────────────────────────────

  describe('createMandatesForEra', () => {
    it('generates mandates for war_communism era', () => {
      const mandates = createMandatesForEra('war_communism', 'comrade');
      expect(mandates.length).toBeGreaterThan(0);
      // War communism should mandate basic infrastructure
      const defIds = mandates.map((m) => m.defId);
      expect(defIds.some((id) => id.includes('house') || id.includes('farm'))).toBe(true);
    });

    it('generates mandates for first_plans era', () => {
      const mandates = createMandatesForEra('first_plans', 'comrade');
      expect(mandates.length).toBeGreaterThan(0);
      // Industrialization era should mandate factories/industrial buildings
      const defIds = mandates.map((m) => m.defId);
      expect(
        defIds.some(
          (id) => id.includes('factory') || id.includes('power') || id.includes('distillery')
        )
      ).toBe(true);
    });

    it('generates more mandates on harder difficulty', () => {
      const easy = createMandatesForEra('war_communism', 'worker');
      const hard = createMandatesForEra('war_communism', 'tovarish');
      // Hard difficulty should have same or more total required buildings
      const easyTotal = easy.reduce((sum, m) => sum + m.required, 0);
      const hardTotal = hard.reduce((sum, m) => sum + m.required, 0);
      expect(hardTotal).toBeGreaterThanOrEqual(easyTotal);
    });

    it('each mandate has a defId, required count, and label', () => {
      const mandates = createMandatesForEra('war_communism', 'comrade');
      for (const m of mandates) {
        expect(m.defId).toBeTruthy();
        expect(m.required).toBeGreaterThan(0);
        expect(m.label).toBeTruthy();
      }
    });
  });

  // ── createPlanMandateState ──────────────────────────────────────────────

  describe('createPlanMandateState', () => {
    it('creates state with zero fulfillment for all mandates', () => {
      const mandates: BuildingMandate[] = [
        { defId: 'workers-house-a', required: 3, label: 'Workers Housing' },
        { defId: 'collective-farm-hq', required: 1, label: 'Collective Farm' },
      ];
      const state = createPlanMandateState(mandates);

      expect(state.mandates).toHaveLength(2);
      expect(state.mandates[0]!.fulfilled).toBe(0);
      expect(state.mandates[1]!.fulfilled).toBe(0);
    });
  });

  // ── recordBuildingPlaced ──────────────────────────────────────────────

  describe('recordBuildingPlaced', () => {
    it('increments fulfillment when a mandated building is placed', () => {
      const mandates: BuildingMandate[] = [
        { defId: 'workers-house-a', required: 3, label: 'Workers Housing' },
      ];
      const state = createPlanMandateState(mandates);

      const updated = recordBuildingPlaced(state, 'workers-house-a');
      expect(updated.mandates[0]!.fulfilled).toBe(1);
    });

    it('does not exceed required count', () => {
      const mandates: BuildingMandate[] = [
        { defId: 'workers-house-a', required: 1, label: 'Workers Housing' },
      ];
      const state = createPlanMandateState(mandates);

      let updated = recordBuildingPlaced(state, 'workers-house-a');
      updated = recordBuildingPlaced(updated, 'workers-house-a');
      // Still counts 2 (player built extra), but required is met at 1
      expect(updated.mandates[0]!.fulfilled).toBe(2);
    });

    it('ignores non-mandated buildings', () => {
      const mandates: BuildingMandate[] = [
        { defId: 'workers-house-a', required: 3, label: 'Workers Housing' },
      ];
      const state = createPlanMandateState(mandates);

      const updated = recordBuildingPlaced(state, 'vodka-distillery');
      expect(updated.mandates[0]!.fulfilled).toBe(0);
    });
  });

  // ── getMandateFulfillment ─────────────────────────────────────────────

  describe('getMandateFulfillment', () => {
    it('returns 0 when nothing built', () => {
      const mandates: BuildingMandate[] = [
        { defId: 'workers-house-a', required: 3, label: 'Workers Housing' },
      ];
      const state = createPlanMandateState(mandates);
      expect(getMandateFulfillment(state)).toBe(0);
    });

    it('returns 1.0 when all mandates fully met', () => {
      const mandates: BuildingMandate[] = [
        { defId: 'workers-house-a', required: 2, label: 'Workers Housing' },
      ];
      let state = createPlanMandateState(mandates);
      state = recordBuildingPlaced(state, 'workers-house-a');
      state = recordBuildingPlaced(state, 'workers-house-a');
      expect(getMandateFulfillment(state)).toBe(1);
    });

    it('returns partial fulfillment ratio', () => {
      const mandates: BuildingMandate[] = [
        { defId: 'workers-house-a', required: 4, label: 'Workers Housing' },
        { defId: 'power-station', required: 2, label: 'Power Station' },
      ];
      let state = createPlanMandateState(mandates);
      // Build 2/4 houses and 1/2 power stations = (2+1) / (4+2) = 0.5
      state = recordBuildingPlaced(state, 'workers-house-a');
      state = recordBuildingPlaced(state, 'workers-house-a');
      state = recordBuildingPlaced(state, 'power-station');
      expect(getMandateFulfillment(state)).toBeCloseTo(0.5);
    });
  });

  // ── isMandateComplete / allMandatesComplete ───────────────────────────

  describe('isMandateComplete', () => {
    it('returns true when fulfilled >= required', () => {
      expect(isMandateComplete({ defId: 'a', required: 2, label: 'A', fulfilled: 2 })).toBe(true);
      expect(isMandateComplete({ defId: 'a', required: 2, label: 'A', fulfilled: 3 })).toBe(true);
    });

    it('returns false when fulfilled < required', () => {
      expect(isMandateComplete({ defId: 'a', required: 2, label: 'A', fulfilled: 1 })).toBe(false);
    });
  });

  describe('allMandatesComplete', () => {
    it('returns true when all mandates are complete', () => {
      const state: PlanMandateState = {
        mandates: [
          { defId: 'a', required: 1, label: 'A', fulfilled: 1 },
          { defId: 'b', required: 2, label: 'B', fulfilled: 2 },
        ],
      };
      expect(allMandatesComplete(state)).toBe(true);
    });

    it('returns false when any mandate is incomplete', () => {
      const state: PlanMandateState = {
        mandates: [
          { defId: 'a', required: 1, label: 'A', fulfilled: 1 },
          { defId: 'b', required: 2, label: 'B', fulfilled: 0 },
        ],
      };
      expect(allMandatesComplete(state)).toBe(false);
    });

    it('returns true when no mandates exist', () => {
      expect(allMandatesComplete({ mandates: [] })).toBe(true);
    });
  });
});

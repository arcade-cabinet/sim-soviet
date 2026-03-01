/**
 * @module __tests__/game/CollectivePlanner.test
 *
 * TDD tests for the Collective Planner.
 *
 * The CollectivePlanner merges state-mandated buildings (from PlanMandates)
 * with worker-generated demands (from demandSystem) into a single prioritized
 * construction queue. The queue is what the collective "wants to build."
 *
 * Priority ordering:
 *   critical demands (0) < mandates (10) < urgent demands (20) < normal demands (30)
 *
 * Deduplication: if a mandate already covers a defId, the demand is skipped.
 */

import { createMetaStore, createResourceStore } from '@/ecs/factories';
import { world } from '@/ecs/world';
import { CollectivePlanner } from '@/game/CollectivePlanner';
import { createPlanMandateState, type PlanMandateState } from '@/game/PlanMandates';
import type { ConstructionDemand } from '@/game/workers/demandSystem';

describe('CollectivePlanner', () => {
  let planner: CollectivePlanner;

  beforeEach(() => {
    world.clear();
    createResourceStore({ timber: 200, steel: 50, cement: 20 });
    createMetaStore();
    planner = new CollectivePlanner();
  });

  afterEach(() => {
    world.clear();
  });

  describe('mandate-driven requests', () => {
    it('generates construction requests from unfulfilled mandates', () => {
      const mandateState: PlanMandateState = createPlanMandateState([
        { defId: 'workers-house-a', required: 2, label: 'Workers Housing' },
        { defId: 'power-station', required: 1, label: 'Power Station' },
      ]);

      const requests = planner.generateQueue(mandateState, []);
      expect(requests.length).toBe(3); // 2 housing + 1 power
      expect(requests.every((r) => r.source === 'mandate')).toBe(true);
    });

    it('does not request already-fulfilled mandates', () => {
      const mandateState: PlanMandateState = {
        mandates: [
          { defId: 'workers-house-a', required: 2, label: 'Workers Housing', fulfilled: 2 },
          { defId: 'power-station', required: 1, label: 'Power Station', fulfilled: 0 },
        ],
      };

      const requests = planner.generateQueue(mandateState, []);
      expect(requests.length).toBe(1);
      expect(requests[0]!.defId).toBe('power-station');
    });
  });

  describe('demand-driven requests', () => {
    it('generates construction requests from worker demands', () => {
      const demands: ConstructionDemand[] = [
        {
          category: 'housing',
          priority: 'critical',
          suggestedDefIds: ['workers-house-a'],
          reason: '10 workers homeless',
        },
      ];

      const requests = planner.generateQueue(null, demands);
      expect(requests.length).toBe(1);
      expect(requests[0]!.source).toBe('demand');
      expect(requests[0]!.defId).toBe('workers-house-a');
    });
  });

  describe('priority ordering', () => {
    it('mandates come before non-critical demands', () => {
      const mandateState: PlanMandateState = createPlanMandateState([
        { defId: 'power-station', required: 1, label: 'Power Station' },
      ]);
      const demands: ConstructionDemand[] = [
        {
          category: 'housing',
          priority: 'normal',
          suggestedDefIds: ['workers-house-a'],
          reason: 'Housing at 85%',
        },
      ];

      const requests = planner.generateQueue(mandateState, demands);
      expect(requests[0]!.source).toBe('mandate');
    });

    it('critical demands come before mandates', () => {
      const mandateState: PlanMandateState = createPlanMandateState([
        { defId: 'power-station', required: 1, label: 'Power Station' },
      ]);
      const demands: ConstructionDemand[] = [
        {
          category: 'food_production',
          priority: 'critical',
          suggestedDefIds: ['collective-farm-hq'],
          reason: 'Starvation imminent',
        },
      ];

      const requests = planner.generateQueue(mandateState, demands);
      expect(requests[0]!.source).toBe('demand');
      expect(requests[0]!.defId).toBe('collective-farm-hq');
    });
  });

  describe('deduplication', () => {
    it('does not duplicate when mandate and demand request same building', () => {
      const mandateState: PlanMandateState = createPlanMandateState([
        { defId: 'workers-house-a', required: 1, label: 'Workers Housing' },
      ]);
      const demands: ConstructionDemand[] = [
        {
          category: 'housing',
          priority: 'critical',
          suggestedDefIds: ['workers-house-a'],
          reason: 'Homeless workers',
        },
      ];

      const requests = planner.generateQueue(mandateState, demands);
      const housingRequests = requests.filter((r) => r.defId === 'workers-house-a');
      expect(housingRequests.length).toBe(1);
    });
  });
});

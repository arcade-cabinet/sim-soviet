/**
 * @module __tests__/BehavioralGovernor.test
 *
 * TDD tests for Iteration 11: Behavioral Governor — Autonomous Worker AI.
 *
 * The governor evaluates a 5-level priority stack for idle workers:
 *   1. Survive — self-assign to food production when starving
 *   2. State demand — construction mandates, quota-relevant buildings
 *   3. Trudodni — fill production buildings to meet labor quotas
 *   4. Improve — repair damaged infrastructure
 *   5. Private — stay idle (no assignment)
 *
 * Player sets a CollectiveFocus that shifts governor weights.
 * Force-assigned workers are never overridden.
 */

import { createCitizen } from '@/ecs/factories';
import type { Entity, Resources } from '@/ecs/world';
import { world } from '@/ecs/world';
import {
  evaluateWorkerPriority,
  FOOD_CRISIS_THRESHOLD,
  findBestAssignment,
  HUNGER_CRISIS_THRESHOLD,
  runGovernor,
} from '@/game/workers/governor';
import type { WorkerStats } from '@/game/workers/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Create a minimal resource object for testing. */
function makeResources(overrides: Partial<Resources> = {}): Resources {
  return {
    money: 100,
    food: 200,
    vodka: 50,
    power: 100,
    powerUsed: 20,
    population: 55,
    trudodni: 0,
    blat: 0,
    timber: 50,
    steel: 20,
    cement: 10,
    prefab: 0,
    seedFund: 0.2,
    emergencyReserve: 10,
    storageCapacity: 500,
    ...overrides,
  };
}

/** Create a test building entity in the ECS world. */
function placeBuilding(
  defId: string,
  gridX: number,
  gridY: number,
  opts: {
    powered?: boolean;
    produces?: { resource: 'food' | 'vodka'; amount: number };
    housingCap?: number;
    constructionPhase?: 'foundation' | 'building' | 'complete';
    durability?: number;
  } = {},
): Entity {
  const entity = world.add({
    position: { gridX, gridY },
    building: {
      defId,
      powered: opts.powered ?? true,
      powerReq: 10,
      powerOutput: 0,
      produces: opts.produces,
      housingCap: opts.housingCap ?? 0,
      pollution: 0,
      fear: 0,
      constructionPhase: opts.constructionPhase ?? 'complete',
    },
    renderable: {
      spriteId: defId,
      spritePath: `sprites/${defId}.png`,
      footprintX: 1,
      footprintY: 1,
      visible: true,
    },
    isBuilding: true,
  });
  if (opts.durability !== undefined) {
    world.addComponent(entity, 'durability', {
      current: opts.durability,
      decayRate: 0.1,
    });
  }
  return entity;
}

/** Create a default WorkerStats for testing. */
function makeStats(overrides: Partial<WorkerStats> = {}): WorkerStats {
  return {
    morale: 50,
    loyalty: 60,
    skill: 25,
    vodkaDependency: 15,
    ticksSinceVodka: 0,
    name: 'Test Worker',
    assignmentDuration: 0,
    assignmentSource: 'auto',
    ...overrides,
  };
}

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('BehavioralGovernor', () => {
  beforeEach(() => {
    world.clear();
  });

  afterEach(() => {
    world.clear();
  });

  // ── evaluateWorkerPriority ──────────────────────────────────────────────

  describe('evaluateWorkerPriority', () => {
    it('returns survive when worker hunger is critical', () => {
      const worker = createCitizen('worker', 5, 5);
      worker.citizen!.hunger = 80;
      const stats = makeStats();
      const resources = makeResources({ food: 200 });

      const priority = evaluateWorkerPriority(worker, stats, resources, 'balanced');
      expect(priority).toBe('survive');
    });

    it('returns survive when collective food is critically low', () => {
      const worker = createCitizen('worker', 5, 5);
      const stats = makeStats();
      const resources = makeResources({ food: 5, population: 55 });

      const priority = evaluateWorkerPriority(worker, stats, resources, 'balanced');
      expect(priority).toBe('survive');
    });

    it('returns state_demand when construction is active and food is stable', () => {
      const worker = createCitizen('worker', 5, 5);
      const stats = makeStats();
      const resources = makeResources({ food: 200, population: 55 });
      placeBuilding('tenement-block', 10, 10, { constructionPhase: 'building' });

      const priority = evaluateWorkerPriority(worker, stats, resources, 'balanced');
      expect(priority).toBe('state_demand');
    });

    it('returns trudodni when no urgent needs and production buildings exist', () => {
      const worker = createCitizen('worker', 5, 5);
      const stats = makeStats();
      const resources = makeResources({ food: 200, population: 55 });
      placeBuilding('collective-farm-a', 3, 3, {
        produces: { resource: 'food', amount: 5 },
      });

      const priority = evaluateWorkerPriority(worker, stats, resources, 'balanced');
      expect(priority).toBe('trudodni');
    });

    it('returns improve when buildings are damaged', () => {
      const worker = createCitizen('worker', 5, 5);
      const stats = makeStats();
      const resources = makeResources({ food: 200, population: 55 });
      placeBuilding('coal-plant-a', 3, 3, { durability: 30 });

      const priority = evaluateWorkerPriority(worker, stats, resources, 'balanced');
      expect(priority).toBe('improve');
    });

    it('returns private when nothing needs attention', () => {
      const worker = createCitizen('worker', 5, 5);
      const stats = makeStats();
      const resources = makeResources({ food: 200, population: 55 });

      const priority = evaluateWorkerPriority(worker, stats, resources, 'balanced');
      expect(priority).toBe('private');
    });

    it('evaluates priorities in correct order: survive > state_demand', () => {
      const worker = createCitizen('worker', 5, 5);
      worker.citizen!.hunger = 80; // starving
      const stats = makeStats();
      const resources = makeResources({ food: 5, population: 55 });
      // Active construction exists BUT worker is starving
      placeBuilding('tenement-block', 10, 10, { constructionPhase: 'building' });

      const priority = evaluateWorkerPriority(worker, stats, resources, 'balanced');
      expect(priority).toBe('survive');
    });
  });

  // ── CollectiveFocus overrides ─────────────────────────────────────────

  describe('CollectiveFocus overrides', () => {
    it('food focus elevates survive priority even at moderate food levels', () => {
      const worker = createCitizen('worker', 5, 5);
      const stats = makeStats();
      // Food per capita = 200/55 ≈ 3.6 — above FOOD_CRISIS_THRESHOLD (2.0)
      // but below FOOD_FOCUS_MULTIPLIER * 2.0 = 6.0
      const resources = makeResources({ food: 200, population: 55 });
      placeBuilding('collective-farm-a', 3, 3, {
        produces: { resource: 'food', amount: 5 },
      });

      const priorityBalanced = evaluateWorkerPriority(worker, stats, resources, 'balanced');
      const priorityFood = evaluateWorkerPriority(worker, stats, resources, 'food');

      // With food focus, threshold rises to 6.0 — 3.6 < 6.0, so survive
      expect(priorityFood).toBe('survive');
      // With balanced, threshold is 2.0 — 3.6 > 2.0, so trudodni (food is fine)
      expect(priorityBalanced).toBe('trudodni');
    });

    it('construction focus elevates state_demand priority', () => {
      const worker = createCitizen('worker', 5, 5);
      const stats = makeStats();
      const resources = makeResources({ food: 200, population: 55 });
      placeBuilding('collective-farm-a', 3, 3, {
        produces: { resource: 'food', amount: 5 },
      });
      placeBuilding('tenement-block', 10, 10, { constructionPhase: 'building' });

      const priorityConstruction = evaluateWorkerPriority(worker, stats, resources, 'construction');
      // Construction focus means state_demand before trudodni
      expect(priorityConstruction).toBe('state_demand');
    });
  });

  // ── findBestAssignment ──────────────────────────────────────────────────

  describe('findBestAssignment', () => {
    it('returns food production building for survive priority', () => {
      placeBuilding('collective-farm-a', 3, 3, {
        produces: { resource: 'food', amount: 5 },
      });

      const result = findBestAssignment('survive', 'worker');
      expect(result).not.toBeNull();
      expect(result!.buildingDefId).toBe('collective-farm-a');
      expect(result!.gridX).toBe(3);
      expect(result!.gridY).toBe(3);
    });

    it('returns construction site for state_demand priority', () => {
      placeBuilding('tenement-block', 10, 10, {
        constructionPhase: 'building',
      });

      const result = findBestAssignment('state_demand', 'worker');
      expect(result).not.toBeNull();
      expect(result!.buildingDefId).toBe('tenement-block');
    });

    it('returns production building for trudodni priority', () => {
      placeBuilding('vodka-distillery-a', 7, 7, {
        produces: { resource: 'vodka', amount: 3 },
      });

      const result = findBestAssignment('trudodni', 'worker');
      expect(result).not.toBeNull();
      expect(result!.buildingDefId).toBe('vodka-distillery-a');
    });

    it('returns null for private priority', () => {
      const result = findBestAssignment('private', 'worker');
      expect(result).toBeNull();
    });

    it('returns null when no suitable buildings exist', () => {
      const result = findBestAssignment('survive', 'worker');
      expect(result).toBeNull();
    });

    it('prefers food buildings for survive, not vodka', () => {
      placeBuilding('vodka-distillery-a', 7, 7, {
        produces: { resource: 'vodka', amount: 3 },
      });
      placeBuilding('collective-farm-a', 3, 3, {
        produces: { resource: 'food', amount: 5 },
      });

      const result = findBestAssignment('survive', 'worker');
      expect(result).not.toBeNull();
      expect(result!.buildingDefId).toBe('collective-farm-a');
    });
  });

  // ── runGovernor (integrated) ────────────────────────────────────────────

  describe('runGovernor', () => {
    it('assigns idle worker to food production when food is low', () => {
      const worker = createCitizen('worker', 5, 5);
      const stats = makeStats();
      const resources = makeResources({ food: 5, population: 55 });
      placeBuilding('collective-farm-a', 3, 3, {
        produces: { resource: 'food', amount: 5 },
      });

      const result = runGovernor(worker, stats, resources, 'balanced');
      expect(result).not.toBeNull();
      expect(result!.priority).toBe('survive');
      expect(result!.buildingDefId).toBe('collective-farm-a');
    });

    it('assigns idle worker to construction when mandate active', () => {
      const worker = createCitizen('worker', 5, 5);
      const stats = makeStats();
      const resources = makeResources({ food: 200, population: 55 });
      placeBuilding('tenement-block', 10, 10, { constructionPhase: 'building' });

      const result = runGovernor(worker, stats, resources, 'balanced');
      expect(result).not.toBeNull();
      expect(result!.priority).toBe('state_demand');
    });

    it('does not reassign force-assigned worker', () => {
      const worker = createCitizen('worker', 5, 5);
      worker.citizen!.assignment = 'coal-plant-a';
      const stats = makeStats({ assignmentSource: 'forced' });
      const resources = makeResources({ food: 5, population: 55 }); // low food
      placeBuilding('collective-farm-a', 3, 3, {
        produces: { resource: 'food', amount: 5 },
      });

      const result = runGovernor(worker, stats, resources, 'balanced');
      expect(result).toBeNull(); // forced workers are never overridden
    });

    it('does not reassign player-assigned worker', () => {
      const worker = createCitizen('worker', 5, 5);
      worker.citizen!.assignment = 'coal-plant-a';
      const stats = makeStats({ assignmentSource: 'player' });
      const resources = makeResources({ food: 5, population: 55 });
      placeBuilding('collective-farm-a', 3, 3, {
        produces: { resource: 'food', amount: 5 },
      });

      const result = runGovernor(worker, stats, resources, 'balanced');
      expect(result).toBeNull(); // player assignments are respected
    });

    it('reassigns auto-assigned worker when priorities shift', () => {
      const worker = createCitizen('worker', 5, 5);
      worker.citizen!.assignment = 'vodka-distillery-a';
      const stats = makeStats({ assignmentSource: 'auto' });
      // Food crisis — should override previous auto-assignment
      const resources = makeResources({ food: 2, population: 55 });
      placeBuilding('collective-farm-a', 3, 3, {
        produces: { resource: 'food', amount: 5 },
      });
      placeBuilding('vodka-distillery-a', 7, 7, {
        produces: { resource: 'vodka', amount: 3 },
      });

      const result = runGovernor(worker, stats, resources, 'balanced');
      expect(result).not.toBeNull();
      expect(result!.priority).toBe('survive');
      expect(result!.buildingDefId).toBe('collective-farm-a');
    });

    it('returns null when no buildings match any priority', () => {
      const worker = createCitizen('worker', 5, 5);
      const stats = makeStats();
      const resources = makeResources({ food: 200, population: 55 });
      // No buildings at all

      const result = runGovernor(worker, stats, resources, 'balanced');
      expect(result).toBeNull();
    });

    it('children and infants are excluded from governor', () => {
      const child = createCitizen('worker', 5, 5, 'male', 8);
      const stats = makeStats();
      const resources = makeResources({ food: 5, population: 55 });
      placeBuilding('collective-farm-a', 3, 3, {
        produces: { resource: 'food', amount: 5 },
      });

      const result = runGovernor(child, stats, resources, 'balanced');
      expect(result).toBeNull(); // children don't work
    });
  });

  // ── Constants ───────────────────────────────────────────────────────────

  describe('thresholds', () => {
    it('FOOD_CRISIS_THRESHOLD is a per-capita ratio', () => {
      expect(FOOD_CRISIS_THRESHOLD).toBeGreaterThan(0);
      expect(FOOD_CRISIS_THRESHOLD).toBeLessThan(5);
    });

    it('HUNGER_CRISIS_THRESHOLD is between 0-100', () => {
      expect(HUNGER_CRISIS_THRESHOLD).toBeGreaterThanOrEqual(0);
      expect(HUNGER_CRISIS_THRESHOLD).toBeLessThanOrEqual(100);
    });
  });
});

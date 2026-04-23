/**
 * Extended tests for src/stores/gameStore.ts
 *
 * Covers game speed, inspection state, and snapshot creation from missing ECS singletons.
 */
import { getMetaEntity } from '@/ecs/archetypes';
import { createBuilding, createMetaStore, createResourceStore } from '@/ecs/factories';
import { world } from '@/ecs/world';
import {
  cycleGameSpeed,
  getGameSpeed,
  getInspected,
  getInspectedWorker,
  type InspectedWorker,
  notifyStateChange,
  selectTool,
  setGameSpeed,
  setInspected,
  setInspectedWorker,
  setPaused,
} from '@/stores/gameStore';

function resetStoreState(): void {
  world.clear();
  createResourceStore();
  createMetaStore();
  setPaused(false);
  selectTool('none');
  setInspected(null);
  setInspectedWorker(null);
  setGameSpeed(1);
}

const MOCK_WORKER: InspectedWorker = {
  name: 'Comrade Ivanov',
  class: 'worker',
  morale: 65,
  loyalty: 70,
  skill: 40,
  vodkaDependency: 20,
  assignedBuildingDefId: null,
};

describe('gameStore — extended', () => {
  beforeEach(() => {
    resetStoreState();
  });

  afterEach(() => {
    world.clear();
  });

  // ── Game Speed ─────────────────────────────────────────────

  describe('getGameSpeed / setGameSpeed / cycleGameSpeed', () => {
    it('defaults to speed 1', () => {
      expect(getGameSpeed()).toBe(1);
    });

    it('setGameSpeed sets speed to 2', () => {
      setGameSpeed(2);
      expect(getGameSpeed()).toBe(2);
    });

    it('setGameSpeed sets speed to 3', () => {
      setGameSpeed(3);
      expect(getGameSpeed()).toBe(3);
    });

    it('cycleGameSpeed cycles 1 → 2 → 3 → 10 → 100 → 1', () => {
      expect(getGameSpeed()).toBe(1);
      expect(cycleGameSpeed()).toBe(2);
      expect(cycleGameSpeed()).toBe(3);
      expect(cycleGameSpeed()).toBe(10);
      expect(cycleGameSpeed()).toBe(100);
      expect(cycleGameSpeed()).toBe(1);
    });

    it('cycleGameSpeed returns the new speed', () => {
      const result = cycleGameSpeed();
      expect(result).toBe(getGameSpeed());
    });
  });

  // ── Snapshot with buildings ────────────────────────────────

  describe('snapshot buildingCount', () => {
    it('reflects the number of buildings in ECS', () => {
      createBuilding(0, 0, 'power-station');
      createBuilding(1, 1, 'apartment-tower-a');
      createBuilding(2, 2, 'collective-farm-hq');
      notifyStateChange();
      // We can't access the snapshot directly without the hook, but
      // we verify the ECS state is correct (buildingsLogic.entities.length=3)
      expect(world.with('position', 'building').entities.length).toBe(3);
    });
  });

  // ── Worker Inspection ────────────────────────────────────────

  describe('setInspectedWorker / getInspectedWorker', () => {
    it('starts as null', () => {
      expect(getInspectedWorker()).toBeNull();
    });

    it('sets and clears inspected worker', () => {
      setInspectedWorker(MOCK_WORKER);
      expect(getInspectedWorker()).toBe(MOCK_WORKER);
      setInspectedWorker(null);
      expect(getInspectedWorker()).toBeNull();
    });

    it('clears inspected building when worker is set', () => {
      setInspected({
        gridX: 1,
        gridY: 1,
        defId: 'farm',
        powered: true,
        cost: 100,
        footprintW: 1,
        footprintH: 1,
        name: 'Farm',
        desc: 'A farm',
      });
      expect(getInspected()).not.toBeNull();
      setInspectedWorker(MOCK_WORKER);
      expect(getInspected()).toBeNull();
    });
  });

  // ── Snapshot from empty ECS ────────────────────────────────

  describe('snapshot defaults when ECS is empty', () => {
    it('notifyStateChange does not throw when world is empty', () => {
      world.clear();
      expect(() => notifyStateChange()).not.toThrow();
    });
  });

  // ── Snapshot settlement fields ─────────────────────────────

  describe('snapshot settlement-related fields', () => {
    it('meta entity stores settlementTier', () => {
      const meta = getMetaEntity()!;
      expect(meta.gameMeta.settlementTier).toBe('selo');
      meta.gameMeta.settlementTier = 'gorod';
      expect(meta.gameMeta.settlementTier).toBe('gorod');
    });

    it('meta entity stores blackMarks and commendations', () => {
      const meta = getMetaEntity()!;
      meta.gameMeta.blackMarks = 5;
      meta.gameMeta.commendations = 3;
      notifyStateChange();
      expect(meta.gameMeta.blackMarks).toBe(5);
      expect(meta.gameMeta.commendations).toBe(3);
    });

    it('meta entity stores threatLevel', () => {
      const meta = getMetaEntity()!;
      meta.gameMeta.threatLevel = 'watched';
      notifyStateChange();
      expect(meta.gameMeta.threatLevel).toBe('watched');
    });
  });

  // ── Inspected Worker ────────────────────────────────────────

  describe('setInspectedWorker / getInspectedWorker', () => {
    it('starts as null', () => {
      expect(getInspectedWorker()).toBeNull();
    });

    it('round-trips worker data', () => {
      setInspectedWorker(MOCK_WORKER);
      const result = getInspectedWorker();
      expect(result).toBe(MOCK_WORKER);
      expect(result!.name).toBe('Comrade Ivanov');
      expect(result!.class).toBe('worker');
      expect(result!.morale).toBe(65);
      expect(result!.loyalty).toBe(70);
      expect(result!.skill).toBe(40);
      expect(result!.vodkaDependency).toBe(20);
      expect(result!.assignedBuildingDefId).toBeNull();
    });

    it('clears with null', () => {
      setInspectedWorker(MOCK_WORKER);
      expect(getInspectedWorker()).not.toBeNull();
      setInspectedWorker(null);
      expect(getInspectedWorker()).toBeNull();
    });

    it('clears inspected building when setting inspected worker', () => {
      setInspected({
        gridX: 5,
        gridY: 5,
        defId: 'power-station',
        powered: true,
        cost: 100,
        footprintW: 2,
        footprintH: 2,
        name: 'Coal Plant',
        desc: 'Generates power',
      });
      expect(getInspected()).not.toBeNull();

      setInspectedWorker(MOCK_WORKER);
      expect(getInspectedWorker()).not.toBeNull();
      expect(getInspected()).toBeNull();
    });

    it('clears inspected worker when setting inspected building', () => {
      setInspectedWorker(MOCK_WORKER);
      expect(getInspectedWorker()).not.toBeNull();

      setInspected({
        gridX: 5,
        gridY: 5,
        defId: 'power-station',
        powered: true,
        cost: 100,
        footprintW: 2,
        footprintH: 2,
        name: 'Coal Plant',
        desc: 'Generates power',
      });
      expect(getInspected()).not.toBeNull();
      expect(getInspectedWorker()).toBeNull();
    });

    it('stores assigned building defId', () => {
      const assigned: InspectedWorker = {
        ...MOCK_WORKER,
        assignedBuildingDefId: 'collective-farm-hq',
      };
      setInspectedWorker(assigned);
      expect(getInspectedWorker()!.assignedBuildingDefId).toBe('collective-farm-hq');
    });
  });
});

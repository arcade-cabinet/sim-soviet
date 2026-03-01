/**
 * @module __tests__/game/AutoBuilder.test
 *
 * TDD tests for the AutoBuilder module.
 *
 * When the CollectivePlanner decides a building is needed, AutoBuilder finds
 * a valid grid cell near existing buildings and places new construction
 * foundations autonomously.
 */

import { GRID_SIZE } from '@/config';
import { buildings } from '@/ecs/archetypes';
import { createBuilding, createGrid, createResourceStore, createMetaStore } from '@/ecs/factories';
import { world } from '@/ecs/world';
import { autoPlaceBuilding, findPlacementCell } from '@/game/workers/autoBuilder';
import { GameRng } from '@/game/SeedSystem';

describe('AutoBuilder', () => {
  let rng: GameRng;

  beforeEach(() => {
    world.clear();
    createGrid(GRID_SIZE);
    createResourceStore({ timber: 500, steel: 100, cement: 50 });
    createMetaStore();
    rng = new GameRng('test-autobuilder');
  });

  afterEach(() => {
    world.clear();
  });

  describe('findPlacementCell', () => {
    it('returns a cell adjacent to an existing building', () => {
      createBuilding(15, 15, 'power-station');
      const cell = findPlacementCell(rng);
      expect(cell).not.toBeNull();
      const dist = Math.abs(cell!.gridX - 15) + Math.abs(cell!.gridY - 15);
      expect(dist).toBeGreaterThan(0);
      expect(dist).toBeLessThanOrEqual(4);
    });

    it('returns null when no buildings exist', () => {
      const cell = findPlacementCell(rng);
      expect(cell).toBeNull();
    });
  });

  describe('autoPlaceBuilding', () => {
    it('places a building on the grid near existing buildings', () => {
      createBuilding(15, 15, 'power-station');
      const entity = autoPlaceBuilding('workers-house-a', rng);
      expect(entity).not.toBeNull();
      expect(entity!.building!.defId).toBe('workers-house-a');
      expect(entity!.building!.constructionPhase).toBe('foundation');
    });

    it('returns null when no valid cell is available', () => {
      const entity = autoPlaceBuilding('workers-house-a', rng);
      expect(entity).toBeNull();
    });
  });
});

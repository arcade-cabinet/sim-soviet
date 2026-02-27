/**
 * GameInit — initializes the ECS world and SimulationEngine for the 3D version.
 *
 * Creates the resource store, meta store, tile grid, and starter buildings
 * using the archive's ECS factories. Returns a configured SimulationEngine
 * ready for tick().
 */

import { createResourceStore, createMetaStore, createGrid } from '@/ecs/factories';
import { placeNewBuilding } from '@/ecs/factories/buildingFactories';
import { createStartingSettlement } from '@/ecs/factories/settlementFactories';
import { SimulationEngine, type SimCallbacks } from '@/game/SimulationEngine';
import { GameGrid } from '@/game/GameGrid';
import { GRID_SIZE } from '@/config';
import { notifyStateChange } from '@/stores/gameStore';

let engine: SimulationEngine | null = null;
let initialized = false;

/**
 * Initialize the ECS world with all entities and return a SimulationEngine.
 * Safe to call multiple times — subsequent calls return the existing engine.
 */
export function initGame(callbacks: SimCallbacks): SimulationEngine {
  if (engine && initialized) return engine;

  // Create singleton store entities
  createResourceStore();
  createMetaStore({
    seed: 'simsoviet-3d',
    date: { year: 1922, month: 10, tick: 0 },
  });

  // Create tile grid
  createGrid(GRID_SIZE);

  // Place starter buildings
  const starters: { x: number; y: number; defId: string }[] = [
    { x: 5, y: 4, defId: 'power-station' },
    { x: 7, y: 4, defId: 'workers-house-a' },
    { x: 9, y: 4, defId: 'apartment-tower-a' },
    { x: 7, y: 6, defId: 'workers-house-b' },
    { x: 9, y: 6, defId: 'apartment-tower-c' },
    { x: 5, y: 6, defId: 'factory-office' },
    { x: 5, y: 8, defId: 'vodka-distillery' },
    { x: 9, y: 8, defId: 'collective-farm-hq' },
    { x: 7, y: 8, defId: 'radio-station' },
    { x: 3, y: 6, defId: 'gulag-admin' },
  ];

  for (const s of starters) {
    placeNewBuilding(s.x, s.y, s.defId);
  }

  // Create starting settlement (citizens, dvory)
  createStartingSettlement('comrade');

  // Create spatial index grid
  const grid = new GameGrid(GRID_SIZE);
  // Mark starter building cells in the spatial grid
  for (const s of starters) {
    grid.setCell(s.x, s.y, s.defId);
  }

  // Create and configure SimulationEngine
  engine = new SimulationEngine(grid, callbacks);
  initialized = true;

  // Initial notification to populate React snapshot
  notifyStateChange();

  return engine;
}

/** Get the current SimulationEngine instance (null if not initialized). */
export function getEngine(): SimulationEngine | null {
  return engine;
}

/** Whether the game has been initialized. */
export function isGameInitialized(): boolean {
  return initialized;
}

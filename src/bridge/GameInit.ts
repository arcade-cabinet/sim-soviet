/**
 * GameInit — initializes the ECS world and SimulationEngine for the 3D version.
 *
 * Creates the resource store, meta store, tile grid, and starter buildings
 * using the archive's ECS factories. Returns a configured SimulationEngine
 * ready for tick().
 */

import { GRID_SIZE } from '@/config';
import { terrainFeatures } from '@/ecs/archetypes';
import { createGrid, createMetaStore, createResourceStore } from '@/ecs/factories';
import { createBuilding } from '@/ecs/factories/buildingFactories';
import { createStartingSettlement } from '@/ecs/factories/settlementFactories';
import { world } from '@/ecs/world';
import { GameGrid } from '@/game/GameGrid';
import { MapSystem } from '@/game/map';
import { recalculatePaths } from '@/game/PathSystem';
import { SaveSystem } from '@/game/SaveSystem';
import { type ConsequenceLevel, DIFFICULTY_PRESETS, type DifficultyLevel } from '@/game/ScoringSystem';
import { type SimCallbacks, SimulationEngine } from '@/game/SimulationEngine';
import { notifyStateChange, notifyTerrainDirty } from '@/stores/gameStore';

export interface GameInitOptions {
  difficulty?: DifficultyLevel;
  consequence?: ConsequenceLevel;
  seed?: string;
}

let engine: SimulationEngine | null = null;
let gameGrid: GameGrid | null = null;
let saveSystem: SaveSystem | null = null;
let stopAutoSave: (() => void) | null = null;
let initialized = false;

/**
 * Initialize the ECS world with all entities and return a SimulationEngine.
 * Safe to call multiple times — subsequent calls return the existing engine.
 */
export function initGame(callbacks: SimCallbacks, options?: GameInitOptions): SimulationEngine {
  if (engine && initialized) return engine;

  const difficulty = options?.difficulty ?? 'comrade';
  const consequence = options?.consequence ?? 'permadeath';
  const seed = options?.seed ?? 'simsoviet-3d';

  // Create singleton store entities with enough materials for early construction.
  // Scale starting resources by difficulty multiplier (worker=1.5x, comrade=1.0x, tovarish=0.7x).
  const resMult = DIFFICULTY_PRESETS[difficulty].resourceMultiplier;
  createResourceStore({
    food: Math.round(800 * resMult),
    timber: Math.round(150 * resMult),
    steel: Math.round(60 * resMult),
    cement: Math.round(30 * resMult),
  });
  createMetaStore({
    seed,
    date: { year: 1922, month: 10, tick: 0 },
  });

  // Create tile grid
  createGrid(GRID_SIZE);

  // Generate procedural terrain (mountains, forests, marshes, rivers)
  const mapSystem = new MapSystem({
    seed,
    size: 'medium',
    riverCount: 1,
    forestDensity: 0.12,
    marshDensity: 0.04,
    mountainDensity: 0.04,
  });
  mapSystem.generate();

  // Clear terrain features that overlap the starter building area (2-10, 3-9)
  for (const entity of [...terrainFeatures.entities]) {
    const { gridX, gridY } = entity.position;
    if (gridX >= 2 && gridX <= 10 && gridY >= 3 && gridY <= 9) {
      world.remove(entity);
    }
  }

  // Place starter buildings — use createBuilding() (operational immediately)
  // NOT placeNewBuilding() which starts construction phase
  const starters: { x: number; y: number; defId: string }[] = [
    { x: 5, y: 4, defId: 'power-station' },
    { x: 7, y: 4, defId: 'workers-house-a' },
    { x: 9, y: 4, defId: 'apartment-tower-a' },
    { x: 7, y: 6, defId: 'workers-house-b' },
    { x: 9, y: 6, defId: 'apartment-tower-c' },
    { x: 5, y: 6, defId: 'factory-office' },
    { x: 5, y: 8, defId: 'vodka-distillery' },
    { x: 9, y: 8, defId: 'collective-farm-hq' },
    { x: 3, y: 8, defId: 'collective-farm-hq' },
    { x: 7, y: 8, defId: 'radio-station' },
    { x: 3, y: 6, defId: 'gulag-admin' },
  ];

  for (const s of starters) {
    createBuilding(s.x, s.y, s.defId);
  }

  // Create starting settlement (citizens, dvory)
  createStartingSettlement(difficulty);

  // Create spatial index grid
  gameGrid = new GameGrid(GRID_SIZE);
  const grid = gameGrid;
  // Mark starter building cells in the spatial grid
  for (const s of starters) {
    grid.setCell(s.x, s.y, s.defId);
  }

  // Create and configure SimulationEngine
  engine = new SimulationEngine(grid, callbacks, undefined, difficulty, consequence);

  // Create SaveSystem wired to the grid and engine
  saveSystem = new SaveSystem(grid);
  saveSystem.setEngine(engine);
  stopAutoSave = saveSystem.startAutoSave();

  // Generate initial dirt paths between starter buildings
  recalculatePaths();

  initialized = true;

  // Initial notification to populate React snapshot
  notifyTerrainDirty();
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

/** Get the spatial grid (for placement validation). */
export function getGameGrid(): GameGrid | null {
  return gameGrid;
}

/** Get the SaveSystem instance (null if game not initialized). */
export function getSaveSystem(): SaveSystem | null {
  return saveSystem;
}

/** Stop autosave timer. Call on page unload or game shutdown. */
export function shutdownSaveSystem(): void {
  if (stopAutoSave) {
    stopAutoSave();
    stopAutoSave = null;
  }
}

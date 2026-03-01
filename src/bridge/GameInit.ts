/**
 * GameInit — initializes the ECS world and SimulationEngine for the 3D version.
 *
 * Creates the resource store, meta store, tile grid, and starter buildings
 * using the archive's ECS factories. Returns a configured SimulationEngine
 * ready for tick().
 */

import { GRID_SIZE } from '@/config';
import { createGrid, createMetaStore, createResourceStore } from '@/ecs/factories';
import { createStartingSettlement } from '@/ecs/factories/settlementFactories';
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
  mapSize?: 'small' | 'medium' | 'large';
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
  const mapSizeKey = options?.mapSize ?? 'medium';
  const MAP_GRID_SIZES: Record<string, number> = { small: 20, medium: 30, large: 50 };
  const gridSize = MAP_GRID_SIZES[mapSizeKey] ?? GRID_SIZE;

  // Create singleton store entities with starting resources.
  // Era 1 (Revolution/1917): Timber only. No steel, no power, no food stockpile.
  // Scale starting resources by difficulty multiplier (worker=2.0x, comrade=1.0x, tovarish=0.5x).
  const resMult = DIFFICULTY_PRESETS[difficulty].resourceMultiplier;
  createResourceStore({
    food: 0,
    timber: Math.round(200 * resMult),
    steel: 0,
    cement: 0,
    population: 0,
  });
  createMetaStore({
    seed,
    date: { year: 1917, month: 10, tick: 0 },
  });

  // Create tile grid
  createGrid(gridSize);

  // Generate procedural terrain (mountains, forests, marshes, rivers)
  const mapSystem = new MapSystem({
    seed,
    size: mapSizeKey,
    riverCount: 1,
    forestDensity: 0.12,
    marshDensity: 0.04,
    mountainDensity: 0.04,
  });
  mapSystem.generate();

  // No pre-placed starter buildings — the game starts with undeveloped land
  // and 10 dvory (family households) + 1 chairman dvor.

  // Create starting settlement (citizens, dvory)
  createStartingSettlement(difficulty);

  // Create spatial index grid
  gameGrid = new GameGrid(GRID_SIZE);
  const grid = gameGrid;

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

/**
 * GameInit — initializes the ECS world and SimulationEngine for the 3D version.
 *
 * Creates the resource store, meta store, tile grid, and starter buildings
 * using the archive's ECS factories. Returns a configured SimulationEngine
 * ready for tick().
 */

import { GRID_SIZE, setCurrentGridSize } from '@/config';
import { createGrid, createMetaStore, createResourceStore } from '@/ecs/factories';
import { createStartingSettlement } from '@/ecs/factories/settlementFactories';
import { GameGrid } from '@/game/GameGrid';
import { MapSystem } from '@/game/map';
import { recalculatePaths } from '@/game/PathSystem';
import { SaveSystem } from '@/game/SaveSystem';
import { type ConsequenceLevel, DIFFICULTY_PRESETS, type DifficultyLevel } from '@/ai/agents/political/ScoringSystem';
import type { SimCallbacks } from '@/game/engine/types';
import { SimulationEngine } from '@/game/SimulationEngine';
import { notifyStateChange, notifyTerrainDirty } from '@/stores/gameStore';

/** Configuration options for game initialization (difficulty, map size, seed). */
export interface GameInitOptions {
  difficulty?: DifficultyLevel;
  consequence?: ConsequenceLevel;
  seed?: string;
  mapSize?: 'small' | 'medium' | 'large';
  /** When true, enables ChairmanAgent autopilot — AI auto-resolves minigames and reports. */
  autopilot?: boolean;
}

let engine: SimulationEngine | null = null;
let gameGrid: GameGrid | null = null;
let saveSystem: SaveSystem | null = null;
let stopAutoSave: (() => void) | null = null;
let initialized = false;

/**
 * Initialize the ECS world with all entities and return a SimulationEngine.
 * Safe to call multiple times — subsequent calls return the existing engine.
 *
 * @param callbacks - Event callbacks wired from App.web.tsx (toasts, era changes, etc.)
 * @param options - Difficulty, consequence, seed, and map size configuration
 * @returns Configured SimulationEngine ready for tick()
 */
export function initGame(callbacks: SimCallbacks, options?: GameInitOptions): SimulationEngine {
  if (engine && initialized) return engine;

  const difficulty = options?.difficulty ?? 'comrade';
  const consequence = options?.consequence ?? 'permadeath';
  const seed = options?.seed ?? 'simsoviet-3d';
  const mapSizeKey = options?.mapSize ?? 'medium';
  const MAP_GRID_SIZES: Record<string, number> = { small: 20, medium: 30, large: 50 };
  const gridSize = MAP_GRID_SIZES[mapSizeKey] ?? GRID_SIZE;

  // Set runtime grid size so scene components use the correct value
  setCurrentGridSize(gridSize);

  // Create singleton store entities with starting resources.
  // Era 1 (Revolution/1917): Timber only. No steel, no power, no food stockpile.
  // Scale starting resources by difficulty multiplier (worker=2.0x, comrade=1.0x, tovarish=0.5x).
  const resMult = DIFFICULTY_PRESETS[difficulty].resourceMultiplier;
  // Starting resources — generous enough for ~2 seasons of survival without farms.
  // This is a city-builder, not a survival game: players need time to explore and build.
  createResourceStore({
    food: Math.round(500 * resMult),
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
  gameGrid = new GameGrid(gridSize);
  const grid = gameGrid;

  // Create and configure SimulationEngine
  engine = new SimulationEngine(grid, callbacks, undefined, difficulty, consequence);

  // Enable autopilot if requested — ChairmanAgent auto-resolves minigames and reports
  if (options?.autopilot) {
    engine.enableAutopilot();
  }

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

/**
 * Reset all module-level state so initGame() can be called again for a new game.
 * Called by resetAllSingletons() during game restart.
 */
export function resetGameInit(): void {
  shutdownSaveSystem();
  engine = null;
  gameGrid = null;
  saveSystem = null;
  initialized = false;
}

/**
 * GameInit — initializes the ECS world and SimulationEngine for the 3D version.
 *
 * Creates the resource store, meta store, tile grid, and starter buildings
 * using the archive's ECS factories. Returns a configured SimulationEngine
 * ready for tick().
 */

import { FreeformGovernor } from '@/ai/agents/crisis/FreeformGovernor';
import type { GovernorMode } from '@/ai/agents/crisis/Governor';
import { HistoricalGovernor } from '@/ai/agents/crisis/HistoricalGovernor';
import type { ConsequenceLevel } from '@/ai/agents/political/ScoringSystem';
import { setCurrentGridSize } from '@/config';
import {
  buildingsLogic,
  citizens,
  dvory,
  housing,
  operationalBuildings,
  underConstruction,
} from '@/ecs/archetypes';
import { createGrid, createMetaStore, createResourceStore } from '@/ecs/factories';
import { createStartingSettlement } from '@/ecs/factories/settlementFactories';
import type { SimCallbacks } from '@/game/engine/types';
import { GameGrid } from '@/game/GameGrid';
import { MapSystem } from '@/game/map';
import { recalculatePaths } from '@/game/PathSystem';
import { SaveSystem } from '@/game/SaveSystem';
import { SimulationEngine } from '@/game/SimulationEngine';
import { notifyStateChange, notifyTerrainDirty } from '@/stores/gameStore';

/** Configuration options for game initialization. */
export interface GameInitOptions {
  consequence?: ConsequenceLevel;
  seed?: string;
  /** When true, enables ChairmanAgent autopilot — AI auto-resolves minigames and reports. */
  autopilot?: boolean;
  /** Game mode — historical uses real Soviet timeline, freeform uses alternate history. */
  gameMode?: GovernorMode;
  /** Year at which history diverges in freeform mode (1917-1991). */
  divergenceYear?: number;
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

  const consequence = options?.consequence ?? 'gulag';
  const seed = options?.seed ?? 'simsoviet-3d';
  const gameMode = options?.gameMode ?? 'historical';

  // Starting grid is 20x20 (selo) — expands dynamically via settlement tier upgrades
  const gridSize = 20;

  // Set runtime grid size so scene components use the correct value
  setCurrentGridSize(gridSize);

  // Create singleton store entities with starting resources.
  // Governor handles difficulty dynamically — always use 1.0 resource multiplier.
  // Starting resources — generous enough for ~2 seasons of survival without farms.
  // Players need time to explore the settlement and set priorities.
  createResourceStore({
    food: 500,
    timber: 200,
    steel: 50,
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
    size: 'small',
    riverCount: 1,
    forestDensity: 0.12,
    marshDensity: 0.04,
    mountainDensity: 0.04,
  });
  mapSystem.generate();

  // No pre-placed starter buildings — the game starts with undeveloped land
  // and 10 dvory (family households) + 1 chairman dvor.

  // Create starting settlement (citizens, dvory)
  createStartingSettlement('comrade');

  // Create spatial index grid
  gameGrid = new GameGrid(gridSize);
  const grid = gameGrid;

  // Create and configure SimulationEngine
  engine = new SimulationEngine(grid, callbacks, undefined, 'comrade', consequence);

  // Wire Governor — always active (history IS the difficulty)
  if (gameMode === 'freeform') {
    engine.setGovernor(new FreeformGovernor());
  } else {
    engine.setGovernor(new HistoricalGovernor());
  }

  // Enable autopilot if requested — ChairmanAgent auto-resolves minigames and reports
  if (options?.autopilot) {
    engine.enableAutopilot();
  }

  // Create SaveSystem wired to the grid and engine
  saveSystem = new SaveSystem(grid);
  saveSystem.setEngine(engine);
  stopAutoSave = saveSystem.startAutoSave();

  // No artificial bootstrap — the collective demand system handles all building
  // placement organically. Dvory arrive at empty land and the autonomous
  // collective detects demand (unhoused, food, etc.) and places buildings.

  // Generate initial dirt paths (will be recalculated as buildings appear)
  recalculatePaths();

  initialized = true;

  // Expose engine + ECS archetypes on window for E2E page.evaluate() access
  if (typeof window !== 'undefined') {
    (window as any).__simEngine = engine;
    // Expose ECS archetypes for diagnostic building/citizen counts
    (window as any).__ecsArchetypes = {
      get buildingCount() { return buildingsLogic.entities.length; },
      get operationalCount() { return operationalBuildings.entities.length; },
      get constructionCount() { return underConstruction.entities.length; },
      get citizenCount() { return citizens.entities.length; },
      get dvorCount() { return dvory.entities.length; },
      get housingCount() { return housing.entities.length; },
    };
  }

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

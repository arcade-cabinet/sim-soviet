/**
 * Shared test infrastructure for playthrough integration tests.
 *
 * Provides engine factory, time helpers, snapshot readers, invariant
 * checkers, and settlement builders so individual test files stay focused
 * on scenario logic.
 */

import { getMetaEntity, getResourceEntity, operationalBuildings } from '../../src/ecs/archetypes';
import { createBuilding, createMetaStore, createResourceStore } from '../../src/ecs/factories';
import type { Entity, GameMeta, Resources } from '../../src/ecs/world';
import { world } from '../../src/ecs/world';
import { GameGrid } from '../../src/game/GameGrid';
import type { ConsequenceLevel, DifficultyLevel } from '../../src/game/ScoringSystem';
import type { SimCallbacks } from '../../src/game/SimulationEngine';
import { SimulationEngine } from '../../src/game/SimulationEngine';

// ─── Time Constants ─────────────────────────────────────────────────────────

export const TICKS_PER_DAY = 3;
export const TICKS_PER_MONTH = 30;
export const TICKS_PER_YEAR = 360;

// ─── Mock Callbacks ─────────────────────────────────────────────────────────

/**
 * Creates the full set of 17 SimCallbacks as jest.fn() mocks.
 * All callbacks are present so engine wiring never encounters undefined.
 */
export function createMockCallbacks(): SimCallbacks & Record<string, jest.Mock> {
  return {
    onToast: jest.fn(),
    onAdvisor: jest.fn(),
    onPravda: jest.fn(),
    onStateChange: jest.fn(),
    onSeasonChanged: jest.fn(),
    onWeatherChanged: jest.fn(),
    onDayPhaseChanged: jest.fn(),
    onBuildingCollapsed: jest.fn(),
    onGameOver: jest.fn(),
    onSettlementChange: jest.fn(),
    onNewPlan: jest.fn(),
    onEraChanged: jest.fn(),
    onAnnualReport: jest.fn(),
    onMinigame: jest.fn(),
    onTutorialMilestone: jest.fn(),
    onAchievement: jest.fn(),
    onGameTally: jest.fn(),
  };
}

// ─── Engine Factory ─────────────────────────────────────────────────────────

export interface PlaythroughOptions {
  resources?: Partial<Resources>;
  meta?: Partial<GameMeta>;
  difficulty?: DifficultyLevel;
  consequence?: ConsequenceLevel;
  /** When true, mocks Math.random to 0.99 to suppress stochastic events. */
  deterministicRandom?: boolean;
}

export interface PlaythroughEngine {
  engine: SimulationEngine;
  callbacks: SimCallbacks & Record<string, jest.Mock>;
  grid: GameGrid;
}

/**
 * Creates a fully wired SimulationEngine for playthrough tests.
 *
 * Calls world.clear(), creates resource + meta stores, and constructs
 * the engine. If deterministicRandom is true (default), mocks Math.random
 * to 0.99 to suppress random events.
 */
export function createPlaythroughEngine(options: PlaythroughOptions = {}): PlaythroughEngine {
  world.clear();

  const grid = new GameGrid();
  const callbacks = createMockCallbacks();

  createResourceStore(options.resources);
  createMetaStore(options.meta);

  const engine = new SimulationEngine(grid, callbacks, undefined, options.difficulty, options.consequence);

  if (options.deterministicRandom !== false) {
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
  }

  return { engine, callbacks, grid };
}

// ─── Time Helpers ───────────────────────────────────────────────────────────

/** Advance the engine by a specific number of ticks. */
export function advanceTicks(engine: SimulationEngine, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    engine.tick();
  }
}

/** Advance the engine by a number of days (3 ticks/day). */
export function advanceDays(engine: SimulationEngine, days: number): void {
  advanceTicks(engine, days * TICKS_PER_DAY);
}

/** Advance the engine by a number of months (30 ticks/month). */
export function advanceMonths(engine: SimulationEngine, months: number): void {
  advanceTicks(engine, months * TICKS_PER_MONTH);
}

/** Advance the engine by a number of years (360 ticks/year). */
export function advanceYears(engine: SimulationEngine, years: number): void {
  advanceTicks(engine, years * TICKS_PER_YEAR);
}

// ─── Snapshot Helpers ───────────────────────────────────────────────────────

/** Get the current resource snapshot. Throws if resource entity missing. */
export function getResources(): Resources {
  const entity = getResourceEntity();
  if (!entity) throw new Error('[helpers] Resource entity not found');
  return entity.resources;
}

/** Get the current game date from meta entity. */
export function getDate(): { year: number; month: number; tick: number } {
  const meta = getMetaEntity();
  if (!meta) throw new Error('[helpers] Meta entity not found');
  return meta.gameMeta.date;
}

/** Check if the game has ended. */
export function isGameOver(): boolean {
  const meta = getMetaEntity();
  return meta?.gameMeta.gameOver != null;
}

/** Get the game over reason, or null if game is still running. */
export function getGameOverReason(): string | null {
  const meta = getMetaEntity();
  return meta?.gameMeta.gameOver?.reason ?? null;
}

/** Count all building entities in the world (including under construction). */
export function getBuildingCount(): number {
  return world.with('building', 'isBuilding').entities.length;
}

/** Count only operational (complete) buildings. */
export function getOperationalBuildingCount(): number {
  return operationalBuildings.entities.length;
}

// ─── Invariant Checkers ─────────────────────────────────────────────────────

/**
 * Assert that all resource values are non-negative.
 * Call at checkpoints to catch resource underflow bugs.
 */
export function assertResourceInvariants(): void {
  const r = getResources();
  expect(r.food).toBeGreaterThanOrEqual(0);
  expect(r.vodka).toBeGreaterThanOrEqual(0);
  expect(r.money).toBeGreaterThanOrEqual(0);
  expect(r.population).toBeGreaterThanOrEqual(0);
  expect(r.power).toBeGreaterThanOrEqual(0);
  expect(r.timber).toBeGreaterThanOrEqual(0);
  expect(r.steel).toBeGreaterThanOrEqual(0);
  expect(r.cement).toBeGreaterThanOrEqual(0);
}

/**
 * Assert that meta values are within valid ranges.
 */
export function assertMetaInvariants(): void {
  const date = getDate();
  expect(date.year).toBeGreaterThanOrEqual(1917);
  expect(date.month).toBeGreaterThanOrEqual(1);
  expect(date.month).toBeLessThanOrEqual(12);
  expect(date.tick).toBeGreaterThanOrEqual(0);
}

// ─── Settlement Builders ────────────────────────────────────────────────────

interface BasicSettlementOptions {
  housing?: number;
  farms?: number;
  power?: number;
}

/**
 * Place instantly-operational buildings for tests that don't care about construction.
 * Spaces buildings 2 tiles apart to avoid footprint overlap.
 *
 * Returns arrays of placed building entities.
 */
export function buildBasicSettlement(options: BasicSettlementOptions = {}): {
  housing: Entity[];
  farms: Entity[];
  power: Entity[];
} {
  const { housing = 1, farms = 1, power = 1 } = options;
  const result = { housing: [] as Entity[], farms: [] as Entity[], power: [] as Entity[] };
  let nextX = 0;

  for (let i = 0; i < power; i++) {
    result.power.push(createBuilding(nextX, 0, 'power-station'));
    nextX += 2;
  }
  for (let i = 0; i < housing; i++) {
    result.housing.push(createBuilding(nextX, 0, 'apartment-tower-a'));
    nextX += 2;
  }
  for (let i = 0; i < farms; i++) {
    result.farms.push(createBuilding(nextX, 0, 'collective-farm-hq'));
    nextX += 2;
  }

  return result;
}

/**
 * Build a full economy: power + housing + farm + distillery + warehouse.
 * All buildings are instantly operational.
 */
export function buildFullEconomy(): void {
  createBuilding(0, 0, 'power-station');
  createBuilding(2, 0, 'apartment-tower-a');
  createBuilding(4, 0, 'collective-farm-hq');
  createBuilding(6, 0, 'vodka-distillery');
  createBuilding(8, 0, 'warehouse');
}

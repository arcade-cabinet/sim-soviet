/**
 * Per-settlement runtime state.
 *
 * Each settlement has its own grid, pressure system, resource snapshot,
 * and population mode. The active settlement uses the real ECS world;
 * background settlements tick with aggregate state only.
 */

import type { PressureSystem } from '../../ai/agents/crisis/pressure/PressureSystem';
import { PressureSystem as PressureSystemClass } from '../../ai/agents/crisis/pressure/PressureSystem';
import type { PressureStateSaveData } from '../../ai/agents/crisis/pressure/PressureDomains';
import type { Settlement } from '../relocation/Settlement';
import { GameGrid } from '../GameGrid';
import type { GameRng } from '../SeedSystem';

/** Lightweight resource snapshot for background settlements (no ECS). */
export interface SettlementResources {
  population: number;
  food: number;
  money: number;
  vodka: number;
  power: number;
  timber: number;
  steel: number;
  cement: number;
  oxygen: number;
  hydrogen: number;
  water: number;
  rareEarths: number;
  uranium: number;
  rocketFuel: number;
}

function createDefaultResources(): SettlementResources {
  return {
    population: 0,
    food: 0,
    money: 0,
    vodka: 0,
    power: 0,
    timber: 0,
    steel: 0,
    cement: 0,
    oxygen: 0,
    hydrogen: 0,
    water: 0,
    rareEarths: 0,
    uranium: 0,
    rocketFuel: 0,
  };
}

/** Per-settlement runtime — owns grid, pressure, resources. */
export interface SettlementRuntime {
  /** Settlement metadata (from SettlementRegistry). */
  settlement: Settlement;
  /** Spatial grid for this settlement. */
  grid: GameGrid;
  /** Per-settlement pressure accumulation. */
  pressureSystem: PressureSystem;
  /** Population mode (entity or aggregate). Background settlements are always aggregate. */
  populationMode: 'entity' | 'aggregate';
  /** Resource snapshot — for active settlement, synced from ECS each tick. */
  resources: SettlementResources;
  /** Total building count (for background settlements where no ECS entities exist). */
  buildingCount: number;
  /** Housing capacity (for background settlements). */
  housingCapacity: number;
}

/** Serialized form for save/load. */
export interface SettlementRuntimeSaveData {
  settlementId: string;
  populationMode: 'entity' | 'aggregate';
  resources: SettlementResources;
  buildingCount: number;
  housingCapacity: number;
  pressureState: PressureStateSaveData;
}

/** Create a fresh SettlementRuntime for a settlement. */
export function createSettlementRuntime(
  settlement: Settlement,
  _rng: GameRng,
): SettlementRuntime {
  return {
    settlement,
    grid: new GameGrid(settlement.gridSize),
    pressureSystem: new PressureSystemClass(),
    populationMode: 'entity',
    resources: createDefaultResources(),
    buildingCount: 0,
    housingCapacity: 0,
  };
}

/** Serialize a runtime for save persistence. */
export function serializeRuntime(
  runtime: SettlementRuntime,
): SettlementRuntimeSaveData {
  return {
    settlementId: runtime.settlement.id,
    populationMode: runtime.populationMode,
    resources: { ...runtime.resources },
    buildingCount: runtime.buildingCount,
    housingCapacity: runtime.housingCapacity,
    pressureState: runtime.pressureSystem.serialize(),
  };
}

/** Restore a runtime from saved data. Requires the Settlement from the registry. */
export function restoreRuntime(
  data: SettlementRuntimeSaveData,
  settlement: Settlement,
  rng: GameRng,
): SettlementRuntime {
  const runtime = createSettlementRuntime(settlement, rng);
  runtime.populationMode = data.populationMode;
  runtime.resources = { ...data.resources };
  runtime.buildingCount = data.buildingCount;
  runtime.housingCapacity = data.housingCapacity;
  runtime.pressureSystem.restore(data.pressureState);
  return runtime;
}

/**
 * @module config/prestigeProjects
 *
 * Era-locked prestige project definitions. Each era has one grand project
 * that Moscow may mandate. Completing a prestige project yields political
 * capital and morale; failure risks arrest.
 */

import type { EraId } from '../game/era/types';

/** A prestige project that can be mandated during a specific era. */
export interface PrestigeProject {
  /** Unique identifier for this project. */
  id: string;
  /** Display name shown in UI. */
  name: string;
  /** Era this project is locked to. */
  era: EraId;
  /** Resource cost to complete the project. */
  cost: { money: number; food?: number; power?: number };
  /** How many in-game years the project takes to complete. */
  durationYears: number;
  /** Building defIds that must exist before this project can start. */
  requiredBuildings: string[];
  /** Rewards granted on successful completion. */
  reward: { politicalCapital: number; moraleBoost: number; specialBuilding?: string };
  /** Penalties applied on failure. */
  failurePenalty: { politicalCapitalLoss: number; arrestRisk: number };
}

/** One prestige project per historical era, keyed by EraId. */
export const PRESTIGE_PROJECTS: Readonly<Partial<Record<EraId, PrestigeProject>>> = {
  revolution: {
    id: 'monument-to-revolution',
    name: 'Monument to Revolution',
    era: 'revolution',
    cost: { money: 300 },
    durationYears: 2,
    requiredBuildings: ['government-hq'],
    reward: { politicalCapital: 10, moraleBoost: 5, specialBuilding: 'monument-revolution' },
    failurePenalty: { politicalCapitalLoss: 5, arrestRisk: 0.05 },
  },

  collectivization: {
    id: 'grain-elevator-complex',
    name: 'Grain Elevator Complex',
    era: 'collectivization',
    cost: { money: 800, food: 200 },
    durationYears: 3,
    requiredBuildings: ['collective-farm-hq', 'warehouse'],
    reward: { politicalCapital: 15, moraleBoost: 5, specialBuilding: 'grain-elevator' },
    failurePenalty: { politicalCapitalLoss: 10, arrestRisk: 0.1 },
  },

  industrialization: {
    id: 'grand-factory-complex',
    name: 'Grand Factory Complex',
    era: 'industrialization',
    cost: { money: 3000, power: 50 },
    durationYears: 4,
    requiredBuildings: ['factory-office', 'power-station'],
    reward: { politicalCapital: 25, moraleBoost: 8, specialBuilding: 'grand-factory' },
    failurePenalty: { politicalCapitalLoss: 15, arrestRisk: 0.15 },
  },

  great_patriotic: {
    id: 'victory-memorial',
    name: 'Victory Memorial',
    era: 'great_patriotic',
    cost: { money: 3000 },
    durationYears: 2,
    requiredBuildings: ['government-hq'],
    reward: { politicalCapital: 20, moraleBoost: 15 },
    failurePenalty: { politicalCapitalLoss: 10, arrestRisk: 0.1 },
  },

  reconstruction: {
    id: 'palace-of-soviets',
    name: 'Palace of Soviets',
    era: 'reconstruction',
    cost: { money: 8000, power: 100 },
    durationYears: 5,
    requiredBuildings: ['government-hq', 'ministry-office', 'train-station'],
    reward: { politicalCapital: 40, moraleBoost: 12, specialBuilding: 'palace-of-soviets' },
    failurePenalty: { politicalCapitalLoss: 25, arrestRisk: 0.2 },
  },

  thaw_and_freeze: {
    id: 'all-union-radio-relay',
    name: 'All-Union Radio Relay',
    era: 'thaw_and_freeze',
    cost: { money: 9000, power: 120 },
    durationYears: 4,
    requiredBuildings: ['power-station', 'radio-station', 'post-office'],
    reward: { politicalCapital: 40, moraleBoost: 15, specialBuilding: 'radio-station' },
    failurePenalty: { politicalCapitalLoss: 25, arrestRisk: 0.2 },
  },

  stagnation: {
    id: 'olympic-village',
    name: 'Olympic Village',
    era: 'stagnation',
    cost: { money: 20000, power: 150 },
    durationYears: 5,
    requiredBuildings: ['cultural-palace', 'hospital', 'apartment-tower-d'],
    reward: { politicalCapital: 45, moraleBoost: 18, specialBuilding: 'olympic-village' },
    failurePenalty: { politicalCapitalLoss: 35, arrestRisk: 0.3 },
  },
};

/** Retrieve the prestige project for a given era, or undefined if not found. */
export function getPrestigeProject(era: EraId): PrestigeProject | undefined {
  return PRESTIGE_PROJECTS[era];
}

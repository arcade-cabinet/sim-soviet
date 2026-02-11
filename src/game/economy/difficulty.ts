/**
 * @module game/economy/difficulty
 *
 * Difficulty multipliers, starting resources, and related calculations.
 */

import type {
  BaseResources,
  DifficultyLevel,
  DifficultyMultipliers,
  EraId,
  ExtendedResources,
} from './types';

/**
 * Full difficulty multiplier tables.
 *
 * Worker: A gentle introduction. The state is almost kind.
 * Comrade: Standard Soviet experience. Challenging but survivable.
 * Tovarish: Maximum authentic suffering. Not recommended for optimists.
 */
export const DIFFICULTY_MULTIPLIERS: Record<DifficultyLevel, DifficultyMultipliers> = {
  worker: {
    quotaTarget: 0.8,
    startingResources: 1.5,
    birthRate: 1.3,
    decayRate: 0.7,
    politruksPer100: 1,
    fondyReliability: 1.2,
    deliveryRate: 0.8,
    eventSeverity: 0.7,
    markDecayRate: 0.7,
    starvationRate: 0.5,
  },
  comrade: {
    quotaTarget: 1.0,
    startingResources: 1.0,
    birthRate: 1.0,
    decayRate: 1.0,
    politruksPer100: 2,
    fondyReliability: 1.0,
    deliveryRate: 1.0,
    eventSeverity: 1.0,
    markDecayRate: 1.0,
    starvationRate: 1.0,
  },
  tovarish: {
    quotaTarget: 1.3,
    startingResources: 0.7,
    birthRate: 0.7,
    decayRate: 1.5,
    politruksPer100: 4,
    fondyReliability: 0.8,
    deliveryRate: 1.3,
    eventSeverity: 1.5,
    markDecayRate: 1.5,
    starvationRate: 1.5,
  },
};

const BASE_STARTING: Record<string, number> = {
  money: 2000,
  food: 600,
  vodka: 50,
  power: 0,
  powerUsed: 0,
  population: 12,
  timber: 30,
  steel: 10,
  paperwork: 5,
};

export const DIFFICULTY_RESOURCE_MULT: Record<DifficultyLevel, number> = {
  worker: 1.5,
  comrade: 1.0,
  tovarish: 0.7,
};

export const ERA_RESOURCE_MULT: Record<EraId, number> = {
  revolution: 0.8,
  industrialization: 1.0,
  wartime: 0.6,
  reconstruction: 0.9,
  thaw: 1.2,
  stagnation: 1.0,
  perestroika: 0.8,
  eternal: 0.9,
};

/**
 * Get the full difficulty multiplier set for a given difficulty level.
 */
export function getDifficultyMultipliers(difficulty: DifficultyLevel): DifficultyMultipliers {
  return { ...DIFFICULTY_MULTIPLIERS[difficulty] };
}

/**
 * Calculate starting resources for a new game based on difficulty, era, and map size.
 *
 * Easier difficulties get more resources. Earlier eras get less.
 * Larger maps get a modest bonus because there's more ground to cover
 * (and more ground for things to go wrong).
 *
 * @param difficulty  Game difficulty level
 * @param era         Starting era
 * @param mapSize     Grid dimension (e.g. 30 for 30x30)
 * @returns Combined base + extended resources
 */
export function calculateStartingResources(
  difficulty: DifficultyLevel,
  era: EraId,
  mapSize: number
): BaseResources & ExtendedResources {
  const diffMult = DIFFICULTY_RESOURCE_MULT[difficulty];
  const eraMult = ERA_RESOURCE_MULT[era];
  const sizeMult = mapSize / 30; // Normalize to default 30x30

  const scale = (key: string): number => {
    const base = BASE_STARTING[key] ?? 0;
    return Math.round(base * diffMult * eraMult * sizeMult);
  };

  return {
    money: scale('money'),
    food: scale('food'),
    vodka: scale('vodka'),
    power: scale('power'),
    powerUsed: scale('powerUsed'),
    population: scale('population'),
    timber: scale('timber'),
    steel: scale('steel'),
    paperwork: scale('paperwork'),
  };
}

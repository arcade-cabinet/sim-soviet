/**
 * @module game/economy/chains
 *
 * Multi-step production chain definitions.
 */

import type { ProductionChain } from './types';

/**
 * Multi-step production chains.
 *
 * Each chain models the real (simplified) Soviet production pipeline.
 * Note that the kolkhoz produces grain, which must then be processed
 * by a factory or vodka plant. Nothing is simple in a planned economy.
 */
export const PRODUCTION_CHAINS: ProductionChain[] = [
  {
    id: 'bread',
    name: 'Bread Production',
    steps: [
      {
        building: 'kolkhoz-hq',
        input: {},
        output: { grain: 5 },
        ticksRequired: 3,
      },
      {
        building: 'factory',
        input: { grain: 5 },
        output: { food: 8 },
        ticksRequired: 2,
      },
    ],
  },
  {
    id: 'vodka',
    name: 'Vodka Production',
    steps: [
      {
        building: 'kolkhoz-hq',
        input: {},
        output: { grain: 5 },
        ticksRequired: 3,
      },
      {
        building: 'vodka-plant',
        input: { grain: 5 },
        output: { vodka: 3 },
        ticksRequired: 4,
      },
    ],
  },
  {
    id: 'steel',
    name: 'Steel Production',
    steps: [
      {
        building: 'coal-plant',
        input: {},
        output: { coal: 4 },
        ticksRequired: 2,
      },
      {
        building: 'factory',
        input: { coal: 4 },
        output: { steel: 2 },
        ticksRequired: 3,
      },
    ],
  },
  {
    id: 'timber',
    name: 'Timber Production',
    steps: [
      {
        building: 'lumber-camp',
        input: {},
        output: { timber: 6 },
        ticksRequired: 2,
      },
    ],
  },
  {
    id: 'paperwork',
    name: 'Paperwork Generation',
    steps: [
      {
        building: 'ministry',
        input: { timber: 1 },
        output: { paperwork: 10 },
        ticksRequired: 1,
      },
    ],
  },
];

/**
 * @module game/economy/fondy
 *
 * Fondy (state allocation) configuration by era.
 */

import type { EraId, TransferableResource } from './types';

/** Base fondy allocations by era. The state promises much and delivers... variably. */
export const FONDY_BY_ERA: Record<
  EraId,
  { allocated: Record<TransferableResource, number>; reliability: number; interval: number }
> = {
  revolution: {
    allocated: { food: 30, vodka: 10, money: 200, steel: 5, timber: 10 },
    reliability: 0.6,
    interval: 60,
  },
  industrialization: {
    allocated: { food: 40, vodka: 15, money: 500, steel: 20, timber: 15 },
    reliability: 0.5,
    interval: 48,
  },
  wartime: {
    allocated: { food: 20, vodka: 5, money: 100, steel: 30, timber: 20 },
    reliability: 0.3,
    interval: 72,
  },
  reconstruction: {
    allocated: { food: 50, vodka: 20, money: 300, steel: 15, timber: 20 },
    reliability: 0.65,
    interval: 48,
  },
  thaw: {
    allocated: { food: 60, vodka: 25, money: 400, steel: 10, timber: 15 },
    reliability: 0.75,
    interval: 36,
  },
  stagnation: {
    allocated: { food: 50, vodka: 30, money: 350, steel: 8, timber: 10 },
    reliability: 0.45,
    interval: 48,
  },
  perestroika: {
    allocated: { food: 40, vodka: 20, money: 250, steel: 5, timber: 8 },
    reliability: 0.35,
    interval: 60,
  },
  eternal: {
    allocated: { food: 45, vodka: 25, money: 300, steel: 7, timber: 10 },
    reliability: 0.4,
    interval: 48,
  },
};

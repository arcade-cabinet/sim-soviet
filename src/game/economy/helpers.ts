/**
 * @module game/economy/helpers
 *
 * Internal helper utilities for transferable resource records.
 */

import type { TransferableResource } from './types';

export function zeroTransferable(): Record<TransferableResource, number> {
  return { food: 0, vodka: 0, money: 0, steel: 0, timber: 0 };
}

export function cloneTransferable(
  r: Record<TransferableResource, number>
): Record<TransferableResource, number> {
  return { food: r.food, vodka: r.vodka, money: r.money, steel: r.steel, timber: r.timber };
}

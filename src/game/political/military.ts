/**
 * @module game/political/military
 *
 * Military, conscription, and orgnabor constants and queue processing.
 */

import type { GameRng } from '@/game/SeedSystem';
import type { ConscriptionEvent, OrgnaborEvent, PoliticalTickResult } from './types';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Default casualty rate for permanent conscription. */
export const WARTIME_CASUALTY_RATE = 0.2;

// ─── Queue Processing ───────────────────────────────────────────────────────

/**
 * Process the conscription queue, drafting workers and scheduling returns.
 * Returns new return-queue entries to be appended.
 */
export function processConscriptionQueue(
  queue: ConscriptionEvent[],
  totalTicks: number,
  rng: GameRng | null,
  result: PoliticalTickResult
): Array<{ returnTick: number; count: number }> {
  const newReturns: Array<{ returnTick: number; count: number }> = [];

  while (queue.length > 0) {
    const event = queue.shift()!;
    const drafted = event.targetCount;
    event.drafted = drafted;

    result.workersConscripted += drafted;
    result.announcements.push(event.announcement);

    // Schedule return if not permanent
    if (event.returnTick !== -1) {
      const returnDuration = rng ? rng.int(180, 360) : 270;
      newReturns.push({
        returnTick: totalTicks + returnDuration,
        count: drafted - event.casualties,
      });
    } else if (event.casualties < drafted) {
      // Wartime: some return eventually
      const survivors = drafted - event.casualties;
      if (survivors > 0) {
        const returnDuration = rng ? rng.int(360, 720) : 540;
        newReturns.push({
          returnTick: totalTicks + returnDuration,
          count: survivors,
        });
      }
    }
  }

  return newReturns;
}

/**
 * Process the orgnabor queue, borrowing workers and scheduling returns.
 * Returns new return-queue entries to be appended.
 */
export function processOrgnaborQueue(
  queue: OrgnaborEvent[],
  totalTicks: number,
  result: PoliticalTickResult
): Array<{ returnTick: number; count: number }> {
  const newReturns: Array<{ returnTick: number; count: number }> = [];

  while (queue.length > 0) {
    const event = queue.shift()!;
    const borrowed = event.borrowedCount;

    result.workersConscripted += borrowed;
    result.announcements.push(event.announcement);

    // Schedule return: returnTick in the queue is the duration, convert to absolute tick
    newReturns.push({
      returnTick: totalTicks + event.returnTick,
      count: borrowed,
    });
  }

  return newReturns;
}

/**
 * Process the return queue, returning workers whose time has come.
 * Returns { returned, remaining } where remaining is the filtered queue.
 */
export function processReturns(
  returnQueue: Array<{ returnTick: number; count: number }>,
  totalTicks: number
): { returned: number; remaining: Array<{ returnTick: number; count: number }> } {
  let returned = 0;
  const remaining: Array<{ returnTick: number; count: number }> = [];

  for (const entry of returnQueue) {
    if (totalTicks >= entry.returnTick) {
      returned += entry.count;
    } else {
      remaining.push(entry);
    }
  }

  return { returned, remaining };
}

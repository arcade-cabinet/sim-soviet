/**
 * ArrivalSequence — staggered family arrival at game start.
 *
 * Instead of spawning all dvory instantly, families arrive over ~30 ticks,
 * 1-2 households per tick. The CollectiveAgent places the Party Barracks
 * immediately, then izbas organically as families arrive.
 *
 * This creates the feeling of a caravan arriving at empty land.
 */

import type { WorkerSystem } from '@/ai/agents/workforce/WorkerSystem';
import { dvory, getResourceEntity } from '@/ecs/archetypes';
import { createDvor, type DvorMemberSeed } from '@/ecs/factories/settlementFactories';

// ── Types ────────────────────────────────────────────────────────────────────

/** A queued household waiting to arrive. */
interface QueuedDvor {
  id: string;
  surname: string;
  memberSeeds: DvorMemberSeed[];
  /** Tick at which this dvor arrives. */
  arrivalTick: number;
  /** Whether this is the chairman's dvor (special loyalty). */
  isChairman?: boolean;
}

/** Serializable state for save/load. */
export interface ArrivalSequenceState {
  /** Whether the arrival is still in progress. */
  inProgress: boolean;
  /** Queued dvory that haven't arrived yet. */
  queue: QueuedDvor[];
  /** Total dvory expected (for progress tracking). */
  totalDvory: number;
  /** Number already arrived. */
  arrivedCount: number;
}

// ── ArrivalSequence ──────────────────────────────────────────────────────────

/**
 * Manages the staggered arrival of starting families.
 *
 * Usage:
 *   1. Call `prepareArrival()` instead of `createStartingSettlement()`
 *   2. Call `tick()` each simulation tick — it spawns families on schedule
 *   3. Check `isInProgress()` to know when the caravan has fully arrived
 */
export class ArrivalSequence {
  private queue: QueuedDvor[] = [];
  private totalDvory = 0;
  private arrivedCount = 0;
  private inProgress = false;

  /** Whether families are still arriving. */
  isInProgress(): boolean {
    return this.inProgress;
  }

  /** How many families have arrived so far. */
  getArrivedCount(): number {
    return this.arrivedCount;
  }

  /** Total families expected. */
  getTotalDvory(): number {
    return this.totalDvory;
  }

  /**
   * Prepare the arrival queue from settlement factory data.
   * This replaces the instant `createStartingSettlement()` call.
   *
   * Families are scheduled to arrive 1-2 per tick over ~30 ticks.
   * The chairman arrives first (tick 0).
   */
  prepareArrival(
    dvorData: Array<{ id: string; surname: string; memberSeeds: DvorMemberSeed[]; isChairman?: boolean }>,
  ): void {
    this.queue = [];
    this.arrivedCount = 0;
    this.inProgress = true;

    // Chairman arrives on tick 1 (first tick after game starts)
    // Remaining families arrive staggered: 1-2 per tick over ~30 ticks
    let currentTick = 1;
    for (const data of dvorData) {
      if (data.isChairman) {
        this.queue.push({ ...data, arrivalTick: 1 });
        continue;
      }
      this.queue.push({ ...data, arrivalTick: currentTick });
      // Alternate between 1 and 2 families per tick (average ~1.5)
      currentTick += this.queue.length % 3 === 0 ? 1 : 2;
    }

    this.totalDvory = dvorData.length;

    // Sort by arrival tick for efficient processing
    this.queue.sort((a, b) => a.arrivalTick - b.arrivalTick);
  }

  /**
   * Process arrivals for the current tick.
   * Creates dvor entities and spawns citizen entities for arriving families.
   *
   * @param currentTick - Current simulation tick (from chronology)
   * @param workerSystem - For spawning citizen entities from dvor members
   * @param onArrival - Callback when a family arrives (for toast messages)
   * @returns Number of families that arrived this tick
   */
  tick(
    currentTick: number,
    workerSystem: WorkerSystem,
    onArrival?: (surname: string, memberCount: number) => void,
  ): number {
    if (!this.inProgress) return 0;

    let arrivedThisTick = 0;

    while (this.queue.length > 0 && this.queue[0]!.arrivalTick <= currentTick) {
      const next = this.queue.shift()!;

      // Create the dvor entity
      const entity = createDvor(next.id, next.surname, next.memberSeeds);

      // Apply chairman special stats
      if (next.isChairman && entity.dvor) {
        entity.dvor.loyaltyToCollective = 100;
        entity.dvor.privatePlotSize = 0;
        entity.dvor.privateLivestock = { cow: 0, pig: 0, sheep: 0, poultry: 0 };
      } else if (entity.dvor) {
        // Hopeful revolutionaries — higher morale than default
        entity.dvor.loyaltyToCollective = 60;
      }

      // Spawn citizen entities for this dvor's members
      // Hopeful revolutionaries — morale 70, loyalty 60
      const dvor = entity.dvor;
      if (dvor) {
        for (const member of dvor.members) {
          workerSystem.spawnWorkerFromDvor(member, dvor.id, undefined, undefined, { morale: 70, loyalty: 60 });
        }
      }

      // Update population count
      const store = getResourceEntity();
      if (store) {
        let pop = 0;
        for (const d of dvory) {
          pop += d.dvor.members.length;
        }
        store.resources.population = pop;
      }

      this.arrivedCount++;
      arrivedThisTick++;
      onArrival?.(next.surname, next.memberSeeds.length);
    }

    // Check if arrival is complete
    if (this.queue.length === 0) {
      this.inProgress = false;
    }

    return arrivedThisTick;
  }

  // ── Serialization ────────────────────────────────────────────────────────

  getState(): ArrivalSequenceState {
    return {
      inProgress: this.inProgress,
      queue: [...this.queue],
      totalDvory: this.totalDvory,
      arrivedCount: this.arrivedCount,
    };
  }

  loadState(state: ArrivalSequenceState): void {
    this.inProgress = state.inProgress;
    this.queue = [...state.queue];
    this.totalDvory = state.totalDvory;
    this.arrivedCount = state.arrivedCount;
  }
}

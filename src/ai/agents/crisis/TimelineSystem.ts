/**
 * @module ai/agents/crisis/TimelineSystem
 *
 * In-memory timeline manager for tracking crisis events and divergence points.
 *
 * Used by both governor modes:
 * - HistoricalGovernor: records historical events as they fire
 * - FreeformGovernor: records generated events, queries history for chaos engine input
 *
 * DB persistence is handled separately by the save/load system (Task 7.1).
 */

import type { CrisisType } from './types';

// ─── Types ──────────────────────────────────────────────────────────────────

/** A recorded crisis event on the timeline. */
export interface TimelineEvent {
  /** Unique event identifier. */
  eventId: string;
  /** Crisis category. */
  crisisType: CrisisType;
  /** Human-readable name. */
  name: string;
  /** Year the crisis begins. */
  startYear: number;
  /** Year the crisis ends. */
  endYear: number;
  /** Whether this is a real historical event (vs. generated/divergent). */
  isHistorical: boolean;
  /** Agent-specific parameters at recording time. */
  parameters?: Record<string, unknown>;
  /** Observed outcomes after resolution. */
  outcomes?: Record<string, unknown>;
  /** Parent event ID for causal chains. */
  parentEventId?: string;
  /** Player decision that caused divergence from history. */
  divergenceDecision?: string;
  /** Simulation tick when this event was recorded. */
  recordedTick: number;
}

/** A point where the player's timeline diverged from history. */
export interface DivergencePoint {
  /** Year of divergence. */
  year: number;
  /** Month of divergence (1-12). */
  month: number;
  /** Description of what historically happened. */
  historicalContext: string;
  /** What the player chose instead. */
  playerChoice: string;
  /** Optional snapshot of game state at divergence. */
  stateSnapshot?: Record<string, unknown>;
  /** Simulation tick when divergence occurred. */
  divergenceTick: number;
}

/** Filter criteria for querying timeline events. All conditions are ANDed. */
export interface TimelineFilter {
  /** Match exact crisis type. */
  crisisType?: CrisisType;
  /** Match events overlapping this year range. */
  yearRange?: { start: number; end: number };
  /** Match historical or non-historical events. */
  isHistorical?: boolean;
  /** Match events with this parent. */
  parentEventId?: string;
}

/** Serialized timeline state for save/load. */
export interface TimelineSystemSaveData {
  events: TimelineEvent[];
  divergencePoints: DivergencePoint[];
}

// ─── TimelineSystem ─────────────────────────────────────────────────────────

/**
 * In-memory timeline manager tracking crisis events and divergence points.
 *
 * @param event - Crisis event to record
 * @param point - Divergence point to record
 * @param filter - Query filter with AND logic
 */
export class TimelineSystem {
  private events: TimelineEvent[] = [];
  private divergences: DivergencePoint[] = [];

  /** Record a crisis event (historical or generated). */
  recordEvent(event: TimelineEvent): void {
    this.events.push(event);
  }

  /** Record a divergence point (Freeform mode). */
  recordDivergence(point: DivergencePoint): void {
    this.divergences.push(point);
  }

  /** Query events by filter criteria. Multiple filters use AND logic. */
  queryEvents(filter: TimelineFilter): TimelineEvent[] {
    return this.events.filter((e) => {
      if (filter.crisisType !== undefined && e.crisisType !== filter.crisisType) {
        return false;
      }
      if (filter.yearRange !== undefined) {
        if (e.startYear > filter.yearRange.end || e.endYear < filter.yearRange.start) {
          return false;
        }
      }
      if (filter.isHistorical !== undefined && e.isHistorical !== filter.isHistorical) {
        return false;
      }
      if (filter.parentEventId !== undefined && e.parentEventId !== filter.parentEventId) {
        return false;
      }
      return true;
    });
  }

  /**
   * Follow parentEventId links to build a causal chain.
   *
   * Returns the chain from root ancestor to the queried event (chronological order).
   * Returns empty array if eventId is not found.
   */
  getCausalChain(eventId: string): TimelineEvent[] {
    const chain: TimelineEvent[] = [];
    let currentId: string | undefined = eventId;

    while (currentId !== undefined) {
      const event = this.events.find((e) => e.eventId === currentId);
      if (!event) break;
      chain.push(event);
      currentId = event.parentEventId;
    }

    // Reverse to get root → leaf order (chronological)
    chain.reverse();
    return chain;
  }

  /** Get all non-historical (divergent) events for chaos engine input. */
  getDivergentHistory(): TimelineEvent[] {
    return this.events.filter((e) => !e.isHistorical);
  }

  /** Get all recorded events. */
  getAllEvents(): TimelineEvent[] {
    return [...this.events];
  }

  /** Get all divergence points. */
  getDivergencePoints(): DivergencePoint[] {
    return [...this.divergences];
  }

  /** Clear all data (for game reset). */
  clear(): void {
    this.events = [];
    this.divergences = [];
  }

  /** Serialize timeline state for save persistence. */
  serialize(): TimelineSystemSaveData {
    return {
      events: [...this.events],
      divergencePoints: [...this.divergences],
    };
  }

  /** Restore timeline state from saved data. */
  restore(data: TimelineSystemSaveData): void {
    this.events = [...data.events];
    this.divergences = [...data.divergencePoints];
  }
}

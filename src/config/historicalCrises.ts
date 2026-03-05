/**
 * @module config/historicalCrises
 *
 * Static database of ~25-30 real Soviet historical crises (1918-1991).
 * Each entry is a CrisisDefinition used by the HistoricalGovernor to
 * schedule crises on their historical dates.
 *
 * Data is stored in historicalCrises.json; this module re-exports it
 * with proper TypeScript typing.
 *
 * TICKS_PER_YEAR = 12 (monthly ticks). buildupTicks and aftermathTicks
 * are expressed in this unit.
 */

import type { CrisisDefinition } from '@/ai/agents/crisis/types';
import crisisData from './historicalCrises.json';

// ─── Historical Crisis Definitions ──────────────────────────────────────────

export const HISTORICAL_CRISES: readonly CrisisDefinition[] =
  crisisData as unknown as readonly CrisisDefinition[];

// ─── Lookup ─────────────────────────────────────────────────────────────────

/** Map for O(1) crisis lookup by ID. */
const crisisById = new Map<string, CrisisDefinition>(HISTORICAL_CRISES.map((c) => [c.id, c]));

/**
 * Returns the CrisisDefinition for the given ID, or undefined if not found.
 * @param id - Unique crisis identifier (e.g. 'holodomor', 'chernobyl').
 */
export function getCrisisById(id: string): CrisisDefinition | undefined {
  return crisisById.get(id);
}

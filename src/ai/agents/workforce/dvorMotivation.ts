/**
 * @module ai/agents/workforce/dvorMotivation
 *
 * DvorMotivationSystem — drives unhoused dvory toward nearest housing with capacity.
 *
 * Soviet Maslow's hierarchy:
 *   1. Shelter (highest priority — displaced dvory seek housing)
 *   2. Food (hungry dvory need rations — handled by consumption system)
 *   3. Party (loyalty to the collective — all needs met)
 *
 * Runs per-tick for displaced dvory in entity mode. Each tick, a displaced
 * dvor either moves toward the nearest housing with capacity, gets absorbed
 * into that housing if adjacent, or waits if no housing is available.
 */

import type { BuildingComponent, Position } from '@/ecs/world';

// ─── Types ───────────────────────────────────────────────────────────────────

/** State of a dvor for motivation evaluation. */
export interface DvorState {
  /** Unique dvor ID */
  dvorId: string;
  /** Current grid position */
  position: Position;
  /** Whether this dvor has no housing assignment */
  isDisplaced: boolean;
  /** Number of family members */
  householdSize: number;
  /** Food satisfaction 0-1 (0 = starving, 1 = fed) */
  foodLevel: number;
  /** Shelter satisfaction 0-1 (0 = homeless, 1 = fully sheltered) */
  shelterLevel: number;
}

/** Result of one tick of motivation processing. */
export interface MotivationResult {
  /** Action for this tick */
  action: 'move' | 'absorb' | 'wait';
  /** Target position (housing location) — set for move and absorb */
  target?: Position;
}

/** A building entry with position, used for spatial housing queries. */
export interface HousingEntry {
  position: Position;
  building: BuildingComponent;
}

// ─── Thresholds ──────────────────────────────────────────────────────────────

/** Shelter level below which shelter is the dominant need. */
const SHELTER_THRESHOLD = 0.5;

/** Food level below which food becomes the dominant need (when sheltered). */
const FOOD_THRESHOLD = 0.3;

/** Grid distance at which a dvor is considered "arrived" at housing. */
const ARRIVAL_DISTANCE = 1.5;

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Evaluates the most pressing need of a dvor using Soviet Maslow's hierarchy.
 *
 * @param dvor - Current dvor state
 * @returns The dominant need: 'shelter', 'food', or 'party'
 */
export function evaluateNeeds(dvor: DvorState): 'shelter' | 'food' | 'party' {
  // Shelter is always the top priority
  if (dvor.shelterLevel < SHELTER_THRESHOLD) {
    return 'shelter';
  }

  // Food is second priority
  if (dvor.foodLevel < FOOD_THRESHOLD) {
    return 'food';
  }

  // All basic needs met — serve the party
  return 'party';
}

/**
 * Finds the nearest housing building with available capacity.
 *
 * @param position - Current grid position to search from
 * @param buildings - All housing buildings to consider
 * @returns The nearest housing entry with capacity, or null if none available
 */
export function findNearestHousing(position: Position, buildings: readonly HousingEntry[]): HousingEntry | null {
  let nearest: HousingEntry | null = null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const entry of buildings) {
    // Skip buildings at capacity
    const remaining = entry.building.housingCap - entry.building.residentCount;
    if (remaining <= 0) continue;

    const dx = entry.position.gridX - position.gridX;
    const dy = entry.position.gridY - position.gridY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < bestDist) {
      bestDist = dist;
      nearest = entry;
    }
  }

  return nearest;
}

/**
 * Processes one tick of motivation for a dvor.
 *
 * - Non-displaced dvory always wait (already housed).
 * - Displaced dvory with shelter need seek nearest housing.
 * - If adjacent to housing, absorb into it.
 * - If no housing available, wait.
 *
 * @param dvor - Current dvor state
 * @param buildings - Available housing buildings
 * @returns Motivation result with action and optional target
 */
export function tickMotivation(dvor: DvorState, buildings: readonly HousingEntry[]): MotivationResult {
  // Non-displaced dvory have no spatial motivation
  if (!dvor.isDisplaced) {
    return { action: 'wait' };
  }

  const need = evaluateNeeds(dvor);

  // Only shelter need triggers spatial movement toward housing
  if (need !== 'shelter') {
    return { action: 'wait' };
  }

  // Find nearest housing with capacity
  const target = findNearestHousing(dvor.position, buildings);
  if (!target) {
    return { action: 'wait' };
  }

  // Check if close enough to absorb
  const dx = target.position.gridX - dvor.position.gridX;
  const dy = target.position.gridY - dvor.position.gridY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist <= ARRIVAL_DISTANCE) {
    return { action: 'absorb', target: target.position };
  }

  // Move toward housing
  return { action: 'move', target: target.position };
}

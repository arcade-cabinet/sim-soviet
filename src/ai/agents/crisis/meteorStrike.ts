/**
 * @module ai/agents/crisis/meteorStrike
 *
 * Meteor strike crisis — extremely rare random event that destroys tiles
 * in a blast radius and leaves behind a resource deposit that can be
 * converted into an open-pit mine.
 *
 * All functions are pure and use GameRng for deterministic randomness.
 */

import type { GameRng } from '@/game/SeedSystem';

// ─── Types ───────────────────────────────────────────────────────────────────

/** A meteor strike event produced by rollMeteorStrike. */
export interface MeteorEvent {
  /** Game year the strike occurs. */
  year: number;
  /** Grid X coordinate of impact center. */
  targetX: number;
  /** Grid Y coordinate of impact center. */
  targetY: number;
  /** Strike magnitude (1-5). Higher = bigger crater, richer deposit. */
  magnitude: number;
}

/** Result of applying a meteor impact to the grid. */
export interface ImpactResult {
  /** Center of the crater. */
  crater: { x: number; y: number };
  /** Radius of destruction in tiles. */
  damageRadius: number;
  /** All tiles destroyed by the impact (within damageRadius). */
  destroyedTiles: Array<{ x: number; y: number }>;
  /** Resource deposit revealed by the impact. */
  resourceDeposit: 'iron' | 'coal' | 'uranium';
}

/** Result of converting a crater into a mine. */
export interface MineConversion {
  /** Building type to place at the crater. */
  buildingType: 'open_pit_mine';
  /** Resource the mine produces. */
  resource: string;
  /** Production capacity of the mine (units per tick). */
  capacity: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Base probability of a meteor strike per roll (~0.1%). */
const BASE_CHANCE = 0.001;

/** Multiplier for eternal/freeform mode (post-1991). */
const ETERNAL_MULTIPLIER = 1.5;

/** Year threshold above which the eternal multiplier applies. */
const ETERNAL_YEAR_THRESHOLD = 1991;

/** Resource deposit probabilities (cumulative thresholds). */
const RESOURCE_THRESHOLDS: Array<{ threshold: number; resource: 'iron' | 'coal' | 'uranium' }> = [
  { threshold: 0.5, resource: 'iron' },
  { threshold: 0.85, resource: 'coal' },
  { threshold: 1.0, resource: 'uranium' },
];

/** Base capacity per unit of damage radius, by resource type. */
const CAPACITY_BY_RESOURCE: Record<string, number> = {
  iron: 50,
  coal: 40,
  uranium: 20,
};

// ─── rollMeteorStrike ────────────────────────────────────────────────────────

/**
 * Roll for a meteor strike. Very rare (~0.1% per call), slightly higher
 * in freeform eternal mode (year > 1991).
 *
 * @param rng - Seeded RNG instance
 * @param year - Current game year
 * @returns MeteorEvent if a strike occurs, null otherwise
 */
export function rollMeteorStrike(rng: GameRng, year: number): MeteorEvent | null {
  const chance = year > ETERNAL_YEAR_THRESHOLD ? BASE_CHANCE * ETERNAL_MULTIPLIER : BASE_CHANCE;

  if (rng.random() >= chance) {
    return null;
  }

  // Strike occurs — determine parameters
  const magnitude = rng.int(1, 5);
  const targetX = rng.int(0, 29);
  const targetY = rng.int(0, 29);

  return { year, targetX, targetY, magnitude };
}

// ─── applyMeteorImpact ──────────────────────────────────────────────────────

/**
 * Apply a meteor impact at the given grid coordinates.
 * Calculates blast radius, destroyed tiles, and resource deposit.
 *
 * @param targetX - Grid X of impact center
 * @param targetY - Grid Y of impact center
 * @param gridSize - Size of the game grid (tiles per side)
 * @returns ImpactResult with crater, destroyed tiles, and resource deposit
 */
export function applyMeteorImpact(targetX: number, targetY: number, gridSize: number): ImpactResult {
  // Damage radius: 1-3 tiles based on a simple hash of position
  // (deterministic without needing RNG — pure function of inputs)
  const damageRadius = 1 + ((targetX * 7 + targetY * 13) % 3);

  // Collect destroyed tiles within damage radius, clamped to grid bounds
  const destroyedTiles: Array<{ x: number; y: number }> = [];
  const r = damageRadius;
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= r) {
        const tx = targetX + dx;
        const ty = targetY + dy;
        if (tx >= 0 && tx < gridSize && ty >= 0 && ty < gridSize) {
          destroyedTiles.push({ x: tx, y: ty });
        }
      }
    }
  }

  // Determine resource deposit based on position hash
  const resourceRoll = ((targetX * 31 + targetY * 17 + 7) % 100) / 100;
  let resourceDeposit: 'iron' | 'coal' | 'uranium' = 'iron';
  for (const entry of RESOURCE_THRESHOLDS) {
    if (resourceRoll < entry.threshold) {
      resourceDeposit = entry.resource;
      break;
    }
  }

  return {
    crater: { x: targetX, y: targetY },
    damageRadius,
    destroyedTiles,
    resourceDeposit,
  };
}

// ─── convertCraterToMine ─────────────────────────────────────────────────────

/**
 * Convert a meteor crater into an open-pit mine.
 *
 * @param impact - The ImpactResult from applyMeteorImpact
 * @returns MineConversion with building type, resource, and capacity
 */
export function convertCraterToMine(impact: ImpactResult): MineConversion {
  const baseCapacity = CAPACITY_BY_RESOURCE[impact.resourceDeposit] ?? 30;
  const capacity = baseCapacity * impact.damageRadius;

  return {
    buildingType: 'open_pit_mine',
    resource: impact.resourceDeposit,
    capacity,
  };
}

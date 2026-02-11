/**
 * @module ecs/systems/storageSystem
 *
 * STORAGE & SPOILAGE SYSTEM
 * ==========================
 * Resources don't stockpile infinitely. Storage buildings have capacity
 * limits. Food beyond capacity spoils.
 *
 * Spoilage rules (from economy.md):
 * - Base spoilage: food beyond storage capacity decays at 5% per tick
 * - Stored food: decays at 0.5% per tick (granary) or 0.1% per tick (elevator)
 * - Seasonal modifier: summer spoilage x2.0, winter x0.3
 * - Timber: does not spoil (fire events handled elsewhere)
 * - Steel/cement: does not spoil
 * - Vodka: NEVER spoils (historically accurate)
 */

import { getBuildingDef } from '@/data/buildingDefs';
import { buildingsLogic, getResourceEntity } from '@/ecs/archetypes';

/** Base spoilage rate for food exceeding storage capacity per tick. */
const OVERFLOW_SPOILAGE_RATE = 0.05;

/** Base spoilage rate for food within storage (standard buildings). */
const STORED_SPOILAGE_RATE = 0.005;

/** Reduced spoilage rate for cold-storage buildings (10× better than standard). */
const COLD_STORAGE_SPOILAGE_RATE = 0.0005;

/** Reduced spoilage rate for grain elevators (5× better than standard). */
const ELEVATOR_SPOILAGE_RATE = 0.001;

/** Seasonal spoilage multipliers (keyed by month). */
function getSeasonalSpoilageMult(month: number): number {
  // Summer (months 6-8): x2.0
  if (month >= 6 && month <= 8) return 2.0;
  // Winter (months 11, 12, 1, 2, 3): x0.3
  if (month >= 11 || month <= 3) return 0.3;
  // Spring/autumn: x1.0
  return 1.0;
}

/**
 * Storage capacity contribution per building role.
 * Specialized storage buildings add more capacity.
 */
const STORAGE_BY_ROLE: Record<string, number> = {
  agriculture: 50,
  industry: 30,
};

/** Extra storage from specific building defIds. */
const STORAGE_BY_DEF: Record<string, number> = {
  warehouse: 300,
  'grain-elevator': 2000,
  'cold-storage': 400,
  'fuel-depot': 500,
  granary: 500,
  'root-cellar': 200,
};

/**
 * Calculates total storage capacity from all buildings in the world.
 * Each storage building contributes a fixed amount based on its role/defId.
 */
export function calculateStorageCapacity(): number {
  let capacity = 200; // base storage (communal root cellars)

  for (const entity of buildingsLogic) {
    const defId = entity.building.defId;
    const def = getBuildingDef(defId);

    // Check specific building overrides first
    const defCapacity = STORAGE_BY_DEF[defId];
    if (defCapacity !== undefined) {
      capacity += defCapacity;
      continue;
    }

    // Fall back to role-based storage
    const role = def?.role;
    if (role) {
      const roleCapacity = STORAGE_BY_ROLE[role];
      if (roleCapacity !== undefined) {
        capacity += roleCapacity;
      }
    }
  }

  return capacity;
}

/**
 * Calculate the effective spoilage rate based on storage building types.
 *
 * Cold storage and grain elevators reduce spoilage. The rate is a weighted
 * average across all storage capacity — buildings with better preservation
 * reduce the overall rate proportionally to their capacity contribution.
 */
function getEffectiveSpoilageRate(): number {
  let totalCapacity = 200; // base storage at standard rate
  let coldCapacity = 0;
  let elevatorCapacity = 0;

  for (const entity of buildingsLogic) {
    const defId = entity.building.defId;
    if (defId === 'cold-storage') {
      coldCapacity += STORAGE_BY_DEF[defId] ?? 0;
    } else if (defId === 'grain-elevator') {
      elevatorCapacity += STORAGE_BY_DEF[defId] ?? 0;
    } else {
      const defCap = STORAGE_BY_DEF[defId];
      if (defCap !== undefined) {
        totalCapacity += defCap;
        continue;
      }
      const def = getBuildingDef(defId);
      const role = def?.role;
      if (role) {
        const roleCap = STORAGE_BY_ROLE[role];
        if (roleCap !== undefined) {
          totalCapacity += roleCap;
        }
      }
    }
  }

  const allCapacity = totalCapacity + coldCapacity + elevatorCapacity;
  if (allCapacity <= 0) return STORED_SPOILAGE_RATE;

  // Weighted average: each capacity segment contributes its rate proportionally
  return (
    (totalCapacity * STORED_SPOILAGE_RATE +
      coldCapacity * COLD_STORAGE_SPOILAGE_RATE +
      elevatorCapacity * ELEVATOR_SPOILAGE_RATE) /
    allCapacity
  );
}

/**
 * Runs the storage & spoilage system for one tick.
 *
 * 1. Recalculates total storage capacity from buildings.
 * 2. Applies spoilage to food exceeding capacity.
 * 3. Applies baseline decay to stored food (rate reduced by cold storage/elevators).
 * 4. Updates the storageCapacity field on the resource store.
 *
 * @param month - Current game month (1-12) for seasonal spoilage modifier.
 */
export function storageSystem(month: number): void {
  const store = getResourceEntity();
  if (!store) return;

  const capacity = calculateStorageCapacity();
  store.resources.storageCapacity = capacity;

  const seasonalMult = getSeasonalSpoilageMult(month);

  // Food spoilage
  const food = store.resources.food;
  if (food > capacity) {
    // Overflow food spoils at high rate
    const overflow = food - capacity;
    const spoiled = overflow * OVERFLOW_SPOILAGE_RATE * seasonalMult;
    store.resources.food = Math.max(0, food - spoiled);
  } else if (food > 0) {
    // Stored food decays — rate improved by cold storage and grain elevators
    const rate = getEffectiveSpoilageRate();
    const decay = food * rate * seasonalMult;
    store.resources.food = Math.max(0, food - decay);
  }

  // Vodka never spoils. Steel, cement, timber don't spoil.
}

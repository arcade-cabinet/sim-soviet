/**
 * @fileoverview StorageAgent — Storage capacity and food spoilage agent.
 *
 * Absorbs all logic from storageSystem.ts. Computes total storage capacity
 * from buildings, applies seasonal spoilage to food (overflow and stored),
 * and emits STORAGE_FULL / FOOD_SPOILED telegrams.
 *
 * Telegrams emitted: STORAGE_FULL, FOOD_SPOILED
 */

import { Vehicle } from 'yuka';
import { economy } from '@/config';
import { getBuildingDef } from '@/data/buildingDefs';
import { buildingsLogic, getResourceEntity, operationalBuildings } from '@/ecs/archetypes';
import { MSG } from '../../telegrams';

// ---------------------------------------------------------------------------
// Constants (sourced from config/economy.json → storage)
// ---------------------------------------------------------------------------

const cfg = economy.storage;

/** Base spoilage rate for food exceeding storage capacity per tick. */
const OVERFLOW_SPOILAGE_RATE = cfg.overflowSpoilageRate;

/** Base spoilage rate for food within storage (standard buildings). */
const STORED_SPOILAGE_RATE = cfg.storedSpoilageRate;

/** Reduced spoilage rate for cold-storage buildings (10× better than standard). */
const COLD_STORAGE_SPOILAGE_RATE = cfg.coldStorageSpoilageRate;

/** Reduced spoilage rate for grain elevators (5× better than standard). */
const ELEVATOR_SPOILAGE_RATE = cfg.elevatorSpoilageRate;

/** Rate for a single cold-storage building: 0.1% per tick. */
const SINGLE_COLD_STORAGE_RATE = cfg.singleColdStorageRate;

/**
 * Storage capacity contribution per building role.
 * Specialized storage buildings add more capacity.
 */
const STORAGE_BY_ROLE: Record<string, number> = cfg.byRole;

/** Extra storage from specific building defIds. */
const STORAGE_BY_DEF: Record<string, number> = cfg.byDef;

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

/** Internal StorageAgent state tracked across ticks. */
export interface StorageState {
  /** Current computed storage capacity (units). */
  capacity: number;
  /** Food lost to spoilage in the last tick. */
  lastSpoilageAmount: number;
  /** Number of operational cold-storage buildings in last tick. */
  coldStorageCount: number;
}

// ---------------------------------------------------------------------------
// StorageAgent
// ---------------------------------------------------------------------------

/**
 * Manages food storage capacity and applies seasonal spoilage each tick.
 * Extends Yuka Vehicle for compatibility with EntityManager.
 *
 * @example
 * const storage = new StorageAgent();
 * storage.update(currentMonth);
 * const capacity = storage.getCapacity();
 */
export class StorageAgent extends Vehicle {
  /** Internal storage state. */
  private state: StorageState = {
    capacity: cfg.baseCapacity,
    lastSpoilageAmount: 0,
    coldStorageCount: 0,
  };

  /**
   * Exported message constants for telegram emission (tests can reference).
   * @internal
   */
  static readonly MSG = MSG;

  constructor() {
    super();
    this.name = 'StorageAgent';
  }

  // -------------------------------------------------------------------------
  // Main tick entry point
  // -------------------------------------------------------------------------

  /**
   * Run storage and spoilage logic for one tick.
   *
   * 1. Recomputes total storage capacity from all buildings.
   * 2. Applies overflow spoilage to food exceeding capacity (5% per tick).
   * 3. Applies baseline decay to stored food (rate reduced by cold storage/elevators).
   * 4. Updates storageCapacity on the resource store.
   * 5. Emits STORAGE_FULL or FOOD_SPOILED telegrams as appropriate.
   *
   * @param month - Current game month (1-12) for seasonal spoilage modifier
   */
  tickStorage(month: number): void {
    const store = getResourceEntity();
    if (!store) return;

    const capacity = this._calculateStorageCapacity();
    this.state.capacity = capacity;
    store.resources.storageCapacity = capacity;

    const seasonalMult = this._getSeasonalSpoilageMult(month);
    const food = store.resources.food;
    let spoiledThisTick = 0;

    if (food > capacity) {
      // Overflow food spoils at high rate
      const overflow = food - capacity;
      const spoiled = overflow * OVERFLOW_SPOILAGE_RATE * seasonalMult;
      spoiledThisTick = spoiled;
      store.resources.food = Math.max(0, food - spoiled);

      // Emit STORAGE_FULL telegram (only when registered with an EntityManager)
      if (this.manager) {
        this.sendMessage(this, this, MSG.STORAGE_FULL, 0, {
          capacity,
          food,
          overflow,
        });
      }
    } else if (food > 0) {
      // Stored food decays at effective rate
      const rate = this._getEffectiveSpoilageRate();
      const decay = food * rate * seasonalMult;
      spoiledThisTick = decay;
      store.resources.food = Math.max(0, food - decay);
    }

    this.state.lastSpoilageAmount = spoiledThisTick;

    if (spoiledThisTick > 0 && this.manager) {
      // Emit FOOD_SPOILED telegram (only when registered with an EntityManager)
      this.sendMessage(this, this, MSG.FOOD_SPOILED, 0, {
        amount: spoiledThisTick,
        month,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Capacity calculation
  // -------------------------------------------------------------------------

  /**
   * Calculates total storage capacity from all buildings in the world.
   * Each storage building contributes a fixed amount based on its role/defId.
   * Includes a base 200-unit communal root cellar capacity.
   *
   * @returns Total food storage capacity in units
   */
  private _calculateStorageCapacity(): number {
    let capacity = cfg.baseCapacity; // base storage (communal root cellars)

    for (const entity of buildingsLogic) {
      const defId = entity.building.defId;
      const def = getBuildingDef(defId);

      const defCapacity = STORAGE_BY_DEF[defId];
      if (defCapacity !== undefined) {
        capacity += defCapacity;
        continue;
      }

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

  // -------------------------------------------------------------------------
  // Cold storage helpers
  // -------------------------------------------------------------------------

  /**
   * Counts the number of operational, powered cold-storage buildings.
   *
   * @returns Number of active cold-storage buildings
   */
  private _countOperationalColdStorage(): number {
    let count = 0;
    for (const entity of operationalBuildings) {
      if (entity.building.defId === 'cold-storage' && entity.building.powered) {
        count++;
      }
    }
    this.state.coldStorageCount = count;
    return count;
  }

  /**
   * Calculates the cold-storage spoilage rate given the number of buildings.
   *
   * Diminishing returns:
   *   n=0: 0.500%  (no cold storage)
   *   n=1: 0.100%  (first building)
   *   n=2: 0.075%  (floor + (0.1% - floor) * 0.5)
   *   n=3: 0.0625% (floor + (0.1% - floor) * 0.25)
   *   ...approaching floor of 0.05%
   *
   * @param count - Number of operational cold-storage buildings
   * @returns Effective spoilage rate for stored food
   */
  private _getColdStorageRate(count: number): number {
    if (count <= 0) return STORED_SPOILAGE_RATE;
    if (count === 1) return SINGLE_COLD_STORAGE_RATE;

    const floor = COLD_STORAGE_SPOILAGE_RATE;
    const additionalCount = count - 1;
    const gap = SINGLE_COLD_STORAGE_RATE - floor;
    return floor + gap * 0.5 ** additionalCount;
  }

  // -------------------------------------------------------------------------
  // Spoilage rate calculation
  // -------------------------------------------------------------------------

  /**
   * Calculates the weighted average spoilage rate from standard vs grain-elevator storage.
   *
   * @returns Weighted spoilage rate (grain elevators improve stored food preservation)
   */
  private _getStandardElevatorRate(): number {
    let totalCapacity = cfg.baseCapacity; // base storage at standard rate
    let elevatorCapacity = 0;

    for (const entity of buildingsLogic) {
      const defId = entity.building.defId;
      if (defId === 'grain-elevator') {
        elevatorCapacity += STORAGE_BY_DEF[defId] ?? 0;
        continue;
      }
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

    const allCapacity = totalCapacity + elevatorCapacity;
    if (allCapacity <= 0) return STORED_SPOILAGE_RATE;

    return (totalCapacity * STORED_SPOILAGE_RATE + elevatorCapacity * ELEVATOR_SPOILAGE_RATE) / allCapacity;
  }

  /**
   * Calculates the effective spoilage rate based on storage building types.
   *
   * Cold storage buildings (operational + powered) reduce baseline spoilage.
   * Grain elevators contribute via weighted-average capacity blending.
   *
   * @returns Effective stored-food spoilage rate per tick
   */
  private _getEffectiveSpoilageRate(): number {
    const coldCount = this._countOperationalColdStorage();

    if (coldCount > 0) {
      return this._getColdStorageRate(coldCount);
    }

    return this._getStandardElevatorRate();
  }

  /**
   * Seasonal spoilage multiplier keyed by month.
   *
   * @param month - Current game month (1-12)
   * @returns Spoilage multiplier (summer x2.0, winter x0.3, spring/autumn x1.0)
   */
  private _getSeasonalSpoilageMult(month: number): number {
    const s = cfg.seasonalSpoilage;
    if (month >= s.summerMonthStart && month <= s.summerMonthEnd) return s.summerMultiplier;
    if (month >= s.winterMonthStart || month <= s.winterMonthEnd) return s.winterMultiplier;
    return 1.0;
  }

  // -------------------------------------------------------------------------
  // Public query methods
  // -------------------------------------------------------------------------

  /**
   * Returns the current computed storage capacity (units).
   *
   * @returns Storage capacity in food units
   */
  getCapacity(): number {
    return this.state.capacity;
  }

  /**
   * Returns food spoiled in the last tick.
   *
   * @returns Spoilage amount from last update()
   */
  getLastSpoilageAmount(): number {
    return this.state.lastSpoilageAmount;
  }

  /**
   * Returns the number of operational cold-storage buildings from last tick.
   *
   * @returns Cold storage building count
   */
  getColdStorageCount(): number {
    return this.state.coldStorageCount;
  }

  /**
   * Checks whether at least one operational, powered cold-storage building exists.
   *
   * @returns true if cold storage is available
   */
  isColdStoragePresent(): boolean {
    return this._countOperationalColdStorage() > 0;
  }

  /**
   * Returns the storage capacity contribution for a single building defId.
   *
   * @param defId - Building definition ID to check
   * @returns Storage units contributed, or 0 if the building has no storage
   */
  getBuildingStorageContribution(defId: string): number {
    const defCapacity = STORAGE_BY_DEF[defId];
    if (defCapacity !== undefined) return defCapacity;
    const def = getBuildingDef(defId);
    const role = def?.role;
    if (role) {
      const roleCapacity = STORAGE_BY_ROLE[role];
      if (roleCapacity !== undefined) return roleCapacity;
    }
    return 0;
  }

  // -------------------------------------------------------------------------
  // Serialization
  // -------------------------------------------------------------------------

  /**
   * Serialize StorageAgent state for save/load.
   *
   * @returns Plain object snapshot of internal state
   */
  toJSON(): StorageState {
    return { ...this.state };
  }

  /**
   * Restore StorageAgent state from a saved snapshot.
   *
   * @param data - Previously serialized StorageState
   */
  fromJSON(data: StorageState): void {
    this.state = { ...data };
  }
}

/**
 * @fileoverview PowerAgent — Power distribution orchestrator.
 *
 * Absorbs the power distribution logic from powerSystem.ts and adds
 * goal-driven priority allocation during shortages.
 *
 * During a shortage, consumers are served in priority order:
 *   1. Farms  (food producers — survival critical)
 *   2. Housing (residential — population stability)
 *   3. Industry (everything else — production)
 *
 * Telegrams emitted:
 *   - POWER_SHORTAGE      when total demand exceeds total supply
 *   - BUILDING_UNPOWERED  for each building that loses power
 */

import { Vehicle } from 'yuka';
import { buildingsLogic, getResourceEntity } from '../../ecs/archetypes';
import { world } from '../../ecs/world';
import { MSG } from '../telegrams';
import type { With } from 'miniplex';
import type { Entity } from '../../ecs/world';

// ---------------------------------------------------------------------------
// Priority classification
// ---------------------------------------------------------------------------

/** Power allocation priority group. Lower value = served first. */
export type PowerPriority = 'farm' | 'housing' | 'industry';

/** Priority order used when allocating scarce power. */
const PRIORITY_ORDER: PowerPriority[] = ['farm', 'housing', 'industry'];

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

/** Serialisable internal state of the PowerAgent. */
export interface PowerAgentState {
  /** Total power generated last tick. */
  totalPower: number;
  /** Total power consumed last tick. */
  powerUsed: number;
  /** Whether the last tick ended in a shortage. */
  inShortage: boolean;
  /** Number of buildings that went unpowered last tick. */
  unpoweredCount: number;
}

// ---------------------------------------------------------------------------
// PowerAgent
// ---------------------------------------------------------------------------

/**
 * PowerAgent — goal-driven power distribution for SimSoviet.
 *
 * Extends Yuka Vehicle for compatibility with EntityManager.
 *
 * On each call to `update()` (or the explicit `distributePower()` helper used
 * in tests) the agent:
 *   1. Sums power output from all generator buildings.
 *   2. Classifies consumers by priority group (farm → housing → industry).
 *   3. Allocates power to each group in priority order.
 *   4. Marks remaining consumers as unpowered and records events.
 *   5. Updates the ECS resource store.
 *
 * @example
 * const agent = new PowerAgent();
 * agent.update(delta); // Call each simulation tick
 * if (agent.isInShortage()) {  // Read results after the tick
 *   console.log('Power shortage!', agent.getUnpoweredCount());
 * }
 */
export class PowerAgent extends Vehicle {
  /** Internal state snapshot, updated each tick. */
  private state: PowerAgentState = {
    totalPower: 0,
    powerUsed: 0,
    inShortage: false,
    unpoweredCount: 0,
  };

  /** Callbacks emitted when events are detected. */
  private onPowerShortage: ((deficit: number) => void) | null = null;
  private onBuildingUnpowered: ((buildingId: string) => void) | null = null;

  /** Exported message type constants for tests and callers. */
  static readonly MSG = {
    POWER_SHORTAGE: MSG.POWER_SHORTAGE,
    BUILDING_UNPOWERED: MSG.BUILDING_UNPOWERED,
  } as const;

  constructor() {
    super();
    this.name = 'PowerAgent';
  }

  // -------------------------------------------------------------------------
  // Event wiring
  // -------------------------------------------------------------------------

  /**
   * Register a callback invoked when demand exceeds supply.
   *
   * @param cb - Called with the power deficit amount
   */
  onShortage(cb: (deficit: number) => void): this {
    this.onPowerShortage = cb;
    return this;
  }

  /**
   * Register a callback invoked when a specific building loses power.
   *
   * @param cb - Called with the building's defId string
   */
  onUnpowered(cb: (buildingId: string) => void): this {
    this.onBuildingUnpowered = cb;
    return this;
  }

  // -------------------------------------------------------------------------
  // Yuka lifecycle
  // -------------------------------------------------------------------------

  /**
   * Called by Yuka's EntityManager each simulation tick.
   * Runs a full power distribution pass over the ECS world.
   *
   * @param _delta - Elapsed time since last tick (unused by power logic)
   */
  override update(_delta: number): this {
    this.distributePower();
    return this;
  }

  // -------------------------------------------------------------------------
  // Core distribution
  // -------------------------------------------------------------------------

  /**
   * Run a complete power distribution pass.
   *
   * Can be called directly in tests without requiring Yuka's EntityManager.
   * Mutates ECS building entities and updates the resource store.
   */
  distributePower(): void {
    const store = getResourceEntity();
    if (!store) return;

    const totalPower = this._calculateTotalPower();
    const { powerUsed, unpoweredCount } = this._distributePriority(totalPower);

    const inShortage = powerUsed < this._calculateTotalDemand();
    const deficit = Math.max(0, this._calculateTotalDemand() - totalPower);

    // Update resource store
    store.resources.power = totalPower;
    store.resources.powerUsed = powerUsed;

    // Update internal state
    this.state = { totalPower, powerUsed, inShortage, unpoweredCount };

    // Emit shortage event
    if (inShortage && deficit > 0) {
      this.onPowerShortage?.(deficit);
    }
  }

  // -------------------------------------------------------------------------
  // Phase 1: Calculate total supply
  // -------------------------------------------------------------------------

  /**
   * Sum power output from all generator buildings.
   *
   * @returns Total available power units
   */
  private _calculateTotalPower(): number {
    let total = 0;
    for (const entity of buildingsLogic) {
      if (entity.building.powerOutput > 0) {
        total += entity.building.powerOutput;
      }
    }
    return total;
  }

  /**
   * Sum power demand from all consumer buildings.
   *
   * @returns Total power units required by all consumers
   */
  private _calculateTotalDemand(): number {
    let total = 0;
    for (const entity of buildingsLogic) {
      if (entity.building.powerReq > 0) {
        total += entity.building.powerReq;
      }
    }
    return total;
  }

  // -------------------------------------------------------------------------
  // Phase 2: Priority-based distribution
  // -------------------------------------------------------------------------

  /**
   * Distribute power to consumers in priority order: farm → housing → industry.
   *
   * During shortages, lower-priority buildings are unpowered first.
   * Within each priority group, consumers are served in ECS iteration order.
   *
   * @param totalPower - Total available power units
   * @returns Power consumed and count of buildings left unpowered
   */
  private _distributePriority(totalPower: number): { powerUsed: number; unpoweredCount: number } {
    // Classify consumers by priority group
    const groups = new Map<PowerPriority, Array<With<Entity, 'position' | 'building'>>>();
    for (const p of PRIORITY_ORDER) {
      groups.set(p, []);
    }
    const noReq: Array<With<Entity, 'position' | 'building'>> = [];

    for (const entity of buildingsLogic) {
      if (entity.building.powerReq <= 0) {
        noReq.push(entity);
      } else {
        const priority = this._classifyConsumer(entity);
        groups.get(priority)!.push(entity);
      }
    }

    // Always power generators and zero-requirement buildings
    for (const entity of noReq) {
      this._ensurePowered(entity);
    }

    // Allocate to priority groups in order
    let remaining = totalPower;
    let powerUsed = 0;
    let unpoweredCount = 0;

    for (const priority of PRIORITY_ORDER) {
      const group = groups.get(priority)!;
      for (const entity of group) {
        const req = entity.building.powerReq;
        const wasPowered = entity.building.powered;

        if (remaining >= req) {
          remaining -= req;
          powerUsed += req;
          entity.building.powered = true;
        } else {
          entity.building.powered = false;
          unpoweredCount++;
          this.onBuildingUnpowered?.(entity.building.defId);
        }

        if (wasPowered !== entity.building.powered) {
          world.reindex(entity);
        }
      }
    }

    return { powerUsed, unpoweredCount };
  }

  /**
   * Classify a building entity into a power priority group.
   *
   * - Farms (food producers): 'farm'
   * - Housing buildings:       'housing'
   * - Everything else:         'industry'
   *
   * @param entity - Building entity to classify
   * @returns Priority group
   */
  private _classifyConsumer(entity: With<Entity, 'position' | 'building'>): PowerPriority {
    if (entity.building.produces?.resource === 'food') return 'farm';
    if (entity.building.housingCap > 0) return 'housing';
    return 'industry';
  }

  /**
   * Ensure a building is marked as powered (e.g. generators, zero-req buildings).
   *
   * @param entity - Building entity to power
   */
  private _ensurePowered(entity: With<Entity, 'position' | 'building'>): void {
    if (!entity.building.powered) {
      entity.building.powered = true;
      world.reindex(entity);
    }
  }

  // -------------------------------------------------------------------------
  // State accessors
  // -------------------------------------------------------------------------

  /** Total power generated on the last tick. */
  getTotalPower(): number {
    return this.state.totalPower;
  }

  /** Total power consumed on the last tick. */
  getPowerUsed(): number {
    return this.state.powerUsed;
  }

  /** Whether demand exceeded supply on the last tick. */
  isInShortage(): boolean {
    return this.state.inShortage;
  }

  /** Count of buildings that were unpowered on the last tick. */
  getUnpoweredCount(): number {
    return this.state.unpoweredCount;
  }

  /** Power surplus (positive) or deficit (negative) on the last tick. */
  getPowerBalance(): number {
    return this.state.totalPower - this.state.powerUsed;
  }

  // -------------------------------------------------------------------------
  // Serialization
  // -------------------------------------------------------------------------

  /**
   * Serialize agent state for save/load.
   *
   * @returns Plain object snapshot
   */
  toJSON(): PowerAgentState {
    return { ...this.state };
  }

  /**
   * Restore agent state from a saved snapshot.
   *
   * @param data - Previously returned from toJSON()
   */
  fromJSON(data: PowerAgentState): void {
    this.state = { ...data };
  }
}

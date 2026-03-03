/**
 * @fileoverview SettlementAgent — wraps SettlementSystem as a Yuka Vehicle.
 *
 * Delegates all settlement tier logic to the existing SettlementSystem class.
 * Stores the latest SettlementEvent for the orchestrator to read.
 */

import { Vehicle } from 'yuka';
import {
  type SettlementEvent,
  type SettlementMetrics,
  type SettlementSaveData,
  SettlementSystem,
  type SettlementTier,
} from './SettlementSystem';

/**
 * Wraps SettlementSystem as a Yuka Vehicle agent.
 *
 * @example
 * const agent = new SettlementAgent('selo');
 * const event = agent.tick(metrics);
 */
export class SettlementAgent extends Vehicle {
  private system: SettlementSystem;
  private lastEvent: SettlementEvent | null = null;

  constructor(initialTier: SettlementTier = 'selo') {
    super();
    this.name = 'SettlementAgent';
    this.system = new SettlementSystem(initialTier);
  }

  /** Run one settlement tick. Stores the event for later retrieval. */
  tick(metrics: SettlementMetrics): SettlementEvent | null {
    this.lastEvent = this.system.tick(metrics);
    return this.lastEvent;
  }

  /** Get the last settlement event (upgrade/downgrade), or null. */
  getLastEvent(): SettlementEvent | null {
    return this.lastEvent;
  }

  /** Clear the stored event after the orchestrator has consumed it. */
  clearLastEvent(): void {
    this.lastEvent = null;
  }

  /** Get current settlement tier. */
  getCurrentTier(): SettlementTier {
    return this.system.getCurrentTier();
  }

  /** Get the tier definition for the current tier. */
  getTierDefinition() {
    return this.system.getTierDefinition();
  }

  /** Get upgrade/downgrade progress (0-1). */
  getProgress() {
    return this.system.getProgress();
  }

  /** Serialize for save/load. */
  serialize(): SettlementSaveData {
    return this.system.serialize();
  }

  /** Restore from save data. */
  static deserialize(data: SettlementSaveData): SettlementAgent {
    const sys = SettlementSystem.deserialize(data);
    const agent = new SettlementAgent();
    agent.system = sys;
    return agent;
  }
}

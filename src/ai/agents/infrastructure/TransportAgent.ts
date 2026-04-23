/**
 * @fileoverview TransportAgent — wraps TransportSystem as a Yuka Vehicle.
 *
 * Delegates all transport/road logic to the existing TransportSystem class.
 */

import { Vehicle } from 'yuka';
import { operationalBuildings } from '../../../ecs/archetypes';
import type { Entity } from '../../../ecs/world';
import type { SeasonProfile } from '../../../game/Chronology';
import type { GameRng } from '../../../game/SeedSystem';
import { MSG } from '../../telegrams';
import type { SettlementTier } from './SettlementSystem';
import { type TransportSaveData, TransportSystem, type TransportTickResult } from './TransportSystem';

/**
 * Wraps TransportSystem as a Yuka Vehicle agent.
 *
 * @example
 * const agent = new TransportAgent('revolution');
 * const result = agent.tick(entities, 'selo', 10, season, resources);
 */
export class TransportAgent extends Vehicle {
  private system: TransportSystem;

  constructor(eraId = 'revolution', rng?: GameRng) {
    super();
    this.name = 'TransportAgent';
    this.system = new TransportSystem(eraId);
    if (rng) this.system.setRng(rng);
  }

  /** Handle incoming Yuka telegrams. */
  handleMessage(telegram: any): boolean {
    if (telegram.message === MSG.PHASE_PRODUCTION) {
      const engine = (globalThis as any).simulationEngine;
      if (engine?._lastTickCtx) {
        const ctx = engine._lastTickCtx;
        // Construction reads the latest transport pass from the agent.
        const res = this.system.tick(
          operationalBuildings.entities,
          engine.settlement.getCurrentTier(),
          ctx.agents.chronology.getDate().totalTicks,
          ctx.tickResult.season,
          ctx.storeRef.resources,
        );
        (this as any)._lastTickResult = res;
      }
      return true;
    }
    return false;
  }

  /** Delegate tick to TransportSystem. */
  tick(
    operationalEntities: readonly Entity[],
    tier: SettlementTier,
    totalTicks: number,
    season: SeasonProfile,
    resources?: { timber: number },
  ): TransportTickResult {
    return this.system.tick(operationalEntities, tier, totalTicks, season, resources);
  }

  /** Update the current era. */
  setEra(eraId: string): void {
    this.system.setEra(eraId);
  }

  /** Set the RNG instance. */
  setRng(rng: GameRng): void {
    this.system.setRng(rng);
  }

  /** Get current road quality. */
  getQuality() {
    return this.system.getQuality();
  }

  /** Get current road condition (0-100). */
  getCondition(): number {
    return this.system.getCondition();
  }

  /** Serialize for save/load. */
  serialize(): TransportSaveData {
    return this.system.serialize();
  }

  /** Restore from save data. */
  static deserialize(data: TransportSaveData): TransportAgent {
    const sys = TransportSystem.deserialize(data);
    const agent = new TransportAgent();
    agent.system = sys;
    return agent;
  }
}

/**
 * @fileoverview NarrativeAgent — Yuka agent wrapping EventSystem, PravdaSystem, and PolitburoSystem.
 *
 * Owns and orchestrates the three narrative subsystems that generate
 * satirical game events, Pravda propaganda headlines, and Politburo
 * political intrigue (corruption, coups, minister dynamics).
 */

import { Vehicle } from 'yuka';
import type { GameRng } from '../../../game/SeedSystem';
import type { GameEvent } from './events';
import { EventSystem, type EventSystemSaveData } from './events';
import { PravdaSystem, type PravdaSaveData } from './pravda';
import { PolitburoSystem, type PolitburoSaveData } from './politburo';

// ─────────────────────────────────────────────────────────
//  SAVE DATA
// ─────────────────────────────────────────────────────────

/** Serializable snapshot of the entire NarrativeAgent for save/load. */
export interface NarrativeAgentSaveData {
  events: EventSystemSaveData;
  pravda: PravdaSaveData;
  politburo: PolitburoSaveData;
}

// ─────────────────────────────────────────────────────────
//  NARRATIVE AGENT
// ─────────────────────────────────────────────────────────

/**
 * Wraps EventSystem, PravdaSystem, and PolitburoSystem into a single
 * Yuka agent. SimulationEngine delegates all narrative ticking here.
 */
export class NarrativeAgent extends Vehicle {
  private eventSystem: EventSystem;
  private pravdaSystem: PravdaSystem;
  private politburoSystem: PolitburoSystem;

  private eventHandler: ((event: GameEvent) => void) | null = null;
  private politburoEventHandler: ((event: GameEvent) => void) | null = null;

  constructor(rng?: GameRng, startYear?: number) {
    super();

    // Default no-op handlers; wired later via set*Handler()
    const eventCb = (event: GameEvent) => this.eventHandler?.(event);
    const politburoCb = (event: GameEvent) => this.politburoEventHandler?.(event);

    this.eventSystem = new EventSystem(eventCb, rng);
    this.pravdaSystem = new PravdaSystem(rng);
    this.politburoSystem = new PolitburoSystem(politburoCb, rng, startYear);
  }

  /** Yuka Vehicle update — not used for tick logic (called explicitly). */
  override update(_delta: number): this {
    return this;
  }

  // ── Tick methods ────────────────────────────────────────

  /** Tick the EventSystem (random satirical events). */
  tickEvents(totalTicks: number, eventFrequencyMult: number): void {
    this.eventSystem.tick(totalTicks, eventFrequencyMult);
  }

  /** Tick the PravdaSystem (generate ambient headline). */
  tickPravda(): void {
    this.pravdaSystem.generateAmbientHeadline();
  }

  /** Tick the PolitburoSystem (corruption, minister events, coups). */
  tickPolitburo(tickResult: { newMonth: boolean; newYear: boolean }): void {
    this.politburoSystem.tick(tickResult);
  }

  // ── Configuration ──────────────────────────────────────

  /** Set the corruption multiplier on the PolitburoSystem. */
  setCorruptionMult(mult: number): void {
    this.politburoSystem.setCorruptionMult(mult);
  }

  /** Wire the event callback (fired when EventSystem triggers an event). */
  setEventHandler(handler: (event: GameEvent) => void): void {
    this.eventHandler = handler;
  }

  /** Wire the politburo event callback (fired when PolitburoSystem generates events). */
  setPolitburoEventHandler(handler: (event: GameEvent) => void): void {
    this.politburoEventHandler = handler;
  }

  // ── Getters ────────────────────────────────────────────

  getEventSystem(): EventSystem {
    return this.eventSystem;
  }

  getPravdaSystem(): PravdaSystem {
    return this.pravdaSystem;
  }

  getPolitburo(): PolitburoSystem {
    return this.politburoSystem;
  }

  // ── Serialization ──────────────────────────────────────

  serialize(): NarrativeAgentSaveData {
    return {
      events: this.eventSystem.serialize(),
      pravda: this.pravdaSystem.serialize(),
      politburo: this.politburoSystem.serialize(),
    };
  }

  static deserialize(
    data: NarrativeAgentSaveData,
    rng?: GameRng,
  ): NarrativeAgent {
    const agent = Object.create(NarrativeAgent.prototype) as NarrativeAgent;
    Vehicle.call(agent);

    // Restore handlers as no-ops; caller must re-wire via set*Handler()
    agent.eventHandler = null;
    agent.politburoEventHandler = null;

    const eventCb = (event: GameEvent) => agent.eventHandler?.(event);
    const politburoCb = (event: GameEvent) => agent.politburoEventHandler?.(event);

    agent.eventSystem = EventSystem.deserialize(data.events, eventCb, rng);
    agent.pravdaSystem = PravdaSystem.deserialize(data.pravda, rng);
    agent.politburoSystem = PolitburoSystem.deserialize(data.politburo, politburoCb, rng);

    return agent;
  }
}

/**
 * @fileoverview AgentManager — Yuka EntityManager wrapper for SimSoviet.
 *
 * Manages all Yuka agents (game systems + ChairmanAgent).
 * In Phase 1, only ChairmanAgent is managed. Phases 2-4 add system agents.
 *
 * Replaces SimulationEngine.tick() orchestration when fully migrated.
 */

import { EntityManager } from 'yuka';
import { ChairmanAgent } from './agents/ChairmanAgent';

/** Serialized AgentManager state for save/load. */
export interface AgentManagerSaveData {
  autopilot: boolean;
}

/**
 * Wraps Yuka's EntityManager to manage all game agents.
 *
 * @example
 * const manager = new AgentManager();
 * manager.enableAutopilot();
 * manager.update(delta); // Called each tick
 */
export class AgentManager {
  private entityManager: EntityManager;
  private chairman: ChairmanAgent | null = null;

  constructor() {
    this.entityManager = new EntityManager();
  }

  /** Update all agents for one simulation tick. */
  update(delta: number): void {
    this.entityManager.update(delta);
  }

  /** Enable autopilot — creates and registers ChairmanAgent. */
  enableAutopilot(): void {
    if (this.chairman) return;
    this.chairman = new ChairmanAgent();
    this.entityManager.add(this.chairman);
  }

  /** Disable autopilot — removes ChairmanAgent. */
  disableAutopilot(): void {
    if (!this.chairman) return;
    this.entityManager.remove(this.chairman);
    this.chairman = null;
  }

  /** Get the ChairmanAgent (null if autopilot disabled). */
  getChairman(): ChairmanAgent | null {
    return this.chairman;
  }

  /** Whether autopilot is currently enabled. */
  isAutopilot(): boolean {
    return this.chairman !== null;
  }

  /** Serialize for save/load. */
  toJSON(): AgentManagerSaveData {
    return { autopilot: this.chairman !== null };
  }

  /** Restore from save data. */
  fromJSON(data: AgentManagerSaveData): void {
    if (data.autopilot) {
      this.enableAutopilot();
    } else {
      this.disableAutopilot();
    }
  }
}

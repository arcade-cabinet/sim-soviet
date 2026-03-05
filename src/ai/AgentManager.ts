/**
 * @fileoverview AgentManager — Yuka EntityManager wrapper for SimSoviet.
 *
 * Manages all Yuka agents: 13 system agents (always present) + ChairmanAgent (autopilot-only).
 * System agents replace the old function-based systems in SimulationEngine.
 */

import { EntityManager } from 'yuka';
import { ChairmanAgent } from './agents/ChairmanAgent';
import type { ChronologyAgent } from './agents/core/ChronologyAgent';
import type { WeatherAgent } from './agents/core/WeatherAgent';
import type { EconomyAgent } from './agents/economy/EconomyAgent';
import type { FoodAgent } from './agents/economy/FoodAgent';
import type { StorageAgent } from './agents/economy/StorageAgent';
import type { VodkaAgent } from './agents/economy/VodkaAgent';
import type { CollectiveAgent } from './agents/infrastructure/CollectiveAgent';
import type { ConstructionAgent } from './agents/infrastructure/ConstructionAgent';
import type { DecayAgent } from './agents/infrastructure/DecayAgent';
import type { PowerAgent } from './agents/infrastructure/PowerAgent';
import type { SettlementAgent } from './agents/infrastructure/SettlementAgent';
import type { TransportAgent } from './agents/infrastructure/TransportAgent';
import type { MetaAgent } from './agents/meta/MetaAgent';
import type { NarrativeAgent } from './agents/narrative/NarrativeAgent';
import type { KGBAgent } from './agents/political/KGBAgent';
import type { LoyaltyAgent } from './agents/political/LoyaltyAgent';
import type { PoliticalAgent } from './agents/political/PoliticalAgent';
import type { QuotaAgent } from './agents/political/QuotaAgent';
import type { DefenseAgent } from './agents/social/DefenseAgent';
import type { DemographicAgent } from './agents/social/DemographicAgent';
import type { DvorNeedsAgent } from './agents/social/DvorNeedsAgent';
import type { GlobalHexManager } from '../game/map/global/GlobalHexManager';
import type { WorkerAgent } from './agents/workforce/WorkerAgent';

/** Serialized AgentManager state for save/load. */
export interface AgentManagerSaveData {
  autopilot: boolean;
}

/**
 * Wraps Yuka's EntityManager to manage all game agents.
 *
 * System agents are always registered. ChairmanAgent is only present in autopilot mode.
 *
 * @example
 * const manager = new AgentManager();
 * manager.enableAutopilot();
 * manager.update(delta); // Called each tick
 */
export class AgentManager {
  private entityManager: EntityManager;
  private chairman: ChairmanAgent | null = null;

  // ── System agents (always present) ───────────────────────
  private _chronology: ChronologyAgent | null = null;
  private _weather: WeatherAgent | null = null;
  private _power: PowerAgent | null = null;
  private _food: FoodAgent | null = null;
  private _vodka: VodkaAgent | null = null;
  private _storage: StorageAgent | null = null;
  private _economy: EconomyAgent | null = null;
  private _collective: CollectiveAgent | null = null;
  private _demographic: DemographicAgent | null = null;
  private _dvorNeeds: DvorNeedsAgent | null = null;
  private _kgb: KGBAgent | null = null;
  private _political: PoliticalAgent | null = null;
  private _defense: DefenseAgent | null = null;
  private _loyalty: LoyaltyAgent | null = null;
  private _construction: ConstructionAgent | null = null;
  private _decay: DecayAgent | null = null;
  private _transport: TransportAgent | null = null;
  private _settlement: SettlementAgent | null = null;
  private _worker: WorkerAgent | null = null;
  private _narrative: NarrativeAgent | null = null;
  private _quota: QuotaAgent | null = null;
  private _meta: MetaAgent | null = null;

  constructor() {
    this.entityManager = new EntityManager();
  }

  /** Update all agents for one simulation tick. */
  update(delta: number): void {
    this.entityManager.update(delta);
  }

  // ── System agent registration ────────────────────────────

  /** Register a system agent and add it to the entity manager. */
  registerChronology(agent: ChronologyAgent): void {
    this._chronology = agent;
    if (!this.entityManager.entities.includes(agent as any)) {
      this.entityManager.add(agent as any);
    }
  }

  registerWeather(agent: WeatherAgent): void {
    this._weather = agent;
    if (!this.entityManager.entities.includes(agent as any)) {
      this.entityManager.add(agent as any);
    }
  }

  registerPower(agent: PowerAgent): void {
    this._power = agent;
    if (!this.entityManager.entities.includes(agent as any)) {
      this.entityManager.add(agent as any);
    }
  }

  registerFood(agent: FoodAgent): void {
    this._food = agent;
    if (!this.entityManager.entities.includes(agent as any)) {
      this.entityManager.add(agent as any);
    }
  }

  registerVodka(agent: VodkaAgent): void {
    this._vodka = agent;
    if (!this.entityManager.entities.includes(agent as any)) {
      this.entityManager.add(agent as any);
    }
  }

  registerStorage(agent: StorageAgent): void {
    this._storage = agent;
    if (!this.entityManager.entities.includes(agent as any)) {
      this.entityManager.add(agent as any);
    }
  }

  registerEconomy(agent: EconomyAgent): void {
    this._economy = agent;
    if (!this.entityManager.entities.includes(agent as any)) {
      this.entityManager.add(agent as any);
    }
  }

  registerCollective(agent: CollectiveAgent): void {
    this._collective = agent;
    if (!this.entityManager.entities.includes(agent as any)) {
      this.entityManager.add(agent as any);
    }
  }

  registerDemographic(agent: DemographicAgent): void {
    this._demographic = agent;
    if (!this.entityManager.entities.includes(agent as any)) {
      this.entityManager.add(agent as any);
    }
  }

  registerDvorNeeds(agent: DvorNeedsAgent): void {
    this._dvorNeeds = agent;
    if (!this.entityManager.entities.includes(agent as any)) {
      this.entityManager.add(agent as any);
    }
  }

  registerKGB(agent: KGBAgent): void {
    this._kgb = agent;
    if (!this.entityManager.entities.includes(agent as any)) {
      this.entityManager.add(agent as any);
    }
  }

  registerPolitical(agent: PoliticalAgent): void {
    this._political = agent;
    if (!this.entityManager.entities.includes(agent as any)) {
      this.entityManager.add(agent as any);
    }
  }

  registerDefense(agent: DefenseAgent): void {
    this._defense = agent;
    if (!this.entityManager.entities.includes(agent as any)) {
      this.entityManager.add(agent as any);
    }
  }

  registerLoyalty(agent: LoyaltyAgent): void {
    this._loyalty = agent;
    if (!this.entityManager.entities.includes(agent as any)) {
      this.entityManager.add(agent as any);
    }
  }

  registerConstruction(agent: ConstructionAgent): void {
    this._construction = agent;
    if (!this.entityManager.entities.includes(agent as any)) {
      this.entityManager.add(agent as any);
    }
  }

  registerDecay(agent: DecayAgent): void {
    this._decay = agent;
    if (!this.entityManager.entities.includes(agent as any)) {
      this.entityManager.add(agent as any);
    }
  }

  registerTransport(agent: TransportAgent): void {
    this._transport = agent;
    if (!this.entityManager.entities.includes(agent as any)) {
      this.entityManager.add(agent as any);
    }
  }

  registerSettlement(agent: SettlementAgent): void {
    this._settlement = agent;
    if (!this.entityManager.entities.includes(agent as any)) {
      this.entityManager.add(agent as any);
    }
  }

  registerWorker(agent: WorkerAgent): void {
    this._worker = agent;
    if (!this.entityManager.entities.includes(agent as any)) {
      this.entityManager.add(agent as any);
    }
  }

  registerNarrative(agent: NarrativeAgent): void {
    this._narrative = agent;
    if (!this.entityManager.entities.includes(agent as any)) {
      this.entityManager.add(agent as any);
    }
  }

  registerQuota(agent: QuotaAgent): void {
    this._quota = agent;
    if (!this.entityManager.entities.includes(agent as any)) {
      this.entityManager.add(agent as any);
    }
  }

  registerMeta(agent: MetaAgent): void {
    this._meta = agent;
    if (!this.entityManager.entities.includes(agent as any)) {
      this.entityManager.add(agent as any);
    }
  }

  // ── System agent getters ─────────────────────────────────

  getChronology(): ChronologyAgent | null {
    return this._chronology;
  }

  getWeather(): WeatherAgent | null {
    return this._weather;
  }

  getPower(): PowerAgent | null {
    return this._power;
  }

  getFood(): FoodAgent | null {
    return this._food;
  }

  getVodka(): VodkaAgent | null {
    return this._vodka;
  }

  getStorage(): StorageAgent | null {
    return this._storage;
  }

  getEconomy(): EconomyAgent | null {
    return this._economy;
  }

  getCollective(): CollectiveAgent | null {
    return this._collective;
  }

  getDemographic(): DemographicAgent | null {
    return this._demographic;
  }

  getDvorNeeds(): DvorNeedsAgent | null {
    return this._dvorNeeds;
  }

  getKGB(): KGBAgent | null {
    return this._kgb;
  }

  getPolitical(): PoliticalAgent | null {
    return this._political;
  }

  getDefense(): DefenseAgent | null {
    return this._defense;
  }

  getLoyalty(): LoyaltyAgent | null {
    return this._loyalty;
  }

  getConstruction(): ConstructionAgent | null {
    return this._construction;
  }

  getDecay(): DecayAgent | null {
    return this._decay;
  }

  getTransport(): TransportAgent | null {
    return this._transport;
  }

  getSettlement(): SettlementAgent | null {
    return this._settlement;
  }

  getWorker(): WorkerAgent | null {
    return this._worker;
  }

  getNarrative(): NarrativeAgent | null {
    return this._narrative;
  }

  getMeta(): MetaAgent | null {
    return this._meta;
  }

  getQuota(): QuotaAgent | null {
    return this._quota;
  }

  // ── Autopilot (ChairmanAgent) ────────────────────────────

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

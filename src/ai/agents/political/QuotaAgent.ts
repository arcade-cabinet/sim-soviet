/**
 * @fileoverview QuotaAgent — wraps quota tracking, compulsory deliveries, and scoring.
 *
 * Absorbs:
 *   - quotaSystem (quota tracking + multi-resource sync)
 *   - CompulsoryDeliveries (state extraction per tick)
 *   - ScoringSystem (score accumulation + difficulty/consequence presets)
 *
 * The agent owns instances of CompulsoryDeliveries and ScoringSystem,
 * delegating to them rather than reimplementing their logic.
 */

import { Vehicle } from 'yuka';
import type { QuotaState } from './quotaSystem';
import { quotaSystem } from './quotaSystem';
import type { CompulsoryDeliverySaveData, DeliveryResult } from './CompulsoryDeliveries';
import { CompulsoryDeliveries } from './CompulsoryDeliveries';
import type { DifficultyLevel, ConsequenceLevel, ScoringSystemSaveData } from './ScoringSystem';
import { ScoringSystem } from './ScoringSystem';

/** Serializable snapshot for save/load. */
export interface QuotaAgentSaveData {
  deliveries: CompulsoryDeliverySaveData;
  scoring: ScoringSystemSaveData;
}

/**
 * QuotaAgent — manages quota tracking, compulsory deliveries, and scoring.
 *
 * Extends Yuka Vehicle so it can be registered in the AgentManager.
 */
export class QuotaAgent extends Vehicle {
  private deliveries: CompulsoryDeliveries;
  private scoring: ScoringSystem;

  constructor(difficulty: DifficultyLevel = 'comrade', consequence: ConsequenceLevel = 'permadeath') {
    super();
    this.name = 'QuotaAgent';
    this.deliveries = new CompulsoryDeliveries();
    this.scoring = new ScoringSystem(difficulty, consequence);
  }

  // ── Quota system delegation ──────────────────────────────

  /** Run the quota tracking system for one tick. */
  tickQuota(quota: QuotaState): void {
    quotaSystem(quota);
  }

  // ── CompulsoryDeliveries delegation ──────────────────────

  /** Apply compulsory deliveries to new production. */
  applyDeliveries(newFood: number, newVodka: number, newMoney: number): DeliveryResult {
    return this.deliveries.applyDeliveries(newFood, newVodka, newMoney);
  }

  /** Get the CompulsoryDeliveries instance. */
  getDeliveries(): CompulsoryDeliveries {
    return this.deliveries;
  }

  // ── ScoringSystem delegation ─────────────────────────────

  /** Get the ScoringSystem instance. */
  getScoring(): ScoringSystem {
    return this.scoring;
  }

  // ── Serialization ────────────────────────────────────────

  serialize(): QuotaAgentSaveData {
    return {
      deliveries: this.deliveries.serialize(),
      scoring: this.scoring.serialize(),
    };
  }

  static deserialize(data: QuotaAgentSaveData): QuotaAgent {
    const deliveriesInstance = CompulsoryDeliveries.deserialize(data.deliveries);
    const scoringInstance = ScoringSystem.deserialize(data.scoring);
    const agent = new QuotaAgent(scoringInstance.getDifficulty(), scoringInstance.getConsequence());
    // Replace the default instances with deserialized ones
    (agent as unknown as { deliveries: CompulsoryDeliveries }).deliveries = deliveriesInstance;
    (agent as unknown as { scoring: ScoringSystem }).scoring = scoringInstance;
    return agent;
  }
}

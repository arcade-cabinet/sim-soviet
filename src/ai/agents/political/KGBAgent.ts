/**
 * @fileoverview KGBAgent — The KGB system as a Yuka agent.
 *
 * This agent IS the KGB system. It absorbs:
 *   - PersonnelFile: mark tracking, decay, threat level computation, arrest check
 *   - kgb.ts: investigation lifecycle (start, progress, resolve)
 *   - PoliticalEntitySystem: KGB agent entity spawning and tick logic
 *
 * Telegrams emitted: INSPECTION_IMMINENT, MARKS_INCREASED, ARREST_WARRANT
 * Telegrams received: OFFER_BRIBE (reduces suspicion), ERA_TRANSITION (adjusts aggression)
 */

import { Vehicle } from 'yuka';
import { MSG } from '../../telegrams';
import type {
  KGBInformant,
  KGBInvestigation,
  PoliticalEntityStats,
  PoliticalTickResult,
} from './types';
import { buildingsLogic, getResourceEntity } from '@/ecs/archetypes';
import { getBuildingDef } from '@/data/buildingDefs';
import { world } from '@/ecs/world';
import { political } from '@/config';
import type { ConsequenceConfig } from './ScoringSystem';
import type { ScoringSystem } from './ScoringSystem';
import type { GameGrid } from '../../../game/GameGrid';
import type { GameRng } from '../../../game/SeedSystem';
import type { SimCallbacks } from '../../../game/engine/types';
import type { WorkerSystem } from '../workforce/WorkerSystem';
import type { ChronologyAgent } from '../core/ChronologyAgent';

// ─────────────────────────────────────────────────────────
//  Re-export types from PersonnelFile so callers can migrate
// ─────────────────────────────────────────────────────────

/** Difficulty level for personnel file mark decay rates. */
export type Difficulty = 'worker' | 'comrade' | 'tovarish';

/** Categorized source of a black mark entry in the personnel file. */
export type MarkSource =
  | 'worker_arrested'
  | 'quota_missed_minor'
  | 'quota_missed_major'
  | 'quota_missed_catastrophic'
  | 'construction_mandate'
  | 'conscription_failed'
  | 'black_market'
  | 'lying_to_kgb'
  | 'stakhanovite_fraud'
  | 'blat_noticed'
  | 'suppressing_news'
  | 'report_falsified'
  | 'excessive_intervention';

/** Categorized source of a commendation entry in the personnel file. */
export type CommendationSource =
  | 'quota_exceeded'
  | 'stakhanovite_celebrated'
  | 'inspection_passed'
  | 'ideology_session_passed'
  | 'mandates_fulfilled';

/** A single mark, commendation, or reset entry in the personnel file history. */
export interface FileEntry {
  tick: number;
  type: 'mark' | 'commendation' | 'reset';
  source: string;
  amount: number;
  description: string;
}

/** Escalating KGB threat level derived from effective marks. */
export type ThreatLevel = 'safe' | 'watched' | 'warned' | 'investigated' | 'reviewed' | 'arrested';

/** Serializable snapshot of the personnel file portion. */
export interface PersonnelFileSaveData {
  difficulty: Difficulty;
  blackMarks: number;
  commendations: number;
  lastMarkAddedTick: number;
  lastDecayTick: number;
  history: FileEntry[];
}

// ─────────────────────────────────────────────────────────
//  Constants (from config/political.json)
// ─────────────────────────────────────────────────────────

const cfg = political.kgb;

const MARK_AMOUNTS: Record<MarkSource, number> = cfg.markAmounts as Record<MarkSource, number>;

const COMMENDATION_AMOUNTS: Record<CommendationSource, number> = cfg.commendationAmounts as Record<CommendationSource, number>;

const DECAY_INTERVALS: Record<Difficulty, number> = cfg.decayIntervals as Record<Difficulty, number>;

const DEFAULT_MARK_DESCRIPTIONS: Record<MarkSource, string> = {
  worker_arrested: 'Worker arrested for disloyalty',
  quota_missed_minor: 'Production quota missed (10-30%)',
  quota_missed_major: 'Production quota missed (30-60%)',
  quota_missed_catastrophic: 'Production quota catastrophically missed (>60%)',
  construction_mandate: 'Construction mandate not met',
  conscription_failed: 'Conscription quota not met',
  black_market: 'Black market activity detected',
  lying_to_kgb: 'Caught providing false information to KGB',
  stakhanovite_fraud: 'Stakhanovite hero exposed as fraud',
  blat_noticed: 'Unauthorized blat transaction noticed',
  suppressing_news: 'Suppressing news from central committee',
  report_falsified: 'Falsification of production report (pripiski) detected',
  excessive_intervention: 'Chairman interfered excessively with collective operations',
};

const DEFAULT_COMMENDATION_DESCRIPTIONS: Record<CommendationSource, string> = {
  quota_exceeded: 'Production quota exceeded',
  stakhanovite_celebrated: 'Stakhanovite worker celebrated',
  inspection_passed: 'Passed official inspection',
  ideology_session_passed: 'Ideology session: all participants passed',
  mandates_fulfilled: 'All Five-Year Plan building mandates fulfilled',
};

/** Number of effective marks at which arrest is triggered. */
const ARREST_THRESHOLD = cfg.arrestThreshold;

// ─────────────────────────────────────────────────────────
//  Constants (from kgb.ts)
// ─────────────────────────────────────────────────────────

/** Default investigation duration range (ticks). */
export const INVESTIGATION_MIN_TICKS = cfg.investigationMinTicks;
export const INVESTIGATION_MAX_TICKS = cfg.investigationMaxTicks;

/** How often KGB agents pick a new building to investigate (ticks). */
export const KGB_REASSIGNMENT_INTERVAL = cfg.reassignmentInterval;

/** KGB investigation: morale drop per tick. */
export const KGB_MORALE_DROP = cfg.moraleDrop;

/** KGB investigation: loyalty boost per tick (through fear). */
export const KGB_LOYALTY_BOOST = cfg.loyaltyBoost;

/** Chance per investigation tick that a worker gets flagged. */
export const KGB_FLAG_CHANCE = cfg.flagChance;

/** Chance that a thorough investigation finds a black mark. */
export const KGB_BLACK_MARK_CHANCE_THOROUGH = cfg.blackMarkChanceThorough;

/** Chance that a purge investigation finds a black mark. */
export const KGB_BLACK_MARK_CHANCE_PURGE = cfg.blackMarkChancePurge;

/** Base number of workers arrested when an investigation completes with arrest result. */
export const BASE_ARREST_COUNT = cfg.baseArrestCount;

/** Multiplier for arrest count during purge-intensity investigations. */
export const PURGE_ARREST_MULT = cfg.purgeArrestMult;

/** Ticks between informant reports. */
export const INFORMANT_REPORT_INTERVAL = cfg.informantReportInterval;

/** Chance that an informant report flags a worker. */
export const INFORMANT_FLAG_CHANCE = cfg.informantFlagChance;

/** How many existing marks before investigation priority is escalated. */
export const ESCALATION_MARK_THRESHOLD = cfg.escalationMarkThreshold;

// ─────────────────────────────────────────────────────────
//  Constants (from assessThreat / wrapper)
// ─────────────────────────────────────────────────────────

/**
 * Mark count thresholds for suspicion scoring by aggression level.
 * Threshold is the mark count at which suspicion reaches 1.0.
 */
const MARK_THRESHOLDS: Record<'low' | 'medium' | 'high', number> = cfg.markThresholds as Record<'low' | 'medium' | 'high', number>;

/** Default aggression level by difficulty name. */
const DIFFICULTY_AGGRESSION: Record<string, 'low' | 'medium' | 'high'> = {
  worker: 'low',
  comrade: 'medium',
  tovarish: 'high',
};

// ─────────────────────────────────────────────────────────
//  Minimal RNG interface (subset of GameRng)
// ─────────────────────────────────────────────────────────

/** Minimal RNG surface required by KGBAgent. */
export interface KGBRng {
  random(): number;
  /** Roll a coin flip with given probability (0-1). */
  coinFlip(p: number): boolean;
  /** Random integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Generate a unique ID string. */
  id(): string;
}

// ─────────────────────────────────────────────────────────
//  Internal state interface
// ─────────────────────────────────────────────────────────

/** Internal KGB agent state tracked across ticks. */
export interface KGBState {
  // Personnel file state
  difficulty: Difficulty;
  blackMarks: number;
  commendations: number;
  lastMarkAddedTick: number;
  lastDecayTick: number;
  history: FileEntry[];

  // Suspicion/assessment state
  suspicionLevel: number;
  investigationIntensity: 'routine' | 'thorough' | 'purge';
  markCount: number;
  lastInspectionTick: number;
  aggression: 'low' | 'medium' | 'high';
}

// ─────────────────────────────────────────────────────────
//  KGBAgent
// ─────────────────────────────────────────────────────────

/**
 * The KGB — fully absorbed system agent.
 *
 * Manages the player's personnel file (marks, commendations, decay, threat level),
 * runs investigation lifecycle against entity stats, and tracks informant networks.
 *
 * Extends Yuka Vehicle for compatibility with EntityManager.
 *
 * @example
 * const kgb = new KGBAgent('comrade');
 *
 * // Personnel file operations:
 * kgb.addMark('quota_missed_major', currentTick);
 * kgb.addCommendation('quota_exceeded', currentTick);
 * const threat = kgb.getThreatLevel(); // 'safe' | 'watched' | ... | 'arrested'
 *
 * // Suspicion assessment:
 * kgb.assessThreat(marks, commendations, quotaPerf, 'comrade');
 * const intensity = kgb.getInvestigationIntensity();
 * const risk = kgb.getArrestRisk();
 *
 * // Per-tick:
 * kgb.tickPersonnelFile(currentTick);
 * const result = kgb.tickKGBEntity(entity, totalTicks);
 */
export class KGBAgent extends Vehicle {
  /** Exported message constants for telegram emission. */
  static readonly MSG = MSG;

  private state: KGBState;

  /** Active investigations being run by this agent. */
  private investigations: KGBInvestigation[] = [];

  /** Informant network embedded in buildings. */
  private informants: KGBInformant[] = [];

  /** Optional RNG reference (set via setRng). */
  private rng: KGBRng | null = null;

  constructor(difficulty: string = 'comrade') {
    super();
    this.name = 'KGBAgent';
    const diff = (difficulty as Difficulty) in DECAY_INTERVALS ? (difficulty as Difficulty) : 'comrade';

    this.state = {
      difficulty: diff,
      blackMarks: 0,
      commendations: 0,
      lastMarkAddedTick: -Infinity,
      lastDecayTick: 0,
      history: [],

      suspicionLevel: 0,
      investigationIntensity: 'routine',
      markCount: 0,
      lastInspectionTick: 0,
      aggression: DIFFICULTY_AGGRESSION[difficulty] ?? 'medium',
    };
  }

  /** Inject an RNG instance for investigation/informant operations. */
  setRng(rng: KGBRng): void {
    this.rng = rng;
  }

  // ─────────────────────────────────────────────────────
  //  Personnel File API (absorbed from PersonnelFile)
  // ─────────────────────────────────────────────────────

  /**
   * Add black marks to the personnel file.
   * Returns the current threat level after adding.
   */
  addMark(source: MarkSource, tick: number, description?: string): ThreatLevel {
    const amount = MARK_AMOUNTS[source];
    this.state.blackMarks += amount;
    this.state.lastMarkAddedTick = tick;
    this.state.markCount = this.state.blackMarks;

    this.state.history.push({
      tick,
      type: 'mark',
      source,
      amount,
      description: description ?? DEFAULT_MARK_DESCRIPTIONS[source],
    });

    return this.getThreatLevel();
  }

  /** Add a commendation to the personnel file. */
  addCommendation(source: CommendationSource, tick: number, description?: string): void {
    const amount = COMMENDATION_AMOUNTS[source];
    this.state.commendations += amount;

    this.state.history.push({
      tick,
      type: 'commendation',
      source,
      amount,
      description: description ?? DEFAULT_COMMENDATION_DESCRIPTIONS[source],
    });
  }

  /**
   * Alias for tickPersonnelFile — backward compat with PersonnelFile.tick() API.
   * @param currentTick - Current simulation tick number
   */
  tick(currentTick: number): void {
    this.tickPersonnelFile(currentTick);
  }

  /**
   * Tick the personnel file for mark decay.
   * Call once per simulation tick.
   */
  tickPersonnelFile(currentTick: number): void {
    const decayInterval = DECAY_INTERVALS[this.state.difficulty];

    if (
      currentTick - this.state.lastDecayTick >= decayInterval &&
      this.state.lastMarkAddedTick < this.state.lastDecayTick &&
      this.state.blackMarks > 0
    ) {
      this.state.blackMarks = Math.max(0, this.state.blackMarks - 1);
      this.state.lastDecayTick = currentTick;
      this.state.markCount = this.state.blackMarks;
    }
  }

  /** Get current effective marks (marks - commendations, min 0). */
  getEffectiveMarks(): number {
    return Math.max(0, this.state.blackMarks - this.state.commendations);
  }

  /** Get raw black mark count. */
  getBlackMarks(): number {
    return this.state.blackMarks;
  }

  /** Get raw commendation count. */
  getCommendations(): number {
    return this.state.commendations;
  }

  /** Get current threat level based on effective marks. */
  getThreatLevel(): ThreatLevel {
    const effective = this.getEffectiveMarks();
    if (effective >= 7) return 'arrested';
    if (effective >= 6) return 'reviewed';
    if (effective >= 5) return 'investigated';
    if (effective >= 4) return 'warned';
    if (effective >= 3) return 'watched';
    return 'safe';
  }

  /** Check if game over (effective marks >= 7). */
  isArrested(): boolean {
    return this.getEffectiveMarks() >= ARREST_THRESHOLD;
  }

  /** Get the full file history. */
  getHistory(): ReadonlyArray<FileEntry> {
    return this.state.history;
  }

  /** Reset marks after rehabilitation (gulag return). */
  resetForRehabilitation(marksReset: number, tick: number): void {
    this.state.blackMarks = marksReset;
    this.state.commendations = 0;
    this.state.lastMarkAddedTick = -Infinity;
    this.state.lastDecayTick = tick;
    this.state.markCount = marksReset;

    this.state.history.push({
      tick,
      type: 'reset',
      source: 'rehabilitation',
      amount: 0,
      description: `Comrade Chairman rehabilitated after corrective labor. Marks reset to ${marksReset}.`,
    });
  }

  /** Reset marks to 2 for a new era transition. */
  resetForNewEra(): void {
    this.state.blackMarks = 2;
    this.state.commendations = 0;
    this.state.lastMarkAddedTick = -Infinity;
    this.state.lastDecayTick = 0;
    this.state.markCount = 2;

    this.state.history.push({
      tick: 0,
      type: 'mark',
      source: 'era_transition',
      amount: 2,
      description: 'File transferred to new era -- marks reset to 2',
    });
  }

  // ─────────────────────────────────────────────────────
  //  Suspicion Assessment API (from wrapper KGBAgent)
  // ─────────────────────────────────────────────────────

  /**
   * Evaluate political suspicion based on marks, commendations, quota
   * performance, and difficulty aggression.
   *
   * Suspicion is a fuzzy 0-1 value:
   *   - Marks contribute positively (scaled by aggression threshold)
   *   - Commendations subtract a small mitigation factor
   *   - Low quota performance adds suspicion
   */
  assessThreat(
    marks: number,
    commendations: number,
    quotaPerformance: number,
    difficulty: string,
  ): void {
    this.state.aggression = DIFFICULTY_AGGRESSION[difficulty] ?? this.state.aggression;
    this.state.markCount = marks;

    const threshold = MARK_THRESHOLDS[this.state.aggression];

    // Base suspicion from marks (capped at 1.0)
    const markSuspicion = Math.min(marks / threshold, 1.0);

    // Commendations provide a small mitigation (max 0.2 reduction)
    const commendationMitigation = Math.min(commendations * 0.05, 0.2);

    // Low quota performance contributes suspicion (up to 0.3 additional)
    const quotaSuspicion = Math.max(0, (1.0 - quotaPerformance) * 0.3);

    const raw = markSuspicion + quotaSuspicion - commendationMitigation;
    this.state.suspicionLevel = Math.max(0, Math.min(raw, 1.0));
    this.state.investigationIntensity = this._computeIntensity();
  }

  /** Get current investigation intensity based on suspicion level. */
  getInvestigationIntensity(): 'routine' | 'thorough' | 'purge' {
    return this.state.investigationIntensity;
  }

  /**
   * Determine whether to escalate investigation intensity.
   * Escalates when mark count is at or above ESCALATION_MARK_THRESHOLD (3).
   */
  shouldEscalate(): boolean {
    return this.state.markCount >= ESCALATION_MARK_THRESHOLD;
  }

  /**
   * Calculate probability of arrest this tick.
   * Returns 1.0 at or above ARREST_THRESHOLD marks, 0 at 0 marks,
   * and scales linearly in between.
   */
  getArrestRisk(): number {
    if (this.state.markCount >= ARREST_THRESHOLD) return 1.0;
    if (this.state.markCount <= 0) return 0;
    return this.state.markCount / ARREST_THRESHOLD;
  }

  /** Current raw suspicion level (0-1). */
  getSuspicionLevel(): number {
    return this.state.suspicionLevel;
  }

  /** Current aggression setting. */
  getAggression(): 'low' | 'medium' | 'high' {
    return this.state.aggression;
  }

  // ─────────────────────────────────────────────────────
  //  Investigation Lifecycle (absorbed from kgb.ts)
  // ─────────────────────────────────────────────────────

  /**
   * Tick a single KGB entity, potentially starting a new investigation.
   * Called by PoliticalEntitySystem (or equivalent) per entity per tick.
   */
  tickKGBEntity(entity: PoliticalEntityStats, result: PoliticalTickResult): void {
    const rng = this.rng;
    if (!rng) return;

    if (entity.ticksRemaining <= 0 && entity.targetBuilding) {
      const priorFlags = this.investigations.reduce((sum, inv) => sum + inv.flaggedWorkers, 0);
      const investigation = this._createInvestigation(entity, rng, priorFlags);

      result.newInvestigations.push(investigation);
      result.announcements.push(`KGB ${entity.name} has begun a ${investigation.intensity} investigation.`);
      this.investigations.push(investigation);

      // Plant a new informant at investigated buildings (30% chance)
      if (rng.coinFlip(0.3)) {
        this.informants.push(this._createInformant(entity.stationedAt, rng));
      }
    }
  }

  /**
   * Process all active investigations for one tick.
   * Advances timers, flags workers, resolves completed investigations.
   */
  tickInvestigations(result: PoliticalTickResult): void {
    const rng = this.rng;
    const completed: number[] = [];

    for (let i = 0; i < this.investigations.length; i++) {
      const inv = this.investigations[i]!;
      inv.ticksRemaining--;

      // Per-tick: chance to flag a worker
      if (rng?.coinFlip(KGB_FLAG_CHANCE)) {
        inv.flaggedWorkers++;
      }

      if (inv.ticksRemaining <= 0) {
        completed.push(i);
        this._resolveInvestigation(inv, rng, result);
      }
    }

    // Remove completed investigations (reverse order to preserve indices)
    for (let i = completed.length - 1; i >= 0; i--) {
      this.investigations.splice(completed[i]!, 1);
    }
    result.completedInvestigations = completed.length;
  }

  /**
   * Tick all informants. When their report timer expires, they produce
   * intelligence that may flag workers for investigation.
   */
  tickInformants(totalTicks: number, result: PoliticalTickResult): void {
    const rng = this.rng;

    for (const informant of this.informants) {
      if (totalTicks < informant.nextReportTick) continue;

      // Reset timer
      informant.nextReportTick = totalTicks + INFORMANT_REPORT_INTERVAL;

      // Informant produces a report — chance to flag based on reliability
      if (rng?.coinFlip((informant.reliability / 100) * INFORMANT_FLAG_CHANCE)) {
        result.announcements.push(
          `Informant report received from building (${informant.buildingPos.gridX},${informant.buildingPos.gridY}).`,
        );
      }
    }
  }

  /** Get all active investigations (read-only). */
  getActiveInvestigations(): readonly KGBInvestigation[] {
    return this.investigations;
  }

  /** Get all informants (read-only). */
  getInformants(): readonly KGBInformant[] {
    return this.informants;
  }

  // ─────────────────────────────────────────────────────
  //  Telegram handling
  // ─────────────────────────────────────────────────────

  /**
   * Handle an incoming bribe offer from ChairmanAgent — reduces suspicion.
   * @param bribeAmount - Magnitude of bribe (0-1 normalised value)
   */
  handleBribeOffer(bribeAmount: number): void {
    const reduction = Math.min(bribeAmount * 0.3, 0.3);
    this.state.suspicionLevel = Math.max(0, this.state.suspicionLevel - reduction);
    this.state.investigationIntensity = this._computeIntensity();
  }

  /**
   * Handle an ERA_TRANSITION telegram from PoliticalAgent.
   * Later eras ratchet aggression upward toward 'high'.
   * @param toEra - Target era index (0-7)
   */
  handleEraTransition(toEra: number): void {
    if (toEra >= 4) {
      this.state.aggression = 'high';
    } else if (toEra >= 2) {
      // Only escalate, never de-escalate
      if (this.state.aggression === 'low') {
        this.state.aggression = 'medium';
      }
    }
  }

  // ─────────────────────────────────────────────────────
  //  Serialization
  // ─────────────────────────────────────────────────────

  /** Serialize KGB state for save/load. */
  toJSON(): KGBState {
    return {
      ...this.state,
      history: [...this.state.history],
    };
  }

  /** Restore KGB state from a saved snapshot. */
  fromJSON(data: KGBState): void {
    this.state = {
      ...data,
      history: [...data.history],
    };
  }

  /** Serialize the personnel file state. Alias: serializePersonnelFile(). */
  serialize(): PersonnelFileSaveData {
    return this.serializePersonnelFile();
  }

  /** Deserialize a PersonnelFileSaveData into a new KGBAgent. */
  static deserialize(data: PersonnelFileSaveData): KGBAgent {
    const agent = new KGBAgent(data.difficulty);
    agent.loadPersonnelFile(data);
    return agent;
  }

  /** Serialize the personnel file portion only (for backward compatibility). */
  serializePersonnelFile(): PersonnelFileSaveData {
    return {
      difficulty: this.state.difficulty,
      blackMarks: this.state.blackMarks,
      commendations: this.state.commendations,
      lastMarkAddedTick: this.state.lastMarkAddedTick,
      lastDecayTick: this.state.lastDecayTick,
      history: [...this.state.history],
    };
  }

  /** Restore personnel file state (for backward compatibility with old save data). */
  loadPersonnelFile(data: PersonnelFileSaveData): void {
    this.state.difficulty = data.difficulty;
    this.state.blackMarks = data.blackMarks;
    this.state.commendations = data.commendations;
    this.state.lastMarkAddedTick = data.lastMarkAddedTick;
    this.state.lastDecayTick = data.lastDecayTick;
    this.state.history = [...data.history];
    this.state.markCount = data.blackMarks;
    this.state.aggression = DIFFICULTY_AGGRESSION[data.difficulty] ?? 'medium';
  }

  // ─────────────────────────────────────────────────────
  //  Absorbed SimulationEngine Methods
  // ─────────────────────────────────────────────────────

  /**
   * Non-permadeath consequence: destroy buildings, remove workers, skip time, reset marks.
   * Absorbs SimulationEngine.applyRehabilitation().
   */
  public applyRehabilitation(config: ConsequenceConfig, deps: {
    grid: GameGrid;
    rng: GameRng | undefined;
    workers: WorkerSystem;
    scoring: ScoringSystem;
    chronology: ChronologyAgent;
    callbacks: SimCallbacks;
  }): void {
    const store = getResourceEntity();
    const rng = deps.rng;

    // 1. Destroy buildings based on survival rate
    //    Clear ALL footprint tiles for multi-tile buildings (e.g. KGB office is 2×1).
    const allBuildings = [...buildingsLogic.entities];
    let buildingsLost = 0;
    for (const entity of allBuildings) {
      const roll = rng ? rng.random() : Math.random();
      if (roll > config.buildingSurvival) {
        const { gridX, gridY } = entity.position;
        const def = getBuildingDef(entity.building.defId);
        const fpX = def?.footprint.tilesX ?? 1;
        const fpY = def?.footprint.tilesY ?? 1;
        for (let dx = 0; dx < fpX; dx++) {
          for (let dy = 0; dy < fpY; dy++) {
            deps.grid.setCell(gridX + dx, gridY + dy, null);
          }
        }
        world.remove(entity);
        buildingsLost++;
      }
    }

    // 2. Remove workers based on survival rate
    const totalPop = store?.resources.population ?? 0;
    const workersToRemove = Math.floor(totalPop * (1 - config.workerSurvival));
    const workersLost = workersToRemove;
    if (workersToRemove > 0) {
      deps.workers.removeWorkersByCount(workersToRemove, 'gulag rehabilitation losses');
    }

    // 3. Reduce resources based on survival rate
    const resourcesLost = { money: 0, food: 0, vodka: 0 };
    if (store) {
      const r = store.resources;
      const moneyLost = Math.floor(r.money * (1 - config.resourceSurvival));
      const foodLost = Math.floor(r.food * (1 - config.resourceSurvival));
      const vodkaLost = Math.floor(r.vodka * (1 - config.resourceSurvival));
      resourcesLost.money = moneyLost;
      resourcesLost.food = foodLost;
      resourcesLost.vodka = vodkaLost;
      r.money -= moneyLost;
      r.food -= foodLost;
      r.vodka -= vodkaLost;
    }

    // 4. Skip time forward
    //    Note: advanceYears() jumps the clock but does not tick through each year.
    //    Era transitions are detected by checkEraTransition() on the next newYear
    //    tick boundary, so any era change caused by the time skip is handled
    //    automatically once normal simulation resumes.
    deps.chronology.advanceYears(config.returnDelayYears);

    // 5. Reset personnel file marks
    const newTick = deps.chronology.getDate().totalTicks;
    this.resetForRehabilitation(config.marksReset, newTick);

    // 6. Apply score penalty
    deps.scoring.onKGBLoss(workersLost);

    // 7. Sync population from remaining dvory
    if (store) {
      store.resources.population = deps.workers.syncPopulationFromDvory();
    }

    // 8. Notify UI
    deps.callbacks.onRehabilitation?.({
      yearsAway: config.returnDelayYears,
      buildingsLost,
      workersLost,
      resourcesLost,
      marksReset: config.marksReset,
      consequenceLevel: deps.scoring.getConsequence(),
    });

    deps.callbacks.onToast(
      `You have been rehabilitated after ${config.returnDelayYears} year${config.returnDelayYears > 1 ? 's' : ''} in the gulag.`,
      'warning',
    );
  }

  // ─────────────────────────────────────────────────────
  //  Private helpers
  // ─────────────────────────────────────────────────────

  /** Compute investigation intensity from current suspicion level. */
  private _computeIntensity(): 'routine' | 'thorough' | 'purge' {
    if (this.state.suspicionLevel >= 0.67) return 'purge';
    if (this.state.suspicionLevel >= 0.33) return 'thorough';
    return 'routine';
  }

  /** Get the chance of a black mark based on investigation intensity. */
  private _getBlackMarkChance(intensity: KGBInvestigation['intensity']): number {
    if (intensity === 'purge') return KGB_BLACK_MARK_CHANCE_PURGE;
    if (intensity === 'thorough') return KGB_BLACK_MARK_CHANCE_THOROUGH;
    return 0;
  }

  /** Roll investigation intensity based on agent effectiveness and escalation. */
  private _rollInvestigationIntensity(
    effectiveness: number,
    rng: KGBRng,
    priorMarks?: number,
  ): KGBInvestigation['intensity'] {
    const escalationBonus = priorMarks && priorMarks >= ESCALATION_MARK_THRESHOLD ? 20 : 0;
    const adjustedEffectiveness = Math.min(100, effectiveness + escalationBonus);

    const roll = rng.random() * 100;
    if (roll < adjustedEffectiveness * 0.1) return 'purge';
    if (roll < adjustedEffectiveness * 0.4) return 'thorough';
    return 'routine';
  }

  /** Create a new KGB investigation at the entity's current position. */
  private _createInvestigation(
    entity: PoliticalEntityStats,
    rng: KGBRng,
    priorMarks?: number,
  ): KGBInvestigation {
    const intensity = this._rollInvestigationIntensity(entity.effectiveness, rng, priorMarks);
    const duration = rng.int(INVESTIGATION_MIN_TICKS, INVESTIGATION_MAX_TICKS);

    const shouldArrest = intensity !== 'routine';

    // Brain drain: KGB targets high-skill workers
    const targetSkillLevel = Math.min(100, 30 + Math.floor(entity.effectiveness * 0.5) + rng.int(0, 20));

    return {
      targetBuilding: { ...entity.stationedAt },
      ticksRemaining: duration,
      intensity,
      flaggedWorkers: 0,
      shouldArrest,
      targetSkillLevel,
    };
  }

  /**
   * Resolve a completed investigation.
   * Possibly generates a black mark; if shouldArrest and workers flagged, removes workers.
   */
  private _resolveInvestigation(
    inv: KGBInvestigation,
    rng: KGBRng | null,
    result: PoliticalTickResult,
  ): void {
    const blackMarkChance = this._getBlackMarkChance(inv.intensity);

    if (rng && blackMarkChance > 0 && rng.coinFlip(blackMarkChance)) {
      result.blackMarksAdded++;
      result.announcements.push(
        `KGB investigation at (${inv.targetBuilding.gridX},${inv.targetBuilding.gridY}) has uncovered irregularities.`,
      );
    }

    // Worker arrest — actually REMOVE workers from population
    if (inv.shouldArrest && inv.flaggedWorkers > 0) {
      const arrestCount =
        inv.intensity === 'purge'
          ? Math.min(inv.flaggedWorkers, BASE_ARREST_COUNT * PURGE_ARREST_MULT)
          : Math.min(inv.flaggedWorkers, BASE_ARREST_COUNT);

      if (arrestCount > 0) {
        result.workersArrested += arrestCount;
        result.announcements.push(
          `${arrestCount} worker${arrestCount > 1 ? 's' : ''} arrested during KGB investigation. ` +
            `They have been relocated to assist with forestry projects.`,
        );
      }
    }
  }

  /** Create a new informant at a building position. */
  private _createInformant(
    buildingPos: { gridX: number; gridY: number },
    rng: KGBRng,
  ): KGBInformant {
    return {
      id: rng.id(),
      buildingPos: { ...buildingPos },
      nextReportTick: INFORMANT_REPORT_INTERVAL + rng.int(0, 30),
      reliability: rng.int(20, 80),
    };
  }
}

/** Backward-compat alias: PersonnelFile is now KGBAgent. */
export { KGBAgent as PersonnelFile };

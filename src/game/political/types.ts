/**
 * @module game/political/types
 *
 * Type definitions for the political entity system.
 */

// ─── Core Types ─────────────────────────────────────────────────────────────

export type PoliticalRole = 'politruk' | 'kgb_agent' | 'military_officer' | 'conscription_officer';

// ─── Politruk Personality ───────────────────────────────────────────────────

/** The 4 politruk personality archetypes that affect session behavior. */
export type PolitrukPersonality = 'zealous' | 'lazy' | 'paranoid' | 'corrupt';

// ─── KGB Informant ──────────────────────────────────────────────────────────

/** A secret informant embedded in the workforce. */
export interface KGBInformant {
  /** Unique informant identifier. */
  id: string;
  /** Which building they report on. */
  buildingPos: { gridX: number; gridY: number };
  /** How many ticks until they produce a report. */
  nextReportTick: number;
  /** Quality of information (0-100). Higher = more accurate flags. */
  reliability: number;
}

// ─── Ideology Sessions ─────────────────────────────────────────────────────

/** Result of a single ideology session held by a politruk. */
export interface IdeologySessionResult {
  /** Building where the session was held. */
  buildingPos: { gridX: number; gridY: number };
  /** How many workers attended (pulled off production). */
  workersAttended: number;
  /** How many workers failed the loyalty check. */
  workersFailed: number;
  /** Whether this session flagged anyone for KGB follow-up. */
  kgbTargetsFlagged: number;
}

// ─── Entity Stats ───────────────────────────────────────────────────────────

/** Extended stats for a political entity, keyed by unique ID. */
export interface PoliticalEntityStats {
  id: string;
  role: PoliticalRole;
  name: string;
  /** Grid position where this entity is currently stationed. */
  stationedAt: { gridX: number; gridY: number };
  /** Building defId they are currently inspecting/affecting (if any). */
  targetBuilding?: string;
  /** Ticks remaining at current station before reassignment. */
  ticksRemaining: number;
  /** Effectiveness (0-100) — how impactful their presence is. */
  effectiveness: number;
  /** Politruk personality (only for role === 'politruk'). */
  personality?: PolitrukPersonality;
}

/** Effect of a politruk stationed at a building. */
export interface PolitrukEffect {
  buildingGridX: number;
  buildingGridY: number;
  /** Morale delta applied to workers at this building. */
  moraleBoost: number;
  /** Fractional production penalty (e.g. 0.15 = 15% reduction). */
  productionPenalty: number;
  /** Number of worker slots consumed by the politruk. */
  workerSlotConsumed: number;
  /** Session result if one was held this tick. */
  sessionResult?: IdeologySessionResult;
}

/** An active KGB investigation at a building. */
export interface KGBInvestigation {
  targetBuilding: { gridX: number; gridY: number };
  ticksRemaining: number;
  intensity: 'routine' | 'thorough' | 'purge';
  /** Workers flagged during investigation. */
  flaggedWorkers: number;
  /** Whether this investigation should arrest (remove) workers on completion. */
  shouldArrest: boolean;
  /** Skill level of flagged workers (for brain drain targeting). Higher = targeted high-skill. */
  targetSkillLevel: number;
}

/** A conscription event that removes workers. */
export interface ConscriptionEvent {
  officerName: string;
  targetCount: number;
  drafted: number;
  /** Tick at which draftees return. -1 if permanent (wartime). */
  returnTick: number;
  /** How many of the drafted won't return. */
  casualties: number;
  announcement: string;
  /** Whether player has responded to this conscription order. */
  playerResponded?: boolean;
  /** Tick deadline for player response (after which auto-accepts). */
  responseDedlineTick?: number;
}

/** Temporary worker borrowing via orgnabor. */
export interface OrgnaborEvent {
  borrowedCount: number;
  returnTick: number;
  purpose: string;
  announcement: string;
}

/** Summary of effects produced by one tick. */
export interface PoliticalTickResult {
  /** Workers lost to conscription this tick. */
  workersConscripted: number;
  /** Workers returned from orgnabor/conscription this tick. */
  workersReturned: number;
  /** Workers arrested (removed) by KGB this tick. */
  workersArrested: number;
  /** New investigations started this tick. */
  newInvestigations: KGBInvestigation[];
  /** Investigations completed this tick. */
  completedInvestigations: number;
  /** Black marks added by KGB this tick. */
  blackMarksAdded: number;
  /** Active politruk effects. */
  politrukEffects: PolitrukEffect[];
  /** Ideology sessions held this tick. */
  ideologySessions: IdeologySessionResult[];
  /** Announcements to display. */
  announcements: string[];
  /** Raikom directives issued this tick. */
  raikomDirectives: RaikomDirective[];
  /** Doctrine mechanic effects applied this tick. */
  doctrineMechanicEffects: DoctrineMechanicEffect[];
}

/** Aggregate political effect on a single building. */
export interface PoliticalBuildingEffect {
  hasPolitruk: boolean;
  hasKGBAgent: boolean;
  moraleModifier: number;
  productionModifier: number;
  loyaltyModifier: number;
}

// ─── Raikom Types ───────────────────────────────────────────────────────────

/** Raikom (district committee) personality archetypes. */
export type RaikomPersonality = 'hardliner' | 'pragmatist' | 'careerist' | 'reformist';

/** A directive issued by the Raikom. */
export interface RaikomDirective {
  id: string;
  description: string;
  type: 'build' | 'produce' | 'purge' | 'celebrate';
  /** Tick deadline for the directive. */
  deadlineTick: number;
  /** Marks added if the directive is not fulfilled. */
  penaltyMarks: number;
  /** Whether the directive has been fulfilled. */
  fulfilled: boolean;
}

/** Raikom state — the procedural district committee character. */
export interface RaikomState {
  name: string;
  personality: RaikomPersonality;
  /** How favorably the Raikom views the player (0-100). */
  favor: number;
  /** Current blat spent on the Raikom (accumulated bribes). */
  blatAccepted: number;
  /** Tick of next visit. */
  nextVisitTick: number;
  /** Active directives. */
  activeDirectives: RaikomDirective[];
  /** How many reports sent to Moscow (affects personnel file). */
  reportsToMoscow: number;
}

// ─── Doctrine Mechanic Types ────────────────────────────────────────────────

/** Doctrine-specific gameplay mechanics tied to eras. */
export type DoctrineMechanicId =
  | 'grain_requisitioning'
  | 'collectivization_seizure'
  | 'stakhanovite_bonus'
  | 'wartime_conscription';

/** Effect produced by a doctrine mechanic this tick. */
export interface DoctrineMechanicEffect {
  mechanicId: DoctrineMechanicId;
  description: string;
  /** Resource deltas. */
  foodDelta: number;
  moneyDelta: number;
  vodkaDelta: number;
  popDelta: number;
  /** Production multiplier override (1.0 = no change). */
  productionMult: number;
}

/** Configuration for a doctrine mechanic. */
export interface DoctrineMechanicConfig {
  id: DoctrineMechanicId;
  /** Which era IDs this mechanic applies to. */
  activeEras: readonly string[];
  /** How often this mechanic fires (in ticks). 0 = every tick. */
  intervalTicks: number;
}

// ─── Save Data ──────────────────────────────────────────────────────────────

/** Shape used for JSON serialization roundtrip. */
export interface PoliticalEntitySaveData {
  entities: Array<PoliticalEntityStats>;
  investigations: KGBInvestigation[];
  informants: KGBInformant[];
  conscriptionQueue: ConscriptionEvent[];
  orgnaborQueue: OrgnaborEvent[];
  returnQueue: Array<{ returnTick: number; count: number }>;
  raikom: RaikomState | null;
}

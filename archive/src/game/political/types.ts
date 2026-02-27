/**
 * @module game/political/types
 *
 * Type definitions for the political entity system.
 */

// ─── Core Types ─────────────────────────────────────────────────────────────

export type PoliticalRole = 'politruk' | 'kgb_agent' | 'military_officer' | 'conscription_officer';

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
}

/** An active KGB investigation at a building. */
export interface KGBInvestigation {
  targetBuilding: { gridX: number; gridY: number };
  ticksRemaining: number;
  intensity: 'routine' | 'thorough' | 'purge';
  /** Workers flagged during investigation. */
  flaggedWorkers: number;
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
  /** New investigations started this tick. */
  newInvestigations: KGBInvestigation[];
  /** Investigations completed this tick. */
  completedInvestigations: number;
  /** Black marks added by KGB this tick. */
  blackMarksAdded: number;
  /** Active politruk effects. */
  politrukEffects: PolitrukEffect[];
  /** Announcements to display. */
  announcements: string[];
}

/** Aggregate political effect on a single building. */
export interface PoliticalBuildingEffect {
  hasPolitruk: boolean;
  hasKGBAgent: boolean;
  moraleModifier: number;
  productionModifier: number;
  loyaltyModifier: number;
}

/** Shape used for JSON serialization roundtrip. */
export interface PoliticalEntitySaveData {
  entities: Array<PoliticalEntityStats>;
  investigations: KGBInvestigation[];
  conscriptionQueue: ConscriptionEvent[];
  orgnaborQueue: OrgnaborEvent[];
  returnQueue: Array<{ returnTick: number; count: number }>;
}

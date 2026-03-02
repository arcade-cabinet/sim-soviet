/**
 * @fileoverview Types for the worker system.
 */

import type { CitizenComponent } from '@/ecs/world';

/** How this worker received their current assignment. */
export type AssignmentSource =
  | 'auto' // behavioral governor auto-assigned
  | 'player' // player manually assigned via UI
  | 'forced'; // state mandate (conscription, forced labor) — cannot be overridden

/** Extended worker stats beyond the base CitizenComponent. */
export interface WorkerStats {
  /** Morale (0-100): affects production efficiency */
  morale: number;
  /** Loyalty (0-100): low loyalty = defection risk */
  loyalty: number;
  /** Skill level (0-100): affects production quality */
  skill: number;
  /** Vodka dependency (0-100): high = needs vodka to function */
  vodkaDependency: number;
  /** Ticks since last vodka ration */
  ticksSinceVodka: number;
  /** Display name */
  name: string;
  /** Ticks this worker has been assigned to current building */
  assignmentDuration: number;
  /** How this worker got their current assignment */
  assignmentSource: AssignmentSource;
}

/** Reason a worker was removed from the population. */
export type PopulationDrainReason =
  | 'defection'
  | 'escape'
  | 'migration'
  | 'youth_flight'
  | 'kgb_arrest'
  | 'disease_death'
  | 'workplace_accident'
  | 'population_sync';

/** Reason new workers arrived. */
export type PopulationInflowReason = 'moscow_assignment' | 'forced_resettlement' | 'kolkhoz_amalgamation';

/** A single population drain event. */
export interface PopulationDrainEvent {
  name: string;
  class: CitizenComponent['class'];
  reason: PopulationDrainReason;
}

/** A single population inflow event. */
export interface PopulationInflowEvent {
  count: number;
  reason: PopulationInflowReason;
  averageMorale: number;
}

/** Result returned by each tick of the worker system. */
export interface WorkerTickResult {
  /** Total vodka consumed this tick */
  vodkaConsumed: number;
  /** Total food consumed this tick */
  foodConsumed: number;
  /** Workers who defected this tick */
  defections: Array<{ name: string; class: CitizenComponent['class'] }>;
  /** Stakhanovite events (worker exceeded quota) */
  stakhanovites: Array<{ name: string; class: CitizenComponent['class'] }>;
  /** Per-class aggregate production efficiency (0-1.5) */
  classEfficiency: Record<CitizenComponent['class'], number>;
  /** All population losses this tick (defections + drains) */
  drains: PopulationDrainEvent[];
  /** All population gains this tick */
  inflows: PopulationInflowEvent[];
  /** Average collective morale (0-100) */
  averageMorale: number;
  /** Current total population (authoritative count from citizen entities) */
  population: number;
}

/** Display info for a single worker. */
export interface WorkerDisplayInfo {
  name: string;
  class: CitizenComponent['class'];
  morale: number;
  assignment: string | null;
  status: 'working' | 'idle' | 'hungry' | 'drunk' | 'defecting';
  productionEfficiency: number;
}

/** Mutable context passed through per-worker tick processing. */
export interface TickContext {
  remainingVodka: number;
  remainingFood: number;
  vodkaConsumed: number;
  foodConsumed: number;
  partyOfficialCount: number;
  rng: import('@/game/SeedSystem').GameRng | null;
  /** Whether heating is non-operational during winter (morale penalty). */
  heatingFailing: boolean;
}

/**
 * @module game/era/types
 *
 * Type definitions for the era and campaign system.
 */

import type { GameMeta, Resources } from '@/ecs/world';
import type { Doctrine } from '../CompulsoryDeliveries';

// ─── Era Identifiers ────────────────────────────────────────────────────────

/** The 8 historical eras of the Soviet campaign. */
export type EraId =
  | 'war_communism'
  | 'first_plans'
  | 'great_patriotic'
  | 'reconstruction'
  | 'thaw'
  | 'stagnation'
  | 'perestroika'
  | 'eternal_soviet';

// ─── Era Modifiers ──────────────────────────────────────────────────────────

/** Gameplay modifiers applied by the current era to simulation systems. */
export interface EraModifiers {
  /** Multiplier on all resource production rates */
  productionMult: number;
  /** Multiplier on citizen consumption rates */
  consumptionMult: number;
  /** Multiplier on building decay rates */
  decayMult: number;
  /** Multiplier on population growth rate */
  populationGrowthMult: number;
  /** Multiplier on random event firing frequency */
  eventFrequencyMult: number;
  /** Multiplier on corruption/administrative losses */
  corruptionMult: number;
}

// ─── Era Conditions ─────────────────────────────────────────────────────────

/** Era-specific victory or failure condition. */
export interface EraCondition {
  /** Human-readable description of the condition */
  description: string;
  /** Returns true when the condition is met */
  check: (meta: GameMeta, resources: Resources) => boolean;
}

// ─── Era Definition ─────────────────────────────────────────────────────────

/**
 * Complete definition of a historical era.
 * All gameplay parameters, building gates, and flavor text for one era.
 */
export interface EraDefinition {
  /** Unique era identifier */
  id: EraId;
  /** Display name shown in UI */
  name: string;
  /** Calendar year this era begins */
  startYear: number;
  /** Calendar year this era ends (-1 for eternal_soviet) */
  endYear: number;

  /** Maps to CompulsoryDeliveries doctrine for state extraction rates */
  doctrine: Doctrine;
  /** Delivery extraction rates matching the doctrine */
  deliveryRates: { food: number; vodka: number; money: number };
  /** Multiplier applied to quota targets each new 5-year plan */
  quotaEscalation: number;

  /** Building defIds that become available at the START of this era */
  unlockedBuildings: readonly string[];

  /** Era-specific gameplay modifiers */
  modifiers: EraModifiers;

  /** Construction method for this era — affects build times */
  constructionMethod: ConstructionMethod;
  /** Multiplier on building construction time (lower = faster) */
  constructionTimeMult: number;

  /** Victory condition specific to this era */
  victoryCondition?: EraCondition;
  /** Failure condition specific to this era */
  failureCondition?: EraCondition;

  /** Assignment letter title */
  introTitle: string;
  /** Briefing text for era assignment letter (sardonic tone) */
  introText: string;
  /** Short sardonic flavor for the briefing */
  briefingFlavor: string;
}

// ─── Serialization ──────────────────────────────────────────────────────────

// ─── Construction Methods ──────────────────────────────────────────────────

/**
 * Construction method progression across eras.
 * Affects build time for all buildings.
 */
export type ConstructionMethod = 'manual' | 'mechanized' | 'industrial' | 'decaying';

// ─── Serialization ──────────────────────────────────────────────────────────

/** Serialized EraSystem state for save/load. */
export interface EraSystemSaveData {
  currentYear: number;
  previousEraId: EraId | null;
  transitionTicksRemaining: number;
}

/** Serialized era checkpoint for save/restore on failure. */
export interface EraCheckpoint {
  eraId: EraId;
  year: number;
  /** Opaque serialized game state at the moment the era began. */
  snapshot: string;
}

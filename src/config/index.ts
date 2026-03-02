/**
 * @module config
 *
 * Barrel loader for game configuration.
 * Static JSON imports with typed re-exports for compile-time safety.
 *
 * Also re-exports legacy grid config (GRID_SIZE, getCurrentGridSize, setCurrentGridSize)
 * that previously lived in src/config.ts.
 */

import demographicsData from './demographics.json';
import economyData from './economy.json';
import workforceData from './workforce.json';
import chronologyData from './chronology.json';
import type { ChronologyConfig, DemographicsConfig, EconomyConfig, WorkforceConfig } from './types';

// ── Legacy grid config (previously src/config.ts) ───────────────────────────

export const GRID_SIZE = 30;
export { getCurrentGridSize, setCurrentGridSize } from '../engine/GridTypes';

// ── Demographics config ─────────────────────────────────────────────────────

/** Typed demographics configuration loaded from demographics.json. */
export const demographics: DemographicsConfig = demographicsData as DemographicsConfig;

// ── Economy config ──────────────────────────────────────────────────────────

/** Typed economy configuration loaded from economy.json. */
export const economy: EconomyConfig = economyData as EconomyConfig;

// ── Workforce config ────────────────────────────────────────────────────────

/** Typed workforce configuration loaded from workforce.json. */
export const workforce: WorkforceConfig = workforceData as WorkforceConfig;

// ── Chronology config ───────────────────────────────────────────────────────

/** Typed chronology configuration loaded from chronology.json. */
export const chronology: ChronologyConfig = chronologyData as ChronologyConfig;

// Re-export types for consumers
export type {
  AggregateConfig,
  AggregateBirthRates,
  AggregateLaborForce,
  ChronologyConfig,
  DemographicsConfig,
  EconomyConfig,
  EntityBirthRates,
  EntityConfig,
  FoodModifierConfig,
  HouseholdFormationConfig,
  MortalityBracket,
  StarvationConfig,
  TrendsConfig,
  WorkforceConfig,
} from './types';

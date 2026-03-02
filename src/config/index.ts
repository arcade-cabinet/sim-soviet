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
import type { DemographicsConfig } from './types';

// ── Legacy grid config (previously src/config.ts) ───────────────────────────

export const GRID_SIZE = 30;
export { getCurrentGridSize, setCurrentGridSize } from '../engine/GridTypes';

// ── Demographics config ─────────────────────────────────────────────────────

/** Typed demographics configuration loaded from demographics.json. */
export const demographics: DemographicsConfig = demographicsData as DemographicsConfig;

// Re-export types for consumers
export type {
  AggregateConfig,
  AggregateBirthRates,
  AggregateLaborForce,
  DemographicsConfig,
  EntityBirthRates,
  EntityConfig,
  FoodModifierConfig,
  HouseholdFormationConfig,
  MortalityBracket,
  StarvationConfig,
  TrendsConfig,
} from './types';

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
import politicalData from './political.json';
import socialData from './social.json';
import infrastructureData from './infrastructure.json';
import narrativeData from './narrative.json';
import metaData from './meta.json';
import type {
  ChronologyConfig,
  DemographicsConfig,
  EconomyConfig,
  InfrastructureConfig,
  MetaConfig,
  NarrativeConfig,
  PoliticalConfig,
  SocialConfig,
  WorkforceConfig,
} from './types';

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

// ── Political config ────────────────────────────────────────────────────────

/** Typed political configuration loaded from political.json. */
export const political: PoliticalConfig = politicalData as PoliticalConfig;

// ── Social config ───────────────────────────────────────────────────────────

/** Typed social configuration loaded from social.json. */
export const social: SocialConfig = socialData as SocialConfig;

// ── Infrastructure config ───────────────────────────────────────────────────

/** Typed infrastructure configuration loaded from infrastructure.json. */
export const infrastructure: InfrastructureConfig = infrastructureData as InfrastructureConfig;

// ── Narrative config ────────────────────────────────────────────────────────

/** Typed narrative configuration loaded from narrative.json. */
export const narrative: NarrativeConfig = narrativeData as NarrativeConfig;

// ── Meta config ─────────────────────────────────────────────────────────────

/** Typed meta configuration loaded from meta.json. */
export const meta: MetaConfig = metaData as MetaConfig;

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
  InfrastructureConfig,
  MetaConfig,
  MortalityBracket,
  NarrativeConfig,
  PoliticalConfig,
  SocialConfig,
  StarvationConfig,
  TrendsConfig,
  WorkforceConfig,
} from './types';

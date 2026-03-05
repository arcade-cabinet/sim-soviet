/**
 * @module game/relocation/terrainProfiles
 *
 * Terrain configuration presets for different settlement locations.
 * Each profile defines environmental parameters that affect gameplay:
 * gravity, atmosphere, water, farming capability, construction type,
 * and base survival cost.
 *
 * Used by the relocation system and cold branches to define where
 * new settlements can be established.
 */

import type { TerrainProfile } from '../../ai/agents/core/worldBranches';

// ─── Named Profiles ─────────────────────────────────────────────────────────

/** Default Siberian tundra — standard game starting conditions. */
export const TERRAIN_SIBERIA: Readonly<TerrainProfile> = Object.freeze({
  gravity: 1.0,
  atmosphere: 'breathable',
  water: 'rivers',
  farming: 'soil',
  construction: 'standard',
  baseSurvivalCost: 'low',
});

/** Kazakh steppe — Virgin Lands Campaign, marginal agricultural land. */
export const TERRAIN_STEPPE: Readonly<TerrainProfile> = Object.freeze({
  gravity: 1.0,
  atmosphere: 'breathable',
  water: 'rivers',
  farming: 'soil',
  construction: 'standard',
  baseSurvivalCost: 'high',
});

/** Arctic settlement — extreme cold, limited farming. */
export const TERRAIN_ARCTIC: Readonly<TerrainProfile> = Object.freeze({
  gravity: 1.0,
  atmosphere: 'breathable',
  water: 'ice_deposits',
  farming: 'greenhouse',
  construction: 'standard',
  baseSurvivalCost: 'very_high',
});

/** Lunar surface — pressurized domes, hydroponics only. */
export const TERRAIN_LUNAR: Readonly<TerrainProfile> = Object.freeze({
  gravity: 0.16,
  atmosphere: 'none',
  water: 'ice_deposits',
  farming: 'hydroponics',
  construction: 'pressurized_domes',
  baseSurvivalCost: 'extreme',
});

/** Mars — thin CO2 atmosphere, subsurface water, greenhouse farming. */
export const TERRAIN_MARS: Readonly<TerrainProfile> = Object.freeze({
  gravity: 0.38,
  atmosphere: 'thin_co2',
  water: 'subsurface',
  farming: 'greenhouse',
  construction: 'pressurized_domes',
  baseSurvivalCost: 'very_high',
});

/** Titan — thick nitrogen/methane atmosphere, methane lakes. */
export const TERRAIN_TITAN: Readonly<TerrainProfile> = Object.freeze({
  gravity: 0.14,
  atmosphere: 'thick_n2_ch4',
  water: 'methane_lakes',
  farming: 'impossible',
  construction: 'pressurized_domes',
  baseSurvivalCost: 'extreme',
});

/** Exoplanet — variable conditions, unknown territory. */
export const TERRAIN_EXOPLANET: Readonly<TerrainProfile> = Object.freeze({
  gravity: 1.0,
  atmosphere: 'variable',
  water: 'variable',
  farming: 'variable',
  construction: 'variable',
  baseSurvivalCost: 'variable',
});

// ─── Survival Cost Multipliers ──────────────────────────────────────────────

/** Maps baseSurvivalCost to a numeric multiplier for consumption/production. */
export const SURVIVAL_COST_MULTIPLIER: Readonly<Record<TerrainProfile['baseSurvivalCost'], number>> = Object.freeze({
  low: 1.0,
  high: 1.5,
  very_high: 2.5,
  extreme: 4.0,
  variable: 2.0,
});

/** Maps farming type to food production efficiency (0-1). */
export const FARMING_EFFICIENCY: Readonly<Record<TerrainProfile['farming'], number>> = Object.freeze({
  soil: 1.0,
  greenhouse: 0.6,
  hydroponics: 0.4,
  impossible: 0.0,
  variable: 0.5,
});

/** Maps construction type to build time multiplier. */
export const CONSTRUCTION_MULTIPLIER: Readonly<Record<TerrainProfile['construction'], number>> = Object.freeze({
  standard: 1.0,
  pressurized_domes: 3.0,
  variable: 2.0,
});

// ─── Profile Lookup ──────────────────────────────────────────────────────────

/** Named terrain profile lookup (used by RelocationEngine.createFromBranch). */
const TERRAIN_PROFILES: Readonly<Record<string, Readonly<TerrainProfile>>> = {
  lunar: TERRAIN_LUNAR,
  martian: TERRAIN_MARS,
  exoplanet: TERRAIN_EXOPLANET,
  earth_temperate: TERRAIN_SIBERIA,
  earth_desert: TERRAIN_STEPPE,
  earth_arctic: TERRAIN_ARCTIC,
  orbital: TERRAIN_EXOPLANET,
  asteroid: TERRAIN_EXOPLANET,
  venusian: TERRAIN_TITAN,
};

/** Get a terrain profile by name string. Returns undefined for unknown names. */
export function getTerrainProfile(name: string): Readonly<TerrainProfile> | undefined {
  return TERRAIN_PROFILES[name];
}

/**
 * @module config/kardashevSubEras
 *
 * Kardashev sub-era definitions for the freeform eternal endgame.
 *
 * These 8 sub-eras replace the flat "the_eternal" era with a progressive
 * civilization scale from K 0.72 (post-Soviet) to K 2.0 (Type II peak).
 *
 * Sub-eras are ONLY reachable through freeform organic unlock transitions.
 * They are NOT part of ERA_ORDER or eras.json — historical mode never sees them.
 */

import type { EraDefinition, EraId } from '../game/era/types';

/** Kardashev sub-era IDs in progression order. */
export const KARDASHEV_ORDER: readonly EraId[] = [
  'post_soviet',
  'planetary',
  'solar_engineering',
  'type_one',
  'deconstruction',
  'dyson_swarm',
  'megaearth',
  'type_two_peak',
] as const;

/** Kardashev scale range per sub-era. */
export const KARDASHEV_SCALE: Record<string, { min: number; max: number }> = {
  post_soviet: { min: 0.72, max: 0.8 },
  planetary: { min: 0.8, max: 0.9 },
  solar_engineering: { min: 0.9, max: 1.0 },
  type_one: { min: 1.0, max: 1.0 },
  deconstruction: { min: 1.0, max: 1.5 },
  dyson_swarm: { min: 1.5, max: 1.8 },
  megaearth: { min: 1.8, max: 2.0 },
  type_two_peak: { min: 2.0, max: 2.0 },
};

/** Check if an era ID is a Kardashev sub-era. */
export function isKardashevSubEra(eraId: string): boolean {
  return (KARDASHEV_ORDER as readonly string[]).includes(eraId);
}

/**
 * Resolve a legacy "the_eternal" era to the first Kardashev sub-era.
 * Used for backward compatibility when loading old saves.
 */
export function resolveEternalToSubEra(eraId: EraId): EraId {
  return eraId === 'the_eternal' ? 'post_soviet' : eraId;
}

/**
 * Full EraDefinition entries for each Kardashev sub-era.
 * These get merged into ERA_DEFINITIONS at load time.
 */
export const KARDASHEV_ERA_DEFINITIONS: Record<string, EraDefinition> = {
  post_soviet: {
    id: 'post_soviet',
    name: 'Post-Soviet Transition',
    startYear: 1991,
    endYear: 2100,
    doctrine: 'eternal',
    deliveryRates: { food: 0.15, vodka: 0.1, money: 0.2 },
    quotaEscalation: 1.05,
    unlockedBuildings: ['colony-dome', 'colony-workshop'],
    modifiers: {
      productionMult: 1.1,
      consumptionMult: 0.9,
      decayMult: 1.3,
      populationGrowthMult: 0.8,
      eventFrequencyMult: 1.1,
      corruptionMult: 1.5,
    },
    constructionMethod: 'industrial',
    constructionTimeMult: 0.7,
    introTitle: 'ASSIGNMENT: POST-SOVIET APPARATUS',
    introText: 'The USSR persists. The world pretends not to notice. Your settlement enters an era of confused continuity — the forms remain, the substance evaporates. Somehow, you must modernize without admitting anything was wrong.',
    briefingFlavor: 'The Party congratulates itself on surviving what never happened.',
  },

  planetary: {
    id: 'planetary',
    name: 'Planetary Integration',
    startYear: 2100,
    endYear: 2500,
    doctrine: 'eternal',
    deliveryRates: { food: 0.1, vodka: 0.08, money: 0.15 },
    quotaEscalation: 1.08,
    unlockedBuildings: ['colony-hydroponics', 'colony-solar'],
    modifiers: {
      productionMult: 1.5,
      consumptionMult: 0.85,
      decayMult: 1.0,
      populationGrowthMult: 0.7,
      eventFrequencyMult: 0.9,
      corruptionMult: 1.2,
    },
    constructionMethod: 'automated',
    constructionTimeMult: 0.5,
    introTitle: 'DIRECTIVE: PLANETARY COMMITTEE',
    introText: 'National boundaries dissolve into administrative districts. Your settlement is now a node in a planetary network. The Politburo becomes the Planetary Committee. The paperwork, naturally, increases.',
    briefingFlavor: 'Globalization, but make it Soviet.',
  },

  solar_engineering: {
    id: 'solar_engineering',
    name: 'Solar Engineering',
    startYear: 2500,
    endYear: 5000,
    doctrine: 'eternal',
    deliveryRates: { food: 0.08, vodka: 0.05, money: 0.1 },
    quotaEscalation: 1.1,
    unlockedBuildings: ['colony-reactor', 'colony-fusion', 'colony-antenna'],
    modifiers: {
      productionMult: 2.0,
      consumptionMult: 0.8,
      decayMult: 0.8,
      populationGrowthMult: 0.6,
      eventFrequencyMult: 0.8,
      corruptionMult: 1.0,
    },
    constructionMethod: 'automated',
    constructionTimeMult: 0.4,
    introTitle: 'ENGINEERING BUREAU ORDER NO. 7,412',
    introText: 'The sun itself is now a resource to be managed. Orbital mirrors, solar collectors, asteroid mining — all require central planning. The Five-Year Plan now spans decades. Your settlement commands a small portion of the solar budget.',
    briefingFlavor: 'The sun rises when the Committee says it rises.',
  },

  type_one: {
    id: 'type_one',
    name: 'Type I Civilization',
    startYear: 5000,
    endYear: 5000,
    doctrine: 'eternal',
    deliveryRates: { food: 0.05, vodka: 0.03, money: 0.08 },
    quotaEscalation: 1.12,
    unlockedBuildings: ['colony-command', 'comms-array'],
    modifiers: {
      productionMult: 2.5,
      consumptionMult: 0.75,
      decayMult: 0.6,
      populationGrowthMult: 0.5,
      eventFrequencyMult: 0.7,
      corruptionMult: 0.8,
    },
    constructionMethod: 'automated',
    constructionTimeMult: 0.3,
    introTitle: 'CIVILIZATION MILESTONE: TYPE I',
    introText: 'Humanity harnesses the full energy output of Earth. The Kardashev threshold is crossed. Scarcity is a memory. And yet — quotas persist. The Committee meets to discuss the allocation of infinite resources. The meeting runs long.',
    briefingFlavor: 'Post-scarcity, pre-post-bureaucracy.',
  },

  deconstruction: {
    id: 'deconstruction',
    name: 'Planetary Deconstruction',
    startYear: 5000,
    endYear: 20000,
    doctrine: 'eternal',
    deliveryRates: { food: 0.03, vodka: 0.02, money: 0.05 },
    quotaEscalation: 1.15,
    unlockedBuildings: ['space-module', 'launch-pad'],
    modifiers: {
      productionMult: 3.0,
      consumptionMult: 0.7,
      decayMult: 0.5,
      populationGrowthMult: 0.4,
      eventFrequencyMult: 0.6,
      corruptionMult: 0.6,
    },
    constructionMethod: 'nanoscale',
    constructionTimeMult: 0.25,
    introTitle: 'DECONSTRUCTION COMMITTEE ORDER',
    introText: 'Planets are raw material. Mercury is being dismantled for its metals. Venus is undergoing atmospheric conversion. Mars is a suburb. Your settlement oversees a segment of the great disassembly. The forms must still be filed.',
    briefingFlavor: 'We are taking apart the planets. Paperwork required.',
  },

  dyson_swarm: {
    id: 'dyson_swarm',
    name: 'Dyson Swarm Era',
    startYear: 20000,
    endYear: 50000,
    doctrine: 'eternal',
    deliveryRates: { food: 0.02, vodka: 0.01, money: 0.03 },
    quotaEscalation: 1.18,
    unlockedBuildings: ['spacestation-01', 'spacestation-02'],
    modifiers: {
      productionMult: 4.0,
      consumptionMult: 0.6,
      decayMult: 0.4,
      populationGrowthMult: 0.3,
      eventFrequencyMult: 0.5,
      corruptionMult: 0.4,
    },
    constructionMethod: 'nanoscale',
    constructionTimeMult: 0.2,
    introTitle: 'SWARM ADMINISTRATION NOTICE',
    introText: 'The sun is enclosed. A trillion habitats orbit in formation. Each one files quarterly reports. Your settlement is station 4,712,883 in Sector 7. The view is spectacular. The bureaucracy is eternal.',
    briefingFlavor: 'A trillion habitats. A trillion forms.',
  },

  megaearth: {
    id: 'megaearth',
    name: 'MegaEarth Construction',
    startYear: 50000,
    endYear: 100000,
    doctrine: 'eternal',
    deliveryRates: { food: 0.01, vodka: 0.01, money: 0.02 },
    quotaEscalation: 1.2,
    unlockedBuildings: ['spacestation-03', 'spacestation-04'],
    modifiers: {
      productionMult: 4.5,
      consumptionMult: 0.5,
      decayMult: 0.3,
      populationGrowthMult: 0.2,
      eventFrequencyMult: 0.4,
      corruptionMult: 0.3,
    },
    constructionMethod: 'nanoscale',
    constructionTimeMult: 0.15,
    introTitle: 'MEGASTRUCTURE COMMISSION',
    introText: 'The Committee has approved construction of a new planet. Materials sourced from the Kuiper Belt. Completion estimated at 8,000 years. Your settlement provides administrative oversight for hull panel sector 42.',
    briefingFlavor: 'Building a planet. Ahead of schedule, of course.',
  },

  type_two_peak: {
    id: 'type_two_peak',
    name: 'Type II: Solar Dominion',
    startYear: 100000,
    endYear: -1,
    doctrine: 'eternal',
    deliveryRates: { food: 0.01, vodka: 0.01, money: 0.01 },
    quotaEscalation: 1.25,
    unlockedBuildings: ['spacestation-06', 'colony-synthplant'],
    modifiers: {
      productionMult: 5.0,
      consumptionMult: 0.4,
      decayMult: 0.2,
      populationGrowthMult: 0.15,
      eventFrequencyMult: 0.3,
      corruptionMult: 0.2,
    },
    constructionMethod: 'nanoscale',
    constructionTimeMult: 0.1,
    introTitle: 'ETERNAL COMMITTEE: FINAL NOTICE',
    introText: 'The entire energy output of the sun is harnessed. The solar system is a single administrative unit. There is nothing left to build. There is nothing left to conquer. And yet the Committee meets. It has always met. It will always meet. You file your report.',
    briefingFlavor: 'Civilization is complete. The meeting continues.',
  },
};

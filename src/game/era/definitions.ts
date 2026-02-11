/**
 * @module game/era/definitions
 *
 * ERA_DEFINITIONS and ERA_ORDER — the complete configuration for all
 * 8 historical eras of the Soviet campaign.
 */

import type { SettlementTier } from '../SettlementSystem';
import { getBuildingTierRequirement, tierMeetsRequirement } from './tiers';
import type { EraDefinition, EraId } from './types';

// ─── ERA ORDER ──────────────────────────────────────────────────────────────

/** Eras in chronological order. */
export const ERA_ORDER: readonly EraId[] = [
  'war_communism',
  'first_plans',
  'great_patriotic',
  'reconstruction',
  'thaw',
  'stagnation',
  'perestroika',
  'eternal_soviet',
];

// ─── ALL BUILDING DEF IDS ───────────────────────────────────────────────────

/** Every building defId in the game, used to validate era assignments. */
export const ALL_BUILDING_IDS: readonly string[] = [
  'apartment-tower-a',
  'apartment-tower-b',
  'apartment-tower-c',
  'apartment-tower-d',
  'barracks',
  'bread-factory',
  'collective-farm-hq',
  'concrete-block',
  'cultural-palace',
  'factory-office',
  'fence',
  'fence-low',
  'fire-station',
  'government-hq',
  'guard-post',
  'gulag-admin',
  'hospital',
  'kgb-office',
  'ministry-office',
  'polyclinic',
  'post-office',
  'power-station',
  'radio-station',
  'school',
  'train-station',
  'vodka-distillery',
  'warehouse',
  'workers-club',
  'workers-house-a',
  'workers-house-b',
  'workers-house-c',
];

// ─── ERA DEFINITIONS ────────────────────────────────────────────────────────

export const ERA_DEFINITIONS: Readonly<Record<EraId, EraDefinition>> = {
  // ── WAR COMMUNISM (1922-1928) ─────────────────────────
  war_communism: {
    id: 'war_communism',
    name: 'War Communism',
    startYear: 1922,
    endYear: 1928,

    doctrine: 'revolutionary',
    deliveryRates: { food: 0.4, vodka: 0.3, money: 0.2 },
    quotaEscalation: 1.0,

    unlockedBuildings: [
      'workers-house-a',
      'workers-house-b',
      'collective-farm-hq',
      'power-station',
      'guard-post',
      'fence',
      'fence-low',
      'concrete-block',
    ],

    modifiers: {
      productionMult: 0.8,
      consumptionMult: 1.2,
      decayMult: 1.3,
      populationGrowthMult: 0.6,
      eventFrequencyMult: 1.5,
      corruptionMult: 0.5,
    },

    constructionMethod: 'manual',
    constructionTimeMult: 2.0,

    failureCondition: {
      description: 'All citizens starve before the first plan begins',
      check: (_meta, resources) => resources.population <= 0 && resources.food <= 0,
    },

    introTitle: 'Assignment: Revolutionary Settlement',
    introText:
      'Welcome to the beginning. There is no plan yet. There will be a plan. ' +
      'The plan will solve everything. Until then, improvise. Improvisation is ' +
      'temporarily permitted. Build what you can from what you have. What you ' +
      'have is: mud, hope, and an unreasonable number of potatoes. The potatoes ' +
      'are small. The hope is smaller.',
    briefingFlavor:
      "Chaos. NEP remnants. Famine risk. Build the foundation of the workers' paradise from scratch.",
  },

  // ── FIRST FIVE-YEAR PLANS (1928-1941) ─────────────────
  first_plans: {
    id: 'first_plans',
    name: 'First Five-Year Plans',
    startYear: 1928,
    endYear: 1941,

    doctrine: 'industrialization',
    deliveryRates: { food: 0.5, vodka: 0.4, money: 0.6 },
    quotaEscalation: 1.3,

    unlockedBuildings: [
      'workers-house-c',
      'bread-factory',
      'warehouse',
      'factory-office',
      'school',
      'barracks',
    ],

    modifiers: {
      productionMult: 1.2,
      consumptionMult: 1.0,
      decayMult: 1.1,
      populationGrowthMult: 0.8,
      eventFrequencyMult: 1.2,
      corruptionMult: 0.7,
    },

    constructionMethod: 'manual',
    constructionTimeMult: 2.0,

    victoryCondition: {
      description: 'Reach posyolok settlement tier with 100+ population',
      check: (meta, resources) => meta.settlementTier !== 'selo' && resources.population >= 100,
    },

    failureCondition: {
      description: 'Population drops below 10 during industrialization',
      check: (_meta, resources) => resources.population > 0 && resources.population < 10,
    },

    introTitle: 'Assignment: First Five-Year Plan',
    introText:
      'The Plan has arrived. It is ambitious. It is necessary. It is, ' +
      'technically, impossible given current resources, but impossibility ' +
      'is a bourgeois concept. You will build factories. The factories will ' +
      'build more factories. The second factories will build things that ' +
      'are not factories. What those things are has not been decided. ' +
      'Decide quickly. The Plan does not wait.',
    briefingFlavor:
      'Industrialization at gunpoint. Collectivization. Quotas that exist in a dimension where math is optional.',
  },

  // ── GREAT PATRIOTIC WAR (1941-1945) ───────────────────
  great_patriotic: {
    id: 'great_patriotic',
    name: 'Great Patriotic War',
    startYear: 1941,
    endYear: 1945,

    doctrine: 'wartime',
    deliveryRates: { food: 0.7, vodka: 0.6, money: 0.7 },
    quotaEscalation: 1.5,

    unlockedBuildings: ['gulag-admin'],

    modifiers: {
      productionMult: 0.6,
      consumptionMult: 1.5,
      decayMult: 1.5,
      populationGrowthMult: 0.3,
      eventFrequencyMult: 2.0,
      corruptionMult: 0.3,
    },

    constructionMethod: 'mechanized',
    constructionTimeMult: 1.0,

    victoryCondition: {
      description: 'Survive to 1945 with at least 25 population',
      check: (meta, resources) => meta.date.year >= 1945 && resources.population >= 25,
    },

    failureCondition: {
      description: 'Population reaches zero during the war',
      check: (_meta, resources) => resources.population <= 0,
    },

    introTitle: 'Assignment: War Economy',
    introText:
      'The Motherland is under attack. All resources are redirected to defense. ' +
      'Your citizens are also resources. They have been redirected. Food is rationed. ' +
      'Vodka is rationed. Hope is rationed but remains available in unlimited theoretical ' +
      'quantities. Your task is simple: survive. Everything else is a luxury. ' +
      'Luxuries have been suspended for the duration.',
    briefingFlavor:
      'Total war economy. Conscription. Rationing. Survival is the only quota that matters.',
  },

  // ── RECONSTRUCTION (1945-1953) ────────────────────────
  reconstruction: {
    id: 'reconstruction',
    name: 'Reconstruction',
    startYear: 1945,
    endYear: 1953,

    doctrine: 'reconstruction',
    deliveryRates: { food: 0.35, vodka: 0.25, money: 0.3 },
    quotaEscalation: 1.2,

    unlockedBuildings: [
      'apartment-tower-a',
      'hospital',
      'government-hq',
      'ministry-office',
      'train-station',
    ],

    modifiers: {
      productionMult: 1.0,
      consumptionMult: 0.9,
      decayMult: 0.8,
      populationGrowthMult: 1.2,
      eventFrequencyMult: 0.8,
      corruptionMult: 0.5,
    },

    constructionMethod: 'mechanized',
    constructionTimeMult: 1.0,

    victoryCondition: {
      description: 'Reach PGT settlement tier',
      check: (meta) => meta.settlementTier === 'pgt' || meta.settlementTier === 'gorod',
    },

    introTitle: 'Assignment: Post-War Reconstruction',
    introText:
      'The war is over. The victory is complete. The rubble is also complete. ' +
      'There is a great deal of rubble. Your task is to transform the rubble ' +
      'into buildings and the buildings into a city and the city into a symbol ' +
      'of Soviet resilience. The symbol should be made of concrete. Everything ' +
      'should be made of concrete. Concrete is the material of the future. ' +
      'The future is grey.',
    briefingFlavor:
      'Rebuilding from ashes. Stalinist architecture. Paranoia as a management style.',
  },

  // ── THE THAW (1953-1964) ──────────────────────────────
  thaw: {
    id: 'thaw',
    name: 'The Thaw',
    startYear: 1953,
    endYear: 1964,

    doctrine: 'thaw',
    deliveryRates: { food: 0.3, vodka: 0.2, money: 0.25 },
    quotaEscalation: 1.1,

    unlockedBuildings: [
      'apartment-tower-b',
      'polyclinic',
      'workers-club',
      'post-office',
      'cultural-palace',
    ],

    modifiers: {
      productionMult: 1.3,
      consumptionMult: 0.8,
      decayMult: 0.7,
      populationGrowthMult: 1.5,
      eventFrequencyMult: 0.7,
      corruptionMult: 0.4,
    },

    constructionMethod: 'industrial',
    constructionTimeMult: 0.6,

    victoryCondition: {
      description: 'Reach 300+ population with positive food and vodka',
      check: (_meta, resources) =>
        resources.population >= 300 && resources.food > 0 && resources.vodka > 0,
    },

    introTitle: 'Assignment: De-Stalinization',
    introText:
      'A new era begins. The previous era has been reclassified as "overly ' +
      'enthusiastic." Certain portraits are being removed from certain walls. ' +
      'Certain names are being removed from certain cities. Certain people are ' +
      'being removed from certain places they should not have been in the first ' +
      'place. Things are warming up. The permafrost remains, but the political ' +
      'climate thaws. Temporarily. Everything is temporarily.',
    briefingFlavor: 'Khrushchev. De-Stalinization. The space race. Brief, suspicious optimism.',
  },

  // ── STAGNATION (1964-1985) ────────────────────────────
  stagnation: {
    id: 'stagnation',
    name: 'Era of Stagnation',
    startYear: 1964,
    endYear: 1985,

    doctrine: 'stagnation',
    deliveryRates: { food: 0.45, vodka: 0.4, money: 0.5 },
    quotaEscalation: 1.15,

    unlockedBuildings: [
      'apartment-tower-c',
      'kgb-office',
      'radio-station',
      'vodka-distillery',
      'fire-station',
    ],

    modifiers: {
      productionMult: 0.9,
      consumptionMult: 1.1,
      decayMult: 1.4,
      populationGrowthMult: 0.7,
      eventFrequencyMult: 1.0,
      corruptionMult: 1.5,
    },

    constructionMethod: 'industrial',
    constructionTimeMult: 0.6,

    failureCondition: {
      description: 'Infrastructure collapses: 0 power with 200+ population',
      check: (_meta, resources) => resources.power <= 0 && resources.population >= 200,
    },

    introTitle: 'Assignment: Developed Socialism',
    introText:
      'Nothing is wrong. Everything is stable. The economy is stable. ' +
      'The leadership is stable. The buildings are less stable, but their ' +
      'instability is itself stable. Vodka production has never been higher. ' +
      'This is considered the golden age. The gold is actually tin. The tin ' +
      'is actually rust. But the vodka is real. The vodka is always real.',
    briefingFlavor: 'Brezhnev. Corruption. Decay. The golden age of vodka and creative accounting.',
  },

  // ── PERESTROIKA (1985-1991) ───────────────────────────
  perestroika: {
    id: 'perestroika',
    name: 'Perestroika',
    startYear: 1985,
    endYear: 1991,

    doctrine: 'freeze',
    deliveryRates: { food: 0.45, vodka: 0.35, money: 0.5 },
    quotaEscalation: 1.4,

    // No new buildings — the era of trying to fix what exists
    unlockedBuildings: [],

    modifiers: {
      productionMult: 0.7,
      consumptionMult: 1.3,
      decayMult: 1.2,
      populationGrowthMult: 0.5,
      eventFrequencyMult: 1.8,
      corruptionMult: 1.2,
    },

    constructionMethod: 'decaying',
    constructionTimeMult: 1.5,

    failureCondition: {
      description: 'Food and vodka both reach zero',
      check: (_meta, resources) => resources.food <= 0 && resources.vodka <= 0,
    },

    introTitle: 'Assignment: Restructuring',
    introText:
      'The system is being reformed. The reforms are reforming the reforms. ' +
      'Nobody is sure what the reforms are reforming or whether reforming is ' +
      'itself a reform. Openness has been declared. The openness reveals that ' +
      'everything behind the curtain was held together with string and optimism. ' +
      'The string has snapped. The optimism was never structural.',
    briefingFlavor:
      'Gorbachev. Reform attempts. Shortages. The system discovers it is the problem.',
  },

  // ── THE ETERNAL SOVIET (1991+) ────────────────────────
  eternal_soviet: {
    id: 'eternal_soviet',
    name: 'The Eternal Soviet',
    startYear: 1991,
    endYear: -1,

    doctrine: 'eternal',
    deliveryRates: { food: 0.4, vodka: 0.35, money: 0.4 },
    quotaEscalation: 1.25,

    unlockedBuildings: ['apartment-tower-d'],

    modifiers: {
      productionMult: 1.0,
      consumptionMult: 1.0,
      decayMult: 1.0,
      populationGrowthMult: 1.0,
      eventFrequencyMult: 1.3,
      corruptionMult: 1.0,
    },

    constructionMethod: 'decaying',
    constructionTimeMult: 1.5,

    introTitle: 'Assignment: Eternal Maintenance',
    introText:
      'The Union did not fall. It was renovated. The renovation is ongoing. ' +
      'It will always be ongoing. You are part of the renovation. Do not stop ' +
      'renovating. The world outside has changed. The world inside has not. ' +
      'This is considered a feature. The feature is made of concrete. ' +
      'The concrete is eternal. You are less so, but your paperwork will outlive you.',
    briefingFlavor:
      'The USSR that never fell. Increasingly absurd. The bureaucracy has achieved sentience.',
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Returns the era index in ERA_ORDER for a given year.
 * Searches backwards so later eras take priority.
 */
export function eraIndexForYear(year: number): number {
  for (let i = ERA_ORDER.length - 1; i >= 0; i--) {
    const eraId = ERA_ORDER[i]!;
    const def = ERA_DEFINITIONS[eraId];
    if (year >= def.startYear) return i;
  }
  return 0;
}

/**
 * Pure utility: returns all building defIds available for a given year and
 * optional settlement tier. Used by the RadialBuildMenu to filter options
 * without needing an EraSystem instance.
 */
export function getAvailableBuildingsForYear(year: number, tier?: SettlementTier): string[] {
  const currentIdx = eraIndexForYear(year);
  const available: string[] = [];

  for (let i = 0; i <= currentIdx; i++) {
    const eraId = ERA_ORDER[i]!;
    const def = ERA_DEFINITIONS[eraId];
    available.push(...def.unlockedBuildings);
  }

  if (tier == null) return available;

  return available.filter((defId) => tierMeetsRequirement(tier, getBuildingTierRequirement(defId)));
}

/**
 * @module game/politburo/leaderModifiers
 *
 * General Secretary personality modifiers — direct gameplay effects
 * when a particular archetype holds supreme power.
 *
 * These are applied on top of the minister-level modifiers during
 * recalculateModifiers() in PolitburoSystem, with a fixed scale of 1.0
 * (no competence scaling — the GS always fully imposes their will).
 *
 * Based on the 11-archetype design doc (docs/design/leader-archetypes.md).
 * The 8 implemented archetypes match the PersonalityType enum.
 */

import type { ModifierOverride } from './types';
import { PersonalityType } from './types';

/**
 * LEADER_MODIFIERS: How the General Secretary's personality archetype
 * directly modifies gameplay multipliers.
 *
 * These represent the top-level "tone" of the regime:
 * - Zealot: heavy industry + terror, agriculture collapses
 * - Idealist: balanced but inefficient, high morale
 * - Reformer: market-like efficiency, reduced fear
 * - Technocrat: optimized production, neutral morale
 * - Apparatchik: bureaucratic decay, high corruption
 * - Populist: worker morale boost, lenient quotas
 * - Militarist: war economy, conscription
 * - Mystic: unpredictable, reduced competence
 */
export const LEADER_MODIFIERS: Record<PersonalityType, ModifierOverride> = {
  [PersonalityType.ZEALOT]: {
    factoryOutputMult: 1.3,
    foodProductionMult: 0.6,
    vodkaProductionMult: 0.8,
    purgeFrequencyMult: 2.5,
    fearLevel: 80,
    moraleModifier: -6,
    quotaDifficultyMult: 1.6,
    corruptionDrain: 10,
    populationGrowthMult: 0.8,
    propagandaIntensity: 90,
    artCensored: true,
  },

  [PersonalityType.IDEALIST]: {
    foodProductionMult: 1.1,
    vodkaProductionMult: 1.0,
    factoryOutputMult: 0.9,
    moraleModifier: 5,
    purgeFrequencyMult: 0.4,
    fearLevel: 20,
    quotaDifficultyMult: 0.8,
    populationGrowthMult: 1.2,
    pollutionMult: 0.8,
    propagandaIntensity: 40,
  },

  [PersonalityType.REFORMER]: {
    foodProductionMult: 1.3,
    vodkaProductionMult: 1.2,
    factoryOutputMult: 1.1,
    moraleModifier: 4,
    purgeFrequencyMult: 0.2,
    fearLevel: 15,
    corruptionDrain: 5,
    quotaDifficultyMult: 0.7,
    populationGrowthMult: 1.15,
    techResearchMult: 1.3,
    privateGardensAllowed: true,
    blackMarketTolerated: true,
    propagandaIntensity: 25,
  },

  [PersonalityType.TECHNOCRAT]: {
    foodProductionMult: 1.2,
    vodkaProductionMult: 1.0,
    factoryOutputMult: 1.3,
    moraleModifier: 0,
    purgeFrequencyMult: 0.8,
    fearLevel: 40,
    quotaDifficultyMult: 1.1,
    techResearchMult: 1.5,
    buildingCostMult: 0.85,
    accidentRate: 0.01,
    infrastructureDecayMult: 0.8,
    propagandaIntensity: 30,
  },

  [PersonalityType.APPARATCHIK]: {
    foodProductionMult: 0.9,
    vodkaProductionMult: 1.0,
    factoryOutputMult: 0.85,
    moraleModifier: -2,
    purgeFrequencyMult: 0.6,
    fearLevel: 35,
    corruptionDrain: 30,
    quotaDifficultyMult: 1.0,
    supplyChainDelayMult: 1.4,
    infrastructureDecayMult: 1.3,
    propagandaIntensity: 55,
  },

  [PersonalityType.POPULIST]: {
    foodProductionMult: 1.1,
    vodkaProductionMult: 1.3,
    factoryOutputMult: 0.95,
    moraleModifier: 7,
    purgeFrequencyMult: 0.5,
    fearLevel: 20,
    quotaDifficultyMult: 0.6,
    populationGrowthMult: 1.2,
    privateGardensAllowed: true,
    vodkaRestricted: false,
    propagandaIntensity: 60,
  },

  [PersonalityType.MILITARIST]: {
    foodProductionMult: 0.8,
    vodkaProductionMult: 0.9,
    factoryOutputMult: 1.4,
    moraleModifier: -5,
    purgeFrequencyMult: 1.8,
    fearLevel: 70,
    conscriptionRate: 15,
    quotaDifficultyMult: 1.5,
    populationGrowthMult: 0.7,
    buildingCostMult: 0.7,
    propagandaIntensity: 85,
    artCensored: true,
  },

  [PersonalityType.MYSTIC]: {
    foodProductionMult: 0.8,
    vodkaProductionMult: 1.1,
    factoryOutputMult: 0.7,
    moraleModifier: -1,
    purgeFrequencyMult: 1.2,
    fearLevel: 50,
    quotaDifficultyMult: 1.0,
    techResearchMult: 0.5,
    hospitalEffectiveness: 0.6,
    accidentRate: 0.04,
    propagandaIntensity: 65,
  },
};

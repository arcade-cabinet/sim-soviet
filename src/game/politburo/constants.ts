/**
 * @module game/politburo/constants
 *
 * All constant declarations: modifier tables, interaction matrices,
 * tension rules, appointment strategies, and name/stat tables.
 */

import {
  type AppointmentStrategy,
  Ministry,
  type MinistryModifiers,
  type ModifierOverride,
  PersonalityType,
  type TensionRule,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
//  MINISTRY NAMES
// ─────────────────────────────────────────────────────────────────────────────

/** Human-readable ministry names for UI display. */
export const MINISTRY_NAMES: Record<Ministry, string> = {
  [Ministry.KGB]: 'KGB Chairman',
  [Ministry.AGRICULTURE]: 'Minister of Agriculture',
  [Ministry.HEAVY_INDUSTRY]: 'Minister of Heavy Industry',
  [Ministry.CULTURE]: 'Minister of Culture',
  [Ministry.DEFENSE]: 'Minister of Defense',
  [Ministry.MVD]: 'Minister of Internal Affairs (MVD)',
  [Ministry.GOSPLAN]: 'Chairman of Gosplan',
  [Ministry.HEALTH]: 'Minister of Health',
  [Ministry.EDUCATION]: 'Minister of Education',
  [Ministry.TRANSPORT]: 'Minister of Transport',
};

// ─────────────────────────────────────────────────────────────────────────────
//  DEFAULT MODIFIERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default (neutral) modifiers — an empty chair would produce these.
 */
export const DEFAULT_MODIFIERS: MinistryModifiers = {
  foodProductionMult: 1.0,
  vodkaProductionMult: 1.0,
  factoryOutputMult: 1.0,
  buildingCostMult: 1.0,
  techResearchMult: 1.0,
  moraleModifier: 0,
  purgeFrequencyMult: 1.0,
  fearLevel: 30,
  surveillanceRate: 4,
  conscriptionRate: 5,
  crimeRate: 30,
  corruptionDrain: 0,
  quotaDifficultyMult: 1.0,
  populationGrowthMult: 1.0,
  supplyChainDelayMult: 1.0,
  infrastructureDecayMult: 1.0,
  pollutionMult: 1.0,
  accidentRate: 0.02,
  hospitalEffectiveness: 1.0,
  literacyRate: 70,
  privateGardensAllowed: false,
  vodkaRestricted: false,
  blackMarketTolerated: false,
  artCensored: false,
  propagandaIntensity: 50,
};

// ─────────────────────────────────────────────────────────────────────────────
//  PERSONALITY x MINISTRY INTERACTION MATRIX
// ─────────────────────────────────────────────────────────────────────────────
//
//  This is the core design table. For each (Ministry, Personality) pair,
//  we define how that personality archetype modifies the ministry's domain.
//
//  Format: Partial<MinistryModifiers> — only override what changes.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PERSONALITY x MINISTRY MODIFIER TABLE
 *
 * ┌──────────────┬─────────┬──────────┬──────────┬────────────┬─────────────┬──────────┬───────────┬────────┐
 * │              │ ZEALOT  │ IDEALIST │ REFORMER │ TECHNOCRAT │ APPARATCHIK │ POPULIST │MILITARIST │ MYSTIC │
 * ├──────────────┼─────────┼──────────┼──────────┼────────────┼─────────────┼──────────┼───────────┼────────┤
 * │ KGB          │ terror  │ gentle   │ open     │ efficient  │ status quo  │ populace │ martial   │ occult │
 * │ Agriculture  │ collctv │ commune  │ private  │ science    │ decline     │ gardens  │ requisitn │ rituals│
 * │ Heavy Ind.   │ quotas! │ green    │ modernize│ automate   │ paperwork   │ jobs     │ tanks     │ alchemy│
 * │ Culture      │ censor  │ utopian  │ freedom  │ functional │ approved    │ folk     │ patriotic │ mystic │
 * │ Defense      │ purge   │ pacifist │ reduce   │ precision  │ maintain    │ militia  │ expand    │ astral │
 * │ MVD          │ police  │ justice  │ lenient  │ database   │ bribe       │ community│ martial   │ omens  │
 * │ Gosplan      │ maximum │ fair     │ flexible │ optimal    │ same plan   │ popular  │ war econ  │ divine │
 * │ Health       │ purify  │ universal│ western  │ evidence   │ vodka ok    │ free vdk │ spartan   │ herbs  │
 * │ Education    │ indoctri│ enlightn │ liberal  │ STEM       │ rote        │ practical│ military  │ esotric│
 * │ Transport    │ forced  │ public   │ reform   │ rail       │ decay       │ bus      │ logistic  │ ley    │
 * └──────────────┴─────────┴──────────┴──────────┴────────────┴─────────────┴──────────┴───────────┴────────┘
 */
export const PERSONALITY_MINISTRY_MATRIX: Record<Ministry, Record<PersonalityType, ModifierOverride>> = {
  // ════════════════════════════════════════════════════════════════════════════
  // KGB CHAIRMAN
  // Controls: fear level, purge frequency, surveillance events, disappearances
  // ════════════════════════════════════════════════════════════════════════════
  [Ministry.KGB]: {
    [PersonalityType.ZEALOT]: {
      fearLevel: 85,
      purgeFrequencyMult: 3.0,
      surveillanceRate: 12,
      moraleModifier: -5,
      propagandaIntensity: 90,
    },
    [PersonalityType.IDEALIST]: {
      fearLevel: 40,
      purgeFrequencyMult: 0.5,
      surveillanceRate: 6,
      moraleModifier: 2,
      propagandaIntensity: 60,
    },
    [PersonalityType.REFORMER]: {
      fearLevel: 20,
      purgeFrequencyMult: 0.2,
      surveillanceRate: 2,
      moraleModifier: 5,
      crimeRate: 45,
      propagandaIntensity: 30,
    },
    [PersonalityType.TECHNOCRAT]: {
      fearLevel: 55,
      purgeFrequencyMult: 1.0,
      surveillanceRate: 20,
      moraleModifier: -2,
      crimeRate: 15,
      propagandaIntensity: 40,
    },
    [PersonalityType.APPARATCHIK]: {
      fearLevel: 45,
      purgeFrequencyMult: 0.8,
      surveillanceRate: 4,
      moraleModifier: 0,
      propagandaIntensity: 50,
    },
    [PersonalityType.POPULIST]: {
      fearLevel: 30,
      purgeFrequencyMult: 0.6,
      surveillanceRate: 3,
      moraleModifier: 3,
      propagandaIntensity: 70,
    },
    [PersonalityType.MILITARIST]: {
      fearLevel: 75,
      purgeFrequencyMult: 2.0,
      surveillanceRate: 10,
      moraleModifier: -3,
      conscriptionRate: 12,
      propagandaIntensity: 80,
    },
    [PersonalityType.MYSTIC]: {
      fearLevel: 60,
      purgeFrequencyMult: 1.5,
      surveillanceRate: 8,
      moraleModifier: -1,
      propagandaIntensity: 65,
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // MINISTER OF AGRICULTURE
  // Controls: food production, kolkhoz efficiency, private garden policy
  // ════════════════════════════════════════════════════════════════════════════
  [Ministry.AGRICULTURE]: {
    [PersonalityType.ZEALOT]: {
      foodProductionMult: 0.7,
      privateGardensAllowed: false,
      moraleModifier: -3,
    },
    [PersonalityType.IDEALIST]: {
      foodProductionMult: 0.9,
      privateGardensAllowed: false,
      moraleModifier: 1,
    },
    [PersonalityType.REFORMER]: {
      foodProductionMult: 1.4,
      privateGardensAllowed: true,
      moraleModifier: 4,
    },
    [PersonalityType.TECHNOCRAT]: {
      foodProductionMult: 1.3,
      privateGardensAllowed: false,
      moraleModifier: 0,
    },
    [PersonalityType.APPARATCHIK]: {
      foodProductionMult: 0.85,
      privateGardensAllowed: false,
      moraleModifier: -1,
    },
    [PersonalityType.POPULIST]: {
      foodProductionMult: 1.1,
      privateGardensAllowed: true,
      moraleModifier: 3,
    },
    [PersonalityType.MILITARIST]: {
      foodProductionMult: 0.8,
      privateGardensAllowed: false,
      conscriptionRate: 10,
      moraleModifier: -4,
    },
    [PersonalityType.MYSTIC]: {
      foodProductionMult: 0.75,
      privateGardensAllowed: false,
      moraleModifier: -2,
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // MINISTER OF HEAVY INDUSTRY
  // Controls: factory output, pollution, building costs, industrial accidents
  // ════════════════════════════════════════════════════════════════════════════
  [Ministry.HEAVY_INDUSTRY]: {
    [PersonalityType.ZEALOT]: {
      factoryOutputMult: 1.5,
      pollutionMult: 2.0,
      buildingCostMult: 0.8,
      accidentRate: 0.08,
      moraleModifier: -3,
    },
    [PersonalityType.IDEALIST]: {
      factoryOutputMult: 0.8,
      pollutionMult: 0.5,
      buildingCostMult: 1.3,
      accidentRate: 0.01,
      moraleModifier: 2,
    },
    [PersonalityType.REFORMER]: {
      factoryOutputMult: 1.2,
      pollutionMult: 0.8,
      buildingCostMult: 1.1,
      accidentRate: 0.02,
      techResearchMult: 1.3,
      moraleModifier: 1,
    },
    [PersonalityType.TECHNOCRAT]: {
      factoryOutputMult: 1.4,
      pollutionMult: 1.0,
      buildingCostMult: 0.9,
      accidentRate: 0.015,
      techResearchMult: 1.5,
      moraleModifier: 0,
    },
    [PersonalityType.APPARATCHIK]: {
      factoryOutputMult: 0.9,
      pollutionMult: 1.2,
      buildingCostMult: 1.2,
      accidentRate: 0.04,
      moraleModifier: -1,
    },
    [PersonalityType.POPULIST]: {
      factoryOutputMult: 1.0,
      pollutionMult: 1.0,
      buildingCostMult: 1.0,
      accidentRate: 0.03,
      moraleModifier: 2,
    },
    [PersonalityType.MILITARIST]: {
      factoryOutputMult: 1.6,
      pollutionMult: 1.8,
      buildingCostMult: 0.7,
      accidentRate: 0.06,
      moraleModifier: -4,
    },
    [PersonalityType.MYSTIC]: {
      factoryOutputMult: 0.7,
      pollutionMult: 0.9,
      buildingCostMult: 1.4,
      accidentRate: 0.05,
      moraleModifier: -1,
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // MINISTER OF CULTURE
  // Controls: morale, banned items, propaganda effectiveness, art events
  // ════════════════════════════════════════════════════════════════════════════
  [Ministry.CULTURE]: {
    [PersonalityType.ZEALOT]: {
      moraleModifier: -4,
      artCensored: true,
      propagandaIntensity: 95,
    },
    [PersonalityType.IDEALIST]: {
      moraleModifier: 3,
      artCensored: false,
      propagandaIntensity: 40,
    },
    [PersonalityType.REFORMER]: {
      moraleModifier: 6,
      artCensored: false,
      propagandaIntensity: 20,
    },
    [PersonalityType.TECHNOCRAT]: {
      moraleModifier: 0,
      artCensored: false,
      propagandaIntensity: 30,
    },
    [PersonalityType.APPARATCHIK]: {
      moraleModifier: -1,
      artCensored: true,
      propagandaIntensity: 55,
    },
    [PersonalityType.POPULIST]: {
      moraleModifier: 4,
      artCensored: false,
      propagandaIntensity: 45,
      vodkaRestricted: false,
    },
    [PersonalityType.MILITARIST]: {
      moraleModifier: -2,
      artCensored: true,
      propagandaIntensity: 85,
    },
    [PersonalityType.MYSTIC]: {
      moraleModifier: 1,
      artCensored: true,
      propagandaIntensity: 60,
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // MINISTER OF DEFENSE
  // Controls: conscription, military spending, defense buildings, war readiness
  // ════════════════════════════════════════════════════════════════════════════
  [Ministry.DEFENSE]: {
    [PersonalityType.ZEALOT]: {
      conscriptionRate: 15,
      buildingCostMult: 0.7,
      moraleModifier: -3,
      populationGrowthMult: 0.8,
    },
    [PersonalityType.IDEALIST]: {
      conscriptionRate: 2,
      buildingCostMult: 1.2,
      moraleModifier: 2,
      populationGrowthMult: 1.1,
    },
    [PersonalityType.REFORMER]: {
      conscriptionRate: 3,
      buildingCostMult: 1.0,
      moraleModifier: 1,
      populationGrowthMult: 1.05,
    },
    [PersonalityType.TECHNOCRAT]: {
      conscriptionRate: 5,
      buildingCostMult: 0.85,
      moraleModifier: 0,
      techResearchMult: 1.4,
    },
    [PersonalityType.APPARATCHIK]: {
      conscriptionRate: 5,
      buildingCostMult: 1.1,
      moraleModifier: 0,
    },
    [PersonalityType.POPULIST]: {
      conscriptionRate: 4,
      buildingCostMult: 1.0,
      moraleModifier: 1,
    },
    [PersonalityType.MILITARIST]: {
      conscriptionRate: 20,
      buildingCostMult: 0.6,
      moraleModifier: -5,
      factoryOutputMult: 1.3,
      populationGrowthMult: 0.7,
    },
    [PersonalityType.MYSTIC]: {
      conscriptionRate: 5,
      buildingCostMult: 1.3,
      moraleModifier: -1,
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // MINISTER OF INTERNAL AFFAIRS (MVD)
  // Controls: crime rate, corruption, black market activity
  // ════════════════════════════════════════════════════════════════════════════
  [Ministry.MVD]: {
    [PersonalityType.ZEALOT]: {
      crimeRate: 10,
      corruptionDrain: 5,
      blackMarketTolerated: false,
      moraleModifier: -4,
      fearLevel: 70,
    },
    [PersonalityType.IDEALIST]: {
      crimeRate: 25,
      corruptionDrain: 10,
      blackMarketTolerated: false,
      moraleModifier: 2,
    },
    [PersonalityType.REFORMER]: {
      crimeRate: 35,
      corruptionDrain: 15,
      blackMarketTolerated: true,
      moraleModifier: 3,
    },
    [PersonalityType.TECHNOCRAT]: {
      crimeRate: 20,
      corruptionDrain: 8,
      blackMarketTolerated: false,
      moraleModifier: 0,
    },
    [PersonalityType.APPARATCHIK]: {
      crimeRate: 40,
      corruptionDrain: 25,
      blackMarketTolerated: true,
      moraleModifier: -1,
    },
    [PersonalityType.POPULIST]: {
      crimeRate: 30,
      corruptionDrain: 12,
      blackMarketTolerated: false,
      moraleModifier: 2,
    },
    [PersonalityType.MILITARIST]: {
      crimeRate: 15,
      corruptionDrain: 5,
      blackMarketTolerated: false,
      moraleModifier: -3,
      fearLevel: 65,
    },
    [PersonalityType.MYSTIC]: {
      crimeRate: 35,
      corruptionDrain: 20,
      blackMarketTolerated: true,
      moraleModifier: 0,
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // CHAIRMAN OF GOSPLAN (State Planning)
  // Controls: quota difficulty, resource allocation, 5-year plan targets
  // ════════════════════════════════════════════════════════════════════════════
  [Ministry.GOSPLAN]: {
    [PersonalityType.ZEALOT]: {
      quotaDifficultyMult: 2.0,
      moraleModifier: -3,
      factoryOutputMult: 1.1,
    },
    [PersonalityType.IDEALIST]: {
      quotaDifficultyMult: 0.8,
      moraleModifier: 1,
    },
    [PersonalityType.REFORMER]: {
      quotaDifficultyMult: 0.7,
      moraleModifier: 3,
      foodProductionMult: 1.1,
      vodkaProductionMult: 1.1,
    },
    [PersonalityType.TECHNOCRAT]: {
      quotaDifficultyMult: 1.2,
      moraleModifier: 0,
      factoryOutputMult: 1.2,
      foodProductionMult: 1.1,
    },
    [PersonalityType.APPARATCHIK]: {
      quotaDifficultyMult: 1.0,
      moraleModifier: -1,
    },
    [PersonalityType.POPULIST]: {
      quotaDifficultyMult: 0.6,
      moraleModifier: 4,
    },
    [PersonalityType.MILITARIST]: {
      quotaDifficultyMult: 1.8,
      moraleModifier: -4,
      factoryOutputMult: 1.3,
    },
    [PersonalityType.MYSTIC]: {
      quotaDifficultyMult: 1.1,
      moraleModifier: -1,
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // MINISTER OF HEALTH
  // Controls: population growth, vodka policy, hospitals, life expectancy
  // ════════════════════════════════════════════════════════════════════════════
  [Ministry.HEALTH]: {
    [PersonalityType.ZEALOT]: {
      populationGrowthMult: 0.9,
      vodkaRestricted: true,
      hospitalEffectiveness: 0.6,
      moraleModifier: -3,
    },
    [PersonalityType.IDEALIST]: {
      populationGrowthMult: 1.2,
      vodkaRestricted: false,
      hospitalEffectiveness: 1.3,
      moraleModifier: 2,
    },
    [PersonalityType.REFORMER]: {
      populationGrowthMult: 1.3,
      vodkaRestricted: true,
      hospitalEffectiveness: 1.5,
      moraleModifier: 1,
    },
    [PersonalityType.TECHNOCRAT]: {
      populationGrowthMult: 1.2,
      vodkaRestricted: false,
      hospitalEffectiveness: 1.4,
      moraleModifier: 0,
    },
    [PersonalityType.APPARATCHIK]: {
      populationGrowthMult: 1.0,
      vodkaRestricted: false,
      hospitalEffectiveness: 0.8,
      moraleModifier: 0,
    },
    [PersonalityType.POPULIST]: {
      populationGrowthMult: 1.1,
      vodkaRestricted: false,
      hospitalEffectiveness: 1.0,
      moraleModifier: 3,
      vodkaProductionMult: 1.3,
    },
    [PersonalityType.MILITARIST]: {
      populationGrowthMult: 0.85,
      vodkaRestricted: true,
      hospitalEffectiveness: 0.7,
      moraleModifier: -2,
    },
    [PersonalityType.MYSTIC]: {
      populationGrowthMult: 0.9,
      vodkaRestricted: false,
      hospitalEffectiveness: 0.5,
      moraleModifier: -1,
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // MINISTER OF EDUCATION
  // Controls: tech speed, literacy, schools, ideological purity
  // ════════════════════════════════════════════════════════════════════════════
  [Ministry.EDUCATION]: {
    [PersonalityType.ZEALOT]: {
      techResearchMult: 0.6,
      literacyRate: 60,
      moraleModifier: -3,
      propagandaIntensity: 90,
    },
    [PersonalityType.IDEALIST]: {
      techResearchMult: 1.1,
      literacyRate: 85,
      moraleModifier: 2,
      propagandaIntensity: 40,
    },
    [PersonalityType.REFORMER]: {
      techResearchMult: 1.4,
      literacyRate: 90,
      moraleModifier: 3,
      propagandaIntensity: 20,
    },
    [PersonalityType.TECHNOCRAT]: {
      techResearchMult: 1.6,
      literacyRate: 85,
      moraleModifier: 0,
      propagandaIntensity: 25,
    },
    [PersonalityType.APPARATCHIK]: {
      techResearchMult: 0.8,
      literacyRate: 70,
      moraleModifier: -1,
      propagandaIntensity: 55,
    },
    [PersonalityType.POPULIST]: {
      techResearchMult: 0.9,
      literacyRate: 75,
      moraleModifier: 2,
      propagandaIntensity: 50,
    },
    [PersonalityType.MILITARIST]: {
      techResearchMult: 1.2,
      literacyRate: 70,
      moraleModifier: -2,
      propagandaIntensity: 80,
    },
    [PersonalityType.MYSTIC]: {
      techResearchMult: 0.5,
      literacyRate: 55,
      moraleModifier: -2,
      propagandaIntensity: 60,
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // MINISTER OF TRANSPORT
  // Controls: road effectiveness, supply chain delays, infrastructure decay
  // ════════════════════════════════════════════════════════════════════════════
  [Ministry.TRANSPORT]: {
    [PersonalityType.ZEALOT]: {
      supplyChainDelayMult: 0.8,
      infrastructureDecayMult: 1.5,
      moraleModifier: -2,
    },
    [PersonalityType.IDEALIST]: {
      supplyChainDelayMult: 1.1,
      infrastructureDecayMult: 0.9,
      moraleModifier: 1,
    },
    [PersonalityType.REFORMER]: {
      supplyChainDelayMult: 0.7,
      infrastructureDecayMult: 0.7,
      buildingCostMult: 1.1,
      moraleModifier: 2,
    },
    [PersonalityType.TECHNOCRAT]: {
      supplyChainDelayMult: 0.6,
      infrastructureDecayMult: 0.8,
      moraleModifier: 0,
    },
    [PersonalityType.APPARATCHIK]: {
      supplyChainDelayMult: 1.3,
      infrastructureDecayMult: 1.4,
      moraleModifier: -1,
    },
    [PersonalityType.POPULIST]: {
      supplyChainDelayMult: 1.0,
      infrastructureDecayMult: 1.0,
      moraleModifier: 1,
    },
    [PersonalityType.MILITARIST]: {
      supplyChainDelayMult: 0.5,
      infrastructureDecayMult: 1.2,
      moraleModifier: -2,
    },
    [PersonalityType.MYSTIC]: {
      supplyChainDelayMult: 1.4,
      infrastructureDecayMult: 1.3,
      moraleModifier: -1,
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
//  INTER-MINISTRY TENSION MATRIX
// ─────────────────────────────────────────────────────────────────────────────

export const TENSION_RULES: TensionRule[] = [
  // ── Classic conflicts ──
  {
    ministryA: Ministry.KGB,
    personalityA: PersonalityType.ZEALOT,
    ministryB: Ministry.AGRICULTURE,
    personalityB: PersonalityType.REFORMER,
    tensionDelta: 30,
    description: 'KGB Chairman demands arrest of farmers with private gardens. Agriculture Minister refuses.',
  },
  {
    ministryA: Ministry.KGB,
    personalityA: PersonalityType.ZEALOT,
    ministryB: Ministry.CULTURE,
    personalityB: PersonalityType.REFORMER,
    tensionDelta: 40,
    description: 'KGB Chairman bans jazz. Culture Minister caught playing saxophone at midnight.',
  },
  {
    ministryA: Ministry.HEAVY_INDUSTRY,
    personalityA: PersonalityType.MILITARIST,
    ministryB: Ministry.AGRICULTURE,
    personalityB: PersonalityType.IDEALIST,
    tensionDelta: 25,
    description: 'Heavy Industry requisitions farmland for tank factory. Agriculture weeps into turnip field.',
  },
  {
    ministryA: Ministry.DEFENSE,
    personalityA: PersonalityType.MILITARIST,
    ministryB: Ministry.HEALTH,
    personalityB: PersonalityType.REFORMER,
    tensionDelta: 20,
    description: 'Defense Minister wants hospital beds for wounded soldiers. Health Minister wants them for civilians.',
  },
  {
    ministryA: Ministry.GOSPLAN,
    personalityA: PersonalityType.ZEALOT,
    ministryB: Ministry.TRANSPORT,
    personalityB: PersonalityType.APPARATCHIK,
    tensionDelta: 15,
    description: 'Gosplan demands impossible delivery schedules. Transport Ministry loses the memo.',
  },
  {
    ministryA: Ministry.MVD,
    personalityA: PersonalityType.REFORMER,
    ministryB: Ministry.KGB,
    personalityB: PersonalityType.ZEALOT,
    tensionDelta: 35,
    description: 'MVD Minister tries to release political prisoners. KGB Chairman adds MVD Minister to watch list.',
  },
  {
    ministryA: Ministry.EDUCATION,
    personalityA: PersonalityType.TECHNOCRAT,
    ministryB: Ministry.CULTURE,
    personalityB: PersonalityType.MYSTIC,
    tensionDelta: 20,
    description:
      'Education Minister removes astrology from curriculum. Culture Minister demands its return as "cultural heritage."',
  },
  {
    ministryA: Ministry.HEALTH,
    personalityA: PersonalityType.REFORMER,
    ministryB: Ministry.AGRICULTURE,
    personalityB: PersonalityType.POPULIST,
    tensionDelta: 15,
    description: "Health Minister bans vodka. Agriculture Minister's vodka-producing kolkhozes revolt.",
  },

  // ── Natural alliances (negative tension = cooperation bonus) ──
  {
    ministryA: Ministry.KGB,
    personalityA: PersonalityType.ZEALOT,
    ministryB: Ministry.DEFENSE,
    personalityB: PersonalityType.MILITARIST,
    tensionDelta: -20,
    description: 'KGB and Defense form iron alliance. Citizens have never been more terrified or "safe."',
  },
  {
    ministryA: Ministry.AGRICULTURE,
    personalityA: PersonalityType.REFORMER,
    ministryB: Ministry.GOSPLAN,
    personalityB: PersonalityType.REFORMER,
    tensionDelta: -25,
    description: 'Agriculture and Gosplan reformers unite. Economy briefly improves. Everyone suspicious.',
  },
  {
    ministryA: Ministry.EDUCATION,
    personalityA: PersonalityType.TECHNOCRAT,
    ministryB: Ministry.HEAVY_INDUSTRY,
    personalityB: PersonalityType.TECHNOCRAT,
    tensionDelta: -15,
    description: 'Education and Industry technocrats collaborate. Factories improve. Workers feel like test subjects.',
  },
  {
    ministryA: Ministry.CULTURE,
    personalityA: PersonalityType.MYSTIC,
    ministryB: Ministry.HEALTH,
    personalityB: PersonalityType.MYSTIC,
    tensionDelta: -10,
    description:
      'Culture and Health ministers open crystal healing centers. Citizens die peacefully, surrounded by quartz.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
//  APPOINTMENT LOGIC
// ─────────────────────────────────────────────────────────────────────────────

export const APPOINTMENT_STRATEGIES: Record<PersonalityType, AppointmentStrategy> = {
  [PersonalityType.ZEALOT]: {
    retentionRate: 0.0,
    preferredTypes: [PersonalityType.ZEALOT, PersonalityType.MILITARIST],
    loyaltyThreshold: 90,
    meritBased: false,
    purgesKGB: true,
    transitionDescription: 'The new General Secretary purges the entire cabinet. Loyalty is the only qualification.',
  },
  [PersonalityType.IDEALIST]: {
    retentionRate: 0.4,
    preferredTypes: [PersonalityType.IDEALIST, PersonalityType.REFORMER, PersonalityType.TECHNOCRAT],
    loyaltyThreshold: 30,
    meritBased: false,
    purgesKGB: false,
    transitionDescription: 'The new leader keeps some old faces for stability, but whispers of change circulate.',
  },
  [PersonalityType.REFORMER]: {
    retentionRate: 0.6,
    preferredTypes: [PersonalityType.REFORMER, PersonalityType.TECHNOCRAT, PersonalityType.IDEALIST],
    loyaltyThreshold: 20,
    meritBased: true,
    purgesKGB: false,
    transitionDescription:
      'A cautious transition. Reformers placed in key positions, but the old guard remains for now.',
  },
  [PersonalityType.TECHNOCRAT]: {
    retentionRate: 0.5,
    preferredTypes: [PersonalityType.TECHNOCRAT, PersonalityType.REFORMER],
    loyaltyThreshold: 10,
    meritBased: true,
    purgesKGB: false,
    transitionDescription:
      'Cabinet reshuffled based on performance metrics. Incompetent ministers replaced regardless of loyalty.',
  },
  [PersonalityType.APPARATCHIK]: {
    retentionRate: 0.8,
    preferredTypes: [PersonalityType.APPARATCHIK, PersonalityType.TECHNOCRAT],
    loyaltyThreshold: 10,
    meritBased: false,
    purgesKGB: false,
    transitionDescription: 'Almost nothing changes. Those who waited longest get promoted. The system endures.',
  },
  [PersonalityType.POPULIST]: {
    retentionRate: 0.4,
    preferredTypes: [PersonalityType.POPULIST, PersonalityType.IDEALIST, PersonalityType.REFORMER],
    loyaltyThreshold: 30,
    meritBased: false,
    purgesKGB: false,
    transitionDescription: 'Popular ministers kept. Unpopular ones replaced with people who smile more.',
  },
  [PersonalityType.MILITARIST]: {
    retentionRate: 0.3,
    preferredTypes: [PersonalityType.MILITARIST, PersonalityType.ZEALOT],
    loyaltyThreshold: 60,
    meritBased: false,
    purgesKGB: true,
    transitionDescription:
      'Marshal law declared. Most of the old cabinet arrested. Uniforms mandatory for new appointees.',
  },
  [PersonalityType.MYSTIC]: {
    retentionRate: 0.5,
    preferredTypes: [PersonalityType.MYSTIC, PersonalityType.IDEALIST],
    loyaltyThreshold: 20,
    meritBased: false,
    purgesKGB: false,
    transitionDescription:
      'Cabinet members retained or dismissed based on astrological compatibility with the new leader.',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
//  PERSONALITY STAT RANGES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ┌─────────────┬───────┬───────┬─────────┬────────────┐
 * │ Personality  │ Loyal │ Comp. │ Ambition│ Corruption │
 * ├─────────────┼───────┼───────┼─────────┼────────────┤
 * │ ZEALOT      │ 70-95 │ 20-60 │ 50-90   │ 10-30      │
 * │ IDEALIST    │ 50-80 │ 40-70 │ 20-50   │  5-20      │
 * │ REFORMER    │ 30-60 │ 50-80 │ 40-70   │ 10-25      │
 * │ TECHNOCRAT  │ 40-70 │ 70-95 │ 30-60   │ 10-30      │
 * │ APPARATCHIK │ 50-80 │ 20-50 │ 20-50   │ 30-70      │
 * │ POPULIST    │ 40-70 │ 30-60 │ 50-80   │ 20-50      │
 * │ MILITARIST  │ 60-90 │ 40-70 │ 60-90   │ 15-40      │
 * │ MYSTIC      │ 30-60 │ 10-40 │ 30-70   │ 20-50      │
 * └─────────────┴───────┴───────┴─────────┴────────────┘
 */
export const PERSONALITY_STAT_RANGES: Record<
  PersonalityType,
  {
    loyalty: [number, number];
    competence: [number, number];
    ambition: [number, number];
    corruption: [number, number];
  }
> = {
  [PersonalityType.ZEALOT]: {
    loyalty: [70, 95],
    competence: [20, 60],
    ambition: [50, 90],
    corruption: [10, 30],
  },
  [PersonalityType.IDEALIST]: {
    loyalty: [50, 80],
    competence: [40, 70],
    ambition: [20, 50],
    corruption: [5, 20],
  },
  [PersonalityType.REFORMER]: {
    loyalty: [30, 60],
    competence: [50, 80],
    ambition: [40, 70],
    corruption: [10, 25],
  },
  [PersonalityType.TECHNOCRAT]: {
    loyalty: [40, 70],
    competence: [70, 95],
    ambition: [30, 60],
    corruption: [10, 30],
  },
  [PersonalityType.APPARATCHIK]: {
    loyalty: [50, 80],
    competence: [20, 50],
    ambition: [20, 50],
    corruption: [30, 70],
  },
  [PersonalityType.POPULIST]: {
    loyalty: [40, 70],
    competence: [30, 60],
    ambition: [50, 80],
    corruption: [20, 50],
  },
  [PersonalityType.MILITARIST]: {
    loyalty: [60, 90],
    competence: [40, 70],
    ambition: [60, 90],
    corruption: [15, 40],
  },
  [PersonalityType.MYSTIC]: {
    loyalty: [30, 60],
    competence: [10, 40],
    ambition: [30, 70],
    corruption: [20, 50],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
//  NAME GENERATION DATA
// ─────────────────────────────────────────────────────────────────────────────

export const FIRST_NAMES = [
  'Ivan',
  'Dmitri',
  'Nikolai',
  'Alexei',
  'Boris',
  'Viktor',
  'Yuri',
  'Sergei',
  'Andrei',
  'Mikhail',
  'Grigory',
  'Pavel',
  'Fyodor',
  'Leonid',
  'Konstantin',
  'Valentin',
  'Oleg',
  'Arkady',
  'Gennadiy',
  'Vladislav',
  'Ruslan',
  'Timofei',
  'Stepan',
  'Zakhar',
  'Matvei',
  'Pyotr',
  'Yegor',
];

export const LAST_NAMES = [
  'Volkov',
  'Petrov',
  'Ivanov',
  'Smirnov',
  'Kuznetsov',
  'Popov',
  'Sokolov',
  'Lebedev',
  'Kozlov',
  'Novikov',
  'Morozov',
  'Pavlov',
  'Romanov',
  'Orlov',
  'Medvedev',
  'Zhukov',
  'Gorbunov',
  'Titov',
  'Belov',
  'Karpov',
  'Kalinin',
  'Suslov',
  'Kosygin',
  'Brezhnev',
  'Gromyko',
  'Ustinov',
  'Kirilenko',
  'Chernenko',
  'Andropov',
  'Masherov',
  'Shcherbitsky',
  'Pelshe',
  'Kunaev',
  'Rashidov',
];

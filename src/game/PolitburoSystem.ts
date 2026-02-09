/**
 * @module game/PolitburoSystem
 *
 * THE MINISTRY & POLITBURO SYSTEM
 * ================================
 * SimSoviet 2000 — Government Structure Generator
 *
 * Generates a full Politburo around each General Secretary. Every minister
 * has personality, loyalty, competence, ambition, and corruption stats that
 * modify gameplay in their domain. Ministers conflict, conspire, get purged,
 * and occasionally coup the General Secretary.
 *
 * ARCHITECTURE
 * ------------
 * - PolitburoSystem is ticked by SimulationEngine alongside EventSystem
 * - Each ministry applies modifiers to GameState resources via MinistryEffect
 * - Inter-ministry tensions generate events fed back through EventSystem
 * - The system hooks into leader succession (GeneralSecretary lifecycle)
 *
 * DESIGN DOCUMENT TABLES
 * ----------------------
 * All modifier tables, interaction matrices, and event templates are
 * defined as typed constants below for easy balancing.
 */

import type { EventCategory, EventSeverity, GameEvent, ResourceDelta } from './EventSystem';
import type { GameState } from './GameState';
import type { GameRng } from './SeedSystem';

// ─────────────────────────────────────────────────────────────────────────────
//  ENUMS & CORE TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Personality archetypes shared between General Secretaries and Ministers.
 * Each archetype fundamentally changes how a person wields power.
 */
export enum PersonalityType {
  ZEALOT = 'zealot',
  IDEALIST = 'idealist',
  REFORMER = 'reformer',
  TECHNOCRAT = 'technocrat',
  APPARATCHIK = 'apparatchik',
  POPULIST = 'populist',
  MILITARIST = 'militarist',
  MYSTIC = 'mystic',
}

/**
 * The ten ministries of the Soviet government.
 */
export enum Ministry {
  KGB = 'kgb',
  AGRICULTURE = 'agriculture',
  HEAVY_INDUSTRY = 'heavy_industry',
  CULTURE = 'culture',
  DEFENSE = 'defense',
  MVD = 'mvd',
  GOSPLAN = 'gosplan',
  HEALTH = 'health',
  EDUCATION = 'education',
  TRANSPORT = 'transport',
}

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
//  GENERAL SECRETARY
// ─────────────────────────────────────────────────────────────────────────────

export interface GeneralSecretary {
  /** Unique identifier */
  id: string;
  /** Generated name */
  name: string;
  /** Core personality archetype */
  personality: PersonalityType;
  /** How suspicious of subordinates (0-100). Zealots start high. */
  paranoia: number;
  /** Health (0-100). Drops with age, stress, vodka. At 0 = death. */
  health: number;
  /** Age in years. Affects health decay and succession probability. */
  age: number;
  /** Year they took power. */
  yearAppointed: number;
  /** Whether currently in power. */
  alive: boolean;
  /** How the reign ended, if it did. */
  causeOfDeath?: 'natural' | 'coup' | 'purged_by_successor' | 'assassination';
}

// ─────────────────────────────────────────────────────────────────────────────
//  MINISTER
// ─────────────────────────────────────────────────────────────────────────────

export interface Minister {
  /** Unique identifier */
  id: string;
  /** Generated name */
  name: string;
  /** Which ministry they run */
  ministry: Ministry;
  /** Core personality archetype */
  personality: PersonalityType;

  // ── Core Stats (0-100) ──

  /** Loyalty to the current General Secretary. Below 20 = danger zone. */
  loyalty: number;
  /** How well they actually do their job. Affects domain performance. */
  competence: number;
  /** Desire to rise higher. High ambition + low loyalty = coup risk. */
  ambition: number;
  /** Siphons resources from their domain. High = more waste. */
  corruption: number;

  // ── Derived / Tracking ──

  /** Years served in this post */
  tenure: number;
  /** Faction ID they belong to (ministers form factions) */
  factionId: string | null;
  /** Whether this minister survived the last leadership change */
  survivedTransition: boolean;
  /** Accumulated "sins" — reasons the GS might purge them */
  purgeRisk: number;
}

// ─────────────────────────────────────────────────────────────────────────────
//  FACTION
// ─────────────────────────────────────────────────────────────────────────────

export interface Faction {
  id: string;
  name: string;
  /** The dominant personality type in this faction */
  alignment: PersonalityType;
  /** Minister IDs in this faction */
  memberIds: string[];
  /** Collective influence (sum of members' competence + ambition) */
  influence: number;
  /** Whether this faction supports the current GS */
  supportsCurrent: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
//  MINISTRY EFFECTS — How personality modifies each domain
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Numeric modifiers a minister applies to their domain each tick.
 * Values are multipliers (1.0 = no change) or flat deltas.
 */
export interface MinistryModifiers {
  // ── Resource Multipliers (1.0 = baseline) ──
  foodProductionMult: number;
  vodkaProductionMult: number;
  factoryOutputMult: number;
  buildingCostMult: number;
  techResearchMult: number;
  moraleModifier: number; // flat delta per tick (-10 to +10)

  // ── Rate Modifiers ──
  purgeFrequencyMult: number; // 1.0 = normal, 2.0 = twice as often
  fearLevel: number; // 0-100
  surveillanceRate: number; // events per year
  conscriptionRate: number; // % of population
  crimeRate: number; // 0-100
  corruptionDrain: number; // rubles lost per tick
  quotaDifficultyMult: number; // 1.0 = normal targets
  populationGrowthMult: number; // 1.0 = normal
  supplyChainDelayMult: number; // 1.0 = normal, higher = worse
  infrastructureDecayMult: number; // 1.0 = normal, higher = faster decay
  pollutionMult: number; // 1.0 = normal
  accidentRate: number; // chance per tick of industrial accident
  hospitalEffectiveness: number; // 0.0-2.0
  literacyRate: number; // 0-100

  // ── Policy Flags ──
  privateGardensAllowed: boolean;
  vodkaRestricted: boolean;
  blackMarketTolerated: boolean;
  artCensored: boolean;
  propagandaIntensity: number; // 0-100
}

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

type ModifierOverride = Partial<MinistryModifiers>;

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
export const PERSONALITY_MINISTRY_MATRIX: Record<
  Ministry,
  Record<PersonalityType, ModifierOverride>
> = {
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
      // Purges every 3 months, "enemies of the state" events constantly
    },
    [PersonalityType.IDEALIST]: {
      fearLevel: 40,
      purgeFrequencyMult: 0.5,
      surveillanceRate: 6,
      moraleModifier: 2,
      propagandaIntensity: 60,
      // Believes in rehabilitation. KGB agents confused by new memo: "Be nice."
    },
    [PersonalityType.REFORMER]: {
      fearLevel: 20,
      purgeFrequencyMult: 0.2,
      surveillanceRate: 2,
      moraleModifier: 5,
      crimeRate: 45,
      propagandaIntensity: 30,
      // Citizens get freedom. GS gets nervous. Crime rises because people can now report it.
    },
    [PersonalityType.TECHNOCRAT]: {
      fearLevel: 55,
      purgeFrequencyMult: 1.0,
      surveillanceRate: 20,
      moraleModifier: -2,
      crimeRate: 15,
      propagandaIntensity: 40,
      // Efficient surveillance state. Knows everything. Files everything. Acts on nothing unless optimal.
    },
    [PersonalityType.APPARATCHIK]: {
      fearLevel: 45,
      purgeFrequencyMult: 0.8,
      surveillanceRate: 4,
      moraleModifier: 0,
      propagandaIntensity: 50,
      // Business as usual. Reports filed. Reports ignored. System persists.
    },
    [PersonalityType.POPULIST]: {
      fearLevel: 30,
      purgeFrequencyMult: 0.6,
      surveillanceRate: 3,
      moraleModifier: 3,
      propagandaIntensity: 70,
      // Secret police with a PR department. "Friendly neighborhood KGB."
    },
    [PersonalityType.MILITARIST]: {
      fearLevel: 75,
      purgeFrequencyMult: 2.0,
      surveillanceRate: 10,
      moraleModifier: -3,
      conscriptionRate: 12,
      propagandaIntensity: 80,
      // Runs KGB like an army. Checkpoints everywhere. Citizens salute reflexively.
    },
    [PersonalityType.MYSTIC]: {
      fearLevel: 60,
      purgeFrequencyMult: 1.5,
      surveillanceRate: 8,
      moraleModifier: -1,
      propagandaIntensity: 65,
      // Consults horoscopes before purges. Arrested citizens receive fortune readings.
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
      // Forced collectivization. Kulaks deported. Harvests decline. Reports say otherwise.
    },
    [PersonalityType.IDEALIST]: {
      foodProductionMult: 0.9,
      privateGardensAllowed: false,
      moraleModifier: 1,
      // Communal farms with singing. Singing does not grow potatoes. Slightly less terrible.
    },
    [PersonalityType.REFORMER]: {
      foodProductionMult: 1.4,
      privateGardensAllowed: true,
      moraleModifier: 4,
      // Private gardens allowed! Food production soars. Party ideologues furious.
    },
    [PersonalityType.TECHNOCRAT]: {
      foodProductionMult: 1.3,
      privateGardensAllowed: false,
      moraleModifier: 0,
      // Scientific farming. Crop rotation. Soil analysis. Still no tractors that work.
    },
    [PersonalityType.APPARATCHIK]: {
      foodProductionMult: 0.85,
      privateGardensAllowed: false,
      moraleModifier: -1,
      // Nothing changes. Harvests slowly decline. Reports are always "adequate."
    },
    [PersonalityType.POPULIST]: {
      foodProductionMult: 1.1,
      privateGardensAllowed: true,
      moraleModifier: 3,
      // "Every comrade gets a garden plot!" Popular but ideologically suspect.
    },
    [PersonalityType.MILITARIST]: {
      foodProductionMult: 0.8,
      privateGardensAllowed: false,
      conscriptionRate: 10,
      moraleModifier: -4,
      // Requisitions food for military. Farmers conscripted. Fields untended.
    },
    [PersonalityType.MYSTIC]: {
      foodProductionMult: 0.75,
      privateGardensAllowed: false,
      moraleModifier: -2,
      // Plants crops according to lunar cycles. Sacrifices potato to ensure harvest.
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
      // Quotas tripled! Workers expendable. Pollution is capitalist propaganda.
    },
    [PersonalityType.IDEALIST]: {
      factoryOutputMult: 0.8,
      pollutionMult: 0.5,
      buildingCostMult: 1.3,
      accidentRate: 0.01,
      moraleModifier: 2,
      // "Green" factories. Output drops but workers live longer. Party confused.
    },
    [PersonalityType.REFORMER]: {
      factoryOutputMult: 1.2,
      pollutionMult: 0.8,
      buildingCostMult: 1.1,
      accidentRate: 0.02,
      techResearchMult: 1.3,
      moraleModifier: 1,
      // Modernizes factories. Imports Western machines. Gets suspicious looks.
    },
    [PersonalityType.TECHNOCRAT]: {
      factoryOutputMult: 1.4,
      pollutionMult: 1.0,
      buildingCostMult: 0.9,
      accidentRate: 0.015,
      techResearchMult: 1.5,
      moraleModifier: 0,
      // Optimizes everything. Workers are "human resources." Efficient and soulless.
    },
    [PersonalityType.APPARATCHIK]: {
      factoryOutputMult: 0.9,
      pollutionMult: 1.2,
      buildingCostMult: 1.2,
      accidentRate: 0.04,
      moraleModifier: -1,
      // Factories run on paperwork. Output measured in forms filed, not goods produced.
    },
    [PersonalityType.POPULIST]: {
      factoryOutputMult: 1.0,
      pollutionMult: 1.0,
      buildingCostMult: 1.0,
      accidentRate: 0.03,
      moraleModifier: 2,
      // Promises everyone a factory job. Factories now overstaffed. Output per worker: minimal.
    },
    [PersonalityType.MILITARIST]: {
      factoryOutputMult: 1.6,
      pollutionMult: 1.8,
      buildingCostMult: 0.7,
      accidentRate: 0.06,
      moraleModifier: -4,
      // All factories now produce tank parts. Citizens eat tank parts. They do not enjoy them.
    },
    [PersonalityType.MYSTIC]: {
      factoryOutputMult: 0.7,
      pollutionMult: 0.9,
      buildingCostMult: 1.4,
      accidentRate: 0.05,
      moraleModifier: -1,
      // Factory blessed before opening. Production depends on alignment of stars. Currently: misaligned.
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
      // All art is propaganda. All music is the anthem. All books are Das Kapital.
    },
    [PersonalityType.IDEALIST]: {
      moraleModifier: 3,
      artCensored: false,
      propagandaIntensity: 40,
      // Believes art will save the revolution. Sponsors poets. Poets still sad.
    },
    [PersonalityType.REFORMER]: {
      moraleModifier: 6,
      artCensored: false,
      propagandaIntensity: 20,
      // Jazz allowed! Foreign films shown! Citizens experience "joy." State alarmed.
    },
    [PersonalityType.TECHNOCRAT]: {
      moraleModifier: 0,
      artCensored: false,
      propagandaIntensity: 30,
      // Art must be "functional." Approves only educational films about tractor maintenance.
    },
    [PersonalityType.APPARATCHIK]: {
      moraleModifier: -1,
      artCensored: true,
      propagandaIntensity: 55,
      // Approved art list unchanged since 1953. New submissions: "under review."
    },
    [PersonalityType.POPULIST]: {
      moraleModifier: 4,
      artCensored: false,
      propagandaIntensity: 45,
      vodkaRestricted: false,
      // Folk music, dancing, vodka at cultural events. Popular but undignified.
    },
    [PersonalityType.MILITARIST]: {
      moraleModifier: -2,
      artCensored: true,
      propagandaIntensity: 85,
      // All culture is military marches. Mandatory patriotic sing-alongs. Citizens hoarse.
    },
    [PersonalityType.MYSTIC]: {
      moraleModifier: 1,
      artCensored: true,
      propagandaIntensity: 60,
      // Only art depicting cosmic truth allowed. Citizens confused but intrigued.
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
      // Holy war against capitalism. Everyone drafted. Cities become barracks.
    },
    [PersonalityType.IDEALIST]: {
      conscriptionRate: 2,
      buildingCostMult: 1.2,
      moraleModifier: 2,
      populationGrowthMult: 1.1,
      // "The best defense is a just society." Army reduced. Soldiers retrained as teachers.
    },
    [PersonalityType.REFORMER]: {
      conscriptionRate: 3,
      buildingCostMult: 1.0,
      moraleModifier: 1,
      populationGrowthMult: 1.05,
      // Professional army proposal. Fewer soldiers, better equipped. Old generals furious.
    },
    [PersonalityType.TECHNOCRAT]: {
      conscriptionRate: 5,
      buildingCostMult: 0.85,
      moraleModifier: 0,
      techResearchMult: 1.4,
      // Invests in technology over manpower. Develops weapons nobody knows how to use.
    },
    [PersonalityType.APPARATCHIK]: {
      conscriptionRate: 5,
      buildingCostMult: 1.1,
      moraleModifier: 0,
      // Parades on schedule. Budgets unchanged. Equipment from 1945.
    },
    [PersonalityType.POPULIST]: {
      conscriptionRate: 4,
      buildingCostMult: 1.0,
      moraleModifier: 1,
      // "People's militia!" Volunteers everywhere. Training: optional. Effectiveness: debatable.
    },
    [PersonalityType.MILITARIST]: {
      conscriptionRate: 20,
      buildingCostMult: 0.6,
      moraleModifier: -5,
      factoryOutputMult: 1.3,
      populationGrowthMult: 0.7,
      // Permanent war footing. Entire economy militarized. Children march in formation.
    },
    [PersonalityType.MYSTIC]: {
      conscriptionRate: 5,
      buildingCostMult: 1.3,
      moraleModifier: -1,
      // Consults tarot before troop movements. Positions batteries along ley lines.
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
      // Zero tolerance. Zero crime. Zero fun. Zero mercy.
    },
    [PersonalityType.IDEALIST]: {
      crimeRate: 25,
      corruptionDrain: 10,
      blackMarketTolerated: false,
      moraleModifier: 2,
      // Believes in reform, not punishment. Crime persists. Idealist persists harder.
    },
    [PersonalityType.REFORMER]: {
      crimeRate: 35,
      corruptionDrain: 15,
      blackMarketTolerated: true,
      moraleModifier: 3,
      // Tolerates black market as "economic flexibility." Citizens grateful. Party suspicious.
    },
    [PersonalityType.TECHNOCRAT]: {
      crimeRate: 20,
      corruptionDrain: 8,
      blackMarketTolerated: false,
      moraleModifier: 0,
      // Databases of every citizen. Cross-references. Crime detected algorithmically.
    },
    [PersonalityType.APPARATCHIK]: {
      crimeRate: 40,
      corruptionDrain: 25,
      blackMarketTolerated: true,
      moraleModifier: -1,
      // Looks the other way for a fee. The fee IS the corruption. System is the crime.
    },
    [PersonalityType.POPULIST]: {
      crimeRate: 30,
      corruptionDrain: 12,
      blackMarketTolerated: false,
      moraleModifier: 2,
      // Community policing! Neighbors watch neighbors. "It's like the KGB but friendlier."
    },
    [PersonalityType.MILITARIST]: {
      crimeRate: 15,
      corruptionDrain: 5,
      blackMarketTolerated: false,
      moraleModifier: -3,
      fearLevel: 65,
      // Martial law is just law with better posture. Curfews. Checkpoints. Saluting.
    },
    [PersonalityType.MYSTIC]: {
      crimeRate: 35,
      corruptionDrain: 20,
      blackMarketTolerated: true,
      moraleModifier: 0,
      // Crimes judged by reading tea leaves. Innocence determined by star sign.
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
      // Quotas doubled! Then doubled again! Workers achieve 400% of realistic target (on paper).
    },
    [PersonalityType.IDEALIST]: {
      quotaDifficultyMult: 0.8,
      moraleModifier: 1,
      // "Plans should inspire, not crush." Reasonable quotas. Nobody knows what to do with the surplus time.
    },
    [PersonalityType.REFORMER]: {
      quotaDifficultyMult: 0.7,
      moraleModifier: 3,
      foodProductionMult: 1.1,
      vodkaProductionMult: 1.1,
      // Flexible targets! Local managers get autonomy! Central planners have existential crisis.
    },
    [PersonalityType.TECHNOCRAT]: {
      quotaDifficultyMult: 1.2,
      moraleModifier: 0,
      factoryOutputMult: 1.2,
      foodProductionMult: 1.1,
      // Optimal resource allocation via mathematics. Plans are beautiful on paper. Reality: less so.
    },
    [PersonalityType.APPARATCHIK]: {
      quotaDifficultyMult: 1.0,
      moraleModifier: -1,
      // Same 5-year plan. Every 5 years. Since 1928. "If it is not broken" — it is broken.
    },
    [PersonalityType.POPULIST]: {
      quotaDifficultyMult: 0.6,
      moraleModifier: 4,
      // Easy quotas everyone can meet! Celebrations! Medals! Nobody notices the economy stagnating.
    },
    [PersonalityType.MILITARIST]: {
      quotaDifficultyMult: 1.8,
      moraleModifier: -4,
      factoryOutputMult: 1.3,
      // War economy plans. Everything allocated to defense. Civilians get what is left (nothing).
    },
    [PersonalityType.MYSTIC]: {
      quotaDifficultyMult: 1.1,
      moraleModifier: -1,
      // 5-year plan aligned with 5-pointed star. Quota targets derived from numerology.
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
      // "Sickness is bourgeois weakness." Hospitals used for ideological screening.
    },
    [PersonalityType.IDEALIST]: {
      populationGrowthMult: 1.2,
      vodkaRestricted: false,
      hospitalEffectiveness: 1.3,
      moraleModifier: 2,
      // Universal healthcare! (In theory.) Doctors enthusiastic. Medicine: scarce but free.
    },
    [PersonalityType.REFORMER]: {
      populationGrowthMult: 1.3,
      vodkaRestricted: true,
      hospitalEffectiveness: 1.5,
      moraleModifier: 1,
      // Anti-vodka campaign! Life expectancy rises! Citizens grumpy but alive.
    },
    [PersonalityType.TECHNOCRAT]: {
      populationGrowthMult: 1.2,
      vodkaRestricted: false,
      hospitalEffectiveness: 1.4,
      moraleModifier: 0,
      // Evidence-based medicine. Efficient hospitals. Patients treated as statistics.
    },
    [PersonalityType.APPARATCHIK]: {
      populationGrowthMult: 1.0,
      vodkaRestricted: false,
      hospitalEffectiveness: 0.8,
      moraleModifier: 0,
      // Hospitals exist on paper. Waiting list: 3 years. Prescription for everything: rest.
    },
    [PersonalityType.POPULIST]: {
      populationGrowthMult: 1.1,
      vodkaRestricted: false,
      hospitalEffectiveness: 1.0,
      moraleModifier: 3,
      vodkaProductionMult: 1.3,
      // "Vodka IS medicine!" Free vodka rations at clinics. Life expectancy: complicated.
    },
    [PersonalityType.MILITARIST]: {
      populationGrowthMult: 0.85,
      vodkaRestricted: true,
      hospitalEffectiveness: 0.7,
      moraleModifier: -2,
      // Fitness mandatory. Hospitals military-style. Broken leg? Walk it off, comrade.
    },
    [PersonalityType.MYSTIC]: {
      populationGrowthMult: 0.9,
      vodkaRestricted: false,
      hospitalEffectiveness: 0.5,
      moraleModifier: -1,
      // Crystal healing. Aura readings. Herbal tinctures. Mortality: high but "spiritually correct."
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
      // Education = indoctrination. Textbooks rewritten monthly. History is whatever we say.
    },
    [PersonalityType.IDEALIST]: {
      techResearchMult: 1.1,
      literacyRate: 85,
      moraleModifier: 2,
      propagandaIntensity: 40,
      // "Enlighten the masses!" Libraries open. Citizens read. Some read wrong things.
    },
    [PersonalityType.REFORMER]: {
      techResearchMult: 1.4,
      literacyRate: 90,
      moraleModifier: 3,
      propagandaIntensity: 20,
      // Western textbooks imported! Science thrives! Party worried about "foreign ideas."
    },
    [PersonalityType.TECHNOCRAT]: {
      techResearchMult: 1.6,
      literacyRate: 85,
      moraleModifier: 0,
      propagandaIntensity: 25,
      // STEM focus. Every child learns calculus. Nobody learns to feel. Robots with diplomas.
    },
    [PersonalityType.APPARATCHIK]: {
      techResearchMult: 0.8,
      literacyRate: 70,
      moraleModifier: -1,
      propagandaIntensity: 55,
      // Same curriculum since 1945. Teachers teach by rote. Students memorize by rote. Everyone rotes.
    },
    [PersonalityType.POPULIST]: {
      techResearchMult: 0.9,
      literacyRate: 75,
      moraleModifier: 2,
      propagandaIntensity: 50,
      // "Practical education for the people!" Vocational training. Scientists sidelined.
    },
    [PersonalityType.MILITARIST]: {
      techResearchMult: 1.2,
      literacyRate: 70,
      moraleModifier: -2,
      propagandaIntensity: 80,
      // Military academy for all. Children disassemble rifles before learning alphabet.
    },
    [PersonalityType.MYSTIC]: {
      techResearchMult: 0.5,
      literacyRate: 55,
      moraleModifier: -2,
      propagandaIntensity: 60,
      // Curriculum includes astrology, numerology, and "dialectical mysticism." Science optional.
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
      // Forced labor builds roads fast. Roads crumble faster. Workers too exhausted to notice.
    },
    [PersonalityType.IDEALIST]: {
      supplyChainDelayMult: 1.1,
      infrastructureDecayMult: 0.9,
      moraleModifier: 1,
      // Public transit for all! Beautiful bus stops. Buses: still late.
    },
    [PersonalityType.REFORMER]: {
      supplyChainDelayMult: 0.7,
      infrastructureDecayMult: 0.7,
      buildingCostMult: 1.1,
      moraleModifier: 2,
      // Infrastructure investment! Roads repaired! Citizens suspicious of smooth roads.
    },
    [PersonalityType.TECHNOCRAT]: {
      supplyChainDelayMult: 0.6,
      infrastructureDecayMult: 0.8,
      moraleModifier: 0,
      // Optimized rail networks. Trains run on time. Passengers optional.
    },
    [PersonalityType.APPARATCHIK]: {
      supplyChainDelayMult: 1.3,
      infrastructureDecayMult: 1.4,
      moraleModifier: -1,
      // Roads last maintained in 1967. "Maintenance request in progress." Progress: 0%.
    },
    [PersonalityType.POPULIST]: {
      supplyChainDelayMult: 1.0,
      infrastructureDecayMult: 1.0,
      moraleModifier: 1,
      // Free bus passes! Buses overcrowded. Citizens grateful for the standing exercise.
    },
    [PersonalityType.MILITARIST]: {
      supplyChainDelayMult: 0.5,
      infrastructureDecayMult: 1.2,
      moraleModifier: -2,
      // Military logistics. Efficient but everything is a convoy. Citizens must yield to tanks.
    },
    [PersonalityType.MYSTIC]: {
      supplyChainDelayMult: 1.4,
      infrastructureDecayMult: 1.3,
      moraleModifier: -1,
      // Roads built along ley lines. Destinations reached when the universe wills it.
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
//  INTER-MINISTRY TENSION MATRIX
// ─────────────────────────────────────────────────────────────────────────────
//
//  Certain personality combinations across ministries generate tension.
//  Tension > threshold = conflict events.
//
//  Format: [ministryA, personalityA, ministryB, personalityB, tensionDelta, description]
// ─────────────────────────────────────────────────────────────────────────────

export interface TensionRule {
  ministryA: Ministry;
  personalityA: PersonalityType;
  ministryB: Ministry;
  personalityB: PersonalityType;
  /** Tension points generated per year (positive = conflict, negative = alliance) */
  tensionDelta: number;
  /** Description of the conflict for event generation */
  description: string;
}

export const TENSION_RULES: TensionRule[] = [
  // ── Classic conflicts ──
  {
    ministryA: Ministry.KGB,
    personalityA: PersonalityType.ZEALOT,
    ministryB: Ministry.AGRICULTURE,
    personalityB: PersonalityType.REFORMER,
    tensionDelta: 30,
    description:
      'KGB Chairman demands arrest of farmers with private gardens. Agriculture Minister refuses.',
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
    description:
      'Heavy Industry requisitions farmland for tank factory. Agriculture weeps into turnip field.',
  },
  {
    ministryA: Ministry.DEFENSE,
    personalityA: PersonalityType.MILITARIST,
    ministryB: Ministry.HEALTH,
    personalityB: PersonalityType.REFORMER,
    tensionDelta: 20,
    description:
      'Defense Minister wants hospital beds for wounded soldiers. Health Minister wants them for civilians.',
  },
  {
    ministryA: Ministry.GOSPLAN,
    personalityA: PersonalityType.ZEALOT,
    ministryB: Ministry.TRANSPORT,
    personalityB: PersonalityType.APPARATCHIK,
    tensionDelta: 15,
    description:
      'Gosplan demands impossible delivery schedules. Transport Ministry loses the memo.',
  },
  {
    ministryA: Ministry.MVD,
    personalityA: PersonalityType.REFORMER,
    ministryB: Ministry.KGB,
    personalityB: PersonalityType.ZEALOT,
    tensionDelta: 35,
    description:
      'MVD Minister tries to release political prisoners. KGB Chairman adds MVD Minister to watch list.',
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
    description:
      "Health Minister bans vodka. Agriculture Minister's vodka-producing kolkhozes revolt.",
  },

  // ── Natural alliances (negative tension = cooperation bonus) ──
  {
    ministryA: Ministry.KGB,
    personalityA: PersonalityType.ZEALOT,
    ministryB: Ministry.DEFENSE,
    personalityB: PersonalityType.MILITARIST,
    tensionDelta: -20,
    description:
      'KGB and Defense form iron alliance. Citizens have never been more terrified or "safe."',
  },
  {
    ministryA: Ministry.AGRICULTURE,
    personalityA: PersonalityType.REFORMER,
    ministryB: Ministry.GOSPLAN,
    personalityB: PersonalityType.REFORMER,
    tensionDelta: -25,
    description:
      'Agriculture and Gosplan reformers unite. Economy briefly improves. Everyone suspicious.',
  },
  {
    ministryA: Ministry.EDUCATION,
    personalityA: PersonalityType.TECHNOCRAT,
    ministryB: Ministry.HEAVY_INDUSTRY,
    personalityB: PersonalityType.TECHNOCRAT,
    tensionDelta: -15,
    description:
      'Education and Industry technocrats collaborate. Factories improve. Workers feel like test subjects.',
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
//  MINISTRY EVENT TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

export interface MinistryEventTemplate {
  id: string;
  ministry: Ministry;
  title: string;
  description: string | ((minister: Minister, gs: GameState) => string);
  pravdaHeadline: string;
  severity: EventSeverity;
  category: EventCategory;
  effects: ResourceDelta | ((minister: Minister, gs: GameState) => ResourceDelta);
  /** Only fires when this personality holds the ministry */
  requiredPersonality?: PersonalityType;
  /** General condition check */
  condition?: (minister: Minister, gs: GameState) => boolean;
  weight?: number;
}

export const MINISTRY_EVENTS: MinistryEventTemplate[] = [
  // ── KGB Events ──
  {
    id: 'kgb_surveillance_report',
    ministry: Ministry.KGB,
    title: 'SURVEILLANCE REPORT',
    description: (m) =>
      `KGB Chairman ${m.name} presents surveillance findings. ${m.personality === PersonalityType.ZEALOT ? 'Everyone is guilty.' : 'Most citizens are merely suspicious.'}`,
    pravdaHeadline: "KGB REPORTS: ALL CITIZENS LOYAL (THOSE WHO AREN'T ARE NO LONGER CITIZENS)",
    severity: 'minor',
    category: 'political',
    effects: { money: -15 },
  },
  {
    id: 'kgb_spy_discovery',
    ministry: Ministry.KGB,
    title: 'SPY DISCOVERED',
    description:
      'A Western spy found infiltrating the turnip warehouse. Interrogation reveals: he actually just wanted turnips.',
    pravdaHeadline: 'HEROIC KGB FOILS WESTERN AGRICULTURAL ESPIONAGE',
    severity: 'minor',
    category: 'political',
    effects: { money: 20, food: -5 },
  },
  {
    id: 'kgb_loyalty_test',
    ministry: Ministry.KGB,
    title: 'LOYALTY TEST',
    description: (m, gs) =>
      `Mandatory loyalty tests administered to ${Math.floor(gs.pop * 0.3)} citizens. ${m.personality === PersonalityType.REFORMER ? 'Tests graded on a curve. Everyone passes.' : 'Several citizens fail. They will be "re-educated."'}`,
    pravdaHeadline: 'CITIZENS DEMONSTRATE UNWAVERING DEVOTION TO STATE',
    severity: 'minor',
    category: 'political',
    effects: (m) => ({
      pop: m.personality === PersonalityType.ZEALOT ? -3 : -1,
      money: -10,
    }),
    condition: (_, gs) => gs.pop > 10,
  },
  {
    id: 'kgb_purge_wave',
    ministry: Ministry.KGB,
    title: 'PURGE WAVE',
    description: (m, gs) => {
      const purged = Math.floor(gs.pop * 0.05);
      return `Chairman ${m.name} initiates purge. ${purged} citizens relocated to "agricultural development zones." The zones have no agriculture.`;
    },
    pravdaHeadline: 'VOLUNTARY RELOCATION PROGRAM EXCEEDS ENROLLMENT TARGETS',
    severity: 'major',
    category: 'political',
    effects: (_, gs) => ({ pop: -Math.max(1, Math.floor(gs.pop * 0.05)), food: 5 }),
    requiredPersonality: PersonalityType.ZEALOT,
    condition: (_, gs) => gs.pop > 20,
    weight: 1.5,
  },

  // ── Agriculture Events ──
  {
    id: 'agri_harvest_report',
    ministry: Ministry.AGRICULTURE,
    title: 'HARVEST REPORT',
    description: (m) =>
      `Minister ${m.name} announces harvest results. ${m.competence > 60 ? 'Yields are acceptable.' : 'Yields are disappointing but the report says otherwise.'}`,
    pravdaHeadline: 'BUMPER CROP PROVES SUPERIORITY OF SOCIALIST FARMING',
    severity: 'trivial',
    category: 'economic',
    effects: (m) => ({ food: Math.floor(m.competence / 5) }),
  },
  {
    id: 'agri_weather_disaster',
    ministry: Ministry.AGRICULTURE,
    title: 'WEATHER CATASTROPHE',
    description:
      'Early frost destroys 40% of crops. Minister blames the weather. The weather has been added to the watch list.',
    pravdaHeadline: 'MINOR WEATHER EVENT HAS ZERO IMPACT ON FOOD SUPPLY (DO NOT CHECK)',
    severity: 'major',
    category: 'disaster',
    effects: { food: -40 },
    weight: 0.6,
  },
  {
    id: 'agri_collectivization_drive',
    ministry: Ministry.AGRICULTURE,
    title: 'COLLECTIVIZATION DRIVE',
    description: (m) =>
      `Minister ${m.name} launches new collectivization campaign. Private gardens ${m.personality === PersonalityType.REFORMER ? 'are explicitly protected (for now)' : 'are seized for the collective good'}.`,
    pravdaHeadline: 'GLORIOUS COLLECTIVIZATION ADVANCES SOCIALIST AGRICULTURE',
    severity: 'minor',
    category: 'political',
    effects: (m) => ({
      food: m.personality === PersonalityType.REFORMER ? 10 : -10,
      money: -20,
    }),
    requiredPersonality: PersonalityType.ZEALOT,
  },
  {
    id: 'agri_private_garden_boom',
    ministry: Ministry.AGRICULTURE,
    title: 'PRIVATE GARDEN BOOM',
    description:
      "Citizens' private gardens produce more food than all kolkhozes combined. This fact has been classified.",
    pravdaHeadline: 'KOLKHOZ PRODUCTION AT ALL-TIME HIGH (PRIVATE GARDENS NOT MEASURED)',
    severity: 'minor',
    category: 'economic',
    effects: { food: 30 },
    requiredPersonality: PersonalityType.REFORMER,
    weight: 0.8,
  },

  // ── Culture Events ──
  {
    id: 'culture_banned_art',
    ministry: Ministry.CULTURE,
    title: 'ART BANNED',
    description: (m) =>
      `Minister ${m.name} bans ${pick(['jazz', 'abstract painting', 'poetry about feelings', 'smiling in photographs', 'the color purple', 'music in minor keys'])}. Citizens mourn privately. Mourning also banned.`,
    pravdaHeadline: 'DECADENT WESTERN ART PURGED FROM CULTURAL LANDSCAPE',
    severity: 'trivial',
    category: 'cultural',
    effects: { vodka: -3 },
    condition: (m) =>
      m.personality === PersonalityType.ZEALOT || m.personality === PersonalityType.MILITARIST,
  },
  {
    id: 'culture_mandatory_celebration',
    ministry: Ministry.CULTURE,
    title: 'MANDATORY CELEBRATION',
    description:
      'Anniversary of the Revolution. Attendance compulsory. Joy compulsory. Second helpings of joy: unavailable.',
    pravdaHeadline: 'SPONTANEOUS OUTPOURING OF REVOLUTIONARY FERVOR SWEEPS CITY',
    severity: 'trivial',
    category: 'cultural',
    effects: { money: -15, vodka: -5 },
  },
  {
    id: 'culture_approved_music',
    ministry: Ministry.CULTURE,
    title: 'APPROVED MUSIC LIST UPDATED',
    description: (m) =>
      `New approved music list: ${m.personality === PersonalityType.REFORMER ? '47 songs (up from 3!)' : '3 songs. One is the anthem. The other two are also the anthem.'} `,
    pravdaHeadline: 'RICH MUSICAL HERITAGE CELEBRATED WITH UPDATED PLAYLIST',
    severity: 'trivial',
    category: 'cultural',
    effects: {},
  },

  // ── Defense Events ──
  {
    id: 'defense_border_incident',
    ministry: Ministry.DEFENSE,
    title: 'BORDER INCIDENT',
    description: (m) =>
      `Border incident reported. Defense Minister ${m.name} ${m.personality === PersonalityType.MILITARIST ? 'mobilizes entire army' : 'sends a strongly worded letter'}. The incident was a stray cow.`,
    pravdaHeadline: 'WESTERN PROVOCATIONS MET WITH IRON RESOLVE',
    severity: 'minor',
    category: 'political',
    effects: (m) => ({
      money: m.personality === PersonalityType.MILITARIST ? -50 : -10,
    }),
  },
  {
    id: 'defense_military_exercise',
    ministry: Ministry.DEFENSE,
    title: 'MILITARY EXERCISES',
    description:
      'Annual military exercises. Tanks drive through city center. Several flower beds are casualties. A cat is decorated for bravery.',
    pravdaHeadline: 'AWESTRIKING DISPLAY OF MILITARY MIGHT REASSURES POPULACE',
    severity: 'trivial',
    category: 'political',
    effects: { money: -30, food: -5 },
    requiredPersonality: PersonalityType.MILITARIST,
  },
  {
    id: 'defense_conscription_drive',
    ministry: Ministry.DEFENSE,
    title: 'CONSCRIPTION DRIVE',
    description: (m, gs) => {
      const drafted = Math.max(1, Math.floor(gs.pop * 0.03));
      return `${drafted} citizens conscripted. Minister ${m.name}: "The Motherland needs you more than your family does."`;
    },
    pravdaHeadline: 'PATRIOTIC YOUTH RUSH TO SERVE THE MOTHERLAND',
    severity: 'minor',
    category: 'political',
    effects: (_, gs) => ({ pop: -Math.max(1, Math.floor(gs.pop * 0.03)) }),
    condition: (_, gs) => gs.pop > 15,
  },

  // ── Health Events ──
  {
    id: 'health_vodka_policy',
    ministry: Ministry.HEALTH,
    title: 'VODKA POLICY UPDATE',
    description: (m) =>
      `Health Minister ${m.name} ${m.personality === PersonalityType.REFORMER ? 'restricts vodka. Citizens riot quietly.' : 'declares vodka a food group. Life expectancy: unclear.'}`,
    pravdaHeadline: 'HEALTH MINISTRY OPTIMIZES NATIONAL BEVERAGE STRATEGY',
    severity: 'minor',
    category: 'economic',
    effects: (m) => ({
      vodka: m.personality === PersonalityType.REFORMER ? -15 : 10,
    }),
  },
  {
    id: 'health_epidemic',
    ministry: Ministry.HEALTH,
    title: 'MYSTERIOUS ILLNESS',
    description: (m) =>
      `Mysterious illness sweeps city. Health Minister ${m.name} ${m.competence > 50 ? 'mobilizes hospitals effectively' : 'prescribes rest and revolutionary spirit'}. ${m.personality === PersonalityType.MYSTIC ? 'Also: crystals.' : ''}`,
    pravdaHeadline: 'MINOR HEALTH FLUCTUATION HANDLED WITH CHARACTERISTIC SOVIET EFFICIENCY',
    severity: 'major',
    category: 'disaster',
    effects: (m) => ({
      pop: m.competence > 50 ? -2 : -5,
      money: -20,
    }),
    condition: (_, gs) => gs.pop > 10,
    weight: 0.5,
  },

  // ── Gosplan Events ──
  {
    id: 'gosplan_quota_revision',
    ministry: Ministry.GOSPLAN,
    title: 'QUOTA REVISION',
    description: (m) =>
      `Gosplan Chairman ${m.name} revises 5-year plan targets ${m.personality === PersonalityType.ZEALOT ? 'upward by 300%' : m.personality === PersonalityType.POPULIST ? 'downward (everyone gets a medal)' : 'slightly'}.`,
    pravdaHeadline: 'FIVE-YEAR PLAN TARGETS ADJUSTED TO REFLECT GLORIOUS REALITY',
    severity: 'minor',
    category: 'economic',
    effects: {},
  },
  {
    id: 'gosplan_resource_reallocation',
    ministry: Ministry.GOSPLAN,
    title: 'RESOURCE REALLOCATION',
    description:
      'Gosplan reallocates resources. What was going to agriculture now goes to heavy industry. What was going to heavy industry now goes to defense. What was going to defense is classified.',
    pravdaHeadline: 'OPTIMAL RESOURCE DISTRIBUTION ACHIEVED THROUGH CENTRAL PLANNING',
    severity: 'minor',
    category: 'economic',
    effects: { food: -10, money: 20 },
  },

  // ── Education Events ──
  {
    id: 'education_literacy_campaign',
    ministry: Ministry.EDUCATION,
    title: 'LITERACY CAMPAIGN',
    description: (m) =>
      `Minister ${m.name} launches literacy campaign. Citizens now able to read the propaganda posters they have been saluting for years.`,
    pravdaHeadline: 'ILLITERACY OFFICIALLY ELIMINATED (REMAINING ILLITERATES RECLASSIFIED)',
    severity: 'trivial',
    category: 'cultural',
    effects: { money: -15 },
  },
  {
    id: 'education_textbook_revision',
    ministry: Ministry.EDUCATION,
    title: 'TEXTBOOK REVISION',
    description: (m) =>
      `History textbooks revised. ${m.personality === PersonalityType.ZEALOT ? 'Several historical figures erased. Photographs retouched.' : 'Minor corrections. Stalin still did nothing wrong.'} `,
    pravdaHeadline: 'UPDATED EDUCATIONAL MATERIALS REFLECT LATEST TRUTH',
    severity: 'trivial',
    category: 'cultural',
    effects: { money: -10 },
  },

  // ── MVD Events ──
  {
    id: 'mvd_black_market_raid',
    ministry: Ministry.MVD,
    title: 'BLACK MARKET OPERATION',
    description: (m) =>
      `MVD ${m.personality === PersonalityType.REFORMER ? 'turns blind eye to' : 'raids'} black market. Confiscated: 47 pairs of jeans, 12 Beatles records, 1 suspicious amount of optimism.`,
    pravdaHeadline: 'CAPITALIST CONTRABAND SEIZED IN DARING OPERATION',
    severity: 'minor',
    category: 'economic',
    effects: (m) => ({
      money: m.personality === PersonalityType.REFORMER ? 0 : 30,
      vodka: m.personality === PersonalityType.REFORMER ? 0 : -5,
    }),
  },
  {
    id: 'mvd_corruption_scandal',
    ministry: Ministry.MVD,
    title: 'CORRUPTION SCANDAL',
    description: (m) =>
      `Corruption discovered in MVD. Minister ${m.name}'s corruption level: ${m.corruption}%. Investigation launched by KGB. KGB also corrupt. Investigation ongoing indefinitely.`,
    pravdaHeadline: 'MINOR ADMINISTRATIVE IRREGULARITIES ADDRESSED',
    severity: 'minor',
    category: 'political',
    effects: (m) => ({ money: -Math.floor(m.corruption / 2) }),
    condition: (m) => m.corruption > 40,
  },

  // ── Transport Events ──
  {
    id: 'transport_supply_delay',
    ministry: Ministry.TRANSPORT,
    title: 'SUPPLY CHAIN DISRUPTION',
    description: (m) =>
      `Supply shipment delayed by ${m.competence > 50 ? '2 weeks' : '3 months'}. Contents: unknown. Destination: also unknown. Driver: "I was told to drive east."`,
    pravdaHeadline: 'SHIPMENT TAKES SCENIC ROUTE TO DEMONSTRATE BEAUTIFUL COUNTRYSIDE',
    severity: 'minor',
    category: 'economic',
    effects: (m) => ({ food: m.competence > 50 ? -5 : -15 }),
  },
  {
    id: 'transport_infrastructure_collapse',
    ministry: Ministry.TRANSPORT,
    title: 'INFRASTRUCTURE COLLAPSE',
    description:
      'Bridge collapses. Last inspected: 1958. Inspector: "It looked fine from a distance. I did not get closer."',
    pravdaHeadline: 'RIVER CROSSING UNDERGOES SPONTANEOUS RENOVATION',
    severity: 'major',
    category: 'disaster',
    effects: { money: -50 },
    weight: 0.4,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
//  APPOINTMENT LOGIC
// ─────────────────────────────────────────────────────────────────────────────
//
//  When a new General Secretary takes power, how do they staff the Politburo?
//
//  ┌─────────────┬──────────────────────────────────────────────────────────────┐
//  │ GS Type     │ Appointment Strategy                                        │
//  ├─────────────┼──────────────────────────────────────────────────────────────┤
//  │ ZEALOT      │ Purge all. Appoint loyalists (80% zealots, 20% militarists) │
//  │ IDEALIST    │ Keep 40% old guard. Fill rest with idealists & reformers.    │
//  │ REFORMER    │ Keep 60% for stability. Gradually replace with reformers.    │
//  │ TECHNOCRAT  │ Merit-based. Keep competent ministers regardless of type.     │
//  │ APPARATCHIK │ Seniority rules. Promote whoever waited longest.            │
//  │ POPULIST    │ Keep popular ministers. Replace unpopular ones with populists│
//  │ MILITARIST  │ Purge 70%. Staff with militarists and zealots.              │
//  │ MYSTIC      │ Appoint based on zodiac compatibility. Seriously.           │
//  └─────────────┴──────────────────────────────────────────────────────────────┘
// ─────────────────────────────────────────────────────────────────────────────

export interface AppointmentStrategy {
  /** Fraction of old cabinet to keep (0.0 - 1.0) */
  retentionRate: number;
  /** Preferred personality types for new appointments, in priority order */
  preferredTypes: PersonalityType[];
  /** Minimum loyalty of retained ministers (below this = purged) */
  loyaltyThreshold: number;
  /** Whether to prioritize competence over loyalty */
  meritBased: boolean;
  /** The KGB Chairman survives unless this is true */
  purgesKGB: boolean;
  /** Flavor text for the transition */
  transitionDescription: string;
}

export const APPOINTMENT_STRATEGIES: Record<PersonalityType, AppointmentStrategy> = {
  [PersonalityType.ZEALOT]: {
    retentionRate: 0.0,
    preferredTypes: [PersonalityType.ZEALOT, PersonalityType.MILITARIST],
    loyaltyThreshold: 90,
    meritBased: false,
    purgesKGB: true,
    transitionDescription:
      'The new General Secretary purges the entire cabinet. Loyalty is the only qualification.',
  },
  [PersonalityType.IDEALIST]: {
    retentionRate: 0.4,
    preferredTypes: [
      PersonalityType.IDEALIST,
      PersonalityType.REFORMER,
      PersonalityType.TECHNOCRAT,
    ],
    loyaltyThreshold: 30,
    meritBased: false,
    purgesKGB: false,
    transitionDescription:
      'The new leader keeps some old faces for stability, but whispers of change circulate.',
  },
  [PersonalityType.REFORMER]: {
    retentionRate: 0.6,
    preferredTypes: [
      PersonalityType.REFORMER,
      PersonalityType.TECHNOCRAT,
      PersonalityType.IDEALIST,
    ],
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
    transitionDescription:
      'Almost nothing changes. Those who waited longest get promoted. The system endures.',
  },
  [PersonalityType.POPULIST]: {
    retentionRate: 0.4,
    preferredTypes: [PersonalityType.POPULIST, PersonalityType.IDEALIST, PersonalityType.REFORMER],
    loyaltyThreshold: 30,
    meritBased: false,
    purgesKGB: false,
    transitionDescription:
      'Popular ministers kept. Unpopular ones replaced with people who smile more.',
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
//  COUP & PURGE MECHANICS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculates coup probability for a minister per year.
 *
 * Formula: coupChance = (ambition * (100 - loyalty)) / 10000
 *          + KGB chairman bonus (0.15 if KGB)
 *          + faction bonus (0.05 per faction member)
 *          - GS paranoia penalty (paranoia / 200)
 *
 * ┌──────────────────┬──────────┬──────────┬──────────────────┐
 * │ Ambition/Loyalty │ Low Loy  │ Mid Loy  │ High Loy         │
 * │                  │ (0-30)   │ (31-60)  │ (61-100)         │
 * ├──────────────────┼──────────┼──────────┼──────────────────┤
 * │ Low Amb (0-30)   │ 0.21     │ 0.12     │ 0.00             │
 * │ Mid Amb (31-60)  │ 0.42     │ 0.24     │ 0.06             │
 * │ High Amb (61-100)│ 0.70     │ 0.40     │ 0.10             │
 * └──────────────────┴──────────┴──────────┴──────────────────┘
 * (Base rates before KGB/faction/paranoia adjustments)
 */
export function calculateCoupChance(
  minister: Minister,
  gs: GeneralSecretary,
  factionSize: number
): number {
  const base = (minister.ambition * (100 - minister.loyalty)) / 10000;
  const kgbBonus = minister.ministry === Ministry.KGB ? 0.15 : 0;
  const factionBonus = Math.max(0, factionSize - 1) * 0.05;
  const paranoiaPenalty = gs.paranoia / 200;

  return Math.max(0, Math.min(1, base + kgbBonus + factionBonus - paranoiaPenalty));
}

/**
 * Calculates purge probability for a minister per year.
 *
 * Formula: purgeChance = (GS.paranoia / 100) * (1 - minister.loyalty/100)
 *          + competence penalty (if competence < 30: +0.1)
 *          + corruption risk (corruption / 200)
 *          - KGB protection (if KGB: -0.2, "they know too much")
 *
 * ┌─────────────────────┬──────────┬──────────┬──────────────────┐
 * │ Paranoia / Loyalty   │ Low Loy  │ Mid Loy  │ High Loy         │
 * │                      │ (0-30)   │ (31-60)  │ (61-100)         │
 * ├─────────────────────┼──────────┼──────────┼──────────────────┤
 * │ Low Para (0-30)      │ 0.21     │ 0.12     │ 0.00             │
 * │ Mid Para (31-60)     │ 0.42     │ 0.24     │ 0.06             │
 * │ High Para (61-100)   │ 0.70     │ 0.40     │ 0.10             │
 * └─────────────────────┴──────────┴──────────┴──────────────────┘
 * (Base rates before competence/corruption/KGB adjustments)
 */
export function calculatePurgeChance(minister: Minister, gs: GeneralSecretary): number {
  const base = (gs.paranoia / 100) * (1 - minister.loyalty / 100);
  const competencePenalty = minister.competence < 30 ? 0.1 : 0;
  const corruptionRisk = minister.corruption / 200;
  const kgbProtection = minister.ministry === Ministry.KGB ? 0.2 : 0;

  return Math.max(0, Math.min(1, base + competencePenalty + corruptionRisk - kgbProtection));
}

// ─────────────────────────────────────────────────────────────────────────────
//  NAME GENERATION
// ─────────────────────────────────────────────────────────────────────────────

const FIRST_NAMES = [
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

const LAST_NAMES = [
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

/** Module-level RNG reference, set by PolitburoSystem constructor */
let _rng: GameRng | null = null;

function pick<T>(arr: T[]): T {
  return _rng ? _rng.pick(arr) : arr[Math.floor(Math.random() * arr.length)]!;
}

function randInt(min: number, max: number): number {
  return _rng ? _rng.int(min, max) : Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateName(): string {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

function generateId(): string {
  return _rng
    ? `${Date.now()}_${_rng.id()}`
    : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function randomPersonality(): PersonalityType {
  const types = Object.values(PersonalityType);
  return pick(types);
}

// ─────────────────────────────────────────────────────────────────────────────
//  MINISTER GENERATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a new minister with stats influenced by their personality.
 *
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
const PERSONALITY_STAT_RANGES: Record<
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

export function generateMinister(ministry: Ministry, personality?: PersonalityType): Minister {
  const p = personality ?? randomPersonality();
  const ranges = PERSONALITY_STAT_RANGES[p];

  return {
    id: generateId(),
    name: generateName(),
    ministry,
    personality: p,
    loyalty: randInt(...ranges.loyalty),
    competence: randInt(...ranges.competence),
    ambition: randInt(...ranges.ambition),
    corruption: randInt(...ranges.corruption),
    tenure: 0,
    factionId: null,
    survivedTransition: false,
    purgeRisk: 0,
  };
}

export function generateGeneralSecretary(
  year: number,
  personality?: PersonalityType
): GeneralSecretary {
  const p = personality ?? randomPersonality();
  return {
    id: generateId(),
    name: generateName(),
    personality: p,
    paranoia:
      p === PersonalityType.ZEALOT
        ? randInt(60, 90)
        : p === PersonalityType.MILITARIST
          ? randInt(50, 80)
          : p === PersonalityType.APPARATCHIK
            ? randInt(30, 60)
            : p === PersonalityType.REFORMER
              ? randInt(20, 40)
              : randInt(20, 60),
    health: randInt(60, 95),
    age: randInt(55, 75),
    yearAppointed: year,
    alive: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  POLITBURO STATE
// ─────────────────────────────────────────────────────────────────────────────

export interface PolitburoState {
  generalSecretary: GeneralSecretary;
  ministers: Map<Ministry, Minister>;
  factions: Faction[];
  /** Accumulated tension between ministry pairs */
  tensions: Map<string, number>;
  /** Combined active modifiers from all ministers */
  activeModifiers: MinistryModifiers;
  /** History of past leaders */
  leaderHistory: GeneralSecretary[];
  /** History of purged ministers */
  purgeHistory: Array<{ minister: Minister; year: number; reason: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
//  THE POLITBURO SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

export class PolitburoSystem {
  private state: PolitburoState;

  constructor(
    private gameState: GameState,
    private onEvent: (event: GameEvent) => void,
    rng?: GameRng
  ) {
    if (rng) _rng = rng;
    // Generate initial government
    const gs = generateGeneralSecretary(gameState.date.year);
    const ministers = new Map<Ministry, Minister>();

    for (const ministry of Object.values(Ministry)) {
      ministers.set(ministry, generateMinister(ministry));
    }

    this.state = {
      generalSecretary: gs,
      ministers,
      factions: [],
      tensions: new Map(),
      activeModifiers: { ...DEFAULT_MODIFIERS },
      leaderHistory: [],
      purgeHistory: [],
    };

    this.recalculateModifiers();
    this.formFactions();
  }

  // ── Public API ──────────────────────────────────────────────────────────

  public getState(): Readonly<PolitburoState> {
    return this.state;
  }

  public getModifiers(): Readonly<MinistryModifiers> {
    return this.state.activeModifiers;
  }

  public getMinister(ministry: Ministry): Minister | undefined {
    return this.state.ministers.get(ministry);
  }

  public getGeneralSecretary(): GeneralSecretary {
    return this.state.generalSecretary;
  }

  /**
   * Called every simulation tick by SimulationEngine.
   * Processes monthly/quarterly/annual events based on TickResult boundaries.
   */
  public tick(tickResult: { newMonth: boolean; newYear: boolean }): void {
    const { month } = this.gameState.date;

    // Monthly updates
    if (tickResult.newMonth) {
      this.updateMinisterStats();
      this.checkMinistryEvents();
      this.applyCorruptionDrain();
    }

    // Quarterly checks
    if (tickResult.newMonth && [1, 4, 7, 10].includes(month)) {
      this.checkTensions();
      this.checkPurges();
    }

    // Annual checks
    if (tickResult.newYear) {
      this.ageLeader();
      this.checkCoups();
      this.checkLeaderDeath();
      this.incrementTenure();
      this.formFactions();
      this.recalculateModifiers();
    }
  }

  /**
   * Force a leadership change (for testing or external triggers).
   */
  public forceSuccession(cause: GeneralSecretary['causeOfDeath']): void {
    this.triggerSuccession(cause);
  }

  // ── Private: Modifier Calculation ─────────────────────────────────────

  private recalculateModifiers(): void {
    const mods: MinistryModifiers = { ...DEFAULT_MODIFIERS };

    for (const [ministry, minister] of this.state.ministers) {
      const overrides = PERSONALITY_MINISTRY_MATRIX[ministry]?.[minister.personality];
      if (!overrides) continue;
      const competenceScale = 0.5 + minister.competence / 200;
      applyMinisterOverrides(mods, overrides, competenceScale);
    }

    this.state.activeModifiers = mods;
  }

  // ── Private: Minister Stat Updates ────────────────────────────────────

  private updateMinisterStats(): void {
    const gs = this.state.generalSecretary;

    for (const [_, minister] of this.state.ministers) {
      // Loyalty drift: toward GS personality compatibility
      const compatible = this.personalityCompatibility(gs.personality, minister.personality);
      const loyaltyDrift = compatible ? randInt(0, 3) : randInt(-3, 0);
      minister.loyalty = clamp(minister.loyalty + loyaltyDrift, 0, 100);

      // Ambition grows with tenure
      if (minister.tenure > 3) {
        minister.ambition = clamp(minister.ambition + randInt(0, 2), 0, 100);
      }

      // Corruption grows slowly
      minister.corruption = clamp(minister.corruption + randInt(0, 1), 0, 100);

      // Purge risk accumulates from low loyalty + high ambition
      if (minister.loyalty < 40 || minister.ambition > 70) {
        minister.purgeRisk = clamp(minister.purgeRisk + randInt(1, 5), 0, 100);
      } else {
        minister.purgeRisk = clamp(minister.purgeRisk - 2, 0, 100);
      }
    }
  }

  private personalityCompatibility(a: PersonalityType, b: PersonalityType): boolean {
    const compatMap: Record<PersonalityType, PersonalityType[]> = {
      [PersonalityType.ZEALOT]: [PersonalityType.ZEALOT, PersonalityType.MILITARIST],
      [PersonalityType.IDEALIST]: [
        PersonalityType.IDEALIST,
        PersonalityType.REFORMER,
        PersonalityType.POPULIST,
      ],
      [PersonalityType.REFORMER]: [
        PersonalityType.REFORMER,
        PersonalityType.TECHNOCRAT,
        PersonalityType.IDEALIST,
      ],
      [PersonalityType.TECHNOCRAT]: [PersonalityType.TECHNOCRAT, PersonalityType.REFORMER],
      [PersonalityType.APPARATCHIK]: [PersonalityType.APPARATCHIK, PersonalityType.TECHNOCRAT],
      [PersonalityType.POPULIST]: [
        PersonalityType.POPULIST,
        PersonalityType.IDEALIST,
        PersonalityType.REFORMER,
      ],
      [PersonalityType.MILITARIST]: [PersonalityType.MILITARIST, PersonalityType.ZEALOT],
      [PersonalityType.MYSTIC]: [PersonalityType.MYSTIC, PersonalityType.IDEALIST],
    };
    return compatMap[a]?.includes(b) ?? false;
  }

  // ── Private: Tension System ───────────────────────────────────────────

  private checkTensions(): void {
    for (const rule of TENSION_RULES) {
      const ministerA = this.state.ministers.get(rule.ministryA);
      const ministerB = this.state.ministers.get(rule.ministryB);
      if (!ministerA || !ministerB) continue;
      if (ministerA.personality !== rule.personalityA) continue;
      if (ministerB.personality !== rule.personalityB) continue;

      const key = `${rule.ministryA}_${rule.ministryB}`;
      const current = this.state.tensions.get(key) ?? 0;
      const newTension = current + rule.tensionDelta / 4; // Quarterly portion
      this.state.tensions.set(key, newTension);

      // Tension threshold: generate conflict event
      if (newTension > 50) {
        this.generateTensionEvent(rule, ministerA, ministerB);
        this.state.tensions.set(key, newTension - 30); // Reduce after event
      }

      // Alliance threshold: cooperation bonus
      if (newTension < -30) {
        this.generateAllianceEvent(rule, ministerA, ministerB);
        this.state.tensions.set(key, newTension + 15);
      }
    }
  }

  private generateTensionEvent(rule: TensionRule, a: Minister, b: Minister): void {
    const event: GameEvent = {
      id: `tension_${a.ministry}_${b.ministry}_${Date.now()}`,
      title: 'INTER-MINISTRY CONFLICT',
      description: rule.description,
      pravdaHeadline: 'HEALTHY DEBATE BETWEEN MINISTRIES DEMONSTRATES STRENGTH OF SYSTEM',
      category: 'political',
      severity: 'minor',
      effects: { money: -20 },
      type: 'bad',
    };
    this.onEvent(event);

    // Tension lowers both ministers' loyalty
    a.loyalty = clamp(a.loyalty - 5, 0, 100);
    b.loyalty = clamp(b.loyalty - 5, 0, 100);
  }

  private generateAllianceEvent(rule: TensionRule, a: Minister, b: Minister): void {
    const event: GameEvent = {
      id: `alliance_${a.ministry}_${b.ministry}_${Date.now()}`,
      title: 'INTER-MINISTRY COOPERATION',
      description: rule.description,
      pravdaHeadline: 'MINISTRIES DEMONSTRATE UNITY OF SOCIALIST PURPOSE',
      category: 'political',
      severity: 'trivial',
      effects: { money: 10 },
      type: 'good',
    };
    this.onEvent(event);
  }

  // ── Private: Ministry Events ──────────────────────────────────────────

  private checkMinistryEvents(): void {
    if ((_rng?.random() ?? Math.random()) > 0.15) return;

    const eligible = this.getEligibleMinistryEvents();
    if (eligible.length === 0) return;

    const selected = weightedSelect(eligible);
    this.onEvent(this.buildMinistryEvent(selected));
  }

  /** Filter ministry event templates to those matching the current cabinet. */
  private getEligibleMinistryEvents(): MinistryEventTemplate[] {
    return MINISTRY_EVENTS.filter((template) => {
      const minister = this.state.ministers.get(template.ministry);
      if (!minister) return false;
      if (template.requiredPersonality && minister.personality !== template.requiredPersonality)
        return false;
      if (template.condition && !template.condition(minister, this.gameState)) return false;
      return true;
    });
  }

  /** Build a GameEvent from a selected ministry event template. */
  private buildMinistryEvent(selected: MinistryEventTemplate): GameEvent {
    const minister = this.state.ministers.get(selected.ministry)!;
    const description =
      typeof selected.description === 'function'
        ? selected.description(minister, this.gameState)
        : selected.description;
    const effects =
      typeof selected.effects === 'function'
        ? selected.effects(minister, this.gameState)
        : { ...selected.effects };
    const netImpact =
      (effects.money ?? 0) +
      (effects.food ?? 0) +
      (effects.vodka ?? 0) +
      (effects.pop ?? 0) * 10 +
      (effects.power ?? 0);

    return {
      id: selected.id,
      title: selected.title,
      description,
      pravdaHeadline: selected.pravdaHeadline,
      category: selected.category,
      severity: selected.severity,
      effects,
      type: netImpact > 5 ? 'good' : netImpact < -5 ? 'bad' : 'neutral',
    };
  }

  // ── Private: Corruption ───────────────────────────────────────────────

  private applyCorruptionDrain(): void {
    let totalDrain = 0;
    for (const [_, minister] of this.state.ministers) {
      totalDrain += Math.floor(minister.corruption / 10); // 0-10 rubles per minister per month
    }
    totalDrain += Math.floor(this.state.activeModifiers.corruptionDrain);
    this.gameState.money = Math.max(0, this.gameState.money - totalDrain);
  }

  // ── Private: Purge Checks ────────────────────────────────────────────

  private checkPurges(): void {
    const gs = this.state.generalSecretary;
    const purgeTargets: Minister[] = [];

    for (const [_, minister] of this.state.ministers) {
      const chance = calculatePurgeChance(minister, gs);
      if ((_rng?.random() ?? Math.random()) < chance / 4) {
        // Quarterly check = divide by 4
        purgeTargets.push(minister);
      }
    }

    for (const target of purgeTargets) {
      this.purgeMinister(target, "General Secretary's paranoia");
    }
  }

  private purgeMinister(minister: Minister, reason: string): void {
    this.state.purgeHistory.push({
      minister: { ...minister },
      year: this.gameState.date.year,
      reason,
    });

    // Generate purge event
    const event: GameEvent = {
      id: `purge_${minister.id}`,
      title: 'MINISTERIAL PURGE',
      description: `${MINISTRY_NAMES[minister.ministry]} ${minister.name} has been removed from office. Reason: "${reason}." ${minister.name} has been reassigned to counting trees in Siberia.`,
      pravdaHeadline: `FORMER ${MINISTRY_NAMES[minister.ministry].toUpperCase()} VOLUNTARILY RETIRES TO PURSUE FORESTRY`,
      category: 'political',
      severity: 'major',
      effects: {},
      type: 'neutral',
    };
    this.onEvent(event);

    // Replace with new minister loyal to current GS
    const strategy = APPOINTMENT_STRATEGIES[this.state.generalSecretary.personality];
    const newPersonality = pick(strategy.preferredTypes);
    const replacement = generateMinister(minister.ministry, newPersonality);
    replacement.loyalty = clamp(replacement.loyalty + 20, 0, 100); // New appointees are more loyal
    this.state.ministers.set(minister.ministry, replacement);

    // Paranoia increases after purge
    this.state.generalSecretary.paranoia = clamp(
      this.state.generalSecretary.paranoia + randInt(3, 8),
      0,
      100
    );

    this.recalculateModifiers();
  }

  // ── Private: Coup Checks ─────────────────────────────────────────────

  private checkCoups(): void {
    const gs = this.state.generalSecretary;

    for (const [_, minister] of this.state.ministers) {
      const factionSize = minister.factionId
        ? (this.state.factions.find((f) => f.id === minister.factionId)?.memberIds.length ?? 1)
        : 1;

      const chance = calculateCoupChance(minister, gs, factionSize);

      if ((_rng?.random() ?? Math.random()) < chance) {
        this.executeCoup(minister);
        return; // Only one coup per year
      }
    }
  }

  private executeCoup(couper: Minister): void {
    const oldLeader = this.state.generalSecretary;
    oldLeader.alive = false;
    oldLeader.causeOfDeath = 'coup';
    this.state.leaderHistory.push({ ...oldLeader });

    const event: GameEvent = {
      id: `coup_${couper.id}`,
      title: 'PALACE COUP',
      description: `${MINISTRY_NAMES[couper.ministry]} ${couper.name} has seized power! Former General Secretary ${oldLeader.name} "has retired for health reasons." His health: terminal.`,
      pravdaHeadline: `SMOOTH TRANSITION OF POWER: NEW LEADERSHIP BRINGS FRESH VISION`,
      category: 'political',
      severity: 'catastrophic',
      effects: { money: -100, pop: -5 },
      type: 'bad',
    };
    this.onEvent(event);

    // The couper becomes General Secretary
    const newGS: GeneralSecretary = {
      id: generateId(),
      name: couper.name,
      personality: couper.personality,
      paranoia: randInt(50, 90), // Coup leaders are paranoid
      health: randInt(50, 80),
      age: randInt(50, 70),
      yearAppointed: this.gameState.date.year,
      alive: true,
    };

    this.state.generalSecretary = newGS;
    this.staffNewCabinet();
    this.recalculateModifiers();
  }

  // ── Private: Leader Health & Death ────────────────────────────────────

  private ageLeader(): void {
    const gs = this.state.generalSecretary;
    gs.age++;

    // Health decay: faster with age and paranoia
    const healthDecay = Math.floor((gs.age - 50) / 5) + Math.floor(gs.paranoia / 30);
    gs.health = clamp(gs.health - randInt(1, healthDecay + 1), 0, 100);
  }

  private checkLeaderDeath(): void {
    const gs = this.state.generalSecretary;
    if (gs.health <= 0) {
      this.triggerSuccession('natural');
    }

    // Additional chance of sudden death based on age
    if (gs.age > 70 && (_rng?.random() ?? Math.random()) < (gs.age - 70) / 100) {
      gs.health = 0;
      this.triggerSuccession('natural');
    }
  }

  private triggerSuccession(cause: GeneralSecretary['causeOfDeath']): void {
    const oldLeader = this.state.generalSecretary;
    if (!oldLeader.alive) return; // Prevent double-trigger

    oldLeader.alive = false;
    oldLeader.causeOfDeath = cause;
    this.state.leaderHistory.push({ ...oldLeader });

    const causeText =
      cause === 'natural'
        ? 'after a long illness heroically endured'
        : cause === 'coup'
          ? 'due to sudden retirement'
          : 'under circumstances that are classified';

    const newGS = generateGeneralSecretary(this.gameState.date.year);

    const event: GameEvent = {
      id: `succession_${oldLeader.id}`,
      title: 'LEADERSHIP TRANSITION',
      description: `General Secretary ${oldLeader.name} has departed ${causeText}. New General Secretary ${newGS.name} (${newGS.personality}) takes the helm. The State endures.`,
      pravdaHeadline: `NEW ERA OF PROSPERITY BEGINS UNDER VISIONARY LEADERSHIP OF ${newGS.name.toUpperCase()}`,
      category: 'political',
      severity: 'catastrophic',
      effects: { money: -50 },
      type: 'neutral',
    };
    this.onEvent(event);

    this.state.generalSecretary = newGS;
    this.staffNewCabinet();
    this.recalculateModifiers();
  }

  // ── Private: Cabinet Staffing ─────────────────────────────────────────

  private staffNewCabinet(): void {
    const gs = this.state.generalSecretary;
    const strategy = APPOINTMENT_STRATEGIES[gs.personality];
    const oldMinisters = new Map(this.state.ministers);

    for (const ministry of Object.values(Ministry)) {
      const oldMinister = oldMinisters.get(ministry);
      if (this.retainMinister(ministry, oldMinister, strategy)) continue;
      this.appointNewMinister(ministry, strategy);
    }

    this.formFactions();
  }

  /** Attempt to retain a minister during a leadership transition. Returns true if retained. */
  private retainMinister(
    ministry: Ministry,
    oldMinister: Minister | undefined,
    strategy: (typeof APPOINTMENT_STRATEGIES)[PersonalityType]
  ): boolean {
    if (!oldMinister) return false;

    // KGB Chairman special case: they know too much
    if (ministry === Ministry.KGB && !strategy.purgesKGB) {
      oldMinister.survivedTransition = true;
      oldMinister.loyalty = clamp(oldMinister.loyalty - 10, 0, 100);
      oldMinister.ambition = clamp(oldMinister.ambition + 10, 0, 100);
      return true;
    }

    if ((_rng?.random() ?? Math.random()) >= strategy.retentionRate) return false;
    if (strategy.meritBased && oldMinister.competence < 40) return false;
    if (oldMinister.loyalty < strategy.loyaltyThreshold) return false;

    oldMinister.survivedTransition = true;
    oldMinister.loyalty = clamp(oldMinister.loyalty + randInt(-10, 10), 0, 100);
    return true;
  }

  /** Appoint a fresh minister to a ministry post. */
  private appointNewMinister(
    ministry: Ministry,
    strategy: (typeof APPOINTMENT_STRATEGIES)[PersonalityType]
  ): void {
    const newPersonality = pick(strategy.preferredTypes);
    const newMinister = generateMinister(ministry, newPersonality);
    newMinister.loyalty = clamp(newMinister.loyalty + 15, 0, 100);
    this.state.ministers.set(ministry, newMinister);
  }

  // ── Private: Faction Formation ────────────────────────────────────────

  private formFactions(): void {
    this.state.factions = [];
    const ministersByPersonality = new Map<PersonalityType, Minister[]>();

    for (const [_, minister] of this.state.ministers) {
      const list = ministersByPersonality.get(minister.personality) ?? [];
      list.push(minister);
      ministersByPersonality.set(minister.personality, list);
    }

    for (const [personality, members] of ministersByPersonality) {
      if (members.length >= 2) {
        const faction: Faction = {
          id: `faction_${personality}_${Date.now()}`,
          name: `${personality.charAt(0).toUpperCase() + personality.slice(1)} Bloc`,
          alignment: personality,
          memberIds: members.map((m) => m.id),
          influence: members.reduce((sum, m) => sum + m.competence + m.ambition, 0),
          supportsCurrent: this.personalityCompatibility(
            this.state.generalSecretary.personality,
            personality
          ),
        };

        for (const member of members) {
          member.factionId = faction.id;
        }

        this.state.factions.push(faction);
      }
    }
  }

  // ── Private: Tenure ───────────────────────────────────────────────────

  private incrementTenure(): void {
    for (const [_, minister] of this.state.ministers) {
      minister.tenure++;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/** Weighted random selection from ministry event templates. */
function weightedSelect(eligible: MinistryEventTemplate[]): MinistryEventTemplate {
  const totalWeight = eligible.reduce((sum, t) => sum + (t.weight ?? 1), 0);
  let roll = (_rng?.random() ?? Math.random()) * totalWeight;
  for (const template of eligible) {
    roll -= template.weight ?? 1;
    if (roll <= 0) return template;
  }
  return pick(eligible);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Apply a minister's personality overrides to the active modifiers, scaled by competence. */
function applyMinisterOverrides(
  mods: MinistryModifiers,
  overrides: Record<string, unknown>,
  competenceScale: number
): void {
  const modsRecord = mods as unknown as Record<string, number | boolean>;
  for (const [key, value] of Object.entries(overrides)) {
    const modKey = key as keyof MinistryModifiers;
    if (typeof value === 'number') {
      const currentVal = mods[modKey];
      if (typeof currentVal !== 'number') continue;
      const isMultiplier = key.endsWith('Mult') || key === 'hospitalEffectiveness';
      modsRecord[modKey] = isMultiplier
        ? currentVal + (value - 1.0) * competenceScale
        : currentVal + (value - currentVal) * competenceScale;
    } else if (typeof value === 'boolean') {
      modsRecord[modKey] = value;
    }
  }
}

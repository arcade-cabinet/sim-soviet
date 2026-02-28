/**
 * @module game/politburo/types
 *
 * All interfaces, enums, and type aliases for the Politburo system.
 */

import type { EventCategory, EventSeverity, ResourceDelta } from '../events';
import type { GameView } from '../GameView';

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

export type ModifierOverride = Partial<MinistryModifiers>;

// ─────────────────────────────────────────────────────────────────────────────
//  TENSION RULES
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

// ─────────────────────────────────────────────────────────────────────────────
//  MINISTRY EVENT TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

export interface MinistryEventTemplate {
  id: string;
  ministry: Ministry;
  title: string;
  description: string | ((minister: Minister, gs: GameView) => string);
  pravdaHeadline: string;
  severity: EventSeverity;
  category: EventCategory;
  effects: ResourceDelta | ((minister: Minister, gs: GameView) => ResourceDelta);
  /** Only fires when this personality holds the ministry */
  requiredPersonality?: PersonalityType;
  /** General condition check */
  condition?: (minister: Minister, gs: GameView) => boolean;
  weight?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
//  APPOINTMENT STRATEGIES
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

/**
 * Typed message constants and payload interfaces for inter-agent
 * communication via Yuka's Telegram system.
 *
 * @module ai/telegrams
 */

/** All telegram message type strings, grouped by originating agent. */
export const MSG = {
  // ChronologyAgent -> ALL
  NEW_MONTH: 'NEW_MONTH',
  NEW_YEAR: 'NEW_YEAR',
  NEW_SEASON: 'NEW_SEASON',

  // WeatherAgent -> ALL
  WEATHER_CHANGED: 'WEATHER_CHANGED',
  WINTER_APPROACHING: 'WINTER_APPROACHING',
  STORM_WARNING: 'STORM_WARNING',

  // PowerAgent
  POWER_SHORTAGE: 'POWER_SHORTAGE',
  BUILDING_UNPOWERED: 'BUILDING_UNPOWERED',

  // FoodAgent
  FOOD_SHORTAGE: 'FOOD_SHORTAGE',
  STARVATION_WARNING: 'STARVATION_WARNING',
  FOOD_SURPLUS: 'FOOD_SURPLUS',

  // VodkaAgent
  VODKA_SHORTAGE: 'VODKA_SHORTAGE',
  MORALE_BOOST: 'MORALE_BOOST',

  // EconomyAgent
  TRUDODNI_SHORTFALL: 'TRUDODNI_SHORTFALL',
  BLAT_OPPORTUNITY: 'BLAT_OPPORTUNITY',
  REFORM_AVAILABLE: 'REFORM_AVAILABLE',

  // StorageAgent
  STORAGE_FULL: 'STORAGE_FULL',
  FOOD_SPOILED: 'FOOD_SPOILED',

  // CollectiveAgent
  BUILDING_PLACED: 'BUILDING_PLACED',
  WORKER_ASSIGNED: 'WORKER_ASSIGNED',
  DEMAND_UNMET: 'DEMAND_UNMET',

  // DemographicAgent
  LABOR_SHORTAGE: 'LABOR_SHORTAGE',
  LABOR_SURPLUS: 'LABOR_SURPLUS',
  POPULATION_MILESTONE: 'POPULATION_MILESTONE',

  // KGBAgent
  INSPECTION_IMMINENT: 'INSPECTION_IMMINENT',
  MARKS_INCREASED: 'MARKS_INCREASED',
  ARREST_WARRANT: 'ARREST_WARRANT',

  // PoliticalAgent
  ERA_TRANSITION: 'ERA_TRANSITION',
  QUOTA_DEADLINE: 'QUOTA_DEADLINE',
  PLAN_UPDATED: 'PLAN_UPDATED',
  ANNUAL_REPORT_DUE: 'ANNUAL_REPORT_DUE',

  // DefenseAgent
  EMERGENCY_FIRE: 'EMERGENCY_FIRE',
  EMERGENCY_METEOR: 'EMERGENCY_METEOR',
  DISEASE_OUTBREAK: 'DISEASE_OUTBREAK',

  // LoyaltyAgent
  DVOR_DISLOYAL: 'DVOR_DISLOYAL',
  SABOTAGE_EVENT: 'SABOTAGE_EVENT',
  FLIGHT_RISK: 'FLIGHT_RISK',

  // ChairmanAgent
  SET_FOCUS: 'SET_FOCUS',
  OFFER_BRIBE: 'OFFER_BRIBE',
  MINIGAME_RESOLVED: 'MINIGAME_RESOLVED',
  REPORT_SUBMITTED: 'REPORT_SUBMITTED',
} as const;

/** Union of all telegram message type string literals. */
export type MessageType = (typeof MSG)[keyof typeof MSG];

// ---------------------------------------------------------------------------
// Payload interfaces
// ---------------------------------------------------------------------------

/** @param deficit - amount of food units below minimum */
export interface FoodShortagePayload {
  deficit: number;
  turnsUntilStarvation: number;
}

/** @param marks - current KGB mark count */
export interface InspectionPayload {
  marks: number;
  inspectorName: string;
}

/** @param fromEra - era index being left */
export interface EraTransitionPayload {
  fromEra: number;
  toEra: number;
  yearStart: number;
}

/** @param focus - resource key to prioritize */
export interface SetFocusPayload {
  focus: string;
  reason: string;
}

/** @param minigameId - which minigame was completed */
export interface MinigameResolvedPayload {
  minigameId: string;
  success: boolean;
  reward?: number;
}

/** @param year - year covered by the report */
export interface ReportSubmittedPayload {
  year: number;
  score: number;
  quotasMet: number;
  quotasTotal: number;
}

/** Discriminated union of all typed telegram payloads. */
export type TelegramPayload =
  | FoodShortagePayload
  | InspectionPayload
  | EraTransitionPayload
  | SetFocusPayload
  | MinigameResolvedPayload
  | ReportSubmittedPayload;

/**
 * @fileoverview Typed telegram definitions for inter-agent communication.
 *
 * Agents communicate via Yuka's MessageDispatcher.dispatch().
 * Each telegram carries a typed payload identified by a string message type.
 */

export const MSG = {
  // ChronologyAgent → ALL
  NEW_TICK: 'NEW_TICK',
  NEW_MONTH: 'NEW_MONTH',
  NEW_YEAR: 'NEW_YEAR',
  NEW_SEASON: 'NEW_SEASON',

  // Orchestration Phases (Dispatched sequentially by ChronologyAgent)
  PHASE_PRODUCTION: 'PHASE_PRODUCTION',
  PHASE_CONSUMPTION: 'PHASE_CONSUMPTION',
  PHASE_SOCIAL: 'PHASE_SOCIAL',
  PHASE_POLITICAL: 'PHASE_POLITICAL',
  PHASE_NARRATIVE: 'PHASE_NARRATIVE',

  // WeatherAgent → ALL
  WEATHER_CHANGED: 'WEATHER_CHANGED',
  WINTER_APPROACHING: 'WINTER_APPROACHING',
  STORM_WARNING: 'STORM_WARNING',

  // PowerAgent → ChairmanAgent, CollectiveAgent
  POWER_SHORTAGE: 'POWER_SHORTAGE',
  BUILDING_UNPOWERED: 'BUILDING_UNPOWERED',

  // FoodAgent → ChairmanAgent
  FOOD_SHORTAGE: 'FOOD_SHORTAGE',
  STARVATION_WARNING: 'STARVATION_WARNING',
  FOOD_SURPLUS: 'FOOD_SURPLUS',

  // VodkaAgent → ChairmanAgent
  VODKA_SHORTAGE: 'VODKA_SHORTAGE',
  MORALE_BOOST: 'MORALE_BOOST',

  // EconomyAgent → ChairmanAgent
  TRUDODNI_SHORTFALL: 'TRUDODNI_SHORTFALL',
  BLAT_OPPORTUNITY: 'BLAT_OPPORTUNITY',
  REFORM_AVAILABLE: 'REFORM_AVAILABLE',

  // StorageAgent → ChairmanAgent
  STORAGE_FULL: 'STORAGE_FULL',
  FOOD_SPOILED: 'FOOD_SPOILED',

  // CollectiveAgent → ChairmanAgent
  BUILDING_PLACED: 'BUILDING_PLACED',
  WORKER_ASSIGNED: 'WORKER_ASSIGNED',
  DEMAND_UNMET: 'DEMAND_UNMET',

  // DemographicAgent → EconomyAgent, ChairmanAgent
  LABOR_SHORTAGE: 'LABOR_SHORTAGE',
  LABOR_SURPLUS: 'LABOR_SURPLUS',
  POPULATION_MILESTONE: 'POPULATION_MILESTONE',

  // KGBAgent → ChairmanAgent
  INSPECTION_IMMINENT: 'INSPECTION_IMMINENT',
  MARKS_INCREASED: 'MARKS_INCREASED',
  ARREST_WARRANT: 'ARREST_WARRANT',

  // PoliticalAgent → ALL
  ERA_TRANSITION: 'ERA_TRANSITION',
  QUOTA_DEADLINE: 'QUOTA_DEADLINE',
  PLAN_UPDATED: 'PLAN_UPDATED',
  ANNUAL_REPORT_DUE: 'ANNUAL_REPORT_DUE',

  // DefenseAgent → ChairmanAgent
  EMERGENCY_FIRE: 'EMERGENCY_FIRE',
  EMERGENCY_METEOR: 'EMERGENCY_METEOR',
  DISEASE_OUTBREAK: 'DISEASE_OUTBREAK',

  // LoyaltyAgent → ChairmanAgent
  DVOR_DISLOYAL: 'DVOR_DISLOYAL',
  SABOTAGE_EVENT: 'SABOTAGE_EVENT',
  FLIGHT_RISK: 'FLIGHT_RISK',

  // ChairmanAgent → CollectiveAgent
  SET_FOCUS: 'SET_FOCUS',

  // ChairmanAgent → KGBAgent
  OFFER_BRIBE: 'OFFER_BRIBE',

  // ChairmanAgent → SimulationEngine (player decisions)
  MINIGAME_RESOLVED: 'MINIGAME_RESOLVED',
  REPORT_SUBMITTED: 'REPORT_SUBMITTED',
} as const;

export type MessageType = (typeof MSG)[keyof typeof MSG];

export interface NewTickPayload {
  totalTicks: number;
  delta: number;
}

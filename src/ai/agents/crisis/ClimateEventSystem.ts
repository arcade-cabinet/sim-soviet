/**
 * @module ai/agents/crisis/ClimateEventSystem
 *
 * Tier 2 events: seasonal/geographic pattern-driven natural events.
 * ADD pressure but aren't caused by player neglect.
 *
 * Each event has valid seasons, weather boosts, climate trend ranges,
 * and pressure contributions. Evaluated every tick — season/weather gates
 * ensure events only fire when climatically appropriate.
 */

import type { GameRng } from '@/game/SeedSystem';
import { Season } from '@/game/Chronology';
import { WeatherType } from '../core/weather-types';
import type { PressureDomain } from './pressure/PressureDomains';
import type { CrisisImpact } from './types';

// ─── Climate Event Definition ────────────────────────────────────────────────

export interface ClimateEventDef {
  id: string;
  name: string;
  /** Seasons during which this event can occur. */
  validSeasons: Season[];
  /** Weather types that boost occurrence (with multiplier). */
  weatherBoosts: Partial<Record<WeatherType, number>>;
  /** Climate trend range for this event (min, max). null = any. */
  climateTrendRange: { min: number; max: number } | null;
  /** Base probability per tick when conditions are met. */
  baseProbability: number;
  /** Pressure domains affected and their spike amounts. */
  pressureSpikes: Partial<Record<PressureDomain, number>>;
  /** Crisis impact for immediate effects. */
  impact: CrisisImpact;
  /** Minimum ticks between occurrences of this event. */
  cooldownTicks: number;
}

// ─── Event Catalog ───────────────────────────────────────────────────────────

export const CLIMATE_EVENTS: readonly ClimateEventDef[] = [
  {
    id: 'severe_frost',
    name: 'Severe Frost',
    validSeasons: [Season.WINTER, Season.EARLY_FROST],
    weatherBoosts: { [WeatherType.BLIZZARD]: 2.0, [WeatherType.SNOW]: 1.3 },
    climateTrendRange: { min: -1.0, max: -0.2 },
    baseProbability: 0.008,
    cooldownTicks: 24,
    pressureSpikes: { food: 0.1, infrastructure: 0.05, health: 0.08, power: 0.06 },
    impact: {
      crisisId: 'climate-severe-frost',
      economy: { productionMult: 0.8 },
      social: { diseaseMult: 1.5 },
      narrative: {
        pravdaHeadlines: ['SEVERE FROST GRIPS THE SETTLEMENT — Citizens urged to conserve fuel.'],
        toastMessages: [{ text: 'Severe frost! Increased heating costs.', severity: 'warning' }],
      },
    },
  },
  {
    id: 'summer_drought',
    name: 'Summer Drought',
    validSeasons: [Season.STIFLING_HEAT, Season.GOLDEN_WEEK],
    weatherBoosts: { [WeatherType.HEATWAVE]: 2.5, [WeatherType.CLEAR]: 1.3 },
    climateTrendRange: { min: -0.8, max: -0.1 },
    baseProbability: 0.006,
    cooldownTicks: 36,
    pressureSpikes: { food: 0.15, health: 0.05 },
    impact: {
      crisisId: 'climate-summer-drought',
      economy: { productionMult: 0.85, foodDelta: -20 },
      narrative: {
        pravdaHeadlines: ['DROUGHT CONDITIONS AFFECTING CROPS — Harvest projections revised.'],
        toastMessages: [{ text: 'Drought is destroying crops.', severity: 'warning' }],
      },
    },
  },
  {
    id: 'spring_flood',
    name: 'Spring Flood',
    validSeasons: [Season.RASPUTITSA_SPRING],
    weatherBoosts: { [WeatherType.MUD_STORM]: 2.0, [WeatherType.RAIN]: 1.5 },
    climateTrendRange: { min: 0.2, max: 1.0 },
    baseProbability: 0.007,
    cooldownTicks: 24,
    pressureSpikes: { infrastructure: 0.1, housing: 0.05 },
    impact: {
      crisisId: 'climate-spring-flood',
      infrastructure: { decayMult: 1.5 },
      narrative: {
        pravdaHeadlines: ['SPRING FLOODING DAMAGES INFRASTRUCTURE — Repair brigades deployed.'],
        toastMessages: [{ text: 'Spring floods damaging buildings.', severity: 'warning' }],
      },
    },
  },
  {
    id: 'seasonal_epidemic',
    name: 'Seasonal Epidemic',
    validSeasons: [Season.WINTER, Season.RASPUTITSA_AUTUMN],
    weatherBoosts: { [WeatherType.FOG]: 1.5, [WeatherType.SNOW]: 1.2 },
    climateTrendRange: null,
    baseProbability: 0.005,
    cooldownTicks: 36,
    pressureSpikes: { health: 0.12, morale: 0.05, demographic: 0.03 },
    impact: {
      crisisId: 'climate-seasonal-epidemic',
      social: { diseaseMult: 2.0, growthMult: 0.9 },
      narrative: {
        pravdaHeadlines: ['SEASONAL ILLNESS SPREADING — Clinics operating at capacity.'],
        toastMessages: [{ text: 'Seasonal epidemic spreading.', severity: 'warning' }],
      },
    },
  },
  {
    id: 'wildfire',
    name: 'Wildfire',
    validSeasons: [Season.STIFLING_HEAT],
    weatherBoosts: { [WeatherType.HEATWAVE]: 3.0, [WeatherType.CLEAR]: 1.5 },
    climateTrendRange: { min: -1.0, max: 0.0 },
    baseProbability: 0.004,
    cooldownTicks: 48,
    pressureSpikes: { infrastructure: 0.12, food: 0.08 },
    impact: {
      crisisId: 'climate-wildfire',
      infrastructure: { decayMult: 2.0 },
      economy: { productionMult: 0.75 },
      narrative: {
        pravdaHeadlines: ['WILDFIRE THREATENS SETTLEMENT — Firefighting efforts underway.'],
        toastMessages: [{ text: 'Wildfire approaching!', severity: 'critical' }],
      },
    },
  },
  {
    id: 'hailstorm',
    name: 'Hailstorm',
    validSeasons: [Season.SHORT_SUMMER],
    weatherBoosts: { [WeatherType.RAIN]: 2.0 },
    climateTrendRange: null,
    baseProbability: 0.005,
    cooldownTicks: 24,
    pressureSpikes: { food: 0.08, infrastructure: 0.04 },
    impact: {
      crisisId: 'climate-hailstorm',
      economy: { productionMult: 0.88, foodDelta: -10 },
      narrative: {
        pravdaHeadlines: ['HAILSTORM BATTERS FIELDS — Crop damage reported.'],
        toastMessages: [{ text: 'Hailstorm damaged crops.', severity: 'warning' }],
      },
    },
  },
];

// ─── ClimateEventSystem ──────────────────────────────────────────────────────

/**
 * Evaluates climate events every tick. Season/weather gates ensure
 * events only fire when climatically appropriate.
 */
export class ClimateEventSystem {
  /** Cooldown tracking: event ID → ticks remaining. */
  private cooldowns: Map<string, number> = new Map();

  /**
   * Evaluate all climate events for the current tick.
   *
   * @param season - Current season enum value
   * @param weather - Current weather type
   * @param climateTrend - World climate trend (-1 to +1)
   * @param rng - Seeded RNG
   * @returns Array of triggered event impacts + pressure spikes
   */
  evaluate(
    season: Season,
    weather: WeatherType,
    climateTrend: number,
    rng: GameRng,
  ): { impacts: CrisisImpact[]; pressureSpikes: Partial<Record<PressureDomain, number>> } {
    const impacts: CrisisImpact[] = [];
    const aggregateSpikes: Partial<Record<PressureDomain, number>> = {};

    // Decrement all cooldowns
    for (const [id, remaining] of this.cooldowns) {
      if (remaining <= 1) {
        this.cooldowns.delete(id);
      } else {
        this.cooldowns.set(id, remaining - 1);
      }
    }

    for (const event of CLIMATE_EVENTS) {
      // Cooldown check
      if (this.cooldowns.has(event.id)) continue;

      // Season gate
      if (!event.validSeasons.includes(season)) continue;

      // Climate trend gate
      if (event.climateTrendRange) {
        if (climateTrend < event.climateTrendRange.min || climateTrend > event.climateTrendRange.max) continue;
      }

      // Compute probability with weather boost
      let probability = event.baseProbability;
      const boost = event.weatherBoosts[weather];
      if (boost) {
        probability *= boost;
      }

      // Roll
      if (rng.random() < probability) {
        impacts.push(event.impact);

        // Aggregate pressure spikes
        for (const [domain, spike] of Object.entries(event.pressureSpikes)) {
          const d = domain as PressureDomain;
          aggregateSpikes[d] = (aggregateSpikes[d] ?? 0) + spike;
        }

        // Set cooldown
        this.cooldowns.set(event.id, event.cooldownTicks);
      }
    }

    return { impacts, pressureSpikes: aggregateSpikes };
  }

  /** Serialize cooldown state. */
  serialize(): Array<[string, number]> {
    return [...this.cooldowns.entries()];
  }

  /** Restore cooldown state. */
  restore(data: Array<[string, number]>): void {
    this.cooldowns = new Map(data);
  }
}

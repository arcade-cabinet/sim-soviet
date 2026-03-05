/**
 * @module ai/agents/crisis/ClimateEventSystem
 *
 * Tier 2 events: seasonal/geographic pattern-driven natural events.
 * ADD pressure but aren't caused by player neglect.
 *
 * Each event has valid seasons, weather boosts, climate trend ranges,
 * and pressure contributions. Evaluated every tick — season/weather gates
 * ensure events only fire when climatically appropriate.
 *
 * Event catalog sourced from src/config/climateEvents.json.
 */

import type { GameRng } from '@/game/SeedSystem';
import { Season } from '@/game/Chronology';
import { WeatherType } from '../core/weather-types';
import type { PressureDomain } from './pressure/PressureDomains';
import type { CrisisImpact } from './types';
import climateEventsData from '@/config/climateEvents.json';
import marsClimateEventsData from '@/config/climateEventsMars.json';

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

// ─── Enum Mapping ────────────────────────────────────────────────────────────

/** Map Season enum key strings (e.g. "WINTER") to Season enum values (e.g. "winter"). */
const SEASON_KEY_MAP: Record<string, Season> = {
  WINTER: Season.WINTER,
  RASPUTITSA_SPRING: Season.RASPUTITSA_SPRING,
  SHORT_SUMMER: Season.SHORT_SUMMER,
  GOLDEN_WEEK: Season.GOLDEN_WEEK,
  STIFLING_HEAT: Season.STIFLING_HEAT,
  EARLY_FROST: Season.EARLY_FROST,
  RASPUTITSA_AUTUMN: Season.RASPUTITSA_AUTUMN,
};

/** Map WeatherType enum key strings (e.g. "BLIZZARD") to WeatherType enum values (e.g. "blizzard"). */
const WEATHER_KEY_MAP: Record<string, WeatherType> = {
  CLEAR: WeatherType.CLEAR,
  OVERCAST: WeatherType.OVERCAST,
  SNOW: WeatherType.SNOW,
  BLIZZARD: WeatherType.BLIZZARD,
  RAIN: WeatherType.RAIN,
  MUD_STORM: WeatherType.MUD_STORM,
  HEATWAVE: WeatherType.HEATWAVE,
  MIRACULOUS_SUN: WeatherType.MIRACULOUS_SUN,
  FOG: WeatherType.FOG,
};

// ─── JSON → Typed Conversion ─────────────────────────────────────────────────

/** Raw shape of a single climate event entry in JSON. */
interface RawClimateEvent {
  id: string;
  name: string;
  validSeasons: string[];
  weatherBoosts: Record<string, number>;
  climateTrendRange: { min: number; max: number } | null;
  baseProbability: number;
  cooldownTicks: number;
  pressureSpikes: Record<string, number>;
  impact: CrisisImpact;
}

function parseClimateEvents(raw: readonly RawClimateEvent[]): ClimateEventDef[] {
  return raw.map((entry) => {
    const validSeasons = entry.validSeasons.map((key) => {
      const season = SEASON_KEY_MAP[key];
      if (!season) throw new Error(`Unknown season key in climateEvents.json: ${key}`);
      return season;
    });

    const weatherBoosts: Partial<Record<WeatherType, number>> = {};
    for (const [key, value] of Object.entries(entry.weatherBoosts)) {
      const wt = WEATHER_KEY_MAP[key];
      if (!wt) throw new Error(`Unknown weather key in climateEvents.json: ${key}`);
      weatherBoosts[wt] = value;
    }

    return {
      id: entry.id,
      name: entry.name,
      validSeasons,
      weatherBoosts,
      climateTrendRange: entry.climateTrendRange,
      baseProbability: entry.baseProbability,
      cooldownTicks: entry.cooldownTicks,
      pressureSpikes: entry.pressureSpikes as Partial<Record<PressureDomain, number>>,
      impact: entry.impact,
    };
  });
}

// ─── Event Catalog ───────────────────────────────────────────────────────────

export const CLIMATE_EVENTS: readonly ClimateEventDef[] = parseClimateEvents(
  climateEventsData as unknown as RawClimateEvent[],
);

/** Mars-specific climate events (terraforming progress + Mars disasters). */
export const MARS_CLIMATE_EVENTS: readonly ClimateEventDef[] = parseClimateEvents(
  marsClimateEventsData as unknown as RawClimateEvent[],
);

/** Per-world climate event catalogs keyed by profile id. */
const WORLD_CLIMATE_CATALOGS: Readonly<Record<string, readonly ClimateEventDef[]>> = {
  earth_temperate: CLIMATE_EVENTS,
  earth_arctic: CLIMATE_EVENTS,
  earth_desert: CLIMATE_EVENTS,
  martian: MARS_CLIMATE_EVENTS,
};

/**
 * Get the climate event catalog for a given world profile id.
 * Defaults to Earth events for unknown worlds.
 */
export function getClimateEventsForWorld(profileId: string): readonly ClimateEventDef[] {
  return WORLD_CLIMATE_CATALOGS[profileId] ?? CLIMATE_EVENTS;
}

// ─── ClimateEventSystem ──────────────────────────────────────────────────────

/** Result of climate event evaluation including terraforming progress tracking. */
export interface ClimateEvalResult {
  impacts: CrisisImpact[];
  pressureSpikes: Partial<Record<PressureDomain, number>>;
  /** Terraforming progress delta (only non-zero when warmingPolarity = -1). */
  terraformingProgress: number;
}

/**
 * Evaluates climate events every tick. Season/weather gates ensure
 * events only fire when climatically appropriate.
 *
 * Supports climate polarity: on worlds with warmingPolarity = -1 (Mars),
 * the effective climate trend is inverted, and pressure spikes from
 * warming-dependent events become beneficial (negative = pressure relief).
 */
export class ClimateEventSystem {
  /** Cooldown tracking: event ID → ticks remaining. */
  private cooldowns: Map<string, number> = new Map();
  /** Accumulated terraforming progress (for worlds with polarity -1). */
  private terraformingProgress = 0;

  /**
   * Evaluate all climate events for the current tick.
   *
   * @param season - Current season enum value
   * @param weather - Current weather type
   * @param climateTrend - World climate trend (-1 to +1)
   * @param rng - Seeded RNG
   * @param warmingPolarity - Climate polarity: 1 = warming is bad (Earth), -1 = warming is good (Mars). Defaults to 1.
   * @param catalog - Climate event catalog to use. Defaults to Earth events.
   * @returns Triggered event impacts, pressure spikes, and terraforming progress
   */
  evaluate(
    season: Season,
    weather: WeatherType,
    climateTrend: number,
    rng: GameRng,
    warmingPolarity: 1 | -1 = 1,
    catalog?: readonly ClimateEventDef[],
  ): ClimateEvalResult {
    const impacts: CrisisImpact[] = [];
    const aggregateSpikes: Partial<Record<PressureDomain, number>> = {};
    let tickTerraformingDelta = 0;

    // Polarity determines whether warming is beneficial or harmful.
    // Per-world catalogs already encode the correct trend semantics,
    // so trend range checks use raw climateTrend. Polarity affects:
    // (1) which events qualify as "beneficial" for terraforming tracking
    // (2) how pressure spikes feed back into the pressure system
    // For the Earth catalog with polarity -1 (arctic warming = good),
    // effectiveTrend inverts to enable cold-weather events:
    const effectiveTrend = catalog ? climateTrend : climateTrend * warmingPolarity;

    const events = catalog ?? CLIMATE_EVENTS;

    // Decrement all cooldowns
    for (const [id, remaining] of this.cooldowns) {
      if (remaining <= 1) {
        this.cooldowns.delete(id);
      } else {
        this.cooldowns.set(id, remaining - 1);
      }
    }

    for (const event of events) {
      // Cooldown check
      if (this.cooldowns.has(event.id)) continue;

      // Season gate
      if (!event.validSeasons.includes(season)) continue;

      // Climate trend gate
      // World-specific catalogs use raw climateTrend (events encode their own semantics)
      // Earth catalog uses effectiveTrend (polarity inverts for arctic settlements)
      const trendForGate = catalog ? climateTrend : effectiveTrend;
      if (event.climateTrendRange) {
        if (trendForGate < event.climateTrendRange.min || trendForGate > event.climateTrendRange.max) continue;
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
        // On negative-polarity worlds, negative spikes in the catalog
        // represent beneficial pressure relief (terraforming progress)
        for (const [domain, spike] of Object.entries(event.pressureSpikes)) {
          const d = domain as PressureDomain;
          aggregateSpikes[d] = (aggregateSpikes[d] ?? 0) + spike;
        }

        // Track terraforming progress from beneficial events on negative-polarity worlds
        if (warmingPolarity === -1) {
          // Sum negative pressure spikes as terraforming progress (inverted: relief = progress)
          for (const spike of Object.values(event.pressureSpikes)) {
            if (spike < 0) {
              tickTerraformingDelta += Math.abs(spike);
            }
          }
        }

        // Set cooldown
        this.cooldowns.set(event.id, event.cooldownTicks);
      }
    }

    this.terraformingProgress += tickTerraformingDelta;
    return { impacts, pressureSpikes: aggregateSpikes, terraformingProgress: tickTerraformingDelta };
  }

  /** Get accumulated terraforming progress. */
  getTerraformingProgress(): number {
    return this.terraformingProgress;
  }

  /** Serialize cooldown state + terraforming progress. */
  serialize(): { cooldowns: Array<[string, number]>; terraformingProgress: number } {
    return {
      cooldowns: [...this.cooldowns.entries()],
      terraformingProgress: this.terraformingProgress,
    };
  }

  /** Restore cooldown state + terraforming progress. */
  restore(data: Array<[string, number]> | { cooldowns: Array<[string, number]>; terraformingProgress: number }): void {
    if (Array.isArray(data)) {
      // Backward compat: old saves only had cooldown array
      this.cooldowns = new Map(data);
      this.terraformingProgress = 0;
    } else {
      this.cooldowns = new Map(data.cooldowns);
      this.terraformingProgress = data.terraformingProgress ?? 0;
    }
  }
}

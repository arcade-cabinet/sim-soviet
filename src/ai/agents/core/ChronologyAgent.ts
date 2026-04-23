/**
 * @fileoverview ChronologyAgent — Game clock as a Yuka agent.
 *
 * Absorbs all tick logic from ChronologySystem: advances totalTicks,
 * computes hour/day/month/year boundaries, cycles seasons, updates
 * weather, and returns a TickResult each update call.
 *
 * The constants file (Chronology.ts) is kept as-is; only the mutable
 * clock logic moves here.
 */

import { Vehicle } from 'yuka';
import {
  createGameDate,
  DAYS_PER_MONTH,
  type DayPhase,
  type GameDate,
  getDayPhase,
  getSeasonForMonth,
  HOURS_PER_TICK,
  MONTHS_PER_YEAR,
  type Season,
  type SeasonProfile,
  TICKS_PER_YEAR,
} from '../../../game/Chronology';
import type { GameRng } from '../../../game/SeedSystem';
import { MSG, type NewTickPayload } from '../../telegrams';
import {
  createWeatherState,
  getWeatherProfile,
  rollWeather,
  type WeatherState,
  type WeatherType,
} from './weather-types';

// ─────────────────────────────────────────────────────────
//  TICK RESULT
// ─────────────────────────────────────────────────────────

/** Describes what happened during a single tick advance. */
export interface TickResult {
  /** True if we crossed a day boundary (hour wrapped past 24). */
  newDay: boolean;
  /** True if we crossed a month boundary (day wrapped past DAYS_PER_MONTH). */
  newMonth: boolean;
  /** True if we crossed a year boundary. */
  newYear: boolean;
  /** The current season profile after this tick. */
  season: SeasonProfile;
  /** The current weather type after this tick. */
  weather: WeatherType;
  /** The current day phase (night/dawn/midday/dusk). */
  dayPhase: DayPhase;
  /** Normalized progress through the current day (0..1) for lighting. */
  dayProgress: number;
}

// ─────────────────────────────────────────────────────────
//  SERIALIZATION
// ─────────────────────────────────────────────────────────

/** Serializable snapshot of the chronology agent state. */
export interface ChronologyState {
  date: GameDate;
  season: Season;
  weather: WeatherState;
  tickWithinDay: number;
}

// ─────────────────────────────────────────────────────────
//  CHRONOLOGY AGENT
// ─────────────────────────────────────────────────────────

/**
 * Yuka Vehicle that owns the game clock.
 *
 * Each call to tick() advances totalTicks by 1 and resolves
 * day/month/year boundaries, season transitions, weather rolls,
 * and day/night phase changes, returning a TickResult.
 *
 * @example
 * const clock = new ChronologyAgent(rng, 1922);
 * const result = clock.tick();
 * if (result.newYear) { ... }
 */
export class ChronologyAgent extends Vehicle {
  private date: GameDate;
  private season: SeasonProfile;
  private weather: WeatherState;
  private tickWithinDay: number;
  private _lastTickResult: TickResult = {
    newDay: false,
    newMonth: false,
    newYear: false,
    season: {} as any,
    weather: 'clear' as WeatherType,
    dayPhase: 'midday' as DayPhase,
    dayProgress: 0.5,
  };

  /**
   * @param rng - Seeded RNG for weather rolls
   * @param startYear - Calendar year for the new game (default 1922)
   */
  constructor(
    private rng: GameRng,
    startYear = 1922,
  ) {
    super();
    this.name = 'ChronologyAgent';
    this.date = createGameDate(startYear);
    this.season = getSeasonForMonth(this.date.month);
    this.weather = createWeatherState();
    this.tickWithinDay = 0;

    // Roll initial weather for the starting season
    this.weather = rollWeather(this.season.season, this.rng);
  }

  // ── Public accessors ─────────────────────────────────

  /** Returns the current in-game date (read-only). */
  getDate(): Readonly<GameDate> {
    return this.date;
  }

  /** Returns the current season profile. */
  getSeason(): SeasonProfile {
    return this.season;
  }

  /** Returns a copy of the current weather state. */
  getWeather(): WeatherState {
    return { ...this.weather };
  }

  /** Returns the static profile for the current weather type. */
  getWeatherProfile() {
    return getWeatherProfile(this.weather.current);
  }

  /** Returns the current day phase based on hour and season daylight hours. */
  getDayPhase(): DayPhase {
    return getDayPhase(this.date.hour, this.season.daylightHours);
  }

  /**
   * Normalized day progress (0..1), useful for smooth lighting interpolation.
   * 0 = start of day, 1 = end of day.
   */
  getDayProgress(): number {
    return this.date.hour / 24;
  }

  /**
   * Advance the calendar by a number of years (for rehabilitation time skip).
   * Updates totalTicks accordingly but does not fire per-tick systems.
   *
   * @param years - Number of years to advance the calendar
   */
  advanceYears(years: number): void {
    if (!Number.isFinite(years) || !Number.isInteger(years) || years <= 0) return;
    this.date.year += years;
    this.date.totalTicks += years * TICKS_PER_YEAR;
    this.season = getSeasonForMonth(this.date.month);
    this.weather = rollWeather(this.season.season, this.rng);
  }

  // ── Core tick ────────────────────────────────────────

  /**
   * Yuka's update loop hook.
   * Called automatically by entityManager.update(delta).
   */
  update(delta: number): this {
    const result = this.tick();

    // Dispatch clock boundary telegrams to autonomous agents.
    // SimulationEngine owns the ordered production/consumption/social/political phases.
    if (this.manager) {
      const payload: NewTickPayload = {
        totalTicks: this.date.totalTicks,
        delta,
      };

      const entities = this.manager.entities;
      for (const e of entities) {
        if (this.shouldReceiveClockMessage(e, MSG.NEW_TICK)) {
          this.manager.sendMessage(this, e, MSG.NEW_TICK, 0, payload);
        }

        if (result.newMonth && this.shouldReceiveClockMessage(e, MSG.NEW_MONTH)) {
          this.manager.sendMessage(this, e, MSG.NEW_MONTH, 0, null);
        }
        if (result.newYear && this.shouldReceiveClockMessage(e, MSG.NEW_YEAR)) {
          this.manager.sendMessage(this, e, MSG.NEW_YEAR, 0, null);
        }
      }
    }

    return this;
  }

  private shouldReceiveClockMessage(entity: { name?: string }, message: string): boolean {
    if (entity.name === 'PhaseDirectorAgent') return true;
    if (message !== MSG.NEW_TICK) return false;
    return entity.name === 'CollectiveAgent' || entity.name === 'DvorNeedsAgent';
  }

  /**
   * Advances the clock by one tick and returns a TickResult
   * describing which boundaries were crossed.
   *
   * @returns TickResult with boundary flags, season, weather, and lighting info
   */
  tick(): TickResult {
    let newDay = false;
    let newMonth = false;
    let newYear = false;

    // Advance monotonic counter
    this.date.totalTicks++;

    // Advance hour
    this.date.hour += HOURS_PER_TICK;
    this.tickWithinDay++;

    // ── Day boundary ──
    if (this.date.hour >= 24) {
      this.date.hour = 0;
      this.tickWithinDay = 0;
      this.date.day++;
      newDay = true;

      // Decrement weather duration; roll new weather if expired
      this.weather.daysRemaining--;
      if (this.weather.daysRemaining <= 0) {
        this.weather = rollWeather(this.season.season, this.rng);
      }
    }

    // ── Month boundary ──
    if (this.date.day > DAYS_PER_MONTH) {
      this.date.day = 1;
      this.date.month++;
      newMonth = true;

      // ── Year boundary ──
      if (this.date.month > MONTHS_PER_YEAR) {
        this.date.month = 1;
        this.date.year++;
        newYear = true;
      }

      // Update season for the new month
      this.season = getSeasonForMonth(this.date.month);
    }

    const dayPhase = this.getDayPhase();
    const dayProgress = this.getDayProgress();

    this._lastTickResult = {
      newDay,
      newMonth,
      newYear,
      season: this.season,
      weather: this.weather.current,
      dayPhase,
      dayProgress,
    };

    return this._lastTickResult;
  }

  /** Get the result of the most recent tick computation. */
  getLastTickResult(): TickResult {
    return this._lastTickResult;
  }

  // ── Serialization (for save/load) ────────────────────

  /** Exports the full chronology state for persistence. */
  serialize(): ChronologyState {
    return {
      date: { ...this.date },
      season: this.season.season,
      weather: { ...this.weather },
      tickWithinDay: this.tickWithinDay,
    };
  }

  /** Restores chronology state from a persisted snapshot. */
  static deserialize(state: ChronologyState, rng: GameRng): ChronologyAgent {
    const agent = new ChronologyAgent(rng, state.date.year);
    agent.date = { ...state.date };
    agent.season = getSeasonForMonth(state.date.month);
    agent.weather = { ...state.weather };
    agent.tickWithinDay = state.tickWithinDay;
    return agent;
  }
}

/** Backward-compat alias: ChronologySystem is now ChronologyAgent. */
export { ChronologyAgent as ChronologySystem };

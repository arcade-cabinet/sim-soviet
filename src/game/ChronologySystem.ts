/**
 * @module game/ChronologySystem
 *
 * Advances the game clock each simulation tick and resolves
 * season transitions, weather changes, and day/night phases.
 *
 * The tick() method returns a TickResult describing what boundaries
 * were crossed (new day, new month, new year) so that other systems
 * can react accordingly.
 */

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
} from './Chronology';
import type { GameRng } from './SeedSystem';
import {
  createWeatherState,
  getWeatherProfile,
  rollWeather,
  type WeatherState,
  type WeatherType,
} from './WeatherSystem';

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
//  CHRONOLOGY SYSTEM
// ─────────────────────────────────────────────────────────

export class ChronologySystem {
  private date: GameDate;
  private season: SeasonProfile;
  private weather: WeatherState;
  private tickWithinDay: number;

  constructor(
    private rng: GameRng,
    startYear = 1980
  ) {
    this.date = createGameDate(startYear);
    this.season = getSeasonForMonth(this.date.month);
    this.weather = createWeatherState();
    this.tickWithinDay = 0;

    // Roll initial weather for the starting season
    this.weather = rollWeather(this.season.season, this.rng);
  }

  // ── Public accessors ───────────────────────────────────

  getDate(): Readonly<GameDate> {
    return this.date;
  }

  getSeason(): SeasonProfile {
    return this.season;
  }

  getWeather(): WeatherState {
    return { ...this.weather };
  }

  getWeatherProfile() {
    return getWeatherProfile(this.weather.current);
  }

  getDayPhase(): DayPhase {
    return getDayPhase(this.date.hour, this.season.daylightHours);
  }

  /**
   * Normalized day progress (0..1), useful for smooth lighting interpolation.
   * 0 = start of day, 1 = end of day.
   */
  getDayProgress(): number {
    return (this.tickWithinDay * HOURS_PER_TICK + (this.date.hour % HOURS_PER_TICK)) / 24;
  }

  // ── Core tick ──────────────────────────────────────────

  /**
   * Advances the clock by one tick and returns a TickResult
   * describing which boundaries were crossed.
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
    const dayProgress = this.date.hour / 24;

    return {
      newDay,
      newMonth,
      newYear,
      season: this.season,
      weather: this.weather.current,
      dayPhase,
      dayProgress,
    };
  }

  // ── Serialization (for save/load) ─────────────────────

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
  static deserialize(state: ChronologyState, rng: GameRng): ChronologySystem {
    const system = new ChronologySystem(rng, state.date.year);
    system.date = { ...state.date };
    system.season = getSeasonForMonth(state.date.month);
    system.weather = { ...state.weather };
    system.tickWithinDay = state.tickWithinDay;
    return system;
  }
}

/** Serializable snapshot of the chronology system. */
export interface ChronologyState {
  date: GameDate;
  season: Season;
  weather: WeatherState;
  tickWithinDay: number;
}

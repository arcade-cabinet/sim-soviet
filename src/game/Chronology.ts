/**
 * @module game/Chronology
 *
 * Time model, season definitions, and day/night phase constants
 * for SimSoviet 2000.
 *
 * Pacing target: 1 game year ≈ 6 real minutes (360 wall-clock seconds).
 *
 * | Unit  | Size                      | Wall-clock |
 * |-------|---------------------------|-----------|
 * | Tick  | 1 second real-time        | 1s        |
 * | Day   | 3 ticks (8 hours each)    | 3s        |
 * | Month | 10 days (Soviet dekada)   | 30s       |
 * | Year  | 12 months                 | 360s      |
 */

// ─────────────────────────────────────────────────────────
//  TIME CONSTANTS
// ─────────────────────────────────────────────────────────

/** Hours that advance per tick (3 ticks = 24 hours = 1 day). */
export const HOURS_PER_TICK = 8;

/** Ticks in a single game day. */
export const TICKS_PER_DAY = 3;

/** Days per month (Soviet dekada calendar). */
export const DAYS_PER_MONTH = 10;

/** Months per year. */
export const MONTHS_PER_YEAR = 12;

/** Ticks in a single month. */
export const TICKS_PER_MONTH = TICKS_PER_DAY * DAYS_PER_MONTH; // 30

/** Ticks in a full year. */
export const TICKS_PER_YEAR = TICKS_PER_MONTH * MONTHS_PER_YEAR; // 360

// ─────────────────────────────────────────────────────────
//  GAME DATE
// ─────────────────────────────────────────────────────────

export interface GameDate {
  /** Calendar year (starts 1980). */
  year: number;
  /** Calendar month, 1-12. */
  month: number;
  /** Day within the month, 1-10 (Soviet dekada). */
  day: number;
  /** Hour of day, 0-23 (advances by HOURS_PER_TICK each tick). */
  hour: number;
  /** Monotonically increasing tick counter since game start. */
  totalTicks: number;
}

/** Creates a fresh GameDate for a new game starting year. */
export function createGameDate(startYear = 1980): GameDate {
  return {
    year: startYear,
    month: 1,
    day: 1,
    hour: 0,
    totalTicks: 0,
  };
}

// ─────────────────────────────────────────────────────────
//  SEASONS
// ─────────────────────────────────────────────────────────

export enum Season {
  WINTER = 'winter',
  RASPUTITSA_SPRING = 'rasputitsa_spring',
  SHORT_SUMMER = 'short_summer',
  GOLDEN_WEEK = 'golden_week',
  STIFLING_HEAT = 'stifling_heat',
  EARLY_FROST = 'early_frost',
  RASPUTITSA_AUTUMN = 'rasputitsa_autumn',
}

export interface SeasonProfile {
  readonly season: Season;
  readonly label: string;
  /** Months (1-12) that belong to this season. */
  readonly months: readonly number[];
  /** Farm production multiplier (0.0 = no farming). */
  readonly farmMultiplier: number;
  /** Construction cost multiplier (higher = slower/costlier). */
  readonly buildCostMultiplier: number;
  /** Heating fuel consumed per powered building per tick. */
  readonly heatCostPerTick: number;
  /** Base snow particle emission rate (0 = no snow). */
  readonly snowRate: number;
  /** Daylight hours (out of 24). Affects day/night lighting. */
  readonly daylightHours: number;
  /** Short flavor text for UI. */
  readonly description: string;
}

/**
 * The 7 Russian seasons, mapped month-by-month.
 *
 * Nov-Mar: WINTER (5 months — the dominant season)
 * Apr: RASPUTITSA_SPRING (mud)
 * May: SHORT_SUMMER
 * Jun: GOLDEN_WEEK (peak farming)
 * Jul-Aug: STIFLING_HEAT
 * Sep: EARLY_FROST
 * Oct: RASPUTITSA_AUTUMN (mud again)
 */
export const SEASON_TABLE: readonly SeasonProfile[] = [
  {
    season: Season.WINTER,
    label: 'Winter',
    months: [11, 12, 1, 2, 3],
    farmMultiplier: 0.0,
    buildCostMultiplier: 1.5,
    heatCostPerTick: 3,
    snowRate: 100,
    daylightHours: 6,
    description: 'Frozen hell. Nothing grows. Everything costs more.',
  },
  {
    season: Season.RASPUTITSA_SPRING,
    label: 'Rasputitsa (Spring)',
    months: [4],
    farmMultiplier: 0.1,
    buildCostMultiplier: 1.8,
    heatCostPerTick: 1,
    snowRate: 0,
    daylightHours: 13,
    description: 'The mud season. Roads are impassable. Construction crawls.',
  },
  {
    season: Season.SHORT_SUMMER,
    label: 'Short Summer',
    months: [5],
    farmMultiplier: 2.5,
    buildCostMultiplier: 0.8,
    heatCostPerTick: 0,
    snowRate: 0,
    daylightHours: 18,
    description: 'Brief warmth. Farms produce eagerly.',
  },
  {
    season: Season.GOLDEN_WEEK,
    label: 'Golden Week',
    months: [6],
    farmMultiplier: 3.0,
    buildCostMultiplier: 0.7,
    heatCostPerTick: 0,
    snowRate: 0,
    daylightHours: 20,
    description: 'Peak of the year. White nights. Maximum harvest.',
  },
  {
    season: Season.STIFLING_HEAT,
    label: 'Stifling Heat',
    months: [7, 8],
    farmMultiplier: 1.2,
    buildCostMultiplier: 1.0,
    heatCostPerTick: 0,
    snowRate: 0,
    daylightHours: 17,
    description: 'Hot and dusty. Crops wilt slightly.',
  },
  {
    season: Season.EARLY_FROST,
    label: 'Early Frost',
    months: [9],
    farmMultiplier: 0.3,
    buildCostMultiplier: 1.2,
    heatCostPerTick: 1,
    snowRate: 20,
    daylightHours: 12,
    description: 'First frost. Harvest what you can before winter.',
  },
  {
    season: Season.RASPUTITSA_AUTUMN,
    label: 'Rasputitsa (Autumn)',
    months: [10],
    farmMultiplier: 0.0,
    buildCostMultiplier: 1.8,
    heatCostPerTick: 2,
    snowRate: 5,
    daylightHours: 10,
    description: 'Mud returns. Construction halts. Winter approaches.',
  },
] as const;

/** Fast lookup: month (1-12) → SeasonProfile. */
const _monthToSeason: SeasonProfile[] = [];
for (const profile of SEASON_TABLE) {
  for (const m of profile.months) {
    _monthToSeason[m] = profile;
  }
}

/** Returns the season profile for a given month (1-12). */
export function getSeasonForMonth(month: number): SeasonProfile {
  return _monthToSeason[month] ?? SEASON_TABLE[0]!;
}

// ─────────────────────────────────────────────────────────
//  DAY/NIGHT PHASES
// ─────────────────────────────────────────────────────────

export enum DayPhase {
  NIGHT = 'night',
  DAWN = 'dawn',
  MIDDAY = 'midday',
  DUSK = 'dusk',
}

/**
 * Returns the current day phase given an hour (0-23) and
 * the season's daylight hours. The transitions shift with
 * season — in winter, dawn is later and dusk is earlier.
 */
export function getDayPhase(hour: number, daylightHours: number): DayPhase {
  // Calculate sunrise/sunset from daylight hours, centered on noon.
  const sunrise = 12 - daylightHours / 2;
  const sunset = 12 + daylightHours / 2;

  if (hour < sunrise - 1) return DayPhase.NIGHT;
  if (hour < sunrise + 1) return DayPhase.DAWN;
  if (hour < sunset - 1) return DayPhase.MIDDAY;
  if (hour < sunset + 1) return DayPhase.DUSK;
  return DayPhase.NIGHT;
}

// ─────────────────────────────────────────────────────────
//  DATE FORMATTING
// ─────────────────────────────────────────────────────────

const MONTH_NAMES = [
  '',
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
] as const;

/** Formats a GameDate for display, e.g. "3 MAR 1980". */
export function formatGameDate(date: GameDate): string {
  const monthName = MONTH_NAMES[date.month] ?? '???';
  return `${date.day} ${monthName} ${date.year}`;
}

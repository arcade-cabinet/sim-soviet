import {
  DAYS_PER_MONTH,
  DayPhase,
  HOURS_PER_TICK,
  Season,
  TICKS_PER_DAY,
  TICKS_PER_MONTH,
  TICKS_PER_YEAR,
} from '@/game/Chronology';
import { ChronologySystem, type TickResult } from '@/game/ChronologySystem';
import { GameRng } from '@/game/SeedSystem';

describe('ChronologySystem', () => {
  let rng: GameRng;
  let chrono: ChronologySystem;

  beforeEach(() => {
    rng = new GameRng('test-deterministic-seed');
    chrono = new ChronologySystem(rng, 1922);
  });

  // ── Initial state ──────────────────────────────────────────

  describe('initial state', () => {
    it('starts at year 1922, month 10, day 1, hour 0', () => {
      const date = chrono.getDate();
      expect(date.year).toBe(1922);
      expect(date.month).toBe(10);
      expect(date.day).toBe(1);
      expect(date.hour).toBe(0);
    });

    it('starts with totalTicks at 0', () => {
      expect(chrono.getDate().totalTicks).toBe(0);
    });

    it('starts in rasputitsa autumn season (month 10)', () => {
      const season = chrono.getSeason();
      expect(season.season).toBe(Season.RASPUTITSA_AUTUMN);
    });

    it('can start at a custom year', () => {
      const chrono2 = new ChronologySystem(rng, 2000);
      expect(chrono2.getDate().year).toBe(2000);
    });

    it('has initial weather state', () => {
      const weather = chrono.getWeather();
      expect(weather).toBeDefined();
      expect(weather.current).toBeDefined();
      expect(weather.daysRemaining).toBeGreaterThan(0);
    });

    it('returns a weather profile', () => {
      const profile = chrono.getWeatherProfile();
      expect(profile).toBeDefined();
      expect(profile.label).toBeDefined();
      expect(typeof profile.farmModifier).toBe('number');
    });

    it('has a day phase at start', () => {
      const phase = chrono.getDayPhase();
      // Hour 0 with rasputitsa autumn daylight (10 hours): sunrise = 12 - 5 = 7, so hour 0 = night
      expect(phase).toBe(DayPhase.NIGHT);
    });

    it('has day progress at 0 initially', () => {
      // tickWithinDay=0 and hour=0
      expect(chrono.getDayProgress()).toBe(0);
    });
  });

  // ── Single tick advancement ────────────────────────────────

  describe('single tick', () => {
    it('advances hour by HOURS_PER_TICK (8)', () => {
      chrono.tick();
      expect(chrono.getDate().hour).toBe(HOURS_PER_TICK);
    });

    it('increments totalTicks by 1', () => {
      chrono.tick();
      expect(chrono.getDate().totalTicks).toBe(1);
    });

    it('returns TickResult with no boundary crossings for first tick', () => {
      const result = chrono.tick();
      expect(result.newDay).toBe(false);
      expect(result.newMonth).toBe(false);
      expect(result.newYear).toBe(false);
    });

    it('returns correct season in TickResult', () => {
      const result = chrono.tick();
      expect(result.season.season).toBe(Season.RASPUTITSA_AUTUMN);
    });

    it('returns a weather type in TickResult', () => {
      const result = chrono.tick();
      expect(result.weather).toBeDefined();
      expect(typeof result.weather).toBe('string');
    });

    it('returns dayPhase in TickResult', () => {
      const result = chrono.tick();
      expect(Object.values(DayPhase)).toContain(result.dayPhase);
    });

    it('returns dayProgress in TickResult', () => {
      const result = chrono.tick();
      expect(result.dayProgress).toBeGreaterThanOrEqual(0);
      expect(result.dayProgress).toBeLessThanOrEqual(1);
    });
  });

  // ── Tick accumulation and day boundary ─────────────────────

  describe('tick accumulation and day boundary', () => {
    it('crosses day boundary after TICKS_PER_DAY (3) ticks', () => {
      let result: TickResult;
      for (let i = 0; i < TICKS_PER_DAY; i++) {
        result = chrono.tick();
      }
      // After 3 ticks: hour = 3*8 = 24 → wraps to 0, day increments
      expect(result!.newDay).toBe(true);
      expect(chrono.getDate().hour).toBe(0);
      expect(chrono.getDate().day).toBe(2);
    });

    it('does not flag newDay for ticks within a day', () => {
      const r1 = chrono.tick(); // hour = 8
      expect(r1.newDay).toBe(false);

      const r2 = chrono.tick(); // hour = 16
      expect(r2.newDay).toBe(false);
    });

    it('hour resets to 0 on day boundary', () => {
      for (let i = 0; i < TICKS_PER_DAY; i++) {
        chrono.tick();
      }
      expect(chrono.getDate().hour).toBe(0);
    });

    it('multiple days accumulate correctly', () => {
      // 2 full days = 6 ticks
      for (let i = 0; i < TICKS_PER_DAY * 2; i++) {
        chrono.tick();
      }
      expect(chrono.getDate().day).toBe(3); // Started at day 1, advanced 2 days
      expect(chrono.getDate().hour).toBe(0);
    });

    it('totalTicks tracks accurately across days', () => {
      for (let i = 0; i < 10; i++) {
        chrono.tick();
      }
      expect(chrono.getDate().totalTicks).toBe(10);
    });
  });

  // ── Month boundary ─────────────────────────────────────────

  describe('month boundary', () => {
    it('crosses month boundary after TICKS_PER_MONTH (30) ticks', () => {
      let result: TickResult;
      for (let i = 0; i < TICKS_PER_MONTH; i++) {
        result = chrono.tick();
      }
      expect(result!.newMonth).toBe(true);
      expect(chrono.getDate().month).toBe(11); // Oct → Nov
      expect(chrono.getDate().day).toBe(1);
    });

    it('day resets to 1 on month boundary', () => {
      for (let i = 0; i < TICKS_PER_MONTH; i++) {
        chrono.tick();
      }
      expect(chrono.getDate().day).toBe(1);
    });

    it('newMonth is false within a month', () => {
      // Tick 29 times (just before month boundary)
      let result: TickResult;
      for (let i = 0; i < TICKS_PER_MONTH - 1; i++) {
        result = chrono.tick();
      }
      expect(result!.newMonth).toBe(false);
    });

    it('advancing 2 months works correctly', () => {
      for (let i = 0; i < TICKS_PER_MONTH * 2; i++) {
        chrono.tick();
      }
      expect(chrono.getDate().month).toBe(12); // Oct → Dec
    });

    it('updates season when month changes', () => {
      // Starting at month 10 (RASPUTITSA_AUTUMN), advance 1 month → month 11 = WINTER
      for (let i = 0; i < TICKS_PER_MONTH; i++) {
        chrono.tick();
      }
      expect(chrono.getDate().month).toBe(11);
      expect(chrono.getSeason().season).toBe(Season.WINTER);
    });
  });

  // ── Year boundary (month 12 → month 1 + year increment) ───

  describe('year boundary', () => {
    // Starting at month 10 (October 1922), year boundary is 3 months (90 ticks) away
    const TICKS_TO_FIRST_YEAR = TICKS_PER_MONTH * 3; // Oct → Jan

    it('crosses year boundary after 3 months (Oct → Jan)', () => {
      let result: TickResult;
      for (let i = 0; i < TICKS_TO_FIRST_YEAR; i++) {
        result = chrono.tick();
      }
      expect(result!.newYear).toBe(true);
      expect(result!.newMonth).toBe(true);
      expect(chrono.getDate().year).toBe(1923);
      expect(chrono.getDate().month).toBe(1);
      expect(chrono.getDate().day).toBe(1);
    });

    it('wraps month from 12 to 1 on year boundary', () => {
      // Advance 2 months to get to month 12 (Oct → Dec)
      for (let i = 0; i < TICKS_PER_MONTH * 2; i++) {
        chrono.tick();
      }
      expect(chrono.getDate().month).toBe(12);

      // Advance one more month to wrap
      for (let i = 0; i < TICKS_PER_MONTH; i++) {
        chrono.tick();
      }
      expect(chrono.getDate().month).toBe(1);
      expect(chrono.getDate().year).toBe(1923);
    });

    it('newYear is false when not crossing year boundary', () => {
      // After 1 month, newYear should be false
      let result: TickResult;
      for (let i = 0; i < TICKS_PER_MONTH; i++) {
        result = chrono.tick();
      }
      expect(result!.newYear).toBe(false);
    });

    it('totalTicks matches after first year boundary', () => {
      for (let i = 0; i < TICKS_TO_FIRST_YEAR; i++) {
        chrono.tick();
      }
      expect(chrono.getDate().totalTicks).toBe(TICKS_TO_FIRST_YEAR);
    });

    it('handles multiple year rollovers', () => {
      // First partial year (3 months) + 2 full years (24 months) = 810 ticks
      const totalTicks = TICKS_TO_FIRST_YEAR + TICKS_PER_YEAR * 2;
      for (let i = 0; i < totalTicks; i++) {
        chrono.tick();
      }
      expect(chrono.getDate().year).toBe(1925);
      expect(chrono.getDate().month).toBe(1);
      expect(chrono.getDate().totalTicks).toBe(totalTicks);
    });
  });

  // ── Season transitions ─────────────────────────────────────

  describe('season transitions through all seasons', () => {
    // Starting at month 10 (RASPUTITSA_AUTUMN)
    // Months from start offset: +1=Nov, +2=Dec, +3=Jan(1923), etc.

    it('month 10 = RASPUTITSA_AUTUMN (start)', () => {
      expect(chrono.getSeason().season).toBe(Season.RASPUTITSA_AUTUMN);
    });

    it('month 11-12 = WINTER', () => {
      for (let i = 0; i < TICKS_PER_MONTH; i++) chrono.tick();
      expect(chrono.getDate().month).toBe(11);
      expect(chrono.getSeason().season).toBe(Season.WINTER);

      for (let i = 0; i < TICKS_PER_MONTH; i++) chrono.tick();
      expect(chrono.getDate().month).toBe(12);
      expect(chrono.getSeason().season).toBe(Season.WINTER);
    });

    it('month 1-3 (next year) = WINTER', () => {
      // Advance 3 months (Oct→Jan)
      for (let i = 0; i < TICKS_PER_MONTH * 3; i++) chrono.tick();
      expect(chrono.getDate().month).toBe(1);
      expect(chrono.getSeason().season).toBe(Season.WINTER);
    });

    it('month 4 = RASPUTITSA_SPRING', () => {
      // 6 months from Oct → Apr
      for (let i = 0; i < TICKS_PER_MONTH * 6; i++) chrono.tick();
      expect(chrono.getDate().month).toBe(4);
      expect(chrono.getSeason().season).toBe(Season.RASPUTITSA_SPRING);
    });

    it('month 5 = SHORT_SUMMER', () => {
      for (let i = 0; i < TICKS_PER_MONTH * 7; i++) chrono.tick();
      expect(chrono.getDate().month).toBe(5);
      expect(chrono.getSeason().season).toBe(Season.SHORT_SUMMER);
    });

    it('month 6 = GOLDEN_WEEK', () => {
      for (let i = 0; i < TICKS_PER_MONTH * 8; i++) chrono.tick();
      expect(chrono.getDate().month).toBe(6);
      expect(chrono.getSeason().season).toBe(Season.GOLDEN_WEEK);
    });

    it('month 7-8 = STIFLING_HEAT', () => {
      for (let i = 0; i < TICKS_PER_MONTH * 9; i++) chrono.tick();
      expect(chrono.getDate().month).toBe(7);
      expect(chrono.getSeason().season).toBe(Season.STIFLING_HEAT);

      for (let i = 0; i < TICKS_PER_MONTH; i++) chrono.tick();
      expect(chrono.getDate().month).toBe(8);
      expect(chrono.getSeason().season).toBe(Season.STIFLING_HEAT);
    });

    it('month 9 = EARLY_FROST', () => {
      for (let i = 0; i < TICKS_PER_MONTH * 11; i++) chrono.tick();
      expect(chrono.getDate().month).toBe(9);
      expect(chrono.getSeason().season).toBe(Season.EARLY_FROST);
    });

    it('month 10 = RASPUTITSA_AUTUMN (full cycle)', () => {
      for (let i = 0; i < TICKS_PER_MONTH * 12; i++) chrono.tick();
      expect(chrono.getDate().month).toBe(10);
      expect(chrono.getSeason().season).toBe(Season.RASPUTITSA_AUTUMN);
    });
  });

  // ── Day phase transitions ──────────────────────────────────

  describe('day phase transitions', () => {
    it('hour 0 in rasputitsa autumn = NIGHT', () => {
      // Starting state: hour 0, rasputitsa autumn (daylightHours=10)
      // sunrise = 12 - 5 = 7, hour 0 < 7-1=6 → NIGHT
      expect(chrono.getDayPhase()).toBe(DayPhase.NIGHT);
    });

    it('hour 8 in rasputitsa autumn = MIDDAY', () => {
      // RASPUTITSA_AUTUMN: daylightHours=10, sunrise = 12 - 5 = 7
      // Dawn = 6 to 8, hour 8 >= sunrise+1 → MIDDAY
      chrono.tick(); // hour = 8
      expect(chrono.getDayPhase()).toBe(DayPhase.MIDDAY);
    });

    it('hour 16 in rasputitsa autumn = DUSK', () => {
      // sunset = 12 + 5 = 17
      // Dusk = sunset-1 to sunset+1 = 16 to 18
      chrono.tick(); // hour = 8
      chrono.tick(); // hour = 16
      expect(chrono.getDayPhase()).toBe(DayPhase.DUSK);
    });

    it('day phase varies with season daylight hours', () => {
      // Advance to month 6 (GOLDEN_WEEK, daylightHours=20) — 8 months from Oct
      for (let i = 0; i < TICKS_PER_MONTH * 8; i++) chrono.tick();
      expect(chrono.getSeason().daylightHours).toBe(20);

      const phase = chrono.getDayPhase();
      expect(Object.values(DayPhase)).toContain(phase);
    });

    it('summer hour 8 is MIDDAY (more daylight)', () => {
      // Advance to month 6 (GOLDEN_WEEK, daylightHours=20) — 8 months from Oct
      for (let i = 0; i < TICKS_PER_MONTH * 8; i++) chrono.tick();

      // We're at day boundary (hour 0), tick to get hour 8
      chrono.tick();
      // sunrise = 12 - 10 = 2, sunset = 12 + 10 = 22
      // Dawn = 1 to 3, Midday = 3 to 21
      // hour 8 is in Midday range
      expect(chrono.getDayPhase()).toBe(DayPhase.MIDDAY);
    });
  });

  // ── Multi-tick advancement ─────────────────────────────────

  describe('multi-tick advancement', () => {
    it('10 ticks advance correctly (3 days + 1 tick)', () => {
      for (let i = 0; i < 10; i++) chrono.tick();
      // 10 ticks: 10*8 = 80 hours = 3 full days + 8 hours
      // day 1 → day 4 (3 day boundaries crossed), hour = 8
      expect(chrono.getDate().day).toBe(4);
      expect(chrono.getDate().hour).toBe(8);
      expect(chrono.getDate().totalTicks).toBe(10);
    });

    it('counts newDay correctly over many ticks', () => {
      let dayCount = 0;
      for (let i = 0; i < TICKS_PER_MONTH; i++) {
        const result = chrono.tick();
        if (result.newDay) dayCount++;
      }
      // 30 ticks / 3 ticks per day = 10 days
      expect(dayCount).toBe(DAYS_PER_MONTH);
    });

    it('counts newMonth correctly over first partial year', () => {
      // Starting at month 10, first year boundary is 3 months away
      const ticksToYearEnd = TICKS_PER_MONTH * 3;
      let monthCount = 0;
      for (let i = 0; i < ticksToYearEnd; i++) {
        const result = chrono.tick();
        if (result.newMonth) monthCount++;
      }
      expect(monthCount).toBe(3); // Oct→Nov, Nov→Dec, Dec→Jan
    });

    it('counts exactly 1 newYear in first 3 months (Oct → Jan)', () => {
      const ticksToYearEnd = TICKS_PER_MONTH * 3;
      let yearCount = 0;
      for (let i = 0; i < ticksToYearEnd; i++) {
        const result = chrono.tick();
        if (result.newYear) yearCount++;
      }
      expect(yearCount).toBe(1);
    });

    it('5 full years of ticks produce consistent results', () => {
      // Skip to first year boundary, then run 5 full years
      const ticksToFirstYear = TICKS_PER_MONTH * 3; // Oct→Jan
      const ticksFor5Years = TICKS_PER_YEAR * 5;
      let yearCount = 0;
      let monthCount = 0;
      let dayCount = 0;
      const totalTicks = ticksToFirstYear + ticksFor5Years;

      for (let i = 0; i < totalTicks; i++) {
        const result = chrono.tick();
        if (result.newYear) yearCount++;
        if (result.newMonth) monthCount++;
        if (result.newDay) dayCount++;
      }

      expect(yearCount).toBe(6); // partial first year + 5 full years
      expect(monthCount).toBe(63); // 3 + 60
      expect(dayCount).toBe(630); // 30 + 600
      expect(chrono.getDate().year).toBe(1928);
      expect(chrono.getDate().totalTicks).toBe(totalTicks);
    });
  });

  // ── Weather changes ────────────────────────────────────────

  describe('weather changes', () => {
    it('weather daysRemaining decrements on day boundary', () => {
      const initialWeather = chrono.getWeather();
      const initialDays = initialWeather.daysRemaining;

      // Advance one full day (3 ticks)
      for (let i = 0; i < TICKS_PER_DAY; i++) chrono.tick();

      const afterWeather = chrono.getWeather();
      // Either decremented by 1, or rolled new weather if it was at 1
      if (initialDays > 1) {
        expect(afterWeather.daysRemaining).toBe(initialDays - 1);
      } else {
        // New weather was rolled
        expect(afterWeather.daysRemaining).toBeGreaterThan(0);
      }
    });

    it('new weather is rolled when daysRemaining hits 0', () => {
      // Keep ticking until we see weather change
      let weatherChanges = 0;
      let lastWeather = chrono.getWeather().current;

      for (let i = 0; i < TICKS_PER_MONTH * 3; i++) {
        chrono.tick();
        const current = chrono.getWeather().current;
        if (current !== lastWeather) {
          weatherChanges++;
          lastWeather = current;
        }
      }

      // Over 3 months (30 days), weather should change at least once
      // (max duration is 5 days, so minimum 6 weather periods)
      expect(weatherChanges).toBeGreaterThan(0);
    });

    it('getWeather returns a copy (not internal reference)', () => {
      const w1 = chrono.getWeather();
      const w2 = chrono.getWeather();
      expect(w1).toEqual(w2);
      // Modifying returned copy should not affect internal state
      w1.daysRemaining = 999;
      expect(chrono.getWeather().daysRemaining).not.toBe(999);
    });
  });

  // ── Serialization / deserialization ────────────────────────

  describe('serialization', () => {
    it('serialize captures current state', () => {
      // Advance some ticks
      for (let i = 0; i < 15; i++) chrono.tick();

      const state = chrono.serialize();
      expect(state.date.totalTicks).toBe(15);
      expect(state.date.year).toBe(1922);
      expect(state.season).toBeDefined();
      expect(state.weather).toBeDefined();
      expect(typeof state.tickWithinDay).toBe('number');
    });

    it('deserialize restores state correctly', () => {
      // Advance and serialize
      for (let i = 0; i < 50; i++) chrono.tick();
      const state = chrono.serialize();

      // Deserialize into a new instance
      const rng2 = new GameRng('test-deterministic-seed');
      const restored = ChronologySystem.deserialize(state, rng2);

      expect(restored.getDate().totalTicks).toBe(50);
      expect(restored.getDate().year).toBe(state.date.year);
      expect(restored.getDate().month).toBe(state.date.month);
      expect(restored.getDate().day).toBe(state.date.day);
      expect(restored.getDate().hour).toBe(state.date.hour);
      expect(restored.getSeason().season).toBe(chrono.getSeason().season);
    });

    it('serialized date is a copy', () => {
      const state = chrono.serialize();
      state.date.year = 9999;
      expect(chrono.getDate().year).toBe(1922);
    });

    it('serialized weather is a copy', () => {
      const state = chrono.serialize();
      state.weather.daysRemaining = 9999;
      expect(chrono.getWeather().daysRemaining).not.toBe(9999);
    });
  });

  // ── Day progress ───────────────────────────────────────────

  describe('day progress', () => {
    it('dayProgress increases with ticks', () => {
      const result1 = chrono.tick();
      expect(result1.dayProgress).toBeGreaterThan(0);
    });

    it('dayProgress resets near 0 on day boundary', () => {
      // Advance one full day
      let result: TickResult;
      for (let i = 0; i < TICKS_PER_DAY; i++) {
        result = chrono.tick();
      }
      // After day boundary, hour=0, dayProgress = 0/24 = 0
      expect(result!.dayProgress).toBe(0);
    });

    it('dayProgress is hour/24', () => {
      chrono.tick(); // hour = 8
      const result = chrono.tick(); // hour = 16
      expect(result.dayProgress).toBeCloseTo(16 / 24, 5);
    });
  });
});

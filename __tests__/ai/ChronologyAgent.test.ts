import type { ChronologyState } from '../../src/ai/agents/core/ChronologyAgent';
import { ChronologyAgent } from '../../src/ai/agents/core/ChronologyAgent';
import { DayPhase, Season, TICKS_PER_DAY, TICKS_PER_MONTH, TICKS_PER_YEAR } from '../../src/game/Chronology';
import { GameRng } from '../../src/game/SeedSystem';

/** Helper: run the agent for N ticks and return the last TickResult. */
function _runTicks(agent: ChronologyAgent, n: number) {
  let result = agent.tick();
  for (let i = 1; i < n; i++) {
    result = agent.tick();
  }
  return result;
}

describe('ChronologyAgent', () => {
  let rng: GameRng;

  beforeEach(() => {
    rng = new GameRng('test-seed');
  });

  // ── Instantiation ────────────────────────────────────

  it('can be instantiated with name ChronologyAgent', () => {
    const agent = new ChronologyAgent(rng);
    expect(agent.name).toBe('ChronologyAgent');
  });

  it('starts at tick 0, day 1, month 10 (founding October)', () => {
    const agent = new ChronologyAgent(rng, 1922);
    const date = agent.getDate();
    expect(date.totalTicks).toBe(0);
    expect(date.day).toBe(1);
    expect(date.month).toBe(10);
    expect(date.year).toBe(1922);
  });

  // ── Tick advances totalTicks ──────────────────────────

  it('advances totalTicks by 1 each tick', () => {
    const agent = new ChronologyAgent(rng, 1922);
    agent.tick();
    expect(agent.getDate().totalTicks).toBe(1);
    agent.tick();
    expect(agent.getDate().totalTicks).toBe(2);
    agent.tick();
    expect(agent.getDate().totalTicks).toBe(3);
  });

  // ── Day boundary at every 3rd tick ───────────────────

  it('does not flag newDay on ticks 1 and 2', () => {
    const agent = new ChronologyAgent(rng, 1922);
    expect(agent.tick().newDay).toBe(false);
    expect(agent.tick().newDay).toBe(false);
  });

  it('flags newDay on tick 3 (TICKS_PER_DAY)', () => {
    const agent = new ChronologyAgent(rng, 1922);
    // Ticks 1 and 2 should not cross day boundary
    agent.tick();
    agent.tick();
    // Tick 3 crosses the boundary
    const result = agent.tick();
    expect(result.newDay).toBe(true);
  });

  it('correctly cycles day boundary every 3 ticks', () => {
    const agent = new ChronologyAgent(rng, 1922);
    const dayBoundaries: number[] = [];
    for (let i = 1; i <= 9; i++) {
      const result = agent.tick();
      if (result.newDay) dayBoundaries.push(i);
    }
    expect(dayBoundaries).toEqual([3, 6, 9]);
  });

  // ── Month boundary at every 30th tick ────────────────

  it('flags newMonth exactly at tick TICKS_PER_MONTH (30)', () => {
    const agent = new ChronologyAgent(rng, 1922);
    let newMonthTick = -1;
    for (let i = 1; i <= TICKS_PER_MONTH; i++) {
      const result = agent.tick();
      if (result.newMonth) {
        newMonthTick = i;
        break;
      }
    }
    expect(newMonthTick).toBe(TICKS_PER_MONTH);
  });

  it('does not flag newMonth before tick 30', () => {
    const agent = new ChronologyAgent(rng, 1922);
    for (let i = 1; i < TICKS_PER_MONTH; i++) {
      expect(agent.tick().newMonth).toBe(false);
    }
  });

  // ── Year boundary at every 360th tick ────────────────

  it('flags newYear once after a full year of ticks from January', () => {
    // Start in January (month 1) so the year boundary lands exactly at tick 360.
    const agent = new ChronologyAgent(rng, 1922);
    // Manually set date to January 1 to get a clean year start.
    // Tick 360 from the start of January (month 1) crosses to year+1.
    // We can't set internal date, so instead start a new game and advance
    // to the first newYear event, then verify the next newYear is exactly
    // TICKS_PER_YEAR ticks later.
    let firstNewYearTick = -1;
    for (let i = 1; i <= TICKS_PER_YEAR; i++) {
      if (agent.tick().newYear) {
        firstNewYearTick = i;
        break;
      }
    }
    expect(firstNewYearTick).toBeGreaterThan(0);

    // From the first new year, the next one should be exactly TICKS_PER_YEAR later.
    let secondNewYearTick = -1;
    for (let i = 1; i <= TICKS_PER_YEAR; i++) {
      if (agent.tick().newYear) {
        secondNewYearTick = i;
        break;
      }
    }
    expect(secondNewYearTick).toBe(TICKS_PER_YEAR);
  });

  it('increments year by 1 after 360 ticks', () => {
    const agent = new ChronologyAgent(rng, 1922);
    for (let i = 0; i < TICKS_PER_YEAR; i++) agent.tick();
    expect(agent.getDate().year).toBe(1923);
  });

  // ── Season transitions at correct months ─────────────

  it('starts in RASPUTITSA_AUTUMN for October (month 10)', () => {
    const agent = new ChronologyAgent(rng, 1922);
    expect(agent.getSeason().season).toBe(Season.RASPUTITSA_AUTUMN);
  });

  it('transitions to WINTER after November arrives (month 11)', () => {
    // Start in October (month 10). Advance 1 month (30 ticks) to reach month 11 = WINTER.
    const agent = new ChronologyAgent(rng, 1922);
    for (let i = 0; i < TICKS_PER_MONTH; i++) agent.tick();
    expect(agent.getDate().month).toBe(11);
    expect(agent.getSeason().season).toBe(Season.WINTER);
  });

  it('season profile matches expected months across a full year', () => {
    const agent = new ChronologyAgent(rng, 1922);

    // Tick 1 full year — collect the season for each new month
    const monthSeasons: Record<number, Season> = {};
    monthSeasons[agent.getDate().month] = agent.getSeason().season;

    for (let i = 0; i < TICKS_PER_YEAR; i++) {
      const result = agent.tick();
      if (result.newMonth) {
        monthSeasons[agent.getDate().month] = result.season.season;
      }
    }

    // Spot-check canonical season mappings
    expect(monthSeasons[1]).toBe(Season.WINTER); // January
    expect(monthSeasons[4]).toBe(Season.RASPUTITSA_SPRING);
    expect(monthSeasons[5]).toBe(Season.SHORT_SUMMER);
    expect(monthSeasons[6]).toBe(Season.GOLDEN_WEEK);
    expect(monthSeasons[9]).toBe(Season.EARLY_FROST);
    expect(monthSeasons[10]).toBe(Season.RASPUTITSA_AUTUMN);
  });

  // ── Day phase cycles (dawn/day/dusk/night) ───────────

  it('returns a valid DayPhase on every tick', () => {
    const agent = new ChronologyAgent(rng, 1922);
    const validPhases = Object.values(DayPhase);
    for (let i = 0; i < 12; i++) {
      const result = agent.tick();
      expect(validPhases).toContain(result.dayPhase);
    }
  });

  it('getDayPhase() returns a DayPhase enum value', () => {
    const agent = new ChronologyAgent(rng, 1922);
    const validPhases = Object.values(DayPhase);
    expect(validPhases).toContain(agent.getDayPhase());
  });

  // ── dayProgress is normalized 0-1 ────────────────────

  it('dayProgress is in [0, 1) on every tick', () => {
    const agent = new ChronologyAgent(rng, 1922);
    for (let i = 0; i < TICKS_PER_DAY * 3; i++) {
      const result = agent.tick();
      expect(result.dayProgress).toBeGreaterThanOrEqual(0);
      expect(result.dayProgress).toBeLessThan(1);
    }
  });

  // ── advanceYears ─────────────────────────────────────

  it('advanceYears advances the year and totalTicks', () => {
    const agent = new ChronologyAgent(rng, 1922);
    agent.advanceYears(5);
    expect(agent.getDate().year).toBe(1927);
    expect(agent.getDate().totalTicks).toBe(5 * TICKS_PER_YEAR);
  });

  it('advanceYears with 0 or negative is a no-op', () => {
    const agent = new ChronologyAgent(rng, 1922);
    agent.advanceYears(0);
    expect(agent.getDate().year).toBe(1922);
    agent.advanceYears(-3);
    expect(agent.getDate().year).toBe(1922);
  });

  // ── Serialization round-trip ─────────────────────────

  it('serialization preserves date, season, weather, tickWithinDay', () => {
    const agent = new ChronologyAgent(rng, 1922);
    // Advance a bit to get non-default state
    for (let i = 0; i < 45; i++) agent.tick(); // 1 month + 15 ticks

    const state: ChronologyState = agent.serialize();

    expect(state.date.totalTicks).toBe(45);
    expect(state.date.year).toBe(1922);
    expect(typeof state.season).toBe('string');
    expect(state.weather).toBeDefined();
    expect(typeof state.tickWithinDay).toBe('number');
  });

  it('deserialized agent continues from the same date', () => {
    const rng1 = new GameRng('deserialize-test');
    const agent = new ChronologyAgent(rng1, 1922);
    for (let i = 0; i < 100; i++) agent.tick();

    const state = agent.serialize();

    const rng2 = new GameRng('deserialize-test');
    const restored = ChronologyAgent.deserialize(state, rng2);

    expect(restored.getDate().totalTicks).toBe(agent.getDate().totalTicks);
    expect(restored.getDate().year).toBe(agent.getDate().year);
    expect(restored.getDate().month).toBe(agent.getDate().month);
    expect(restored.getDate().day).toBe(agent.getDate().day);
    expect(restored.getSeason().season).toBe(agent.getSeason().season);
  });

  it('deserialized agent ticks correctly after restore', () => {
    const rng1 = new GameRng('restore-tick-test');
    const agent = new ChronologyAgent(rng1, 1922);
    // Advance to just before a day boundary (2 ticks)
    agent.tick();
    agent.tick();

    const state = agent.serialize();

    const rng2 = new GameRng('restore-tick-test');
    const restored = ChronologyAgent.deserialize(state, rng2);

    // The next tick on both should cross a day boundary
    const originalResult = agent.tick();
    const restoredResult = restored.tick();

    expect(restoredResult.newDay).toBe(originalResult.newDay);
    expect(restoredResult.season.season).toBe(originalResult.season.season);
  });
});

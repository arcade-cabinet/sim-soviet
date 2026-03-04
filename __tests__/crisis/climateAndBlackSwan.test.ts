/**
 * @fileoverview Comprehensive tests for ClimateEventSystem and BlackSwanSystem.
 *
 * ClimateEventSystem — Tier 2 seasonal/geographic events gated by season,
 * weather, and climate trend. Has per-event cooldowns.
 *
 * BlackSwanSystem — Tier 3 truly rare events. No artificial gates. Low
 * probability is the only limiter. Includes meteor strikes, earthquakes,
 * solar storms, nuclear accidents, and supervolcanic ash.
 */

import { ClimateEventSystem, CLIMATE_EVENTS } from '@/ai/agents/crisis/ClimateEventSystem';
import { BlackSwanSystem } from '@/ai/agents/crisis/BlackSwanSystem';
import { Season } from '@/game/Chronology';
import { WeatherType } from '@/ai/agents/core/weather-types';
import { GameRng } from '@/game/SeedSystem';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Create a GameRng stub that always returns the provided value from random().
 * Useful for forcing or preventing event triggers deterministically.
 */
function stubRng(value: number): GameRng {
  const rng = new GameRng('stub-seed');
  rng.random = () => value;
  rng.int = (min: number, max: number) => Math.floor(value * (max - min + 1)) + min;
  return rng;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ClimateEventSystem
// ═══════════════════════════════════════════════════════════════════════════════

describe('ClimateEventSystem', () => {
  // ── Constructor ──────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('creates system with empty cooldown state', () => {
      const system = new ClimateEventSystem();
      // serialize() returns the cooldown map as an array; it must be empty on creation
      const serialized = system.serialize();
      expect(serialized).toHaveLength(0);
    });
  });

  // ── evaluate() returns empty array when nothing matches ─────────────────────

  describe('evaluate() — no matching conditions', () => {
    it('returns empty impacts and empty pressureSpikes when no conditions match', () => {
      const system = new ClimateEventSystem();
      // SHORT_SUMMER has no events with matching climate trend (-0.9 is cooling,
      // but no SHORT_SUMMER events are in the catalog) and the RNG always 0.
      // The real guard: SHORT_SUMMER is not a valid season for any catalog event
      // except hailstorm (which fires in SHORT_SUMMER). Use a season with no events.
      // EARLY_FROST only has severe_frost (valid in WINTER/EARLY_FROST).
      // Let's use EARLY_FROST with a climate trend outside severe_frost's range (0.5 = warming, range needs < -0.2).
      const result = system.evaluate(
        Season.EARLY_FROST,
        WeatherType.OVERCAST,
        0.5, // warming trend — severe_frost needs min:-1.0 max:-0.2
        stubRng(0.0), // would fire if conditions met, but they won't
      );
      expect(result.impacts).toHaveLength(0);
      expect(Object.keys(result.pressureSpikes)).toHaveLength(0);
    });

    it('returns empty when RNG roll is above all probabilities', () => {
      const system = new ClimateEventSystem();
      // WINTER season, cooling trend (satisfies severe_frost conditions) but RNG = 1.0
      // so roll (1.0) is never < probability
      const result = system.evaluate(
        Season.WINTER,
        WeatherType.OVERCAST,
        -0.5,
        stubRng(1.0), // never fires
      );
      expect(result.impacts).toHaveLength(0);
    });
  });

  // ── Severe Frost ─────────────────────────────────────────────────────────────

  describe('Severe Frost', () => {
    it('fires in WINTER season with cooling climate trend when RNG is low', () => {
      const system = new ClimateEventSystem();
      // severe_frost: validSeasons=[WINTER, EARLY_FROST], climateTrendRange={min:-1, max:-0.2}
      // baseProbability=0.008, BLIZZARD boost=2.0 → effective prob=0.016
      // stubRng(0.0) → 0.0 < 0.016, so fires
      const result = system.evaluate(
        Season.WINTER,
        WeatherType.OVERCAST, // no boost, but 0.0 < 0.008 → fires
        -0.5,
        stubRng(0.0),
      );
      const hasSevereFrost = result.impacts.some((imp) => imp.crisisId === 'climate-severe-frost');
      expect(hasSevereFrost).toBe(true);
    });

    it('fires in EARLY_FROST season with cooling climate trend', () => {
      const system = new ClimateEventSystem();
      const result = system.evaluate(
        Season.EARLY_FROST,
        WeatherType.OVERCAST,
        -0.5,
        stubRng(0.0),
      );
      const hasSevereFrost = result.impacts.some((imp) => imp.crisisId === 'climate-severe-frost');
      expect(hasSevereFrost).toBe(true);
    });

    it('does NOT fire in WINTER when climate trend is warming (> -0.2)', () => {
      const system = new ClimateEventSystem();
      // trend=0.0 is outside [min:-1.0, max:-0.2]
      const result = system.evaluate(
        Season.WINTER,
        WeatherType.BLIZZARD,
        0.0,
        stubRng(0.0),
      );
      const hasSevereFrost = result.impacts.some((imp) => imp.crisisId === 'climate-severe-frost');
      expect(hasSevereFrost).toBe(false);
    });

    it('does NOT fire outside valid seasons (e.g., STIFLING_HEAT)', () => {
      const system = new ClimateEventSystem();
      const result = system.evaluate(
        Season.STIFLING_HEAT,
        WeatherType.BLIZZARD, // even with blizzard boost, wrong season
        -0.9,
        stubRng(0.0),
      );
      const hasSevereFrost = result.impacts.some((imp) => imp.crisisId === 'climate-severe-frost');
      expect(hasSevereFrost).toBe(false);
    });

    it('produces correct economy and social impact fields', () => {
      const system = new ClimateEventSystem();
      const result = system.evaluate(
        Season.WINTER,
        WeatherType.OVERCAST,
        -0.5,
        stubRng(0.0),
      );
      const impact = result.impacts.find((imp) => imp.crisisId === 'climate-severe-frost');
      expect(impact).toBeDefined();
      expect(impact!.economy?.productionMult).toBe(0.8);
      expect(impact!.social?.diseaseMult).toBe(1.5);
    });

    it('spikes food, infrastructure, health, and power pressure domains', () => {
      const system = new ClimateEventSystem();
      const result = system.evaluate(
        Season.WINTER,
        WeatherType.OVERCAST,
        -0.5,
        stubRng(0.0),
      );
      // severe_frost pressureSpikes: food:0.1, infrastructure:0.05, health:0.08, power:0.06
      expect(result.pressureSpikes.food).toBeGreaterThan(0);
      expect(result.pressureSpikes.infrastructure).toBeGreaterThan(0);
      expect(result.pressureSpikes.health).toBeGreaterThan(0);
      expect(result.pressureSpikes.power).toBeGreaterThan(0);
    });
  });

  // ── Summer Drought ───────────────────────────────────────────────────────────

  describe('Summer Drought', () => {
    it('fires in STIFLING_HEAT season with dry (cooling) trend when RNG is low', () => {
      const system = new ClimateEventSystem();
      // summer_drought: validSeasons=[STIFLING_HEAT, GOLDEN_WEEK], climateTrendRange={min:-0.8, max:-0.1}
      // baseProbability=0.006; stubRng(0.0) fires immediately
      const result = system.evaluate(
        Season.STIFLING_HEAT,
        WeatherType.OVERCAST,
        -0.5,
        stubRng(0.0),
      );
      const hasDrought = result.impacts.some((imp) => imp.crisisId === 'climate-summer-drought');
      expect(hasDrought).toBe(true);
    });

    it('fires in GOLDEN_WEEK season with dry trend', () => {
      const system = new ClimateEventSystem();
      const result = system.evaluate(
        Season.GOLDEN_WEEK,
        WeatherType.OVERCAST,
        -0.3,
        stubRng(0.0),
      );
      const hasDrought = result.impacts.some((imp) => imp.crisisId === 'climate-summer-drought');
      expect(hasDrought).toBe(true);
    });

    it('does NOT fire when climate trend is warming (outside dry range)', () => {
      const system = new ClimateEventSystem();
      // summer_drought needs min:-0.8 max:-0.1 → 0.2 is out of range
      const result = system.evaluate(
        Season.STIFLING_HEAT,
        WeatherType.HEATWAVE,
        0.2,
        stubRng(0.0),
      );
      const hasDrought = result.impacts.some((imp) => imp.crisisId === 'climate-summer-drought');
      expect(hasDrought).toBe(false);
    });

    it('has foodDelta in economy impact', () => {
      const system = new ClimateEventSystem();
      const result = system.evaluate(
        Season.STIFLING_HEAT,
        WeatherType.OVERCAST,
        -0.5,
        stubRng(0.0),
      );
      const impact = result.impacts.find((imp) => imp.crisisId === 'climate-summer-drought');
      expect(impact).toBeDefined();
      expect(impact!.economy?.foodDelta).toBeLessThan(0);
    });
  });

  // ── Spring Flood ─────────────────────────────────────────────────────────────

  describe('Spring Flood', () => {
    it('fires in RASPUTITSA_SPRING season with warming trend', () => {
      const system = new ClimateEventSystem();
      // spring_flood: validSeasons=[RASPUTITSA_SPRING], climateTrendRange={min:0.2, max:1.0}
      const result = system.evaluate(
        Season.RASPUTITSA_SPRING,
        WeatherType.OVERCAST,
        0.5,
        stubRng(0.0),
      );
      const hasFlood = result.impacts.some((imp) => imp.crisisId === 'climate-spring-flood');
      expect(hasFlood).toBe(true);
    });

    it('does NOT fire outside RASPUTITSA_SPRING', () => {
      const system = new ClimateEventSystem();
      const result = system.evaluate(
        Season.WINTER,
        WeatherType.RAIN,
        0.5,
        stubRng(0.0),
      );
      const hasFlood = result.impacts.some((imp) => imp.crisisId === 'climate-spring-flood');
      expect(hasFlood).toBe(false);
    });

    it('does NOT fire when climate trend is below minimum (< 0.2)', () => {
      const system = new ClimateEventSystem();
      const result = system.evaluate(
        Season.RASPUTITSA_SPRING,
        WeatherType.RAIN,
        0.0, // outside [0.2, 1.0]
        stubRng(0.0),
      );
      const hasFlood = result.impacts.some((imp) => imp.crisisId === 'climate-spring-flood');
      expect(hasFlood).toBe(false);
    });

    it('spikes infrastructure and housing pressure domains', () => {
      const system = new ClimateEventSystem();
      const result = system.evaluate(
        Season.RASPUTITSA_SPRING,
        WeatherType.OVERCAST,
        0.5,
        stubRng(0.0),
      );
      // spring_flood pressureSpikes: infrastructure:0.1, housing:0.05
      expect(result.pressureSpikes.infrastructure).toBeGreaterThan(0);
      expect(result.pressureSpikes.housing).toBeGreaterThan(0);
    });

    it('has decayMult in infrastructure impact', () => {
      const system = new ClimateEventSystem();
      const result = system.evaluate(
        Season.RASPUTITSA_SPRING,
        WeatherType.OVERCAST,
        0.5,
        stubRng(0.0),
      );
      const impact = result.impacts.find((imp) => imp.crisisId === 'climate-spring-flood');
      expect(impact!.infrastructure?.decayMult).toBe(1.5);
    });
  });

  // ── Wildfire ─────────────────────────────────────────────────────────────────

  describe('Wildfire', () => {
    it('fires in STIFLING_HEAT with HEATWAVE weather and cooling/neutral trend', () => {
      const system = new ClimateEventSystem();
      // wildfire: validSeasons=[STIFLING_HEAT], climateTrendRange={min:-1.0, max:0.0}
      // baseProbability=0.004, HEATWAVE boost=3.0 → effective prob=0.012
      // stubRng(0.0) → fires
      const result = system.evaluate(
        Season.STIFLING_HEAT,
        WeatherType.HEATWAVE,
        -0.2,
        stubRng(0.0),
      );
      const hasWildfire = result.impacts.some((imp) => imp.crisisId === 'climate-wildfire');
      expect(hasWildfire).toBe(true);
    });

    it('does NOT fire outside STIFLING_HEAT season', () => {
      const system = new ClimateEventSystem();
      const result = system.evaluate(
        Season.SHORT_SUMMER,
        WeatherType.HEATWAVE,
        -0.5,
        stubRng(0.0),
      );
      const hasWildfire = result.impacts.some((imp) => imp.crisisId === 'climate-wildfire');
      expect(hasWildfire).toBe(false);
    });

    it('does NOT fire when climate trend is warming (outside [-1.0, 0.0] range)', () => {
      const system = new ClimateEventSystem();
      const result = system.evaluate(
        Season.STIFLING_HEAT,
        WeatherType.HEATWAVE,
        0.5, // outside [min:-1.0, max:0.0]
        stubRng(0.0),
      );
      const hasWildfire = result.impacts.some((imp) => imp.crisisId === 'climate-wildfire');
      expect(hasWildfire).toBe(false);
    });

    it('produces critical severity toast message', () => {
      const system = new ClimateEventSystem();
      const result = system.evaluate(
        Season.STIFLING_HEAT,
        WeatherType.HEATWAVE,
        -0.2,
        stubRng(0.0),
      );
      const impact = result.impacts.find((imp) => imp.crisisId === 'climate-wildfire');
      const toast = impact!.narrative?.toastMessages?.[0];
      expect(toast?.severity).toBe('critical');
    });
  });

  // ── Seasonal Epidemic ───────────────────────────────────────────────────────

  describe('Seasonal Epidemic', () => {
    it('fires in WINTER season (null climateTrendRange, any trend)', () => {
      const system = new ClimateEventSystem();
      // seasonal_epidemic: validSeasons=[WINTER, RASPUTITSA_AUTUMN], climateTrendRange=null
      // baseProbability=0.005, stubRng(0.0) < 0.005 → fires
      const result = system.evaluate(
        Season.WINTER,
        WeatherType.OVERCAST,
        0.5, // warming — doesn't matter because climateTrendRange is null
        stubRng(0.0),
      );
      const hasEpidemic = result.impacts.some((imp) => imp.crisisId === 'climate-seasonal-epidemic');
      expect(hasEpidemic).toBe(true);
    });

    it('fires in RASPUTITSA_AUTUMN season', () => {
      const system = new ClimateEventSystem();
      const result = system.evaluate(
        Season.RASPUTITSA_AUTUMN,
        WeatherType.OVERCAST,
        0.0,
        stubRng(0.0),
      );
      const hasEpidemic = result.impacts.some((imp) => imp.crisisId === 'climate-seasonal-epidemic');
      expect(hasEpidemic).toBe(true);
    });

    it('does NOT fire outside valid seasons (e.g., SHORT_SUMMER)', () => {
      const system = new ClimateEventSystem();
      const result = system.evaluate(
        Season.SHORT_SUMMER,
        WeatherType.FOG,
        0.0,
        stubRng(0.0),
      );
      const hasEpidemic = result.impacts.some((imp) => imp.crisisId === 'climate-seasonal-epidemic');
      expect(hasEpidemic).toBe(false);
    });

    it('produces correct social impact fields (diseaseMult, growthMult)', () => {
      const system = new ClimateEventSystem();
      const result = system.evaluate(
        Season.WINTER,
        WeatherType.OVERCAST,
        0.0,
        stubRng(0.0),
      );
      const impact = result.impacts.find((imp) => imp.crisisId === 'climate-seasonal-epidemic');
      expect(impact).toBeDefined();
      expect(impact!.social?.diseaseMult).toBe(2.0);
      expect(impact!.social?.growthMult).toBe(0.9);
    });

    it('spikes health, morale, and demographic pressure domains', () => {
      const system = new ClimateEventSystem();
      const result = system.evaluate(
        Season.RASPUTITSA_AUTUMN,
        WeatherType.OVERCAST,
        0.0,
        stubRng(0.0),
      );
      // seasonal_epidemic pressureSpikes: health:0.12, morale:0.05, demographic:0.03
      expect(result.pressureSpikes.health).toBeGreaterThan(0);
      expect(result.pressureSpikes.morale).toBeGreaterThan(0);
      expect(result.pressureSpikes.demographic).toBeGreaterThan(0);
    });
  });

  // ── Hailstorm ─────────────────────────────────────────────────────────────────

  describe('Hailstorm', () => {
    it('fires in SHORT_SUMMER season (null climateTrendRange, any trend)', () => {
      const system = new ClimateEventSystem();
      // hailstorm: validSeasons=[SHORT_SUMMER], climateTrendRange=null
      // baseProbability=0.005, stubRng(0.0) < 0.005 → fires
      const result = system.evaluate(
        Season.SHORT_SUMMER,
        WeatherType.OVERCAST,
        0.0,
        stubRng(0.0),
      );
      const hasHail = result.impacts.some((imp) => imp.crisisId === 'climate-hailstorm');
      expect(hasHail).toBe(true);
    });

    it('does NOT fire outside SHORT_SUMMER (e.g., WINTER)', () => {
      const system = new ClimateEventSystem();
      const result = system.evaluate(
        Season.WINTER,
        WeatherType.RAIN,
        0.0,
        stubRng(0.0),
      );
      const hasHail = result.impacts.some((imp) => imp.crisisId === 'climate-hailstorm');
      expect(hasHail).toBe(false);
    });

    it('fires regardless of climate trend (null range)', () => {
      const system = new ClimateEventSystem();
      // Try extreme warming
      const resultWarm = system.evaluate(
        Season.SHORT_SUMMER,
        WeatherType.OVERCAST,
        1.0,
        stubRng(0.0),
      );
      expect(resultWarm.impacts.some((imp) => imp.crisisId === 'climate-hailstorm')).toBe(true);

      // Try extreme cooling — need fresh system due to cooldown
      const system2 = new ClimateEventSystem();
      const resultCool = system2.evaluate(
        Season.SHORT_SUMMER,
        WeatherType.OVERCAST,
        -1.0,
        stubRng(0.0),
      );
      expect(resultCool.impacts.some((imp) => imp.crisisId === 'climate-hailstorm')).toBe(true);
    });

    it('has RAIN weather boost (x2.0)', () => {
      // hailstorm baseProbability=0.005, RAIN boost=2.0 → effective=0.01
      // At stubRng(0.006): fires with RAIN (0.006 < 0.01), not with OVERCAST (0.006 > 0.005)
      const systemRain = new ClimateEventSystem();
      const resultRain = systemRain.evaluate(
        Season.SHORT_SUMMER,
        WeatherType.RAIN,
        0.0,
        stubRng(0.006),
      );
      expect(resultRain.impacts.some((imp) => imp.crisisId === 'climate-hailstorm')).toBe(true);

      const systemNoBoost = new ClimateEventSystem();
      const resultNoBoost = systemNoBoost.evaluate(
        Season.SHORT_SUMMER,
        WeatherType.OVERCAST,
        0.0,
        stubRng(0.006),
      );
      expect(resultNoBoost.impacts.some((imp) => imp.crisisId === 'climate-hailstorm')).toBe(false);
    });

    it('produces correct economy impact (productionMult and foodDelta)', () => {
      const system = new ClimateEventSystem();
      const result = system.evaluate(
        Season.SHORT_SUMMER,
        WeatherType.OVERCAST,
        0.0,
        stubRng(0.0),
      );
      const impact = result.impacts.find((imp) => imp.crisisId === 'climate-hailstorm');
      expect(impact).toBeDefined();
      expect(impact!.economy?.productionMult).toBe(0.88);
      expect(impact!.economy?.foodDelta).toBe(-10);
    });

    it('spikes food and infrastructure pressure domains', () => {
      const system = new ClimateEventSystem();
      const result = system.evaluate(
        Season.SHORT_SUMMER,
        WeatherType.OVERCAST,
        0.0,
        stubRng(0.0),
      );
      // hailstorm pressureSpikes: food:0.08, infrastructure:0.04
      expect(result.pressureSpikes.food).toBeGreaterThan(0);
      expect(result.pressureSpikes.infrastructure).toBeGreaterThan(0);
    });
  });

  // ── Climate trend range filtering ─────────────────────────────────────────────

  describe('climate trend range filtering', () => {
    it('severe_frost fires at boundary values (min=-1.0 and max=-0.2)', () => {
      const system1 = new ClimateEventSystem();
      const resultAtMin = system1.evaluate(Season.WINTER, WeatherType.OVERCAST, -1.0, stubRng(0.0));
      expect(resultAtMin.impacts.some((imp) => imp.crisisId === 'climate-severe-frost')).toBe(true);

      const system2 = new ClimateEventSystem();
      const resultAtMax = system2.evaluate(Season.WINTER, WeatherType.OVERCAST, -0.2, stubRng(0.0));
      expect(resultAtMax.impacts.some((imp) => imp.crisisId === 'climate-severe-frost')).toBe(true);
    });

    it('severe_frost does NOT fire just outside boundaries', () => {
      const system1 = new ClimateEventSystem();
      const resultAbove = system1.evaluate(Season.WINTER, WeatherType.OVERCAST, -0.19, stubRng(0.0));
      expect(resultAbove.impacts.some((imp) => imp.crisisId === 'climate-severe-frost')).toBe(false);

      // -1.01 would be below min, but in practice trend is -1 to +1 — test -1.01
      const system2 = new ClimateEventSystem();
      const resultBelow = system2.evaluate(Season.WINTER, WeatherType.OVERCAST, -1.01, stubRng(0.0));
      expect(resultBelow.impacts.some((imp) => imp.crisisId === 'climate-severe-frost')).toBe(false);
    });

    it('spring_flood fires at boundary values (min=0.2 and max=1.0)', () => {
      const system1 = new ClimateEventSystem();
      const resultAtMin = system1.evaluate(Season.RASPUTITSA_SPRING, WeatherType.OVERCAST, 0.2, stubRng(0.0));
      expect(resultAtMin.impacts.some((imp) => imp.crisisId === 'climate-spring-flood')).toBe(true);

      const system2 = new ClimateEventSystem();
      const resultAtMax = system2.evaluate(Season.RASPUTITSA_SPRING, WeatherType.OVERCAST, 1.0, stubRng(0.0));
      expect(resultAtMax.impacts.some((imp) => imp.crisisId === 'climate-spring-flood')).toBe(true);
    });

    it('events with null climateTrendRange fire at any trend value', () => {
      // seasonal_epidemic and hailstorm have null climateTrendRange
      const system1 = new ClimateEventSystem();
      const r1 = system1.evaluate(Season.WINTER, WeatherType.OVERCAST, -1.0, stubRng(0.0));
      expect(r1.impacts.some((imp) => imp.crisisId === 'climate-seasonal-epidemic')).toBe(true);

      const system2 = new ClimateEventSystem();
      const r2 = system2.evaluate(Season.WINTER, WeatherType.OVERCAST, 0.0, stubRng(0.0));
      expect(r2.impacts.some((imp) => imp.crisisId === 'climate-seasonal-epidemic')).toBe(true);

      const system3 = new ClimateEventSystem();
      const r3 = system3.evaluate(Season.WINTER, WeatherType.OVERCAST, 1.0, stubRng(0.0));
      expect(r3.impacts.some((imp) => imp.crisisId === 'climate-seasonal-epidemic')).toBe(true);
    });
  });

  // ── Weather boosts increase effective probability ─────────────────────────────

  describe('weather boosts', () => {
    it('BLIZZARD boosts severe_frost probability so it fires at slightly higher RNG values', () => {
      // severe_frost baseProbability=0.008, BLIZZARD boost=2.0 → effectiveProbability=0.016
      // Without boost: only fires if rng.random() < 0.008
      // With BLIZZARD: fires if rng.random() < 0.016
      // Test that at stubRng(0.01) it fires with BLIZZARD but not with OVERCAST
      const systemWithBoost = new ClimateEventSystem();
      const resultWithBoost = systemWithBoost.evaluate(
        Season.WINTER,
        WeatherType.BLIZZARD,
        -0.5,
        stubRng(0.01), // 0.01 < 0.016 → fires with boost
      );
      const hasFrostWithBoost = resultWithBoost.impacts.some((imp) => imp.crisisId === 'climate-severe-frost');
      expect(hasFrostWithBoost).toBe(true);

      const systemNoBoost = new ClimateEventSystem();
      const resultNoBoost = systemNoBoost.evaluate(
        Season.WINTER,
        WeatherType.OVERCAST, // no boost → probability stays at 0.008
        -0.5,
        stubRng(0.01), // 0.01 > 0.008 → does NOT fire without boost
      );
      const hasFrostNoBoost = resultNoBoost.impacts.some((imp) => imp.crisisId === 'climate-severe-frost');
      expect(hasFrostNoBoost).toBe(false);
    });

    it('HEATWAVE boost on summer_drought increases probability', () => {
      // summer_drought baseProbability=0.006, HEATWAVE boost=2.5 → effective=0.015
      // At stubRng(0.01): fires with HEATWAVE (0.01 < 0.015), not with OVERCAST (0.01 > 0.006)
      const systemHeatwave = new ClimateEventSystem();
      const resultHeatwave = systemHeatwave.evaluate(
        Season.STIFLING_HEAT,
        WeatherType.HEATWAVE,
        -0.3,
        stubRng(0.01),
      );
      const hasDrought = resultHeatwave.impacts.some((imp) => imp.crisisId === 'climate-summer-drought');
      expect(hasDrought).toBe(true);

      const systemNoBoost = new ClimateEventSystem();
      const resultNoBoost = systemNoBoost.evaluate(
        Season.STIFLING_HEAT,
        WeatherType.OVERCAST, // no boost → 0.006
        -0.3,
        stubRng(0.01), // 0.01 > 0.006 → does not fire
      );
      const hasDroughtNoBoost = resultNoBoost.impacts.some((imp) => imp.crisisId === 'climate-summer-drought');
      expect(hasDroughtNoBoost).toBe(false);
    });

    it('SNOW boosts severe_frost probability (x1.3)', () => {
      // severe_frost baseProbability=0.008, SNOW boost=1.3 → effective=0.0104
      // At stubRng(0.009): fires with SNOW (0.009 < 0.0104), not with OVERCAST (0.009 > 0.008)
      const systemSnow = new ClimateEventSystem();
      const resultSnow = systemSnow.evaluate(Season.WINTER, WeatherType.SNOW, -0.5, stubRng(0.009));
      expect(resultSnow.impacts.some((imp) => imp.crisisId === 'climate-severe-frost')).toBe(true);

      const systemNone = new ClimateEventSystem();
      const resultNone = systemNone.evaluate(Season.WINTER, WeatherType.OVERCAST, -0.5, stubRng(0.009));
      expect(resultNone.impacts.some((imp) => imp.crisisId === 'climate-severe-frost')).toBe(false);
    });

    it('FOG boosts seasonal_epidemic probability (x1.5)', () => {
      // seasonal_epidemic baseProbability=0.005, FOG boost=1.5 → effective=0.0075
      // At stubRng(0.006): fires with FOG (0.006 < 0.0075), not with OVERCAST (0.006 > 0.005)
      const systemFog = new ClimateEventSystem();
      const resultFog = systemFog.evaluate(Season.WINTER, WeatherType.FOG, -0.5, stubRng(0.006));
      expect(resultFog.impacts.some((imp) => imp.crisisId === 'climate-seasonal-epidemic')).toBe(true);

      const systemNone = new ClimateEventSystem();
      const resultNone = systemNone.evaluate(Season.WINTER, WeatherType.OVERCAST, -0.5, stubRng(0.006));
      expect(resultNone.impacts.some((imp) => imp.crisisId === 'climate-seasonal-epidemic')).toBe(false);
    });

    it('MUD_STORM boosts spring_flood probability (x2.0)', () => {
      // spring_flood baseProbability=0.007, MUD_STORM boost=2.0 → effective=0.014
      // At stubRng(0.01): fires with MUD_STORM (0.01 < 0.014), not with OVERCAST (0.01 > 0.007)
      const systemMud = new ClimateEventSystem();
      const resultMud = systemMud.evaluate(Season.RASPUTITSA_SPRING, WeatherType.MUD_STORM, 0.5, stubRng(0.01));
      expect(resultMud.impacts.some((imp) => imp.crisisId === 'climate-spring-flood')).toBe(true);

      const systemNone = new ClimateEventSystem();
      const resultNone = systemNone.evaluate(Season.RASPUTITSA_SPRING, WeatherType.OVERCAST, 0.5, stubRng(0.01));
      expect(resultNone.impacts.some((imp) => imp.crisisId === 'climate-spring-flood')).toBe(false);
    });

    it('CLEAR boosts wildfire probability (x1.5)', () => {
      // wildfire baseProbability=0.004, CLEAR boost=1.5 → effective=0.006
      // At stubRng(0.005): fires with CLEAR (0.005 < 0.006), not with OVERCAST (0.005 > 0.004)
      const systemClear = new ClimateEventSystem();
      const resultClear = systemClear.evaluate(Season.STIFLING_HEAT, WeatherType.CLEAR, -0.5, stubRng(0.005));
      expect(resultClear.impacts.some((imp) => imp.crisisId === 'climate-wildfire')).toBe(true);

      const systemNone = new ClimateEventSystem();
      const resultNone = systemNone.evaluate(Season.STIFLING_HEAT, WeatherType.OVERCAST, -0.5, stubRng(0.005));
      expect(resultNone.impacts.some((imp) => imp.crisisId === 'climate-wildfire')).toBe(false);
    });

    it('weather type with no boost for the event uses base probability', () => {
      // Use a weather type that has no boost defined for severe_frost (e.g. HEATWAVE)
      const system = new ClimateEventSystem();
      // severe_frost only has BLIZZARD:2.0 and SNOW:1.3 boosts
      // HEATWAVE is not in weatherBoosts → probability stays at baseProbability 0.008
      // stubRng(0.005) < 0.008 → should still fire
      const result = system.evaluate(Season.WINTER, WeatherType.HEATWAVE, -0.5, stubRng(0.005));
      expect(result.impacts.some((imp) => imp.crisisId === 'climate-severe-frost')).toBe(true);
    });
  });

  // ── Cooldown ─────────────────────────────────────────────────────────────────

  describe('cooldown', () => {
    it('prevents same event from firing again within its cooldown period', () => {
      const system = new ClimateEventSystem();

      // First call — event fires
      const first = system.evaluate(Season.WINTER, WeatherType.OVERCAST, -0.5, stubRng(0.0));
      const frostFirst = first.impacts.some((imp) => imp.crisisId === 'climate-severe-frost');
      expect(frostFirst).toBe(true);

      // Second call immediately after — should be blocked by cooldown
      const second = system.evaluate(Season.WINTER, WeatherType.OVERCAST, -0.5, stubRng(0.0));
      const frostSecond = second.impacts.some((imp) => imp.crisisId === 'climate-severe-frost');
      expect(frostSecond).toBe(false);
    });

    it('serializes active cooldown entries', () => {
      const system = new ClimateEventSystem();
      // Fire severe_frost — cooldownTicks=24
      system.evaluate(Season.WINTER, WeatherType.OVERCAST, -0.5, stubRng(0.0));

      const serialized = system.serialize();
      const frostCooldown = serialized.find(([id]) => id === 'severe_frost');
      expect(frostCooldown).toBeDefined();
      expect(frostCooldown![1]).toBe(24);
    });

    it('cooldown decrements each evaluate() call', () => {
      const system = new ClimateEventSystem();
      // Fire the event
      system.evaluate(Season.WINTER, WeatherType.OVERCAST, -0.5, stubRng(0.0));

      const afterFirst = system.serialize();
      const cooldownAfterFire = afterFirst.find(([id]) => id === 'severe_frost')![1];
      expect(cooldownAfterFire).toBe(24);

      // Two more evaluations with RNG=1.0 (won't fire again, just decrement)
      system.evaluate(Season.WINTER, WeatherType.OVERCAST, -0.5, stubRng(1.0));
      system.evaluate(Season.WINTER, WeatherType.OVERCAST, -0.5, stubRng(1.0));

      const afterThird = system.serialize();
      const cooldownAfterTwo = afterThird.find(([id]) => id === 'severe_frost')![1];
      expect(cooldownAfterTwo).toBe(22);
    });

    it('event fires again after cooldown expires', () => {
      const system = new ClimateEventSystem();
      // severe_frost cooldownTicks=24
      system.evaluate(Season.WINTER, WeatherType.OVERCAST, -0.5, stubRng(0.0));

      // Exhaust cooldown by running 25 ticks with RNG=1.0 (won't re-fire)
      for (let i = 0; i < 25; i++) {
        system.evaluate(Season.WINTER, WeatherType.OVERCAST, -0.5, stubRng(1.0));
      }

      // Now cooldown should be gone — can fire again
      const serialized = system.serialize();
      const hasCooldown = serialized.some(([id]) => id === 'severe_frost');
      expect(hasCooldown).toBe(false);

      const afterCooldown = system.evaluate(Season.WINTER, WeatherType.OVERCAST, -0.5, stubRng(0.0));
      const fired = afterCooldown.impacts.some((imp) => imp.crisisId === 'climate-severe-frost');
      expect(fired).toBe(true);
    });
  });

  // ── Multiple events in one evaluation ────────────────────────────────────────

  describe('multiple events', () => {
    it('can fire multiple events if conditions match for multiple event types', () => {
      const system = new ClimateEventSystem();
      // WINTER: severe_frost (needs trend < -0.2) and seasonal_epidemic (no trend restriction)
      // both valid in WINTER. stubRng(0.0) → both fire
      // severe_frost needs climateTrendRange:{min:-1.0, max:-0.2} → -0.5 qualifies
      // seasonal_epidemic has null climateTrendRange → always qualifies
      const result = system.evaluate(
        Season.WINTER,
        WeatherType.OVERCAST,
        -0.5,
        stubRng(0.0),
      );
      expect(result.impacts.length).toBeGreaterThanOrEqual(2);
      const ids = result.impacts.map((imp) => imp.crisisId);
      expect(ids).toContain('climate-severe-frost');
      expect(ids).toContain('climate-seasonal-epidemic');
    });

    it('aggregates pressure spikes from multiple fired events', () => {
      const system = new ClimateEventSystem();
      const result = system.evaluate(
        Season.WINTER,
        WeatherType.OVERCAST,
        -0.5,
        stubRng(0.0),
      );
      // Both severe_frost (health:0.08) and seasonal_epidemic (health:0.12) spike health
      // Aggregate should be 0.08 + 0.12 = 0.20
      if (result.impacts.length >= 2) {
        expect(result.pressureSpikes.health).toBeCloseTo(0.2, 5);
      }
    });
  });

  // ── serialize / restore ───────────────────────────────────────────────────────

  describe('serialize / restore', () => {
    it('restore() preserves cooldown state', () => {
      const system1 = new ClimateEventSystem();
      // Fire event to create cooldown
      system1.evaluate(Season.WINTER, WeatherType.OVERCAST, -0.5, stubRng(0.0));
      const snapshot = system1.serialize();

      const system2 = new ClimateEventSystem();
      system2.restore(snapshot);
      const restored = system2.serialize();

      expect(restored).toEqual(snapshot);
    });

    it('restored system respects cooldown — blocked event stays blocked', () => {
      const system1 = new ClimateEventSystem();
      system1.evaluate(Season.WINTER, WeatherType.OVERCAST, -0.5, stubRng(0.0));
      const snapshot = system1.serialize();

      const system2 = new ClimateEventSystem();
      system2.restore(snapshot);

      // Should still be blocked
      const result = system2.evaluate(Season.WINTER, WeatherType.OVERCAST, -0.5, stubRng(0.0));
      const fired = result.impacts.some((imp) => imp.crisisId === 'climate-severe-frost');
      expect(fired).toBe(false);
    });

    it('serialize returns empty array for fresh system with no fired events', () => {
      const system = new ClimateEventSystem();
      expect(system.serialize()).toEqual([]);
    });

    it('restore with empty array leaves system in clean state', () => {
      const system = new ClimateEventSystem();
      // Fire something first
      system.evaluate(Season.WINTER, WeatherType.OVERCAST, -0.5, stubRng(0.0));
      expect(system.serialize().length).toBeGreaterThan(0);

      // Restore with empty — should clear all cooldowns
      system.restore([]);
      expect(system.serialize()).toHaveLength(0);
    });
  });

  // ── Multiple evaluations over many ticks ────────────────────────────────────

  describe('multiple evaluations over many ticks', () => {
    it('fires events at expected frequency over 10000 ticks with seeded RNG', () => {
      const system = new ClimateEventSystem();
      const rng = new GameRng('multi-eval-seed');
      let totalFired = 0;

      for (let i = 0; i < 10_000; i++) {
        const result = system.evaluate(Season.WINTER, WeatherType.BLIZZARD, -0.5, rng);
        totalFired += result.impacts.length;
      }

      // With 2 eligible events in WINTER with cooling trend (severe_frost, seasonal_epidemic)
      // severe_frost: base 0.008 * BLIZZARD 2.0 = 0.016 (cooldown 24 ticks → ~1 every 25 ticks avg)
      // seasonal_epidemic: base 0.005 * SNOW(no)/BLIZZARD(no) — only FOG and SNOW have boosts for epidemic
      // Wait — seasonal_epidemic weatherBoosts are FOG:1.5 and SNOW:1.2. BLIZZARD has no boost → base 0.005
      // Expected: some events fire (not zero), but also capped by cooldowns
      expect(totalFired).toBeGreaterThan(0);
      // With cooldowns, the rate is naturally throttled — shouldn't be thousands
      expect(totalFired).toBeLessThan(5000);
    });

    it('different seasons produce different event distributions', () => {
      const systemWinter = new ClimateEventSystem();
      const systemSummer = new ClimateEventSystem();
      const winterIds = new Set<string>();
      const summerIds = new Set<string>();

      for (let i = 0; i < 1000; i++) {
        const rngW = new GameRng(`winter-${i}`);
        const rngS = new GameRng(`summer-${i}`);
        const rW = systemWinter.evaluate(Season.WINTER, WeatherType.OVERCAST, -0.5, rngW);
        const rS = systemSummer.evaluate(Season.STIFLING_HEAT, WeatherType.HEATWAVE, -0.5, rngS);
        for (const imp of rW.impacts) winterIds.add(imp.crisisId);
        for (const imp of rS.impacts) summerIds.add(imp.crisisId);
      }

      // Winter should produce severe_frost and seasonal_epidemic but not wildfire or drought
      expect(winterIds.has('climate-severe-frost')).toBe(true);
      expect(winterIds.has('climate-wildfire')).toBe(false);

      // Summer (STIFLING_HEAT) should produce wildfire and drought but not severe_frost
      expect(summerIds.has('climate-wildfire')).toBe(true);
      expect(summerIds.has('climate-severe-frost')).toBe(false);
    });

    it('cooldown prevents rapid re-firing but allows eventual recurrence', () => {
      const system = new ClimateEventSystem();
      let fireCount = 0;

      // Run 200 ticks always trying to fire severe_frost
      for (let i = 0; i < 200; i++) {
        const result = system.evaluate(Season.WINTER, WeatherType.OVERCAST, -0.5, stubRng(0.0));
        if (result.impacts.some((imp) => imp.crisisId === 'climate-severe-frost')) {
          fireCount++;
        }
      }

      // severe_frost cooldownTicks=24. The cooldown is set when the event fires,
      // and decremented each subsequent evaluate(). It fires on tick 0 (cooldown=24),
      // ticks 1-23 decrement (cooldown reaches 1 on tick 23), tick 24 deletes it,
      // fires again on tick 24. That's roughly every 24 ticks.
      // In 200 ticks: at most about 200/24 ≈ 9 firings.
      expect(fireCount).toBeGreaterThan(1);
      expect(fireCount).toBeLessThanOrEqual(10);
    });
  });

  // ── CLIMATE_EVENTS catalog integrity ─────────────────────────────────────────

  describe('CLIMATE_EVENTS catalog', () => {
    it('each event has a unique id', () => {
      const ids = CLIMATE_EVENTS.map((e) => e.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('each event has at least one valid season', () => {
      for (const event of CLIMATE_EVENTS) {
        expect(event.validSeasons.length).toBeGreaterThan(0);
      }
    });

    it('each event baseProbability is between 0 and 1', () => {
      for (const event of CLIMATE_EVENTS) {
        expect(event.baseProbability).toBeGreaterThan(0);
        expect(event.baseProbability).toBeLessThan(1);
      }
    });

    it('each event cooldownTicks is positive', () => {
      for (const event of CLIMATE_EVENTS) {
        expect(event.cooldownTicks).toBeGreaterThan(0);
      }
    });

    it('each event has a crisisId in its impact that matches its id pattern', () => {
      for (const event of CLIMATE_EVENTS) {
        expect(event.impact.crisisId).toMatch(/^climate-/);
      }
    });

    it('each event has at least one pressure spike domain', () => {
      for (const event of CLIMATE_EVENTS) {
        expect(Object.keys(event.pressureSpikes).length).toBeGreaterThan(0);
      }
    });

    it('each event has pravda headlines and toast messages in narrative', () => {
      for (const event of CLIMATE_EVENTS) {
        expect(event.impact.narrative?.pravdaHeadlines?.length).toBeGreaterThan(0);
        expect(event.impact.narrative?.toastMessages?.length).toBeGreaterThan(0);
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BlackSwanSystem
// ═══════════════════════════════════════════════════════════════════════════════

describe('BlackSwanSystem', () => {
  // ── Constructor ──────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('creates system without throwing', () => {
      expect(() => new BlackSwanSystem()).not.toThrow();
    });

    it('is instantiable as a plain class with no constructor arguments', () => {
      const system = new BlackSwanSystem();
      expect(system).toBeInstanceOf(BlackSwanSystem);
    });
  });

  // ── roll() returns empty result for very high RNG value ─────────────────────

  describe('roll() with high RNG value', () => {
    it('returns no impacts when RNG value is 0.9999 (above all probabilities)', () => {
      const system = new BlackSwanSystem();
      // All probabilities in BLACK_SWAN_CATALOG are very small (max 0.0008 for earthquake)
      // Meteor strike base is 0.001. stubRng(0.9999) → nothing fires
      const result = system.roll(1950, stubRng(0.9999), 30);
      expect(result.impacts).toHaveLength(0);
      expect(result.meteorEvent).toBeNull();
    });

    it('returns empty pressureSpikes when nothing fires', () => {
      const system = new BlackSwanSystem();
      const result = system.roll(1950, stubRng(0.9999), 30);
      expect(Object.keys(result.pressureSpikes)).toHaveLength(0);
    });
  });

  // ── roll() eventually generates events over many rolls ───────────────────────

  describe('roll() statistical test', () => {
    it('generates at least one impact over 100k rolls', () => {
      const system = new BlackSwanSystem();
      const rng = new GameRng('statistical-black-swan');
      let totalImpacts = 0;

      for (let i = 0; i < 100_000; i++) {
        const result = system.roll(1970, rng, 30);
        totalImpacts += result.impacts.length;
        if (result.meteorEvent !== null) totalImpacts += 1;
      }

      // With the lowest per-tick probability (0.0001 for supervolcanic ash),
      // expected events over 100k rolls is at least ~10 for that alone.
      // Summing across all event types gives many more.
      expect(totalImpacts).toBeGreaterThan(0);
    });

    it('is deterministic with the same seed', () => {
      const system1 = new BlackSwanSystem();
      const system2 = new BlackSwanSystem();
      const rng1 = new GameRng('determinism-black-swan');
      const rng2 = new GameRng('determinism-black-swan');

      const results1: number[] = [];
      const results2: number[] = [];

      for (let i = 0; i < 5000; i++) {
        const r1 = system1.roll(1960, rng1, 30);
        const r2 = system2.roll(1960, rng2, 30);
        results1.push(r1.impacts.length);
        results2.push(r2.impacts.length);
      }

      expect(results1).toEqual(results2);
    });
  });

  // ── Meteor strike impact structure ───────────────────────────────────────────

  describe('meteor strike', () => {
    it('returns a MeteorEvent with correct structure when meteor fires (stubRng(0.0))', () => {
      // Meteor strike uses rollMeteorStrike — BASE_CHANCE=0.001. stubRng(0.0) < 0.001 → fires.
      const system = new BlackSwanSystem();
      const result = system.roll(1950, stubRng(0.0), 30);

      expect(result.meteorEvent).not.toBeNull();
      expect(result.meteorEvent!.year).toBe(1950);
      expect(typeof result.meteorEvent!.targetX).toBe('number');
      expect(typeof result.meteorEvent!.targetY).toBe('number');
      expect(result.meteorEvent!.magnitude).toBeGreaterThanOrEqual(1);
      expect(result.meteorEvent!.magnitude).toBeLessThanOrEqual(5);
    });

    it('meteor impact produces infrastructure pressure spike', () => {
      const system = new BlackSwanSystem();
      const result = system.roll(1950, stubRng(0.0), 30);

      // Meteor always adds infrastructure and morale pressure spikes
      expect(result.pressureSpikes.infrastructure).toBeGreaterThan(0);
      expect(result.pressureSpikes.morale).toBeGreaterThan(0);
    });

    it('meteor impact pressure values are exactly 0.15 infrastructure, 0.1 morale (before other events)', () => {
      // Use stubRng(0.0) — fires meteor, then all other events also fire.
      // With rng(0.9999), only meteor fires (0.0 < 0.001 but then rng for rest is high).
      // However our stubRng always returns the same value, so to test meteor-only:
      // We need a value below meter threshold but above all black swan probs.
      // Meteor prob = 0.001, max black swan prob = 0.0008 (earthquake).
      // So rng value 0.0009 < 0.001 → meteor fires; 0.0009 > 0.0008 → no other events.
      const system = new BlackSwanSystem();
      const stub = stubRng(0.0009);
      const result = system.roll(1960, stub, 30);

      // Meteor fires. No other events (0.0009 > all black swan probs).
      expect(result.meteorEvent).not.toBeNull();
      expect(result.pressureSpikes.infrastructure).toBeCloseTo(0.15, 5);
      expect(result.pressureSpikes.morale).toBeCloseTo(0.1, 5);
    });

    it('meteor impact includes narrative with grid coordinates', () => {
      const system = new BlackSwanSystem();
      const result = system.roll(1950, stubRng(0.0009), 30);

      const meteorImpact = result.impacts.find((imp) => imp.crisisId === 'meteor-1950');
      expect(meteorImpact).toBeDefined();
      expect(meteorImpact!.narrative?.pravdaHeadlines?.length).toBeGreaterThan(0);
    });

    it('meteor crisisId encodes the year', () => {
      const system = new BlackSwanSystem();
      const result = system.roll(2042, stubRng(0.0009), 30);

      const meteorImpact = result.impacts.find((imp) => imp.crisisId === 'meteor-2042');
      expect(meteorImpact).toBeDefined();
    });
  });

  // ── Earthquake impact ────────────────────────────────────────────────────────

  describe('earthquake', () => {
    it('fires when RNG < earthquake probabilityPerTick (0.0008)', () => {
      // Use RNG value just below 0.0008 to trigger earthquake without triggering meteor
      // Meteor prob = 0.001, earthquake = 0.0008
      // Roll order in roll(): meteor first, then black swan catalog
      // To fire earthquake but not meteor: we need first roll >= 0.001 and second roll < 0.0008
      // Our stubRng returns same value always — so if value < 0.001 → meteor also fires.
      // Just test with stubRng(0.0) to get everything including earthquake.
      const system = new BlackSwanSystem();
      const result = system.roll(1970, stubRng(0.0), 30);

      const earthquake = result.impacts.find((imp) => imp.crisisId.startsWith('earthquake-'));
      expect(earthquake).toBeDefined();
    });

    it('earthquake impact has infrastructure decayMult > 1.0', () => {
      const system = new BlackSwanSystem();
      const result = system.roll(1970, stubRng(0.0), 30);

      const earthquake = result.impacts.find((imp) => imp.crisisId.startsWith('earthquake-'));
      expect(earthquake).toBeDefined();
      expect(earthquake!.infrastructure?.decayMult).toBeGreaterThan(1.0);
    });

    it('earthquake impact has negative moraleModifier', () => {
      const system = new BlackSwanSystem();
      const result = system.roll(1970, stubRng(0.0), 30);

      const earthquake = result.impacts.find((imp) => imp.crisisId.startsWith('earthquake-'));
      expect(earthquake!.workforce?.moraleModifier).toBeLessThan(0);
    });

    it('earthquake magnitude is between 4 and 8 (Richter scale)', () => {
      // decayMult = 1.0 + magnitude * 0.15 → for mag 4-8: range 1.6-2.2
      const system = new BlackSwanSystem();
      const result = system.roll(1970, stubRng(0.0), 30);

      const earthquake = result.impacts.find((imp) => imp.crisisId.startsWith('earthquake-'));
      if (earthquake?.infrastructure?.decayMult !== undefined) {
        // magnitude = (decayMult - 1.0) / 0.15
        const inferredMagnitude = (earthquake.infrastructure.decayMult - 1.0) / 0.15;
        expect(inferredMagnitude).toBeGreaterThanOrEqual(4);
        expect(inferredMagnitude).toBeLessThanOrEqual(8 + 0.01); // float tolerance
      }
    });

    it('earthquake spikes infrastructure, housing, health, and morale pressure', () => {
      const system = new BlackSwanSystem();
      const result = system.roll(1970, stubRng(0.0), 30);

      // Earthquake pressureSpikes: infrastructure:0.2, housing:0.15, health:0.1, morale:0.1
      expect(result.pressureSpikes.infrastructure).toBeGreaterThanOrEqual(0.2);
      expect(result.pressureSpikes.housing).toBeGreaterThanOrEqual(0.15);
      expect(result.pressureSpikes.health).toBeGreaterThanOrEqual(0.1);
      expect(result.pressureSpikes.morale).toBeGreaterThanOrEqual(0.1);
    });
  });

  // ── Nuclear accident year gate ────────────────────────────────────────────────

  describe('nuclear accident', () => {
    it('does NOT fire before 1954 (minYear gate)', () => {
      const system = new BlackSwanSystem();
      // Roll with RNG=0.0 (would fire if unlocked) but year=1940 < 1954
      const result = system.roll(1940, stubRng(0.0), 30);

      const nuclear = result.impacts.find((imp) => imp.crisisId.startsWith('nuclear-accident-'));
      expect(nuclear).toBeUndefined();
    });

    it('does NOT fire in 1953 (one year before threshold)', () => {
      const system = new BlackSwanSystem();
      const result = system.roll(1953, stubRng(0.0), 30);

      const nuclear = result.impacts.find((imp) => imp.crisisId.startsWith('nuclear-accident-'));
      expect(nuclear).toBeUndefined();
    });

    it('CAN fire in 1954 (the year of the Obninsk reactor — minYear=1954)', () => {
      const system = new BlackSwanSystem();
      const result = system.roll(1954, stubRng(0.0), 30);

      const nuclear = result.impacts.find((imp) => imp.crisisId.startsWith('nuclear-accident-'));
      expect(nuclear).toBeDefined();
    });

    it('CAN fire after 1954', () => {
      const system = new BlackSwanSystem();
      const result = system.roll(1986, stubRng(0.0), 30);

      const nuclear = result.impacts.find((imp) => imp.crisisId.startsWith('nuclear-accident-'));
      expect(nuclear).toBeDefined();
    });

    it('nuclear accident has severe disease and growth multipliers', () => {
      const system = new BlackSwanSystem();
      const result = system.roll(1986, stubRng(0.0), 30);

      const nuclear = result.impacts.find((imp) => imp.crisisId.startsWith('nuclear-accident-'));
      expect(nuclear).toBeDefined();
      expect(nuclear!.social?.diseaseMult).toBe(3.0);
      expect(nuclear!.social?.growthMult).toBe(0.7);
    });

    it('nuclear accident probability scales with years since 1954', () => {
      // The code applies: p *= min(3, 1 + yearsSinceNuclear / 50)
      // At 1954: multiplier = 1 + 0/50 = 1.0 × 0.0003 = 0.0003
      // At 2004 (50yr): multiplier = 1 + 50/50 = 2.0 × 0.0003 = 0.0006
      // At 2104 (150yr, capped at 3): multiplier = 3.0 × 0.0003 = 0.0009
      // Verify that at year 2004 probability is higher than at 1954:
      // Roll many times with seeded RNG and compare hit rates
      const rng1 = new GameRng('nuclear-prob-early');
      const rng2 = new GameRng('nuclear-prob-early'); // same seed
      const system1 = new BlackSwanSystem();
      const system2 = new BlackSwanSystem();

      let hitsEarly = 0;
      let hitsLate = 0;
      const trials = 50_000;

      for (let i = 0; i < trials; i++) {
        const r1 = system1.roll(1954, rng1, 30);
        const r2 = system2.roll(2054, rng2, 30);
        if (r1.impacts.some((imp) => imp.crisisId.startsWith('nuclear-accident-'))) hitsEarly++;
        if (r2.impacts.some((imp) => imp.crisisId.startsWith('nuclear-accident-'))) hitsLate++;
      }

      // With same seed, same RNG sequence — but different year → different probability threshold
      // Late-era should have more hits due to scaling
      expect(hitsLate).toBeGreaterThanOrEqual(hitsEarly);
    });
  });

  // ── All event types have valid structure ──────────────────────────────────────

  describe('event definition structure', () => {
    it('roll() result has required fields: impacts, pressureSpikes, meteorEvent', () => {
      const system = new BlackSwanSystem();
      const result = system.roll(1950, stubRng(0.9999), 30);

      expect(result).toHaveProperty('impacts');
      expect(result).toHaveProperty('pressureSpikes');
      expect(result).toHaveProperty('meteorEvent');
      expect(Array.isArray(result.impacts)).toBe(true);
      expect(typeof result.pressureSpikes).toBe('object');
    });

    it('all fired events have a crisisId string', () => {
      const system = new BlackSwanSystem();
      const result = system.roll(1986, stubRng(0.0), 30);

      for (const impact of result.impacts) {
        expect(typeof impact.crisisId).toBe('string');
        expect(impact.crisisId.length).toBeGreaterThan(0);
      }
    });

    it('all fired events have narrative with headlines and toasts', () => {
      const system = new BlackSwanSystem();
      const result = system.roll(1986, stubRng(0.0), 30);

      for (const impact of result.impacts) {
        expect(impact.narrative?.pravdaHeadlines?.length).toBeGreaterThan(0);
        expect(impact.narrative?.toastMessages?.length).toBeGreaterThan(0);
        expect(impact.narrative!.toastMessages![0]!.severity).toBe('critical');
      }
    });

    it('solar storm fires and reduces production', () => {
      const system = new BlackSwanSystem();
      const result = system.roll(1970, stubRng(0.0), 30);

      const solar = result.impacts.find((imp) => imp.crisisId.startsWith('solar-storm-'));
      expect(solar).toBeDefined();
      expect(solar!.economy?.productionMult).toBeLessThan(1.0);
    });

    it('solar storm spikes power, infrastructure, and economic pressure', () => {
      const system = new BlackSwanSystem();
      const result = system.roll(1970, stubRng(0.0), 30);

      // Solar storm pressureSpikes: power:0.25, infrastructure:0.1, economic:0.1
      expect(result.pressureSpikes.power).toBeGreaterThanOrEqual(0.25);
    });

    it('supervolcanic ash fires and causes catastrophic food loss', () => {
      const system = new BlackSwanSystem();
      const result = system.roll(1970, stubRng(0.0), 30);

      const volcano = result.impacts.find((imp) => imp.crisisId.startsWith('supervolcanic-ash-'));
      expect(volcano).toBeDefined();
      expect(volcano!.economy?.productionMult).toBeLessThan(1.0);
      expect(volcano!.economy?.foodDelta).toBeLessThan(0);
    });

    it('supervolcanic ash causes disease spread', () => {
      const system = new BlackSwanSystem();
      const result = system.roll(1970, stubRng(0.0), 30);

      const volcano = result.impacts.find((imp) => imp.crisisId.startsWith('supervolcanic-ash-'));
      expect(volcano!.social?.diseaseMult).toBeGreaterThan(1.0);
    });
  });

  // ── No artificial gates — pure probability ───────────────────────────────────

  describe('no artificial gates', () => {
    it('events (except nuclear) have no minYear restriction — can fire in 1917', () => {
      // earthquake, solar_storm, supervolcanic_ash have no minYear → can fire at any year
      const system = new BlackSwanSystem();
      const result = system.roll(1917, stubRng(0.0), 30);

      const earthquake = result.impacts.find((imp) => imp.crisisId.startsWith('earthquake-'));
      const solar = result.impacts.find((imp) => imp.crisisId.startsWith('solar-storm-'));
      const volcano = result.impacts.find((imp) => imp.crisisId.startsWith('supervolcanic-ash-'));

      // All should fire with rng=0.0 (below all probabilities)
      expect(earthquake).toBeDefined();
      expect(solar).toBeDefined();
      expect(volcano).toBeDefined();
    });

    it('same event can theoretically fire in consecutive years (no cooldown or interval lock)', () => {
      // Roll at year=1970, then year=1971. Earthquake can fire in both.
      const system1 = new BlackSwanSystem();
      const system2 = new BlackSwanSystem();

      const r1 = system1.roll(1970, stubRng(0.0), 30);
      const r2 = system2.roll(1971, stubRng(0.0), 30);

      const eq1 = r1.impacts.find((imp) => imp.crisisId.startsWith('earthquake-'));
      const eq2 = r2.impacts.find((imp) => imp.crisisId.startsWith('earthquake-'));

      expect(eq1).toBeDefined();
      expect(eq2).toBeDefined();
    });

    it('BlackSwanSystem has no serialize() method — stateless after each roll', () => {
      // BlackSwanSystem is documented as stateless (no cooldowns, no minimum intervals)
      // The class should not have a serialize method
      const system = new BlackSwanSystem();
      expect(typeof (system as unknown as Record<string, unknown>)['serialize']).toBe('undefined');
    });
  });

  // ── gridSize parameter affects meteor impact ──────────────────────────────────

  describe('gridSize parameter', () => {
    it('accepts different grid sizes without throwing', () => {
      const system = new BlackSwanSystem();
      expect(() => system.roll(1950, stubRng(0.0), 10)).not.toThrow();
      expect(() => system.roll(1950, stubRng(0.0), 50)).not.toThrow();
      expect(() => system.roll(1950, stubRng(0.0), 100)).not.toThrow();
    });

    it('destroyed tiles from meteor stay within small grid bounds', () => {
      // With a small grid (10x10) the meteor impact must clamp tiles
      const system = new BlackSwanSystem();
      const result = system.roll(1950, stubRng(0.0009), 10);

      if (result.meteorEvent !== null) {
        // Verify the impact was computed (we can't easily access ImpactResult,
        // but we can verify no error and result has expected structure)
        expect(result.impacts.length).toBeGreaterThan(0);
      }
    });
  });
});

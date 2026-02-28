/**
 * @module __tests__/WeatherGameplay
 *
 * Tests for weather gameplay effects: construction time modifier,
 * worker speed modifier, and farm output modifier across weather types.
 *
 * Verifies that WeatherProfile includes constructionTimeMult and
 * workerSpeedMult, and that these modifiers are wired into the
 * construction system and worker system via SimulationEngine.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { underConstruction } from '@/ecs/archetypes';
import { createMetaStore, createResourceStore, placeNewBuilding } from '@/ecs/factories';
import { constructionSystem, DEFAULT_BASE_TICKS } from '@/ecs/systems/constructionSystem';
import { world } from '@/ecs/world';
import { getWeatherProfile, WeatherType } from '@/game/WeatherSystem';

// ─────────────────────────────────────────────────────────
//  WeatherProfile modifier values
// ─────────────────────────────────────────────────────────

describe('WeatherProfile modifiers', () => {
  describe('clear weather has neutral modifiers', () => {
    it('farmModifier is 1.0', () => {
      const profile = getWeatherProfile(WeatherType.CLEAR);
      expect(profile.farmModifier).toBe(1.0);
    });

    it('constructionTimeMult is 1.0', () => {
      const profile = getWeatherProfile(WeatherType.CLEAR);
      expect(profile.constructionTimeMult).toBe(1.0);
    });

    it('workerSpeedMult is 1.0', () => {
      const profile = getWeatherProfile(WeatherType.CLEAR);
      expect(profile.workerSpeedMult).toBe(1.0);
    });
  });

  describe('blizzard reduces farm output and slows construction', () => {
    it('farmModifier is 0 (no farm production in blizzard)', () => {
      const profile = getWeatherProfile(WeatherType.BLIZZARD);
      expect(profile.farmModifier).toBe(0.0);
    });

    it('constructionTimeMult is 1.25 (+25% construction time)', () => {
      const profile = getWeatherProfile(WeatherType.BLIZZARD);
      expect(profile.constructionTimeMult).toBe(1.25);
    });

    it('workerSpeedMult is less than 1.0 (reduced worker speed)', () => {
      const profile = getWeatherProfile(WeatherType.BLIZZARD);
      expect(profile.workerSpeedMult).toBeLessThan(1.0);
    });
  });

  describe('heatwave (drought) reduces farm output', () => {
    it('farmModifier is 0.5 (-50% farm output)', () => {
      const profile = getWeatherProfile(WeatherType.HEATWAVE);
      expect(profile.farmModifier).toBe(0.5);
    });

    it('constructionTimeMult is close to neutral', () => {
      const profile = getWeatherProfile(WeatherType.HEATWAVE);
      // Heatwave doesn't significantly slow construction
      expect(profile.constructionTimeMult).toBeGreaterThanOrEqual(1.0);
      expect(profile.constructionTimeMult).toBeLessThanOrEqual(1.15);
    });
  });

  describe('mud storm (rasputitsa) slows construction and workers', () => {
    it('constructionTimeMult is 1.5 (+50% construction time)', () => {
      const profile = getWeatherProfile(WeatherType.MUD_STORM);
      expect(profile.constructionTimeMult).toBe(1.5);
    });

    it('workerSpeedMult is 0.8 (-20% worker speed)', () => {
      const profile = getWeatherProfile(WeatherType.MUD_STORM);
      expect(profile.workerSpeedMult).toBe(0.8);
    });
  });

  describe('all weather types have the new modifier fields', () => {
    for (const weatherType of Object.values(WeatherType)) {
      it(`${weatherType} has constructionTimeMult as a number`, () => {
        const profile = getWeatherProfile(weatherType);
        expect(typeof profile.constructionTimeMult).toBe('number');
        expect(profile.constructionTimeMult).toBeGreaterThan(0);
      });

      it(`${weatherType} has workerSpeedMult as a number`, () => {
        const profile = getWeatherProfile(weatherType);
        expect(typeof profile.workerSpeedMult).toBe('number');
        expect(profile.workerSpeedMult).toBeGreaterThan(0);
      });
    }
  });
});

// ─────────────────────────────────────────────────────────
//  Construction system integration with weather modifier
// ─────────────────────────────────────────────────────────

describe('constructionSystem with weather modifier', () => {
  beforeEach(() => {
    world.clear();
    // Provide abundant default resources so construction never pauses
    createResourceStore({ timber: 9999, steel: 9999, cement: 9999 });
    createMetaStore();
  });

  afterEach(() => {
    world.clear();
  });

  it('neutral weather (1.0) does not alter construction speed', () => {
    const entity = placeNewBuilding(0, 0, 'collective-farm-hq');
    expect(underConstruction.entities.length).toBe(1);

    // Run one tick with neutral era mult and neutral weather mult
    constructionSystem(1.0, 1.0);

    expect(entity.building!.constructionTicks).toBe(1);
    expect(entity.building!.constructionProgress).toBeCloseTo(1 / DEFAULT_BASE_TICKS, 6);
  });

  it('mud storm weather (+50%) increases effective construction time', () => {
    const entity = placeNewBuilding(0, 0, 'collective-farm-hq');

    // With weatherTimeMult=1.5 and eraTimeMult=1.0:
    // effectiveBaseTicks = ceil(15 * 1.0 * 1.5) = 23
    const effectiveBaseTicks = Math.ceil(DEFAULT_BASE_TICKS * 1.0 * 1.5);

    constructionSystem(1.0, 1.5);

    // Progress after 1 tick should be 1/23 ~ 0.043
    expect(entity.building!.constructionProgress).toBeCloseTo(1 / effectiveBaseTicks, 6);

    // Should NOT complete in DEFAULT_BASE_TICKS ticks
    for (let i = 1; i < DEFAULT_BASE_TICKS; i++) constructionSystem(1.0, 1.5);
    expect(entity.building!.constructionPhase).not.toBe('complete');

    // Should complete after effectiveBaseTicks total
    for (let i = DEFAULT_BASE_TICKS; i < effectiveBaseTicks; i++) constructionSystem(1.0, 1.5);
    expect(entity.building!.constructionPhase).toBe('complete');
  });

  it('blizzard weather (+25%) slows construction compared to clear', () => {
    const entity = placeNewBuilding(0, 0, 'collective-farm-hq');

    // With blizzard weather mult 1.25: effectiveBaseTicks = ceil(15 * 1.25) = 19
    const effectiveBaseTicks = Math.ceil(DEFAULT_BASE_TICKS * 1.25);

    constructionSystem(1.0, 1.25);

    // Progress = 1/19 ~ 0.053, which is less than 1/15 ~ 0.067
    expect(entity.building!.constructionProgress).toBeCloseTo(1 / effectiveBaseTicks, 6);
  });

  it('weather and era multipliers stack multiplicatively', () => {
    const entity = placeNewBuilding(0, 0, 'collective-farm-hq');

    // Era = 2.0, Weather = 1.5: effectiveBaseTicks = ceil(15 * 2.0 * 1.5) = 45
    const effectiveBaseTicks = Math.ceil(DEFAULT_BASE_TICKS * 2.0 * 1.5);

    constructionSystem(2.0, 1.5);

    expect(entity.building!.constructionProgress).toBeCloseTo(1 / effectiveBaseTicks, 6);
  });

  it('defaults to 1.0x weather multiplier when not provided', () => {
    const entity = placeNewBuilding(0, 0, 'collective-farm-hq');

    // Calling with only eraTimeMult should default weatherTimeMult to 1.0
    constructionSystem(1.0);

    expect(entity.building!.constructionProgress).toBeCloseTo(1 / DEFAULT_BASE_TICKS, 6);
  });
});

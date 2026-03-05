import {
  getParameterProfile,
  getProfileById,
  getProfileIds,
  PROFILE_EARTH_TEMPERATE,
  PROFILE_EARTH_ARCTIC,
  PROFILE_EARTH_DESERT,
  PROFILE_LUNAR,
  PROFILE_MARTIAN,
  PROFILE_VENUSIAN,
  PROFILE_TITAN,
  PROFILE_ASTEROID,
  PROFILE_ORBITAL,
  PROFILE_EXOPLANET,
  type AgentParameterProfile,
} from '../../src/game/engine/agentParameterMatrix';
import type { TerrainProfile } from '../../src/ai/agents/core/worldBranches';
import {
  TERRAIN_SIBERIA,
  TERRAIN_STEPPE,
  TERRAIN_ARCTIC,
  TERRAIN_LUNAR,
  TERRAIN_MARS,
  TERRAIN_TITAN,
  TERRAIN_EXOPLANET,
} from '../../src/game/relocation/terrainProfiles';

// ─── Profile resolution from TerrainProfile ─────────────────────────────────

describe('getParameterProfile', () => {
  it('maps Siberian terrain to earth_temperate', () => {
    const profile = getParameterProfile(TERRAIN_SIBERIA);
    expect(profile.id).toBe('earth_temperate');
    expect(profile.farmingMethod).toBe('soil');
    expect(profile.privatePlotsAvailable).toBe(true);
    expect(profile.hasWeather).toBe(true);
  });

  it('maps steppe terrain to earth_desert (high survival cost)', () => {
    const profile = getParameterProfile(TERRAIN_STEPPE);
    expect(profile.id).toBe('earth_desert');
    expect(profile.farmYieldMultiplier).toBeLessThan(1.0);
  });

  it('maps arctic terrain to earth_arctic', () => {
    const profile = getParameterProfile(TERRAIN_ARCTIC);
    expect(profile.id).toBe('earth_arctic');
    expect(profile.farmingMethod).toBe('greenhouse');
    expect(profile.warmingPolarity).toBe(-1); // warming helps arctic
  });

  it('maps lunar terrain to lunar', () => {
    const profile = getParameterProfile(TERRAIN_LUNAR);
    expect(profile.id).toBe('lunar');
    expect(profile.hasWeather).toBe(false);
    expect(profile.hasSeasons).toBe(false);
    expect(profile.climateModel).toBe('none');
    expect(profile.privatePlotsAvailable).toBe(false);
    expect(profile.farmingMethod).toBe('hydroponics');
    expect(profile.constructionType).toBe('pressurized_dome');
  });

  it('maps Mars terrain to martian', () => {
    const profile = getParameterProfile(TERRAIN_MARS);
    expect(profile.id).toBe('martian');
    expect(profile.farmingMethod).toBe('greenhouse');
    expect(profile.warmingPolarity).toBe(-1); // terraforming is good
    expect(profile.hasWeather).toBe(true);
    expect(profile.climateModel).toBe('mars');
  });

  it('maps Titan terrain to titan', () => {
    const profile = getParameterProfile(TERRAIN_TITAN);
    expect(profile.id).toBe('titan');
    expect(profile.farmingMethod).toBe('impossible');
    expect(profile.farmYieldMultiplier).toBe(0.0);
    expect(profile.atmosphericDecayRate).toBeGreaterThan(1.0);
  });

  it('maps exoplanet terrain to exoplanet', () => {
    const profile = getParameterProfile(TERRAIN_EXOPLANET);
    expect(profile.id).toBe('exoplanet');
    expect(profile.climateModel).toBe('custom');
    expect(profile.fusionAvailable).toBe(true);
  });
});

// ─── Profile properties ─────────────────────────────────────────────────────

describe('AgentParameterProfile properties', () => {
  const allProfiles: Readonly<AgentParameterProfile>[] = [
    PROFILE_EARTH_TEMPERATE,
    PROFILE_EARTH_ARCTIC,
    PROFILE_EARTH_DESERT,
    PROFILE_LUNAR,
    PROFILE_MARTIAN,
    PROFILE_VENUSIAN,
    PROFILE_TITAN,
    PROFILE_ASTEROID,
    PROFILE_ORBITAL,
    PROFILE_EXOPLANET,
  ];

  it('all profiles have unique ids', () => {
    const ids = allProfiles.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all profiles have farmYieldMultiplier in [0, 1.5]', () => {
    for (const p of allProfiles) {
      expect(p.farmYieldMultiplier).toBeGreaterThanOrEqual(0);
      expect(p.farmYieldMultiplier).toBeLessThanOrEqual(1.5);
    }
  });

  it('all profiles have solarEfficiency >= 0', () => {
    for (const p of allProfiles) {
      expect(p.solarEfficiency).toBeGreaterThanOrEqual(0);
    }
  });

  it('all profiles have constructionCostMultiplier >= 1', () => {
    for (const p of allProfiles) {
      expect(p.constructionCostMultiplier).toBeGreaterThanOrEqual(1.0);
    }
  });

  it('all profiles have gravityBirthRateModifier in (0, 1.5]', () => {
    for (const p of allProfiles) {
      expect(p.gravityBirthRateModifier).toBeGreaterThan(0);
      expect(p.gravityBirthRateModifier).toBeLessThanOrEqual(1.5);
    }
  });

  it('all profiles have radiationHealthModifier >= 1.0', () => {
    for (const p of allProfiles) {
      expect(p.radiationHealthModifier).toBeGreaterThanOrEqual(1.0);
    }
  });

  it('warming polarity is 1 or -1 for all profiles', () => {
    for (const p of allProfiles) {
      expect([1, -1]).toContain(p.warmingPolarity);
    }
  });
});

// ─── Food agent behavior differences ────────────────────────────────────────

describe('food agent parameter differences', () => {
  it('Earth soil has highest yield', () => {
    expect(PROFILE_EARTH_TEMPERATE.farmYieldMultiplier).toBeGreaterThan(
      PROFILE_MARTIAN.farmYieldMultiplier,
    );
    expect(PROFILE_EARTH_TEMPERATE.farmYieldMultiplier).toBeGreaterThan(
      PROFILE_LUNAR.farmYieldMultiplier,
    );
  });

  it('Moon uses hydroponics, not soil', () => {
    expect(PROFILE_LUNAR.farmingMethod).toBe('hydroponics');
    expect(PROFILE_EARTH_TEMPERATE.farmingMethod).toBe('soil');
  });

  it('Titan and Venus have impossible farming', () => {
    expect(PROFILE_TITAN.farmingMethod).toBe('impossible');
    expect(PROFILE_TITAN.farmYieldMultiplier).toBe(0);
    expect(PROFILE_VENUSIAN.farmingMethod).toBe('impossible');
    expect(PROFILE_VENUSIAN.farmYieldMultiplier).toBe(0);
  });

  it('private plots only available on Earth', () => {
    expect(PROFILE_EARTH_TEMPERATE.privatePlotsAvailable).toBe(true);
    expect(PROFILE_EARTH_ARCTIC.privatePlotsAvailable).toBe(true);
    expect(PROFILE_EARTH_DESERT.privatePlotsAvailable).toBe(true);
    expect(PROFILE_LUNAR.privatePlotsAvailable).toBe(false);
    expect(PROFILE_MARTIAN.privatePlotsAvailable).toBe(false);
    expect(PROFILE_TITAN.privatePlotsAvailable).toBe(false);
    expect(PROFILE_EXOPLANET.privatePlotsAvailable).toBe(false);
  });
});

// ─── Weather agent behavior differences ─────────────────────────────────────

describe('weather agent parameter differences', () => {
  it('Moon has no weather', () => {
    expect(PROFILE_LUNAR.hasWeather).toBe(false);
    expect(PROFILE_LUNAR.hasSeasons).toBe(false);
    expect(PROFILE_LUNAR.climateModel).toBe('none');
  });

  it('asteroid and orbital have no weather', () => {
    expect(PROFILE_ASTEROID.hasWeather).toBe(false);
    expect(PROFILE_ORBITAL.hasWeather).toBe(false);
  });

  it('Earth and Mars have weather and seasons', () => {
    expect(PROFILE_EARTH_TEMPERATE.hasWeather).toBe(true);
    expect(PROFILE_EARTH_TEMPERATE.hasSeasons).toBe(true);
    expect(PROFILE_MARTIAN.hasWeather).toBe(true);
    expect(PROFILE_MARTIAN.hasSeasons).toBe(true);
  });

  it('Mars uses mars climate model', () => {
    expect(PROFILE_MARTIAN.climateModel).toBe('mars');
  });

  it('Titan uses titan climate model', () => {
    expect(PROFILE_TITAN.climateModel).toBe('titan');
  });
});

// ─── Decay agent behavior differences ───────────────────────────────────────

describe('decay agent parameter differences', () => {
  it('Titan has highest atmospheric decay (corrosive)', () => {
    expect(PROFILE_TITAN.atmosphericDecayRate).toBeGreaterThan(
      PROFILE_EARTH_TEMPERATE.atmosphericDecayRate,
    );
  });

  it('Venus has extreme atmospheric decay', () => {
    expect(PROFILE_VENUSIAN.atmosphericDecayRate).toBe(3.0);
  });

  it('vacuum worlds have lowest atmospheric decay', () => {
    expect(PROFILE_LUNAR.atmosphericDecayRate).toBeLessThan(0.2);
    expect(PROFILE_ASTEROID.atmosphericDecayRate).toBeLessThan(0.1);
    expect(PROFILE_ORBITAL.atmosphericDecayRate).toBeLessThan(0.1);
  });

  it('Moon has radiation decay bonus (no magnetosphere)', () => {
    expect(PROFILE_LUNAR.radiationDecayBonus).toBeGreaterThan(0);
    expect(PROFILE_EARTH_TEMPERATE.radiationDecayBonus).toBe(0);
  });

  it('combined decay on Moon = atmospheric + radiation', () => {
    const totalLunar = PROFILE_LUNAR.atmosphericDecayRate + PROFILE_LUNAR.radiationDecayBonus;
    // Even with low atmosphere, radiation adds up
    expect(totalLunar).toBeGreaterThan(PROFILE_LUNAR.atmosphericDecayRate);
  });
});

// ─── Demographics parameter differences ─────────────────────────────────────

describe('demographic parameter differences', () => {
  it('low gravity reduces birth rate', () => {
    expect(PROFILE_LUNAR.gravityBirthRateModifier).toBeLessThan(
      PROFILE_EARTH_TEMPERATE.gravityBirthRateModifier,
    );
    expect(PROFILE_ASTEROID.gravityBirthRateModifier).toBeLessThan(
      PROFILE_LUNAR.gravityBirthRateModifier,
    );
  });

  it('no atmosphere increases radiation health modifier', () => {
    expect(PROFILE_LUNAR.radiationHealthModifier).toBeGreaterThan(
      PROFILE_EARTH_TEMPERATE.radiationHealthModifier,
    );
    expect(PROFILE_ASTEROID.radiationHealthModifier).toBeGreaterThan(
      PROFILE_LUNAR.radiationHealthModifier,
    );
  });

  it('thick atmosphere protects from radiation', () => {
    // Titan and Venus have thick atmospheres — radiation is not an issue
    expect(PROFILE_TITAN.radiationHealthModifier).toBe(1.0);
    expect(PROFILE_VENUSIAN.radiationHealthModifier).toBe(1.0);
  });
});

// ─── Construction parameter differences ─────────────────────────────────────

describe('construction parameter differences', () => {
  it('Earth uses standard construction', () => {
    expect(PROFILE_EARTH_TEMPERATE.constructionType).toBe('standard');
    expect(PROFILE_EARTH_TEMPERATE.constructionCostMultiplier).toBe(1.0);
  });

  it('off-world has higher construction costs', () => {
    expect(PROFILE_LUNAR.constructionCostMultiplier).toBeGreaterThan(2.0);
    expect(PROFILE_MARTIAN.constructionCostMultiplier).toBeGreaterThan(1.5);
    expect(PROFILE_TITAN.constructionCostMultiplier).toBeGreaterThan(3.0);
  });

  it('asteroid uses underground construction', () => {
    expect(PROFILE_ASTEROID.constructionType).toBe('underground');
  });

  it('orbital uses orbital construction', () => {
    expect(PROFILE_ORBITAL.constructionType).toBe('orbital');
  });
});

// ─── Climate polarity ───────────────────────────────────────────────────────

describe('warming polarity', () => {
  it('Earth temperate: warming is bad', () => {
    expect(PROFILE_EARTH_TEMPERATE.warmingPolarity).toBe(1);
  });

  it('Mars: warming is good (terraforming)', () => {
    expect(PROFILE_MARTIAN.warmingPolarity).toBe(-1);
  });

  it('Arctic: warming is good', () => {
    expect(PROFILE_EARTH_ARCTIC.warmingPolarity).toBe(-1);
  });

  it('Titan: warming is good (cryogenic world)', () => {
    expect(PROFILE_TITAN.warmingPolarity).toBe(-1);
  });
});

// ─── Profile registry ───────────────────────────────────────────────────────

describe('profile registry', () => {
  it('getProfileById returns correct profile', () => {
    expect(getProfileById('lunar')).toBe(PROFILE_LUNAR);
    expect(getProfileById('martian')).toBe(PROFILE_MARTIAN);
    expect(getProfileById('earth_temperate')).toBe(PROFILE_EARTH_TEMPERATE);
  });

  it('getProfileById returns undefined for unknown id', () => {
    expect(getProfileById('pluto')).toBeUndefined();
  });

  it('getProfileIds returns all 10 profiles', () => {
    const ids = getProfileIds();
    expect(ids).toHaveLength(10);
    expect(ids).toContain('earth_temperate');
    expect(ids).toContain('lunar');
    expect(ids).toContain('martian');
    expect(ids).toContain('titan');
    expect(ids).toContain('exoplanet');
  });
});

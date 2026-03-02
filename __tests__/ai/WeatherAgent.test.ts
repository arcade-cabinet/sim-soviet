import { WeatherAgent } from '../../src/ai/agents/core/WeatherAgent';
import { WeatherType } from '../../src/ai/agents/core/weather-types';
import { GameRng } from '../../src/game/SeedSystem';
import { Season } from '../../src/game/Chronology';

function makeRng(seed = 'test-seed'): GameRng {
  return new GameRng(seed);
}

describe('WeatherAgent', () => {
  it('is instantiated with default overcast weather', () => {
    const agent = new WeatherAgent();
    expect(agent.name).toBe('WeatherAgent');
    expect(agent.getCurrentWeather()).toBe(WeatherType.OVERCAST);
    expect(agent.getDaysRemaining()).toBe(1);
  });

  it('rolls a valid weather type for WINTER', () => {
    const agent = new WeatherAgent();
    const rng = makeRng('winter-test');
    agent.rollWeather(Season.WINTER, rng);
    const validWinter = [
      WeatherType.SNOW,
      WeatherType.BLIZZARD,
      WeatherType.OVERCAST,
      WeatherType.CLEAR,
      WeatherType.FOG,
    ];
    expect(validWinter).toContain(agent.getCurrentWeather());
  });

  it('rolls a valid weather type for RASPUTITSA_SPRING', () => {
    const agent = new WeatherAgent();
    const rng = makeRng('spring-test');
    agent.rollWeather(Season.RASPUTITSA_SPRING, rng);
    const validSpring = [
      WeatherType.RAIN,
      WeatherType.MUD_STORM,
      WeatherType.OVERCAST,
      WeatherType.FOG,
      WeatherType.CLEAR,
    ];
    expect(validSpring).toContain(agent.getCurrentWeather());
  });

  it('rolls a valid weather type for SHORT_SUMMER', () => {
    const agent = new WeatherAgent();
    const rng = makeRng('summer-test');
    agent.rollWeather(Season.SHORT_SUMMER, rng);
    const validSummer = [
      WeatherType.CLEAR,
      WeatherType.OVERCAST,
      WeatherType.RAIN,
      WeatherType.MIRACULOUS_SUN,
      WeatherType.FOG,
    ];
    expect(validSummer).toContain(agent.getCurrentWeather());
  });

  it('rolls a valid weather type for STIFLING_HEAT', () => {
    const agent = new WeatherAgent();
    const rng = makeRng('heat-test');
    agent.rollWeather(Season.STIFLING_HEAT, rng);
    const validHeat = [
      WeatherType.HEATWAVE,
      WeatherType.CLEAR,
      WeatherType.OVERCAST,
      WeatherType.MIRACULOUS_SUN,
      WeatherType.RAIN,
      WeatherType.FOG,
    ];
    expect(validHeat).toContain(agent.getCurrentWeather());
  });

  it('rolls a valid weather type for EARLY_FROST', () => {
    const agent = new WeatherAgent();
    const rng = makeRng('frost-test');
    agent.rollWeather(Season.EARLY_FROST, rng);
    const validFrost = [
      WeatherType.OVERCAST,
      WeatherType.SNOW,
      WeatherType.RAIN,
      WeatherType.CLEAR,
      WeatherType.FOG,
    ];
    expect(validFrost).toContain(agent.getCurrentWeather());
  });

  it('rolls a valid weather type for RASPUTITSA_AUTUMN', () => {
    const agent = new WeatherAgent();
    const rng = makeRng('autumn-test');
    agent.rollWeather(Season.RASPUTITSA_AUTUMN, rng);
    const validAutumn = [
      WeatherType.RAIN,
      WeatherType.MUD_STORM,
      WeatherType.OVERCAST,
      WeatherType.FOG,
      WeatherType.SNOW,
    ];
    expect(validAutumn).toContain(agent.getCurrentWeather());
  });

  it('rolls a valid weather type for GOLDEN_WEEK', () => {
    const agent = new WeatherAgent();
    const rng = makeRng('golden-test');
    agent.rollWeather(Season.GOLDEN_WEEK, rng);
    const validGolden = [
      WeatherType.CLEAR,
      WeatherType.MIRACULOUS_SUN,
      WeatherType.OVERCAST,
      WeatherType.RAIN,
      WeatherType.HEATWAVE,
    ];
    expect(validGolden).toContain(agent.getCurrentWeather());
  });

  it('daysRemaining is within minDuration..maxDuration after roll', () => {
    // Run many rolls and verify duration is always within valid range for all weather types
    for (let i = 0; i < 50; i++) {
      const agent = new WeatherAgent();
      const rng = makeRng(`duration-seed-${i}`);
      agent.rollWeather(Season.SHORT_SUMMER, rng);
      const profile = agent.getWeatherProfile();
      expect(agent.getDaysRemaining()).toBeGreaterThanOrEqual(profile.minDuration);
      expect(agent.getDaysRemaining()).toBeLessThanOrEqual(profile.maxDuration);
    }
  });

  it('decrements daysRemaining by 1 per onDayTick when not expired', () => {
    const agent = new WeatherAgent();
    const rng = makeRng('decrement-test');
    // Force a known multi-day weather by directly restoring snapshot
    agent.restore({ currentWeather: WeatherType.HEATWAVE, daysRemaining: 3 });

    agent.onDayTick(Season.STIFLING_HEAT, rng);
    expect(agent.getDaysRemaining()).toBe(2);
    expect(agent.getCurrentWeather()).toBe(WeatherType.HEATWAVE);
  });

  it('rolls new weather when daysRemaining reaches 0', () => {
    const agent = new WeatherAgent();
    const rng = makeRng('expiry-test');
    agent.restore({ currentWeather: WeatherType.BLIZZARD, daysRemaining: 1 });

    agent.onDayTick(Season.WINTER, rng);
    // After tick, new weather rolled — daysRemaining will be >= 1
    expect(agent.getDaysRemaining()).toBeGreaterThanOrEqual(1);
  });

  it('BLIZZARD profile has farmModifier=0', () => {
    const agent = new WeatherAgent();
    agent.restore({ currentWeather: WeatherType.BLIZZARD, daysRemaining: 1 });
    const profile = agent.getWeatherProfile();
    expect(profile.farmModifier).toBe(0);
  });

  it('MIRACULOUS_SUN profile has farmModifier=2.0', () => {
    const agent = new WeatherAgent();
    agent.restore({ currentWeather: WeatherType.MIRACULOUS_SUN, daysRemaining: 1 });
    const profile = agent.getWeatherProfile();
    expect(profile.farmModifier).toBe(2.0);
  });

  it('BLIZZARD profile has high snowRateModifier and low workerSpeedMult', () => {
    const agent = new WeatherAgent();
    agent.restore({ currentWeather: WeatherType.BLIZZARD, daysRemaining: 1 });
    const profile = agent.getWeatherProfile();
    expect(profile.snowRateModifier).toBe(200);
    expect(profile.workerSpeedMult).toBe(0.7);
    expect(profile.constructionTimeMult).toBe(1.25);
  });

  it('RAIN profile has hasRain=true and farmModifier=1.2', () => {
    const agent = new WeatherAgent();
    agent.restore({ currentWeather: WeatherType.RAIN, daysRemaining: 1 });
    const profile = agent.getWeatherProfile();
    expect(profile.hasRain).toBe(true);
    expect(profile.farmModifier).toBe(1.2);
  });

  it('MIRACULOUS_SUN profile has workerSpeedMult > 1.0', () => {
    const agent = new WeatherAgent();
    agent.restore({ currentWeather: WeatherType.MIRACULOUS_SUN, daysRemaining: 1 });
    const profile = agent.getWeatherProfile();
    expect(profile.workerSpeedMult).toBe(1.1);
    expect(profile.constructionTimeMult).toBe(0.9);
  });

  it('serialization round-trip preserves weather and duration', () => {
    const agent = new WeatherAgent();
    agent.restore({ currentWeather: WeatherType.FOG, daysRemaining: 2 });

    const snapshot = agent.serialize();
    expect(snapshot.currentWeather).toBe(WeatherType.FOG);
    expect(snapshot.daysRemaining).toBe(2);

    const agent2 = new WeatherAgent();
    agent2.restore(snapshot);
    expect(agent2.getCurrentWeather()).toBe(WeatherType.FOG);
    expect(agent2.getDaysRemaining()).toBe(2);
  });

  it('serialization round-trip with onDayTick produces identical results', () => {
    const agent1 = new WeatherAgent();
    agent1.restore({ currentWeather: WeatherType.SNOW, daysRemaining: 1 });

    const agent2 = new WeatherAgent();
    agent2.restore(agent1.serialize());

    const rng1 = makeRng('sync-rng');
    const rng2 = makeRng('sync-rng');

    agent1.onDayTick(Season.WINTER, rng1);
    agent2.onDayTick(Season.WINTER, rng2);

    expect(agent1.getCurrentWeather()).toBe(agent2.getCurrentWeather());
    expect(agent1.getDaysRemaining()).toBe(agent2.getDaysRemaining());
  });
});

import { MSG } from '../../src/ai/telegrams';

describe('telegrams', () => {
  it('exports all expected message type constants', () => {
    const expectedKeys = [
      'NEW_MONTH', 'NEW_YEAR', 'NEW_SEASON',
      'WEATHER_CHANGED', 'WINTER_APPROACHING', 'STORM_WARNING',
      'POWER_SHORTAGE', 'BUILDING_UNPOWERED',
      'FOOD_SHORTAGE', 'STARVATION_WARNING', 'FOOD_SURPLUS',
      'VODKA_SHORTAGE', 'MORALE_BOOST',
      'TRUDODNI_SHORTFALL', 'BLAT_OPPORTUNITY', 'REFORM_AVAILABLE',
      'STORAGE_FULL', 'FOOD_SPOILED',
      'BUILDING_PLACED', 'WORKER_ASSIGNED', 'DEMAND_UNMET',
      'LABOR_SHORTAGE', 'LABOR_SURPLUS', 'POPULATION_MILESTONE',
      'INSPECTION_IMMINENT', 'MARKS_INCREASED', 'ARREST_WARRANT',
      'ERA_TRANSITION', 'QUOTA_DEADLINE', 'PLAN_UPDATED', 'ANNUAL_REPORT_DUE',
      'EMERGENCY_FIRE', 'EMERGENCY_METEOR', 'DISEASE_OUTBREAK',
      'DVOR_DISLOYAL', 'SABOTAGE_EVENT', 'FLIGHT_RISK',
      'SET_FOCUS', 'OFFER_BRIBE', 'MINIGAME_RESOLVED', 'REPORT_SUBMITTED',
    ];

    for (const key of expectedKeys) {
      expect(MSG).toHaveProperty(key);
    }

    expect(Object.keys(MSG)).toHaveLength(expectedKeys.length);
  });

  it('all message types are string constants with key === value', () => {
    for (const [key, value] of Object.entries(MSG)) {
      expect(typeof value).toBe('string');
      expect(value).toBe(key);
    }
  });
});

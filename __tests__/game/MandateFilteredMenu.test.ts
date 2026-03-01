import {
  filterBuildingsForMenu,
  type MenuBuildingFilter,
} from '@/game/menuFilter';

describe('Mandate-Filtered Build Menu', () => {
  it('returns only buildings from unfulfilled mandates', () => {
    const filter: MenuBuildingFilter = {
      mandatedDefIds: ['workers-house-a', 'power-station'],
      demandedDefIds: [],
      eraAvailableDefIds: [
        'workers-house-a',
        'power-station',
        'factory-office',
        'gulag-admin',
      ],
    };

    const result = filterBuildingsForMenu(filter);
    expect(result).toContain('workers-house-a');
    expect(result).toContain('power-station');
    expect(result).not.toContain('factory-office');
    expect(result).not.toContain('gulag-admin');
  });

  it('includes demand-driven buildings not in mandates', () => {
    const filter: MenuBuildingFilter = {
      mandatedDefIds: ['power-station'],
      demandedDefIds: ['collective-farm-hq'],
      eraAvailableDefIds: [
        'workers-house-a',
        'power-station',
        'collective-farm-hq',
      ],
    };

    const result = filterBuildingsForMenu(filter);
    expect(result).toContain('power-station');
    expect(result).toContain('collective-farm-hq');
    expect(result.length).toBe(2);
  });

  it('returns empty when all mandates fulfilled and no demands', () => {
    const filter: MenuBuildingFilter = {
      mandatedDefIds: [],
      demandedDefIds: [],
      eraAvailableDefIds: ['workers-house-a', 'power-station'],
    };

    const result = filterBuildingsForMenu(filter);
    expect(result.length).toBe(0);
  });
});

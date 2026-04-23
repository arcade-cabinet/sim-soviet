import coldBranchesConfig from '../../src/config/coldBranches.json';
import erasConfig from '../../src/config/eras.json';
import politicalConfig from '../../src/config/political.json';
import prestigeConfig from '../../src/config/prestige.json';
import worldConfig from '../../src/config/world.json';
import { ERA_DEFINITIONS, ERA_ORDER, eraIndexForYear } from '../../src/game/era/definitions';
import type { NewGameConfig } from '../../src/ui/NewGameSetup';

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
    return out;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      out.push(key);
      collectStrings(child, out);
    }
  }
  return out;
}

describe('historical 1.0 campaign scope', () => {
  it('new game config has no mode selector surface', () => {
    const config: NewGameConfig = { consequence: 'gulag', seed: 'scope-test' };
    expect(Object.keys(config).sort()).toEqual(['consequence', 'seed']);
  });

  it('era order ends with the 1991 stagnation and dissolution era', () => {
    expect(ERA_ORDER).toEqual([
      'revolution',
      'collectivization',
      'industrialization',
      'great_patriotic',
      'reconstruction',
      'thaw_and_freeze',
      'stagnation',
    ]);
    expect(ERA_DEFINITIONS.stagnation.endYear).toBe(1991);
    expect(ERA_ORDER[eraIndexForYear(1991)]).toBe('stagnation');
    expect(ERA_ORDER[eraIndexForYear(2050)]).toBe('stagnation');
  });

  it('runtime campaign configs do not expose removed future scope ids', () => {
    const removedEraSuffix = String.fromCharCode(101, 116, 101, 114, 110, 97, 108);
    const removedIds = [
      `the_${removedEraSuffix}`,
      'post' + '_soviet',
      'planet' + 'ary',
      'solar' + '_engineering',
      'type' + '_one',
      'decon' + 'struction',
      'dyson' + '_swarm',
      'mega' + 'earth',
      'type' + '_two_peak',
      'rocket' + 'Fuel',
      'hydro' + 'gen',
      'rare' + 'Earths',
      'uran' + 'ium',
      'security' + '_services',
      'sector' + '_judges',
      'mega' + 'city' + '_arbiters',
      'iso' + 'CubeCapacity',
      'iso' + 'CubeLaborEfficiency',
      'under' + 'cityDecayRate',
    ];
    const strings = collectStrings([erasConfig, coldBranchesConfig, politicalConfig, prestigeConfig, worldConfig]);
    for (const removedId of removedIds) {
      expect(strings).not.toContain(removedId);
    }
  });

  it('historical pressure branches are same-settlement only', () => {
    expect(coldBranchesConfig.map((branch) => branch.id)).toEqual([
      'dekulakization_purge',
      'ethnic_deportation',
      'virgin_lands_assignment',
    ]);
    const strings = collectStrings(coldBranchesConfig);
    expect(strings).not.toContain('newSettlement');
    expect(strings).not.toContain('mars_colonization');
    expect(strings).not.toContain('ai_singularity');
    expect(strings).not.toContain('wwiii');
  });

  it('world backdrop config does not schedule post-1991 global expansion', () => {
    for (const country of worldConfig.startingCountries) {
      if ('mergeYear' in country) {
        expect(country.mergeYear).toBeLessThanOrEqual(1991);
      }
    }
    expect(worldConfig.sphereIds).not.toContain('corporate');
  });
});

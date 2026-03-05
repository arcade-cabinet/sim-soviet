import { classifyBuilding } from '../../src/config/buildingClassification';

describe('Building Classification', () => {
  it('classifies power stations as power_water', () => {
    expect(classifyBuilding('power-station')).toBe('power_water');
  });
  it('classifies housing', () => {
    expect(classifyBuilding('apartment-tower-a')).toBe('housing');
    expect(classifyBuilding('workers-house-a')).toBe('housing');
  });
  it('classifies farms', () => {
    expect(classifyBuilding('collective-farm-hq')).toBe('farms');
  });
  it('classifies government', () => {
    expect(classifyBuilding('government-hq')).toBe('government');
    expect(classifyBuilding('party-office')).toBe('government');
  });
  it('classifies military', () => {
    expect(classifyBuilding('militia-post')).toBe('military');
    expect(classifyBuilding('barracks')).toBe('military');
  });
  it('classifies industry', () => {
    expect(classifyBuilding('vodka-distillery')).toBe('industry');
    expect(classifyBuilding('warehouse')).toBe('industry');
  });
  it('defaults unknown to industry', () => {
    expect(classifyBuilding('some-unknown-building')).toBe('industry');
  });
});

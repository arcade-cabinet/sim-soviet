import {
  computeCrimeRate,
  createLawEnforcementState,
  getEnforcementMode,
  tickLawEnforcement,
} from '../../src/ai/agents/political/LawEnforcementSystem';

describe('LawEnforcementSystem historical scope', () => {
  it('keeps every historical era on the KGB/local patrol model', () => {
    expect(getEnforcementMode('revolution')).toBe('kgb');
    expect(getEnforcementMode('collectivization')).toBe('kgb');
    expect(getEnforcementMode('industrialization')).toBe('kgb');
    expect(getEnforcementMode('great_patriotic')).toBe('kgb');
    expect(getEnforcementMode('reconstruction')).toBe('kgb');
    expect(getEnforcementMode('thaw_and_freeze')).toBe('kgb');
    expect(getEnforcementMode('stagnation')).toBe('kgb');
  });

  it('derives crime pressure from grounded settlement conditions', () => {
    const stable = computeCrimeRate({
      baseCrime: 0.05,
      densityPressure: 0.1,
      employmentRate: 0.95,
      morale: 80,
      inequalityIndex: 0,
      judgeCoverage: 0.8,
    });
    const strained = computeCrimeRate({
      baseCrime: 0.05,
      densityPressure: 0.9,
      employmentRate: 0.25,
      morale: 20,
      inequalityIndex: 0.7,
      judgeCoverage: 0.1,
    });

    expect(strained).toBeGreaterThan(stable);
    expect(strained).toBeGreaterThan(0);
    expect(strained).toBeLessThanOrEqual(1);
  });

  it('ticks one historical settlement sector without future enforcement modes', () => {
    const next = tickLawEnforcement(createLawEnforcementState(), {
      era: 'stagnation',
      population: 25_000,
      habitableArea: 12,
      employmentRate: 0.7,
      morale: 45,
      inequalityIndex: 0.2,
      densityPressure: 0.4,
      infrastructurePressure: 0.3,
    });

    expect(next.mode).toBe('kgb');
    expect(next.sectors).toHaveLength(1);
    expect(next.aggregateCrimeRate).toBeGreaterThanOrEqual(0);
    expect(next.totalDetainedPopulation).toBe(0);
    expect(next.totalPenalLabor).toBe(0);
  });
});

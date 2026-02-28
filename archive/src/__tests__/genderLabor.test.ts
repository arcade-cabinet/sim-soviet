import { describe, expect, it } from 'vitest';
import { getGenderLaborConfig, getGenderLaborMultiplier } from '../game/workers/genderLabor';

describe('genderLabor', () => {
  it('returns 1.0 for male workers', () => {
    expect(getGenderLaborMultiplier('male', 'industry', 'wartime')).toBe(1.0);
  });

  it('returns 1.0 for undefined gender', () => {
    expect(getGenderLaborMultiplier(undefined, 'industry', 'wartime')).toBe(1.0);
  });

  it('applies female heavy industry penalty in revolution era', () => {
    expect(getGenderLaborMultiplier('female', 'industry', 'revolution')).toBe(0.7);
  });

  it('applies full equality in wartime', () => {
    expect(getGenderLaborMultiplier('female', 'industry', 'wartime')).toBe(1.0);
  });

  it('applies female services bonus in thaw', () => {
    expect(getGenderLaborMultiplier('female', 'services', 'thaw')).toBe(1.3);
  });

  it('returns default config for unknown era', () => {
    const config = getGenderLaborConfig('unknown_era');
    expect(config.femaleHeavyIndustry).toBe(0.7);
  });

  it('allows female military in wartime', () => {
    expect(getGenderLaborConfig('wartime').femalesMilitary).toBe(true);
  });

  it('disallows female military in peacetime', () => {
    expect(getGenderLaborConfig('thaw').femalesMilitary).toBe(false);
  });
});

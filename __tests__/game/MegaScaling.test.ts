import { getMaxBuildingTier, getScaleFactor, MEGA_SCALING_TIERS } from '../../src/config/megaScaling';

describe('Mega Scaling', () => {
  it('revolution era allows only base tier', () => {
    expect(getMaxBuildingTier('revolution')).toBe(0);
    expect(getScaleFactor(0)).toBe(1);
  });
  it('collectivization unlocks tier 1 (×10)', () => {
    expect(getMaxBuildingTier('collectivization')).toBe(1);
    expect(getScaleFactor(1)).toBe(10);
  });
  it('industrialization unlocks tier 2 (×100)', () => {
    expect(getMaxBuildingTier('industrialization')).toBe(2);
    expect(getScaleFactor(2)).toBe(100);
  });
  it('reconstruction unlocks tier 3 (×1000)', () => {
    expect(getMaxBuildingTier('reconstruction')).toBe(3);
    expect(getScaleFactor(3)).toBe(1000);
  });
  it('stagnation unlocks tier 4 (×10000)', () => {
    expect(getMaxBuildingTier('stagnation')).toBe(4);
    expect(getScaleFactor(4)).toBe(10000);
  });
  it('eternal unlocks tier 5+ (×100000)', () => {
    expect(getMaxBuildingTier('the_eternal')).toBe(5);
    expect(getScaleFactor(5)).toBe(100000);
  });
  it('unknown era defaults to 0', () => { expect(getMaxBuildingTier('unknown')).toBe(0); });
});

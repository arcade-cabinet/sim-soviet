import { getLandGrantRadius, LAND_GRANT_TIERS } from '../../src/config/landGrants';

describe('Land Grants', () => {
  it('selo gets radius 15', () => { expect(getLandGrantRadius('selo')).toBe(15); });
  it('posyolok gets radius 30', () => { expect(getLandGrantRadius('posyolok')).toBe(30); });
  it('pgt gets radius 60', () => { expect(getLandGrantRadius('pgt')).toBe(60); });
  it('gorod gets radius 120', () => { expect(getLandGrantRadius('gorod')).toBe(120); });
  it('unknown tier falls back to selo', () => { expect(getLandGrantRadius('unknown' as never)).toBe(15); });
  it('all tiers are defined', () => { expect(Object.keys(LAND_GRANT_TIERS)).toHaveLength(4); });
});

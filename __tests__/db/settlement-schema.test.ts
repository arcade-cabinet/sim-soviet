// __tests__/db/settlement-schema.test.ts
import { settlementState } from '../../src/db/settlement';

describe('settlement_state schema', () => {
  it('has required columns', () => {
    const cols = Object.keys(settlementState);
    expect(cols).toContain('population');
    expect(cols).toContain('totalBuildings');
    expect(cols).toContain('era');
    expect(cols).toContain('year');
    expect(cols).toContain('month');
    expect(cols).toContain('landGrantRadius');
  });
});

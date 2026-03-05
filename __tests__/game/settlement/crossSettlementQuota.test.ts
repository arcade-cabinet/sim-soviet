import {
  computeCrossSettlementQuota,
  type SettlementQuotaInput,
} from '../../../src/game/settlement/crossSettlementQuota';

describe('Cross-settlement quota', () => {
  it('sums food production across all settlements', () => {
    const inputs: SettlementQuotaInput[] = [
      { settlementId: 'primary', foodProduced: 500, vodkaProduced: 100 },
      { settlementId: 'settlement-1', foodProduced: 300, vodkaProduced: 50 },
    ];
    const result = computeCrossSettlementQuota(inputs, 'food');
    expect(result).toBe(800);
  });

  it('sums vodka production when quota type is vodka', () => {
    const inputs: SettlementQuotaInput[] = [
      { settlementId: 'primary', foodProduced: 500, vodkaProduced: 100 },
      { settlementId: 'settlement-1', foodProduced: 300, vodkaProduced: 200 },
    ];
    const result = computeCrossSettlementQuota(inputs, 'vodka');
    expect(result).toBe(300);
  });

  it('returns 0 for empty inputs', () => {
    expect(computeCrossSettlementQuota([], 'food')).toBe(0);
  });

  it('handles single settlement (backward compat)', () => {
    const inputs: SettlementQuotaInput[] = [
      { settlementId: 'primary', foodProduced: 1000, vodkaProduced: 200 },
    ];
    expect(computeCrossSettlementQuota(inputs, 'food')).toBe(1000);
  });
});

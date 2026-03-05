import {
  computeTransferResult,
  type TransferRequest,
} from '../../../src/game/settlement/resourceTransfer';

describe('Resource transfer between settlements', () => {
  it('transfers resources with logistics loss proportional to distance', () => {
    const request: TransferRequest = {
      food: 1000,
      money: 500,
      workers: 20,
      sourceDistance: 0,
      targetDistance: 384_400, // moon
    };
    const result = computeTransferResult(request);

    expect(result.food).toBeGreaterThan(0);
    expect(result.food).toBeLessThan(1000);
    expect(result.money).toBeGreaterThan(0);
    expect(result.money).toBeLessThan(500);
    expect(result.workers).toBeGreaterThan(0);
    expect(result.workers).toBeLessThanOrEqual(20);
  });

  it('same-body transfers have minimal loss', () => {
    const request: TransferRequest = {
      food: 1000,
      money: 500,
      workers: 20,
      sourceDistance: 0,
      targetDistance: 1000, // nearby on earth
    };
    const result = computeTransferResult(request);

    // 5% base loss + negligible distance factor
    expect(result.food).toBeGreaterThanOrEqual(900);
  });

  it('returns zero when request amounts are zero', () => {
    const result = computeTransferResult({
      food: 0,
      money: 0,
      workers: 0,
      sourceDistance: 0,
      targetDistance: 225_000_000,
    });
    expect(result.food).toBe(0);
    expect(result.money).toBe(0);
    expect(result.workers).toBe(0);
  });

  it('loss rate is capped at 50%', () => {
    const request: TransferRequest = {
      food: 1000,
      money: 1000,
      workers: 100,
      sourceDistance: 0,
      targetDistance: 40_000_000_000_000, // interstellar
    };
    const result = computeTransferResult(request);

    expect(result.food).toBeGreaterThanOrEqual(500);
  });

  it('money loses at half rate compared to food', () => {
    const request: TransferRequest = {
      food: 1000,
      money: 1000,
      workers: 0,
      sourceDistance: 0,
      targetDistance: 225_000_000, // mars
    };
    const result = computeTransferResult(request);

    // money should arrive with less loss than food
    const foodLossRate = 1 - result.food / 1000;
    const moneyLossRate = 1 - result.money / 1000;
    expect(moneyLossRate).toBeLessThan(foodLossRate);
  });

  it('exposes the computed loss rate', () => {
    const result = computeTransferResult({
      food: 100,
      money: 100,
      workers: 100,
      sourceDistance: 0,
      targetDistance: 1000,
    });
    expect(result.lossRate).toBeGreaterThanOrEqual(0.05);
    expect(result.lossRate).toBeLessThanOrEqual(0.5);
  });
});

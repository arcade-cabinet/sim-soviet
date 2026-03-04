import { computeAllocation, type BuildingAllocationInput } from '../../src/ai/agents/economy/allocationDistribution';

describe('Two-layer resource distribution', () => {
  const buildings: BuildingAllocationInput[] = [
    { id: 'b1', residentCount: 100, loyalty: 80, proximity: 1.0, skill: 70, kgbFavor: false },
    { id: 'b2', residentCount: 100, loyalty: 30, proximity: 0.5, skill: 40, kgbFavor: false },
    { id: 'b3', residentCount: 50,  loyalty: 90, proximity: 0.8, skill: 60, kgbFavor: true },
  ];

  it('distributes baseline equally per capita', () => {
    const result = computeAllocation(1000, 250, buildings);
    expect(result[0].baseline).toBe(400);
    expect(result[1].baseline).toBe(400);
    expect(result[2].baseline).toBe(200);
  });
  it('spiky layer gives more to high-loyalty buildings', () => {
    const result = computeAllocation(1000, 250, buildings);
    expect(result[0].spike).toBeGreaterThan(result[1].spike);
  });
  it('kgb favor boosts allocation', () => {
    const result = computeAllocation(1000, 250, buildings);
    const b3PerCapita = result[2].spike / 50;
    const b2PerCapita = result[1].spike / 100;
    expect(b3PerCapita).toBeGreaterThan(b2PerCapita);
  });
  it('total allocation equals total supply', () => {
    const result = computeAllocation(1000, 250, buildings);
    const total = result.reduce((s, r) => s + r.baseline + r.spike, 0);
    expect(total).toBeCloseTo(1000, 1);
  });
  it('handles zero supply gracefully', () => {
    const result = computeAllocation(0, 250, buildings);
    expect(result.every(r => r.baseline === 0 && r.spike === 0)).toBe(true);
  });
});

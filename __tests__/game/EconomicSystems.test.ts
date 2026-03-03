import { accrueTrudodni, defaultCategory, TRUDODNI_VALUES } from '../../src/ai/agents/economy/EconomyAgent';
import { calculatePrivatePlotProduction } from '../../src/ai/agents/economy/FoodAgent';
import { tickLoyalty } from '../../src/ai/agents/political/LoyaltyAgent';
import { createCitizen, createDvor } from '../../src/ecs/factories';
import type { DvorComponent } from '../../src/ecs/world';
import { world } from '../../src/ecs/world';

/** Helper to create a dvor entity with specified parameters. */
function makeDvor(
  id: string,
  overrides: Partial<DvorComponent> = {},
  members: Array<{ name: string; gender: 'male' | 'female'; age: number }> = [
    { name: 'Ivan Petrov', gender: 'male', age: 30 },
  ],
): ReturnType<typeof createDvor> {
  const entity = createDvor(id, overrides.surname ?? 'Petrov', members);
  if (entity.dvor) {
    if (overrides.privatePlotSize !== undefined) entity.dvor.privatePlotSize = overrides.privatePlotSize;
    if (overrides.privateLivestock) entity.dvor.privateLivestock = overrides.privateLivestock;
    if (overrides.loyaltyToCollective !== undefined) entity.dvor.loyaltyToCollective = overrides.loyaltyToCollective;
  }
  return entity;
}

describe('PrivatePlotSystem', () => {
  beforeEach(() => world.clear());
  afterEach(() => world.clear());

  it('produces food scaled by plot size', () => {
    const noLivestock = { cow: 0, pig: 0, sheep: 0, poultry: 0 };
    makeDvor('d1', { privatePlotSize: 0.25, privateLivestock: noLivestock });
    makeDvor('d2', { privatePlotSize: 0.5, privateLivestock: noLivestock });

    const food = calculatePrivatePlotProduction('collectivization');

    // d1: 0.25 * 200/12 ≈ 4.17
    // d2: 0.5  * 200/12 ≈ 8.33
    // total ≈ 12.5
    expect(food).toBeCloseTo(12.5, 1);
  });

  it('includes livestock bonus', () => {
    makeDvor('d1', {
      privatePlotSize: 0.25,
      privateLivestock: { cow: 1, pig: 0, sheep: 0, poultry: 0 },
    });

    const food = calculatePrivatePlotProduction('collectivization');

    // plot: 0.25 * 200/12 ≈ 4.17 + cow: 4.0 = ≈ 8.17
    expect(food).toBeCloseTo(8.17, 1);
  });

  it('applies thaw_and_freeze era modifier (1.5x)', () => {
    makeDvor('d1', { privatePlotSize: 0.5 });

    const normalFood = calculatePrivatePlotProduction('collectivization');
    const thawFood = calculatePrivatePlotProduction('thaw_and_freeze');

    expect(thawFood).toBeCloseTo(normalFood * 1.5, 1);
  });

  it('produces zero during great_patriotic era', () => {
    makeDvor('d1', { privatePlotSize: 0.5 });

    const food = calculatePrivatePlotProduction('great_patriotic');

    expect(food).toBe(0);
  });

  it('applies stagnation era modifier (0.8x)', () => {
    makeDvor('d1', { privatePlotSize: 0.5 });

    const normalFood = calculatePrivatePlotProduction('collectivization');
    const stagFood = calculatePrivatePlotProduction('stagnation');

    expect(stagFood).toBeCloseTo(normalFood * 0.8, 1);
  });

  it('does not produce if no working-age member (16 to retirement)', () => {
    makeDvor('d1', { privatePlotSize: 0.5 }, [{ name: 'Old Petrov', gender: 'male', age: 70 }]);

    const food = calculatePrivatePlotProduction('collectivization');

    expect(food).toBe(0);
  });

  it('produces if at least one member is working age', () => {
    makeDvor('d1', { privatePlotSize: 0.5 }, [
      { name: 'Old Petrov', gender: 'male', age: 70 },
      { name: 'Young Petrov', gender: 'male', age: 25 },
    ]);

    const food = calculatePrivatePlotProduction('collectivization');

    expect(food).toBeGreaterThan(0);
  });
});

describe('LoyaltySystem', () => {
  beforeEach(() => world.clear());
  afterEach(() => world.clear());

  const fixedRng = { random: () => 0.99 }; // No sabotage/flight by default

  it('increases loyalty when food level > 0.7', () => {
    const entity = makeDvor('d1', { loyaltyToCollective: 50 });

    tickLoyalty('collectivization', 0.8, false, fixedRng);

    expect(entity.dvor!.loyaltyToCollective).toBeCloseTo(50.3, 2);
  });

  it('decreases loyalty during starvation (foodLevel <= 0)', () => {
    const entity = makeDvor('d1', { loyaltyToCollective: 50 });

    tickLoyalty('collectivization', 0, false, fixedRng);

    expect(entity.dvor!.loyaltyToCollective).toBeCloseTo(49.7, 2);
  });

  it('does not change loyalty for moderate food level (0 < food <= 0.7)', () => {
    const entity = makeDvor('d1', { loyaltyToCollective: 50 });

    tickLoyalty('collectivization', 0.5, false, fixedRng);

    expect(entity.dvor!.loyaltyToCollective).toBe(50);
  });

  it('triggers sabotage when loyalty < 15 and roll succeeds', () => {
    makeDvor('d1', { loyaltyToCollective: 10 });

    // Roll below 0.005 triggers sabotage (sabotageChance = 0.005)
    const result = tickLoyalty('collectivization', 0.5, false, { random: () => 0.004 });

    expect(result.sabotageCount).toBe(1);
  });

  it('does not trigger sabotage when loyalty >= 15', () => {
    makeDvor('d1', { loyaltyToCollective: 20 });

    const result = tickLoyalty('collectivization', 0.5, false, { random: () => 0.001 });

    expect(result.sabotageCount).toBe(0);
  });

  it('triggers flight when loyalty < 5 and roll succeeds', () => {
    makeDvor('d1', { loyaltyToCollective: 3 });

    // Roll below 0.003 triggers flight (and below 0.005 triggers sabotage too)
    const result = tickLoyalty('collectivization', 0.5, false, { random: () => 0.002 });

    expect(result.flightCount).toBe(1);
    expect(result.sabotageCount).toBe(1); // Also sabotages since loyalty < 15
  });

  it('caps loyalty at 100', () => {
    const entity = makeDvor('d1', { loyaltyToCollective: 99.95 });

    tickLoyalty('collectivization', 0.8, false, fixedRng);

    expect(entity.dvor!.loyaltyToCollective).toBe(100);
  });

  it('caps loyalty at 0', () => {
    const entity = makeDvor('d1', { loyaltyToCollective: 0.2 });

    tickLoyalty('collectivization', 0, false, fixedRng);

    expect(entity.dvor!.loyaltyToCollective).toBe(0);
  });

  it('reports correct average loyalty', () => {
    makeDvor('d1', { loyaltyToCollective: 30 });
    makeDvor('d2', { loyaltyToCollective: 70 });

    const result = tickLoyalty('collectivization', 0.5, false, fixedRng);

    expect(result.avgLoyalty).toBe(50);
  });
});

describe('TrudodniSystem', () => {
  beforeEach(() => world.clear());
  afterEach(() => world.clear());

  describe('defaultCategory', () => {
    it('assigns category 5 for male workers', () => {
      expect(defaultCategory('male', 'worker')).toBe(5);
    });

    it('assigns category 6 for male head of household', () => {
      expect(defaultCategory('male', 'head')).toBe(6);
    });

    it('assigns category 3 for female workers', () => {
      expect(defaultCategory('female', 'worker')).toBe(3);
    });

    it('assigns category 3 for female spouse', () => {
      expect(defaultCategory('female', 'spouse')).toBe(3);
    });

    it('assigns category 2 for male adolescents', () => {
      expect(defaultCategory('male', 'adolescent')).toBe(2);
    });

    it('assigns category 1 for female adolescents', () => {
      expect(defaultCategory('female', 'adolescent')).toBe(1);
    });

    it('assigns category 1 for elders regardless of gender', () => {
      expect(defaultCategory('male', 'elder')).toBe(1);
      expect(defaultCategory('female', 'elder')).toBe(1);
    });

    it('assigns category 1 for children', () => {
      expect(defaultCategory('male', 'child')).toBe(1);
      expect(defaultCategory('female', 'child')).toBe(1);
    });
  });

  describe('TRUDODNI_VALUES', () => {
    it('has correct values for all 7 categories', () => {
      expect(TRUDODNI_VALUES[1]).toBe(0.5);
      expect(TRUDODNI_VALUES[2]).toBe(0.75);
      expect(TRUDODNI_VALUES[3]).toBe(1.0);
      expect(TRUDODNI_VALUES[4]).toBe(1.25);
      expect(TRUDODNI_VALUES[5]).toBe(1.5);
      expect(TRUDODNI_VALUES[6]).toBe(2.0);
      expect(TRUDODNI_VALUES[7]).toBe(2.5);
    });
  });

  describe('accrueTrudodni', () => {
    it('accrues trudodni for assigned citizens with dvor links', () => {
      // Create a dvor with a working-age male
      const dvorEntity = makeDvor('d1', {}, [{ name: 'Ivan Petrov', gender: 'male', age: 30 }]);
      const dvor = dvorEntity.dvor!;
      const member = dvor.members[0]!;
      member.trudodniEarned = 0;

      // Create a linked citizen entity with an assignment
      const citizenEntity = createCitizen('worker', 5, 5, 'male', 30, 'd1');
      citizenEntity.citizen!.dvorMemberId = member.id;
      citizenEntity.citizen!.assignment = 'collective-farm-hq';

      const result = accrueTrudodni();

      // Assigned male head → trudodni category from role → 2.0/day × 26 days = 52
      expect(result.memberCount).toBe(1);
      expect(result.totalTrudodni).toBeCloseTo(52, 0);
      expect(member.trudodniEarned).toBeCloseTo(52, 0);
    });

    it('does not accrue for unassigned citizens', () => {
      const dvorEntity = makeDvor('d1', {}, [{ name: 'Ivan Petrov', gender: 'male', age: 30 }]);
      const dvor = dvorEntity.dvor!;
      const member = dvor.members[0]!;
      member.trudodniEarned = 0;

      // Create a linked citizen WITHOUT assignment
      const citizenEntity = createCitizen('worker', 5, 5, 'male', 30, 'd1');
      citizenEntity.citizen!.dvorMemberId = member.id;
      // No assignment

      const result = accrueTrudodni();

      expect(result.memberCount).toBe(0);
      expect(result.totalTrudodni).toBe(0);
      expect(member.trudodniEarned).toBe(0);
    });

    it('accumulates over multiple calls', () => {
      const dvorEntity = makeDvor('d1', {}, [{ name: 'Anna Petrova', gender: 'female', age: 25 }]);
      const dvor = dvorEntity.dvor!;
      const member = dvor.members[0]!;
      member.trudodniEarned = 0;

      const citizenEntity = createCitizen('worker', 5, 5, 'female', 25, 'd1');
      citizenEntity.citizen!.dvorMemberId = member.id;
      citizenEntity.citizen!.assignment = 'collective-farm-hq';

      accrueTrudodni();
      accrueTrudodni();

      // Female worker → category 3 → 1.0/day × 26 days × 2 months = 52
      expect(member.trudodniEarned).toBeCloseTo(52, 0);
    });
  });
});

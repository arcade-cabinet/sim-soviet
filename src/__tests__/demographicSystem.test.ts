import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dvory, femaleCitizens, maleCitizens, renderableCitizens } from '@/ecs/archetypes';
import {
  ageCategoryFromAge,
  computeRenderSlot,
  createCitizen,
  createDvor,
  type DvorMemberSeed,
} from '@/ecs/factories';
import { initializeSettlementPopulation } from '@/ecs/factories/settlementFactories';
import {
  ageAllMembers,
  birthCheck,
  type DemographicTickResult,
  deathCheck,
  demographicTick,
} from '@/ecs/systems/demographicSystem';
import type { CitizenRenderSlot, DvorMember } from '@/ecs/world';
import { world } from '@/ecs/world';
import type { GameRng } from '@/game/SeedSystem';

// ── Deterministic RNG for tests ──────────────────────────────────────────────

function createTestRng(seed = 0.42): GameRng {
  let current = seed;
  return {
    random: () => {
      current = (current * 16807 + 0.5) % 1;
      return current;
    },
    int: (a: number, b: number) => {
      current = (current * 16807 + 0.5) % 1;
      return a + Math.floor(current * (b - a + 1));
    },
    pick: <T>(arr: T[]) => {
      current = (current * 16807 + 0.5) % 1;
      return arr[Math.floor(current * arr.length)]!;
    },
    weightedIndex: (weights: number[]) => {
      current = (current * 16807 + 0.5) % 1;
      const total = weights.reduce((a, b) => a + b, 0);
      let threshold = current * total;
      for (let i = 0; i < weights.length; i++) {
        threshold -= weights[i]!;
        if (threshold <= 0) return i;
      }
      return weights.length - 1;
    },
  } as GameRng;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function createTestDvor(id: string, members: DvorMemberSeed[]): void {
  createDvor(id, 'Testov', members);
}

/** Count all dvor members across all dvory. */
function totalDvorMembers(): number {
  let total = 0;
  for (const entity of dvory) {
    total += entity.dvor.members.length;
  }
  return total;
}

/** Get all members from all dvory as a flat array. */
function allMembers(): DvorMember[] {
  const all: DvorMember[] = [];
  for (const entity of dvory) {
    all.push(...entity.dvor.members);
  }
  return all;
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  world.clear();
});

afterEach(() => {
  world.clear();
});

// ═══════════════════════════════════════════════════════════════════════════
// Part 1: Render Slot + Gender Archetypes
// ═══════════════════════════════════════════════════════════════════════════

describe('ageCategoryFromAge', () => {
  it('returns child for age 0-11', () => {
    expect(ageCategoryFromAge(0)).toBe('child');
    expect(ageCategoryFromAge(5)).toBe('child');
    expect(ageCategoryFromAge(11)).toBe('child');
  });

  it('returns adolescent for age 12-15', () => {
    expect(ageCategoryFromAge(12)).toBe('adolescent');
    expect(ageCategoryFromAge(15)).toBe('adolescent');
  });

  it('returns adult for age 16-59', () => {
    expect(ageCategoryFromAge(16)).toBe('adult');
    expect(ageCategoryFromAge(35)).toBe('adult');
    expect(ageCategoryFromAge(59)).toBe('adult');
  });

  it('returns elder for age 60+', () => {
    expect(ageCategoryFromAge(60)).toBe('elder');
    expect(ageCategoryFromAge(75)).toBe('elder');
  });
});

describe('computeRenderSlot', () => {
  it('computes correct slot for male worker', () => {
    const slot = computeRenderSlot('worker', 'male', 30);
    expect(slot).toEqual({
      gender: 'male',
      ageCategory: 'adult',
      citizenClass: 'worker',
      dotColor: '#8D6E63',
      dialoguePool: 'worker',
    } satisfies CitizenRenderSlot);
  });

  it('maps party_official to party_official dialogue pool', () => {
    const slot = computeRenderSlot('party_official', 'male', 45);
    expect(slot.dialoguePool).toBe('party_official');
  });

  it('maps soldier to military dialogue pool', () => {
    const slot = computeRenderSlot('soldier', 'male', 22);
    expect(slot.dialoguePool).toBe('military');
  });

  it('maps farmer to worker dialogue pool', () => {
    const slot = computeRenderSlot('farmer', 'female', 35);
    expect(slot.dialoguePool).toBe('worker');
    expect(slot.dotColor).toBe('#2E7D32');
  });

  it('uses correct age category for child citizen', () => {
    const slot = computeRenderSlot('worker', 'male', 8);
    expect(slot.ageCategory).toBe('child');
  });

  it('falls back to grey for unknown class', () => {
    const slot = computeRenderSlot('unknown_class', 'female', 25);
    expect(slot.dotColor).toBe('#757575');
    expect(slot.dialoguePool).toBe('worker');
  });

  it('defaults to male adult when no gender/age provided', () => {
    const slot = computeRenderSlot('worker');
    expect(slot.gender).toBe('male');
    expect(slot.ageCategory).toBe('adult');
  });
});

describe('createCitizen with render slot', () => {
  it('attaches renderSlot component to citizen entity', () => {
    const entity = createCitizen('worker', undefined, undefined, 'female', 28);
    expect(entity.renderSlot).toBeDefined();
    expect(entity.renderSlot!.gender).toBe('female');
    expect(entity.renderSlot!.ageCategory).toBe('adult');
    expect(entity.renderSlot!.dotColor).toBe('#8D6E63');
  });

  it('sets gender and age on citizen component', () => {
    const entity = createCitizen('farmer', undefined, undefined, 'female', 35, 'dvor-1');
    expect(entity.citizen!.gender).toBe('female');
    expect(entity.citizen!.age).toBe(35);
    expect(entity.citizen!.dvorId).toBe('dvor-1');
    expect(entity.citizen!.memberRole).toBe('worker');
  });

  it('defaults to male/25 when gender/age not provided', () => {
    const entity = createCitizen('worker');
    expect(entity.citizen!.gender).toBe('male');
    expect(entity.citizen!.age).toBe(25);
    expect(entity.renderSlot!.gender).toBe('male');
  });
});

describe('gender archetypes', () => {
  it('maleCitizens filters correctly', () => {
    createCitizen('worker', undefined, undefined, 'male', 30);
    createCitizen('worker', undefined, undefined, 'female', 28);
    createCitizen('farmer', undefined, undefined, 'male', 40);

    expect(maleCitizens.entities).toHaveLength(2);
    expect(femaleCitizens.entities).toHaveLength(1);
  });

  it('renderableCitizens includes all citizens with render slots', () => {
    createCitizen('worker', undefined, undefined, 'male', 25);
    createCitizen('engineer', undefined, undefined, 'female', 35);

    expect(renderableCitizens.entities).toHaveLength(2);
    for (const entity of renderableCitizens) {
      expect(entity.renderSlot).toBeDefined();
      expect(entity.renderSlot.dotColor).toBeTruthy();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Part 2: Demographic System — Aging
// ═══════════════════════════════════════════════════════════════════════════

describe('ageAllMembers', () => {
  it('increments every member age by 1', () => {
    createTestDvor('dvor-1', [
      { name: 'Pyotr', gender: 'male', age: 30 },
      { name: 'Olga', gender: 'female', age: 28 },
      { name: 'Kolya', gender: 'male', age: 5 },
    ]);

    ageAllMembers();

    const members = allMembers();
    expect(members.find((m) => m.name === 'Pyotr')!.age).toBe(31);
    expect(members.find((m) => m.name === 'Olga')!.age).toBe(29);
    expect(members.find((m) => m.name === 'Kolya')!.age).toBe(6);
  });

  it('transitions infant to child at age 1', () => {
    createTestDvor('dvor-1', [
      { name: 'Head', gender: 'male', age: 30 },
      { name: 'Baby', gender: 'female', age: 0 },
    ]);

    ageAllMembers();

    const baby = allMembers().find((m) => m.name === 'Baby')!;
    expect(baby.age).toBe(1);
    expect(baby.role).toBe('child');
  });

  it('transitions child to adolescent at age 12', () => {
    createTestDvor('dvor-1', [
      { name: 'Head', gender: 'male', age: 40 },
      { name: 'Kid', gender: 'male', age: 11 },
    ]);

    ageAllMembers();

    const kid = allMembers().find((m) => m.name === 'Kid')!;
    expect(kid.age).toBe(12);
    expect(kid.role).toBe('adolescent');
    expect(kid.laborCapacity).toBe(0.3);
  });

  it('transitions adolescent to worker at age 16', () => {
    createTestDvor('dvor-1', [
      { name: 'Head', gender: 'male', age: 40 },
      { name: 'Teen', gender: 'female', age: 15 },
    ]);

    ageAllMembers();

    const teen = allMembers().find((m) => m.name === 'Teen')!;
    expect(teen.age).toBe(16);
    expect(teen.role).not.toBe('adolescent');
    expect(teen.laborCapacity).toBe(0.7);
  });

  it('transitions worker to elder at age 60', () => {
    // Need a younger head so 'Old' gets 'worker' role, not 'head'
    createTestDvor('dvor-1', [
      { name: 'Head', gender: 'male', age: 35 },
      { name: 'Old', gender: 'male', age: 59 },
    ]);

    ageAllMembers();

    const old = allMembers().find((m) => m.name === 'Old')!;
    expect(old.age).toBe(60);
    expect(old.role).toBe('elder');
    expect(old.laborCapacity).toBe(0.5);
  });

  it('updates labor capacity with age', () => {
    createTestDvor('dvor-1', [{ name: 'Young', gender: 'male', age: 20 }]);

    ageAllMembers(); // now 21 → prime working age 1.0

    const young = allMembers().find((m) => m.name === 'Young')!;
    expect(young.laborCapacity).toBe(1.0);
  });

  it('preserves head/spouse roles during aging', () => {
    createTestDvor('dvor-1', [
      { name: 'Head', gender: 'male', age: 44 },
      { name: 'Spouse', gender: 'female', age: 42 },
    ]);

    ageAllMembers();

    const head = allMembers().find((m) => m.name === 'Head')!;
    const spouse = allMembers().find((m) => m.name === 'Spouse')!;
    expect(head.role).toBe('head');
    expect(spouse.role).toBe('spouse');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Part 3: Demographic System — Births
// ═══════════════════════════════════════════════════════════════════════════

describe('birthCheck', () => {
  it('can produce a birth for an eligible woman', () => {
    createTestDvor('dvor-1', [
      { name: 'Father', gender: 'male', age: 30 },
      { name: 'Mother', gender: 'female', age: 28 },
    ]);

    // Run many times with always-low RNG (births happen when roll < threshold)
    let birthCount = 0;
    const alwaysBirthRng = createTestRng(0.001);
    // Override random to always return low value
    alwaysBirthRng.random = () => 0.001;

    const result: DemographicTickResult = {
      births: 0,
      deaths: 0,
      aged: 0,
      newDvory: 0,
    };

    birthCheck(alwaysBirthRng, 1.0, result);
    birthCount = result.births;

    expect(birthCount).toBeGreaterThan(0);
  });

  it("adds infant to mother's dvor", () => {
    createTestDvor('dvor-1', [
      { name: 'Father', gender: 'male', age: 30 },
      { name: 'Mother', gender: 'female', age: 28 },
    ]);

    const beforeCount = totalDvorMembers();
    const lowRng = createTestRng();
    lowRng.random = () => 0.001; // always produce birth

    const result: DemographicTickResult = { births: 0, deaths: 0, aged: 0, newDvory: 0 };
    birthCheck(lowRng, 1.0, result);

    if (result.births > 0) {
      expect(totalDvorMembers()).toBe(beforeCount + result.births);
      const infants = allMembers().filter((m) => m.role === 'infant');
      expect(infants.length).toBeGreaterThan(0);
      expect(infants[0]!.age).toBe(0);
    }
  });

  it('does not produce births for women over 45', () => {
    createTestDvor('dvor-1', [
      { name: 'Husband', gender: 'male', age: 50 },
      { name: 'OldWife', gender: 'female', age: 48 },
    ]);

    const lowRng = createTestRng();
    lowRng.random = () => 0.001;

    const result: DemographicTickResult = { births: 0, deaths: 0, aged: 0, newDvory: 0 };
    birthCheck(lowRng, 1.0, result);

    expect(result.births).toBe(0);
  });

  it('does not produce births for girls under 16', () => {
    createTestDvor('dvor-1', [
      { name: 'Father', gender: 'male', age: 35 },
      { name: 'Girl', gender: 'female', age: 14 },
    ]);

    const lowRng = createTestRng();
    lowRng.random = () => 0.001;

    const result: DemographicTickResult = { births: 0, deaths: 0, aged: 0, newDvory: 0 };
    birthCheck(lowRng, 1.0, result);

    expect(result.births).toBe(0);
  });

  it('reduces birth chance when food is scarce', () => {
    createTestDvor('dvor-1', [
      { name: 'Father', gender: 'male', age: 30 },
      { name: 'Mother', gender: 'female', age: 25 },
    ]);

    // With food=0, birthChanceMultiplier should be very low
    // Roll just above the low-food threshold should not trigger
    const borderRng = createTestRng();
    borderRng.random = () => 0.008; // just above 15%/12 * 0.5 ≈ 0.00625

    const result: DemographicTickResult = { births: 0, deaths: 0, aged: 0, newDvory: 0 };
    birthCheck(borderRng, 0.0, result); // food level 0 → ×0.5

    expect(result.births).toBe(0);
  });

  it('does not produce births for already-pregnant women', () => {
    createTestDvor('dvor-1', [
      { name: 'Father', gender: 'male', age: 30 },
      { name: 'PregnantMom', gender: 'female', age: 28 },
    ]);

    // Set pregnant
    for (const entity of dvory) {
      for (const m of entity.dvor.members) {
        if (m.name === 'PregnantMom') m.pregnant = 60;
      }
    }

    const lowRng = createTestRng();
    lowRng.random = () => 0.001;

    const result: DemographicTickResult = { births: 0, deaths: 0, aged: 0, newDvory: 0 };
    birthCheck(lowRng, 1.0, result);

    expect(result.births).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Part 4: Demographic System — Deaths
// ═══════════════════════════════════════════════════════════════════════════

describe('deathCheck', () => {
  it('can kill elderly members (age-based mortality)', () => {
    createTestDvor('dvor-1', [
      { name: 'VeryOld', gender: 'male', age: 80 },
      { name: 'Son', gender: 'male', age: 45 },
    ]);

    const lowRng = createTestRng();
    lowRng.random = () => 0.001; // always die

    const result: DemographicTickResult = { births: 0, deaths: 0, aged: 0, newDvory: 0 };
    deathCheck(lowRng, 1.0, result);

    expect(result.deaths).toBeGreaterThan(0);
    expect(totalDvorMembers()).toBeLessThan(2);
  });

  it('infant mortality is higher than adult mortality', () => {
    // Infant: 15%/year → ~1.25%/month
    // Adult: 0.5%/year → ~0.042%/month
    // With a roll of 0.005, infant should die but adult should not
    createTestDvor('dvor-infant', [
      { name: 'Head', gender: 'male', age: 30 },
      { name: 'Baby', gender: 'female', age: 0 },
    ]);
    createTestDvor('dvor-adult', [{ name: 'Adult', gender: 'male', age: 30 }]);

    const rng = createTestRng();
    rng.random = () => 0.005;

    const result: DemographicTickResult = { births: 0, deaths: 0, aged: 0, newDvory: 0 };
    deathCheck(rng, 1.0, result);

    // The infant should be at higher risk than the adult
    // With roll=0.005, infant monthly mortality ~1.25% → dies
    // Adult monthly mortality ~0.042% → survives
    const infantDvor = dvory.entities.find((e) => e.dvor.id === 'dvor-infant')!;
    const infantAlive = infantDvor.dvor.members.find((m) => m.name === 'Baby');
    const adultDvor = dvory.entities.find((e) => e.dvor.id === 'dvor-adult')!;
    const adultAlive = adultDvor.dvor.members.find((m) => m.name === 'Adult');

    // Infant should have died (roll < 1.25%)
    expect(infantAlive).toBeUndefined();
    // Adult should survive (roll > 0.042%)
    expect(adultAlive).toBeDefined();
  });

  it('starvation increases death risk', () => {
    createTestDvor('dvor-1', [{ name: 'Starving', gender: 'male', age: 30 }]);

    const rng = createTestRng();
    rng.random = () => 0.03; // 3% — should survive normally but die when starving

    const result: DemographicTickResult = { births: 0, deaths: 0, aged: 0, newDvory: 0 };
    deathCheck(rng, 0.0, result); // food level 0 → starvation modifier

    // With starvation, a 30-year-old's death chance should be higher
    expect(result.deaths).toBeGreaterThan(0);
  });

  it('removes dead member from their dvor', () => {
    createTestDvor('dvor-1', [
      { name: 'Head', gender: 'male', age: 30 },
      { name: 'Dying', gender: 'male', age: 85 },
    ]);

    const lowRng = createTestRng();
    lowRng.random = () => 0.001;

    deathCheck(lowRng, 1.0, { births: 0, deaths: 0, aged: 0, newDvory: 0 });

    const members = allMembers();
    expect(members.find((m) => m.name === 'Dying')).toBeUndefined();
    expect(members.find((m) => m.name === 'Head')).toBeDefined();
  });

  it('removes empty dvor when last member dies', () => {
    createTestDvor('dvor-doomed', [{ name: 'LastOne', gender: 'male', age: 90 }]);

    const beforeDvory = dvory.entities.length;

    const lowRng = createTestRng();
    lowRng.random = () => 0.001;

    deathCheck(lowRng, 1.0, { births: 0, deaths: 0, aged: 0, newDvory: 0 });

    // The dvor should be removed from the world
    expect(dvory.entities.length).toBe(beforeDvory - 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Part 5: Demographic Tick Integration
// ═══════════════════════════════════════════════════════════════════════════

describe('demographicTick', () => {
  it('returns zero result on non-boundary ticks', () => {
    initializeSettlementPopulation('comrade');

    const result = demographicTick(null, 15, 1.0);

    expect(result.births).toBe(0);
    expect(result.deaths).toBe(0);
    expect(result.aged).toBe(0);
  });

  it('ages members on year boundary (tick 360)', () => {
    createTestDvor('dvor-1', [{ name: 'Head', gender: 'male', age: 30 }]);

    const result = demographicTick(null, 360, 1.0);

    expect(result.aged).toBeGreaterThan(0);
    const head = allMembers().find((m) => m.name === 'Head')!;
    expect(head.age).toBe(31);
  });

  it('runs birth+death checks on month boundary (tick 30)', () => {
    createTestDvor('dvor-1', [
      { name: 'Father', gender: 'male', age: 30 },
      { name: 'Mother', gender: 'female', age: 28 },
      { name: 'Grandpa', gender: 'male', age: 90 },
    ]);

    const lowRng = createTestRng();
    lowRng.random = () => 0.001;

    const result = demographicTick(lowRng, 30, 1.0);

    // Should have at least attempted births and deaths
    // Grandpa (90) should die, Mother (28) should potentially give birth
    expect(result.births + result.deaths).toBeGreaterThan(0);
  });

  it('skips tick 0', () => {
    createTestDvor('dvor-1', [{ name: 'Head', gender: 'male', age: 30 }]);

    const result = demographicTick(null, 0, 1.0);

    expect(result.aged).toBe(0);
    expect(result.births).toBe(0);
    expect(result.deaths).toBe(0);
  });
});

import { dvory, femaleCitizens, maleCitizens, renderableCitizens } from '@/ecs/archetypes';
import {
  ageCategoryFromAge,
  computeRenderSlot,
  createCitizen,
  createDvor,
  createStartingSettlement,
  type DvorMemberSeed,
} from '@/ecs/factories';
import {
  ageAllMembers,
  birthCheck,
  type DemographicTickResult,
  deathCheck,
  demographicTick,
  ERA_BIRTH_RATE_MULTIPLIER,
  getWorkingMotherPenalty,
  householdFormation,
  pregnancyTick,
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
    expect(ageCategoryFromAge(0, 'male')).toBe('child');
    expect(ageCategoryFromAge(5, 'female')).toBe('child');
    expect(ageCategoryFromAge(11, 'male')).toBe('child');
  });

  it('returns adolescent for age 12-15', () => {
    expect(ageCategoryFromAge(12, 'male')).toBe('adolescent');
    expect(ageCategoryFromAge(15, 'female')).toBe('adolescent');
  });

  it('returns adult for males 16-59', () => {
    expect(ageCategoryFromAge(16, 'male')).toBe('adult');
    expect(ageCategoryFromAge(35, 'male')).toBe('adult');
    expect(ageCategoryFromAge(59, 'male')).toBe('adult');
  });

  it('returns adult for females 16-54', () => {
    expect(ageCategoryFromAge(16, 'female')).toBe('adult');
    expect(ageCategoryFromAge(35, 'female')).toBe('adult');
    expect(ageCategoryFromAge(54, 'female')).toBe('adult');
  });

  it('returns elder for females at 55 (Soviet pension law)', () => {
    expect(ageCategoryFromAge(55, 'female')).toBe('elder');
    expect(ageCategoryFromAge(75, 'female')).toBe('elder');
  });

  it('returns elder for males at 60', () => {
    expect(ageCategoryFromAge(60, 'male')).toBe('elder');
    expect(ageCategoryFromAge(75, 'male')).toBe('elder');
  });

  it('male 55-59 is adult, female 55+ is elder', () => {
    expect(ageCategoryFromAge(55, 'male')).toBe('adult');
    expect(ageCategoryFromAge(55, 'female')).toBe('elder');
    expect(ageCategoryFromAge(59, 'male')).toBe('adult');
    expect(ageCategoryFromAge(59, 'female')).toBe('elder');
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

/** Create an empty DemographicTickResult for direct ageAllMembers() calls. */
function emptyDemoResult(): DemographicTickResult {
  return { births: 0, deaths: 0, aged: 0, newDvory: 0, deadMembers: [], agedIntoWorking: [] };
}

describe('ageAllMembers', () => {
  it('increments every member age by 1', () => {
    createTestDvor('dvor-1', [
      { name: 'Pyotr', gender: 'male', age: 30 },
      { name: 'Olga', gender: 'female', age: 28 },
      { name: 'Kolya', gender: 'male', age: 5 },
    ]);

    ageAllMembers(emptyDemoResult());

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

    ageAllMembers(emptyDemoResult());

    const baby = allMembers().find((m) => m.name === 'Baby')!;
    expect(baby.age).toBe(1);
    expect(baby.role).toBe('child');
  });

  it('transitions child to adolescent at age 12', () => {
    createTestDvor('dvor-1', [
      { name: 'Head', gender: 'male', age: 40 },
      { name: 'Kid', gender: 'male', age: 11 },
    ]);

    ageAllMembers(emptyDemoResult());

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

    ageAllMembers(emptyDemoResult());

    const teen = allMembers().find((m) => m.name === 'Teen')!;
    expect(teen.age).toBe(16);
    expect(teen.role).not.toBe('adolescent');
    expect(teen.laborCapacity).toBe(0.7);
  });

  it('transitions male worker to elder at age 60', () => {
    // Need a younger head so 'Old' gets 'worker' role, not 'head'
    createTestDvor('dvor-1', [
      { name: 'Head', gender: 'male', age: 35 },
      { name: 'Old', gender: 'male', age: 59 },
    ]);

    ageAllMembers(emptyDemoResult());

    const old = allMembers().find((m) => m.name === 'Old')!;
    expect(old.age).toBe(60);
    expect(old.role).toBe('elder');
    expect(old.laborCapacity).toBe(0.5);
  });

  it('transitions female worker to elder at age 55 (Soviet pension law)', () => {
    // Use three members so the female is a plain 'worker', not 'spouse'
    createTestDvor('dvor-1', [
      { name: 'Head', gender: 'male', age: 35 },
      { name: 'Spouse', gender: 'female', age: 33 },
      { name: 'OldWoman', gender: 'female', age: 54 },
    ]);

    ageAllMembers(emptyDemoResult());

    const woman = allMembers().find((m) => m.name === 'OldWoman')!;
    expect(woman.age).toBe(55);
    expect(woman.role).toBe('elder');
    expect(woman.laborCapacity).toBe(0.5);
  });

  it('male at 55 remains worker with 0.7 labor capacity', () => {
    createTestDvor('dvor-1', [
      { name: 'Head', gender: 'male', age: 30 },
      { name: 'MiddleAgedMan', gender: 'male', age: 54 },
    ]);

    ageAllMembers(emptyDemoResult());

    const man = allMembers().find((m) => m.name === 'MiddleAgedMan')!;
    expect(man.age).toBe(55);
    expect(man.role).toBe('worker');
    expect(man.laborCapacity).toBe(0.7);
  });

  it('updates labor capacity with age', () => {
    createTestDvor('dvor-1', [{ name: 'Young', gender: 'male', age: 20 }]);

    ageAllMembers(emptyDemoResult()); // now 21 → prime working age 1.0

    const young = allMembers().find((m) => m.name === 'Young')!;
    expect(young.laborCapacity).toBe(1.0);
  });

  it('preserves head/spouse roles during aging', () => {
    createTestDvor('dvor-1', [
      { name: 'Head', gender: 'male', age: 44 },
      { name: 'Spouse', gender: 'female', age: 42 },
    ]);

    ageAllMembers(emptyDemoResult());

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
  it('can produce a conception for an eligible woman', () => {
    createTestDvor('dvor-1', [
      { name: 'Father', gender: 'male', age: 30 },
      { name: 'Mother', gender: 'female', age: 28 },
    ]);

    const alwaysBirthRng = createTestRng(0.001);
    alwaysBirthRng.random = () => 0.001;

    const result: DemographicTickResult = emptyDemoResult();

    birthCheck(alwaysBirthRng, 1.0, result);

    expect(result.births).toBeGreaterThan(0);
    // Mother should now be pregnant, not an infant added
    const mother = allMembers().find((m) => m.name === 'Mother')!;
    expect(mother.pregnant).toBe(90);
  });

  it('sets pregnancy on conception, no immediate infant', () => {
    createTestDvor('dvor-1', [
      { name: 'Father', gender: 'male', age: 30 },
      { name: 'Mother', gender: 'female', age: 28 },
    ]);

    const beforeCount = totalDvorMembers();
    const lowRng = createTestRng();
    lowRng.random = () => 0.001;

    const result: DemographicTickResult = emptyDemoResult();
    birthCheck(lowRng, 1.0, result);

    expect(result.births).toBe(1);
    // No infant added yet — pregnancy just started
    expect(totalDvorMembers()).toBe(beforeCount);
    const infants = allMembers().filter((m) => m.role === 'infant');
    expect(infants.length).toBe(0);
    // Mother is pregnant
    const mother = allMembers().find((m) => m.name === 'Mother')!;
    expect(mother.pregnant).toBe(90);
  });

  it('does not produce births for women over 45', () => {
    createTestDvor('dvor-1', [
      { name: 'Husband', gender: 'male', age: 50 },
      { name: 'OldWife', gender: 'female', age: 48 },
    ]);

    const lowRng = createTestRng();
    lowRng.random = () => 0.001;

    const result: DemographicTickResult = { births: 0, deaths: 0, aged: 0, newDvory: 0, deadMembers: [], agedIntoWorking: [] };
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

    const result: DemographicTickResult = { births: 0, deaths: 0, aged: 0, newDvory: 0, deadMembers: [], agedIntoWorking: [] };
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

    const result: DemographicTickResult = { births: 0, deaths: 0, aged: 0, newDvory: 0, deadMembers: [], agedIntoWorking: [] };
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

    const result: DemographicTickResult = { births: 0, deaths: 0, aged: 0, newDvory: 0, deadMembers: [], agedIntoWorking: [] };
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

    const result: DemographicTickResult = { births: 0, deaths: 0, aged: 0, newDvory: 0, deadMembers: [], agedIntoWorking: [] };
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

    const result: DemographicTickResult = { births: 0, deaths: 0, aged: 0, newDvory: 0, deadMembers: [], agedIntoWorking: [] };
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

    const result: DemographicTickResult = { births: 0, deaths: 0, aged: 0, newDvory: 0, deadMembers: [], agedIntoWorking: [] };
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

    deathCheck(lowRng, 1.0, { births: 0, deaths: 0, aged: 0, newDvory: 0, deadMembers: [], agedIntoWorking: [] });

    const members = allMembers();
    expect(members.find((m) => m.name === 'Dying')).toBeUndefined();
    expect(members.find((m) => m.name === 'Head')).toBeDefined();
  });

  it('removes empty dvor when last member dies', () => {
    createTestDvor('dvor-doomed', [{ name: 'LastOne', gender: 'male', age: 90 }]);

    const beforeDvory = dvory.entities.length;

    const lowRng = createTestRng();
    lowRng.random = () => 0.001;

    deathCheck(lowRng, 1.0, { births: 0, deaths: 0, aged: 0, newDvory: 0, deadMembers: [], agedIntoWorking: [] });

    // The dvor should be removed from the world
    expect(dvory.entities.length).toBe(beforeDvory - 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Part 5: Demographic Tick Integration
// ═══════════════════════════════════════════════════════════════════════════

describe('demographicTick', () => {
  it('returns zero result on non-boundary ticks', () => {
    createStartingSettlement('comrade');

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

// ═══════════════════════════════════════════════════════════════════════════
// Part 6: Era-Specific Birth Rate Multipliers
// ═══════════════════════════════════════════════════════════════════════════

describe('ERA_BIRTH_RATE_MULTIPLIER', () => {
  it('defines multipliers for all 8 eras', () => {
    const eras = [
      'revolution', 'collectivization', 'industrialization',
      'great_patriotic', 'reconstruction', 'thaw_and_freeze',
      'stagnation', 'the_eternal',
    ];
    for (const era of eras) {
      expect(ERA_BIRTH_RATE_MULTIPLIER[era]).toBeDefined();
      expect(ERA_BIRTH_RATE_MULTIPLIER[era]).toBeGreaterThan(0);
      expect(ERA_BIRTH_RATE_MULTIPLIER[era]).toBeLessThanOrEqual(1.0);
    }
  });

  it('wartime era has lowest non-fantasy multiplier', () => {
    expect(ERA_BIRTH_RATE_MULTIPLIER['great_patriotic']).toBe(0.4);
    expect(ERA_BIRTH_RATE_MULTIPLIER['great_patriotic']).toBeLessThan(ERA_BIRTH_RATE_MULTIPLIER['revolution']!);
  });
});

describe('birthCheck with era multiplier', () => {
  it('wartime era reduces birth probability', () => {
    // Use a roll that passes under revolution (1.0x) but fails under great_patriotic (0.4x)
    // Monthly birth rate = 0.15/12 = 0.0125
    // With food > 0.8 → foodMod = 1.2
    // revolution threshold: 0.0125 * 1.2 * 1.0 = 0.015
    // great_patriotic threshold: 0.0125 * 1.2 * 0.4 = 0.006
    createTestDvor('dvor-1', [
      { name: 'Father', gender: 'male', age: 30 },
      { name: 'Mother', gender: 'female', age: 25 },
    ]);

    const borderRng = createTestRng();
    borderRng.random = () => 0.01; // passes revolution, fails great_patriotic

    const revolutionResult = emptyDemoResult();
    birthCheck(borderRng, 1.0, revolutionResult, 'revolution');
    expect(revolutionResult.births).toBe(1);

    // Reset pregnancy for same test
    for (const entity of dvory) {
      for (const m of entity.dvor.members) {
        if (m.name === 'Mother') m.pregnant = undefined;
      }
    }

    const warResult = emptyDemoResult();
    birthCheck(borderRng, 1.0, warResult, 'great_patriotic');
    expect(warResult.births).toBe(0);
  });

  it('unknown era defaults to 1.0x multiplier', () => {
    createTestDvor('dvor-1', [
      { name: 'Father', gender: 'male', age: 30 },
      { name: 'Mother', gender: 'female', age: 25 },
    ]);

    const lowRng = createTestRng();
    lowRng.random = () => 0.001;

    const result = emptyDemoResult();
    birthCheck(lowRng, 1.0, result, 'unknown_era');
    expect(result.births).toBe(1);
  });

  it('no eraId defaults to 1.0x multiplier', () => {
    createTestDvor('dvor-1', [
      { name: 'Father', gender: 'male', age: 30 },
      { name: 'Mother', gender: 'female', age: 25 },
    ]);

    const lowRng = createTestRng();
    lowRng.random = () => 0.001;

    const result = emptyDemoResult();
    birthCheck(lowRng, 1.0, result);
    expect(result.births).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Part 7: Pregnancy Tracking
// ═══════════════════════════════════════════════════════════════════════════

describe('pregnancyTick', () => {
  it('decrements pregnancy by 30 ticks per call', () => {
    createTestDvor('dvor-1', [
      { name: 'Father', gender: 'male', age: 30 },
      { name: 'Mother', gender: 'female', age: 28 },
    ]);

    // Set pregnancy manually
    for (const entity of dvory) {
      for (const m of entity.dvor.members) {
        if (m.name === 'Mother') m.pregnant = 90;
      }
    }

    const rng = createTestRng();
    const result = emptyDemoResult();
    pregnancyTick(rng, result);

    const mother = allMembers().find((m) => m.name === 'Mother')!;
    expect(mother.pregnant).toBe(60);
  });

  it('creates infant when pregnancy completes (reaches 0)', () => {
    createTestDvor('dvor-1', [
      { name: 'Father', gender: 'male', age: 30 },
      { name: 'Mother', gender: 'female', age: 28 },
    ]);

    // Set pregnancy to last month
    for (const entity of dvory) {
      for (const m of entity.dvor.members) {
        if (m.name === 'Mother') m.pregnant = 30;
      }
    }

    const beforeCount = totalDvorMembers();
    const rng = createTestRng();
    const result = emptyDemoResult();
    pregnancyTick(rng, result);

    // Infant should now exist
    expect(totalDvorMembers()).toBe(beforeCount + 1);
    const infants = allMembers().filter((m) => m.role === 'infant');
    expect(infants.length).toBe(1);
    expect(infants[0]!.age).toBe(0);

    // Mother's pregnancy should be cleared
    const mother = allMembers().find((m) => m.name === 'Mother')!;
    expect(mother.pregnant).toBeUndefined();
  });

  it('full pregnancy takes 3 monthly ticks to deliver', () => {
    createTestDvor('dvor-1', [
      { name: 'Father', gender: 'male', age: 30 },
      { name: 'Mother', gender: 'female', age: 28 },
    ]);

    for (const entity of dvory) {
      for (const m of entity.dvor.members) {
        if (m.name === 'Mother') m.pregnant = 90;
      }
    }

    const rng = createTestRng();
    const beforeCount = totalDvorMembers();

    // Month 1: 90 → 60
    pregnancyTick(rng, emptyDemoResult());
    expect(totalDvorMembers()).toBe(beforeCount); // no infant yet
    expect(allMembers().find((m) => m.name === 'Mother')!.pregnant).toBe(60);

    // Month 2: 60 → 30
    pregnancyTick(rng, emptyDemoResult());
    expect(totalDvorMembers()).toBe(beforeCount);
    expect(allMembers().find((m) => m.name === 'Mother')!.pregnant).toBe(30);

    // Month 3: 30 → 0 → deliver
    pregnancyTick(rng, emptyDemoResult());
    expect(totalDvorMembers()).toBe(beforeCount + 1);
    expect(allMembers().find((m) => m.name === 'Mother')!.pregnant).toBeUndefined();
  });

  it('pregnant women are not eligible for another pregnancy', () => {
    createTestDvor('dvor-1', [
      { name: 'Father', gender: 'male', age: 30 },
      { name: 'Mother', gender: 'female', age: 25 },
    ]);

    const lowRng = createTestRng();
    lowRng.random = () => 0.001;

    // First conception
    const result1 = emptyDemoResult();
    birthCheck(lowRng, 1.0, result1);
    expect(result1.births).toBe(1);
    expect(allMembers().find((m) => m.name === 'Mother')!.pregnant).toBe(90);

    // Try again — should fail because she's already pregnant
    const result2 = emptyDemoResult();
    birthCheck(lowRng, 1.0, result2);
    expect(result2.births).toBe(0);
  });

  it('does not affect non-pregnant members', () => {
    createTestDvor('dvor-1', [
      { name: 'Father', gender: 'male', age: 30 },
      { name: 'Mother', gender: 'female', age: 28 },
    ]);

    const rng = createTestRng();
    const beforeCount = totalDvorMembers();
    const result = emptyDemoResult();
    pregnancyTick(rng, result);

    // Nothing should change
    expect(totalDvorMembers()).toBe(beforeCount);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Part 8: Working Mother Penalty
// ═══════════════════════════════════════════════════════════════════════════

describe('getWorkingMotherPenalty', () => {
  it('returns 0.7 for a working-age mother with young child and no elder', () => {
    createTestDvor('dvor-1', [
      { name: 'Father', gender: 'male', age: 30 },
      { name: 'Mother', gender: 'female', age: 28 },
      { name: 'Infant', gender: 'male', age: 1 },
    ]);

    const entity = dvory.entities[0]!;
    const mother = entity.dvor.members.find((m) => m.name === 'Mother')!;
    expect(getWorkingMotherPenalty(entity.dvor, mother)).toBe(0.7);
  });

  it('returns 1.0 for a male member (no penalty)', () => {
    createTestDvor('dvor-1', [
      { name: 'Father', gender: 'male', age: 30 },
      { name: 'Mother', gender: 'female', age: 28 },
      { name: 'Infant', gender: 'male', age: 1 },
    ]);

    const entity = dvory.entities[0]!;
    const father = entity.dvor.members.find((m) => m.name === 'Father')!;
    expect(getWorkingMotherPenalty(entity.dvor, father)).toBe(1.0);
  });

  it('returns 1.0 when no young children exist', () => {
    createTestDvor('dvor-1', [
      { name: 'Father', gender: 'male', age: 40 },
      { name: 'Mother', gender: 'female', age: 38 },
      { name: 'Teenager', gender: 'male', age: 15 },
    ]);

    const entity = dvory.entities[0]!;
    const mother = entity.dvor.members.find((m) => m.name === 'Mother')!;
    expect(getWorkingMotherPenalty(entity.dvor, mother)).toBe(1.0);
  });

  it('returns 1.0 when elder female (55+) is present for childcare', () => {
    createTestDvor('dvor-1', [
      { name: 'Father', gender: 'male', age: 30 },
      { name: 'Mother', gender: 'female', age: 28 },
      { name: 'Infant', gender: 'female', age: 0 },
      { name: 'Babushka', gender: 'female', age: 60 },
    ]);

    const entity = dvory.entities[0]!;
    const mother = entity.dvor.members.find((m) => m.name === 'Mother')!;
    expect(getWorkingMotherPenalty(entity.dvor, mother)).toBe(1.0);
  });

  it('returns 1.0 when elder male (60+) is present for childcare', () => {
    createTestDvor('dvor-1', [
      { name: 'Father', gender: 'male', age: 30 },
      { name: 'Mother', gender: 'female', age: 28 },
      { name: 'Toddler', gender: 'male', age: 2 },
      { name: 'Dedushka', gender: 'male', age: 65 },
    ]);

    const entity = dvory.entities[0]!;
    const mother = entity.dvor.members.find((m) => m.name === 'Mother')!;
    expect(getWorkingMotherPenalty(entity.dvor, mother)).toBe(1.0);
  });

  it('returns 0.7 when male elder is under 60 (not old enough for childcare)', () => {
    createTestDvor('dvor-1', [
      { name: 'Father', gender: 'male', age: 30 },
      { name: 'Mother', gender: 'female', age: 28 },
      { name: 'Infant', gender: 'male', age: 0 },
      { name: 'Uncle', gender: 'male', age: 58 },
    ]);

    const entity = dvory.entities[0]!;
    const mother = entity.dvor.members.find((m) => m.name === 'Mother')!;
    expect(getWorkingMotherPenalty(entity.dvor, mother)).toBe(0.7);
  });

  it('returns 1.0 for elder females (not working age)', () => {
    createTestDvor('dvor-1', [
      { name: 'Father', gender: 'male', age: 30 },
      { name: 'Babushka', gender: 'female', age: 60 },
      { name: 'Infant', gender: 'male', age: 1 },
    ]);

    const entity = dvory.entities[0]!;
    const babushka = entity.dvor.members.find((m) => m.name === 'Babushka')!;
    expect(getWorkingMotherPenalty(entity.dvor, babushka)).toBe(1.0);
  });

  it('applies to children age 0-3 but not age 4+', () => {
    createTestDvor('dvor-1', [
      { name: 'Father', gender: 'male', age: 30 },
      { name: 'Mother', gender: 'female', age: 28 },
      { name: 'Child3', gender: 'male', age: 3 },
    ]);

    const entity = dvory.entities[0]!;
    const mother = entity.dvor.members.find((m) => m.name === 'Mother')!;
    expect(getWorkingMotherPenalty(entity.dvor, mother)).toBe(0.7);

    // Age the child to 4 — penalty should no longer apply
    world.clear();
    createTestDvor('dvor-2', [
      { name: 'Father', gender: 'male', age: 31 },
      { name: 'Mother', gender: 'female', age: 29 },
      { name: 'Child4', gender: 'male', age: 4 },
    ]);

    const entity2 = dvory.entities[0]!;
    const mother2 = entity2.dvor.members.find((m) => m.name === 'Mother')!;
    expect(getWorkingMotherPenalty(entity2.dvor, mother2)).toBe(1.0);
  });

  it('penalty is applied to labor capacity during aging', () => {
    createTestDvor('dvor-1', [
      { name: 'Father Testov', gender: 'male', age: 29 },
      { name: 'Mother Testova', gender: 'female', age: 27 },
      { name: 'Infant Testov', gender: 'male', age: 1 },
    ]);

    const result = emptyDemoResult();
    ageAllMembers(result);

    // Mother (now 28) should have penalty applied: 1.0 * 0.7 = 0.7
    const mother = allMembers().find((m) => m.name === 'Mother Testova')!;
    expect(mother.laborCapacity).toBe(0.7);

    // Father (now 30) should have full capacity: 1.0
    const father = allMembers().find((m) => m.name === 'Father Testov')!;
    expect(father.laborCapacity).toBe(1.0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Part 9: Household Formation
// ═══════════════════════════════════════════════════════════════════════════

describe('householdFormation', () => {
  it('pairs eligible male and female from different dvory', () => {
    createTestDvor('dvor-a', [
      { name: 'Head A Testov', gender: 'male', age: 45 },
      { name: 'Spouse A Testova', gender: 'female', age: 43 },
      { name: 'Son Ivanovich Testov', gender: 'male', age: 25 },
    ]);
    createTestDvor('dvor-b', [
      { name: 'Head B Petrov', gender: 'male', age: 50 },
      { name: 'Spouse B Petrova', gender: 'female', age: 48 },
      { name: 'Daughter Petrovna Petrova', gender: 'female', age: 22 },
    ]);

    const alwaysFormRng = createTestRng();
    alwaysFormRng.random = () => 0.01; // under 10% threshold

    const result = emptyDemoResult();
    householdFormation(alwaysFormRng, result);

    expect(result.newDvory).toBe(1);
    // Now should have 3 dvory (original 2 + 1 new)
    expect(dvory.entities.length).toBe(3);

    // New dvor should have 2 members
    const newDvor = dvory.entities.find((e) => e.dvor.id.startsWith('formed-'))!;
    expect(newDvor).toBeDefined();
    expect(newDvor.dvor.members.length).toBe(2);

    // Male is head, female is spouse
    const head = newDvor.dvor.members.find((m) => m.role === 'head')!;
    const spouse = newDvor.dvor.members.find((m) => m.role === 'spouse')!;
    expect(head.gender).toBe('male');
    expect(spouse.gender).toBe('female');
  });

  it('uses male surname for new dvor', () => {
    createTestDvor('dvor-a', [
      { name: 'Head A Testov', gender: 'male', age: 45 },
      { name: 'Spouse A Testova', gender: 'female', age: 43 },
      { name: 'Son Ivanovich Kozlov', gender: 'male', age: 25 },
    ]);
    createTestDvor('dvor-b', [
      { name: 'Head B Petrov', gender: 'male', age: 50 },
      { name: 'Spouse B Petrova', gender: 'female', age: 48 },
      { name: 'Daughter Petrovna Petrova', gender: 'female', age: 22 },
    ]);

    const alwaysFormRng = createTestRng();
    alwaysFormRng.random = () => 0.01;

    const result = emptyDemoResult();
    householdFormation(alwaysFormRng, result);

    const newDvor = dvory.entities.find((e) => e.dvor.id.startsWith('formed-'))!;
    expect(newDvor.dvor.surname).toBe('Kozlov');
  });

  it('new dvor has correct starting properties', () => {
    createTestDvor('dvor-a', [
      { name: 'Head A Testov', gender: 'male', age: 45 },
      { name: 'Son Testov', gender: 'male', age: 24 },
    ]);
    createTestDvor('dvor-b', [
      { name: 'Head B Petrova', gender: 'female', age: 35 },
      { name: 'Sister Petrova', gender: 'female', age: 22 },
    ]);

    const alwaysFormRng = createTestRng();
    alwaysFormRng.random = () => 0.01;

    const result = emptyDemoResult();
    householdFormation(alwaysFormRng, result);

    const newDvor = dvory.entities.find((e) => e.dvor.id.startsWith('formed-'))!;
    expect(newDvor.dvor.privatePlotSize).toBe(0.25);
    expect(newDvor.dvor.loyaltyToCollective).toBe(50);
    expect(newDvor.dvor.privateLivestock).toEqual({ cow: 0, pig: 0, sheep: 0, poultry: 0 });
  });

  it('does not pair members from the same dvor', () => {
    createTestDvor('dvor-only', [
      { name: 'Head Only Testov', gender: 'male', age: 45 },
      { name: 'Son Testov', gender: 'male', age: 25 },
      { name: 'Daughter Testova', gender: 'female', age: 22 },
    ]);

    const alwaysFormRng = createTestRng();
    alwaysFormRng.random = () => 0.01;

    const result = emptyDemoResult();
    householdFormation(alwaysFormRng, result);

    expect(result.newDvory).toBe(0);
  });

  it('does not include heads or spouses as eligible', () => {
    createTestDvor('dvor-a', [
      { name: 'Head A Testov', gender: 'male', age: 30 },
      { name: 'Spouse A Testova', gender: 'female', age: 28 },
    ]);
    createTestDvor('dvor-b', [
      { name: 'Head B Petrov', gender: 'male', age: 32 },
      { name: 'Spouse B Petrova', gender: 'female', age: 30 },
    ]);

    const alwaysFormRng = createTestRng();
    alwaysFormRng.random = () => 0.01;

    const result = emptyDemoResult();
    householdFormation(alwaysFormRng, result);

    // All members are head/spouse — no eligible singles
    expect(result.newDvory).toBe(0);
  });

  it('filters by age range 20-35', () => {
    createTestDvor('dvor-a', [
      { name: 'Head A Testov', gender: 'male', age: 45 },
      { name: 'Teen Testov', gender: 'male', age: 18 }, // too young
    ]);
    createTestDvor('dvor-b', [
      { name: 'Head B Petrova', gender: 'female', age: 50 },
      { name: 'Old Daughter Petrova', gender: 'female', age: 40 }, // too old
    ]);

    const alwaysFormRng = createTestRng();
    alwaysFormRng.random = () => 0.01;

    const result = emptyDemoResult();
    householdFormation(alwaysFormRng, result);

    expect(result.newDvory).toBe(0);
  });

  it('removes members from original dvory', () => {
    createTestDvor('dvor-a', [
      { name: 'Head A Testov', gender: 'male', age: 45 },
      { name: 'Spouse A Testova', gender: 'female', age: 43 },
      { name: 'Son Testov', gender: 'male', age: 25 },
    ]);
    createTestDvor('dvor-b', [
      { name: 'Head B Petrova', gender: 'female', age: 40 },
      { name: 'Daughter Petrova', gender: 'female', age: 23 },
    ]);

    const alwaysFormRng = createTestRng();
    alwaysFormRng.random = () => 0.01;

    const result = emptyDemoResult();
    householdFormation(alwaysFormRng, result);

    const dvorA = dvory.entities.find((e) => e.dvor.id === 'dvor-a')!;
    expect(dvorA.dvor.members.length).toBe(2); // Head + Spouse, Son left

    const dvorB = dvory.entities.find((e) => e.dvor.id === 'dvor-b');
    // dvor-b had Head + Daughter. Daughter left, only Head remains
    expect(dvorB!.dvor.members.length).toBe(1);
  });

  it('daughter leaves when spouse already exists in dvor', () => {
    createTestDvor('dvor-a', [
      { name: 'Head A Testov', gender: 'male', age: 45 },
      { name: 'Spouse A Testova', gender: 'female', age: 43 },
      { name: 'Son Testov', gender: 'male', age: 25 },
    ]);
    // Three-member dvor: Head + Spouse + eligible daughter (Spouse blocks Daughter from being spouse)
    createTestDvor('dvor-b', [
      { name: 'Head B Petrov', gender: 'male', age: 50 },
      { name: 'Spouse B Petrova', gender: 'female', age: 48 },
      { name: 'Daughter Petrova', gender: 'female', age: 22 },
    ]);

    const alwaysFormRng = createTestRng();
    alwaysFormRng.random = () => 0.01;

    const result = emptyDemoResult();
    householdFormation(alwaysFormRng, result);

    expect(result.newDvory).toBe(1);
    // dvor-b: Head + Spouse remain, Daughter left
    const dvorB = dvory.entities.find((e) => e.dvor.id === 'dvor-b')!;
    expect(dvorB.dvor.members.length).toBe(2);
    expect(dvorB.dvor.members.map((m) => m.name)).toContain('Head B Petrov');
    expect(dvorB.dvor.members.map((m) => m.name)).toContain('Spouse B Petrova');
  });

  it('does not form when probability roll exceeds threshold', () => {
    createTestDvor('dvor-a', [
      { name: 'Head A Testov', gender: 'male', age: 45 },
      { name: 'Son Testov', gender: 'male', age: 25 },
    ]);
    createTestDvor('dvor-b', [
      { name: 'Head B Petrov', gender: 'male', age: 50 },
      { name: 'Daughter Petrova', gender: 'female', age: 22 },
    ]);

    const neverFormRng = createTestRng();
    neverFormRng.random = () => 0.5; // above 10% threshold

    const result = emptyDemoResult();
    householdFormation(neverFormRng, result);

    expect(result.newDvory).toBe(0);
    expect(dvory.entities.length).toBe(2);
  });

  it('eligible non-head members leave, original dvor retains head', () => {
    // Three-member dvor: head + spouse + eligible son
    // Son (worker role, age 25) should be eligible to leave
    createTestDvor('dvor-a', [
      { name: 'Old Head Testov', gender: 'male', age: 50 },
      { name: 'Spouse Testova', gender: 'female', age: 48 },
      { name: 'Son Testov', gender: 'male', age: 25 },
    ]);
    createTestDvor('dvor-b', [
      { name: 'Head B Petrov', gender: 'male', age: 45 },
      { name: 'Spouse B Petrova', gender: 'female', age: 43 },
      { name: 'Daughter Petrova', gender: 'female', age: 23 },
    ]);

    const alwaysFormRng = createTestRng();
    alwaysFormRng.random = () => 0.01;

    const result = emptyDemoResult();
    householdFormation(alwaysFormRng, result);

    expect(result.newDvory).toBe(1);

    // dvor-a's head remains intact — Son left
    const dvorA = dvory.entities.find((e) => e.dvor.id === 'dvor-a')!;
    expect(dvorA.dvor.members.length).toBe(2); // Head + Spouse
    expect(dvorA.dvor.headOfHousehold).toBe(dvorA.dvor.members.find((m) => m.name === 'Old Head Testov')!.id);

    // dvor-b's head remains intact — Daughter left
    const dvorB = dvory.entities.find((e) => e.dvor.id === 'dvor-b')!;
    expect(dvorB.dvor.members.length).toBe(2); // Head + Spouse
  });
});

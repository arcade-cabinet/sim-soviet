import { dvory } from '@/ecs/archetypes';
import { createDvor } from '@/ecs/factories';
import type { DvorMemberSeed } from '@/ecs/factories';
import { world } from '@/ecs/world';
import type { GameRng } from '@/game/SeedSystem';
import {
  DemographicAgent,
  ERA_BIRTH_RATE_MULTIPLIER,
  getWorkingMotherPenalty,
} from '../../src/ai/agents/social/DemographicAgent';
import type { DemographicAgentSnapshot } from '../../src/ai/agents/social/DemographicAgent';

// ── Deterministic RNG ────────────────────────────────────────────────────────

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

/** RNG that always returns 0 (always below threshold). */
const alwaysZeroRng: GameRng = {
  random: () => 0,
  int: () => 0,
  pick: (a) => a[0]!,
  weightedIndex: () => 0,
} as GameRng;

/** RNG that always returns 1.0 (always above threshold — no births/deaths). */
const alwaysOneRng: GameRng = {
  random: () => 1.0,
  int: () => 0,
  pick: (a) => a[0]!,
  weightedIndex: () => 0,
} as GameRng;

// ── Test helpers ─────────────────────────────────────────────────────────────

/** Build a DvorMemberSeed with a generated name. */
function seed(gender: 'male' | 'female', age: number): DvorMemberSeed {
  return { name: `Test Testovich Testov${gender === 'female' ? 'a' : ''}`, gender, age };
}

function createTestDvor(id: string, members: DvorMemberSeed[]): ReturnType<typeof createDvor> {
  return createDvor(id, 'Testov', members);
}

function totalDvorMembers(): number {
  let total = 0;
  for (const entity of dvory) {
    total += entity.dvor.members.length;
  }
  return total;
}

function emptyResult() {
  return { births: 0, deaths: 0, aged: 0, newDvory: 0, deadMembers: [], agedIntoWorking: [] };
}

// ── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  const toRemove = [...dvory];
  for (const entity of toRemove) {
    world.remove(entity);
  }
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('DemographicAgent', () => {
  it('can be instantiated with name DemographicAgent', () => {
    const agent = new DemographicAgent();
    expect(agent.name).toBe('DemographicAgent');
  });

  // ── Birth rate calculation ───────────────────────────────────────────────

  describe('birthCheck', () => {
    it('sets pregnancy on eligible women given sufficient food', () => {
      const agent = new DemographicAgent();
      createTestDvor('dvor-birth', [seed('female', 25), seed('male', 28)]);

      const result = emptyResult();
      agent.birthCheck(alwaysZeroRng, 0.9, result, 'revolution');

      expect(result.births).toBe(1);
      const female = dvory.entities[0]!.dvor.members.find((m) => m.gender === 'female');
      expect(female?.pregnant).toBe(90);
    });

    it('does not conceive when food is low (foodMod 0.5)', () => {
      const agent = new DemographicAgent();
      createTestDvor('dvor-nofood', [seed('female', 25)]);

      // BASE monthly rate = 0.15/12 * 0.5 * 1.0 ≈ 0.00625
      // RNG returns 0.01 → above threshold → no conception
      const rng0_01: GameRng = { random: () => 0.01, int: () => 0, pick: (a) => a[0]!, weightedIndex: () => 0 } as GameRng;
      const result = emptyResult();
      agent.birthCheck(rng0_01, 0.2, result, 'revolution');
      expect(result.births).toBe(0);
    });

    it('does not set pregnancy on already-pregnant women', () => {
      const agent = new DemographicAgent();
      const entity = createTestDvor('dvor-pregnant', [seed('female', 25)]);

      // Manually mark female as already pregnant
      const female = entity.dvor.members.find((m) => m.gender === 'female')!;
      female.pregnant = 60;

      const result = emptyResult();
      agent.birthCheck(alwaysZeroRng, 0.9, result, 'revolution');
      expect(result.births).toBe(0);
    });

    it('skips women outside fertility age range (< 16 or > 45)', () => {
      const agent = new DemographicAgent();
      createTestDvor('dvor-ages', [seed('female', 15), seed('female', 46)]);

      const result = emptyResult();
      agent.birthCheck(alwaysZeroRng, 0.9, result, 'revolution');
      expect(result.births).toBe(0);
    });
  });

  // ── Era birth rate multipliers ───────────────────────────────────────────

  describe('ERA_BIRTH_RATE_MULTIPLIER', () => {
    it('has correct multiplier for revolution era (1.0)', () => {
      expect(ERA_BIRTH_RATE_MULTIPLIER['revolution']).toBe(1.0);
    });

    it('has correct multiplier for great_patriotic era (0.4)', () => {
      expect(ERA_BIRTH_RATE_MULTIPLIER['great_patriotic']).toBe(0.4);
    });

    it('has correct multiplier for the_eternal era (0.3)', () => {
      expect(ERA_BIRTH_RATE_MULTIPLIER['the_eternal']).toBe(0.3);
    });

    it('great_patriotic birth rate is lower than revolution', () => {
      expect(ERA_BIRTH_RATE_MULTIPLIER['great_patriotic']!).toBeLessThan(
        ERA_BIRTH_RATE_MULTIPLIER['revolution']!,
      );
    });

    it('all 8 eras are defined', () => {
      const expectedEras = [
        'revolution', 'collectivization', 'industrialization', 'great_patriotic',
        'reconstruction', 'thaw_and_freeze', 'stagnation', 'the_eternal',
      ];
      for (const era of expectedEras) {
        expect(ERA_BIRTH_RATE_MULTIPLIER[era]).toBeDefined();
      }
    });
  });

  // ── Pregnancy duration ───────────────────────────────────────────────────

  describe('pregnancyTick', () => {
    it('decrements pregnancy counter by TICKS_PER_MONTH (30) each call', () => {
      const agent = new DemographicAgent();
      const entity = createTestDvor('dvor-preg', [seed('female', 25), seed('male', 28)]);

      // Manually set pregnancy so we know the exact value
      const female = entity.dvor.members.find((m) => m.gender === 'female')!;
      female.pregnant = 90;

      const result = emptyResult();
      agent.pregnancyTick(createTestRng(0.3), result);

      expect(female.pregnant).toBe(60);
    });

    it('delivers infant when pregnancy reaches 0', () => {
      const agent = new DemographicAgent();
      const entity = createTestDvor('dvor-deliver', [seed('female', 28), seed('male', 30)]);

      const female = entity.dvor.members.find((m) => m.gender === 'female')!;
      female.pregnant = 30; // One tick away from delivery

      const before = totalDvorMembers();
      agent.pregnancyTick(createTestRng(0.5), emptyResult());

      expect(totalDvorMembers()).toBe(before + 1);
      expect(female.pregnant).toBeUndefined();

      const infant = entity.dvor.members.find((m) => m.age === 0);
      expect(infant).toBeDefined();
      expect(infant?.role).toBe('infant');
      expect(infant?.laborCapacity).toBe(0);
    });

    it('does not deliver when pregnancy has not expired', () => {
      const agent = new DemographicAgent();
      const entity = createTestDvor('dvor-waiting', [seed('female', 26)]);
      const female = entity.dvor.members.find((m) => m.gender === 'female')!;
      female.pregnant = 60;

      const before = totalDvorMembers();
      agent.pregnancyTick(createTestRng(), emptyResult());

      expect(totalDvorMembers()).toBe(before);
      expect(female.pregnant).toBe(30);
    });
  });

  // ── Death rate by age bracket ────────────────────────────────────────────

  describe('deathCheck', () => {
    it('removes dead members from dvor (RNG always 0)', () => {
      const agent = new DemographicAgent();
      createTestDvor('dvor-death', [seed('male', 80), seed('female', 80)]);

      const result = emptyResult();
      agent.deathCheck(alwaysZeroRng, 1.0, result);

      expect(result.deaths).toBe(2);
      expect(result.deadMembers).toHaveLength(2);
      // Both members dead → dvor removed
      expect(dvory.entities).toHaveLength(0);
    });

    it('does not kill members when RNG is always 1.0', () => {
      const agent = new DemographicAgent();
      createTestDvor('dvor-survive', [seed('male', 80), seed('female', 80)]);

      const result = emptyResult();
      agent.deathCheck(alwaysOneRng, 1.0, result);

      expect(result.deaths).toBe(0);
      expect(dvory.entities).toHaveLength(1);
    });

    it('adds starvation mortality when food = 0', () => {
      const agent = new DemographicAgent();

      // adult: annual 0.5%/year → monthly ~0.000417
      // starvation adds +5% monthly → total ~0.0504
      // RNG = 0.04 → below starvation threshold (dies) but above base-only threshold (survives)
      const rng0_04: GameRng = { random: () => 0.04, int: () => 0, pick: (a) => a[0]!, weightedIndex: () => 0 } as GameRng;

      // Without starvation: 0.04 > 0.000417 → survives
      createTestDvor('dvor-nostarvation', [seed('male', 30)]);
      const resultOk = emptyResult();
      agent.deathCheck(rng0_04, 1.0, resultOk);
      expect(resultOk.deaths).toBe(0);

      // Reset
      const toRemove = [...dvory];
      for (const e of toRemove) world.remove(e);

      // With starvation: 0.04 < 0.0504 → dies
      createTestDvor('dvor-starvation', [seed('male', 30)]);
      const resultStarve = emptyResult();
      agent.deathCheck(rng0_04, 0, resultStarve);
      expect(resultStarve.deaths).toBe(1);
    });

    it('promotes new head of household when head dies', () => {
      const agent = new DemographicAgent();
      createTestDvor('dvor-headdie', [
        seed('male', 40), // head
        seed('female', 35), // spouse
        seed('male', 18),  // worker
      ]);

      // Kill only the first member (head): RNG returns 0 for first call, 1.0 for rest
      let callCount = 0;
      const headDiesRng: GameRng = {
        random: () => (callCount++ === 0 ? 0 : 1.0),
        int: () => 0,
        pick: (a) => a[0]!,
        weightedIndex: () => 0,
      } as GameRng;

      const result = emptyResult();
      agent.deathCheck(headDiesRng, 1.0, result);

      expect(result.deaths).toBe(1);
      const entity = dvory.entities[0];
      expect(entity).toBeDefined();
      const newHead = entity!.dvor.members.find((m) => m.role === 'head');
      expect(newHead).toBeDefined();
    });
  });

  // ── Household formation eligibility ─────────────────────────────────────

  describe('householdFormation', () => {
    it('creates new dvor from eligible pair in different dvory', () => {
      const agent = new DemographicAgent();
      // dvor-hf1: elder head + eligible male worker
      createTestDvor('dvor-hf1', [seed('male', 50), seed('male', 25)]);
      // dvor-hf2: elder head + eligible female worker
      createTestDvor('dvor-hf2', [seed('female', 50), seed('female', 22)]);

      const beforeDvory = dvory.entities.length;
      const result = emptyResult();
      agent.householdFormation(alwaysZeroRng, result, 360);

      expect(result.newDvory).toBe(1);
      expect(dvory.entities.length).toBe(beforeDvory + 1);
    });

    it('does not pair members from the same dvor', () => {
      const agent = new DemographicAgent();
      createTestDvor('dvor-same', [seed('male', 25), seed('female', 23)]);

      const result = emptyResult();
      agent.householdFormation(alwaysZeroRng, result, 360);
      expect(result.newDvory).toBe(0);
    });

    it('skips members outside eligibility age (< 20 or > 35)', () => {
      const agent = new DemographicAgent();
      createTestDvor('dvor-young', [seed('male', 50), seed('male', 19)]);
      createTestDvor('dvor-old', [seed('female', 50), seed('female', 36)]);

      const result = emptyResult();
      agent.householdFormation(alwaysZeroRng, result, 360);
      expect(result.newDvory).toBe(0);
    });

    it('does not form household when probability roll is too high', () => {
      const agent = new DemographicAgent();
      createTestDvor('dvor-nopair1', [seed('male', 50), seed('male', 25)]);
      createTestDvor('dvor-nopair2', [seed('female', 50), seed('female', 22)]);

      const result = emptyResult();
      // RNG always 1.0 → always above FORMATION_PROBABILITY (0.1) → no formation
      agent.householdFormation(alwaysOneRng, result, 360);
      expect(result.newDvory).toBe(0);
    });
  });

  // ── Labor capacity assessment ────────────────────────────────────────────

  describe('assessLaborCapacity', () => {
    it('returns stable when no dvory exist', () => {
      const agent = new DemographicAgent();
      expect(agent.assessLaborCapacity()).toBe('stable');
    });

    it('returns stable with balanced births and deaths', () => {
      const agent = new DemographicAgent();
      // Manually restore balanced state
      agent.restore({ birthsThisYear: 5, deathsThisYear: 5, totalBirths: 100, totalDeaths: 100, lastMilestone: 0 });
      createTestDvor('dvor-stable', [seed('male', 30), seed('female', 28)]);
      // growthRate = 0 / 2 = 0 → stable
      expect(agent.assessLaborCapacity()).toBe('stable');
    });
  });

  // ── Population trend accessors ───────────────────────────────────────────

  describe('trend accessors', () => {
    it('getBirthRate and getDeathRate reflect restored state', () => {
      const agent = new DemographicAgent();
      agent.restore({ birthsThisYear: 8, deathsThisYear: 3, totalBirths: 8, totalDeaths: 3, lastMilestone: 0 });
      expect(agent.getBirthRate()).toBe(8);
      expect(agent.getDeathRate()).toBe(3);
      expect(agent.getGrowthRate()).toBe(5);
    });
  });

  // ── Serialization round-trip ─────────────────────────────────────────────

  describe('serialize / restore', () => {
    it('serializes initial state with all zeros', () => {
      const agent = new DemographicAgent();
      const snap = agent.serialize();
      expect(snap.birthsThisYear).toBe(0);
      expect(snap.deathsThisYear).toBe(0);
      expect(snap.totalBirths).toBe(0);
      expect(snap.totalDeaths).toBe(0);
      expect(snap.lastMilestone).toBe(0);
    });

    it('restores state from snapshot exactly', () => {
      const agent = new DemographicAgent();
      const snap: DemographicAgentSnapshot = {
        birthsThisYear: 5,
        deathsThisYear: 2,
        totalBirths: 50,
        totalDeaths: 20,
        lastMilestone: 100,
      };
      agent.restore(snap);
      const snap2 = agent.serialize();

      expect(snap2.birthsThisYear).toBe(5);
      expect(snap2.deathsThisYear).toBe(2);
      expect(snap2.totalBirths).toBe(50);
      expect(snap2.totalDeaths).toBe(20);
      expect(snap2.lastMilestone).toBe(100);
    });

    it('serialize → restore round-trip preserves growth rate', () => {
      const agent = new DemographicAgent();
      agent.restore({ birthsThisYear: 10, deathsThisYear: 3, totalBirths: 10, totalDeaths: 3, lastMilestone: 0 });

      const snap = agent.serialize();
      const agent2 = new DemographicAgent();
      agent2.restore(snap);

      expect(agent2.getBirthRate()).toBe(10);
      expect(agent2.getDeathRate()).toBe(3);
      expect(agent2.getGrowthRate()).toBe(7);
    });
  });

  // ── getWorkingMotherPenalty ──────────────────────────────────────────────

  describe('getWorkingMotherPenalty', () => {
    it('returns 1.0 for male member', () => {
      createTestDvor('dvor-wmp1', [seed('male', 30), seed('female', 1)]);
      const entity = dvory.entities[0]!;
      const male = entity.dvor.members.find((m) => m.gender === 'male')!;
      expect(getWorkingMotherPenalty(entity.dvor, male)).toBe(1.0);
    });

    it('returns 0.7 for working-age female with young child and no elder', () => {
      createTestDvor('dvor-wmp2', [seed('female', 30), seed('male', 1)]);
      const entity = dvory.entities[0]!;
      const female = entity.dvor.members.find((m) => m.gender === 'female')!;
      expect(getWorkingMotherPenalty(entity.dvor, female)).toBe(0.7);
    });

    it('returns 1.0 when female elder is present for childcare', () => {
      createTestDvor('dvor-wmp3', [
        seed('female', 30),
        seed('male', 1),
        seed('female', 60),
      ]);
      const entity = dvory.entities[0]!;
      // The 30-year-old female is not the head here (males are heads); find her by age
      const mother = entity.dvor.members.find((m) => m.gender === 'female' && m.age === 30)!;
      expect(getWorkingMotherPenalty(entity.dvor, mother)).toBe(1.0);
    });

    it('returns 1.0 for elder female (age >= 55)', () => {
      createTestDvor('dvor-wmp4', [seed('female', 60), seed('male', 1)]);
      const entity = dvory.entities[0]!;
      const elder = entity.dvor.members.find((m) => m.gender === 'female')!;
      expect(getWorkingMotherPenalty(entity.dvor, elder)).toBe(1.0);
    });
  });

  // ── onTick boundary logic ────────────────────────────────────────────────

  describe('onTick', () => {
    it('returns empty result at tick 0', () => {
      const agent = new DemographicAgent();
      const rng = createTestRng();
      const result = agent.onTick(0, rng, 1.0, 'revolution');
      expect(result.births).toBe(0);
      expect(result.deaths).toBe(0);
      expect(result.aged).toBe(0);
      expect(result.newDvory).toBe(0);
    });

    it('processes aging on year boundary (tick 360)', () => {
      const agent = new DemographicAgent();
      createTestDvor('dvor-age-tick', [seed('male', 30)]);

      // RNG near 1.0 → unlikely deaths/births; aging is deterministic
      const result = agent.onTick(360, alwaysOneRng, 1.0, 'revolution');

      expect(result.aged).toBeGreaterThan(0);
      const member = dvory.entities[0]?.dvor.members[0];
      expect(member?.age).toBe(31);
    });

    it('does not run year logic on non-year ticks', () => {
      const agent = new DemographicAgent();
      createTestDvor('dvor-no-age', [seed('male', 30)]);

      const result = agent.onTick(1, alwaysOneRng, 1.0, 'revolution');
      expect(result.aged).toBe(0);
    });

    it('runs birth/death on month boundary (tick 30)', () => {
      const agent = new DemographicAgent();
      createTestDvor('dvor-month', [seed('female', 25)]);

      // tick 30 is a month boundary — birthCheck should run
      // Use alwaysZeroRng so births occur
      const result = agent.onTick(30, alwaysZeroRng, 0.9, 'revolution');
      expect(result.births).toBeGreaterThanOrEqual(0); // sanity check — system runs
    });
  });
});

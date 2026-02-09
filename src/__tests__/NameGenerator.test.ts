import { describe, it, expect, beforeEach } from 'vitest';
import {
  NameGenerator,
  MALE_GIVEN_NAMES,
  FEMALE_GIVEN_NAMES,
  PATRONYMIC_FATHER_NAMES,
  PATRONYMIC_RULES,
  SURNAMES_MALE,
  SURNAMES_FEMALE,
  TITLES,
  ALL_TITLES,
  EPITHETS,
  CITY_NAMES,
  nameGenerator,
} from '../ai/NameGenerator';

describe('NameGenerator', () => {
  let gen: NameGenerator;

  beforeEach(() => {
    gen = new NameGenerator('Novosibirsk');
  });

  // ── Data pool sizes ───────────────────────────────────

  describe('name pool sizes', () => {
    it('has at least 60 male given names', () => {
      expect(MALE_GIVEN_NAMES.length).toBeGreaterThanOrEqual(60);
    });

    it('has at least 30 female given names', () => {
      expect(FEMALE_GIVEN_NAMES.length).toBeGreaterThanOrEqual(30);
    });

    it('has at least 80 patronymic father names', () => {
      expect(PATRONYMIC_FATHER_NAMES.length).toBeGreaterThanOrEqual(80);
    });

    it('has at least 150 male surnames', () => {
      expect(SURNAMES_MALE.length).toBeGreaterThanOrEqual(150);
    });

    it('has at least 150 female surnames', () => {
      expect(SURNAMES_FEMALE.length).toBeGreaterThanOrEqual(150);
    });

    it('has at least 50 titles across all categories', () => {
      expect(ALL_TITLES.length).toBeGreaterThanOrEqual(50);
    });

    it('has at least 60 epithets', () => {
      expect(EPITHETS.length).toBeGreaterThanOrEqual(60);
    });

    it('has at least 30 city names', () => {
      expect(CITY_NAMES.length).toBeGreaterThanOrEqual(30);
    });
  });

  // ── No duplicates in pools ────────────────────────────

  describe('no duplicates in data pools', () => {
    it('male given names are unique', () => {
      const set = new Set(MALE_GIVEN_NAMES);
      expect(set.size).toBe(MALE_GIVEN_NAMES.length);
    });

    it('female given names are unique', () => {
      const set = new Set(FEMALE_GIVEN_NAMES);
      expect(set.size).toBe(FEMALE_GIVEN_NAMES.length);
    });

    it('patronymic father names are unique', () => {
      const set = new Set(PATRONYMIC_FATHER_NAMES);
      expect(set.size).toBe(PATRONYMIC_FATHER_NAMES.length);
    });

    it('male surnames are unique', () => {
      const set = new Set(SURNAMES_MALE);
      expect(set.size).toBe(SURNAMES_MALE.length);
    });

    it('epithets are unique', () => {
      const set = new Set(EPITHETS);
      expect(set.size).toBe(EPITHETS.length);
    });
  });

  // ── Patronymic generation ─────────────────────────────

  describe('patronymic rules', () => {
    it('generates male patronymic from "Ivan" -> "Ivanovich"', () => {
      expect(PATRONYMIC_RULES.generate('Ivan', 'male')).toBe('Ivanovich');
    });

    it('generates female patronymic from "Ivan" -> "Ivanovna"', () => {
      expect(PATRONYMIC_RULES.generate('Ivan', 'female')).toBe('Ivanovna');
    });

    it('handles irregular "Ilya" -> "Ilyich" / "Ilyinichna"', () => {
      expect(PATRONYMIC_RULES.generate('Ilya', 'male')).toBe('Ilyich');
      expect(PATRONYMIC_RULES.generate('Ilya', 'female')).toBe('Ilyinichna');
    });

    it('handles irregular "Lev" -> "Lvovich" / "Lvovna"', () => {
      expect(PATRONYMIC_RULES.generate('Lev', 'male')).toBe('Lvovich');
      expect(PATRONYMIC_RULES.generate('Lev', 'female')).toBe('Lvovna');
    });

    it('handles irregular "Pavel" -> "Pavlovich" / "Pavlovna"', () => {
      expect(PATRONYMIC_RULES.generate('Pavel', 'male')).toBe('Pavlovich');
      expect(PATRONYMIC_RULES.generate('Pavel', 'female')).toBe('Pavlovna');
    });

    it('handles "Sergei" -> "Sergeevich" / "Sergeevna"', () => {
      expect(PATRONYMIC_RULES.generate('Sergei', 'male')).toBe('Sergeevich');
      expect(PATRONYMIC_RULES.generate('Sergei', 'female')).toBe('Sergeevna');
    });

    it('handles "Dmitri" -> "Dmitrievich" / "Dmitrievna"', () => {
      expect(PATRONYMIC_RULES.generate('Dmitri', 'male')).toBe('Dmitrievich');
      expect(PATRONYMIC_RULES.generate('Dmitri', 'female')).toBe('Dmitrievna');
    });

    it('handles regular consonant-ending names', () => {
      expect(PATRONYMIC_RULES.generate('Viktor', 'male')).toBe('Viktorovich');
      expect(PATRONYMIC_RULES.generate('Viktor', 'female')).toBe('Viktorovna');
    });

    it('handles "Boris" -> falls through to consonant rule', () => {
      expect(PATRONYMIC_RULES.generate('Boris', 'male')).toBe('Borisovich');
      expect(PATRONYMIC_RULES.generate('Boris', 'female')).toBe('Borisovna');
    });

    it('generates a patronymic for every father name in the pool', () => {
      for (const father of PATRONYMIC_FATHER_NAMES) {
        const male = PATRONYMIC_RULES.generate(father, 'male');
        const female = PATRONYMIC_RULES.generate(father, 'female');
        expect(male).toBeTruthy();
        expect(female).toBeTruthy();
        expect(male.length).toBeGreaterThan(3);
        expect(female.length).toBeGreaterThan(3);
      }
    });
  });

  // ── Title categories ──────────────────────────────────

  describe('title categories', () => {
    it('has all expected categories', () => {
      expect(Object.keys(TITLES)).toContain('party');
      expect(Object.keys(TITLES)).toContain('state');
      expect(Object.keys(TITLES)).toContain('security');
      expect(Object.keys(TITLES)).toContain('military');
      expect(Object.keys(TITLES)).toContain('ministry');
      expect(Object.keys(TITLES)).toContain('local');
    });

    it('each category has at least 5 titles', () => {
      for (const [category, titles] of Object.entries(TITLES)) {
        expect(titles.length, `category "${category}" too small`).toBeGreaterThanOrEqual(5);
      }
    });
  });

  // ── Single generation ─────────────────────────────────

  describe('generate()', () => {
    it('returns a complete GeneratedLeader object', () => {
      const leader = gen.generate();
      expect(leader.givenName).toBeTruthy();
      expect(leader.patronymic).toBeTruthy();
      expect(leader.surname).toBeTruthy();
      expect(leader.gender).toMatch(/^(male|female)$/);
      expect(leader.formalName).toBeTruthy();
      expect(leader.westernName).toBeTruthy();
      expect(leader.shortName).toBeTruthy();
      expect(leader.title).toBeTruthy();
      expect(leader.epithet).toBeTruthy();
      expect(leader.introduction).toBeTruthy();
    });

    it('formalName is "Surname Given Patronymic" order', () => {
      const leader = gen.generate();
      expect(leader.formalName).toBe(
        `${leader.surname} ${leader.givenName} ${leader.patronymic}`
      );
    });

    it('westernName is "Given Patronymic Surname" order', () => {
      const leader = gen.generate();
      expect(leader.westernName).toBe(
        `${leader.givenName} ${leader.patronymic} ${leader.surname}`
      );
    });

    it('shortName uses initials + surname', () => {
      const leader = gen.generate();
      expect(leader.shortName).toBe(
        `${leader.givenName[0]}.${leader.patronymic[0]}. ${leader.surname}`
      );
    });

    it('introduction contains title, surname, and epithet', () => {
      const leader = gen.generate();
      expect(leader.introduction).toContain(leader.surname);
      expect(leader.introduction).toContain(leader.epithet);
    });

    it('respects forced gender=male', () => {
      for (let i = 0; i < 20; i++) {
        const leader = gen.generate({ gender: 'male' });
        expect(leader.gender).toBe('male');
        expect(MALE_GIVEN_NAMES).toContain(leader.givenName);
      }
    });

    it('respects forced gender=female', () => {
      for (let i = 0; i < 20; i++) {
        const leader = gen.generate({ gender: 'female' });
        expect(leader.gender).toBe('female');
        expect(FEMALE_GIVEN_NAMES).toContain(leader.givenName);
      }
    });

    it('respects forced titleCategory', () => {
      for (let i = 0; i < 20; i++) {
        const leader = gen.generate({ titleCategory: 'security' });
        // The generated title should be one from the security pool
        // (after {CITY} replacement)
        const securityTitles = TITLES.security.map((t) =>
          t.replace(/\{CITY\}/g, 'Novosibirsk')
        );
        expect(securityTitles).toContain(leader.title);
      }
    });

    it('respects forced epithet', () => {
      const leader = gen.generate({ epithet: 'The Corn Enthusiast' });
      expect(leader.epithet).toBe('The Corn Enthusiast');
    });

    it('replaces {CITY} placeholder in titles', () => {
      gen.setCityName('Stalingrad');
      // Generate many leaders to increase chance of hitting a {CITY} title
      for (let i = 0; i < 50; i++) {
        const leader = gen.generate({ titleCategory: 'local' });
        expect(leader.title).not.toContain('{CITY}');
        if (leader.title.includes('Stalingrad')) {
          // Confirmed replacement works
          return;
        }
      }
      // If we get here, that's fine -- not all local titles have {CITY}
    });
  });

  // ── Uniqueness ────────────────────────────────────────

  describe('uniqueness tracking', () => {
    it('tracks generated count', () => {
      expect(gen.generatedCount).toBe(0);
      gen.generate();
      expect(gen.generatedCount).toBe(1);
      gen.generate();
      expect(gen.generatedCount).toBe(2);
    });

    it('generates 100 unique name combinations', () => {
      const names = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const leader = gen.generate();
        names.add(leader.formalName);
      }
      expect(names.size).toBe(100);
    });

    it('reset clears the duplicate tracker', () => {
      gen.generate();
      gen.generate();
      expect(gen.generatedCount).toBe(2);
      gen.reset();
      expect(gen.generatedCount).toBe(0);
    });
  });

  // ── Batch generation ──────────────────────────────────

  describe('generateBatch()', () => {
    it('generates the requested number of leaders', () => {
      const batch = gen.generateBatch(10);
      expect(batch).toHaveLength(10);
    });

    it('all leaders in a batch have unique formal names', () => {
      const batch = gen.generateBatch(50);
      const names = new Set(batch.map((l) => l.formalName));
      expect(names.size).toBe(50);
    });

    it('respects options across the batch', () => {
      const batch = gen.generateBatch(10, { gender: 'female' });
      for (const leader of batch) {
        expect(leader.gender).toBe('female');
      }
    });
  });

  // ── Politburo generation ──────────────────────────────

  describe('generatePolitburo()', () => {
    it('generates one leader per title category', () => {
      const politburo = gen.generatePolitburo();
      const categories = Object.keys(TITLES);
      for (const cat of categories) {
        expect(politburo[cat]).toBeDefined();
        expect(politburo[cat]!.givenName).toBeTruthy();
      }
    });
  });

  // ── Cabinet generation ────────────────────────────────

  describe('generateCabinet()', () => {
    it('generates one leader per ministry title', () => {
      const cabinet = gen.generateCabinet();
      expect(cabinet).toHaveLength(TITLES.ministry.length);
    });

    it('each cabinet member has a ministry title', () => {
      const cabinet = gen.generateCabinet();
      for (const minister of cabinet) {
        expect(minister.title).toContain('Minister');
      }
    });
  });

  // ── Default singleton ─────────────────────────────────

  describe('nameGenerator singleton', () => {
    it('is an instance of NameGenerator', () => {
      expect(nameGenerator).toBeInstanceOf(NameGenerator);
    });

    it('can generate a leader', () => {
      const leader = nameGenerator.generate();
      expect(leader.formalName).toBeTruthy();
    });
  });
});

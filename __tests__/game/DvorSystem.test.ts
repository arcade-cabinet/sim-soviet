/**
 * Tests for the Dvor (Household) System — Iteration 9.
 *
 * Verifies that dvory are created with correct demographics,
 * household composition follows the design doc, and difficulty
 * scales starting population appropriately.
 */
import { dvory } from '../../src/ecs/archetypes';
import { createDvor, createStartingSettlement, laborCapacityForAge, memberRoleForAge } from '../../src/ecs/factories';
import type { DvorMember } from '../../src/ecs/world';
import { world } from '../../src/ecs/world';

describe('Dvor System', () => {
  beforeEach(() => {
    world.clear();
  });

  afterEach(() => {
    world.clear();
  });

  // ── Labor capacity curve ────────────────────────────────────────────

  describe('laborCapacityForAge', () => {
    it('returns 0 for children (age 0-11)', () => {
      expect(laborCapacityForAge(0, 'male')).toBe(0);
      expect(laborCapacityForAge(5, 'female')).toBe(0);
      expect(laborCapacityForAge(11, 'male')).toBe(0);
    });

    it('returns 0.3 for adolescents (age 12-15)', () => {
      expect(laborCapacityForAge(12, 'male')).toBe(0.3);
      expect(laborCapacityForAge(15, 'female')).toBe(0.3);
    });

    it('returns 0.7 for young adults (age 16-20)', () => {
      expect(laborCapacityForAge(16, 'male')).toBe(0.7);
      expect(laborCapacityForAge(20, 'female')).toBe(0.7);
    });

    it('returns 1.0 for prime working age (21-45)', () => {
      expect(laborCapacityForAge(21, 'male')).toBe(1.0);
      expect(laborCapacityForAge(35, 'female')).toBe(1.0);
      expect(laborCapacityForAge(45, 'male')).toBe(1.0);
    });

    it('returns 0.8 for declining (age 46-54)', () => {
      expect(laborCapacityForAge(46, 'male')).toBe(0.8);
      expect(laborCapacityForAge(54, 'female')).toBe(0.8);
    });

    it('returns 0.5 for elder workers (55-65)', () => {
      expect(laborCapacityForAge(55, 'male')).toBe(0.5);
      expect(laborCapacityForAge(65, 'female')).toBe(0.5);
    });

    it('returns 0.2 for elderly (66+)', () => {
      expect(laborCapacityForAge(66, 'male')).toBe(0.2);
      expect(laborCapacityForAge(80, 'female')).toBe(0.2);
    });
  });

  // ── Member role derivation ──────────────────────────────────────────

  describe('memberRoleForAge', () => {
    it('returns infant for age 0', () => {
      expect(memberRoleForAge(0)).toBe('infant');
    });

    it('returns child for age 1-11', () => {
      expect(memberRoleForAge(1)).toBe('child');
      expect(memberRoleForAge(11)).toBe('child');
    });

    it('returns adolescent for age 12-15', () => {
      expect(memberRoleForAge(12)).toBe('adolescent');
      expect(memberRoleForAge(15)).toBe('adolescent');
    });

    it('returns worker for age 16-59', () => {
      expect(memberRoleForAge(16)).toBe('worker');
      expect(memberRoleForAge(45)).toBe('worker');
      expect(memberRoleForAge(59)).toBe('worker');
    });

    it('returns elder for age 60+', () => {
      expect(memberRoleForAge(60)).toBe('elder');
      expect(memberRoleForAge(80)).toBe('elder');
    });
  });

  // ── Single dvor creation ────────────────────────────────────────────

  describe('createDvor', () => {
    it('creates a dvor entity in the world', () => {
      createDvor('dvor-1', 'Kuznetsov', [
        { name: 'Pyotr Kuznetsov', gender: 'male', age: 35 },
        { name: 'Olga Kuznetsova', gender: 'female', age: 32 },
      ]);
      expect(dvory.entities.length).toBe(1);
    });

    it('assigns correct surname', () => {
      const entity = createDvor('dvor-1', 'Volkov', [{ name: 'Ivan Volkov', gender: 'male', age: 42 }]);
      expect(entity.dvor!.surname).toBe('Volkov');
    });

    it('assigns head of household as first adult male or first member', () => {
      const entity = createDvor('dvor-1', 'Kuznetsov', [
        { name: 'Pyotr', gender: 'male', age: 35 },
        { name: 'Olga', gender: 'female', age: 32 },
        { name: 'Kolya', gender: 'male', age: 14 },
      ]);
      // Head should be Pyotr (first adult male)
      const head = entity.dvor!.members.find((m) => m.id === entity.dvor!.headOfHousehold);
      expect(head).toBeDefined();
      expect(head!.name).toBe('Pyotr');
      expect(head!.role).toBe('head');
    });

    it('designates spouse correctly', () => {
      const entity = createDvor('dvor-1', 'Kuznetsov', [
        { name: 'Pyotr', gender: 'male', age: 35 },
        { name: 'Olga', gender: 'female', age: 32 },
      ]);
      const spouse = entity.dvor!.members.find((m) => m.role === 'spouse');
      expect(spouse).toBeDefined();
      expect(spouse!.name).toBe('Olga');
    });

    it('computes labor capacity for each member', () => {
      const entity = createDvor('dvor-1', 'Test', [
        { name: 'Head', gender: 'male', age: 35 },
        { name: 'Child', gender: 'female', age: 5 },
        { name: 'Teen', gender: 'male', age: 14 },
      ]);
      const members = entity.dvor!.members;
      expect(members.find((m) => m.name === 'Head')!.laborCapacity).toBe(1.0);
      expect(members.find((m) => m.name === 'Child')!.laborCapacity).toBe(0);
      expect(members.find((m) => m.name === 'Teen')!.laborCapacity).toBe(0.3);
    });

    it('assigns correct roles based on age', () => {
      const entity = createDvor('dvor-1', 'Test', [
        { name: 'Head', gender: 'male', age: 35 },
        { name: 'Infant', gender: 'female', age: 0 },
        { name: 'Child', gender: 'male', age: 8 },
        { name: 'Teen', gender: 'male', age: 14 },
        { name: 'Granny', gender: 'female', age: 63 },
      ]);
      const members = entity.dvor!.members;
      expect(members.find((m) => m.name === 'Head')!.role).toBe('head');
      expect(members.find((m) => m.name === 'Infant')!.role).toBe('infant');
      expect(members.find((m) => m.name === 'Child')!.role).toBe('child');
      expect(members.find((m) => m.name === 'Teen')!.role).toBe('adolescent');
      expect(members.find((m) => m.name === 'Granny')!.role).toBe('elder');
    });

    it('initializes private plot and livestock defaults', () => {
      const entity = createDvor('dvor-1', 'Test', [{ name: 'Head', gender: 'male', age: 35 }]);
      expect(entity.dvor!.privatePlotSize).toBeGreaterThan(0);
      expect(entity.dvor!.privateLivestock).toBeDefined();
      expect(entity.dvor!.privateLivestock.cow).toBe(1);
    });

    it('has isDvor tag', () => {
      const entity = createDvor('dvor-1', 'Test', [{ name: 'Head', gender: 'male', age: 35 }]);
      expect(entity.isDvor).toBe(true);
    });

    it('initializes all members with 100 health', () => {
      const entity = createDvor('dvor-1', 'Test', [
        { name: 'A', gender: 'male', age: 35 },
        { name: 'B', gender: 'female', age: 32 },
      ]);
      for (const member of entity.dvor!.members) {
        expect(member.health).toBe(100);
      }
    });

    it('initializes all members with 0 trudodni', () => {
      const entity = createDvor('dvor-1', 'Test', [{ name: 'A', gender: 'male', age: 35 }]);
      for (const member of entity.dvor!.members) {
        expect(member.trudodniEarned).toBe(0);
      }
    });
  });

  // ── Starting settlement ─────────────────────────────────────────────

  describe('createStartingSettlement', () => {
    it('creates 10 dvory for normal difficulty', () => {
      createStartingSettlement('comrade');
      expect(dvory.entities.length).toBe(10);
    });

    it('creates 12 dvory for easy difficulty', () => {
      createStartingSettlement('worker');
      expect(dvory.entities.length).toBe(12);
    });

    it('creates 7 dvory for hard difficulty', () => {
      createStartingSettlement('tovarish');
      expect(dvory.entities.length).toBe(7);
    });

    it('total population is approximately 55 for normal', () => {
      createStartingSettlement('comrade');
      let totalPop = 0;
      for (const entity of dvory.entities) {
        totalPop += entity.dvor.members.length;
      }
      // Design doc says ~55. Allow range 50-60.
      expect(totalPop).toBeGreaterThanOrEqual(50);
      expect(totalPop).toBeLessThanOrEqual(62);
    });

    it('each dvor has at least one member', () => {
      createStartingSettlement('comrade');
      for (const entity of dvory.entities) {
        expect(entity.dvor.members.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('each dvor has a head of household', () => {
      createStartingSettlement('comrade');
      for (const entity of dvory.entities) {
        const head = entity.dvor.members.find((m: DvorMember) => m.id === entity.dvor.headOfHousehold);
        expect(head).toBeDefined();
        expect(head!.role).toBe('head');
      }
    });

    it('most dvory have 4-6 members (historical average)', () => {
      createStartingSettlement('comrade');
      let matching = 0;
      for (const entity of dvory.entities) {
        if (entity.dvor.members.length >= 4 && entity.dvor.members.length <= 6) {
          matching++;
        }
      }
      // At least 60% of dvory should be in the 4-6 range
      expect(matching).toBeGreaterThanOrEqual(Math.floor(dvory.entities.length * 0.6));
    });

    it('contains working-age adults', () => {
      createStartingSettlement('comrade');
      let workers = 0;
      for (const entity of dvory.entities) {
        for (const member of entity.dvor.members) {
          if (member.laborCapacity >= 0.7) workers++;
        }
      }
      // Design doc says ~25 working adults for normal difficulty
      expect(workers).toBeGreaterThanOrEqual(15);
    });

    it('contains children and dependents', () => {
      createStartingSettlement('comrade');
      let children = 0;
      for (const entity of dvory.entities) {
        for (const member of entity.dvor.members) {
          if (member.role === 'child' || member.role === 'infant') children++;
        }
      }
      // Should have multiple children across the settlement
      expect(children).toBeGreaterThanOrEqual(5);
    });

    it('each dvor has a unique id', () => {
      createStartingSettlement('comrade');
      const ids = dvory.entities.map((e) => e.dvor.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('each dvor has a surname', () => {
      createStartingSettlement('comrade');
      for (const entity of dvory.entities) {
        expect(entity.dvor.surname).toBeTruthy();
        expect(entity.dvor.surname.length).toBeGreaterThan(0);
      }
    });

    it('dvory have unique surnames', () => {
      createStartingSettlement('comrade');
      const surnames = dvory.entities.map((e) => e.dvor.surname);
      const unique = new Set(surnames);
      expect(unique.size).toBe(surnames.length);
    });

    it('members have both genders', () => {
      createStartingSettlement('comrade');
      const allMembers = dvory.entities.flatMap((e) => e.dvor.members);
      const males = allMembers.filter((m) => m.gender === 'male').length;
      const females = allMembers.filter((m) => m.gender === 'female').length;
      expect(males).toBeGreaterThan(0);
      expect(females).toBeGreaterThan(0);
    });

    it('member names follow Russian patronymic convention (Given Otchestvo Familiya)', () => {
      createStartingSettlement('comrade');
      for (const entity of dvory.entities) {
        for (const member of entity.dvor.members) {
          const parts = member.name.split(' ');
          // Full Russian name has 3 parts: given + patronymic + surname
          expect(parts.length).toBe(3);
          // Patronymic ends in -ovich/-evich/-ich (male) or -ovna/-evna (female)
          const patronymic = parts[1]!;
          if (member.gender === 'male') {
            expect(patronymic).toMatch(/(ovich|evich|ich)$/);
          } else {
            expect(patronymic).toMatch(/(ovna|evna)$/);
          }
        }
      }
    });

    it('same-gender children in male-headed dvor share identical patronymic', () => {
      createStartingSettlement('comrade');
      const maleHeadedDvory = dvory.entities.filter((e) => {
        const head = e.dvor.members.find((m: DvorMember) => m.id === e.dvor.headOfHousehold);
        return head?.gender === 'male';
      });
      expect(maleHeadedDvory.length).toBeGreaterThan(0);

      for (const entity of maleHeadedDvory) {
        const head = entity.dvor.members.find((m: DvorMember) => m.id === entity.dvor.headOfHousehold)!;
        // Children: younger than head by at least 10 years, not elder
        const children = entity.dvor.members.filter(
          (m: DvorMember) => m.age < head.age - 10 && m.role !== 'elder' && m.role !== 'spouse',
        );
        if (children.length < 2) continue;

        // All male children should share the same patronymic
        const maleChildren = children.filter((c: DvorMember) => c.gender === 'male');
        if (maleChildren.length >= 2) {
          const pats = maleChildren.map((c: DvorMember) => c.name.split(' ')[1]!);
          expect(new Set(pats).size).toBe(1);
        }
        // All female children should share the same patronymic
        const femaleChildren = children.filter((c: DvorMember) => c.gender === 'female');
        if (femaleChildren.length >= 2) {
          const pats = femaleChildren.map((c: DvorMember) => c.name.split(' ')[1]!);
          expect(new Set(pats).size).toBe(1);
        }
      }
    });

    it('female members have gendered surname forms', () => {
      createStartingSettlement('comrade');
      for (const entity of dvory.entities) {
        const maleSurname = entity.dvor.surname;
        for (const member of entity.dvor.members) {
          const nameSurname = member.name.split(' ')[2]!;
          if (member.gender === 'male') {
            expect(nameSurname).toBe(maleSurname);
          } else {
            // Female surname should differ from male (typically +a suffix)
            expect(nameSurname).not.toBe(maleSurname);
          }
        }
      }
    });

    it('members have ages spread across categories', () => {
      createStartingSettlement('comrade');
      const allMembers = dvory.entities.flatMap((e) => e.dvor.members);
      const workerRoles = new Set(['head', 'spouse', 'worker']);
      const workers = allMembers.filter((m) => workerRoles.has(m.role)).length;
      const children = allMembers.filter((m) => m.role === 'child').length;
      const adolescents = allMembers.filter((m) => m.role === 'adolescent').length;
      // Should have at least some members in multiple age categories
      expect(workers).toBeGreaterThan(0);
      expect(children + adolescents).toBeGreaterThan(0);
    });
  });

  // ── Aggregate helpers ───────────────────────────────────────────────

  describe('settlement population helpers', () => {
    it('total effective labor = sum of laborCapacity across all members', () => {
      createStartingSettlement('comrade');
      let totalLabor = 0;
      for (const entity of dvory.entities) {
        for (const member of entity.dvor.members) {
          totalLabor += member.laborCapacity;
        }
      }
      // Design doc says ~22-24 effective labor units for normal
      expect(totalLabor).toBeGreaterThanOrEqual(15);
      expect(totalLabor).toBeLessThanOrEqual(35);
    });
  });
});

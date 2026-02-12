/**
 * @module ecs/factories/settlementFactories
 *
 * Dvor (household) and starting settlement factories, including
 * Russian name generation (patronymics, gendered surnames).
 */

import {
  FEMALE_GIVEN_NAMES,
  MALE_GIVEN_NAMES,
  PATRONYMIC_FATHER_NAMES,
  PATRONYMIC_RULES,
  SURNAMES_MALE,
  SURNAMES_RAW,
} from '@/ai/names';
import { getResourceEntity } from '../archetypes';
import type { DvorComponent, DvorMember, Entity } from '../world';
import { world } from '../world';
import { createCitizen } from './citizenFactories';
import { laborCapacityForAge, memberRoleForAge } from './demographics';

// ── Types ───────────────────────────────────────────────────────────────────

/** Seed data for a single dvor member (input to createDvor). */
export interface DvorMemberSeed {
  name: string;
  gender: 'male' | 'female';
  age: number;
}

/** Difficulty level for starting settlement. */
export type Difficulty = 'worker' | 'comrade' | 'tovarish';

// ── Household Templates ─────────────────────────────────────────────────────

/** Dvor count by difficulty. */
const DVOR_COUNTS: Record<Difficulty, number> = {
  worker: 35, // ~175 people
  comrade: 30, // ~150 people (target)
  tovarish: 20, // ~100 people
};

/**
 * Procedural household composition templates.
 * Each template defines the non-head members by relative age offset from head.
 */
interface HouseholdTemplate {
  /** Head age range [min, max] */
  headAge: [number, number];
  /** Head gender */
  headGender: 'male' | 'female';
  /** Other members relative to head: [genderFn, ageDelta] */
  others: Array<{ gender: 'male' | 'female'; ageDelta: number }>;
}

const HOUSEHOLD_TEMPLATES: HouseholdTemplate[] = [
  // Standard family: husband + wife + 3 kids
  {
    headAge: [30, 45],
    headGender: 'male',
    others: [
      { gender: 'female', ageDelta: -3 },
      { gender: 'male', ageDelta: -20 },
      { gender: 'female', ageDelta: -25 },
      { gender: 'male', ageDelta: -29 },
    ],
  },
  // Extended family: husband + wife + mother + 3 kids
  {
    headAge: [38, 50],
    headGender: 'male',
    others: [
      { gender: 'female', ageDelta: -4 },
      { gender: 'female', ageDelta: 23 },
      { gender: 'male', ageDelta: -21 },
      { gender: 'female', ageDelta: -23 },
      { gender: 'male', ageDelta: -28 },
    ],
  },
  // War widow: woman + kids + brother + niece
  {
    headAge: [25, 35],
    headGender: 'female',
    others: [
      { gender: 'male', ageDelta: -17 },
      { gender: 'female', ageDelta: -21 },
      { gender: 'male', ageDelta: -6 },
      { gender: 'female', ageDelta: -24 },
    ],
  },
  // Older couple: husband + wife + grown son + daughter-in-law + 2 grandchildren
  {
    headAge: [45, 55],
    headGender: 'male',
    others: [
      { gender: 'female', ageDelta: -5 },
      { gender: 'male', ageDelta: -25 },
      { gender: 'female', ageDelta: -26 },
      { gender: 'male', ageDelta: -43 },
      { gender: 'female', ageDelta: -45 },
    ],
  },
  // Young family: husband + wife + 3 small kids
  {
    headAge: [28, 38],
    headGender: 'male',
    others: [
      { gender: 'female', ageDelta: -4 },
      { gender: 'male', ageDelta: -26 },
      { gender: 'female', ageDelta: -29 },
      { gender: 'male', ageDelta: -35 },
    ],
  },
  // Elderly couple with teens and grown daughter
  {
    headAge: [50, 60],
    headGender: 'male',
    others: [
      { gender: 'female', ageDelta: -3 },
      { gender: 'female', ageDelta: -30 },
      { gender: 'female', ageDelta: -34 },
      { gender: 'male', ageDelta: -36 },
    ],
  },
  // Young couple with children
  {
    headAge: [26, 34],
    headGender: 'male',
    others: [
      { gender: 'female', ageDelta: -4 },
      { gender: 'male', ageDelta: -18 },
      { gender: 'male', ageDelta: -22 },
      { gender: 'female', ageDelta: -25 },
    ],
  },
  // Middle-aged couple with older children and youngest
  {
    headAge: [40, 50],
    headGender: 'male',
    others: [
      { gender: 'female', ageDelta: -4 },
      { gender: 'male', ageDelta: -22 },
      { gender: 'male', ageDelta: -25 },
      { gender: 'female', ageDelta: -29 },
      { gender: 'male', ageDelta: -35 },
    ],
  },
  // Elderly widow with son's family and grandchildren
  {
    headAge: [55, 65],
    headGender: 'female',
    others: [
      { gender: 'male', ageDelta: -30 },
      { gender: 'female', ageDelta: -33 },
      { gender: 'male', ageDelta: -53 },
      { gender: 'female', ageDelta: -50 },
    ],
  },
  // Standard family: husband + wife + 4 kids + infant
  {
    headAge: [30, 40],
    headGender: 'male',
    others: [
      { gender: 'female', ageDelta: -5 },
      { gender: 'male', ageDelta: -23 },
      { gender: 'female', ageDelta: -25 },
      { gender: 'male', ageDelta: -28 },
      { gender: 'female', ageDelta: -30 },
    ],
  },
  // Young family with infant
  {
    headAge: [22, 30],
    headGender: 'male',
    others: [
      { gender: 'female', ageDelta: -2 },
      { gender: 'female', ageDelta: -20 },
      { gender: 'male', ageDelta: -22 },
    ],
  },
  // Large extended family
  {
    headAge: [35, 48],
    headGender: 'male',
    others: [
      { gender: 'female', ageDelta: -3 },
      { gender: 'female', ageDelta: 20 },
      { gender: 'male', ageDelta: -18 },
      { gender: 'female', ageDelta: -22 },
      { gender: 'male', ageDelta: -30 },
    ],
  },
];

// ── Russian Name Generation ─────────────────────────────────────────────────

/** Pick a deterministic given name by gender and index. */
function pickGivenName(gender: 'male' | 'female', index: number): string {
  const pool = gender === 'male' ? MALE_GIVEN_NAMES : FEMALE_GIVEN_NAMES;
  return pool[index % pool.length]!;
}

/** Pick a deterministic father's name for patronymic generation. */
function pickFatherName(index: number): string {
  return PATRONYMIC_FATHER_NAMES[index % PATRONYMIC_FATHER_NAMES.length]!;
}

/** Get the gendered form of a surname (canonical from SURNAMES_RAW or algorithmic). */
function genderedSurname(maleSurname: string, gender: 'male' | 'female'): string {
  if (gender === 'male') return maleSurname;
  // Check SURNAMES_RAW for canonical female form
  const entry = SURNAMES_RAW.find((s) => s.male === maleSurname);
  if (entry?.female) return entry.female;
  // Fallback: common Russian suffix rules
  if (maleSurname.endsWith('ov') || maleSurname.endsWith('ev') || maleSurname.endsWith('in')) {
    return `${maleSurname}a`;
  }
  if (maleSurname.endsWith('sky') || maleSurname.endsWith('skiy')) {
    return maleSurname.replace(/sk(iy|y)$/, 'skaya');
  }
  return maleSurname;
}

/**
 * Build a full Russian-style name: Имя Отчество Фамилия (Given Patronymic Surname).
 *
 * @param givenName - The person's given name (имя)
 * @param fatherName - The father's given name (for patronymic derivation)
 * @param surname - The family surname (male form)
 * @param gender - The person's gender (for patronymic + surname gender forms)
 */
function buildRussianName(
  givenName: string,
  fatherName: string,
  surname: string,
  gender: 'male' | 'female'
): string {
  const patronymic = PATRONYMIC_RULES.generate(fatherName, gender);
  const genSurname = genderedSurname(surname, gender);
  return `${givenName} ${patronymic} ${genSurname}`;
}

// ── Dvor Factory ────────────────────────────────────────────────────────────

/**
 * Creates a dvor (household) entity with the given members.
 *
 * The first working-age male is designated head. If no adult male,
 * the first working-age member becomes head. The head's adult
 * opposite-gender partner (closest in age) becomes spouse.
 *
 * @param id - Unique dvor ID
 * @param surname - Family surname (male form)
 * @param memberSeeds - Array of {name, gender, age} for each member
 * @returns The created dvor entity
 */
export function createDvor(id: string, surname: string, memberSeeds: DvorMemberSeed[]): Entity {
  // Build full DvorMember objects
  const members: DvorMember[] = memberSeeds.map((seed, idx) => ({
    id: `${id}-m${idx}`,
    name: seed.name,
    gender: seed.gender,
    age: seed.age,
    role: memberRoleForAge(seed.age),
    laborCapacity: laborCapacityForAge(seed.age, seed.gender),
    trudodniEarned: 0,
    health: 100,
  }));

  // Designate head: first working-age male, or first working-age member
  const workingAge = members.filter((m) => m.age >= 16 && m.age < 60);
  const headCandidate = workingAge.find((m) => m.gender === 'male') ?? workingAge[0] ?? members[0]!;
  headCandidate.role = 'head';

  // Designate spouse: head's partner (opposite gender, working age, closest in age)
  const spouseCandidate = workingAge
    .filter((m) => m !== headCandidate && m.gender !== headCandidate.gender)
    .sort((a, b) => Math.abs(a.age - headCandidate.age) - Math.abs(b.age - headCandidate.age))[0];
  if (spouseCandidate) {
    spouseCandidate.role = 'spouse';
  }

  const dvor: DvorComponent = {
    id,
    members,
    headOfHousehold: headCandidate.id,
    privatePlotSize: 0.35,
    privateLivestock: { cow: 1, pig: 1, sheep: 3, poultry: 10 },
    joinedTick: 0,
    loyaltyToCollective: 50,
    surname,
  };

  return world.add({ dvor, isDvor: true });
}

// ── Settlement Initialization ────────────────────────────────────────────────

/**
 * Initializes the settlement population with historically-grounded households.
 *
 * This should ONLY be called once when starting a brand new game.
 * It populates the empty world with initial families (Dvory) and citizens.
 *
 * Names follow proper Russian patronymic convention:
 * - Head: Given + Patronymic (from random father) + Surname
 * - Spouse: Given + Patronymic (from own random father) + Gendered Surname
 * - Children: Given + Patronymic (from HEAD's given name) + Gendered Surname
 * - Elderly parent: Given + Patronymic (from random father) + Gendered Surname
 *
 * @param difficulty - Difficulty level (determines dvor count)
 */
export function initializeSettlementPopulation(difficulty: Difficulty = 'comrade'): void {
  const dvorCount = DVOR_COUNTS[difficulty];
  const usedSurnames = new Set<string>();

  let totalCitizens = 0;

  for (let i = 0; i < dvorCount; i++) {
    const template = HOUSEHOLD_TEMPLATES[i % HOUSEHOLD_TEMPLATES.length]!;

    // Pick a unique surname (male form)
    let surnameIdx = i;
    while (usedSurnames.has(SURNAMES_MALE[surnameIdx % SURNAMES_MALE.length]!)) {
      surnameIdx++;
    }
    const surname = SURNAMES_MALE[surnameIdx % SURNAMES_MALE.length]!;
    usedSurnames.add(surname);

    // Determine head age within template range
    const headAge = template.headAge[0] + (i % (template.headAge[1] - template.headAge[0] + 1));

    // Head's given name and father's name (for patronymic)
    const headGiven = pickGivenName(template.headGender, i * 10);
    const headFatherName = pickFatherName(i * 7); // different seed for variety

    // Build head member seed with full Russian name
    const memberSeeds: DvorMemberSeed[] = [
      {
        name: buildRussianName(headGiven, headFatherName, surname, template.headGender),
        gender: template.headGender,
        age: headAge,
      },
    ];

    for (let j = 0; j < template.others.length; j++) {
      const other = template.others[j]!;
      const age = Math.max(0, headAge + other.ageDelta);
      const otherGiven = pickGivenName(other.gender, i * 10 + j + 1);

      // Determine patronymic source:
      // - Children/grandchildren: head's given name is their father
      // - Spouse: has own father (random)
      // - Elderly parent: has own father (random)
      const isChild = age < headAge - 10;
      const isElder = other.ageDelta > 10; // parent/grandparent
      let fatherNameForPatronymic: string;
      if (isChild && !isElder) {
        // Children get patronymic from the head (if head is male) or head's husband
        fatherNameForPatronymic =
          template.headGender === 'male' ? headGiven : pickFatherName(i * 7 + 50); // female-headed household: father is absent
      } else {
        // Spouse, elderly parent, or other adult: own father
        fatherNameForPatronymic = pickFatherName(i * 7 + j + 20);
      }

      memberSeeds.push({
        name: buildRussianName(otherGiven, fatherNameForPatronymic, surname, other.gender),
        gender: other.gender,
        age,
      });
    }

    const dvorId = `dvor-${i + 1}`;
    createDvor(dvorId, surname, memberSeeds);

    // Create a Citizen entity for each member of the new dvor
    // Dvor member IDs are generated as `${dvorId}-m${idx}` in createDvor
    memberSeeds.forEach((seed, idx) => {
      createCitizen(
        'farmer', // Starting population is peasantry
        undefined, // Homeless until auto-assigned
        undefined,
        seed.gender,
        seed.age,
        dvorId,
        `${dvorId}-m${idx}`
      );
      totalCitizens++;
    });
  }

  // Update resource store population to match the actual created citizens
  const store = getResourceEntity();
  const store = getResourceEntity();
  if (store?.resources) {
    store.resources.population = totalCitizens;
  }
}

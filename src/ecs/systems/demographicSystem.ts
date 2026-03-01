/**
 * @module ecs/systems/demographicSystem
 *
 * Population dynamics for dvor (household) entities.
 *
 * Runs births, deaths, and aging for all DvorComponent members.
 * The system operates on dvor members (embedded sub-entities), not
 * individual CitizenComponent entities — those are rendering proxies
 * managed by WorkerSystem.
 *
 * Timing:
 *   - Aging: once per game-year (every 360 ticks)
 *   - Birth/death checks: once per game-month (every 30 ticks)
 *   - Tick 0 is skipped (no events before the game starts)
 */

import { FEMALE_GIVEN_NAMES, MALE_GIVEN_NAMES, PATRONYMIC_RULES, SURNAMES_RAW } from '@/ai/names';
import { dvory } from '@/ecs/archetypes';
import { laborCapacityForAge, memberRoleForAge } from '@/ecs/factories';
import type { DvorComponent, DvorMember } from '@/ecs/world';
import { world } from '@/ecs/world';
import { TICKS_PER_MONTH, TICKS_PER_YEAR } from '@/game/Chronology';
import type { GameRng } from '@/game/SeedSystem';

/** Identity of a dead dvor member for entity-level removal. */
export interface DeadMemberRef {
  dvorId: string;
  memberId: string;
}

/** Identity of a dvor member who just aged into entity eligibility (age 5). */
export interface AgedIntoWorkingRef {
  dvorId: string;
  memberId: string;
  member: DvorMember;
}

/** Result of a single demographic tick. */
export interface DemographicTickResult {
  births: number;
  deaths: number;
  aged: number;
  newDvory: number;
  /** Specific dvor members who died this tick (for entity-level removal). */
  deadMembers: DeadMemberRef[];
  /** Dvor members who just aged from 4→5 and need citizen entities spawned. */
  agedIntoWorking: AgedIntoWorkingRef[];
}

// ── Birth Constants ──────────────────────────────────────────────────────────

/** Base annual birth probability per eligible woman. */
const BASE_ANNUAL_BIRTH_RATE = 0.15;

/** Monthly birth probability = annual / 12. */
const MONTHLY_BIRTH_RATE = BASE_ANNUAL_BIRTH_RATE / 12;

/** Minimum age for fertility. */
const FERTILITY_MIN_AGE = 16;

/** Maximum age for fertility. */
const FERTILITY_MAX_AGE = 45;

/** Pregnancy duration in ticks (3 months × 30 ticks/month). */
const PREGNANCY_DURATION_TICKS = 90;

/**
 * Historical birth-rate multipliers by era.
 * Applied on top of BASE_ANNUAL_BIRTH_RATE to reflect demographic reality.
 */
export const ERA_BIRTH_RATE_MULTIPLIER: Record<string, number> = {
  revolution: 1.0,
  collectivization: 0.8,
  industrialization: 0.75,
  great_patriotic: 0.4,
  reconstruction: 0.6,
  thaw_and_freeze: 0.5,
  stagnation: 0.4,
  the_eternal: 0.3,
};

// ── Death Constants ──────────────────────────────────────────────────────────

/** Annual mortality rates by age bracket. */
const ANNUAL_MORTALITY: Array<{ maxAge: number; rate: number }> = [
  { maxAge: 1, rate: 0.15 }, // infant: 15%/year
  { maxAge: 12, rate: 0.02 }, // child: 2%/year
  { maxAge: 55, rate: 0.005 }, // adult: 0.5%/year
  { maxAge: 70, rate: 0.03 }, // elder: 3%/year
  { maxAge: Infinity, rate: 0.08 }, // very old: 8%/year
];

/** Maximum age of children that impose the working mother penalty. */
const YOUNG_CHILD_MAX_AGE = 3;

/** Female retirement/elder threshold for childcare availability. */
const FEMALE_ELDER_AGE = 55;

/** Male retirement/elder threshold for childcare availability. */
const MALE_ELDER_AGE = 60;

/** Working mother labor penalty multiplier (30% reduction). */
const WORKING_MOTHER_PENALTY = 0.7;

/** Additional monthly death rate from starvation (food = 0). */
const STARVATION_MONTHLY_RATE = 0.05;

function getAnnualMortality(age: number): number {
  for (const bracket of ANNUAL_MORTALITY) {
    if (age < bracket.maxAge) return bracket.rate;
  }
  return 0.08;
}

// ── Working Mother Penalty ───────────────────────────────────────────────────

/**
 * Compute the labor penalty for a working mother with young children.
 *
 * Historical: the "double burden" (двойная нагрузка) meant women with
 * small children worked fewer hours. No formal childcare in early kolkhozes.
 *
 * Returns 0.7 (30% penalty) if:
 * - member is female AND working age (16-55)
 * - dvor has children age 0-3
 * - no elder (55+F or 60+M) exists in the dvor for childcare
 *
 * Returns 1.0 (no penalty) otherwise.
 */
export function getWorkingMotherPenalty(dvor: DvorComponent, member: DvorMember): number {
  // Only applies to working-age females
  if (member.gender !== 'female') return 1.0;
  if (member.age < 16 || member.age >= FEMALE_ELDER_AGE) return 1.0;

  // Check for young children (age 0-3) in the dvor
  const hasYoungChild = dvor.members.some((m) => m.age >= 0 && m.age <= YOUNG_CHILD_MAX_AGE);
  if (!hasYoungChild) return 1.0;

  // Check for elder available for childcare
  const hasElder = dvor.members.some(
    (m) =>
      m.id !== member.id &&
      ((m.gender === 'female' && m.age >= FEMALE_ELDER_AGE) || (m.gender === 'male' && m.age >= MALE_ELDER_AGE)),
  );
  if (hasElder) return 1.0;

  return WORKING_MOTHER_PENALTY;
}

// ── Aging ────────────────────────────────────────────────────────────────────

/**
 * Age all dvor members by 1 year.
 * Updates roles and labor capacity based on new age.
 * Preserves 'head' and 'spouse' roles — only non-leadership roles transition.
 * Tracks members who just crossed the age-5 threshold (need citizen entities).
 */
export function ageAllMembers(result: DemographicTickResult): number {
  let totalAged = 0;

  for (const entity of dvory) {
    for (const member of entity.dvor.members) {
      member.age += 1;
      totalAged++;

      // Track members who just aged into entity eligibility (4→5)
      if (member.age === 5) {
        result.agedIntoWorking.push({ dvorId: entity.dvor.id, memberId: member.id, member });
      }

      // Update labor capacity
      member.laborCapacity = laborCapacityForAge(member.age, member.gender);

      // Only transition non-leadership roles
      if (member.role !== 'head' && member.role !== 'spouse') {
        member.role = memberRoleForAge(member.age, member.gender);
      }
    }
  }

  return totalAged;
}

// ── Infant Name Generation ──────────────────────────────────────────────────

/**
 * Generate a proper Russian name for a newborn infant.
 *
 * Follows convention: Given + Patronymic (from father/head) + Gendered Surname.
 * The head of household's given name is used for the patronymic (Russian custom).
 */
function generateInfantName(dvor: DvorComponent, infantGender: 'male' | 'female', rng: GameRng | null): string {
  const r = () => rng?.random() ?? Math.random();
  const pickFrom = <T>(arr: readonly T[]): T => arr[Math.floor(r() * arr.length)]!;

  // Given name
  const givenName = infantGender === 'male' ? pickFrom(MALE_GIVEN_NAMES) : pickFrom(FEMALE_GIVEN_NAMES);

  // Patronymic: derived from head of household's given name (first word of their full name)
  const head = dvor.members.find((m) => m.id === dvor.headOfHousehold);
  const headGivenName = head?.name.split(' ')[0] ?? 'Ivan';
  const patronymic = PATRONYMIC_RULES.generate(headGivenName, infantGender);

  // Surname: gendered form of the dvor surname
  const surnameEntry = SURNAMES_RAW.find((s) => s.male === dvor.surname);
  let surname: string;
  if (surnameEntry) {
    surname = infantGender === 'female' ? (surnameEntry.female ?? surnameEntry.male) : surnameEntry.male;
  } else {
    // Fallback: apply common Russian gendering rules
    surname = dvor.surname;
    if (infantGender === 'female') {
      if (surname.endsWith('ov') || surname.endsWith('ev') || surname.endsWith('in')) {
        surname = `${surname}a`;
      }
    }
  }

  return `${givenName} ${patronymic} ${surname}`;
}

// ── Births ───────────────────────────────────────────────────────────────────

/**
 * Check for conception among eligible women in all dvory.
 *
 * Eligible: female, age 16-45, not currently pregnant.
 * Base probability: 15% per year → ~1.25% per month, modified by era and food.
 * On success, sets member.pregnant = 90 (3-month gestation).
 * Actual infant creation happens in pregnancyTick().
 */
export function birthCheck(rng: GameRng | null, foodLevel: number, result: DemographicTickResult, eraId?: string): void {
  // Food modifier
  let foodMod = 1.0;
  if (foodLevel < 0.5) foodMod = 0.5;
  else if (foodLevel > 0.8) foodMod = 1.2;

  // Era modifier
  const eraMod = eraId ? (ERA_BIRTH_RATE_MULTIPLIER[eraId] ?? 1.0) : 1.0;

  const threshold = MONTHLY_BIRTH_RATE * foodMod * eraMod;

  for (const entity of dvory) {
    const dvor = entity.dvor;

    const existingMembers = [...dvor.members];

    for (const member of existingMembers) {
      // Eligibility: female, fertile age, not pregnant
      if (member.gender !== 'female') continue;
      if (member.age < FERTILITY_MIN_AGE || member.age > FERTILITY_MAX_AGE) continue;
      if (member.pregnant != null && member.pregnant > 0) continue;

      const roll = rng?.random() ?? Math.random();
      if (roll < threshold) {
        // Conception — start pregnancy
        member.pregnant = PREGNANCY_DURATION_TICKS;
        result.births++;
      }
    }
  }
}

/**
 * Advance pregnancies by one month (30 ticks).
 *
 * When a pregnancy completes (pregnant <= 0), create the infant in the dvor.
 * Called on monthly boundaries before or after birthCheck.
 */
export function pregnancyTick(rng: GameRng | null, result: DemographicTickResult): void {
  for (const entity of dvory) {
    const dvor = entity.dvor;

    for (const member of dvor.members) {
      if (member.pregnant == null || member.pregnant <= 0) continue;

      member.pregnant -= TICKS_PER_MONTH;

      if (member.pregnant <= 0) {
        // Pregnancy complete — deliver infant
        member.pregnant = undefined;

        const infantGender: 'male' | 'female' = (rng?.random() ?? Math.random()) < 0.5 ? 'male' : 'female';
        dvor.nextMemberId = (dvor.nextMemberId ?? dvor.members.length) + 1;
        const infantId = `${dvor.id}-m${dvor.nextMemberId}`;
        const infantName = generateInfantName(dvor, infantGender, rng);

        dvor.members.push({
          id: infantId,
          name: infantName,
          gender: infantGender,
          age: 0,
          role: 'infant',
          laborCapacity: 0,
          trudodniEarned: 0,
          health: 100,
        });
      }
    }
  }
}

// ── Deaths ───────────────────────────────────────────────────────────────────

/**
 * Check for deaths among all dvor members.
 *
 * Age-based mortality: converted from annual to monthly.
 * Starvation: additional 5% monthly when food = 0.
 * Removes dead members from their dvor. Removes empty dvory from the world.
 */
export function deathCheck(rng: GameRng | null, foodLevel: number, result: DemographicTickResult): void {
  const starvationMod = foodLevel <= 0 ? STARVATION_MONTHLY_RATE : 0;

  // Collect dvory to potentially remove (empty after deaths)
  const emptyDvory: (typeof dvory.entities)[number][] = [];

  for (const entity of dvory) {
    const dvor = entity.dvor;
    const survivors: typeof dvor.members = [];

    for (const member of dvor.members) {
      const annualRate = getAnnualMortality(member.age);
      const monthlyRate = annualRate / 12;
      const totalRate = monthlyRate + starvationMod;

      const roll = rng?.random() ?? Math.random();
      if (roll < totalRate) {
        // Dead — track identity for entity-level removal
        result.deaths++;
        result.deadMembers.push({ dvorId: dvor.id, memberId: member.id });
      } else {
        survivors.push(member);
      }
    }

    dvor.members = survivors;

    // If all members died, mark for removal
    if (dvor.members.length === 0) {
      emptyDvory.push(entity);
    } else if (!dvor.members.find((m) => m.id === dvor.headOfHousehold)) {
      // Head of household died — promote eldest working-age member
      const newHead = dvor.members.filter((m) => m.age >= 16).sort((a, b) => b.age - a.age)[0];
      if (newHead) {
        dvor.headOfHousehold = newHead.id;
        newHead.role = 'head';
      }
    }
  }

  // Remove empty dvory from the world
  for (const entity of emptyDvory) {
    world.remove(entity);
  }
}

// ── Main Tick ────────────────────────────────────────────────────────────────

/**
 * Main demographic tick — called every simulation tick.
 *
 * Only processes on time boundaries:
 * - Year boundary (every 360 ticks): aging
 * - Month boundary (every 30 ticks): pregnancies, births, deaths
 * - Tick 0 is always skipped.
 */
export function demographicTick(rng: GameRng | null, totalTicks: number, foodLevel: number, eraId?: string): DemographicTickResult {
  const result: DemographicTickResult = {
    births: 0,
    deaths: 0,
    aged: 0,
    newDvory: 0,
    deadMembers: [],
    agedIntoWorking: [],
  };

  if (totalTicks <= 0) return result;

  // Year boundary: age all members
  if (totalTicks % TICKS_PER_YEAR === 0) {
    result.aged = ageAllMembers(result);
  }

  // Month boundary: advance pregnancies, then check new conceptions, then deaths
  if (totalTicks % TICKS_PER_MONTH === 0) {
    pregnancyTick(rng, result);
    birthCheck(rng, foodLevel, result, eraId);
    deathCheck(rng, foodLevel, result);
  }

  return result;
}

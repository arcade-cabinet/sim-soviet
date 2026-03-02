/**
 * @fileoverview DemographicAgent — Yuka agent that owns population dynamics.
 *
 * Absorbs all logic from demographicSystem.ts:
 *   - Aging (yearly): age++, role transitions, labor capacity updates
 *   - Births (monthly): fertility check (age 16–45), pregnancy (90 ticks), era birth rate multipliers
 *   - Deaths (monthly): age-bracket mortality rates, starvation bonus
 *   - Household formation (yearly): eligible pairs age 20–35, 10% annual probability
 *
 * The agent tracks population trends (birth rate, death rate, growth rate) and
 * emits LABOR_SHORTAGE, LABOR_SURPLUS, and POPULATION_MILESTONE telegrams.
 */

import { Vehicle } from 'yuka';
import { demographics } from '@/config';
import { FEMALE_GIVEN_NAMES, MALE_GIVEN_NAMES, PATRONYMIC_RULES, SURNAMES_RAW } from '../../names';
import { dvory, housing } from '../../../ecs/archetypes';
import { laborCapacityForAge, memberRoleForAge } from '../../../ecs/factories';
import type { DvorComponent, DvorMember, RaionPool } from '../../../ecs/world';
import { world } from '../../../ecs/world';
import { getResourceEntity } from '../../../ecs/archetypes';
import { TICKS_PER_MONTH, TICKS_PER_YEAR } from '../../../game/Chronology';
import type { GameRng } from '../../../game/SeedSystem';
import {
  statisticalAgingTick,
  statisticalBirthTick,
  statisticalDeathTick,
} from './statisticalDemographics';

// ── Re-exported types ──────────────────────────────────────────────────────

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
  /** Number of conceptions this tick (pregnancy starts; actual births occur in pregnancyTick). */
  births: number;
  deaths: number;
  aged: number;
  newDvory: number;
  /** Specific dvor members who died this tick (for entity-level removal). */
  deadMembers: DeadMemberRef[];
  /** Dvor members who just aged from 4→5 and need citizen entities spawned. */
  agedIntoWorking: AgedIntoWorkingRef[];
}

// ── Constants (loaded from config) ───────────────────────────────────────────

const entityCfg = demographics.entity;

/** Base annual birth probability per eligible woman. */
const BASE_ANNUAL_BIRTH_RATE = entityCfg.birthRates.baseAnnualRate;

/** Monthly birth probability = annual / 12. */
const MONTHLY_BIRTH_RATE = BASE_ANNUAL_BIRTH_RATE / 12;

/** Minimum age for fertility. */
const FERTILITY_MIN_AGE = entityCfg.birthRates.fertilityMinAge;

/** Maximum age for fertility. */
const FERTILITY_MAX_AGE = entityCfg.birthRates.fertilityMaxAge;

/** Pregnancy duration in ticks (3 months x 30 ticks/month). */
const PREGNANCY_DURATION_TICKS = entityCfg.birthRates.pregnancyDurationTicks;

/**
 * Historical birth-rate multipliers by era.
 * Applied on top of BASE_ANNUAL_BIRTH_RATE to reflect demographic reality.
 */
export const ERA_BIRTH_RATE_MULTIPLIER: Record<string, number> = entityCfg.eraBirthRateMultiplier;

// ── Death Constants (from config) ────────────────────────────────────────────

/** Annual mortality rates by age bracket. */
const ANNUAL_MORTALITY: Array<{ maxAge: number; rate: number }> = entityCfg.annualMortality;

/** Maximum age of children that impose the working mother penalty. */
const YOUNG_CHILD_MAX_AGE = entityCfg.youngChildMaxAge;

/** Female retirement/elder threshold. */
const FEMALE_ELDER_AGE = entityCfg.femaleElderAge;

/** Male retirement/elder threshold. */
const MALE_ELDER_AGE = entityCfg.maleElderAge;

/** Working mother labor penalty multiplier (30% reduction). */
const WORKING_MOTHER_PENALTY = entityCfg.workingMotherPenalty;

/** Additional monthly death rate from starvation (food = 0). */
const STARVATION_MONTHLY_RATE = entityCfg.starvationMonthlyRate;

// ── Household Formation Constants (from config) ─────────────────────────────

const formationCfg = demographics.householdFormation;

/** Minimum age for household formation eligibility. */
const FORMATION_MIN_AGE = formationCfg.minAge;

/** Maximum age for household formation eligibility. */
const FORMATION_MAX_AGE = formationCfg.maxAge;

/** Annual probability that an eligible pair forms a new household. */
const FORMATION_PROBABILITY = formationCfg.probability;

// ── Population trend thresholds (from config) ────────────────────────────────

const trendsCfg = demographics.trends;

/** Labor shortage telegram threshold — growth rate below this triggers warning. */
const LABOR_SHORTAGE_THRESHOLD = trendsCfg.laborShortageThreshold;

/** Labor surplus telegram threshold — growth rate above this triggers notice. */
const LABOR_SURPLUS_THRESHOLD = trendsCfg.laborSurplusThreshold;

/** Population milestone: every N citizens reached emits a milestone telegram. */
const POPULATION_MILESTONE_STEP = trendsCfg.populationMilestoneStep;

// ── Serialization ────────────────────────────────────────────────────────────

/** Serializable snapshot of DemographicAgent state. */
export interface DemographicAgentSnapshot {
  birthsThisYear: number;
  deathsThisYear: number;
  totalBirths: number;
  totalDeaths: number;
  lastMilestone: number;
}

// ── Helper utilities ─────────────────────────────────────────────────────────

function getAnnualMortality(age: number): number {
  for (const bracket of ANNUAL_MORTALITY) {
    if (age < bracket.maxAge) return bracket.rate;
  }
  return 0.08;
}

/**
 * Computes the labor penalty for a working mother with young children.
 *
 * Returns 0.7 (30% penalty) if:
 * - member is female AND working age (16–55)
 * - dvor has children age 0–3
 * - no elder (55+F or 60+M) exists in the dvor for childcare
 *
 * Returns 1.0 (no penalty) otherwise.
 *
 * @param dvor   - The household to check for young children and elders
 * @param member - The specific member to compute the penalty for
 * @returns Labor multiplier (0.7 with penalty, 1.0 without)
 */
export function getWorkingMotherPenalty(dvor: DvorComponent, member: DvorMember): number {
  if (member.gender !== 'female') return 1.0;
  if (member.age < 16 || member.age >= FEMALE_ELDER_AGE) return 1.0;

  const hasYoungChild = dvor.members.some((m) => m.age <= YOUNG_CHILD_MAX_AGE);
  if (!hasYoungChild) return 1.0;

  const hasElder = dvor.members.some(
    (m) =>
      m.id !== member.id &&
      ((m.gender === 'female' && m.age >= FEMALE_ELDER_AGE) || (m.gender === 'male' && m.age >= MALE_ELDER_AGE)),
  );
  if (hasElder) return 1.0;

  return WORKING_MOTHER_PENALTY;
}

/**
 * Generate a proper Russian name for a newborn infant.
 *
 * Follows convention: Given + Patronymic (from father/head) + Gendered Surname.
 */
function generateInfantName(dvor: DvorComponent, infantGender: 'male' | 'female', rng: GameRng | null): string {
  const r = () => rng ? rng.random() : Math.random();
  const pickFrom = <T>(arr: readonly T[]): T => rng ? rng.pick(arr) : arr[Math.floor(Math.random() * arr.length)]!;

  const givenName = infantGender === 'male' ? pickFrom(MALE_GIVEN_NAMES) : pickFrom(FEMALE_GIVEN_NAMES);

  const head = dvor.members.find((m) => m.id === dvor.headOfHousehold);
  const headGivenName = head?.name.split(' ')[0] ?? 'Ivan';
  const patronymic = PATRONYMIC_RULES.generate(headGivenName, infantGender);

  const surnameEntry = SURNAMES_RAW.find((s) => s.male === dvor.surname);
  let surname: string;
  if (surnameEntry) {
    surname = infantGender === 'female' ? (surnameEntry.female ?? surnameEntry.male) : surnameEntry.male;
  } else {
    surname = dvor.surname;
    if (infantGender === 'female') {
      if (surname.endsWith('ov') || surname.endsWith('ev') || surname.endsWith('in')) {
        surname = `${surname}a`;
      }
    }
  }

  return `${givenName} ${patronymic} ${surname}`;
}

function removeMemberFromDvor(
  dvorEntity: (typeof dvory.entities)[number],
  memberId: string,
  _result: DemographicTickResult,
): void {
  const dvor = dvorEntity.dvor;
  dvor.members = dvor.members.filter((m) => m.id !== memberId);

  if (dvor.members.length === 0) {
    world.remove(dvorEntity);
    return;
  }

  if (dvor.headOfHousehold === memberId) {
    const adults = dvor.members.filter((m) => m.age >= 16);
    const retireAge = (g: 'male' | 'female') => (g === 'male' ? MALE_ELDER_AGE : FEMALE_ELDER_AGE);
    const workingAge = adults.filter((m) => m.age < retireAge(m.gender));
    const candidates = workingAge.length > 0 ? workingAge : adults;
    const newHead = candidates.sort((a, b) => b.age - a.age)[0];
    if (newHead) {
      dvor.headOfHousehold = newHead.id;
      newHead.role = 'head';
    }
  }
}

// ── DemographicAgent ─────────────────────────────────────────────────────────

/**
 * Yuka Vehicle agent that owns population dynamics.
 *
 * Call `onTick(totalTicks, rng, foodLevel, eraId)` once per simulation tick.
 * The agent automatically runs aging on year boundaries and birth/death checks
 * on month boundaries.
 *
 * Population trends (birth rate, death rate, growth rate) are tracked across
 * the year for labor assessments.
 */
export class DemographicAgent extends Vehicle {
  /** Births counted this game year (reset yearly). */
  private birthsThisYear = 0;

  /** Deaths counted this game year (reset yearly). */
  private deathsThisYear = 0;

  /** Cumulative total births since game start. */
  private totalBirths = 0;

  /** Cumulative total deaths since game start. */
  private totalDeaths = 0;

  /** Last population milestone reached (multiple of POPULATION_MILESTONE_STEP). */
  private lastMilestone = 0;

  /** Seeded RNG (set via setRng). */
  private rng?: GameRng;

  constructor() {
    super();
    this.name = 'DemographicAgent';
  }

  /** Set the seeded RNG for deterministic demographic rolls. */
  setRng(rng: GameRng): void {
    this.rng = rng;
  }

  // ── Core tick ──────────────────────────────────────────────────────────────

  /**
   * Main demographic tick — call every simulation tick.
   *
   * Detects population mode from the resource store:
   * - **Entity mode** (raion undefined): iterates dvory, creates/removes citizen entities
   * - **Aggregate mode** (raion defined): dispatches to O(20) statistical functions
   *
   * Only processes on time boundaries:
   * - Year boundary (every 360 ticks): aging + household formation
   * - Month boundary (every 30 ticks): pregnancies, births, deaths
   * - Tick 0 is always skipped.
   *
   * @param totalTicks - Total simulation ticks elapsed (for boundary detection)
   * @param rng        - Seeded RNG for all demographic rolls
   * @param foodLevel  - Current food level (affects birth rate and starvation)
   * @param eraId      - Optional era identifier for birth rate multiplier
   * @returns Demographic tick result with birth, death, and aging counts
   */
  onTick(totalTicks: number, rng: GameRng | null, foodLevel: number, eraId?: string): DemographicTickResult {
    const result: DemographicTickResult = {
      births: 0,
      deaths: 0,
      aged: 0,
      newDvory: 0,
      deadMembers: [],
      agedIntoWorking: [],
    };

    if (totalTicks <= 0) return result;

    // Detect aggregate mode from resource store
    const storeRef = getResourceEntity();
    const raion = storeRef?.resources?.raion;

    if (raion != null && rng != null) {
      return this._tickAggregate(totalTicks, rng, foodLevel, eraId ?? 'revolution', raion, result);
    }

    return this._tickEntity(totalTicks, rng, foodLevel, eraId, result);
  }

  // ── Entity mode tick (original code path) ─────────────────────────────────

  private _tickEntity(
    totalTicks: number,
    rng: GameRng | null,
    foodLevel: number,
    eraId: string | undefined,
    result: DemographicTickResult,
  ): DemographicTickResult {
    if (totalTicks % TICKS_PER_YEAR === 0) {
      result.aged = this.ageAllMembers(result);
      this.householdFormation(rng, result, totalTicks);
      // Reset yearly counters
      this.birthsThisYear = 0;
      this.deathsThisYear = 0;
    }

    if (totalTicks % TICKS_PER_MONTH === 0) {
      this.pregnancyTick(rng, result);
      this.birthCheck(rng, foodLevel, result, eraId);
      this.deathCheck(rng, foodLevel, result);

      this.birthsThisYear += result.births;
      this.deathsThisYear += result.deaths;
      this.totalBirths += result.births;
      this.totalDeaths += result.deaths;

      this._checkMilestones();
    }

    return result;
  }

  // ── Aggregate mode tick ───────────────────────────────────────────────────

  private _tickAggregate(
    totalTicks: number,
    rng: GameRng,
    foodLevel: number,
    eraId: string,
    raion: RaionPool,
    result: DemographicTickResult,
  ): DemographicTickResult {
    if (totalTicks % TICKS_PER_YEAR === 0) {
      const agingDeaths = statisticalAgingTick(raion);
      result.aged = raion.totalPopulation; // all buckets shifted
      result.deaths += agingDeaths;
      this.statisticalHouseholdFormation(raion, rng);
      // Reset yearly counters
      this.birthsThisYear = 0;
      this.deathsThisYear = 0;
      // Reset yearly pool counters
      raion.birthsThisYear = 0;
      raion.deathsThisYear = 0;
    }

    if (totalTicks % TICKS_PER_MONTH === 0) {
      const births = statisticalBirthTick(raion, foodLevel, eraId, rng);
      const deaths = statisticalDeathTick(raion, foodLevel, rng);

      result.births = births;
      result.deaths += deaths;

      this.birthsThisYear += births;
      this.deathsThisYear += deaths;
      this.totalBirths += births;
      this.totalDeaths += deaths;

      this._checkMilestonesAggregate(raion);
    }

    return result;
  }

  // ── Statistical household formation (aggregate mode) ──────────────────────

  /**
   * Statistical household formation for aggregate mode.
   *
   * Instead of pairing individual dvor members, estimates new household
   * formation from the population pool and distributes them across housing
   * buildings by incrementing householdCount.
   *
   * Rate: ~10% of eligible population (ages 20-35) forms new households annually.
   */
  statisticalHouseholdFormation(raion: RaionPool, rng: GameRng): void {
    // Eligible population: age buckets 4-7 (ages 20-39, approximation for 20-35)
    let eligiblePop = 0;
    for (let i = 4; i <= 7; i++) {
      eligiblePop += raion.maleAgeBuckets[i]! + raion.femaleAgeBuckets[i]!;
    }

    // Each household needs 2 people; 10% annual formation probability
    const potentialPairs = Math.floor(eligiblePop / 2);
    const newHouseholds = Math.floor(potentialPairs * FORMATION_PROBABILITY);

    if (newHouseholds <= 0) return;

    // Distribute new households across housing buildings with available capacity
    const housingBuildings = [...housing];
    if (housingBuildings.length === 0) return;

    let remaining = newHouseholds;
    const shuffled = rng.shuffle(housingBuildings);

    for (const entity of shuffled) {
      if (remaining <= 0) break;

      const bldg = entity.building;
      // Each household ~= 4 residents; check capacity
      const currentResidents = bldg.residentCount;
      const availableSlots = Math.max(0, bldg.housingCap - currentResidents);
      const slotsForHouseholds = Math.floor(availableSlots / 4);

      if (slotsForHouseholds > 0) {
        const toAdd = Math.min(remaining, slotsForHouseholds);
        bldg.householdCount += toAdd;
        bldg.residentCount += toAdd * 4;
        remaining -= toAdd;
      }
    }

    raion.totalHouseholds += newHouseholds - remaining;
  }

  // ── Aging ──────────────────────────────────────────────────────────────────

  /**
   * Ages all dvor members by 1 year.
   * Updates roles and labor capacity based on new age.
   * Tracks members who just crossed the age-5 threshold.
   *
   * @param result - Mutable result object to record aged-into-working members
   * @returns Total number of members aged
   */
  ageAllMembers(result: DemographicTickResult): number {
    let totalAged = 0;

    for (const entity of dvory) {
      for (const member of entity.dvor.members) {
        member.age += 1;
        totalAged++;

        if (member.age === 5) {
          result.agedIntoWorking.push({ dvorId: entity.dvor.id, memberId: member.id, member });
        }

        member.laborCapacity =
          laborCapacityForAge(member.age, member.gender) * getWorkingMotherPenalty(entity.dvor, member);

        if (member.role !== 'head' && member.role !== 'spouse') {
          member.role = memberRoleForAge(member.age, member.gender);
        }
      }
    }

    return totalAged;
  }

  // ── Births ─────────────────────────────────────────────────────────────────

  /**
   * Checks for conception among eligible women in all dvory.
   *
   * Eligible: female, age 16–45, not currently pregnant.
   * On success, sets member.pregnant = 90 (3-month gestation).
   *
   * @param rng       - Seeded RNG for deterministic rolls
   * @param foodLevel - Current food level (0.0–1.0) affecting birth rate
   * @param result    - Mutable result object to record birth count
   * @param eraId     - Optional era identifier for birth rate multiplier
   */
  birthCheck(
    rng: GameRng | null,
    foodLevel: number,
    result: DemographicTickResult,
    eraId?: string,
  ): void {
    let foodMod = 1.0;
    if (foodLevel < 0.5) foodMod = 0.5;
    else if (foodLevel > 0.8) foodMod = 1.2;

    const eraMod = eraId ? (ERA_BIRTH_RATE_MULTIPLIER[eraId] ?? 1.0) : 1.0;
    const threshold = MONTHLY_BIRTH_RATE * foodMod * eraMod;

    for (const entity of dvory) {
      const dvor = entity.dvor;
      const existingMembers = [...dvor.members];

      for (const member of existingMembers) {
        if (member.gender !== 'female') continue;
        if (member.age < FERTILITY_MIN_AGE || member.age > FERTILITY_MAX_AGE) continue;
        if (member.pregnant != null && member.pregnant > 0) continue;

        const roll = rng ? rng.random() : Math.random();
        if (roll < threshold) {
          member.pregnant = PREGNANCY_DURATION_TICKS;
          result.births++;
        }
      }
    }
  }

  /**
   * Advances pregnancies by one month (30 ticks).
   *
   * When a pregnancy completes (pregnant <= 0), creates the infant in the dvor.
   *
   * @param rng     - Seeded RNG for gender determination and naming
   * @param _result - Demographic tick result (reserved)
   */
  pregnancyTick(rng: GameRng | null, _result: DemographicTickResult): void {
    for (const entity of dvory) {
      const dvor = entity.dvor;

      for (const member of dvor.members) {
        if (member.pregnant == null || member.pregnant <= 0) continue;

        member.pregnant -= TICKS_PER_MONTH;

        if (member.pregnant <= 0) {
          member.pregnant = undefined;

          const infantGender: 'male' | 'female' = (rng ? rng.random() : Math.random()) < 0.5 ? 'male' : 'female';
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

  // ── Deaths ─────────────────────────────────────────────────────────────────

  /**
   * Checks for deaths among all dvor members.
   *
   * Age-based mortality converted from annual to monthly.
   * Starvation adds +5% monthly when food = 0.
   * Removes dead members, cleans up empty dvory, promotes new head if needed.
   *
   * @param rng       - Seeded RNG for mortality rolls
   * @param foodLevel - Current food level (0 triggers starvation bonus deaths)
   * @param result    - Mutable result object to record deaths and dead member refs
   */
  deathCheck(rng: GameRng | null, foodLevel: number, result: DemographicTickResult): void {
    const starvationMod = foodLevel <= 0 ? STARVATION_MONTHLY_RATE : 0;
    const emptyDvory: (typeof dvory.entities)[number][] = [];

    for (const entity of dvory) {
      const dvor = entity.dvor;
      const survivors: typeof dvor.members = [];

      for (const member of dvor.members) {
        const annualRate = getAnnualMortality(member.age);
        const monthlyRate = annualRate / 12;
        const totalRate = monthlyRate + starvationMod;

        const roll = rng ? rng.random() : Math.random();
        if (roll < totalRate) {
          result.deaths++;
          result.deadMembers.push({ dvorId: dvor.id, memberId: member.id });
        } else {
          survivors.push(member);
        }
      }

      dvor.members = survivors;

      if (dvor.members.length === 0) {
        emptyDvory.push(entity);
      } else if (!dvor.members.find((m) => m.id === dvor.headOfHousehold)) {
        const newHead = dvor.members.filter((m) => m.age >= 16).sort((a, b) => b.age - a.age)[0];
        if (newHead) {
          dvor.headOfHousehold = newHead.id;
          newHead.role = 'head';
        }
      }
    }

    for (const entity of emptyDvory) {
      world.remove(entity);
    }
  }

  // ── Household Formation ────────────────────────────────────────────────────

  /**
   * Household formation from unrelated adults.
   *
   * Scans all dvory for eligible singles (20–35, not head or spouse),
   * pairs male from one dvor with female from another. Each eligible pair
   * has ~10% annual probability of forming a new household.
   *
   * @param rng        - Seeded RNG for pairing probability
   * @param result     - Mutable result object to record new dvor count
   * @param totalTicks - Current simulation tick for deterministic ID generation
   */
  householdFormation(rng: GameRng | null, result: DemographicTickResult, totalTicks = 0): void {
    const eligibleMales: Array<{ member: DvorMember; dvorEntity: (typeof dvory.entities)[number] }> = [];
    const eligibleFemales: Array<{ member: DvorMember; dvorEntity: (typeof dvory.entities)[number] }> = [];

    for (const entity of dvory) {
      for (const member of entity.dvor.members) {
        if (member.age < FORMATION_MIN_AGE || member.age > FORMATION_MAX_AGE) continue;
        if (member.role === 'head' || member.role === 'spouse') continue;

        if (member.gender === 'male') {
          eligibleMales.push({ member, dvorEntity: entity });
        } else {
          eligibleFemales.push({ member, dvorEntity: entity });
        }
      }
    }

    const usedMales = new Set<string>();
    const usedFemales = new Set<string>();

    for (const male of eligibleMales) {
      if (usedMales.has(male.member.id)) continue;

      for (const female of eligibleFemales) {
        if (usedFemales.has(female.member.id)) continue;
        if (male.dvorEntity.dvor.id === female.dvorEntity.dvor.id) continue;

        const roll = rng ? rng.random() : Math.random();
        if (roll >= FORMATION_PROBABILITY) continue;

        usedMales.add(male.member.id);
        usedFemales.add(female.member.id);

        const nameParts = male.member.name.split(' ');
        const surname = nameParts[nameParts.length - 1] ?? 'Unknown';

        removeMemberFromDvor(male.dvorEntity, male.member.id, result);
        removeMemberFromDvor(female.dvorEntity, female.member.id, result);

        const newDvorId = `formed-${totalTicks}-${male.member.id}`;

        const newMembers: DvorMember[] = [
          { ...male.member, id: `${newDvorId}-m0`, role: 'head' },
          { ...female.member, id: `${newDvorId}-m1`, role: 'spouse' },
        ];

        const dvor: DvorComponent = {
          id: newDvorId,
          members: newMembers,
          headOfHousehold: newMembers[0]!.id,
          privatePlotSize: 0.25,
          privateLivestock: { cow: 0, pig: 0, sheep: 0, poultry: 0 },
          joinedTick: totalTicks,
          loyaltyToCollective: 50,
          surname,
          nextMemberId: 2,
        };

        world.add({ dvor, isDvor: true });
        result.newDvory++;

        break;
      }
    }
  }

  // ── Entity GC Sweep ──────────────────────────────────────────────────────────

  /**
   * Annual safety-net sweep: remove empty dvory from the world.
   *
   * An empty dvor has 0 members — all died but the dvor entity was not
   * cleaned up (race condition between death checks and household formation).
   *
   * Only meaningful in entity mode (aggregate mode does not use dvory).
   * Returns the number of empty dvory removed.
   */
  sweepEmptyDvory(): number {
    const storeRef = getResourceEntity();
    if (storeRef?.resources?.raion != null) return 0;

    const toRemove: (typeof dvory.entities)[number][] = [];
    for (const entity of dvory) {
      if (entity.dvor.members.length === 0) {
        toRemove.push(entity);
      }
    }

    for (const entity of toRemove) {
      world.remove(entity);
    }

    return toRemove.length;
  }

  // ── Population trend analytics ─────────────────────────────────────────────

  /**
   * Current annual birth rate (births per year / 12 months approximated from
   * year-to-date births).
   */
  getBirthRate(): number {
    return this.birthsThisYear;
  }

  /**
   * Current annual death rate (deaths per year / 12 months approximated from
   * year-to-date deaths).
   */
  getDeathRate(): number {
    return this.deathsThisYear;
  }

  /**
   * Net population growth rate this year (births minus deaths).
   * Positive = growing, negative = shrinking.
   */
  getGrowthRate(): number {
    return this.birthsThisYear - this.deathsThisYear;
  }

  /**
   * Assesses labor capacity status based on growth trend.
   *
   * @returns 'shortage' | 'surplus' | 'stable'
   */
  assessLaborCapacity(): 'shortage' | 'surplus' | 'stable' {
    const totalPop = this._getTotalPopulation();
    if (totalPop === 0) return 'stable';

    const growthRatio = this.getGrowthRate() / totalPop;
    if (growthRatio < LABOR_SHORTAGE_THRESHOLD) return 'shortage';
    if (growthRatio > LABOR_SURPLUS_THRESHOLD) return 'surplus';
    return 'stable';
  }

  // ── Serialization ──────────────────────────────────────────────────────────

  /**
   * Serialize agent state for save/load.
   *
   * @returns Serializable snapshot
   */
  serialize(): DemographicAgentSnapshot {
    return {
      birthsThisYear: this.birthsThisYear,
      deathsThisYear: this.deathsThisYear,
      totalBirths: this.totalBirths,
      totalDeaths: this.totalDeaths,
      lastMilestone: this.lastMilestone,
    };
  }

  /**
   * Restore agent state from a snapshot.
   *
   * @param snapshot - Previously serialized DemographicAgentSnapshot
   */
  restore(snapshot: DemographicAgentSnapshot): void {
    this.birthsThisYear = snapshot.birthsThisYear;
    this.deathsThisYear = snapshot.deathsThisYear;
    this.totalBirths = snapshot.totalBirths;
    this.totalDeaths = snapshot.totalDeaths;
    this.lastMilestone = snapshot.lastMilestone;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _getTotalPopulation(): number {
    let total = 0;
    for (const entity of dvory) {
      total += entity.dvor.members.length;
    }
    return total;
  }

  private _checkMilestones(): void {
    const pop = this._getTotalPopulation();
    const milestone = Math.floor(pop / POPULATION_MILESTONE_STEP) * POPULATION_MILESTONE_STEP;
    if (milestone > this.lastMilestone) {
      this.lastMilestone = milestone;
      // Milestone reached — callers can check via assessLaborCapacity() or serialize()
    }
  }

  private _checkMilestonesAggregate(raion: RaionPool): void {
    const pop = raion.totalPopulation;
    const milestone = Math.floor(pop / POPULATION_MILESTONE_STEP) * POPULATION_MILESTONE_STEP;
    if (milestone > this.lastMilestone) {
      this.lastMilestone = milestone;
    }
  }
}

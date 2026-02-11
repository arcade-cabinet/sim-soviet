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

import { dvory } from '@/ecs/archetypes';
import { laborCapacityForAge, memberRoleForAge } from '@/ecs/factories';
import { world } from '@/ecs/world';
import { TICKS_PER_MONTH, TICKS_PER_YEAR } from '@/game/Chronology';
import type { GameRng } from '@/game/SeedSystem';

/** Result of a single demographic tick. */
export interface DemographicTickResult {
  births: number;
  deaths: number;
  aged: number;
  newDvory: number;
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

// ── Death Constants ──────────────────────────────────────────────────────────

/** Annual mortality rates by age bracket. */
const ANNUAL_MORTALITY: Array<{ maxAge: number; rate: number }> = [
  { maxAge: 1, rate: 0.15 }, // infant: 15%/year
  { maxAge: 12, rate: 0.02 }, // child: 2%/year
  { maxAge: 55, rate: 0.005 }, // adult: 0.5%/year
  { maxAge: 70, rate: 0.03 }, // elder: 3%/year
  { maxAge: Infinity, rate: 0.08 }, // very old: 8%/year
];

/** Additional monthly death rate from starvation (food = 0). */
const STARVATION_MONTHLY_RATE = 0.05;

function getAnnualMortality(age: number): number {
  for (const bracket of ANNUAL_MORTALITY) {
    if (age < bracket.maxAge) return bracket.rate;
  }
  return 0.08;
}

// ── Aging ────────────────────────────────────────────────────────────────────

/**
 * Age all dvor members by 1 year.
 * Updates roles and labor capacity based on new age.
 * Preserves 'head' and 'spouse' roles — only non-leadership roles transition.
 */
export function ageAllMembers(): number {
  let totalAged = 0;

  for (const entity of dvory) {
    for (const member of entity.dvor.members) {
      member.age += 1;
      totalAged++;

      // Update labor capacity
      member.laborCapacity = laborCapacityForAge(member.age, member.gender);

      // Only transition non-leadership roles
      if (member.role !== 'head' && member.role !== 'spouse') {
        member.role = memberRoleForAge(member.age);
      }
    }
  }

  return totalAged;
}

// ── Births ───────────────────────────────────────────────────────────────────

/**
 * Check for births among eligible women in all dvory.
 *
 * Eligible: female, age 16-45, not currently pregnant.
 * Base probability: 15% per year → ~1.25% per month.
 * Food modifier: foodLevel < 0.5 → ×0.5, foodLevel > 0.8 → ×1.2.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: birth eligibility + RNG + infant creation is inherently branchy
export function birthCheck(
  rng: GameRng | null,
  foodLevel: number,
  result: DemographicTickResult
): void {
  // Food modifier
  let foodMod = 1.0;
  if (foodLevel < 0.5) foodMod = 0.5;
  else if (foodLevel > 0.8) foodMod = 1.2;

  const threshold = MONTHLY_BIRTH_RATE * foodMod;

  for (const entity of dvory) {
    const dvor = entity.dvor;

    // Snapshot members before iterating — births push to the array below
    const existingMembers = [...dvor.members];

    for (const member of existingMembers) {
      // Eligibility: female, fertile age, not pregnant
      if (member.gender !== 'female') continue;
      if (member.age < FERTILITY_MIN_AGE || member.age > FERTILITY_MAX_AGE) continue;
      if (member.pregnant != null && member.pregnant > 0) continue;

      const roll = rng?.random() ?? Math.random();
      if (roll < threshold) {
        // Birth! Add infant to this dvor
        const infantGender: 'male' | 'female' =
          (rng?.random() ?? Math.random()) < 0.5 ? 'male' : 'female';
        dvor.nextMemberId = (dvor.nextMemberId ?? dvor.members.length) + 1;
        const infantId = `${dvor.id}-m${dvor.nextMemberId}`;

        dvor.members.push({
          id: infantId,
          name: `Infant ${infantId}`,
          gender: infantGender,
          age: 0,
          role: 'infant',
          laborCapacity: 0,
          trudodniEarned: 0,
          health: 100,
        });

        result.births++;
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
export function deathCheck(
  rng: GameRng | null,
  foodLevel: number,
  result: DemographicTickResult
): void {
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
        // Dead
        result.deaths++;
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
 * - Month boundary (every 30 ticks): births + deaths
 * - Tick 0 is always skipped.
 */
export function demographicTick(
  rng: GameRng | null,
  totalTicks: number,
  foodLevel: number
): DemographicTickResult {
  const result: DemographicTickResult = {
    births: 0,
    deaths: 0,
    aged: 0,
    newDvory: 0,
  };

  if (totalTicks <= 0) return result;

  // Year boundary: age all members
  if (totalTicks % TICKS_PER_YEAR === 0) {
    result.aged = ageAllMembers();
  }

  // Month boundary: births and deaths
  if (totalTicks % TICKS_PER_MONTH === 0) {
    birthCheck(rng, foodLevel, result);
    deathCheck(rng, foodLevel, result);
  }

  return result;
}

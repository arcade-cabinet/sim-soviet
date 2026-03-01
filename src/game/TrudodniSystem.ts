/**
 * TrudodniSystem — gender-based trudodni (work-day) categories.
 *
 * Historical: The 7-category trudodni system (1930-1966) assigned labor
 * values based on gender and role. Men received categories 5-7 (1.5-2.5
 * trudodni/day), women categories 1-4 (0.5-1.25/day).
 */

import { citizens, dvory } from '@/ecs/archetypes';
import type { MemberRole } from '@/ecs/world';

/** Trudodni category (1-7, higher = more valuable labor). */
export type TrudodniCategory = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Daily trudodni value for each category. */
export const TRUDODNI_VALUES: Record<TrudodniCategory, number> = {
  1: 0.5,
  2: 0.75,
  3: 1.0,
  4: 1.25,
  5: 1.5,
  6: 2.0,
  7: 2.5,
};

/** Approximate days per month for trudodni accrual. */
const DAYS_PER_MONTH = 26; // 6-day work week

/**
 * Determine the default trudodni category based on gender and role.
 *
 * Men workers: category 5 (default), specialists (engineers): 6-7
 * Women workers: category 3 (default)
 * Adolescents: category 1-2
 * Elders: category 1
 */
export function defaultCategory(gender: 'male' | 'female', role: MemberRole): TrudodniCategory {
  // Elders always category 1
  if (role === 'elder') return 1;

  // Adolescents: boys get 2, girls get 1
  if (role === 'adolescent') return gender === 'male' ? 2 : 1;

  // Children and infants should not earn trudodni, but if called, category 1
  if (role === 'child' || role === 'infant') return 1;

  // Working adults
  if (gender === 'male') {
    // Head of household or specialist roles get higher categories
    if (role === 'head') return 6;
    return 5; // Default male worker
  }

  // Female workers
  return 3;
}

/** Result of monthly trudodni accrual. */
export interface TrudodniAccrualResult {
  /** Total trudodni accrued across the collective this month. */
  totalTrudodni: number;
  /** Number of members who accrued trudodni. */
  memberCount: number;
}

/**
 * Accrue monthly trudodni for all dvor members with citizen entities.
 *
 * For each citizen entity linked to a dvor, calculates trudodni earned
 * based on their category and updates the corresponding DvorMember.trudodniEarned.
 */
export function accrueTrudodni(): TrudodniAccrualResult {
  let totalTrudodni = 0;
  let memberCount = 0;

  // Build a lookup from dvorId+memberId → citizen entity for efficient matching
  const citizenLookup = new Map<string, { gender: 'male' | 'female'; assignment?: string }>();
  for (const entity of citizens) {
    const c = entity.citizen;
    if (c.dvorId && c.dvorMemberId && c.gender) {
      citizenLookup.set(`${c.dvorId}:${c.dvorMemberId}`, {
        gender: c.gender,
        assignment: c.assignment,
      });
    }
  }

  // Iterate all dvory and update member trudodni
  for (const entity of dvory) {
    const dvor = entity.dvor;
    for (const member of dvor.members) {
      // Only accrue for members who have citizen entities (working age)
      const citizenInfo = citizenLookup.get(`${dvor.id}:${member.id}`);
      if (!citizenInfo) continue;

      // Only accrue for members with work assignments
      if (!citizenInfo.assignment) continue;

      const category = defaultCategory(member.gender, member.role);
      const monthlyTrudodni = TRUDODNI_VALUES[category] * DAYS_PER_MONTH;

      member.trudodniEarned += monthlyTrudodni;
      totalTrudodni += monthlyTrudodni;
      memberCount++;
    }
  }

  return { totalTrudodni, memberCount };
}

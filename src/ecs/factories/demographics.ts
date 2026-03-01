/**
 * @module ecs/factories/demographics
 *
 * Demographic utility functions: age-based labor capacity, role assignment,
 * and age category classification.
 */

import type { AgeCategory, MemberRole } from '../world';

/** Soviet retirement age: 55 for women, 60 for men. */
const RETIREMENT_AGE = { male: 60, female: 55 } as const;

/**
 * Compute labor capacity from age, following the historical curve.
 * Gender-differentiated: women retire at 55, men at 60 (Soviet pension law).
 *
 * ```
 * Female: 0-11:0.0, 12-15:0.3, 16-20:0.7, 21-45:1.0, 46-54:0.8, 55-65:0.5, 66+:0.2
 * Male:   0-11:0.0, 12-15:0.3, 16-20:0.7, 21-45:1.0, 46-54:0.8, 55-59:0.7, 60-65:0.5, 66+:0.2
 * ```
 */
export function laborCapacityForAge(age: number, gender: 'male' | 'female'): number {
  if (age < 12) return 0;
  if (age < 16) return 0.3;
  if (age < 21) return 0.7;
  if (age < 46) return 1.0;
  if (age < 55) return 0.8;
  if (gender === 'male') {
    if (age < 60) return 0.7;
    if (age < 66) return 0.5;
    return 0.2;
  }
  // female: retired at 55
  if (age < 66) return 0.5;
  return 0.2;
}

/**
 * Derive the default member role from age.
 * Head/spouse roles are assigned separately during dvor creation.
 * Gender-differentiated: women become elder at 55, men at 60.
 */
export function memberRoleForAge(age: number, gender: 'male' | 'female'): MemberRole {
  if (age < 1) return 'infant';
  if (age < 12) return 'child';
  if (age < 16) return 'adolescent';
  if (age < RETIREMENT_AGE[gender]) return 'worker';
  return 'elder';
}

/**
 * Compute the age category bracket from a numeric age.
 * Used for render slot sprite variant selection and role transitions.
 * Gender-differentiated: women become elder at 55, men at 60.
 */
export function ageCategoryFromAge(age: number, gender: 'male' | 'female'): AgeCategory {
  if (age < 12) return 'child';
  if (age < 16) return 'adolescent';
  if (age < RETIREMENT_AGE[gender]) return 'adult';
  return 'elder';
}

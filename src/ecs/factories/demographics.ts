/**
 * @module ecs/factories/demographics
 *
 * Demographic utility functions: age-based labor capacity, role assignment,
 * and age category classification.
 */

import type { AgeCategory, MemberRole } from '../world';

/**
 * Compute labor capacity from age, following the historical curve.
 *
 * ```
 * Age  0-11: 0.0  (child — non-productive)
 * Age 12-15: 0.3  (adolescent — light work)
 * Age 16-20: 0.7  (young adult — learning)
 * Age 21-45: 1.0  (prime working age)
 * Age 46-54: 0.8  (declining)
 * Age 55-65: 0.5  (elder work)
 * Age 66+:   0.2  (minimal)
 * ```
 */
export function laborCapacityForAge(age: number, _gender: 'male' | 'female'): number {
  if (age < 12) return 0;
  if (age < 16) return 0.3;
  if (age < 21) return 0.7;
  if (age < 46) return 1.0;
  if (age < 55) return 0.8;
  if (age < 66) return 0.5;
  return 0.2;
}

/**
 * Derive the default member role from age.
 * Head/spouse roles are assigned separately during dvor creation.
 */
export function memberRoleForAge(age: number): MemberRole {
  if (age < 1) return 'infant';
  if (age < 12) return 'child';
  if (age < 16) return 'adolescent';
  if (age < 60) return 'worker';
  return 'elder';
}

/**
 * Compute the age category bracket from a numeric age.
 * Used for render slot sprite variant selection and role transitions.
 */
export function ageCategoryFromAge(age: number): AgeCategory {
  if (age < 12) return 'child';
  if (age < 16) return 'adolescent';
  if (age < 60) return 'adult';
  return 'elder';
}

/**
 * @module ecs/factories/citizenFactories
 *
 * Citizen entity factory and render slot computation.
 */

import { GRID_SIZE } from '@/config';
import type { CitizenComponent, CitizenRenderSlot, Entity } from '../world';
import { world } from '../world';
import { ageCategoryFromAge, memberRoleForAge } from './demographics';

// ── Citizen Render Slot ──────────────────────────────────────────────────────

/** Citizen class → dot color for Canvas2D indicator rendering. */
const CITIZEN_DOT_COLORS: Record<string, string> = {
  worker: '#8D6E63',
  party_official: '#C62828',
  engineer: '#1565C0',
  farmer: '#2E7D32',
  soldier: '#4E342E',
  prisoner: '#616161',
};

/** Citizen class → dialogue pool for tap interaction. */
const CLASS_TO_DIALOGUE_POOL: Record<string, CitizenRenderSlot['dialoguePool']> = {
  worker: 'worker',
  farmer: 'worker',
  engineer: 'worker',
  party_official: 'party_official',
  soldier: 'military',
  prisoner: 'worker',
};

/**
 * Build a CitizenRenderSlot from citizen data.
 * Pre-computes all visual + dialogue fields so the renderer and dialogue
 * system can read them directly without runtime lookups.
 */
export function computeRenderSlot(
  citizenClass: string,
  gender: 'male' | 'female' = 'male',
  age: number = 25
): CitizenRenderSlot {
  return {
    gender,
    ageCategory: ageCategoryFromAge(age),
    citizenClass,
    dotColor: CITIZEN_DOT_COLORS[citizenClass] ?? '#757575',
    dialoguePool: CLASS_TO_DIALOGUE_POOL[citizenClass] ?? 'worker',
  };
}

// ── Citizen Factory ─────────────────────────────────────────────────────────

/**
 * Creates a citizen entity with a pre-computed render slot.
 *
 * New citizens start at the center of the grid if no home is assigned.
 *
 * @param citizenClass - Occupation / social class
 * @param homeX        - Optional grid X of housing assignment
 * @param homeY        - Optional grid Y of housing assignment
 * @param gender       - Optional gender (defaults to 'male' for backward compat)
 * @param age          - Optional age in years (defaults to 25)
 * @param dvorId       - Optional dvor (household) ID
 * @returns The created entity, already added to the world
 */
export function createCitizen(
  citizenClass: CitizenComponent['class'],
  homeX?: number,
  homeY?: number,
  gender: 'male' | 'female' = 'male',
  age: number = 25,
  dvorId?: string
): Entity {
  const citizen: CitizenComponent = {
    class: citizenClass,
    happiness: 50,
    hunger: 0,
    home: homeX != null && homeY != null ? { gridX: homeX, gridY: homeY } : undefined,
    gender,
    age,
    dvorId,
    memberRole: memberRoleForAge(age),
  };

  const entity: Entity = {
    position: {
      gridX: homeX ?? Math.floor(GRID_SIZE / 2),
      gridY: homeY ?? Math.floor(GRID_SIZE / 2),
    },
    citizen,
    renderSlot: computeRenderSlot(citizenClass, gender, age),
    isCitizen: true,
  };

  return world.add(entity);
}

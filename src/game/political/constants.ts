/**
 * @module game/political/constants
 *
 * Shared constants, name generation, and pure helpers for the political system.
 */

import type { DialogueContext } from '@/content/dialogue';
import { getDialogue } from '@/content/dialogue';
import { buildingsLogic } from '@/ecs/archetypes';
import type { GameRng } from '@/game/SeedSystem';
import type { SettlementTier } from '@/game/SettlementSystem';
import type { PoliticalRole } from './types';

// ─── Entity Scaling ─────────────────────────────────────────────────────────

/** Entity count ranges per tier: [min, max] for each role. */
export const ENTITY_SCALING: Record<SettlementTier, Record<PoliticalRole, [min: number, max: number]>> = {
  selo: {
    politruk: [0, 1],
    kgb_agent: [0, 0],
    military_officer: [0, 0],
    conscription_officer: [0, 0],
  },
  posyolok: {
    politruk: [1, 2],
    kgb_agent: [0, 1],
    military_officer: [0, 1],
    conscription_officer: [0, 0],
  },
  pgt: {
    politruk: [2, 3],
    kgb_agent: [1, 2],
    military_officer: [1, 1],
    conscription_officer: [0, 1],
  },
  gorod: {
    politruk: [3, 5],
    kgb_agent: [2, 4],
    military_officer: [1, 2],
    conscription_officer: [1, 1],
  },
};

/** Wartime eras double military presence. */
export const WARTIME_ERAS = new Set(['revolution', 'great_patriotic']);

/** Corruption threshold above which KGB presence increases. */
export const HIGH_CORRUPTION_THRESHOLD = 50;

// ─── Name Generation ────────────────────────────────────────────────────────

const OFFICER_SURNAMES = [
  'Petrov',
  'Ivanov',
  'Kuznetsov',
  'Sidorov',
  'Volkov',
  'Kozlov',
  'Morozov',
  'Lebedev',
  'Sokolov',
  'Popov',
  'Novikov',
  'Fedorov',
  'Orlov',
  'Zhukov',
  'Vasiliev',
] as const;

const OFFICER_RANKS: Record<PoliticalRole, readonly string[]> = {
  politruk: ['Politruk', 'Senior Politruk', 'Battalion Commissar'],
  kgb_agent: ['Agent', 'Senior Agent', 'Inspector'],
  military_officer: ['Lieutenant', 'Captain', 'Major', 'Colonel'],
  conscription_officer: ['Recruiting Officer', 'Mobilization Commissar'],
};

export function generateOfficerName(role: PoliticalRole, rng: GameRng): string {
  const rank = rng.pick(OFFICER_RANKS[role]);
  const surname = rng.pick(OFFICER_SURNAMES);
  return `${rank} ${surname}`;
}

// ─── Pure Helpers ───────────────────────────────────────────────────────────

/** Calculate target count for a role, applying wartime and corruption bonuses. */
export function calcTargetCount(
  base: number,
  max: number,
  role: PoliticalRole,
  isWartime: boolean,
  highCorruption: boolean,
): number {
  let count = base;
  if (isWartime && (role === 'military_officer' || role === 'conscription_officer')) {
    count = Math.min(count * 2, max * 2);
  }
  if (highCorruption && role === 'kgb_agent') {
    count = Math.min(count + 1, max + 2);
  }
  return count;
}

/** Pick a random building position from the ECS world. */
export function pickRandomBuildingPosition(rng: GameRng): { gridX: number; gridY: number; defId: string } | null {
  const all = [...buildingsLogic];
  if (all.length === 0) return null;
  const building = rng.pick(all);
  return {
    gridX: building.position.gridX,
    gridY: building.position.gridY,
    defId: building.building.defId,
  };
}

/** Map a political role to its dialogue character key. */
export function roleToDialogueCharacter(role: PoliticalRole): 'politruk' | 'kgb' | 'military' | null {
  switch (role) {
    case 'politruk':
      return 'politruk';
    case 'kgb_agent':
      return 'kgb';
    case 'military_officer':
    case 'conscription_officer':
      return 'military';
  }
}

/** Get dialogue for a specific character in a given context. */
export function getEntityDialogueText(
  character: 'politruk' | 'kgb' | 'military',
  context: DialogueContext,
): string | null {
  return getDialogue(character, context);
}

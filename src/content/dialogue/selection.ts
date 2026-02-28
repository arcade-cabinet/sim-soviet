import { weightedPick } from './_rng';
import {
  ADVISOR_LINES,
  ALL_LINES,
  AMBIENT_LINES,
  KGB_LINES,
  LINES_BY_CHARACTER,
  MILITARY_LINES,
  PARTY_OFFICIAL_LINES,
  POLITRUK_LINES,
  WORKER_LINES,
} from './pools';
import type { DialogueCharacter, DialogueContext, DialogueLine } from './types';

/**
 * Returns true if the given dialogue line's conditions are satisfied
 * by the current context. Lines with no conditions always match.
 */
function matchesContext(line: DialogueLine, context: DialogueContext): boolean {
  if (!line.conditions) return true;
  const c = line.conditions;
  if (c.season !== undefined && c.season !== context.season) return false;
  if (c.resourceLevel !== undefined && c.resourceLevel !== context.resourceLevel) return false;
  if (c.era !== undefined && c.era !== context.era) return false;
  if (c.threatLevel !== undefined && c.threatLevel !== context.threatLevel) return false;
  if (c.settlementTier !== undefined && c.settlementTier !== context.settlementTier) return false;
  return true;
}

/**
 * Filter a set of lines by context and return matching ones.
 * If no context-specific lines match, falls back to universal lines
 * (those with no conditions).
 */
function filterByContext(lines: readonly DialogueLine[], context: DialogueContext): readonly DialogueLine[] {
  const matched = lines.filter((l) => matchesContext(l, context));
  if (matched.length > 0) return matched;
  // Fallback to universal lines
  return lines.filter((l) => !l.conditions);
}

/**
 * Get a context-appropriate dialogue line for the given character.
 * Returns the text string, selected using weighted random with
 * the seeded RNG if available.
 */
export function getDialogue(character: DialogueCharacter, context: DialogueContext): string {
  const pool = LINES_BY_CHARACTER[character];
  const candidates = filterByContext(pool, context);
  return weightedPick(candidates).text;
}

/**
 * Get a random ambient chatter snippet appropriate for the context.
 */
export function getAmbientChatter(context: DialogueContext): string {
  return getDialogue('ambient', context);
}

/**
 * Get all dialogue lines for a given character (unfiltered).
 * Useful for testing and content auditing.
 */
export function getAllLines(character: DialogueCharacter): readonly DialogueLine[] {
  return LINES_BY_CHARACTER[character];
}

/**
 * Get all dialogue lines across all characters.
 */
export function getAllDialogueLines(): readonly DialogueLine[] {
  return ALL_LINES;
}

/**
 * Get the count of lines per character type.
 * Useful for content coverage validation.
 */
export function getLineCounts(): Record<DialogueCharacter, number> {
  return {
    worker: WORKER_LINES.length,
    politruk: POLITRUK_LINES.length,
    kgb: KGB_LINES.length,
    military: MILITARY_LINES.length,
    party_official: PARTY_OFFICIAL_LINES.length,
    advisor: ADVISOR_LINES.length,
    ambient: AMBIENT_LINES.length,
  };
}

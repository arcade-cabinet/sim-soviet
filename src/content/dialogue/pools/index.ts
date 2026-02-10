import type { DialogueCharacter, DialogueLine } from '../types';
import { ADVISOR_LINES } from './advisor';
import { AMBIENT_LINES } from './ambient';
import { KGB_LINES } from './kgb';
import { MILITARY_LINES } from './military';
import { PARTY_OFFICIAL_LINES } from './party';
import { POLITRUK_LINES } from './politruk';
import { WORKER_LINES } from './worker';

export {
  WORKER_LINES,
  POLITRUK_LINES,
  KGB_LINES,
  MILITARY_LINES,
  PARTY_OFFICIAL_LINES,
  ADVISOR_LINES,
  AMBIENT_LINES,
};

/** All dialogue lines, indexed for fast lookup. */
export const ALL_LINES: readonly DialogueLine[] = [
  ...WORKER_LINES,
  ...POLITRUK_LINES,
  ...KGB_LINES,
  ...MILITARY_LINES,
  ...PARTY_OFFICIAL_LINES,
  ...ADVISOR_LINES,
  ...AMBIENT_LINES,
] as const;

/** Per-character line arrays for direct access. */
export const LINES_BY_CHARACTER: Record<DialogueCharacter, readonly DialogueLine[]> = {
  worker: WORKER_LINES,
  politruk: POLITRUK_LINES,
  kgb: KGB_LINES,
  military: MILITARY_LINES,
  party_official: PARTY_OFFICIAL_LINES,
  advisor: ADVISOR_LINES,
  ambient: AMBIENT_LINES,
};

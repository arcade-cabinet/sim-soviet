/**
 * @fileoverview Barrel file for all minigame definitions.
 */

import type { MinigameDefinition } from '../MinigameTypes';
import { BLACK_MARKET } from './black-market';
import { CONSCRIPTION_SELECTION } from './conscription';
import { FACTORY_EMERGENCY } from './factory';
import { THE_HUNT } from './hunt';
import { IDEOLOGY_SESSION } from './ideology';
import { THE_INSPECTION } from './inspection';
import { INTERROGATION } from './interrogation';
import { THE_QUEUE } from './queue';

/** All 8 minigame definitions, keyed by ID. */
export const MINIGAME_DEFINITIONS: ReadonlyArray<MinigameDefinition> = [
  THE_QUEUE,
  IDEOLOGY_SESSION,
  THE_INSPECTION,
  CONSCRIPTION_SELECTION,
  BLACK_MARKET,
  FACTORY_EMERGENCY,
  THE_HUNT,
  INTERROGATION,
];

/** Lookup a definition by ID. */
export function getMinigameDefinition(id: string): MinigameDefinition | undefined {
  return MINIGAME_DEFINITIONS.find((d) => d.id === id);
}

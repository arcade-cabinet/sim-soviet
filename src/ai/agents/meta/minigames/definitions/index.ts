/**
 * @fileoverview Barrel file for all minigame definitions.
 */

import type { MinigameDefinition } from '../MinigameTypes';
import { BLACK_MARKET } from './black-market';
import { CONSCRIPTION_SELECTION } from './conscription';
import { FACTORY_EMERGENCY } from './factory';
import { GRID_MANAGEMENT } from './grid-management';
import { HARVEST_CAMPAIGN } from './harvest-campaign';
import { THE_HUNT } from './hunt';
import { IDEOLOGICAL_EDUCATION } from './ideological-education';
import { IDEOLOGY_SESSION } from './ideology';
import { THE_INSPECTION } from './inspection';
import { INTERROGATION } from './interrogation';
import { MILITARY_INSPECTION } from './military-inspection';
import { MINING_EXPEDITION } from './mining-expedition';
import { PAPERWORK_AVALANCHE } from './paperwork-avalanche';
import { PRISONER_REFORM } from './prisoner-reform';
import { PRODUCTION_QUOTAS } from './production-quotas';
import { QUALITY_CONTROL } from './quality-control';
import { THE_QUEUE } from './queue';

/** All 17 minigame definitions, keyed by ID. */
export const MINIGAME_DEFINITIONS: ReadonlyArray<MinigameDefinition> = [
  THE_QUEUE,
  IDEOLOGY_SESSION,
  THE_INSPECTION,
  CONSCRIPTION_SELECTION,
  BLACK_MARKET,
  FACTORY_EMERGENCY,
  THE_HUNT,
  INTERROGATION,
  MINING_EXPEDITION,
  PRODUCTION_QUOTAS,
  HARVEST_CAMPAIGN,
  QUALITY_CONTROL,
  PRISONER_REFORM,
  PAPERWORK_AVALANCHE,
  GRID_MANAGEMENT,
  IDEOLOGICAL_EDUCATION,
  MILITARY_INSPECTION,
];

/** Lookup a definition by ID. */
export function getMinigameDefinition(id: string): MinigameDefinition | undefined {
  return MINIGAME_DEFINITIONS.find((d) => d.id === id);
}

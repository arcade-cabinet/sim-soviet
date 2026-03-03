import type { EventTemplate } from '../types';
import { ABSURDIST_EVENTS } from './absurdist';
import { CRISIS_EVENTS } from './crisis';
import { CULTURAL_EVENTS } from './cultural';
import { DISASTER_EVENTS } from './disasters';
import { ECONOMIC_EVENTS } from './economic';
import { ERA_SPECIFIC_EVENTS } from './era_specific';
import { POLITICAL_EVENTS } from './political';

// ─────────────────────────────────────────────────────────
//  ALL TEMPLATES  (aggregated from category files)
// ─────────────────────────────────────────────────────────

/** Aggregated array of all event templates from all category files. */
export const ALL_EVENT_TEMPLATES: EventTemplate[] = [
  ...DISASTER_EVENTS,
  ...POLITICAL_EVENTS,
  ...ECONOMIC_EVENTS,
  ...CULTURAL_EVENTS,
  ...ABSURDIST_EVENTS,
  ...ERA_SPECIFIC_EVENTS,
  ...CRISIS_EVENTS,
];

export {
  ABSURDIST_EVENTS,
  CRISIS_EVENTS,
  CULTURAL_EVENTS,
  DISASTER_EVENTS,
  ECONOMIC_EVENTS,
  ERA_SPECIFIC_EVENTS,
  POLITICAL_EVENTS,
};

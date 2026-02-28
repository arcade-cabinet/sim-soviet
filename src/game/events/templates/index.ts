import type { EventTemplate } from '../types';
import { ABSURDIST_EVENTS } from './absurdist';
import { CULTURAL_EVENTS } from './cultural';
import { DISASTER_EVENTS } from './disasters';
import { ECONOMIC_EVENTS } from './economic';
import { ERA_SPECIFIC_EVENTS } from './era_specific';
import { POLITICAL_EVENTS } from './political';

// ─────────────────────────────────────────────────────────
//  ALL TEMPLATES  (aggregated from category files)
// ─────────────────────────────────────────────────────────

export const ALL_EVENT_TEMPLATES: EventTemplate[] = [
  ...DISASTER_EVENTS,
  ...POLITICAL_EVENTS,
  ...ECONOMIC_EVENTS,
  ...CULTURAL_EVENTS,
  ...ABSURDIST_EVENTS,
  ...ERA_SPECIFIC_EVENTS,
];

export { ABSURDIST_EVENTS, CULTURAL_EVENTS, DISASTER_EVENTS, ECONOMIC_EVENTS, ERA_SPECIFIC_EVENTS, POLITICAL_EVENTS };

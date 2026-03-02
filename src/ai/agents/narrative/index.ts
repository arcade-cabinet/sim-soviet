/**
 * @module ai/agents/narrative
 *
 * Barrel re-export — public API of the NarrativeAgent subpackage.
 */

// ── Agent ──
export { NarrativeAgent, type NarrativeAgentSaveData } from './NarrativeAgent';

// ── EventSystem ──
export { EventSystem, type EventSystemSaveData } from './events';
export { ALL_EVENT_TEMPLATES } from './events/templates';
export type {
  EventCategory,
  EventSeverity,
  EventTemplate,
  GameEvent,
  ResourceDelta,
} from './events/types';

// ── PravdaSystem ──
export { PravdaSystem, type PravdaSaveData } from './pravda';
export type { PravdaHeadline } from './pravda/types';

// ── PolitburoSystem ──
export { PolitburoSystem, type PolitburoSaveData } from './politburo';
export {
  APPOINTMENT_STRATEGIES,
  DEFAULT_MODIFIERS,
  FIRST_NAMES,
  LAST_NAMES,
  MINISTRY_NAMES,
  PERSONALITY_MINISTRY_MATRIX,
  PERSONALITY_STAT_RANGES,
  TENSION_RULES,
} from './politburo/constants';
export { calculateCoupChance, calculatePurgeChance } from './politburo/coups';
export { MINISTRY_EVENTS } from './politburo/events';
export { generateGeneralSecretary, generateMinister } from './politburo/ministers';
export { LEADER_MODIFIERS } from './politburo/leaderModifiers';
export { applyMinisterOverrides } from './politburo/modifiers';
export {
  type AppointmentStrategy,
  type Faction,
  type GeneralSecretary,
  type Minister,
  Ministry,
  type MinistryEventTemplate,
  type MinistryModifiers,
  type ModifierOverride,
  PersonalityType,
  type PolitburoState,
  type TensionRule,
} from './politburo/types';

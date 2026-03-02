/**
 * @module game/politburo
 *
 * Barrel re-export — public API of the Politburo subpackage.
 */

// ── Constants ──
export {
  APPOINTMENT_STRATEGIES,
  DEFAULT_MODIFIERS,
  FIRST_NAMES,
  LAST_NAMES,
  MINISTRY_NAMES,
  PERSONALITY_MINISTRY_MATRIX,
  PERSONALITY_STAT_RANGES,
  TENSION_RULES,
} from './constants';
// ── Coup/Purge calculations ──
export { calculateCoupChance, calculatePurgeChance } from './coups';
// ── Events ──
export { MINISTRY_EVENTS } from './events';
// ── Minister/GS generation ──
export { generateGeneralSecretary, generateMinister } from './ministers';
// ── The main system class ──
export { type PolitburoSaveData, PolitburoSystem } from './PolitburoSystem';
// ── Types & Enums ──
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
} from './types';

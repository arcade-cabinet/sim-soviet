/**
 * @module game/political
 *
 * Political entity system — visible politruks, KGB agents, and military
 * entities on the game map.
 */

export { PoliticalEntitySystem } from './PoliticalEntitySystem';
// Public API — matches original PoliticalEntitySystem.ts exports
export type {
  ConscriptionEvent,
  KGBInvestigation,
  OrgnaborEvent,
  PoliticalBuildingEffect,
  PoliticalEntitySaveData,
  PoliticalEntityStats,
  PoliticalRole,
  PoliticalTickResult,
  PolitrukEffect,
} from './types';

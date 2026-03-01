/**
 * @module game/political
 *
 * Political entity system — visible politruks, KGB agents, and military
 * entities on the game map. Also includes Raikom and doctrine mechanics.
 */

export type { DoctrineContext, DoctrinePolicy, ThawFreezeState } from './doctrine';
export {
  addPaperwork,
  ETERNAL_PAPERWORK_THRESHOLD,
  evaluateDoctrineMechanics,
  getDoctrinePolicyForEra,
  getPaperwork,
  getThawFreezeState,
  resetPaperwork,
  resetThawFreezeState,
  setPaperwork,
  setThawFreezeState,
} from './doctrine';
export { PoliticalEntitySystem } from './PoliticalEntitySystem';
// Public API — matches original PoliticalEntitySystem.ts exports
export type {
  ConscriptionEvent,
  DoctrineMechanicEffect,
  DoctrineMechanicId,
  IdeologySessionResult,
  KGBInformant,
  KGBInvestigation,
  OrgnaborEvent,
  PoliticalBuildingEffect,
  PoliticalEntitySaveData,
  PoliticalEntityStats,
  PoliticalRole,
  PoliticalTickResult,
  PolitrukEffect,
  PolitrukPersonality,
  RaikomDirective,
  RaikomPersonality,
  RaikomState,
} from './types';

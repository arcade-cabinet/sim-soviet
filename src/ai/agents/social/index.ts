/**
 * @module ai/agents/social
 *
 * Social agents: demographics and civil defense (fire/disease).
 */

export type {
  DefenseAgentCallbacks,
  DefenseAgentSnapshot,
  DiseaseDefinition,
  DiseaseType,
  EmergencyState,
  ZeppelinState,
} from './DefenseAgent';
export { DefenseAgent, DISEASE_DEFINITIONS } from './DefenseAgent';
export type {
  AgedIntoWorkingRef,
  DeadMemberRef,
  DemographicAgentSnapshot,
  DemographicTickResult,
} from './DemographicAgent';
export { DemographicAgent } from './DemographicAgent';

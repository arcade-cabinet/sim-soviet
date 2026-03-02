/**
 * @module ai/agents/social
 *
 * Social agents: demographics and civil defense (fire/disease).
 */
export { DemographicAgent } from './DemographicAgent';
export type { DeadMemberRef, AgedIntoWorkingRef, DemographicTickResult, DemographicAgentSnapshot } from './DemographicAgent';
export { DefenseAgent, DISEASE_DEFINITIONS } from './DefenseAgent';
export type { DiseaseType, DiseaseDefinition, ZeppelinState, EmergencyState, DefenseAgentSnapshot, DefenseAgentCallbacks } from './DefenseAgent';

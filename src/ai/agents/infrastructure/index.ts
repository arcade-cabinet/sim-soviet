/**
 * @module ai/agents/infrastructure
 *
 * Infrastructure agents: power distribution and collective construction.
 */
export { PowerAgent } from './PowerAgent';
export type { PowerPriority, PowerAgentState } from './PowerAgent';
export {
  CollectiveAgent,
  CollectivePlanner,
  detectConstructionDemands,
  autoPlaceBuilding,
  evaluateWorkerPriority,
  findBestAssignment,
  runGovernor,
} from './CollectiveAgent';
export type {
  CollectiveFocus,
  GovernorPriority,
  GovernorRecommendation,
  DemandCategory,
  DemandPriority,
  ConstructionDemand,
  ResourceSnapshot,
  RequestSource,
  ConstructionRequest,
  CollectiveAgentState,
} from './CollectiveAgent';

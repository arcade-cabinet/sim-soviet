/**
 * @module ai/agents/infrastructure
 *
 * Infrastructure agents: power distribution, collective construction,
 * building construction/decay, transport/roads, and settlement tiers.
 */

export type {
  CollectiveAgentState,
  CollectiveFocus,
  ConstructionDemand,
  ConstructionRequest,
  DemandCategory,
  DemandPriority,
  GovernorPriority,
  GovernorRecommendation,
  RequestSource,
  ResourceSnapshot,
} from './CollectiveAgent';
export {
  autoPlaceBuilding,
  CollectiveAgent,
  CollectivePlanner,
  detectConstructionDemands,
  evaluateWorkerPriority,
  findBestAssignment,
  runGovernor,
} from './CollectiveAgent';
export { ConstructionAgent } from './ConstructionAgent';
export {
  constructionSystem,
  DEFAULT_BASE_TICKS,
  DEFAULT_MATERIAL_COST,
  DEFAULT_STAFF_CAP,
  workerSpeedMult,
} from './constructionSystem';
export { DecayAgent } from './DecayAgent';
export type { BuildingCollapsedCallback } from './decaySystem';
export { decaySystem, setBuildingCollapsedCallback } from './decaySystem';
export type { CascadeResult, DisplacementResult } from './displacementSystem';
export { cascadeDisplacement, executeDisplacement, findDisplaceable } from './displacementSystem';
export type { PowerAgentState, PowerPriority } from './PowerAgent';
export { PowerAgent } from './PowerAgent';
export { SettlementAgent } from './SettlementAgent';
export type {
  SettlementEvent,
  SettlementEventType,
  SettlementMetrics,
  SettlementSaveData,
  SettlementTier,
  TierDefinition,
} from './SettlementSystem';
export {
  GOROD_MIN_DISTINCT_ROLES,
  SettlementSystem,
  TIER_DEFINITIONS,
  TIER_ORDER,
} from './SettlementSystem';
export { TransportAgent } from './TransportAgent';
export type { TransportSaveData, TransportTickResult } from './TransportSystem';
export {
  applyMitigation,
  computeTransportScore,
  deserializeTransport,
  getRasputitsaMitigation,
  ROAD_QUALITY_LABELS,
  RoadQuality,
  scoreToQuality,
  serializeTransport,
  TransportSystem,
} from './TransportSystem';

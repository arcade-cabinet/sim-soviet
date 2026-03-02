/**
 * @module ai/agents/infrastructure
 *
 * Infrastructure agents: power distribution, collective construction,
 * building construction/decay, transport/roads, and settlement tiers.
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
export { ConstructionAgent } from './ConstructionAgent';
export {
  constructionSystem,
  DEFAULT_BASE_TICKS,
  DEFAULT_MATERIAL_COST,
  DEFAULT_STAFF_CAP,
  workerSpeedMult,
} from './constructionSystem';
export { DecayAgent } from './DecayAgent';
export { decaySystem, setBuildingCollapsedCallback } from './decaySystem';
export type { BuildingCollapsedCallback } from './decaySystem';
export { TransportAgent } from './TransportAgent';
export {
  TransportSystem,
  RoadQuality,
  ROAD_QUALITY_LABELS,
  computeTransportScore,
  scoreToQuality,
  getRasputitsaMitigation,
  applyMitigation,
  serializeTransport,
  deserializeTransport,
} from './TransportSystem';
export type { TransportSaveData, TransportTickResult } from './TransportSystem';
export { SettlementAgent } from './SettlementAgent';
export {
  SettlementSystem,
  TIER_ORDER,
  TIER_DEFINITIONS,
  GOROD_MIN_DISTINCT_ROLES,
} from './SettlementSystem';
export type {
  SettlementTier,
  TierDefinition,
  SettlementMetrics,
  SettlementEvent,
  SettlementEventType,
  SettlementSaveData,
} from './SettlementSystem';

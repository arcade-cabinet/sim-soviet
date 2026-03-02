/**
 * @module ai/agents/political
 *
 * Political agents: era management, KGB surveillance, loyalty tracking,
 * quota enforcement, compulsory deliveries, and scoring.
 */
export { PoliticalAgent } from './PoliticalAgent';
export type { PoliticalState, ReportStrategy } from './PoliticalAgent';
export { KGBAgent } from './KGBAgent';
export type { Difficulty, MarkSource, CommendationSource, FileEntry, ThreatLevel, PersonnelFileSaveData } from './KGBAgent';
export { LoyaltyAgent } from './LoyaltyAgent';
export type { LoyaltyState, LoyaltyResult } from './LoyaltyAgent';

// QuotaAgent + absorbed systems
export { QuotaAgent } from './QuotaAgent';
export type { QuotaAgentSaveData } from './QuotaAgent';
export { quotaSystem, createDefaultQuota, areAllQuotasMet } from './quotaSystem';
export type { QuotaState, QuotaResourceType, ResourceQuota } from './quotaSystem';
export { CompulsoryDeliveries } from './CompulsoryDeliveries';
export type {
  Doctrine,
  DeliveryRates,
  DeliveryResult,
  CompulsoryDeliverySaveData,
} from './CompulsoryDeliveries';
export {
  ScoringSystem,
  eraIdToIndex,
  getEraMultiplier,
  getSettingsMultiplier,
  DIFFICULTY_PRESETS,
  CONSEQUENCE_PRESETS,
  SCORE_MULTIPLIER_MATRIX,
  MEDALS,
} from './ScoringSystem';
export type {
  DifficultyLevel,
  ConsequenceLevel,
  DifficultyConfig,
  ConsequenceConfig,
  EraScoreBreakdown,
  ScoreBreakdown,
  Medal,
  ScoringSystemSaveData,
} from './ScoringSystem';

// Annual report helpers
export {
  checkQuota,
  processReport,
  falsificationRisk,
  handleQuotaMet,
  handleQuotaMissed,
} from './annualReportTick';
export type { AnnualReportEngineState, AnnualReportContext } from './annualReportTick';

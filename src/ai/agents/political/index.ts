/**
 * @module ai/agents/political
 *
 * Political agents: era management, KGB surveillance, loyalty tracking,
 * quota enforcement, compulsory deliveries, and scoring.
 */

export type { AnnualReportContext, AnnualReportEngineState } from './annualReportTick';
// Annual report helpers
export {
  checkQuota,
  falsificationRisk,
  handleQuotaMet,
  handleQuotaMissed,
  processReport,
} from './annualReportTick';
export type {
  CompulsoryDeliverySaveData,
  DeliveryRates,
  DeliveryResult,
  Doctrine,
} from './CompulsoryDeliveries';
export { CompulsoryDeliveries } from './CompulsoryDeliveries';
export {
  calcTargetCount,
  ENTITY_SCALING,
  generateOfficerName,
  getEntityDialogueText,
  HIGH_CORRUPTION_THRESHOLD,
  pickRandomBuildingPosition,
  roleToDialogueCharacter,
  WARTIME_ERAS,
} from './constants';
export type { DoctrineContext, DoctrinePolicy, ThawFreezeState } from './doctrine';
export {
  addPaperwork,
  DOCTRINE_MECHANICS,
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
export type {
  CommendationSource,
  Difficulty,
  FileEntry,
  MarkSource,
  PersonnelFileSaveData,
  ThreatLevel,
} from './KGBAgent';
export { KGBAgent } from './KGBAgent';
export {
  BASE_ARREST_COUNT,
  createInformant,
  createInvestigation,
  getBlackMarkChance,
  INFORMANT_FLAG_CHANCE,
  INFORMANT_REPORT_INTERVAL,
  INVESTIGATION_MAX_TICKS,
  INVESTIGATION_MIN_TICKS,
  KGB_BLACK_MARK_CHANCE_PURGE,
  KGB_BLACK_MARK_CHANCE_THOROUGH,
  KGB_FLAG_CHANCE,
  KGB_LOYALTY_BOOST,
  KGB_MORALE_DROP,
  KGB_REASSIGNMENT_INTERVAL,
  PURGE_ARREST_MULT,
  resolveInvestigation,
  rollInvestigationIntensity,
  tickInformants,
  tickInvestigations,
} from './kgb';
export type { LoyaltyResult, LoyaltyState } from './LoyaltyAgent';
export { LoyaltyAgent } from './LoyaltyAgent';
export {
  CONSCRIPTION_DEADLINE_TICKS,
  processConscriptionQueue,
  processOrgnaborQueue,
  processReturns,
  WARTIME_CASUALTY_RATE,
} from './military';
export type { PoliticalState, ReportStrategy } from './PoliticalAgent';
export { PoliticalAgent } from './PoliticalAgent';
// Political entity system + supporting modules (moved from src/game/political/)
export { PoliticalEntitySystem } from './PoliticalEntitySystem';
export {
  applyPolitrukTick,
  calcPolitrukCount,
  createPolitrukEffect,
  KGB_FLAG_CHANCE_FROM_SESSION,
  LOYALTY_THRESHOLD,
  POLITRUK_MORALE_BOOST,
  POLITRUK_ROTATION_INTERVAL,
  rollPolitrukPersonality,
  runIdeologySession,
  SESSION_INTERVAL,
  WORKERS_PER_POLITRUK,
} from './politruks';
export type { QuotaAgentSaveData } from './QuotaAgent';
// QuotaAgent + absorbed systems
export { QuotaAgent } from './QuotaAgent';
export type { QuotaResourceType, QuotaState, ResourceQuota } from './quotaSystem';
export { areAllQuotasMet, createDefaultQuota, quotaSystem } from './quotaSystem';
export {
  checkDirectiveDeadlines,
  generateRaikom,
  offerBlat,
  processVisit,
  tickRaikom,
} from './raikom';
export type {
  ConsequenceConfig,
  ConsequenceLevel,
  DifficultyConfig,
  DifficultyLevel,
  EraScoreBreakdown,
  Medal,
  ScoreBreakdown,
  ScoringSystemSaveData,
} from './ScoringSystem';
export {
  CONSEQUENCE_PRESETS,
  DIFFICULTY_PRESETS,
  eraIdToIndex,
  getEraMultiplier,
  getSettingsMultiplier,
  MEDALS,
  SCORE_MULTIPLIER_MATRIX,
  ScoringSystem,
} from './ScoringSystem';
export type {
  ConscriptionEvent,
  DoctrineMechanicConfig,
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

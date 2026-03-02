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

// Political entity system + supporting modules (moved from src/game/political/)
export { PoliticalEntitySystem } from './PoliticalEntitySystem';
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
export {
  CONSCRIPTION_DEADLINE_TICKS,
  processConscriptionQueue,
  processOrgnaborQueue,
  processReturns,
  WARTIME_CASUALTY_RATE,
} from './military';
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
export {
  checkDirectiveDeadlines,
  generateRaikom,
  offerBlat,
  processVisit,
  tickRaikom,
} from './raikom';

/**
 * @module ai/agents/political
 *
 * Political agents: era management, KGB surveillance, and loyalty tracking.
 */
export { PoliticalAgent } from './PoliticalAgent';
export type { PoliticalState, ReportStrategy } from './PoliticalAgent';
export { KGBAgent } from './KGBAgent';
export type { Difficulty, MarkSource, CommendationSource, FileEntry, ThreatLevel, PersonnelFileSaveData } from './KGBAgent';
export { LoyaltyAgent } from './LoyaltyAgent';
export type { LoyaltyState, LoyaltyResult } from './LoyaltyAgent';

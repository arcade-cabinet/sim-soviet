/**
 * Shared types for SimulationEngine and agent subsystems.
 *
 * Extracted from SimulationEngine.ts to keep the orchestrator thin
 * and allow agents to import these without circular dependencies.
 */

import type { AnnualReportData, ReportSubmission } from '@/components/ui/AnnualReportModal';
import type { EraDefinition } from '../era';
import type { TallyData } from '../GameTally';
import type {
  MandateWithFulfillment,
  PlanMandateState,
} from '../../ai/agents/political/PoliticalAgent';
import type { ActiveMinigame } from '../../ai/agents/meta/minigames/MinigameTypes';
import type { TutorialMilestone } from '../../ai/agents/meta/TutorialSystem';
import type { SettlementEvent } from '../../ai/agents/infrastructure/SettlementSystem';
import type { ConsequenceLevel } from '../../ai/agents/political/ScoringSystem';
import type { EraSystemSaveData } from '../era';
import type { PersonnelFileSaveData } from '../../ai/agents/political/KGBAgent';
import type { SettlementSaveData } from '../../ai/agents/infrastructure/SettlementSystem';
import type { ScoringSystemSaveData } from '../../ai/agents/political/ScoringSystem';
import type { CompulsoryDeliverySaveData } from '../../ai/agents/political/CompulsoryDeliveries';
import type { ChronologyState } from '../../ai/agents/core/ChronologyAgent';
import type { EconomySaveData } from '../../ai/agents/economy/EconomyAgent';
import type { EventSystemSaveData } from '../../ai/agents/narrative/events';
import type { PravdaSaveData } from '../../ai/agents/narrative/pravda';
import type { PolitburoSaveData } from '../../ai/agents/narrative/politburo';
import type { PoliticalEntitySaveData } from '../political';
import type { MinigameRouterSaveData } from '../../ai/agents/meta/minigames/MinigameTypes';
import type { TutorialSaveData } from '../../ai/agents/meta/TutorialSystem';
import type { AchievementTrackerSaveData } from '../../ai/agents/meta/AchievementTracker';
import type { TransportSaveData } from '../../ai/agents/infrastructure/TransportSystem';
import type { FireSystemSaveData } from '../../ai/agents/social/DefenseAgent';

/**
 * Callback interface for SimulationEngine → React communication.
 * Extended with season/weather/dayPhase change notifications.
 */
export interface SimCallbacks {
  onToast: (msg: string, severity?: 'warning' | 'critical' | 'evacuation') => void;
  onAdvisor: (msg: string) => void;
  onPravda: (msg: string) => void;
  onStateChange: () => void;
  onSeasonChanged?: (season: string) => void;
  onWeatherChanged?: (weather: string) => void;
  onDayPhaseChanged?: (phase: string, dayProgress: number) => void;
  onBuildingCollapsed?: (gridX: number, gridY: number, type: string) => void;
  onGameOver?: (victory: boolean, reason: string) => void;
  onSettlementChange?: (event: SettlementEvent) => void;
  onNewPlan?: (plan: {
    quotaType: 'food' | 'vodka';
    quotaTarget: number;
    startYear: number;
    endYear: number;
    mandates?: MandateWithFulfillment[];
  }) => void;
  /** Fired when the game transitions to a new historical era. */
  onEraChanged?: (era: EraDefinition) => void;
  /** Fired at quota deadline years. Player submits report via the closure. */
  onAnnualReport?: (data: AnnualReportData, submitReport: (submission: ReportSubmission) => void) => void;
  /** Fired when a minigame triggers. UI should present choices and call resolveChoice(id). */
  onMinigame?: (active: ActiveMinigame, resolveChoice: (choiceId: string) => void) => void;
  /** Fired when a tutorial milestone triggers (Krupnik guidance). */
  onTutorialMilestone?: (milestone: TutorialMilestone) => void;
  /** Fired when an achievement unlocks. */
  onAchievement?: (name: string, description: string) => void;
  /** Fired on game over with complete tally data for the summary screen. */
  onGameTally?: (tally: TallyData) => void;
  /** Fired when player is rehabilitated (non-permadeath consequence modes). */
  onRehabilitation?: (data: RehabilitationData) => void;
}

/** Data passed to the rehabilitation modal after gulag return. */
export interface RehabilitationData {
  yearsAway: number;
  buildingsLost: number;
  workersLost: number;
  resourcesLost: { money: number; food: number; vodka: number };
  marksReset: number;
  consequenceLevel: ConsequenceLevel;
}

/** Serialized dvor household for save persistence. */
export interface DvorSaveEntry {
  id: string;
  surname: string;
  members: import('@/ecs/world').DvorMember[];
  headOfHousehold: string;
  privatePlotSize: number;
  privateLivestock: { cow: number; pig: number; sheep: number; poultry: number };
  joinedTick: number;
  loyaltyToCollective: number;
  nextMemberId?: number;
}

/** Serialized per-worker stats keyed by dvor member linkage. */
export interface WorkerStatSaveEntry {
  dvorId: string;
  dvorMemberId: string;
  citizenClass: import('@/ecs/world').CitizenComponent['class'];
  stats: import('../../ai/agents/workforce/types').WorkerStats;
}

/**
 * Serialized state for all subsystems managed by SimulationEngine.
 * Stored as a JSON blob in the database for save/load persistence.
 */
export interface SubsystemSaveData {
  era: EraSystemSaveData;
  personnel: PersonnelFileSaveData;
  settlement: SettlementSaveData;
  scoring: ScoringSystemSaveData;
  deliveries: CompulsoryDeliverySaveData;
  quota: { type: string; target: number; current: number; deadlineYear: number };
  consecutiveQuotaFailures: number;
  // ── Extended subsystems (optional for backward compat with old saves) ──
  chronology?: ChronologyState;
  economy?: EconomySaveData;
  events?: EventSystemSaveData;
  pravda?: PravdaSaveData;
  politburo?: PolitburoSaveData;
  politicalEntities?: PoliticalEntitySaveData;
  minigames?: MinigameRouterSaveData;
  tutorial?: TutorialSaveData;
  achievements?: AchievementTrackerSaveData;
  mandates?: PlanMandateState;
  transport?: TransportSaveData;
  fire?: FireSystemSaveData;
  /** Engine-level state */
  engineState?: {
    lastSeason: string;
    lastWeather: string;
    lastDayPhase: string;
    lastThreatLevel: string;
    pendingReport: boolean;
    pendingReportSinceTick?: number;
    ended: boolean;
    pripiskiCount?: number;
  };
  /** Dvor households — canonical population source */
  dvory?: DvorSaveEntry[];
  /** Per-worker stats keyed by dvor linkage */
  workers?: WorkerStatSaveEntry[];
}

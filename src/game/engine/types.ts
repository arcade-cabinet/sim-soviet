/**
 * Shared types for SimulationEngine and agent subsystems.
 *
 * Extracted from SimulationEngine.ts to keep the orchestrator thin
 * and allow agents to import these without circular dependencies.
 */

import type { AnnualReportData, ReportSubmission } from '@/components/ui/AnnualReportModal';
import type { NarrativeEvent } from '../timeline/TimelineLayer';
import type { ChronologyState } from '../../ai/agents/core/ChronologyAgent';
import type { GovernorSaveData } from '../../ai/agents/crisis/Governor';
import type { EconomySaveData } from '../../ai/agents/economy/EconomyAgent';
import type { SettlementEvent, SettlementSaveData } from '../../ai/agents/infrastructure/SettlementSystem';
import type { TransportSaveData } from '../../ai/agents/infrastructure/TransportSystem';
import type { AchievementTrackerSaveData } from '../../ai/agents/meta/AchievementTracker';
import type { ActiveMinigame, MinigameRouterSaveData } from '../../ai/agents/meta/minigames/MinigameTypes';
import type { TutorialMilestone, TutorialSaveData } from '../../ai/agents/meta/TutorialSystem';
import type { EventSystemSaveData } from '../../ai/agents/narrative/events';
import type { PolitburoSaveData } from '../../ai/agents/narrative/politburo';
import type { PravdaSaveData } from '../../ai/agents/narrative/pravda';
import type { CompulsoryDeliverySaveData } from '../../ai/agents/political/CompulsoryDeliveries';
import type { PersonnelFileSaveData } from '../../ai/agents/political/KGBAgent';
import type { MandateWithFulfillment, PlanMandateState } from '../../ai/agents/political/PoliticalAgent';
import type { ConsequenceLevel, ScoringSystemSaveData } from '../../ai/agents/political/ScoringSystem';
import type { PoliticalEntitySaveData } from '../../ai/agents/political/types';
import type { FireSystemSaveData } from '../../ai/agents/social/DefenseAgent';
import type { EraDefinition, EraSystemSaveData } from '../era';
import type { TallyData } from '../GameTally';

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
  /**
   * Fired when a timeline milestone with player choices activates.
   * Presents a full scene + 2-4 choices. Call resolve(choiceId) to apply consequences.
   * If not handled, the milestone auto-resolves after tickLimit ticks.
   */
  onNarrativeEvent?: (event: NarrativeEvent, resolve: (choiceId: string) => void) => void;
  /**
   * Fired once when historical mode reaches the 1991 divergence year.
   * Call resolve(true) to continue in freeform mode, resolve(false) to end the game.
   * If not handled, auto-resolves as continue (freeform) after 60 ticks.
   */
  onHistoricalEraEnd?: (resolve: (continueInFreeform: boolean) => void) => void;
  /** Fired when a crisis impact triggers a one-shot visual effect. */
  onVisualEvent?: (event: VisualEvent) => void;
}

/** A one-shot visual event triggered by a crisis impact. */
export interface VisualEvent {
  /** Effect type. */
  effect: 'nuclear_flash' | 'earthquake_shake' | 'famine_haze' | 'dust_storm';
  /** Effect intensity (0–1). */
  intensity: number;
  /** Duration in ticks. */
  durationTicks: number;
  /** Crisis that triggered this event. */
  crisisId: string;
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

/** Serialized RaionPool for aggregate population mode. */
export interface RaionPoolSaveData {
  totalPopulation: number;
  totalHouseholds: number;
  maleAgeBuckets: number[];
  femaleAgeBuckets: number[];
  classCounts: Record<string, number>;
  birthsThisYear: number;
  deathsThisYear: number;
  totalBirths: number;
  totalDeaths: number;
  pregnancyWaves: number[];
  laborForce: number;
  assignedWorkers: number;
  idleWorkers: number;
  avgMorale: number;
  avgLoyalty: number;
  avgSkill: number;
}

/** Serialized per-building workforce entry for aggregate population mode. */
export interface BuildingWorkforceSaveEntry {
  gridX: number;
  gridY: number;
  defId: string;
  workerCount: number;
  residentCount: number;
  avgMorale: number;
  avgSkill: number;
  avgLoyalty: number;
  avgVodkaDep: number;
  trudodniAccrued: number;
  householdCount: number;
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
    lastInflowYear?: Record<string, number>;
    evacueeInfluxFired?: boolean;
  };
  /** Dvor households — canonical population source (entity mode only) */
  dvory?: DvorSaveEntry[];
  /** Per-worker stats keyed by dvor linkage (entity mode only) */
  workers?: WorkerStatSaveEntry[];
  /** Foraging system persistent state (optional for backward compat with old saves). */
  foraging?: import('../../ai/agents/economy/foragingSystem').ForagingState;
  /** Population mode — 'entity' (default for old saves) or 'aggregate' */
  populationMode?: 'entity' | 'aggregate';
  /** RaionPool snapshot (aggregate mode only) */
  raionPool?: RaionPoolSaveData;
  /** Per-building workforce data (aggregate mode only) */
  buildingWorkforce?: BuildingWorkforceSaveEntry[];
  /** Governor state (optional — null when no governor is active) */
  governor?: GovernorSaveData;
  /** WorldAgent geopolitical state (optional for backward compat with old saves) */
  worldAgent?: import('../../ai/agents/core/WorldAgent').WorldStateSaveData;
  /** RelocationEngine multi-settlement state (optional for backward compat with old saves) */
  relocation?: { settlements: import('../relocation/Settlement').SettlementSaveData[] };
  /** Timeline layer states: space, world, and discovered per-world timelines. */
  timelines?: import('../timeline/TimelineLayer').TimelineLayerSaveData[];
}

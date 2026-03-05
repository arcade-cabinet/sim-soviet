/**
 * Shared context passed to all tick phase functions.
 * Built once per tick by SimulationEngine, consumed by phase modules.
 */

import type { AgentManager } from '../../ai/AgentManager';
import type { ChronologyAgent, TickResult } from '../../ai/agents/core/ChronologyAgent';
import type { WorldAgent } from '../../ai/agents/core/WorldAgent';
import type { TerrainTileState } from '../../ai/agents/core/terrainTick';
import type { WeatherAgent } from '../../ai/agents/core/WeatherAgent';
import type { WeatherProfile } from '../../ai/agents/core/weather-types';
import type { DynamicModifiers, GovernorDirective, GovernorMode, IGovernor } from '../../ai/agents/crisis/Governor';
import type { EconomyAgent } from '../../ai/agents/economy/EconomyAgent';
import type { FoodAgent } from '../../ai/agents/economy/FoodAgent';
import type { ForagingState } from '../../ai/agents/economy/foragingSystem';
import type { StorageAgent } from '../../ai/agents/economy/StorageAgent';
import type { VodkaAgent } from '../../ai/agents/economy/VodkaAgent';
import type { CollectiveAgent } from '../../ai/agents/infrastructure/CollectiveAgent';
import type { PowerAgent } from '../../ai/agents/infrastructure/PowerAgent';
import type { SettlementSystem } from '../../ai/agents/infrastructure/SettlementSystem';
import type { TransportSystem } from '../../ai/agents/infrastructure/TransportSystem';
import type { AchievementTracker } from '../../ai/agents/meta/AchievementTracker';
import type { MinigameRouter } from '../../ai/agents/meta/minigames/MinigameRouter';
import type { TutorialSystem } from '../../ai/agents/meta/TutorialSystem';
import type { EventSystem } from '../../ai/agents/narrative/events';
import type { PolitburoSystem } from '../../ai/agents/narrative/politburo';
import type { MinistryModifiers } from '../../ai/agents/narrative/politburo/types';
import type { PravdaSystem } from '../../ai/agents/narrative/pravda';
import type {
  ConstructionState as PrestigeConstructionState,
  PrestigeProjectDemand,
} from '../../ai/agents/narrative/prestigeLifecycle';
import type { CompulsoryDeliveries } from '../../ai/agents/political/CompulsoryDeliveries';
import type { KGBAgent } from '../../ai/agents/political/KGBAgent';
import type { LoyaltyAgent } from '../../ai/agents/political/LoyaltyAgent';
import type { PlanMandateState, PoliticalAgent, QuotaState } from '../../ai/agents/political/PoliticalAgent';
import type { PoliticalEntitySystem } from '../../ai/agents/political/PoliticalEntitySystem';
import type { DifficultyConfig, DifficultyLevel, ScoringSystem } from '../../ai/agents/political/ScoringSystem';
import type { DefenseAgent, FireSystem } from '../../ai/agents/social/DefenseAgent';
import type { DemographicAgent } from '../../ai/agents/social/DemographicAgent';
import type { WorkerSystem } from '../../ai/agents/workforce/WorkerSystem';
import type { RaionPool, Resources } from '../../ecs/world';
import type { EraModifiers } from '../../game/era/types';
import type { HQSplitState } from '../../growth/HQSplitting';
import type { RegisteredTimeline } from '../timeline/TimelineLayer';
import type { GameGrid } from '../GameGrid';
import type { GameRng } from '../SeedSystem';
import type { SimCallbacks } from './types';

export interface TickContext {
  /** ECS resource store ref */
  storeRef: {
    resources: Resources;
  };
  /** Chronology tick result (computed at start of tick) */
  tickResult: TickResult;
  /** Current population mode */
  popMode: 'entity' | 'aggregate';
  /** RaionPool reference for aggregate mode (undefined in entity mode) */
  raion: RaionPool | undefined;
  /** Difficulty config (from governor modifiers or DIFFICULTY_PRESETS fallback) */
  diffConfig: DynamicModifiers | DifficultyConfig;
  /** Cached governor directive for this tick (null if no governor) */
  cachedDirective: GovernorDirective | null;

  // ── Agent references ──
  agents: {
    chronology: ChronologyAgent;
    weather: WeatherAgent;
    power: PowerAgent;
    food: FoodAgent;
    vodka: VodkaAgent;
    storage: StorageAgent;
    economy: EconomyAgent;
    collective: CollectiveAgent;
    demographic: DemographicAgent;
    kgb: KGBAgent;
    political: PoliticalAgent;
    defense: DefenseAgent;
    loyalty: LoyaltyAgent;
    /** WorldAgent — models geopolitical context. Null for old saves without it. */
    world: WorldAgent | null;
  };

  // ── System references ──
  systems: {
    settlement: SettlementSystem;
    politicalEntities: PoliticalEntitySystem;
    minigameRouter: MinigameRouter;
    scoring: ScoringSystem;
    workerSystem: WorkerSystem;
    tutorial: TutorialSystem;
    achievements: AchievementTracker;
    transport: TransportSystem;
    fireSystem: FireSystem;
    deliveries: CompulsoryDeliveries;
    pravda: PravdaSystem;
    politburo: PolitburoSystem;
    eventSystem: EventSystem;
    agentManager: AgentManager;
  };

  // ── Mutable engine state ──
  state: {
    quota: QuotaState;
    mandateState: PlanMandateState | null;
    foragingState: ForagingState;
    stakhanoviteBoosts: Map<string, number>;
    mtsGrainMultiplier: number;
    difficulty: DifficultyLevel;
    startYear: number;
    lastThreatLevel: string;
    consecutiveQuotaFailures: number;
    pendingReport: boolean;
    pendingReportSinceTick: number;
    pripiskiCount: number;
    ended: boolean;
    evacueeInfluxFired: boolean;
    lastInflowYear: Record<string, number>;
    lastSeason: string;
    lastWeather: string;
    lastDayPhase: string;
    /** Current prestige project demand (null if none announced yet for this era). */
    prestigeDemand: PrestigeProjectDemand | null;
    /** In-progress prestige project construction (null if not started). */
    prestigeConstruction: PrestigeConstructionState | null;
    /** Game mode: 'historical' or 'freeform' — derived from governor type. */
    gameMode: GovernorMode;
    /** Per-tile terrain simulation state (fertility, contamination, etc.). */
    terrainTiles: TerrainTileState[];
    /** HQ splitting milestone tracker. */
    hqSplitState: HQSplitState;
    /** All active timeline layers (space, world, per-world). Mutated in-place each tick. */
    registeredTimelines: RegisteredTimeline[];
  };

  // ── Per-tick computed modifiers (set by engine before phase calls) ──
  modifiers: {
    /** Combined farm production modifier (season × weather × politburo × era × heating × MTS) */
    farmMod: number;
    /** Combined vodka production modifier (politburo × era × heating) */
    vodkaMod: number;
    /** Era modifiers from PoliticalAgent */
    eraMods: EraModifiers;
    /** Politburo modifiers */
    politburoMods: Readonly<MinistryModifiers>;
    /** Weather profile */
    weatherProfile: WeatherProfile;
  };

  rng: GameRng;
  grid: GameGrid;
  governor: IGovernor | null;
  callbacks: SimCallbacks;

  /** Delegate to SimulationEngine.endGame() — handles tally, meta, and gameOver callback. */
  endGame: (victory: boolean, reason: string) => void;
}

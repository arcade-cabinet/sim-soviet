/**
 * SimulationEngine — thin orchestrator over ECS systems + Yuka agents.
 *
 * All game logic lives in agents. This file:
 *   - Instantiates agents + legacy systems
 *   - Calls them in order each tick()
 *   - Bridges results to UI via SimCallbacks
 *
 * Re-exports canonical types from engine/types for backward compat.
 */

// ── Re-exports (backward compat — callers import from here) ─────────────────
export type {
  SimCallbacks,
  RehabilitationData,
  DvorSaveEntry,
  WorkerStatSaveEntry,
  SubsystemSaveData,
} from './engine/types';
import type { SimCallbacks, SubsystemSaveData } from './engine/types';

import type { AnnualReportData, ReportSubmission } from '@/components/ui/AnnualReportModal';
import { getBuildingDef } from '@/data/buildingDefs';
import {
  buildingsLogic,
  decayableBuildings,
  dvory,
  getMetaEntity,
  getResourceEntity,
  operationalBuildings,
  underConstruction,
} from '@/ecs/archetypes';
import {
  constructionSystem,
  decaySystem,
  populationSystem,
  setBuildingCollapsedCallback,
  setStarvationCallback,
} from '@/ecs/systems';
import type { QuotaState } from '../ai/agents/political/PoliticalAgent';
import { createDefaultQuota, quotaSystem } from '../ai/agents/political/PoliticalAgent';
import { world } from '@/ecs/world';
import type { AchievementTrackerSaveData } from '../ai/agents/meta/AchievementTracker';
import { AchievementTracker } from '../ai/agents/meta/AchievementTracker';
import { TICKS_PER_YEAR } from './Chronology';
import type { ChronologyState, TickResult } from '../ai/agents/core/ChronologyAgent';
import { ChronologySystem } from '../ai/agents/core/ChronologyAgent';
import type { CompulsoryDeliverySaveData } from '../ai/agents/political/CompulsoryDeliveries';
import { CompulsoryDeliveries } from '../ai/agents/political/CompulsoryDeliveries';
import { initDiseaseSystem } from '../ai/agents/social/DefenseAgent';
import { type EraId as EconomyEraId, type EconomySaveData, EconomySystem } from '../ai/agents/economy/EconomyAgent';
import { DIFFICULTY_MULTIPLIERS } from '../ai/agents/economy/economy-core';
import {
  tickAchievements as tickAchievementsHelper,
  tickTutorial as tickTutorialHelper,
} from '../ai/agents/meta/achievementTick';
import {
  type AnnualReportEngineState,
  checkQuota as checkQuotaHelper,
  handleQuotaMet as handleQuotaMetHelper,
  handleQuotaMissed as handleQuotaMissedHelper,
} from '../ai/agents/political/annualReportTick';
import { tickDirectives as tickDirectivesHelper } from '../ai/agents/meta/directiveTick';
import {
  checkBuildingTapMinigame as checkBuildingTapMinigameHelper,
  checkEventMinigame as checkEventMinigameHelper,
  isMinigameAvailable as isMinigameAvailableHelper,
  resolveMinigameChoice as resolveMinigameChoiceHelper,
  tickMinigames as tickMinigamesHelper,
} from '../ai/agents/meta/minigameTick';
import {
  restoreSubsystems as restoreSubsystemsHelper,
  serializeSubsystems as serializeSubsystemsHelper,
} from './engine/serializeEngine';
import type { EraDefinition, EraSystemSaveData } from './era';
import { ERA_DEFINITIONS, EraSystem } from './era';
import type { EventSystemSaveData, GameEvent } from '../ai/agents/narrative/events';
import { EventSystem } from '../ai/agents/narrative/events';
import type { FireSystemSaveData } from '../ai/agents/social/DefenseAgent';
import { FireSystem } from '../ai/agents/social/DefenseAgent';
import type { GameGrid } from './GameGrid';
import { createGameTally, type TallyData } from './GameTally';
import { MinigameRouter } from '../ai/agents/meta/minigames/MinigameRouter';
import type { ActiveMinigame, MinigameRouterSaveData } from '../ai/agents/meta/minigames/MinigameTypes';
import type { PersonnelFileSaveData } from '../ai/agents/political/KGBAgent';
import { PersonnelFile } from '../ai/agents/political/KGBAgent';
import type { MandateWithFulfillment, PlanMandateState } from '../ai/agents/political/PoliticalAgent';
import { createMandatesForEra, createPlanMandateState, recordBuildingPlaced } from '../ai/agents/political/PoliticalAgent';
import type { PolitburoSaveData } from '../ai/agents/narrative/politburo';
import { PolitburoSystem } from '../ai/agents/narrative/politburo';
import type { PoliticalEntitySaveData } from '../ai/agents/political/types';
import { addPaperwork, getPaperwork } from '../ai/agents/political/doctrine';
import { PoliticalEntitySystem } from '../ai/agents/political/PoliticalEntitySystem';
import type { PravdaSaveData } from '../ai/agents/narrative/pravda';
import { PravdaSystem } from '../ai/agents/narrative/pravda';
import type { ConsequenceConfig, ConsequenceLevel, DifficultyLevel, ScoringSystemSaveData } from '../ai/agents/political/ScoringSystem';
import { CONSEQUENCE_PRESETS, DIFFICULTY_PRESETS, eraIdToIndex, ScoringSystem } from '../ai/agents/political/ScoringSystem';
import { political } from '@/config';
import type { InflowScheduleEntry } from '@/config';
import { GameRng } from './SeedSystem';
import type { SettlementEvent, SettlementMetrics, SettlementSaveData } from '../ai/agents/infrastructure/SettlementSystem';
import { SettlementSystem } from '../ai/agents/infrastructure/SettlementSystem';
import { type TransportSaveData, TransportSystem } from '../ai/agents/infrastructure/TransportSystem';
import { accrueTrudodni } from '../ai/agents/economy/EconomyAgent';
import type { TutorialMilestone, TutorialSaveData } from '../ai/agents/meta/TutorialSystem';
import { TutorialSystem } from '../ai/agents/meta/TutorialSystem';
import { getWeatherProfile, type WeatherType } from '../ai/agents/core/weather-types';
import { WorkerSystem } from '../ai/agents/workforce/WorkerSystem';
import { AgentManager } from '../ai/AgentManager';
import { getPopulationMode, collapseEntitiesToBuildings } from '../ai/agents/workforce/collectiveTransition';
import { computeBuildingProduction } from '../ai/agents/economy/buildingProduction';
import { computeDistribution, computeRoleBuckets } from '@/ecs/systems/distributionWeights';
// ── Yuka agents ──
import { ChronologyAgent } from '../ai/agents/core/ChronologyAgent';
import { WeatherAgent } from '../ai/agents/core/WeatherAgent';
import { PowerAgent } from '../ai/agents/infrastructure/PowerAgent';
import { FoodAgent } from '../ai/agents/economy/FoodAgent';
import { VodkaAgent } from '../ai/agents/economy/VodkaAgent';
import { StorageAgent } from '../ai/agents/economy/StorageAgent';
import { EconomyAgent } from '../ai/agents/economy/EconomyAgent';
import { CollectiveAgent } from '../ai/agents/infrastructure/CollectiveAgent';
import { DemographicAgent } from '../ai/agents/social/DemographicAgent';
import { KGBAgent } from '../ai/agents/political/KGBAgent';
import { PoliticalAgent } from '../ai/agents/political/PoliticalAgent';
import { DefenseAgent } from '../ai/agents/social/DefenseAgent';
import { LoyaltyAgent } from '../ai/agents/political/LoyaltyAgent';
import { createForagingState, foragingTick, type ForagingState } from '../ai/agents/economy/foragingSystem';

/** Maps game EraSystem IDs → EconomySystem EraIds. */
const GAME_ERA_TO_ECONOMY_ERA: Record<string, EconomyEraId> = {
  revolution: 'revolution',
  collectivization: 'industrialization',
  industrialization: 'industrialization',
  great_patriotic: 'wartime',
  reconstruction: 'reconstruction',
  thaw_and_freeze: 'thaw',
  stagnation: 'stagnation',
  the_eternal: 'eternal',
};

/** Event IDs that should ignite a building when triggered. */
const FIRE_EVENT_IDS = new Set(['cultural_palace_fire', 'power_station_explosion']);

/**
 * Central ECS tick orchestrator: advances all game subsystems each tick
 * and bridges results to UI via callback hooks.
 */
export class SimulationEngine {
  // ── Legacy systems (kept for serialization) ──
  private chronology: ChronologySystem;
  private eraSystem: EraSystem;
  private economySystem: EconomySystem;
  private eventSystem: EventSystem;
  private pravdaSystem: PravdaSystem;
  private politburo: PolitburoSystem;
  private personnelFile: PersonnelFile;
  private deliveries: CompulsoryDeliveries;
  private settlement: SettlementSystem;
  private politicalEntities: PoliticalEntitySystem;
  private minigameRouter: MinigameRouter;
  private scoring: ScoringSystem;
  private workerSystem: WorkerSystem;
  private tutorial: TutorialSystem;
  private achievements: AchievementTracker;
  private mandateState: PlanMandateState | null = null;
  private transport: TransportSystem;
  private fireSystem: FireSystem;

  // ── Yuka agents ──
  private chronologyAgent!: ChronologyAgent;
  private weatherAgent!: WeatherAgent;
  private powerAgent!: PowerAgent;
  private foodAgent!: FoodAgent;
  private vodkaAgent!: VodkaAgent;
  private storageAgent!: StorageAgent;
  private economyAgent!: EconomyAgent;
  private collectiveAgent!: CollectiveAgent;
  private demographicAgent!: DemographicAgent;
  private kgbAgent!: KGBAgent;
  private politicalAgent!: PoliticalAgent;
  private defenseAgent!: DefenseAgent;
  private loyaltyAgent!: LoyaltyAgent;

  // ── Engine state ──
  private difficulty: DifficultyLevel;
  private quota: QuotaState;
  private rng: GameRng;
  private lastSeason = '';
  private lastWeather = '';
  private lastDayPhase = '';
  private lastThreatLevel = '';
  private startYear: number;
  private consecutiveQuotaFailures = 0;
  private mtsGrainMultiplier = 1.0;
  private stakhanoviteBoosts: Map<string, number> = new Map();
  private pendingReport = false;
  private pendingReportSinceTick = 0;
  private ended = false;
  private pripiskiCount = 0;
  private eventHandler!: (event: GameEvent) => void;
  private politburoEventHandler!: (event: GameEvent) => void;
  private agentManager: AgentManager;
  private _originalOnMinigame?: SimCallbacks['onMinigame'];
  private _originalOnAnnualReport?: SimCallbacks['onAnnualReport'];
  /** Cached RaionPool reference — non-null when in aggregate population mode. */
  private raion: import('@/ecs/world').RaionPool | undefined;
  /** Tracks last year a scheduled inflow fired, keyed by era ID. */
  private lastInflowYear: Record<string, number> = {};
  /** Whether the Great Patriotic evacuee influx has already fired. */
  private evacueeInfluxFired = false;
  /** Persistent state for the survival foraging system. */
  private foragingState: ForagingState = createForagingState();

  constructor(
    private grid: GameGrid,
    private callbacks: SimCallbacks,
    rng?: GameRng,
    difficulty?: DifficultyLevel,
    consequence?: ConsequenceLevel,
  ) {
    this.rng = rng ?? new GameRng();
    this.difficulty = difficulty ?? 'comrade';
    this.quota = createDefaultQuota();
    this.quota.target = Math.round(this.quota.target * DIFFICULTY_PRESETS[this.difficulty].quotaMultiplier);
    const meta = getMetaEntity();
    const startYear = meta?.gameMeta.date.year ?? 1917;
    this.startYear = startYear;

    this.chronology = new ChronologySystem(this.rng, startYear);
    this.eraSystem = new EraSystem(startYear);

    const economyEra = GAME_ERA_TO_ECONOMY_ERA[this.eraSystem.getCurrentEraId()] ?? 'revolution';
    this.economySystem = new EconomySystem(economyEra, difficulty ?? 'comrade');
    this.economySystem.setRng(this.rng);
    this.economySystem.markReformsBeforeYear(startYear);

    this.pravdaSystem = new PravdaSystem(this.rng);

    this.eventHandler = (event: GameEvent) => {
      const headline = this.pravdaSystem.headlineFromEvent(event);
      this.callbacks.onPravda(headline.headline);
      if (event.severity === 'catastrophic') {
        this.callbacks.onToast(event.title, 'evacuation');
      } else if (event.severity === 'major') {
        this.callbacks.onToast(event.title, 'critical');
      } else {
        this.callbacks.onToast(event.title, 'warning');
      }
      if (FIRE_EVENT_IDS.has(event.id)) {
        this.defenseAgent.igniteRandom();
      }
      this.checkEventMinigame(event.id);
    };

    this.eventSystem = new EventSystem(this.eventHandler, this.rng);

    this.politburoEventHandler = (event: GameEvent) => {
      this.applyEventEffects(event);
      this.eventHandler(event);
    };
    this.politburo = new PolitburoSystem(this.politburoEventHandler, this.rng, startYear);

    this.personnelFile = new PersonnelFile(this.difficulty);
    this.eventSystem.setPersonnelFile(this.personnelFile);

    const deliveryRateMult = DIFFICULTY_MULTIPLIERS[this.difficulty]?.deliveryRate ?? 1.0;
    this.deliveries = new CompulsoryDeliveries(this.eraSystem.getDoctrine(), deliveryRateMult);
    this.deliveries.setRng(this.rng);

    this.settlement = new SettlementSystem(meta?.gameMeta.settlementTier ?? 'selo');
    this.politicalEntities = new PoliticalEntitySystem(this.rng);
    this.minigameRouter = new MinigameRouter(this.rng);

    this.workerSystem = new WorkerSystem(this.rng);
    const initialStore = getResourceEntity();
    const dvorCount = [...dvory].length;
    if (dvorCount > 0) {
      const count = this.workerSystem.syncPopulationFromDvory();
      if (initialStore) initialStore.resources.population = count;
    } else if (initialStore) {
      initialStore.resources.population = 0;
    }

    this.scoring = new ScoringSystem(difficulty ?? 'comrade', consequence ?? 'permadeath');
    this.tutorial = new TutorialSystem();
    this.achievements = new AchievementTracker();

    this.transport = new TransportSystem(this.eraSystem.getCurrentEraId());
    this.transport.setRng(this.rng);

    this.fireSystem = new FireSystem(this.rng, {
      onBuildingCollapsed: (gridX, gridY, defId) => {
        this.callbacks.onToast(`FIRE DESTROYED: ${defId} at (${gridX}, ${gridY})`, 'critical');
        this.callbacks.onBuildingCollapsed?.(gridX, gridY, defId);
      },
      onFireStarted: (gridX, gridY) => {
        this.callbacks.onToast(`FIRE AT (${gridX}, ${gridY})`, 'warning');
      },
    });

    initDiseaseSystem(this.rng);

    // Check if we're restoring into aggregate mode (save/load)
    this.raion = initialStore?.resources.raion;

    const initialEraId = this.eraSystem.getCurrentEraId();
    const initialMandates = createMandatesForEra(initialEraId, this.difficulty);
    this.mandateState = createPlanMandateState(initialMandates);

    this.agentManager = new AgentManager();

    // ── Instantiate and register Yuka agents ──
    this.chronologyAgent = new ChronologyAgent(this.rng, startYear);
    this.agentManager.registerChronology(this.chronologyAgent);

    this.weatherAgent = new WeatherAgent();
    this.agentManager.registerWeather(this.weatherAgent);

    this.powerAgent = new PowerAgent();
    this.agentManager.registerPower(this.powerAgent);

    this.foodAgent = new FoodAgent();
    this.agentManager.registerFood(this.foodAgent);

    this.vodkaAgent = new VodkaAgent();
    this.agentManager.registerVodka(this.vodkaAgent);

    this.storageAgent = new StorageAgent();
    this.agentManager.registerStorage(this.storageAgent);

    this.economyAgent = new EconomyAgent(economyEra, difficulty ?? 'comrade');
    this.economyAgent.setRng(this.rng);
    this.economyAgent.markReformsBeforeYear(startYear);
    this.agentManager.registerEconomy(this.economyAgent);

    this.collectiveAgent = new CollectiveAgent();
    this.collectiveAgent.setRng(this.rng);
    this.agentManager.registerCollective(this.collectiveAgent);

    this.demographicAgent = new DemographicAgent();
    this.demographicAgent.setRng(this.rng);
    this.agentManager.registerDemographic(this.demographicAgent);

    this.kgbAgent = new KGBAgent(this.difficulty);
    this.kgbAgent.setRng(this.rng);
    this.agentManager.registerKGB(this.kgbAgent);

    this.politicalAgent = new PoliticalAgent(startYear);
    this.politicalAgent.setRng(this.rng);
    this.politicalAgent.generateMandatesForCurrentEra(this.difficulty);
    this.agentManager.registerPolitical(this.politicalAgent);

    this.defenseAgent = new DefenseAgent(this.rng, {
      onBuildingCollapsed: (gridX, gridY, defId) => {
        this.callbacks.onToast(`FIRE DESTROYED: ${defId} at (${gridX}, ${gridY})`, 'critical');
        this.callbacks.onBuildingCollapsed?.(gridX, gridY, defId);
      },
      onFireStarted: (gridX, gridY) => {
        this.callbacks.onToast(`FIRE AT (${gridX}, ${gridY})`, 'warning');
      },
    });
    this.agentManager.registerDefense(this.defenseAgent);

    this.loyaltyAgent = new LoyaltyAgent();
    this.loyaltyAgent.setRng(this.rng);
    this.agentManager.registerLoyalty(this.loyaltyAgent);

    // Wire ECS callbacks
    setStarvationCallback(() => {
      this.callbacks.onToast('STARVATION DETECTED', 'critical');
    });

    setBuildingCollapsedCallback((gridX, gridY, type, footprintX, footprintY) => {
      this.callbacks.onToast(`Building collapsed at (${gridX}, ${gridY}): ${type}`, 'critical');
      for (let dx = 0; dx < footprintX; dx++) {
        for (let dy = 0; dy < footprintY; dy++) {
          this.grid.setCell(gridX + dx, gridY + dy, null);
        }
      }
      this.callbacks.onBuildingCollapsed?.(gridX, gridY, type);
    });
  }

  // ── System getters ──────────────────────────────────────────────────────────

  public getEventSystem(): EventSystem { return this.eventSystem; }
  public getPravdaSystem(): PravdaSystem { return this.pravdaSystem; }
  public getPolitburo(): PolitburoSystem { return this.politburo; }
  public getChronology(): ChronologySystem { return this.chronologyAgent; }
  public getPersonnelFile(): PersonnelFile { return this.kgbAgent; }
  public getDeliveries(): CompulsoryDeliveries { return this.deliveries; }
  public getSettlement(): SettlementSystem { return this.settlement; }
  public getEraSystem(): EraSystem { return this.politicalAgent; }
  public getEconomySystem(): EconomySystem { return this.economyAgent; }
  public getPoliticalEntities(): PoliticalEntitySystem { return this.politicalEntities; }
  public getWorkerSystem(): WorkerSystem { return this.workerSystem; }
  public getAgentManager(): AgentManager { return this.agentManager; }
  public getMinigameRouter(): MinigameRouter { return this.minigameRouter; }
  public getScoring(): ScoringSystem { return this.scoring; }
  public getTutorial(): TutorialSystem { return this.tutorial; }
  public getFireSystem(): FireSystem { return this.defenseAgent; }
  public getAchievements(): AchievementTracker { return this.achievements; }
  public getQuota(): Readonly<QuotaState> { return this.quota; }
  public getRaion(): import('@/ecs/world').RaionPool | undefined { return this.raion; }

  // ── Agent getters ───────────────────────────────────────────────────────────

  public getChronologyAgent(): ChronologyAgent { return this.chronologyAgent; }
  public getWeatherAgent(): WeatherAgent { return this.weatherAgent; }
  public getPowerAgent(): PowerAgent { return this.powerAgent; }
  public getFoodAgent(): FoodAgent { return this.foodAgent; }
  public getVodkaAgent(): VodkaAgent { return this.vodkaAgent; }
  public getStorageAgent(): StorageAgent { return this.storageAgent; }
  public getEconomyAgent(): EconomyAgent { return this.economyAgent; }
  public getCollectiveAgent(): CollectiveAgent { return this.collectiveAgent; }
  public getDemographicAgent(): DemographicAgent { return this.demographicAgent; }
  public getKGBAgent(): KGBAgent { return this.kgbAgent; }
  public getPoliticalAgent(): PoliticalAgent { return this.politicalAgent; }
  public getDefenseAgent(): DefenseAgent { return this.defenseAgent; }
  public getLoyaltyAgent(): LoyaltyAgent { return this.loyaltyAgent; }

  // ── Autopilot ───────────────────────────────────────────────────────────────

  public enableAutopilot(): void {
    this.agentManager.enableAutopilot();
    if (!this._originalOnMinigame) this._originalOnMinigame = this.callbacks.onMinigame;
    if (!this._originalOnAnnualReport) this._originalOnAnnualReport = this.callbacks.onAnnualReport;

    this.callbacks.onMinigame = (active, resolveChoice) => {
      const chairman = this.agentManager.getChairman();
      if (chairman) {
        const aiChoices = active.definition.choices.map((c) => ({
          id: c.id, successChance: c.successChance, onSuccess: c.onSuccess, onFailure: c.onFailure,
        }));
        resolveChoice(chairman.resolveMinigame(aiChoices));
      } else {
        resolveChoice(active.definition.choices[0]?.id ?? '');
      }
    };

    this.callbacks.onAnnualReport = (data, submitReport) => {
      const chairman = this.agentManager.getChairman();
      const quotaPercent = data.quotaTarget > 0 ? data.quotaCurrent / data.quotaTarget : 1;
      const isHonest = chairman ? chairman.resolveAnnualReport(quotaPercent) : true;

      if (isHonest) {
        // Submit actual values
        submitReport({
          reportedQuota: data.quotaCurrent,
          reportedSecondary: data.quotaType === 'food' ? data.actualVodka : data.actualFood,
          reportedPop: data.actualPop,
        });
      } else {
        // Falsify: inflate quota to target, secondary by same ratio, keep pop honest
        const inflationRatio = data.quotaCurrent > 0 ? data.quotaTarget / data.quotaCurrent : 1;
        const actualSecondary = data.quotaType === 'food' ? data.actualVodka : data.actualFood;
        submitReport({
          reportedQuota: data.quotaTarget,
          reportedSecondary: Math.round(actualSecondary * inflationRatio),
          reportedPop: data.actualPop,
        });
      }
    };
  }

  public disableAutopilot(): void {
    this.agentManager.disableAutopilot();
    if (this._originalOnMinigame !== undefined) {
      this.callbacks.onMinigame = this._originalOnMinigame;
      this._originalOnMinigame = undefined;
    }
    if (this._originalOnAnnualReport !== undefined) {
      this.callbacks.onAnnualReport = this._originalOnAnnualReport;
      this._originalOnAnnualReport = undefined;
    }
  }

  // ── Mandates ────────────────────────────────────────────────────────────────

  public recordBuildingForMandates(defId: string): void {
    if (this.mandateState) this.mandateState = recordBuildingPlaced(this.mandateState, defId);
  }

  public getMandateState(): PlanMandateState | null { return this.mandateState; }

  // ── Serialization ───────────────────────────────────────────────────────────

  public serializeSubsystems(): SubsystemSaveData {
    return serializeSubsystemsHelper(this.getSerializableEngine());
  }

  public restoreSubsystems(data: SubsystemSaveData): void {
    const se = this.getSerializableEngine();
    restoreSubsystemsHelper(se, data);
    // Write back any replaced system instances
    this.chronology = se.chronology;
    this.eraSystem = se.eraSystem;
    this.economySystem = se.economySystem;
    this.eventSystem = se.eventSystem;
    this.pravdaSystem = se.pravdaSystem;
    this.politburo = se.politburo;
    this.personnelFile = se.personnelFile;
    this.deliveries = se.deliveries;
    this.settlement = se.settlement;
    this.politicalEntities = se.politicalEntities;
    this.minigameRouter = se.minigameRouter;
    this.scoring = se.scoring;
    this.tutorial = se.tutorial;
    this.achievements = se.achievements;
    this.mandateState = se.mandateState;
    this.transport = se.transport;
    this.fireSystem = se.fireSystem;
    this.consecutiveQuotaFailures = se.consecutiveQuotaFailures;
    this.pripiskiCount = se.pripiskiCount;
    this.lastSeason = se.lastSeason;
    this.lastWeather = se.lastWeather;
    this.lastDayPhase = se.lastDayPhase;
    this.lastThreatLevel = se.lastThreatLevel;
    this.pendingReport = se.pendingReport;
    this.pendingReportSinceTick = se.pendingReportSinceTick;
    this.ended = se.ended;
    this.lastInflowYear = se.lastInflowYear;
    this.evacueeInfluxFired = se.evacueeInfluxFired;
    this.foragingState = se.foragingState;

    this.eventSystem.setPersonnelFile(this.personnelFile);

    if (data.chronology) {
      this.chronologyAgent = ChronologyAgent.deserialize(data.chronology, this.rng);
      this.agentManager.registerChronology(this.chronologyAgent);
    }

    if (data.personnel) this.kgbAgent.loadPersonnelFile(data.personnel);

    if (data.economy) {
      this.economyAgent = EconomyAgent.deserialize(data.economy);
      this.economyAgent.setRng(this.rng);
      this.agentManager.registerEconomy(this.economyAgent);
    }

    this.politicalAgent.checkEraTransition(this.eraSystem.getYear());

    // Restore raion reference from resource store (aggregate mode save/load)
    const restoredStore = getResourceEntity();
    this.raion = restoredStore?.resources.raion;
  }

  // ── Minigame API ────────────────────────────────────────────────────────────

  public resolveMinigameChoice(choiceId: string): void {
    resolveMinigameChoiceHelper(this.getMinigameContext(), choiceId);
  }

  public checkBuildingTapMinigame(buildingDefId: string): void {
    checkBuildingTapMinigameHelper(this.getMinigameContext(), buildingDefId);
  }

  public isMinigameAvailable(buildingDefId: string): boolean {
    return isMinigameAvailableHelper(this.getMinigameContext(), buildingDefId);
  }

  public checkEventMinigame(eventId: string): void {
    checkEventMinigameHelper(this.getMinigameContext(), eventId);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  TICK — main simulation loop
  // ══════════════════════════════════════════════════════════════════════════

  public tick(): void {
    if (this.ended) return;
    const storeRef = getResourceEntity();
    if (!storeRef) return;

    // ── 1. Chronology ──
    const tickResult = this.chronologyAgent.tick();
    this.syncChronologyToMeta(tickResult);
    this.emitChronologyChanges(tickResult);

    // ── 1b. Population mode detection ──
    const popMode = getPopulationMode(
      storeRef.resources.population,
      this.raion,
    );

    // ── 2. Year boundary: era transition + quota check ──
    if (tickResult.newYear) {
      // Check for entity → aggregate collapse on year boundary
      if (popMode === 'aggregate' && !this.raion) {
        this.raion = collapseEntitiesToBuildings();
        storeRef.resources.raion = this.raion;
        storeRef.resources.population = this.raion.totalPopulation;
        this.callbacks.onToast(
          'The collective has grown. Individual records are now maintained by the raion.',
          'warning',
        );
      }

      this.politicalAgent.handleEraTransitionFull({
        year: this.chronologyAgent.getDate().year,
        deliveries: this.deliveries,
        economy: this.economyAgent,
        transport: this.transport,
        workers: this.workerSystem,
        kgb: this.kgbAgent,
        scoring: this.scoring,
        callbacks: this.callbacks,
        difficulty: this.difficulty,
        chronology: this.chronologyAgent,
      });

      const reportCtx = this.getAnnualReportContext();
      checkQuotaHelper(reportCtx);
      if (reportCtx.engineState.pendingReport && !this.pendingReport) {
        this.pendingReportSinceTick = this.chronologyAgent.getDate().totalTicks;
      }
      this.syncAnnualReportState(reportCtx.engineState);
    }

    // Auto-resolve pending report after 90 ticks
    if (this.pendingReport) {
      const elapsed = this.chronologyAgent.getDate().totalTicks - this.pendingReportSinceTick;
      if (elapsed >= 90) {
        this.pendingReport = false;
        const reportCtx = this.getAnnualReportContext();
        if (reportCtx.engineState.quota.current >= reportCtx.engineState.quota.target) {
          handleQuotaMetHelper(reportCtx);
        } else {
          handleQuotaMissedHelper(reportCtx);
        }
        this.syncAnnualReportState(reportCtx.engineState);
      }
    }

    this.politicalAgent.tickTransition();

    // ── 3. Production modifiers ──
    const weatherProfile = getWeatherProfile(tickResult.weather as WeatherType);
    const politburoMods = this.politburo.getModifiers();
    const eraMods = this.politicalAgent.getModifiers();
    const heatingPenalty = this.economyAgent.getHeating().failing ? 0.5 : 1.0;
    const seasonFarmMult = tickResult.season.farmMultiplier;
    const farmMod =
      seasonFarmMult * weatherProfile.farmModifier * politburoMods.foodProductionMult *
      eraMods.productionMult * heatingPenalty * this.mtsGrainMultiplier;
    const vodkaMod = politburoMods.vodkaProductionMult * eraMods.productionMult * heatingPenalty;
    const diffConfig = DIFFICULTY_PRESETS[this.difficulty];

    // ── 4. Power ──
    this.powerAgent.distributePower();

    // ── 5. Transport ──
    const transportResult = this.transport.tick(
      operationalBuildings.entities,
      this.settlement.getCurrentTier(),
      this.chronologyAgent.getDate().totalTicks,
      tickResult.season,
      storeRef.resources,
    );

    // ── 6. Construction ──
    constructionSystem(
      this.politicalAgent.getCurrentEra().constructionTimeMult,
      weatherProfile.constructionTimeMult,
      transportResult.seasonBuildMult,
    );

    // ── 7. Production ──
    const foodBefore = storeRef.resources.food;
    const vodkaBefore = storeRef.resources.vodka;
    const moneyBefore = storeRef.resources.money;

    if (this.raion) {
      // Aggregate mode: compute production per operational building
      for (const entity of operationalBuildings.entities) {
        const bldg = entity.building;
        const def = getBuildingDef(bldg.defId);
        if (!def) continue;

        const prodResult = computeBuildingProduction(bldg, def, {
          eraId: this.politicalAgent.getCurrentEraId(),
          powered: bldg.powered,
          durability: entity.durability?.current ?? 100,
          season: tickResult.season.season,
          rng: this.rng,
          eraProductionMod: eraMods.productionMult,
          weatherMod: farmMod,
        });

        if (prodResult.resource === 'food') {
          storeRef.resources.food += prodResult.amount;
        } else if (prodResult.resource === 'vodka') {
          storeRef.resources.vodka += prodResult.amount;
        }
        storeRef.resources.power += prodResult.powerGenerated;
        bldg.trudodniAccrued += prodResult.trudodniAccrued;

        // Stochastic events
        if (prodResult.accidents > 0) {
          this.workerSystem.removeWorkersByCount(prodResult.accidents, 'workplace_accident');
        }
      }

      // Production chains still run in aggregate mode
      {
        const chainBuildingIds: string[] = [];
        for (const entity of buildingsLogic) chainBuildingIds.push(entity.building.defId);
        this.economyAgent.tickProductionChains(chainBuildingIds, storeRef.resources);
      }
    } else {
      // Entity mode: existing production path
      const avgSkill = this.workerSystem.getAverageSkill();
      const avgCondition = this.getAverageBuildingCondition();

      this.foodAgent.produce({
        farmModifier: farmMod,
        vodkaModifier: vodkaMod,
        eraId: this.politicalAgent.getCurrentEraId(),
        skillFactor: avgSkill,
        conditionFactor: avgCondition,
        stakhanoviteBoosts: this.stakhanoviteBoosts,
        includePrivatePlots: tickResult.newMonth,
      });

      // Production chains
      {
        const chainBuildingIds: string[] = [];
        for (const entity of buildingsLogic) chainBuildingIds.push(entity.building.defId);
        this.economyAgent.tickProductionChains(chainBuildingIds, storeRef.resources);
      }
    }

    // ── 8. Storage ──
    this.storageAgent.update(this.chronologyAgent.getDate().month);

    // ── 9. Economy system (fondy, trudodni, blat, stakhanovite, MTS, heating, reforms) ──
    const econResult = this.economyAgent.applyTickResults({
      chronology: this.chronologyAgent,
      workers: this.workerSystem,
      kgb: this.kgbAgent,
      callbacks: this.callbacks as Parameters<typeof this.economyAgent.applyTickResults>[0]['callbacks'],
      quota: this.quota,
      settlement: this.settlement,
      stakhanoviteBoosts: this.stakhanoviteBoosts,
    });
    this.mtsGrainMultiplier = econResult.mtsGrainMultiplier;

    // ── 10. Compulsory deliveries ──
    {
      const newFood = Math.max(0, storeRef.resources.food - foodBefore);
      const newVodka = Math.max(0, storeRef.resources.vodka - vodkaBefore);
      const newMoney = Math.max(0, storeRef.resources.money - moneyBefore);
      if (newFood > 0 || newVodka > 0 || newMoney > 0) {
        const result = this.deliveries.applyDeliveries(newFood, newVodka, newMoney);
        storeRef.resources.food = Math.max(0, storeRef.resources.food - result.foodTaken);
        storeRef.resources.vodka = Math.max(0, storeRef.resources.vodka - result.vodkaTaken);
        storeRef.resources.money = Math.max(0, storeRef.resources.money - result.moneyTaken);
      }
    }

    // ── 11. Food consumption + starvation ──
    const totalConsumptionMult = eraMods.consumptionMult * diffConfig.consumptionMultiplier;
    if (this.raion) {
      // Aggregate mode: consumption scales with raion population
      const pop = this.raion.totalPopulation;
      // Each citizen consumes ~0.5 food per tick (same as entity mode FoodAgent)
      const foodConsumed = pop * 0.5 * totalConsumptionMult;
      const vodkaConsumed = pop * 0.1 * totalConsumptionMult;
      storeRef.resources.food = Math.max(0, storeRef.resources.food - foodConsumed);
      storeRef.resources.vodka = Math.max(0, storeRef.resources.vodka - vodkaConsumed);

      // Starvation check: delegate to FoodAgent for consistency
      const foodResult = this.foodAgent.consume(totalConsumptionMult);
      if (foodResult.starvationDeaths > 0) {
        this.callbacks.onToast('STARVATION DETECTED', 'critical');
        this.workerSystem.removeWorkersByCount(foodResult.starvationDeaths, 'starvation');
      }
    } else {
      // Entity mode: existing consumption path
      const foodResult = this.foodAgent.consume(totalConsumptionMult);
      if (foodResult.starvationDeaths > 0) {
        this.callbacks.onToast('STARVATION DETECTED', 'critical');
        this.workerSystem.removeWorkersByCount(foodResult.starvationDeaths, 'starvation');
      }
    }

    // ── 11b. Distribution resentment check ──
    // Compute weighted distribution to detect privileged overconsumption
    {
      const politicalCounts = this.politicalEntities.getEntityCounts();
      const pop = storeRef.resources.population;
      if (pop > 0) {
        const buckets = computeRoleBuckets(pop, politicalCounts);
        const dist = computeDistribution(pop, totalConsumptionMult, buckets);
        if (dist.resentmentActive) {
          this.callbacks.onPravda('Some comrades are more equal than others.');
        }
      }
    }

    // ── 11c. Foraging System — survival foraging when food is critically low ──
    {
      const foragingResult = foragingTick(
        storeRef.resources.food,
        storeRef.resources.population,
        this.chronologyAgent.getDate().month,
        this.foragingState,
        this.rng,
      );

      if (foragingResult.foodGathered > 0) {
        storeRef.resources.food += foragingResult.foodGathered;
      }

      if (foragingResult.kgbRisk > 0) {
        this.kgbAgent.addMark(
          'workers_abandoning_collective',
          this.chronologyAgent.getDate().totalTicks,
          'Workers observed abandoning collective duties for personal foraging',
        );
        this.callbacks.onToast('BLACK MARK: Workers abandoning collective duties for personal foraging', 'warning');
      }

      if (foragingResult.cannibalismFired) {
        this.workerSystem.removeWorkersByCount(1, 'starvation');
        this.callbacks.onToast('Something unspeakable has happened in the settlement...', 'critical');
      }

      if (foragingResult.moralePenalty > 0 && foragingResult.method === 'stone_soup') {
        this.callbacks.onAdvisor(
          'Comrade Mayor, the workers are boiling stones for soup. We have come to this.',
        );
      }
    }

    // ── 12. Disease ──
    this.defenseAgent.tickDiseaseFull({
      totalTicks: this.chronologyAgent.getDate().totalTicks,
      month: this.chronologyAgent.getDate().month,
      workers: this.workerSystem,
      callbacks: this.callbacks,
      rng: this.rng,
    });

    // ── 13. Population growth (yearly immigration) ──
    // Housing-gated immigration for both entity and aggregate modes.
    // In aggregate mode, spawnInflowDvor routes to spawnInflowAggregate
    // which adds working-age adults to raion pool + building workforces.
    if (tickResult.newYear) {
      const growthResult = populationSystem(
        this.rng,
        politburoMods.populationGrowthMult * eraMods.populationGrowthMult * diffConfig.growthMultiplier,
        this.chronologyAgent.getDate().month,
      );
      if (growthResult.growthCount > 0) {
        this.workerSystem.spawnInflowDvor(growthResult.growthCount, 'growth');
      }

      // ── Scheduled era-specific population inflows ──
      this.processScheduledInflows();
    }

    // Monthly emergency immigration — the Party sends reinforcements
    // when the settlement is at risk of complete collapse
    if (tickResult.newMonth && !tickResult.newYear) {
      const emergencyPop = storeRef.resources.population;
      if (emergencyPop > 0 && emergencyPop < 20) {
        const reinforcements = this.rng.int(5, 12);
        this.workerSystem.spawnInflowDvor(reinforcements, 'emergency_resettlement');
      } else if (emergencyPop >= 20 && emergencyPop < 40) {
        const reinforcements = this.rng.int(3, 8);
        this.workerSystem.spawnInflowDvor(reinforcements, 'emergency_resettlement');
      }
    }

    // ── 14. Worker system tick ──
    const workerResult = this.workerSystem.tick({
      vodkaAvailable: storeRef.resources.vodka,
      foodAvailable: storeRef.resources.food,
      heatingFailing: this.economyAgent.getHeating().failing,
      month: this.chronologyAgent.getDate().month,
      eraId: this.politicalAgent.getCurrentEra().id,
      totalTicks: this.chronologyAgent.getDate().totalTicks,
      trudodniRatio: this.economyAgent.getTrudodniRatio(),
    });

    // Emit drain events
    for (const drain of workerResult.drains) {
      if (drain.reason === 'migration') {
        this.callbacks.onToast(`WORKER FLED: ${drain.name} has abandoned the collective`, 'warning');
        this.callbacks.onPravda('TRAITOR ABANDONS GLORIOUS COLLECTIVE — GOOD RIDDANCE');
      } else if (drain.reason === 'youth_flight') {
        this.callbacks.onToast(`YOUTH DEPARTED: ${drain.name} has left for the city`, 'warning');
      } else if (drain.reason === 'workplace_accident') {
        this.callbacks.onToast(`WORKPLACE ACCIDENT: ${drain.name} killed in industrial incident`, 'critical');
        this.callbacks.onPravda('HEROIC WORKER MARTYRED IN SERVICE OF PRODUCTION');
      } else if (drain.reason === 'defection') {
        this.callbacks.onToast(`DEFECTION: ${drain.name} has defected`, 'warning');
      }
    }

    if (workerResult.averageMorale < 30 && this.chronologyAgent.getDate().totalTicks % 60 === 0) {
      this.callbacks.onAdvisor(
        'Comrade Mayor! Workers are deeply unhappy. If conditions do not improve, they WILL flee!',
      );
    }

    // ── 15. Demographics ──
    const effectivePop = this.raion?.totalPopulation ?? workerResult.population;
    let normalizedFood = Math.min(1, storeRef.resources.food / Math.max(1, effectivePop * 2));
    if (!Number.isFinite(normalizedFood)) normalizedFood = 0;
    const demoResult = this.demographicAgent.onTick(
      this.chronologyAgent.getDate().totalTicks,
      this.rng,
      normalizedFood,
      this.politicalAgent.getCurrentEraId(),
    );

    for (const dead of demoResult.deadMembers) {
      this.workerSystem.removeWorkerByDvorMember(dead.dvorId, dead.memberId);
    }
    for (const ref of demoResult.agedIntoWorking) {
      this.workerSystem.spawnWorkerFromDvor(ref.member, ref.dvorId);
    }
    if (demoResult.newDvory > 0) {
      this.workerSystem.syncCitizenDvorIds();
    }
    if (tickResult.newYear) {
      this.workerSystem.resetAnnualTrudodni();
      // Annual entity GC sweeps — only needed in entity mode
      if (!this.raion) {
        this.workerSystem.sweepOrphanCitizens();
        this.demographicAgent.sweepEmptyDvory();
      }
    }

    // ── 16. Monthly: loyalty + trudodni ──
    if (tickResult.newMonth) {
      const currentEraId = this.politicalAgent.getCurrentEraId();
      const pop = storeRef.resources.population;
      const foodLevel = pop > 0 ? Math.min(1, storeRef.resources.food / (pop * 2)) : 1;
      const quotaMet = this.quota.current >= this.quota.target;
      this.loyaltyAgent.setFoodLevel(foodLevel);
      const loyaltyResult = this.loyaltyAgent.tickLoyalty(currentEraId, quotaMet);

      if (loyaltyResult.sabotageCount > 0) {
        const penalty = Math.max(0.5, 1 - loyaltyResult.sabotageCount * 0.05);
        storeRef.resources.food *= penalty;
        storeRef.resources.vodka *= penalty;
        if (loyaltyResult.sabotageCount >= 2) {
          this.callbacks.onToast('SABOTAGE: Disloyal elements are destroying collective property!', 'warning');
        }
      }

      if (loyaltyResult.flightCount > 0) {
        this.workerSystem.removeWorkersByCount(loyaltyResult.flightCount, 'loyalty_flight');
        this.callbacks.onToast(
          `${loyaltyResult.flightCount} worker(s) fled the collective due to disloyalty`,
          'warning',
        );
      }

      accrueTrudodni();
    }

    // ── 17. Collective autonomous construction ──
    this.collectiveAgent.tickAutonomous({
      totalTicks: this.chronologyAgent.getDate().totalTicks,
      rng: this.rng,
      mandateState: this.mandateState,
      callbacks: this.callbacks as Parameters<typeof this.collectiveAgent.tickAutonomous>[0]['callbacks'],
      recordBuildingForMandates: (defId: string) => this.recordBuildingForMandates(defId),
    });

    // ── 18. Chairman meddling ──
    if (this.workerSystem.isChairmanMeddling() && this.chronologyAgent.getDate().totalTicks % 60 === 0) {
      this.callbacks.onAdvisor(
        'Comrade, the workers notice your constant meddling. They whisper that the chairman does not trust the collective.',
      );
      if (this.rng.random() < 0.05) {
        this.kgbAgent.addMark(
          'excessive_intervention',
          this.chronologyAgent.getDate().totalTicks,
          'Chairman interfered excessively with collective operations',
        );
        this.callbacks.onToast('BLACK MARK: Excessive interference with collective operations', 'warning');
      }
    }

    // ── 19. Decay + quota ──
    decaySystem(politburoMods.infrastructureDecayMult * eraMods.decayMult * diffConfig.decayMultiplier);
    quotaSystem(this.quota);

    // ── 20. Gulag effect ──
    this.defenseAgent.processGulagEffect({
      population: storeRef.resources.population,
      rng: this.rng,
      workers: this.workerSystem,
      scoring: this.scoring,
      kgb: this.kgbAgent,
      callbacks: this.callbacks,
      totalTicks: this.chronologyAgent.getDate().totalTicks,
    });

    // ── 21. Settlement ──
    this.settlement.tickWithCallbacks(
      this.callbacks as Parameters<typeof this.settlement.tickWithCallbacks>[0],
    );

    // ── 22. Era conditions ──
    this.politicalAgent.checkConditions({
      totalTicks: this.chronologyAgent.getDate().totalTicks,
      callbacks: this.callbacks,
      endGame: (v, r) => this.endGame(v, r),
    });

    // ── 23. Political entities ──
    this.politicalAgent.tickEntitiesFull({
      politicalEntities: this.politicalEntities,
      workers: this.workerSystem,
      kgb: this.kgbAgent,
      scoring: this.scoring,
      callbacks: this.callbacks,
      settlement: this.settlement,
      politburo: this.politburo,
      quota: this.quota,
      rng: this.rng,
      chronologyTotalTicks: this.chronologyAgent.getDate().totalTicks,
    });

    // ── 24. Minigames + events + fire + politburo + pravda + KGB ──
    tickMinigamesHelper(this.getMinigameContext());
    this.eventSystem.tick(this.chronologyAgent.getDate().totalTicks, eraMods.eventFrequencyMult);
    this.defenseAgent.update(1, tickResult.weather as WeatherType, this.grid, this.chronologyAgent.getDate().totalTicks, this.chronologyAgent.getDate().month);
    this.politburo.setCorruptionMult(eraMods.corruptionMult);
    this.politburo.tick(tickResult);

    // Pravda ambient headlines
    const headline = this.pravdaSystem.generateAmbientHeadline();
    if (headline) this.callbacks.onPravda(headline.headline);

    // KGB personnel file tick
    const totalTicks = this.chronologyAgent.getDate().totalTicks;
    this.kgbAgent.tickPersonnelFile(totalTicks);

    // Threat level tracking for scoring
    const currentThreat = this.kgbAgent.getThreatLevel();
    if (
      (currentThreat === 'investigated' || currentThreat === 'reviewed' || currentThreat === 'arrested') &&
      this.lastThreatLevel !== 'investigated' && this.lastThreatLevel !== 'reviewed' && this.lastThreatLevel !== 'arrested'
    ) {
      this.scoring.onInvestigation();
    }
    this.lastThreatLevel = currentThreat;

    // Autopilot bribery: when KGB threat escalates, attempt bribe if chairman recommends it
    if (this.agentManager.isAutopilot()) {
      const chairman = this.agentManager.getChairman();
      if (chairman) {
        const bribeDecision = chairman.shouldAttemptBribe();
        if (bribeDecision.shouldBribe) {
          const res = getResourceEntity();
          if (res && res.resources.blat >= 2) {
            this.kgbAgent.handleBribeOffer(bribeDecision.amount);
            res.resources.blat = Math.max(0, res.resources.blat - 2);
            this.callbacks.onToast('Autopilot: blat exchanged to reduce KGB suspicion', 'warning');
          }
        }
      }
    }

    // Arrest check
    if (this.kgbAgent.isArrested()) {
      const consequenceConfig = CONSEQUENCE_PRESETS[this.scoring.getConsequence()];
      if (consequenceConfig.permadeath) {
        this.endGame(false, 'Your personnel file has been reviewed. You have been declared an Enemy of the People. No further correspondence is expected.');
      } else {
        this.applyRehabilitation(consequenceConfig);
      }
    }

    // ── 25. Tutorial + directives + achievements ──
    tickTutorialHelper(this.getAchievementContext());
    tickDirectivesHelper({ callbacks: this.callbacks });
    tickAchievementsHelper(this.getAchievementContext());

    // ── 26. Autopilot ──
    if (this.agentManager.isAutopilot()) {
      const chairman = this.agentManager.getChairman();
      if (chairman) {
        const res = getResourceEntity();
        const pop = res?.resources.population ?? 0;
        const food = res?.resources.food ?? 0;
        const meta = getMetaEntity();
        chairman.assessGameState(
          { food, population: pop },
          {
            quotaProgress: this.quota.target > 0 ? this.quota.current / this.quota.target : 1,
            quotaDeadlineMonths: (this.quota.deadlineYear - (meta?.gameMeta.date.year ?? 1917)) * 12,
            blackMarks: this.kgbAgent.getBlackMarks(),
            commendations: this.kgbAgent.getCommendations(),
            blat: res?.resources.blat ?? 0,
          },
        );
        this.workerSystem.setCollectiveFocus(chairman.getRecommendedDirective());
      }
    }

    // ── 27. Sync + loss check ──
    this.syncSystemsToMeta();
    storeRef.resources.population = this.workerSystem.getPopulation();

    if (
      storeRef.resources.population <= 0 &&
      this.chronologyAgent.getDate().totalTicks > TICKS_PER_YEAR &&
      buildingsLogic.entities.length > 0
    ) {
      this.endGame(false, 'All citizens have perished. The settlement is abandoned.');
    }

    this.callbacks.onStateChange();
  }

  // ── Context builders ────────────────────────────────────────────────────────

  private getMinigameContext() {
    return {
      chronology: this.chronologyAgent,
      minigameRouter: this.minigameRouter,
      personnelFile: this.kgbAgent,
      callbacks: this.callbacks,
    };
  }

  private getAchievementContext() {
    return {
      chronology: this.chronologyAgent,
      achievements: this.achievements,
      tutorial: this.tutorial,
      callbacks: this.callbacks,
    };
  }

  private getAnnualReportContext() {
    return {
      chronology: this.chronologyAgent,
      personnelFile: this.kgbAgent,
      scoring: this.scoring,
      callbacks: this.callbacks,
      rng: this.rng,
      deliveries: this.deliveries,
      engineState: {
        quota: this.quota,
        consecutiveQuotaFailures: this.consecutiveQuotaFailures,
        pendingReport: this.pendingReport,
        mandateState: this.mandateState,
        pripiskiCount: this.pripiskiCount,
        quotaMultiplier: DIFFICULTY_PRESETS[this.difficulty].quotaMultiplier,
      },
      endGame: (victory: boolean, reason: string) => this.endGame(victory, reason),
    };
  }

  // ── Scheduled Population Inflows ────────────────────────────────────────────

  /**
   * Process scheduled population inflows based on the current era.
   * Called on year boundaries to provide era-appropriate workforce reinforcements.
   */
  private processScheduledInflows(): void {
    const currentEraId = this.politicalAgent.getCurrentEra().id;
    const currentYear = this.chronologyAgent.getDate().year;
    const schedule = political.doctrine.inflowSchedule as Record<string, InflowScheduleEntry>;
    const entry = schedule[currentEraId];
    if (!entry) return;

    // Handle one-shot inflows (great_patriotic evacuee influx)
    if (entry.once) {
      if (this.evacueeInfluxFired) return;
      const [minCount, maxCount] = entry.count ?? [10, 30];
      const count = this.rng.int(minCount, maxCount);
      this.workerSystem.spawnInflowDvor(count, 'evacuee_influx', { morale: 25, loyalty: 40 });
      this.evacueeInfluxFired = true;
      this.callbacks.onToast(
        `War evacuees arrive: ${count} displaced persons seeking refuge.`,
        'warning',
      );
      return;
    }

    // Interval-based inflows
    const intervalYears = entry.intervalYears ?? 3;
    const lastYear = this.lastInflowYear[currentEraId] ?? 0;
    if (lastYear > 0 && currentYear - lastYear < intervalYears) return;

    this.lastInflowYear[currentEraId] = currentYear;

    switch (entry.type) {
      case 'forced_resettlement': {
        const result = this.workerSystem.forcedResettlement();
        this.callbacks.onToast(
          `${result.count} families forcibly resettled to your settlement.`,
          'warning',
        );
        break;
      }
      case 'moscow_assignment': {
        const result = this.workerSystem.moscowAssignment();
        this.callbacks.onToast(
          `Moscow sends ${result.count} new workers to the collective.`,
          'warning',
        );
        break;
      }
      case 'veteran_return': {
        const [minCount, maxCount] = entry.count ?? [5, 20];
        const count = this.rng.int(minCount, maxCount);
        this.workerSystem.spawnInflowDvor(count, 'veteran_return', { morale: 35, skill: 40 });
        this.callbacks.onToast(
          `Veterans return from the front: ${count} scarred workers rejoin.`,
          'warning',
        );
        break;
      }
      case 'algorithmic_assignment': {
        const [minCount, maxCount] = entry.count ?? [1, 50];
        const count = this.rng.int(minCount, maxCount);
        this.workerSystem.spawnInflowDvor(count, 'algorithmic');
        this.callbacks.onToast(
          `The Algorithm assigns ${count} new workers to your sector.`,
          'warning',
        );
        break;
      }
      default:
        break;
    }
  }

  private getSerializableEngine() {
    const politicalForSerialization = Object.create(this.politicalAgent);
    politicalForSerialization.serialize = () => ({
      currentYear: this.chronologyAgent.getDate().year,
      previousEraId: this.politicalAgent.getPreviousEraId(),
      transitionTicksRemaining: 0,
    });

    return {
      chronology: this.chronologyAgent,
      eraSystem: politicalForSerialization,
      economySystem: this.economyAgent,
      eventSystem: this.eventSystem,
      pravdaSystem: this.pravdaSystem,
      politburo: this.politburo,
      personnelFile: this.kgbAgent,
      deliveries: this.deliveries,
      settlement: this.settlement,
      politicalEntities: this.politicalEntities,
      minigameRouter: this.minigameRouter,
      scoring: this.scoring,
      tutorial: this.tutorial,
      achievements: this.achievements,
      mandateState: this.mandateState,
      transport: this.transport,
      fireSystem: this.defenseAgent,
      workerSystem: this.workerSystem,
      quota: this.quota,
      consecutiveQuotaFailures: this.consecutiveQuotaFailures,
      pripiskiCount: this.pripiskiCount,
      lastSeason: this.lastSeason,
      lastWeather: this.lastWeather,
      lastDayPhase: this.lastDayPhase,
      lastThreatLevel: this.lastThreatLevel,
      pendingReport: this.pendingReport,
      pendingReportSinceTick: this.pendingReportSinceTick,
      ended: this.ended,
      lastInflowYear: this.lastInflowYear,
      evacueeInfluxFired: this.evacueeInfluxFired,
      foragingState: this.foragingState,
      rng: this.rng,
      eventHandler: this.eventHandler,
      politburoEventHandler: this.politburoEventHandler,
      syncSystemsToMeta: () => this.syncSystemsToMeta(),
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private syncAnnualReportState(state: AnnualReportEngineState): void {
    this.consecutiveQuotaFailures = state.consecutiveQuotaFailures;
    this.pendingReport = state.pendingReport;
    this.mandateState = state.mandateState;
    this.pripiskiCount = state.pripiskiCount;
  }

  private syncChronologyToMeta(_tick: TickResult): void {
    const date = this.chronologyAgent.getDate();
    const meta = getMetaEntity();
    if (meta) {
      meta.gameMeta.date.year = date.year;
      meta.gameMeta.date.month = date.month;
      meta.gameMeta.date.tick = date.hour;
    }
  }

  private emitChronologyChanges(tick: TickResult): void {
    const seasonKey = tick.season.season;
    if (seasonKey !== this.lastSeason) {
      this.lastSeason = seasonKey;
      this.callbacks.onSeasonChanged?.(seasonKey);
    }
    const weatherKey = tick.weather;
    if (weatherKey !== this.lastWeather) {
      this.lastWeather = weatherKey;
      this.callbacks.onWeatherChanged?.(weatherKey);
    }
    const dayPhaseKey = tick.dayPhase;
    if (dayPhaseKey !== this.lastDayPhase) {
      this.lastDayPhase = dayPhaseKey;
      this.callbacks.onDayPhaseChanged?.(dayPhaseKey, tick.dayProgress);
    }
  }

  private syncSystemsToMeta(): void {
    const meta = getMetaEntity();
    if (!meta) return;
    meta.gameMeta.quota.type = this.quota.type;
    meta.gameMeta.quota.target = this.quota.target;
    meta.gameMeta.quota.current = this.quota.current;
    meta.gameMeta.quota.deadlineYear = this.quota.deadlineYear;
    const gs = this.politburo.getGeneralSecretary();
    meta.gameMeta.leaderName = gs.name;
    meta.gameMeta.leaderPersonality = gs.personality;
    meta.gameMeta.blackMarks = this.kgbAgent.getBlackMarks();
    meta.gameMeta.commendations = this.kgbAgent.getCommendations();
    meta.gameMeta.threatLevel = this.kgbAgent.getThreatLevel();
    meta.gameMeta.settlementTier = this.settlement.getCurrentTier();
    meta.gameMeta.currentEra = this.politicalAgent.getCurrentEraId();
    meta.gameMeta.roadQuality = this.transport.getQuality();
    meta.gameMeta.roadCondition = this.transport.getCondition();
  }

  /** Average building condition factor (0.0 - 1.0). Durability 100 = 1.0. */
  private getAverageBuildingCondition(): number {
    let totalCondition = 0;
    let count = 0;
    for (const entity of decayableBuildings) {
      totalCondition += entity.durability.current / 100;
      count++;
    }
    return count === 0 ? 1.0 : totalCondition / count;
  }

  /** Thin delegate — calls KGBAgent.applyRehabilitation(). */
  private applyRehabilitation(config: ConsequenceConfig): void {
    this.kgbAgent.applyRehabilitation(config, {
      grid: this.grid,
      rng: this.rng,
      workers: this.workerSystem,
      scoring: this.scoring,
      chronology: this.chronologyAgent,
      callbacks: this.callbacks,
    });
  }

  /** Apply a GameEvent's resource effects to ECS (for PolitburoSystem events). */
  private applyEventEffects(event: GameEvent): void {
    const store = getResourceEntity();
    if (!store) return;
    const r = store.resources;
    const fx = event.effects;
    if (fx.money) r.money = Math.max(0, r.money + fx.money);
    if (fx.food) r.food = Math.max(0, r.food + fx.food);
    if (fx.vodka) r.vodka = Math.max(0, r.vodka + fx.vodka);
    if (fx.pop) {
      if (fx.pop > 0) {
        this.workerSystem.spawnInflowDvor(fx.pop, 'event');
      } else {
        this.workerSystem.removeWorkersByCount(-fx.pop, 'event');
      }
    }
    if (fx.power) r.power = Math.max(0, r.power + fx.power);
  }

  private endGame(victory: boolean, reason: string): void {
    if (this.ended) return;
    this.ended = true;
    const meta = getMetaEntity();
    if (meta) meta.gameMeta.gameOver = { victory, reason };
    this.callbacks.onGameOver?.(victory, reason);
    if (this.callbacks.onGameTally) {
      const res = getResourceEntity();
      const date = this.chronologyAgent.getDate();
      const tally = createGameTally(this.scoring, this.achievements, {
        victory,
        reason,
        currentYear: date.year,
        startYear: this.startYear,
        population: res?.resources.population ?? 0,
        buildingCount: buildingsLogic.entities.length,
        money: res?.resources.money ?? 0,
        food: res?.resources.food ?? 0,
        vodka: res?.resources.vodka ?? 0,
        blackMarks: this.kgbAgent.getBlackMarks(),
        commendations: this.kgbAgent.getCommendations(),
        settlementTier: this.settlement.getCurrentTier(),
        quotaFailures: this.consecutiveQuotaFailures,
      });
      this.callbacks.onGameTally(tally);
    }
  }
}

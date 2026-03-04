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

// ── Re-exports (callers import SimCallbacks/SubsystemSaveData from here) ─────
export type { SimCallbacks, SubsystemSaveData } from './engine/types';

import { buildingsLogic, dvory, getMetaEntity, getResourceEntity } from '@/ecs/archetypes';
import { setBuildingCollapsedCallback, setStarvationCallback } from '@/ecs/systems';
import { AgentManager } from '../ai/AgentManager';
import type { TickResult } from '../ai/agents/core/ChronologyAgent';
// ── Yuka agents ──
import { ChronologyAgent, ChronologySystem } from '../ai/agents/core/ChronologyAgent';
import { WeatherAgent } from '../ai/agents/core/WeatherAgent';
import { getWeatherProfile, type WeatherType } from '../ai/agents/core/weather-types';
import type { GovernorDirective, IGovernor } from '../ai/agents/crisis/Governor';
import { EconomyAgent, type EraId as EconomyEraId, EconomySystem } from '../ai/agents/economy/EconomyAgent';
import { DIFFICULTY_MULTIPLIERS } from '../ai/agents/economy/economy-core';
import { FoodAgent } from '../ai/agents/economy/FoodAgent';
import { createForagingState, type ForagingState } from '../ai/agents/economy/foragingSystem';
import { StorageAgent } from '../ai/agents/economy/StorageAgent';
import { VodkaAgent } from '../ai/agents/economy/VodkaAgent';
import { CollectiveAgent } from '../ai/agents/infrastructure/CollectiveAgent';
import { PowerAgent } from '../ai/agents/infrastructure/PowerAgent';
import { SettlementSystem } from '../ai/agents/infrastructure/SettlementSystem';
import { TransportSystem } from '../ai/agents/infrastructure/TransportSystem';
import { AchievementTracker } from '../ai/agents/meta/AchievementTracker';
import { MinigameRouter } from '../ai/agents/meta/minigames/MinigameRouter';
import {
  checkBuildingTapMinigame as checkBuildingTapMinigameHelper,
  checkEventMinigame as checkEventMinigameHelper,
  isMinigameAvailable as isMinigameAvailableHelper,
  resolveMinigameChoice as resolveMinigameChoiceHelper,
} from '../ai/agents/meta/minigameTick';
import { TutorialSystem } from '../ai/agents/meta/TutorialSystem';
import type { GameEvent } from '../ai/agents/narrative/events';
import { EventSystem } from '../ai/agents/narrative/events';
import { PolitburoSystem } from '../ai/agents/narrative/politburo';
import { PravdaSystem } from '../ai/agents/narrative/pravda';
import { CompulsoryDeliveries } from '../ai/agents/political/CompulsoryDeliveries';
import { KGBAgent, PersonnelFile } from '../ai/agents/political/KGBAgent';
import { LoyaltyAgent } from '../ai/agents/political/LoyaltyAgent';
import type { PlanMandateState, QuotaState } from '../ai/agents/political/PoliticalAgent';
import {
  createDefaultQuota,
  createMandatesForEra,
  createPlanMandateState,
  PoliticalAgent,
  recordBuildingPlaced,
} from '../ai/agents/political/PoliticalAgent';
import { PoliticalEntitySystem } from '../ai/agents/political/PoliticalEntitySystem';
import type { ConsequenceLevel, DifficultyLevel } from '../ai/agents/political/ScoringSystem';
import { DIFFICULTY_PRESETS, ScoringSystem } from '../ai/agents/political/ScoringSystem';
import { DefenseAgent, FireSystem, initDiseaseSystem } from '../ai/agents/social/DefenseAgent';
import { DemographicAgent } from '../ai/agents/social/DemographicAgent';
import { getPopulationMode } from '../ai/agents/workforce/collectiveTransition';
import { WorkerSystem } from '../ai/agents/workforce/WorkerSystem';
import { applyEventEffects } from './engine/eventEffects';
import { phaseChronology } from './engine/phaseChronology';
import { phaseConsumption } from './engine/phaseConsumption';
import { phaseFinalize, syncSystemsToMeta } from './engine/phaseFinalize';
import { phaseNarrative } from './engine/phaseNarrative';
import { phasePolitical } from './engine/phasePolitical';
import { phaseProduction } from './engine/phaseProduction';
import { phaseSocial } from './engine/phaseSocial';
import {
  restoreSubsystems as restoreSubsystemsHelper,
  serializeSubsystems as serializeSubsystemsHelper,
} from './engine/serializeEngine';
import type { TickContext } from './engine/tickContext';
import type { SimCallbacks, SubsystemSaveData } from './engine/types';
import { EraSystem } from './era';
import type { GameGrid } from './GameGrid';
import { createGameTally } from './GameTally';
import { GameRng } from './SeedSystem';

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

  // ── Governor (null by default — all existing behavior unchanged) ──
  private governor: IGovernor | null = null;
  private cachedDirective: GovernorDirective | null = null;

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
      applyEventEffects(event, this.workerSystem);
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

    this.scoring = new ScoringSystem(difficulty ?? 'comrade', consequence ?? 'gulag');
    this.tutorial = new TutorialSystem();
    // Skip tutorial — settlement builds organically via CollectiveAgent bootstrap
    this.tutorial.skip();
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

  public getEventSystem(): EventSystem {
    return this.eventSystem;
  }
  public getPravdaSystem(): PravdaSystem {
    return this.pravdaSystem;
  }
  public getPolitburo(): PolitburoSystem {
    return this.politburo;
  }
  public getChronology(): ChronologySystem {
    return this.chronologyAgent;
  }
  public getPersonnelFile(): PersonnelFile {
    return this.kgbAgent;
  }
  public getDeliveries(): CompulsoryDeliveries {
    return this.deliveries;
  }
  public getSettlement(): SettlementSystem {
    return this.settlement;
  }
  public getEraSystem(): EraSystem {
    return this.politicalAgent;
  }
  public getEconomySystem(): EconomySystem {
    return this.economyAgent;
  }
  public getPoliticalEntities(): PoliticalEntitySystem {
    return this.politicalEntities;
  }
  public getWorkerSystem(): WorkerSystem {
    return this.workerSystem;
  }
  public getAgentManager(): AgentManager {
    return this.agentManager;
  }
  public getMinigameRouter(): MinigameRouter {
    return this.minigameRouter;
  }
  public getScoring(): ScoringSystem {
    return this.scoring;
  }
  public getTutorial(): TutorialSystem {
    return this.tutorial;
  }
  public getFireSystem(): FireSystem {
    return this.defenseAgent;
  }
  public getAchievements(): AchievementTracker {
    return this.achievements;
  }
  public getQuota(): Readonly<QuotaState> {
    return this.quota;
  }
  public getRaion(): import('@/ecs/world').RaionPool | undefined {
    return this.raion;
  }

  // ── Agent getters ───────────────────────────────────────────────────────────

  public getChronologyAgent(): ChronologyAgent {
    return this.chronologyAgent;
  }
  public getWeatherAgent(): WeatherAgent {
    return this.weatherAgent;
  }
  public getPowerAgent(): PowerAgent {
    return this.powerAgent;
  }
  public getFoodAgent(): FoodAgent {
    return this.foodAgent;
  }
  public getVodkaAgent(): VodkaAgent {
    return this.vodkaAgent;
  }
  public getStorageAgent(): StorageAgent {
    return this.storageAgent;
  }
  public getEconomyAgent(): EconomyAgent {
    return this.economyAgent;
  }
  public getCollectiveAgent(): CollectiveAgent {
    return this.collectiveAgent;
  }
  public getRng(): GameRng {
    return this.rng;
  }
  public getDemographicAgent(): DemographicAgent {
    return this.demographicAgent;
  }
  public getKGBAgent(): KGBAgent {
    return this.kgbAgent;
  }
  public getPoliticalAgent(): PoliticalAgent {
    return this.politicalAgent;
  }
  public getDefenseAgent(): DefenseAgent {
    return this.defenseAgent;
  }
  public getLoyaltyAgent(): LoyaltyAgent {
    return this.loyaltyAgent;
  }

  // ── Governor ───────────────────────────────────────────────────────────────

  public setGovernor(gov: IGovernor): void {
    this.governor = gov;
    // Wire crisis-active check so doctrine mechanics that overlap with
    // crisis agent behavior (e.g. wartime_conscription) are skipped.
    this.politicalEntities.setCrisisCheck((type: string) => {
      if (!this.governor || !this.cachedDirective) return false;
      if (type === 'war') {
        return this.cachedDirective.crisisImpacts.some(
          (i) => i.workforce?.conscriptionCount !== undefined && i.workforce.conscriptionCount > 0,
        );
      }
      return false;
    });
    // Tell PoliticalAgent what mode we're in so it uses the right era transition logic
    if (gov.constructor.name === 'HistoricalGovernor') {
      this.politicalAgent.setGameMode('historical');
    } else if (gov.constructor.name === 'FreeformGovernor') {
      this.politicalAgent.setGameMode('freeform');
    }
  }
  public getGovernor(): IGovernor | null {
    return this.governor;
  }

  // ── Autopilot ───────────────────────────────────────────────────────────────

  public enableAutopilot(): void {
    this.agentManager.enableAutopilot();
    if (!this._originalOnMinigame) this._originalOnMinigame = this.callbacks.onMinigame;
    if (!this._originalOnAnnualReport) this._originalOnAnnualReport = this.callbacks.onAnnualReport;

    this.callbacks.onMinigame = (active, resolveChoice) => {
      const chairman = this.agentManager.getChairman();
      if (chairman) {
        const aiChoices = active.definition.choices.map((c) => ({
          id: c.id,
          successChance: c.successChance,
          onSuccess: c.onSuccess,
          onFailure: c.onFailure,
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

  public getMandateState(): PlanMandateState | null {
    return this.mandateState;
  }

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

    // Build context for all phases
    const tickResult = this.chronologyAgent.tick();
    const ctx = this.buildTickContext(tickResult, storeRef);

    // Phase 1: Chronology, era transitions, governor
    const chronoResult = phaseChronology(ctx);
    this.raion = chronoResult.raion;
    this.cachedDirective = chronoResult.cachedDirective;
    ctx.raion = this.raion;
    ctx.cachedDirective = this.cachedDirective;
    ctx.diffConfig = this.cachedDirective?.modifiers ?? DIFFICULTY_PRESETS[this.difficulty];
    this.computeTickModifiers(ctx);

    // Phase 2: Power, transport, construction, production
    const snapshot = phaseProduction(ctx);

    // Phase 3: Storage, economy, deliveries, consumption, foraging
    phaseConsumption(ctx, snapshot);

    // Phase 4: Disease, population, workers, demographics
    phaseSocial(ctx);

    // Phase 5: Loyalty, construction, decay, gulag, settlement, political entities
    phasePolitical(ctx);

    // Phase 6: Minigames, events, fire, KGB, tutorials, achievements
    phaseNarrative(ctx);

    // Phase 7: Autopilot, sync, loss check
    phaseFinalize(ctx);

    // Sync mutable state back from context
    this.syncStateFromContext(ctx);
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
      syncSystemsToMeta: () =>
        syncSystemsToMeta({
          quota: this.quota,
          kgb: this.kgbAgent,
          political: this.politicalAgent,
          settlement: this.settlement,
          transport: this.transport,
          politburo: this.politburo,
        }),
      governor: this.governor,
    };
  }

  private buildTickContext(tickResult: TickResult, storeRef: any): TickContext {
    const popMode = getPopulationMode(storeRef.resources.population, this.raion);
    const diffConfig = this.cachedDirective?.modifiers ?? DIFFICULTY_PRESETS[this.difficulty];
    return {
      storeRef,
      tickResult,
      popMode,
      raion: this.raion,
      diffConfig,
      cachedDirective: this.cachedDirective,
      agents: {
        chronology: this.chronologyAgent,
        weather: this.weatherAgent,
        power: this.powerAgent,
        food: this.foodAgent,
        vodka: this.vodkaAgent,
        storage: this.storageAgent,
        economy: this.economyAgent,
        collective: this.collectiveAgent,
        demographic: this.demographicAgent,
        kgb: this.kgbAgent,
        political: this.politicalAgent,
        defense: this.defenseAgent,
        loyalty: this.loyaltyAgent,
      },
      systems: {
        settlement: this.settlement,
        politicalEntities: this.politicalEntities,
        minigameRouter: this.minigameRouter,
        scoring: this.scoring,
        workerSystem: this.workerSystem,
        tutorial: this.tutorial,
        achievements: this.achievements,
        transport: this.transport,
        fireSystem: this.defenseAgent,
        deliveries: this.deliveries,
        pravda: this.pravdaSystem,
        politburo: this.politburo,
        eventSystem: this.eventSystem,
        agentManager: this.agentManager,
      },
      state: {
        quota: this.quota,
        mandateState: this.mandateState,
        foragingState: this.foragingState,
        stakhanoviteBoosts: this.stakhanoviteBoosts,
        mtsGrainMultiplier: this.mtsGrainMultiplier,
        difficulty: this.difficulty,
        startYear: this.startYear,
        lastThreatLevel: this.lastThreatLevel,
        consecutiveQuotaFailures: this.consecutiveQuotaFailures,
        pendingReport: this.pendingReport,
        pendingReportSinceTick: this.pendingReportSinceTick,
        pripiskiCount: this.pripiskiCount,
        ended: this.ended,
        evacueeInfluxFired: this.evacueeInfluxFired,
        lastInflowYear: this.lastInflowYear,
        lastSeason: this.lastSeason,
        lastWeather: this.lastWeather,
        lastDayPhase: this.lastDayPhase,
      },
      modifiers: null as any, // Filled by computeTickModifiers() after phaseChronology
      rng: this.rng,
      grid: this.grid,
      governor: this.governor,
      callbacks: this.callbacks,
      endGame: (v: boolean, r: string) => this.endGame(v, r),
    };
  }

  /** Compute per-tick modifiers and store on context. Must be called after phaseChronology. */
  private computeTickModifiers(ctx: TickContext): void {
    const weatherProfile = getWeatherProfile(ctx.tickResult.weather as WeatherType);
    const politburoMods = this.politburo.getModifiers();
    const eraMods = this.politicalAgent.getModifiers();
    const heatingPenalty = this.economyAgent.getHeating().failing ? 0.5 : 1.0;
    const seasonFarmMult = ctx.tickResult.season.farmMultiplier;
    const farmMod =
      seasonFarmMult *
      weatherProfile.farmModifier *
      politburoMods.foodProductionMult *
      eraMods.productionMult *
      heatingPenalty *
      ctx.state.mtsGrainMultiplier;
    const vodkaMod = politburoMods.vodkaProductionMult * eraMods.productionMult * heatingPenalty;

    ctx.modifiers = {
      farmMod,
      vodkaMod,
      eraMods,
      politburoMods,
      weatherProfile,
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /** Sync mutable state from TickContext back to engine fields after all phases. */
  private syncStateFromContext(ctx: TickContext): void {
    this.lastSeason = ctx.state.lastSeason;
    this.lastWeather = ctx.state.lastWeather;
    this.lastDayPhase = ctx.state.lastDayPhase;
    this.lastThreatLevel = ctx.state.lastThreatLevel;
    this.consecutiveQuotaFailures = ctx.state.consecutiveQuotaFailures;
    this.pendingReport = ctx.state.pendingReport;
    this.pendingReportSinceTick = ctx.state.pendingReportSinceTick;
    this.mandateState = ctx.state.mandateState;
    this.pripiskiCount = ctx.state.pripiskiCount;
    this.mtsGrainMultiplier = ctx.state.mtsGrainMultiplier;
    // endGame() may have set this.ended directly; don't overwrite with stale ctx value
    this.ended = this.ended || ctx.state.ended;
    this.evacueeInfluxFired = ctx.state.evacueeInfluxFired;
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

/**
 * SimulationEngine — thin orchestrator over ECS systems.
 *
 * The Miniplex ECS world is the source of truth for game simulation.
 * This engine calls ECS systems in order each tick, then syncs the
 * ECS is the single source of truth. React snapshots read ECS directly.
 *
 * Systems executed per tick (in order):
 *   1. ChronologySystem       — advance time, season, weather, day/night
 *   2. powerSystem             — distribute power across buildings
 *   2b. constructionSystem     — advance building construction progress
 *   3. productionSystem        — produce food/vodka from powered producers
 *   4. CompulsoryDeliveries    — state extraction of new production
 *   5. consumptionSystem       — citizens consume food and vodka
 *   6. populationSystem        — population growth from housing + food
 *   7. decaySystem             — buildings degrade over time
 *   8. quotaSystem             — track 5-year plan progress
 *   9. SettlementSystem        — evaluate tier upgrades/downgrades
 *  10. EventSystem             — random satirical events
 *  10b. FireSystem             — fire spread, damage, zeppelin firefighting
 *  11. PolitburoSystem         — corruption drain, politburo events
 *  12. PravdaSystem            — generate propaganda headlines
 *  13. PersonnelFile           — black mark decay, arrest check
 */

import type { AnnualReportData, ReportSubmission } from '@/components/ui/AnnualReportModal';
import { getBuildingDef } from '@/data/buildingDefs';
import {
  buildingsLogic,
  getMetaEntity,
  getResourceEntity,
  operationalBuildings,
} from '@/ecs/archetypes';
import type { FireSystemSaveData } from './FireSystem';
import { FireSystem } from './FireSystem';
import type { QuotaState } from '@/ecs/systems';
import {
  constructionSystem,
  consumptionSystem,
  createDefaultQuota,
  decaySystem,
  demographicTick,
  populationSystem,
  powerSystem,
  productionSystem,
  quotaSystem,
  setBuildingCollapsedCallback,
  setStarvationCallback,
  storageSystem,
} from '@/ecs/systems';
import type { AchievementTrackerSaveData } from './AchievementTracker';
import { AchievementTracker } from './AchievementTracker';
import { TICKS_PER_YEAR } from './Chronology';
import type { ChronologyState, TickResult } from './ChronologySystem';
import { ChronologySystem } from './ChronologySystem';
import type { CompulsoryDeliverySaveData } from './CompulsoryDeliveries';
import { CompulsoryDeliveries } from './CompulsoryDeliveries';
import { DISEASE_PRAVDA_HEADLINES, diseaseTick, initDiseaseSystem } from './DiseaseSystem';
import { type EraId as EconomyEraId, type EconomySaveData, EconomySystem } from './economy';
// ── Extracted helpers ──
import {
  tickAchievements as tickAchievementsHelper,
  tickTutorial as tickTutorialHelper,
} from './engine/achievementTick';
import {
  type AnnualReportEngineState,
  checkQuota as checkQuotaHelper,
} from './engine/annualReportTick';
import {
  checkBuildingTapMinigame as checkBuildingTapMinigameHelper,
  checkEventMinigame as checkEventMinigameHelper,
  resolveMinigameChoice as resolveMinigameChoiceHelper,
  tickMinigames as tickMinigamesHelper,
} from './engine/minigameTick';
import {
  restoreSubsystems as restoreSubsystemsHelper,
  serializeSubsystems as serializeSubsystemsHelper,
} from './engine/serializeEngine';
import type { EraDefinition, EraSystemSaveData } from './era';
import { ERA_DEFINITIONS, EraSystem } from './era';
import type { EventSystemSaveData, GameEvent } from './events';
import { EventSystem } from './events';
import type { GameGrid } from './GameGrid';
import { createGameTally, type TallyData } from './GameTally';
import { MinigameRouter } from './minigames/MinigameRouter';
import type { ActiveMinigame, MinigameRouterSaveData } from './minigames/MinigameTypes';
import type { PersonnelFileSaveData } from './PersonnelFile';
import { PersonnelFile } from './PersonnelFile';
import type { MandateWithFulfillment, PlanMandateState } from './PlanMandates';
import { createMandatesForEra, createPlanMandateState, recordBuildingPlaced } from './PlanMandates';
import type { PolitburoSaveData } from './politburo';
import { PolitburoSystem } from './politburo';
import type { PoliticalEntitySaveData } from './political';
import { PoliticalEntitySystem } from './political';
import type { PravdaSaveData } from './pravda';
import { PravdaSystem } from './pravda';
import type { ConsequenceLevel, DifficultyLevel, ScoringSystemSaveData } from './ScoringSystem';
import { eraIdToIndex, ScoringSystem } from './ScoringSystem';
import type { GameRng } from './SeedSystem';
import type { SettlementEvent, SettlementMetrics, SettlementSaveData } from './SettlementSystem';
import { SettlementSystem } from './SettlementSystem';
import { type TransportSaveData, TransportSystem } from './TransportSystem';
import type { TutorialMilestone, TutorialSaveData } from './TutorialSystem';
import { TutorialSystem } from './TutorialSystem';
import { getWeatherProfile, type WeatherType } from './WeatherSystem';
import { WorkerSystem } from './workers/WorkerSystem';

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
  onAnnualReport?: (
    data: AnnualReportData,
    submitReport: (submission: ReportSubmission) => void
  ) => void;
  /** Fired when a minigame triggers. UI should present choices and call resolveChoice(id). */
  onMinigame?: (active: ActiveMinigame, resolveChoice: (choiceId: string) => void) => void;
  /** Fired when a tutorial milestone triggers (Krupnik guidance). */
  onTutorialMilestone?: (milestone: TutorialMilestone) => void;
  /** Fired when an achievement unlocks. */
  onAchievement?: (name: string, description: string) => void;
  /** Fired on game over with complete tally data for the summary screen. */
  onGameTally?: (tally: TallyData) => void;
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
    ended: boolean;
  };
}

/** Maps game EraSystem IDs → EconomySystem EraIds. */
const GAME_ERA_TO_ECONOMY_ERA: Record<string, EconomyEraId> = {
  war_communism: 'revolution',
  first_plans: 'industrialization',
  great_patriotic: 'wartime',
  reconstruction: 'reconstruction',
  thaw: 'thaw',
  stagnation: 'stagnation',
  perestroika: 'perestroika',
  eternal_soviet: 'eternal',
};

/** Event IDs that should ignite a building when triggered. */
const FIRE_EVENT_IDS = new Set([
  'cultural_palace_fire',
  'power_station_explosion',
]);

export class SimulationEngine {
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
  private difficulty: DifficultyLevel;
  private quota: QuotaState;
  private rng: GameRng | undefined;
  private lastSeason = '';
  private lastWeather = '';
  private lastDayPhase = '';
  private lastThreatLevel = '';
  private consecutiveQuotaFailures = 0;
  private pendingReport = false;
  private ended = false;
  /** Stored so restoreSubsystems can rewire EventSystem/PolitburoSystem. */
  private eventHandler!: (event: GameEvent) => void;
  private politburoEventHandler!: (event: GameEvent) => void;

  constructor(
    private grid: GameGrid,
    private callbacks: SimCallbacks,
    rng?: GameRng,
    difficulty?: DifficultyLevel,
    consequence?: ConsequenceLevel
  ) {
    this.rng = rng;
    this.difficulty = difficulty ?? 'comrade';
    this.quota = createDefaultQuota();
    const meta = getMetaEntity();
    const startYear = meta?.gameMeta.date.year ?? 1922;
    this.chronology = new ChronologySystem(
      rng ??
        ({
          random: () => Math.random(),
          int: (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1)),
          pick: <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]!,
        } as GameRng),
      startYear
    );
    // Era System — determines historical period, modifiers, building gates
    this.eraSystem = new EraSystem(startYear);

    // Economy System — trudodni, fondy, blat, rations, stakhanovite, MTS, heating, reforms
    const economyEra = GAME_ERA_TO_ECONOMY_ERA[this.eraSystem.getCurrentEraId()] ?? 'revolution';
    this.economySystem = new EconomySystem(economyEra, difficulty ?? 'comrade');
    if (rng) this.economySystem.setRng(rng);
    // Pre-mark currency reforms that happened before the game start year
    this.economySystem.markReformsBeforeYear(startYear);

    this.pravdaSystem = new PravdaSystem(rng);

    this.eventHandler = (event: GameEvent) => {
      const headline = this.pravdaSystem.headlineFromEvent(event);
      this.callbacks.onPravda(headline.headline);

      // Route ALL events through toast with severity mapping.
      // Advisor is reserved for Krupnik tutorial/guidance messages only.
      if (event.severity === 'catastrophic') {
        this.callbacks.onToast(event.title, 'evacuation');
      } else if (event.severity === 'major') {
        this.callbacks.onToast(event.title, 'critical');
      } else {
        // minor + trivial events
        this.callbacks.onToast(event.title, 'warning');
      }

      // Fire-triggering events ignite a random building
      if (FIRE_EVENT_IDS.has(event.id)) {
        this.fireSystem.igniteRandom();
      }
    };

    this.eventSystem = new EventSystem(this.eventHandler, rng);

    // PolitburoSystem events carry effects (money, food, pop, etc.) but unlike
    // EventSystem, they don't apply effects internally. Wrap the handler to
    // apply resource deltas to the ECS store before dispatching UI notifications.
    this.politburoEventHandler = (event: GameEvent) => {
      this.applyEventEffects(event);
      this.eventHandler(event);
    };
    this.politburo = new PolitburoSystem(this.politburoEventHandler, rng, startYear);

    // Personnel File — tracks black marks and commendations (game-over mechanic)
    this.personnelFile = new PersonnelFile();

    // Wire EventSystem → PersonnelFile so events generate marks/commendations
    this.eventSystem.setPersonnelFile(this.personnelFile);

    // Compulsory Deliveries — state takes cut of production, doctrine from era
    this.deliveries = new CompulsoryDeliveries(this.eraSystem.getDoctrine());
    if (rng) this.deliveries.setRng(rng);

    // Settlement Evolution — selo → posyolok → pgt → gorod
    this.settlement = new SettlementSystem(meta?.gameMeta.settlementTier ?? 'selo');

    // Political Entities — visible politruks, KGB agents, military on map
    this.politicalEntities = new PoliticalEntitySystem(rng);

    // Minigame Router — trigger/resolve/auto-resolve minigames
    this.minigameRouter = new MinigameRouter(rng);

    // Worker System — manages citizen entities, morale, assignment, vodka
    this.workerSystem = new WorkerSystem(rng);

    // Scoring System — accumulates score at era boundaries
    this.scoring = new ScoringSystem(difficulty ?? 'comrade', consequence ?? 'permadeath');

    // Tutorial System — Era 1 progressive disclosure via Comrade Krupnik
    this.tutorial = new TutorialSystem();

    // Achievement Tracker — 28 achievements driven by game stats
    this.achievements = new AchievementTracker();

    // Transport System — road quality, condition degradation, maintenance
    this.transport = new TransportSystem(this.eraSystem.getCurrentEraId());
    if (rng) this.transport.setRng(rng);

    // Fire System — fire spread, damage, zeppelin firefighting
    this.fireSystem = new FireSystem(rng, {
      onBuildingCollapsed: (gridX, gridY, defId) => {
        this.callbacks.onToast(`FIRE DESTROYED: ${defId} at (${gridX}, ${gridY})`, 'critical');
        this.callbacks.onBuildingCollapsed?.(gridX, gridY, defId);
      },
      onFireStarted: (gridX, gridY) => {
        this.callbacks.onToast(`FIRE AT (${gridX}, ${gridY})`, 'warning');
      },
    });

    // Disease System — outbreak/recovery/mortality per citizen
    initDiseaseSystem(rng ?? null);

    // Plan Mandates — building construction mandates per era
    const initialEraId = this.eraSystem.getCurrentEraId();
    const initialMandates = createMandatesForEra(initialEraId, this.difficulty);
    this.mandateState = createPlanMandateState(initialMandates);

    // Wire ECS callbacks to UI
    setStarvationCallback(() => {
      this.callbacks.onToast('STARVATION DETECTED', 'critical');
    });

    setBuildingCollapsedCallback((gridX, gridY, type, footprintX, footprintY) => {
      this.callbacks.onToast(`Building collapsed at (${gridX}, ${gridY}): ${type}`, 'critical');
      // Clear ALL footprint grid cells
      for (let dx = 0; dx < footprintX; dx++) {
        for (let dy = 0; dy < footprintY; dy++) {
          this.grid.setCell(gridX + dx, gridY + dy, null);
        }
      }
      this.callbacks.onBuildingCollapsed?.(gridX, gridY, type);
    });
  }

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
    return this.chronology;
  }

  public getPersonnelFile(): PersonnelFile {
    return this.personnelFile;
  }

  public getDeliveries(): CompulsoryDeliveries {
    return this.deliveries;
  }

  public getSettlement(): SettlementSystem {
    return this.settlement;
  }

  public getEraSystem(): EraSystem {
    return this.eraSystem;
  }

  public getEconomySystem(): EconomySystem {
    return this.economySystem;
  }

  public getPoliticalEntities(): PoliticalEntitySystem {
    return this.politicalEntities;
  }

  /** Get the WorkerSystem for worker info and assignment. */
  public getWorkerSystem(): WorkerSystem {
    return this.workerSystem;
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
    return this.fireSystem;
  }

  public getAchievements(): AchievementTracker {
    return this.achievements;
  }

  public getQuota(): Readonly<QuotaState> {
    return this.quota;
  }

  /** Record that a building was placed — updates mandate fulfillment tracking. */
  public recordBuildingForMandates(defId: string): void {
    if (this.mandateState) {
      this.mandateState = recordBuildingPlaced(this.mandateState, defId);
    }
  }

  /** Get the current mandate state (for UI display). */
  public getMandateState(): PlanMandateState | null {
    return this.mandateState;
  }

  /**
   * Serialize all subsystem state into a single blob for save persistence.
   */
  public serializeSubsystems(): SubsystemSaveData {
    return serializeSubsystemsHelper(this.getSerializableEngine());
  }

  /**
   * Restore all subsystem state from a deserialized save blob.
   * Replaces internal system instances with deserialized versions.
   */
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
    this.lastSeason = se.lastSeason;
    this.lastWeather = se.lastWeather;
    this.lastDayPhase = se.lastDayPhase;
    this.lastThreatLevel = se.lastThreatLevel;
    this.pendingReport = se.pendingReport;
    this.ended = se.ended;

    // Re-wire EventSystem → PersonnelFile after deserialization replaces instances
    this.eventSystem.setPersonnelFile(this.personnelFile);
  }

  /**
   * Called by UI when the player makes a minigame choice.
   * Applies the outcome (resources, marks, commendations) and emits UI notifications.
   */
  public resolveMinigameChoice(choiceId: string): void {
    resolveMinigameChoiceHelper(this.getMinigameContext(), choiceId);
  }

  /**
   * Called by CanvasGestureManager (via callback) when a building is tapped.
   * Checks if the building defId triggers a minigame.
   */
  public checkBuildingTapMinigame(buildingDefId: string): void {
    checkBuildingTapMinigameHelper(this.getMinigameContext(), buildingDefId);
  }

  /**
   * Called after EventSystem fires an event — check if the event triggers a minigame.
   */
  public checkEventMinigame(eventId: string): void {
    checkEventMinigameHelper(this.getMinigameContext(), eventId);
  }

  /**
   * Main simulation tick — runs all ECS systems in order,
   * then syncs system state to ECS gameMeta for React.
   */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: tick orchestrates 18+ subsystems sequentially
  public tick(): void {
    if (this.ended) return;

    // 1. Advance time via ChronologySystem
    const tickResult = this.chronology.tick();
    this.syncChronologyToMeta(tickResult);
    this.emitChronologyChanges(tickResult);

    // Check era transition + quota on year boundary
    if (tickResult.newYear) {
      this.checkEraTransition();
      const reportCtx = this.getAnnualReportContext();
      checkQuotaHelper(reportCtx);
      this.syncAnnualReportState(reportCtx.engineState);
    }

    // Advance gradual modifier transition blend (if in progress)
    this.eraSystem.tickTransition();

    // 2-7. Run ECS systems
    // Get weather + politburo + era modifiers for production
    const weatherProfile = getWeatherProfile(tickResult.weather as WeatherType);
    const politburoMods = this.politburo.getModifiers();
    const eraMods = this.eraSystem.getModifiers();
    const farmMod =
      weatherProfile.farmModifier * politburoMods.foodProductionMult * eraMods.productionMult;
    const vodkaMod = politburoMods.vodkaProductionMult * eraMods.productionMult;

    powerSystem();

    // Transport System — road quality, condition decay, maintenance, mitigation
    const storeRef = getResourceEntity();
    const transportResult = this.transport.tick(
      operationalBuildings.entities,
      this.settlement.getCurrentTier(),
      this.chronology.getDate().totalTicks,
      tickResult.season,
      storeRef?.resources
    );

    constructionSystem(
      this.eraSystem.getConstructionTimeMult(),
      weatherProfile.constructionTimeMult,
      transportResult.seasonBuildMult
    );

    // Capture pre-production resource levels for CompulsoryDeliveries delta
    const foodBefore = storeRef?.resources.food ?? 0;
    const vodkaBefore = storeRef?.resources.vodka ?? 0;
    const moneyBefore = storeRef?.resources.money ?? 0;

    productionSystem(farmMod, vodkaMod);

    // Storage & spoilage — capacity from buildings, seasonal food decay
    storageSystem(this.chronology.getDate().month);

    // Economy System — trudodni, fondy, blat, stakhanovite, MTS, heating, reforms
    this.tickEconomySystem();

    // Apply CompulsoryDeliveries — state extraction of new production + income
    // Runs AFTER both productionSystem and economySystem so we capture all
    // new food, vodka, and money generated this tick.
    if (storeRef) {
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

    consumptionSystem(eraMods.consumptionMult);

    // Disease System — outbreak checks (monthly) + disease progression (every tick)
    const diseaseResult = diseaseTick(
      this.chronology.getDate().totalTicks,
      this.chronology.getDate().month
    );
    // Sync disease deaths to the resource store
    if (diseaseResult.deaths > 0 && storeRef) {
      storeRef.resources.population = Math.max(
        0,
        storeRef.resources.population - diseaseResult.deaths
      );
    }
    // Emit Pravda headlines for outbreaks
    if (diseaseResult.outbreakTypes.length > 0) {
      const rngLocal = this.rng;
      for (const diseaseType of diseaseResult.outbreakTypes) {
        const headlines = DISEASE_PRAVDA_HEADLINES[diseaseType];
        if (headlines && headlines.length > 0) {
          const headline = rngLocal
            ? rngLocal.pick(headlines)
            : headlines[Math.floor(Math.random() * headlines.length)]!;
          this.callbacks.onPravda(headline);
        }
      }
    }

    populationSystem(
      this.rng,
      politburoMods.populationGrowthMult * eraMods.populationGrowthMult,
      this.chronology.getDate().month
    );

    // Worker System — sync citizen entities to match population, then tick worker stats
    const pop = getResourceEntity()?.resources.population ?? 0;
    this.workerSystem.syncPopulation(pop);
    const vodkaAvail = getResourceEntity()?.resources.vodka ?? 0;
    const foodAvail = getResourceEntity()?.resources.food ?? 0;
    this.workerSystem.tick(vodkaAvail, foodAvail);

    // Demographic System — births, deaths, aging for dvor households
    const normalizedFood = storeRef
      ? Math.min(1, storeRef.resources.food / Math.max(1, storeRef.resources.population * 2))
      : 0.5;
    const demoResult = demographicTick(
      this.rng ?? null,
      this.chronology.getDate().totalTicks,
      normalizedFood
    );
    // Sync dvor population changes to the resource store
    if (storeRef && (demoResult.births > 0 || demoResult.deaths > 0)) {
      storeRef.resources.population = Math.max(
        0,
        storeRef.resources.population + demoResult.births - demoResult.deaths
      );
    }

    decaySystem(politburoMods.infrastructureDecayMult * eraMods.decayMult);
    quotaSystem(this.quota);

    // Gulag effect: powered gulags have a 10% chance of reducing population
    this.processGulagEffect();

    // Settlement Evolution — evaluate tier changes
    this.tickSettlement();

    // Per-era victory/failure condition checks
    this.checkEraConditions();

    // Political Entities — sync counts and tick effects
    this.tickPoliticalEntities();

    // Minigame Router — check periodic triggers and auto-resolve timeouts
    tickMinigamesHelper(this.getMinigameContext());

    // 8-10. Events, Politburo, and Pravda
    this.eventSystem.tick(this.chronology.getDate().totalTicks, eraMods.eventFrequencyMult);

    // Fire System — spread, damage, zeppelin AI (after events so new fires are processed)
    this.fireSystem.tick(tickResult.weather, this.grid);

    // PolitburoSystem now writes ECS directly — no delta-capture hack needed
    this.politburo.setCorruptionMult(eraMods.corruptionMult);
    this.politburo.tick(tickResult);

    this.tickPravda();

    // Personnel file — tick for mark decay + check arrest
    const totalTicks = this.chronology.getDate().totalTicks;
    this.personnelFile.tick(totalTicks);

    // Track threat level escalation for scoring (investigation = no clean era bonus)
    const currentThreat = this.personnelFile.getThreatLevel();
    if (
      currentThreat === 'investigated' ||
      currentThreat === 'reviewed' ||
      currentThreat === 'arrested'
    ) {
      if (
        this.lastThreatLevel !== 'investigated' &&
        this.lastThreatLevel !== 'reviewed' &&
        this.lastThreatLevel !== 'arrested'
      ) {
        this.scoring.onInvestigation();
      }
    }
    this.lastThreatLevel = currentThreat;

    if (this.personnelFile.isArrested()) {
      this.endGame(
        false,
        'Your personnel file has been reviewed. You have been declared an Enemy of the People. No further correspondence is expected.'
      );
    }

    // Tutorial System — check milestones for progressive disclosure (Era 1)
    tickTutorialHelper(this.getAchievementContext());

    // Achievement Tracker — update stats and check unlock conditions
    tickAchievementsHelper(this.getAchievementContext());

    // Sync non-resource state to gameMeta for React snapshots
    this.syncSystemsToMeta();

    // Check loss: population wiped out (only after first year so starting at 0 doesn't auto-lose)
    const store = getResourceEntity();
    if (
      (store?.resources.population ?? 0) <= 0 &&
      this.chronology.getDate().totalTicks > TICKS_PER_YEAR &&
      buildingsLogic.entities.length > 0
    ) {
      this.endGame(false, 'All citizens have perished. The settlement is abandoned.');
    }

    // Notify React
    this.callbacks.onStateChange();
  }

  // ── Context builders for extracted helpers ──

  private getMinigameContext() {
    return {
      chronology: this.chronology,
      minigameRouter: this.minigameRouter,
      personnelFile: this.personnelFile,
      callbacks: this.callbacks,
    };
  }

  private getAchievementContext() {
    return {
      chronology: this.chronology,
      achievements: this.achievements,
      tutorial: this.tutorial,
      callbacks: this.callbacks,
    };
  }

  private getAnnualReportContext() {
    return {
      chronology: this.chronology,
      personnelFile: this.personnelFile,
      scoring: this.scoring,
      callbacks: this.callbacks,
      rng: this.rng,
      deliveries: this.deliveries,
      engineState: {
        quota: this.quota,
        consecutiveQuotaFailures: this.consecutiveQuotaFailures,
        pendingReport: this.pendingReport,
        mandateState: this.mandateState,
      },
      endGame: (victory: boolean, reason: string) => this.endGame(victory, reason),
    };
  }

  private getSerializableEngine() {
    return {
      chronology: this.chronology,
      eraSystem: this.eraSystem,
      economySystem: this.economySystem,
      eventSystem: this.eventSystem,
      pravdaSystem: this.pravdaSystem,
      politburo: this.politburo,
      personnelFile: this.personnelFile,
      deliveries: this.deliveries,
      settlement: this.settlement,
      politicalEntities: this.politicalEntities,
      minigameRouter: this.minigameRouter,
      scoring: this.scoring,
      tutorial: this.tutorial,
      achievements: this.achievements,
      mandateState: this.mandateState,
      transport: this.transport,
      fireSystem: this.fireSystem,
      quota: this.quota,
      consecutiveQuotaFailures: this.consecutiveQuotaFailures,
      lastSeason: this.lastSeason,
      lastWeather: this.lastWeather,
      lastDayPhase: this.lastDayPhase,
      lastThreatLevel: this.lastThreatLevel,
      pendingReport: this.pendingReport,
      ended: this.ended,
      rng: this.rng,
      eventHandler: this.eventHandler,
      politburoEventHandler: this.politburoEventHandler,
      syncSystemsToMeta: () => this.syncSystemsToMeta(),
    };
  }

  /**
   * Syncs mutated annual report state back from the helper context object.
   */
  private syncAnnualReportState(state: AnnualReportEngineState): void {
    this.consecutiveQuotaFailures = state.consecutiveQuotaFailures;
    this.pendingReport = state.pendingReport;
    this.mandateState = state.mandateState;
  }

  // ── Private methods that remain in the orchestrator ──

  /**
   * Syncs the chronology tick result to gameMeta date fields.
   */
  private syncChronologyToMeta(_tick: TickResult): void {
    const date = this.chronology.getDate();
    const meta = getMetaEntity();
    if (meta) {
      meta.gameMeta.date.year = date.year;
      meta.gameMeta.date.month = date.month;
      meta.gameMeta.date.tick = date.hour; // map hour to the old tick field
    }
  }

  /**
   * Emits callback notifications when season/weather/dayPhase change.
   */
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

  /**
   * Syncs non-resource system state to gameMeta for React snapshots.
   * Resources are already in ECS and read directly by createSnapshot().
   */
  private syncSystemsToMeta(): void {
    const meta = getMetaEntity();
    if (!meta) return;

    // Sync quota
    meta.gameMeta.quota.type = this.quota.type;
    meta.gameMeta.quota.target = this.quota.target;
    meta.gameMeta.quota.current = this.quota.current;
    meta.gameMeta.quota.deadlineYear = this.quota.deadlineYear;

    // Sync Politburo leader info
    const gs = this.politburo.getGeneralSecretary();
    meta.gameMeta.leaderName = gs.name;
    meta.gameMeta.leaderPersonality = gs.personality;

    // Sync personnel file
    meta.gameMeta.blackMarks = this.personnelFile.getBlackMarks();
    meta.gameMeta.commendations = this.personnelFile.getCommendations();
    meta.gameMeta.threatLevel = this.personnelFile.getThreatLevel();

    // Sync settlement tier
    meta.gameMeta.settlementTier = this.settlement.getCurrentTier();

    // Sync era
    meta.gameMeta.currentEra = this.eraSystem.getCurrentEraId();

    // Sync road quality + condition
    meta.gameMeta.roadQuality = this.transport.getQuality();
    meta.gameMeta.roadCondition = this.transport.getCondition();
  }

  /**
   * Runs the EconomySystem tick and applies results to ECS.
   * Handles fondy material deliveries, trudodni tracking, blat sync,
   * stakhanovite events, MTS farm bonuses, heating effects, and currency reforms.
   */
  private tickEconomySystem(): void {
    const store = getResourceEntity();
    if (!store) return;

    const r = store.resources;
    const date = this.chronology.getDate();
    const totalTicks = date.totalTicks;
    const year = date.year;
    const month = date.month;

    // Gather building defIds from ECS
    const buildingDefIds: string[] = [];
    for (const entity of buildingsLogic) {
      buildingDefIds.push(entity.building.defId);
    }

    // Determine whether the settlement has heating fuel (timber > 0 or power surplus)
    const hasHeatingResource = r.timber > 0 || r.power > r.powerUsed;

    const result = this.economySystem.tick(totalTicks, year, r.population, buildingDefIds, {
      money: r.money,
      month,
      hasHeatingResource,
    });

    // Apply fondy material deliveries to ECS resources
    if (result.fondyDelivered?.delivered) {
      const delivered = result.fondyDelivered.actualDelivered;
      r.timber += delivered.timber;
      r.steel += delivered.steel;
      r.money += delivered.money;
      r.food += delivered.food;
      r.vodka += delivered.vodka;
    }

    // Sync trudodni and blat to ECS
    r.trudodni += result.trudodniEarned;
    r.blat = result.blatLevel;

    // Apply currency reform (money transformation)
    if (result.currencyReform) {
      r.money = result.currencyReform.moneyAfter;
      const reformName = result.currencyReform.reform.name;
      this.callbacks.onToast(`CURRENCY REFORM: ${reformName}`, 'critical');
      this.callbacks.onAdvisor(
        `Comrade, the State has enacted the ${reformName}. ` +
          `Your treasury has been adjusted from ${Math.round(result.currencyReform.moneyBefore)} ` +
          `to ${Math.round(result.currencyReform.moneyAfter)} rubles.`
      );
    }

    // Stakhanovite event — production hero notification
    if (result.stakhanovite) {
      const s = result.stakhanovite;
      this.callbacks.onPravda(
        `HERO OF LABOR: Comrade ${s.workerName} at ${s.building} exceeds quota by ${Math.round(s.productionBoost * 100)}%!`
      );
    }

    // MTS farm productivity cost — deduct rental from treasury
    if (result.mtsResult?.applied) {
      r.money = Math.max(0, r.money - result.mtsResult.cost);
    }

    // Heating — at-risk population affects decay or population loss
    if (result.heatingResult && !result.heatingResult.operational) {
      // Non-operational heating in winter causes population attrition
      const atRisk = result.heatingResult.populationAtRisk;
      if (atRisk > 0) {
        const losses = Math.ceil(atRisk * 0.01); // 1% of at-risk pop per tick
        r.population = Math.max(0, r.population - losses);
      }
    }

    // Blat KGB risk — passive investigation/arrest from high connections
    if (result.blatKgbResult) {
      const kgb = result.blatKgbResult;
      if (kgb.investigated) {
        this.personnelFile.addMark(
          'blat_noticed',
          totalTicks,
          kgb.announcement ?? 'KGB investigation into blat connections'
        );
        this.callbacks.onToast('KGB INVESTIGATION: Blat connections noticed', 'critical');
      }
      if (kgb.arrested) {
        this.personnelFile.addMark(
          'blat_noticed',
          totalTicks,
          kgb.announcement ?? 'Arrested for anti-Soviet networking activities'
        );
        this.callbacks.onAdvisor(
          'Comrade, your extensive network of personal favors has attracted ' +
            'unwelcome attention from the organs of state security. ' +
            'Perhaps fewer friends would be safer.'
        );
      }
    }

    // Consumer goods — satisfaction from blat + settlement tier
    const settlementTier = this.settlement.getCurrentTier();
    this.economySystem.tickConsumerGoods(r.population, settlementTier);
  }

  /**
   * Gulag effect — powered gulags have a 10% chance per tick
   * of "disappearing" a citizen.
   */
  private processGulagEffect(): void {
    const store = getResourceEntity();
    if (!store || store.resources.population <= 0) return;

    for (const entity of buildingsLogic) {
      if (entity.building.housingCap < 0) {
        if (entity.building.powered && store.resources.population > 0) {
          if ((this.rng?.random() ?? Math.random()) < 0.1) {
            store.resources.population--;
            this.scoring.onKGBLoss(1);
          }
        }
      }
    }
  }

  /**
   * Evaluates settlement tier from ECS building data + population.
   * Fires advisor/toast callbacks on tier changes.
   */
  private tickSettlement(): void {
    const store = getResourceEntity();
    const population = store?.resources.population ?? 0;

    // Build metrics from ECS entities
    const buildingList: SettlementMetrics['buildings'] = [];
    let totalCapacity = 0;
    let nonAgriCapacity = 0;

    for (const entity of buildingsLogic) {
      const def = getBuildingDef(entity.building.defId);
      const role = def?.role ?? 'unknown';
      buildingList.push({ defId: entity.building.defId, role });

      // Approximate workforce composition from housing capacity
      const cap = Math.max(0, entity.building.housingCap);
      totalCapacity += cap;
      if (role !== 'agriculture') {
        nonAgriCapacity += cap;
      }
    }

    const metrics: SettlementMetrics = {
      population,
      buildings: buildingList,
      totalWorkers: population,
      nonAgriculturalWorkers:
        totalCapacity > 0 ? Math.round((nonAgriCapacity / totalCapacity) * population) : 0,
    };

    const event = this.settlement.tick(metrics);
    if (event) {
      if (event.type === 'upgrade') {
        // Fire the modal callback for upgrades
        this.callbacks.onSettlementChange?.(event);
      } else {
        // Downgrades get a critical toast + advisor
        this.callbacks.onAdvisor(`${event.title}\n\n${event.description}`);
        this.callbacks.onToast(`DOWNGRADED: ${event.toTier.toUpperCase()}`, 'critical');
      }
    }
  }

  /**
   * Tick political entities — sync entity counts (every ~30 ticks) and
   * process per-tick effects. Applies KGB black marks to personnel file,
   * population drain from conscription, and emits announcements.
   */
  private tickPoliticalEntities(): void {
    const totalTicks = this.chronology.getDate().totalTicks;
    const store = getResourceEntity();
    const meta = getMetaEntity();
    const tier = this.settlement.getCurrentTier();
    const eraId = this.eraSystem.getCurrentEraId();

    // Sync entity counts every 30 ticks (roughly every 10 days)
    if (totalTicks % 30 === 0) {
      const avgCorruption = this.getAveragePolitburoCorruption();
      this.politicalEntities.syncEntities(tier, eraId, avgCorruption);
    }

    const result = this.politicalEntities.tick(totalTicks);

    // Apply population drain from conscription
    if (result.workersConscripted > 0 && store) {
      store.resources.population = Math.max(
        0,
        store.resources.population - result.workersConscripted
      );
      this.scoring.onConscription(result.workersConscripted);
    }

    // Apply population return from orgnabor/conscription
    if (result.workersReturned > 0 && store) {
      store.resources.population += result.workersReturned;
    }

    // Apply KGB black marks to personnel file
    if (result.blackMarksAdded > 0) {
      this.scoring.onKGBLoss(result.blackMarksAdded);
    }
    for (let i = 0; i < result.blackMarksAdded; i++) {
      this.personnelFile.addMark(
        'lying_to_kgb',
        totalTicks,
        'KGB investigation uncovered irregularities'
      );
    }

    // Emit announcements
    for (const announcement of result.announcements) {
      this.callbacks.onToast(announcement, 'warning');
    }

    // Sync to meta for React
    if (meta) {
      meta.gameMeta.blackMarks = this.personnelFile.getBlackMarks();
      meta.gameMeta.commendations = this.personnelFile.getCommendations();
      meta.gameMeta.threatLevel = this.personnelFile.getThreatLevel();
    }
  }

  /**
   * Compute average corruption across all Politburo ministers.
   * Used to scale KGB agent presence in PoliticalEntitySystem.
   */
  private getAveragePolitburoCorruption(): number {
    const state = this.politburo.getState();
    const ministers = [...state.ministers.values()];
    if (ministers.length === 0) return 0;
    const total = ministers.reduce((sum, m) => sum + m.corruption, 0);
    return total / ministers.length;
  }

  /**
   * Checks if the current year triggers a historical era transition.
   * When an era changes:
   * - Updates CompulsoryDeliveries doctrine and rates
   * - Resets personnel file marks to 2 (fresh-ish start)
   * - Saves an era checkpoint for restart-from-checkpoint
   * - Fires the onEraChanged callback for UI (briefing modal)
   */
  private checkEraTransition(): void {
    const meta = getMetaEntity();
    const currentYear = meta?.gameMeta.date.year ?? 1922;
    const newEra = this.eraSystem.checkTransition(currentYear);

    if (newEra) {
      // Score the completed era before transitioning
      const prevEraId = this.eraSystem.getPreviousEraId();
      if (prevEraId) {
        const prevEraIdx = eraIdToIndex(prevEraId);
        const store = getResourceEntity();
        const prevEraDef = ERA_DEFINITIONS[prevEraId];
        this.scoring.onEraEnd(
          prevEraIdx,
          prevEraDef?.name ?? prevEraId,
          store?.resources.population ?? 0,
          buildingsLogic.entities.length,
          this.personnelFile.getCommendations(),
          this.personnelFile.getBlackMarks()
        );
      }

      // Save checkpoint for the new era (snapshot before changes)
      this.eraSystem.saveCheckpoint(
        JSON.stringify({
          year: currentYear,
          eraId: newEra.id,
        })
      );

      // Update CompulsoryDeliveries doctrine to match the new era
      this.deliveries.setDoctrine(newEra.doctrine);

      // Update EconomySystem era (fondy reliability, rates, etc.)
      const economyEra = GAME_ERA_TO_ECONOMY_ERA[newEra.id] ?? 'revolution';
      this.economySystem.setEra(economyEra);

      // Update TransportSystem era (score bonuses vary by era)
      this.transport.setEra(newEra.id);

      // Generate new building mandates for the new era
      const newMandates = createMandatesForEra(newEra.id, this.difficulty);
      this.mandateState = createPlanMandateState(newMandates);

      // Reset personnel file marks to 2 (design: fresh-ish start per era)
      this.personnelFile.resetForNewEra();

      // Fire callback for UI (era assignment briefing modal)
      this.callbacks.onEraChanged?.(newEra);

      // Advisor notification
      this.callbacks.onAdvisor(`${newEra.introTitle}\n\n${newEra.introText}`);

      // Toast for era transition
      this.callbacks.onToast(`NEW ERA: ${newEra.name.toUpperCase()}`, 'warning');
    }
  }

  /**
   * Checks per-era victory/failure conditions each tick.
   * Victory ends the current era successfully; failure triggers game-over
   * (unless a checkpoint allows restart).
   */
  private checkEraConditions(): void {
    const meta = getMetaEntity();
    const res = getResourceEntity();
    if (!meta || !res) return;

    // Grace period: skip era conditions during the first year so the player
    // isn't immediately eliminated before they have a chance to act.
    // Also skip if there are no buildings (game hasn't really started).
    if (
      this.chronology.getDate().totalTicks <= TICKS_PER_YEAR ||
      buildingsLogic.entities.length === 0
    ) {
      return;
    }

    const era = this.eraSystem.getCurrentEra();

    // Check failure condition
    if (era.failureCondition) {
      const failed = era.failureCondition.check(meta.gameMeta, res.resources);
      if (failed) {
        this.endGame(false, `ERA FAILURE: ${era.name} — ${era.failureCondition.description}`);
        return;
      }
    }

    // Check victory condition
    if (era.victoryCondition) {
      const won = era.victoryCondition.check(meta.gameMeta, res.resources);
      if (won) {
        this.callbacks.onToast(`ERA VICTORY: ${era.name.toUpperCase()}`, 'warning');
        this.callbacks.onAdvisor(
          `Congratulations, Comrade Director. You have completed the objectives for ${era.name}. ` +
            `The Politburo acknowledges your adequate performance. Do not let it go to your head.`
        );
      }
    }
  }

  private endGame(victory: boolean, reason: string): void {
    if (this.ended) return;
    this.ended = true;
    const meta = getMetaEntity();
    if (meta) {
      meta.gameMeta.gameOver = { victory, reason };
    }
    this.callbacks.onGameOver?.(victory, reason);

    // Generate and emit the end-game tally
    if (this.callbacks.onGameTally) {
      const res = getResourceEntity();
      const date = this.chronology.getDate();
      const tally = createGameTally(this.scoring, this.achievements, {
        victory,
        reason,
        currentYear: date.year,
        startYear: 1922,
        population: res?.resources.population ?? 0,
        buildingCount: buildingsLogic.entities.length,
        money: res?.resources.money ?? 0,
        food: res?.resources.food ?? 0,
        vodka: res?.resources.vodka ?? 0,
        blackMarks: this.personnelFile.getBlackMarks(),
        commendations: this.personnelFile.getCommendations(),
        settlementTier: this.settlement.getCurrentTier(),
        quotaFailures: this.consecutiveQuotaFailures,
      });
      this.callbacks.onGameTally(tally);
    }
  }

  /**
   * Applies a GameEvent's resource effects to the ECS store.
   * Used for PolitburoSystem events (EventSystem applies its own internally).
   */
  private applyEventEffects(event: GameEvent): void {
    const fx = event.effects;
    const store = getResourceEntity();
    if (store) {
      const r = store.resources;
      if (fx.money) r.money = Math.max(0, r.money + fx.money);
      if (fx.food) r.food = Math.max(0, r.food + fx.food);
      if (fx.vodka) r.vodka = Math.max(0, r.vodka + fx.vodka);
      if (fx.pop) r.population = Math.max(0, r.population + fx.pop);
      if (fx.power) r.power = Math.max(0, r.power + fx.power);
    }
  }

  private tickPravda(): void {
    const headline = this.pravdaSystem.generateAmbientHeadline();
    if (headline) {
      this.callbacks.onPravda(headline.headline);
    }
  }
}

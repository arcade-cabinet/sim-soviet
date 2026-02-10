/**
 * SimulationEngine — thin orchestrator over ECS systems.
 *
 * The Miniplex ECS world is the source of truth for game simulation.
 * This engine calls ECS systems in order each tick, then syncs the
 * resource store back to GameState for React snapshot consumption.
 *
 * Systems executed per tick (in order):
 *   1. ChronologySystem       — advance time, season, weather, day/night
 *   2. powerSystem             — distribute power across buildings
 *   3. productionSystem        — produce food/vodka from powered producers
 *   4. CompulsoryDeliveries    — state extraction of new production
 *   5. consumptionSystem       — citizens consume food and vodka
 *   6. populationSystem        — population growth from housing + food
 *   7. decaySystem             — buildings degrade over time
 *   8. quotaSystem             — track 5-year plan progress
 *   9. SettlementSystem        — evaluate tier upgrades/downgrades
 *  10. EventSystem             — random satirical events
 *  11. PolitburoSystem         — corruption drain, politburo events
 *  12. PravdaSystem            — generate propaganda headlines
 *  13. PersonnelFile           — black mark decay, arrest check
 */

import { getBuildingDef } from '@/data/buildingDefs';
import { buildingsLogic, getResourceEntity } from '@/ecs/archetypes';
import type { QuotaState } from '@/ecs/systems';
import {
  consumptionSystem,
  createDefaultQuota,
  decaySystem,
  populationSystem,
  powerSystem,
  productionSystem,
  quotaSystem,
  setBuildingCollapsedCallback,
  setStarvationCallback,
} from '@/ecs/systems';
import { TICKS_PER_YEAR } from './Chronology';
import type { TickResult } from './ChronologySystem';
import { ChronologySystem } from './ChronologySystem';
import { CompulsoryDeliveries } from './CompulsoryDeliveries';
import type { GameEvent } from './EventSystem';
import { EventSystem } from './EventSystem';
import type { GameState } from './GameState';
import { PersonnelFile } from './PersonnelFile';
import { PolitburoSystem } from './PolitburoSystem';
import { PravdaSystem } from './PravdaSystem';
import type { GameRng } from './SeedSystem';
import type { SettlementEvent, SettlementMetrics } from './SettlementSystem';
import { SettlementSystem } from './SettlementSystem';
import { getWeatherProfile, type WeatherType } from './WeatherSystem';

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
}

/** Consecutive quota failures that trigger game over. */
const MAX_QUOTA_FAILURES = 3;

export class SimulationEngine {
  private chronology: ChronologySystem;
  private eventSystem: EventSystem;
  private pravdaSystem: PravdaSystem;
  private politburo: PolitburoSystem;
  private personnelFile: PersonnelFile;
  private deliveries: CompulsoryDeliveries;
  private settlement: SettlementSystem;
  private quota: QuotaState;
  private rng: GameRng | undefined;
  private lastSeason = '';
  private lastWeather = '';
  private lastDayPhase = '';
  private consecutiveQuotaFailures = 0;
  private ended = false;

  constructor(
    private gameState: GameState,
    private callbacks: SimCallbacks,
    rng?: GameRng
  ) {
    this.rng = rng;
    this.quota = createDefaultQuota();
    this.chronology = new ChronologySystem(
      rng ??
        ({
          random: () => Math.random(),
          int: (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1)),
          pick: <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]!,
        } as GameRng),
      gameState.date.year
    );
    this.pravdaSystem = new PravdaSystem(gameState, rng);

    const eventHandler = (event: GameEvent) => {
      const headline = this.pravdaSystem.headlineFromEvent(event);
      const severityLabel =
        event.severity === 'catastrophic'
          ? '[CATASTROPHIC]'
          : event.severity === 'major'
            ? '[MAJOR]'
            : '';
      this.callbacks.onAdvisor(`${severityLabel} ${event.title}\n\n${event.description}`);
      this.callbacks.onPravda(headline.headline);
    };

    this.eventSystem = new EventSystem(gameState, eventHandler, rng);

    // PolitburoSystem events carry effects (money, food, pop, etc.) but unlike
    // EventSystem, they don't apply effects internally. Wrap the handler to
    // apply resource deltas to the ECS store before dispatching UI notifications.
    const politburoEventHandler = (event: GameEvent) => {
      this.applyEventEffects(event);
      eventHandler(event);
    };
    this.politburo = new PolitburoSystem(gameState, politburoEventHandler, rng);

    // Personnel File — tracks black marks and commendations (game-over mechanic)
    this.personnelFile = new PersonnelFile();

    // Compulsory Deliveries — state takes cut of production
    this.deliveries = new CompulsoryDeliveries();
    if (rng) this.deliveries.setRng(rng);

    // Settlement Evolution — selo → posyolok → pgt → gorod
    this.settlement = new SettlementSystem(gameState.settlementTier);

    // Wire ECS callbacks to UI
    setStarvationCallback(() => {
      this.callbacks.onToast('STARVATION DETECTED', 'critical');
    });

    setBuildingCollapsedCallback((gridX, gridY, type, footprintX, footprintY) => {
      this.callbacks.onToast(`Building collapsed at (${gridX}, ${gridY}): ${type}`, 'critical');
      // Clear ALL footprint grid cells and remove from GameState
      for (let dx = 0; dx < footprintX; dx++) {
        for (let dy = 0; dy < footprintY; dy++) {
          this.gameState.setCell(gridX + dx, gridY + dy, null);
        }
      }
      this.gameState.removeBuilding(gridX, gridY);
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

  public getQuota(): Readonly<QuotaState> {
    return this.quota;
  }

  /**
   * Main simulation tick — runs all ECS systems in order,
   * then syncs state back to GameState for React.
   */
  public tick(): void {
    if (this.ended) return;

    // 1. Advance time via ChronologySystem
    const tickResult = this.chronology.tick();
    this.syncChronologyToGameState(tickResult);
    this.emitChronologyChanges(tickResult);

    // Check quota on year boundary
    if (tickResult.newYear) {
      this.checkQuota();
    }

    // 2-7. Run ECS systems
    // Get weather + politburo modifiers for production
    const weatherProfile = getWeatherProfile(tickResult.weather as WeatherType);
    const politburoMods = this.politburo.getModifiers();
    const farmMod = weatherProfile.farmModifier * politburoMods.foodProductionMult;
    const vodkaMod = politburoMods.vodkaProductionMult;

    powerSystem();

    // Capture pre-production resource levels for CompulsoryDeliveries delta
    const storeRef = getResourceEntity();
    const foodBefore = storeRef?.resources.food ?? 0;
    const vodkaBefore = storeRef?.resources.vodka ?? 0;

    productionSystem(farmMod, vodkaMod);

    // Apply CompulsoryDeliveries — state extraction of new production
    if (storeRef) {
      const newFood = storeRef.resources.food - foodBefore;
      const newVodka = storeRef.resources.vodka - vodkaBefore;
      if (newFood > 0 || newVodka > 0) {
        const result = this.deliveries.applyDeliveries(newFood, newVodka, 0);
        storeRef.resources.food = Math.max(0, storeRef.resources.food - result.foodTaken);
        storeRef.resources.vodka = Math.max(0, storeRef.resources.vodka - result.vodkaTaken);
      }
    }

    consumptionSystem();
    populationSystem(this.rng, politburoMods.populationGrowthMult);
    decaySystem(politburoMods.infrastructureDecayMult);
    quotaSystem(this.quota);

    // Gulag effect: powered gulags have a 10% chance of reducing population
    this.processGulagEffect();

    // Settlement Evolution — evaluate tier changes
    this.tickSettlement();

    // 8-10. Events, Politburo, and Pravda
    this.eventSystem.tick(this.chronology.getDate().totalTicks);

    // PolitburoSystem.applyCorruptionDrain() mutates gameState.money directly,
    // but syncEcsToGameState() would overwrite it with the ECS store value.
    // Sync money from ECS first so corruption calculates from accurate baseline,
    // then capture the delta and apply it to the ECS store so it persists.
    const store = getResourceEntity();
    if (store) {
      this.gameState.money = store.resources.money;
    }
    const moneyBeforePolitburo = this.gameState.money;
    this.politburo.tick(tickResult);
    const corruptionDelta = this.gameState.money - moneyBeforePolitburo;
    if (corruptionDelta !== 0 && store) {
      store.resources.money = Math.max(0, store.resources.money + corruptionDelta);
    }

    this.tickPravda();

    // Personnel file — tick for mark decay + check arrest
    const totalTicks = this.chronology.getDate().totalTicks;
    this.personnelFile.tick(totalTicks);
    if (this.personnelFile.isArrested()) {
      this.endGame(
        false,
        'Your personnel file has been reviewed. You have been declared an Enemy of the People. No further correspondence is expected.'
      );
    }

    // Sync ECS resource store → GameState for React snapshots
    this.syncEcsToGameState();

    // Check loss: population wiped out (only after first year so starting at 0 doesn't auto-lose)
    if (
      this.gameState.pop <= 0 &&
      this.chronology.getDate().totalTicks > TICKS_PER_YEAR &&
      this.gameState.buildings.length > 0
    ) {
      this.endGame(false, 'All citizens have perished. The settlement is abandoned.');
    }

    // Notify React
    this.callbacks.onStateChange();
  }

  /**
   * Syncs the chronology tick result to GameState's date fields.
   */
  private syncChronologyToGameState(_tick: TickResult): void {
    const date = this.chronology.getDate();
    this.gameState.date.year = date.year;
    this.gameState.date.month = date.month;
    this.gameState.date.tick = date.hour; // map hour to the old tick field
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
   * Syncs the ECS resource store singleton back to mutable GameState,
   * so React components (via useSyncExternalStore) get updated values.
   */
  private syncEcsToGameState(): void {
    const store = getResourceEntity();
    if (!store) return;

    this.gameState.money = store.resources.money;
    this.gameState.food = store.resources.food;
    this.gameState.vodka = store.resources.vodka;
    this.gameState.power = store.resources.power;
    this.gameState.powerUsed = store.resources.powerUsed;
    this.gameState.pop = store.resources.population;

    // Sync quota to GameState
    this.gameState.quota.type = this.quota.type;
    this.gameState.quota.target = this.quota.target;
    this.gameState.quota.current = this.quota.current;
    this.gameState.quota.deadlineYear = this.quota.deadlineYear;

    // Sync Politburo leader info
    const gs = this.politburo.getGeneralSecretary();
    this.gameState.leaderName = gs.name;
    this.gameState.leaderPersonality = gs.personality;

    // Sync personnel file to GameState
    this.gameState.blackMarks = this.personnelFile.getBlackMarks();
    this.gameState.commendations = this.personnelFile.getCommendations();
    this.gameState.threatLevel = this.personnelFile.getThreatLevel();

    // Sync settlement tier
    this.gameState.settlementTier = this.settlement.getCurrentTier();

    // Sync buildings: rebuild GameState.buildings from ECS entities
    this.gameState.buildings = [];
    for (const entity of buildingsLogic) {
      this.gameState.buildings.push({
        x: entity.position.gridX,
        y: entity.position.gridY,
        defId: entity.building.defId,
        powered: entity.building.powered,
      });
    }
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
      totalWorkers: totalCapacity || population,
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

  private checkQuota(): void {
    if (this.gameState.date.year < this.quota.deadlineYear) return;

    if (this.quota.current >= this.quota.target) {
      this.handleQuotaMet();
    } else {
      this.handleQuotaMissed();
    }
  }

  private handleQuotaMet(): void {
    const totalTicks = this.chronology.getDate().totalTicks;
    this.consecutiveQuotaFailures = 0;

    if (this.quota.current > this.quota.target * 1.1) {
      this.personnelFile.addCommendation('quota_exceeded', totalTicks);
      this.callbacks.onToast('+1 COMMENDATION: Quota exceeded', 'warning');
    }

    this.callbacks.onAdvisor('Quota met. Accept this medal made of tin. Now, produce VODKA.');
    this.quota.type = 'vodka';
    this.quota.target = 500;
    this.quota.deadlineYear = this.gameState.date.year + 5;
    this.quota.current = 0;
  }

  private handleQuotaMissed(): void {
    const totalTicks = this.chronology.getDate().totalTicks;
    this.consecutiveQuotaFailures++;
    const missPercent = 1 - this.quota.current / this.quota.target;

    // Black marks based on how badly the quota was missed
    if (missPercent > 0.6) {
      this.personnelFile.addMark('quota_missed_catastrophic', totalTicks);
    } else if (missPercent > 0.3) {
      this.personnelFile.addMark('quota_missed_major', totalTicks);
    } else if (missPercent > 0.1) {
      this.personnelFile.addMark('quota_missed_minor', totalTicks);
    }

    if (this.consecutiveQuotaFailures >= MAX_QUOTA_FAILURES) {
      this.endGame(
        false,
        `You failed ${MAX_QUOTA_FAILURES} consecutive 5-Year Plans. The Politburo has dissolved your position.`
      );
    } else {
      this.callbacks.onAdvisor(
        `You failed the 5-Year Plan (${this.consecutiveQuotaFailures}/${MAX_QUOTA_FAILURES} failures). The KGB is watching.`
      );
      this.quota.deadlineYear += 5;
    }
  }

  private endGame(victory: boolean, reason: string): void {
    if (this.ended) return;
    this.ended = true;
    this.gameState.gameOver = { victory, reason };
    this.callbacks.onGameOver?.(victory, reason);
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

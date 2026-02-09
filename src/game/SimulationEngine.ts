/**
 * SimulationEngine — thin orchestrator over ECS systems.
 *
 * The Miniplex ECS world is the source of truth for game simulation.
 * This engine calls ECS systems in order each tick, then syncs the
 * resource store back to GameState for React snapshot consumption.
 *
 * Systems executed per tick (in order):
 *   1. ChronologySystem — advance time, season, weather, day/night
 *   2. powerSystem      — distribute power across buildings
 *   3. productionSystem — produce food/vodka from powered producers
 *   4. consumptionSystem — citizens consume food and vodka
 *   5. populationSystem — population growth from housing + food
 *   6. decaySystem       — buildings degrade over time
 *   7. quotaSystem       — track 5-year plan progress
 *   8. EventSystem       — random satirical events
 *   9. PravdaSystem      — generate propaganda headlines
 */

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
import type { GameEvent } from './EventSystem';
import { EventSystem } from './EventSystem';
import type { GameState } from './GameState';
import { PolitburoSystem } from './PolitburoSystem';
import { PravdaSystem } from './PravdaSystem';
import type { GameRng } from './SeedSystem';
import { getWeatherProfile, type WeatherType } from './WeatherSystem';

/**
 * Callback interface for SimulationEngine → React communication.
 * Extended with season/weather/dayPhase change notifications.
 */
export interface SimCallbacks {
  onToast: (msg: string) => void;
  onAdvisor: (msg: string) => void;
  onPravda: (msg: string) => void;
  onStateChange: () => void;
  onSeasonChanged?: (season: string) => void;
  onWeatherChanged?: (weather: string) => void;
  onDayPhaseChanged?: (phase: string, dayProgress: number) => void;
  onBuildingCollapsed?: (gridX: number, gridY: number, type: string) => void;
  onGameOver?: (victory: boolean, reason: string) => void;
}

/** Consecutive quota failures that trigger game over. */
const MAX_QUOTA_FAILURES = 3;

export class SimulationEngine {
  private chronology: ChronologySystem;
  private eventSystem: EventSystem;
  private pravdaSystem: PravdaSystem;
  private politburo: PolitburoSystem;
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

    // Wire ECS callbacks to UI
    setStarvationCallback(() => {
      this.callbacks.onToast('STARVATION DETECTED');
    });

    setBuildingCollapsedCallback((gridX, gridY, type, footprintX, footprintY) => {
      this.callbacks.onToast(`Building collapsed at (${gridX}, ${gridY}): ${type}`);
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
    productionSystem(farmMod, vodkaMod);
    consumptionSystem();
    populationSystem(this.rng, politburoMods.populationGrowthMult);
    decaySystem(politburoMods.infrastructureDecayMult);
    quotaSystem(this.quota);

    // Gulag effect: powered gulags have a 10% chance of reducing population
    this.processGulagEffect();

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

  private checkQuota(): void {
    if (this.gameState.date.year >= this.quota.deadlineYear) {
      if (this.quota.current >= this.quota.target) {
        this.consecutiveQuotaFailures = 0;
        this.callbacks.onAdvisor('Quota met. Accept this medal made of tin. Now, produce VODKA.');
        this.quota.type = 'vodka';
        this.quota.target = 500;
        this.quota.deadlineYear = this.gameState.date.year + 5;
        this.quota.current = 0;
      } else {
        this.consecutiveQuotaFailures++;
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

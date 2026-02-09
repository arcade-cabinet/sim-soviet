import { BUILDING_TYPES } from '../config';
import { EventSystem } from './EventSystem';
import type { GameEvent } from './EventSystem';
import type { GameState } from './GameState';
import { PravdaSystem } from './PravdaSystem';
import type { GameRng } from './SeedSystem';

/**
 * Callback interface — replaces the old UIManager dependency.
 * React components set these callbacks to receive game events.
 */
export interface SimCallbacks {
  onToast: (msg: string) => void;
  onAdvisor: (msg: string) => void;
  onPravda: (msg: string) => void;
  onStateChange: () => void;
}

export class SimulationEngine {
  private eventSystem: EventSystem;
  private pravdaSystem: PravdaSystem;
  private rng: GameRng | undefined;

  constructor(
    private gameState: GameState,
    private callbacks: SimCallbacks,
    rng?: GameRng,
  ) {
    this.rng = rng;
    this.pravdaSystem = new PravdaSystem(gameState, rng);

    this.eventSystem = new EventSystem(
      gameState,
      (event: GameEvent) => {
        const headline = this.pravdaSystem.headlineFromEvent(event);

        const severityLabel =
          event.severity === 'catastrophic'
            ? '[CATASTROPHIC]'
            : event.severity === 'major'
              ? '[MAJOR]'
              : '';

        this.callbacks.onAdvisor(`${severityLabel} ${event.title}\n\n${event.description}`);
        this.callbacks.onPravda(headline.headline);
      },
      rng,
    );
  }

  public getEventSystem(): EventSystem {
    return this.eventSystem;
  }

  public getPravdaSystem(): PravdaSystem {
    return this.pravdaSystem;
  }

  public tick(): void {
    this.advanceTime();
    this.calculateResources();
    this.consumeResources();
    this.updatePopulation();
    this.updateQuota();
    this.eventSystem.tick();
    this.tickPravda();
    this.callbacks.onStateChange();
  }

  private advanceTime(): void {
    this.gameState.date.tick++;
    if (this.gameState.date.tick > 5) {
      this.gameState.date.tick = 0;
      this.gameState.date.month++;
      if (this.gameState.date.month > 12) {
        this.gameState.date.month = 1;
        this.gameState.date.year++;
        this.checkQuota();
      }
    }
  }

  private calculateResources(): void {
    let prodFood = 0;
    let prodVodka = 0;
    let prodPower = 0;
    let reqPower = 0;

    // Calculate power supply first
    this.gameState.buildings.forEach((b) => {
      const stats = BUILDING_TYPES[b.type];
      if (!stats) return;
      if (b.type === 'power' && stats.power) {
        prodPower += stats.power;
      }
    });
    this.gameState.power = prodPower;

    // Run buildings
    this.gameState.buildings.forEach((b) => {
      const stats = BUILDING_TYPES[b.type];
      if (!stats) return;

      let hasPower = true;
      if (stats.powerReq) {
        reqPower += stats.powerReq;
        if (reqPower > this.gameState.power) hasPower = false;
      }
      b.powered = hasPower;

      if (hasPower) {
        if (stats.prod === 'food' && stats.amt) prodFood += stats.amt;
        if (stats.prod === 'vodka' && stats.amt) prodVodka += stats.amt;

        if (b.type === 'gulag') {
          if (this.gameState.pop > 0 && (this.rng?.random() ?? Math.random()) < 0.1) {
            this.gameState.pop--;
          }
        }
      }
    });

    this.gameState.powerUsed = reqPower;
    this.gameState.food += prodFood;
    this.gameState.vodka += prodVodka;
  }

  private consumeResources(): void {
    const foodNeed = Math.ceil(this.gameState.pop / 10);
    if (this.gameState.food >= foodNeed) {
      this.gameState.food -= foodNeed;
    } else {
      this.gameState.pop = Math.max(0, this.gameState.pop - 5);
      this.callbacks.onToast('STARVATION DETECTED');
    }

    const vodkaDrink = Math.ceil(this.gameState.pop / 20);
    if (this.gameState.vodka >= vodkaDrink) {
      this.gameState.vodka -= vodkaDrink;
    }
  }

  private updatePopulation(): void {
    let housingCap = 0;
    this.gameState.buildings.forEach((b) => {
      const stats = BUILDING_TYPES[b.type];
      if (stats && b.powered && stats.cap) housingCap += stats.cap;
    });

    if (this.gameState.pop < housingCap && this.gameState.food > 10) {
      this.gameState.pop += (this.rng?.int(0, 2) ?? Math.floor(Math.random() * 3));
    }
  }

  private updateQuota(): void {
    if (this.gameState.quota.type === 'food') {
      this.gameState.quota.current = this.gameState.food;
    }
    if (this.gameState.quota.type === 'vodka') {
      this.gameState.quota.current = this.gameState.vodka;
    }
  }

  private checkQuota(): void {
    if (this.gameState.date.year >= this.gameState.quota.deadlineYear) {
      if (this.gameState.quota.current >= this.gameState.quota.target) {
        this.callbacks.onAdvisor(
          'Quota met. Accept this medal made of tin. Now, produce VODKA.',
        );
        this.gameState.quota.type = 'vodka';
        this.gameState.quota.target = 500;
        this.gameState.quota.deadlineYear = this.gameState.date.year + 5;
        this.gameState.quota.current = 0;
      } else {
        this.callbacks.onAdvisor(
          'You failed the 5-Year Plan. The KGB is at your door. (GAME OVER - but we let you keep playing in shame)',
        );
        this.gameState.quota.deadlineYear += 5;
      }
    }
  }

  private tickPravda(): void {
    const headline = this.pravdaSystem.generateAmbientHeadline();
    if (headline) {
      this.callbacks.onPravda(headline.headline);
    }
  }
}

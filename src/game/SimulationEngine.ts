import { GameState } from './GameState';
import { BUILDING_TYPES } from '../config';
import type { UIManager } from '../ui/UIManager';

export class SimulationEngine {
  constructor(
    private gameState: GameState,
    private uiManager: UIManager
  ) {}

  public tick(): void {
    this.advanceTime();
    this.calculateResources();
    this.consumeResources();
    this.updatePopulation();
    this.updateQuota();
    this.uiManager.updateUI();
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
    let housingCap = 0;

    // Calculate power supply first
    this.gameState.buildings.forEach((b) => {
      const stats = BUILDING_TYPES[b.type];
      if (b.type === 'power' && stats.power) {
        prodPower += stats.power;
      }
    });
    this.gameState.power = prodPower;

    // Run buildings
    this.gameState.buildings.forEach((b) => {
      const stats = BUILDING_TYPES[b.type];

      // Power check
      let hasPower = true;
      if (stats.powerReq) {
        reqPower += stats.powerReq;
        if (reqPower > this.gameState.power) hasPower = false;
      }
      b.powered = hasPower;

      if (hasPower) {
        if (stats.prod === 'food' && stats.amt) prodFood += stats.amt;
        if (stats.prod === 'vodka' && stats.amt) prodVodka += stats.amt;
        if (stats.cap) housingCap += stats.cap;

        // Gulag logic
        if (b.type === 'gulag') {
          if (this.gameState.pop > 0 && Math.random() < 0.1) {
            this.gameState.pop--;
          }
        }
      }
    });

    this.gameState.powerUsed = reqPower;

    // Add production
    this.gameState.food += prodFood;
    this.gameState.vodka += prodVodka;
  }

  private consumeResources(): void {
    const foodNeed = Math.ceil(this.gameState.pop / 10);
    if (this.gameState.food >= foodNeed) {
      this.gameState.food -= foodNeed;
    } else {
      this.gameState.pop = Math.max(0, this.gameState.pop - 5);
      this.uiManager.showToast('STARVATION DETECTED');
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
      if (b.powered && stats.cap) housingCap += stats.cap;
    });

    if (this.gameState.pop < housingCap && this.gameState.food > 10) {
      this.gameState.pop += Math.floor(Math.random() * 3);
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
        this.uiManager.showAdvisor(
          'Quota met. Accept this medal made of tin. Now, produce VODKA.'
        );
        this.gameState.quota.type = 'vodka';
        this.gameState.quota.target = 500;
        this.gameState.quota.deadlineYear = this.gameState.date.year + 5;
        this.gameState.quota.current = 0;
      } else {
        this.uiManager.showAdvisor(
          'You failed the 5-Year Plan. The KGB is at your door. (GAME OVER - but we let you keep playing in shame)'
        );
        this.gameState.quota.deadlineYear += 5;
      }
    }
  }
}

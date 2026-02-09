import type { GameState } from './GameState';

const SAVE_KEY = 'simsoviet_save_v1';

export interface SaveData {
  version: string;
  timestamp: number;
  money: number;
  pop: number;
  food: number;
  vodka: number;
  power: number;
  powerUsed: number;
  date: { year: number; month: number; tick: number };
  buildings: Array<{ x: number; y: number; type: string; powered: boolean }>;
  quota: { type: string; target: number; current: number; deadlineYear: number };
}

export class SaveSystem {
  constructor(private gameState: GameState) {}

  public save(): boolean {
    try {
      const saveData: SaveData = {
        version: '1.0.0',
        timestamp: Date.now(),
        money: this.gameState.money,
        pop: this.gameState.pop,
        food: this.gameState.food,
        vodka: this.gameState.vodka,
        power: this.gameState.power,
        powerUsed: this.gameState.powerUsed,
        date: { ...this.gameState.date },
        buildings: this.gameState.buildings.map((b) => ({
          x: b.x,
          y: b.y,
          type: b.type,
          powered: b.powered,
        })),
        quota: { ...this.gameState.quota },
      };

      localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
      console.log('Game saved successfully');
      return true;
    } catch (error) {
      console.error('Failed to save game:', error);
      return false;
    }
  }

  public load(): boolean {
    try {
      const savedData = localStorage.getItem(SAVE_KEY);
      if (!savedData) {
        console.log('No save data found');
        return false;
      }

      const data: SaveData = JSON.parse(savedData);

      // Restore state
      this.gameState.money = data.money;
      this.gameState.pop = data.pop;
      this.gameState.food = data.food;
      this.gameState.vodka = data.vodka;
      this.gameState.power = data.power;
      this.gameState.powerUsed = data.powerUsed;
      this.gameState.date = { ...data.date };
      this.gameState.quota = { ...data.quota };

      // Note: Buildings meshes need to be recreated by renderer
      this.gameState.buildings = data.buildings.map((b) => ({
        x: b.x,
        y: b.y,
        type: b.type,
        powered: b.powered,
      }));

      // Update grid cells
      data.buildings.forEach((b) => {
        this.gameState.setCell(b.x, b.y, b.type);
      });

      console.log('Game loaded successfully');
      return true;
    } catch (error) {
      console.error('Failed to load game:', error);
      return false;
    }
  }

  public hasSave(): boolean {
    return localStorage.getItem(SAVE_KEY) !== null;
  }

  public deleteSave(): void {
    localStorage.removeItem(SAVE_KEY);
    console.log('Save data deleted');
  }

  public autoSave(): void {
    // Auto-save every minute
    setInterval(() => {
      this.save();
    }, 60000);
  }
}
